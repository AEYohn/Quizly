"""
Progress Service
Aggregates XP, learning history, and subject suggestions from session data.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select, and_

from ..db_models import LearningSession, ConceptMastery, SyllabusCache


def ensure_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Convert a datetime to UTC ISO string, handling naive datetimes from SQLite."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


async def aggregate_xp_by_subject(
    db: AsyncSession,
    student_name: str,
) -> dict[str, int]:
    """
    Aggregate total XP per topic from learning session state_json,
    then merge "Subject: Subtopic" entries into their parent subject.

    Returns a dict mapping topic/subject name to total XP.
    """
    # Fetch only the columns needed for XP aggregation (avoids loading
    # large messages_json, plan_json, etc.)
    xp_query = (
        select(LearningSession.topic, LearningSession.state_json)
        .where(
            and_(
                LearningSession.student_name == student_name,
                LearningSession.questions_answered > 0,
            )
        )
    )
    xp_result = await db.execute(xp_query)
    xp_rows = xp_result.all()

    # Sum XP per topic from state_json
    topic_xp: dict[str, int] = {}
    for row in xp_rows:
        state = row.state_json or {}
        xp = state.get("total_xp", 0)
        if xp:
            topic_xp[row.topic] = topic_xp.get(row.topic, 0) + xp

    # Merge "Subject: Subtopic" XP entries into parent subject.
    # Sort by length so parents appear before children.
    xp_base_topics = sorted(topic_xp.keys(), key=len)
    xp_to_merge: list[tuple[str, str]] = []
    for xp_key in list(topic_xp.keys()):
        for base in xp_base_topics:
            if xp_key != base and xp_key.startswith(base + ": "):
                xp_to_merge.append((xp_key, base))
                break
    for child, parent in xp_to_merge:
        topic_xp[parent] = topic_xp.get(parent, 0) + topic_xp.pop(child)

    return topic_xp


def _merge_subtopics(subject_stats: dict[str, dict]) -> None:
    """Merge 'Subject: Subtopic' entries into their parent subject (in-place)."""
    base_topics = sorted(subject_stats.keys(), key=len)
    to_merge: list[tuple[str, str]] = []
    for topic_key in list(subject_stats.keys()):
        for base in base_topics:
            if topic_key != base and topic_key.startswith(base + ": "):
                to_merge.append((topic_key, base))
                break
    for child, parent in to_merge:
        if parent not in subject_stats:
            continue
        child_stats = subject_stats.pop(child)
        p = subject_stats[parent]
        p["total_sessions"] += child_stats["total_sessions"]
        p["total_questions"] += child_stats["total_questions"]
        p["total_correct"] += child_stats["total_correct"]
        p["total_xp"] += child_stats["total_xp"]
        if child_stats["last_studied_at"] and (
            not p["last_studied_at"]
            or child_stats["last_studied_at"] > p["last_studied_at"]
        ):
            p["last_studied_at"] = child_stats["last_studied_at"]
        p["has_syllabus"] = p["has_syllabus"] or child_stats.get("has_syllabus", False)


def generate_subject_suggestions(
    studied_subjects: list[dict[str, Any]],
) -> list[str]:
    """Generate subject suggestions based on what the user has studied."""
    CS_KEYWORDS = {
        "c++", "pointer", "struct", "class", "template", "gpu", "llm",
        "programming", "algorithm", "data structure", "array", "code",
        "compiler", "memory", "function", "variable", "iterator",
        "inheritance", "polymorphism", "oop", "software", "cs106",
        "cs", "python", "javascript", "java", "rust", "go",
    }
    MATH_KEYWORDS = {
        "calculus", "algebra", "linear", "matrix", "equation",
        "derivative", "integral", "statistics", "probability",
    }
    SCIENCE_KEYWORDS = {
        "physics", "chemistry", "biology", "cell", "atom",
        "molecule", "force", "energy", "evolution",
    }

    CS_SUGGESTIONS = [
        "Algorithms", "Operating Systems", "Computer Networks",
        "Database Systems", "Machine Learning", "Computer Architecture",
        "Compiler Design", "Discrete Mathematics", "Software Engineering",
        "Web Development", "Cybersecurity", "Distributed Systems",
    ]
    MATH_SUGGESTIONS = [
        "Linear Algebra", "Calculus", "Differential Equations",
        "Statistics", "Discrete Mathematics", "Number Theory",
        "Real Analysis", "Probability Theory",
    ]
    SCIENCE_SUGGESTIONS = [
        "Physics", "Chemistry", "Biology", "Organic Chemistry",
        "Biochemistry", "Anatomy", "Ecology", "Genetics",
    ]
    GENERAL_SUGGESTIONS = [
        "Psychology", "Economics", "Philosophy", "World History",
        "US Government", "Spanish", "Art History", "Statistics",
    ]

    studied_lower = {s["subject"].lower() for s in studied_subjects}
    studied_words: set[str] = set()
    for s in studied_subjects:
        studied_words.update(s["subject"].lower().split())

    cs_score = len(studied_words & CS_KEYWORDS)
    math_score = len(studied_words & MATH_KEYWORDS)
    science_score = len(studied_words & SCIENCE_KEYWORDS)

    if cs_score >= math_score and cs_score >= science_score and cs_score > 0:
        pool = CS_SUGGESTIONS + MATH_SUGGESTIONS[:3]
    elif math_score >= science_score and math_score > 0:
        pool = MATH_SUGGESTIONS + CS_SUGGESTIONS[:3]
    elif science_score > 0:
        pool = SCIENCE_SUGGESTIONS + MATH_SUGGESTIONS[:3]
    else:
        pool = GENERAL_SUGGESTIONS

    suggestions: list[str] = []
    for s in pool:
        if s.lower() not in studied_lower and s not in suggestions:
            suggestions.append(s)
    return suggestions[:8]


async def get_learning_history(
    db: AsyncSession,
    student_name: str,
    student_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Get aggregated learning history per subject for personalized home screen.
    Returns subjects, overall stats, active session, and suggestions.
    """
    # 1. SQL aggregation of sessions by topic
    session_agg_query = (
        select(
            LearningSession.topic,
            func.count().label("total_sessions"),
            func.sum(LearningSession.questions_answered).label("total_questions"),
            func.sum(LearningSession.questions_correct).label("total_correct"),
            func.max(func.coalesce(LearningSession.started_at, LearningSession.created_at)).label("last_studied_at"),
            func.min(func.coalesce(LearningSession.started_at, LearningSession.created_at)).label("first_studied_at"),
        )
        .where(
            and_(
                LearningSession.student_name == student_name,
                LearningSession.questions_answered > 0,
            )
        )
        .group_by(LearningSession.topic)
    )
    session_agg_result = await db.execute(session_agg_query)
    session_agg_rows = session_agg_result.all()

    # Aggregate XP per topic
    topic_xp = await aggregate_xp_by_subject(db, student_name)

    # 2. Cached syllabi (to know which subjects have skill trees)
    if student_id:
        syllabus_query = select(SyllabusCache).where(
            or_(SyllabusCache.student_id == student_id, SyllabusCache.student_id.is_(None))
        )
    else:
        syllabus_query = select(SyllabusCache)
    syllabus_result = await db.execute(syllabus_query)
    syllabi = syllabus_result.scalars().all()
    syllabus_subjects = {s.subject.lower(): s for s in syllabi}

    # Build subject_stats from SQL aggregation
    subject_stats: dict[str, dict] = {}
    for row in session_agg_rows:
        topic = row.topic
        subject_stats[topic] = {
            "subject": topic,
            "total_sessions": row.total_sessions,
            "total_questions": row.total_questions or 0,
            "total_correct": row.total_correct or 0,
            "total_xp": topic_xp.get(topic, 0),
            "last_studied_at": row.last_studied_at,
            "first_studied_at": row.first_studied_at,
            "has_syllabus": topic.lower() in syllabus_subjects,
        }

    # Add subjects with cached syllabi but no answered questions yet
    for subj_lower, cache_entry in syllabus_subjects.items():
        clean_name = (
            cache_entry.tree_json.get("subject", cache_entry.subject)
            if isinstance(cache_entry.tree_json, dict)
            else cache_entry.subject
        )
        if len(clean_name) > 80:
            continue
        if clean_name not in subject_stats and clean_name.lower() not in {
            s.lower() for s in subject_stats
        }:
            subject_stats[clean_name] = {
                "subject": clean_name,
                "total_sessions": 0,
                "total_questions": 0,
                "total_correct": 0,
                "total_xp": 0,
                "last_studied_at": cache_entry.created_at,
                "first_studied_at": cache_entry.created_at,
                "has_syllabus": True,
            }

    _merge_subtopics(subject_stats)

    # Compute accuracy and format
    subjects: list[dict[str, Any]] = []
    for stats in subject_stats.values():
        accuracy = round(
            stats["total_correct"] / max(1, stats["total_questions"]) * 100
        )
        subjects.append({
            "subject": stats["subject"],
            "total_sessions": stats["total_sessions"],
            "total_questions": stats["total_questions"],
            "accuracy": accuracy,
            "total_xp": stats["total_xp"],
            "last_studied_at": ensure_utc_iso(stats["last_studied_at"]),
            "has_syllabus": stats.get("has_syllabus", False),
        })

    subjects.sort(key=lambda x: x["last_studied_at"] or "", reverse=True)

    # 3. Mastery count (SQL COUNT aggregate)
    mastery_count_query = (
        select(func.count())
        .select_from(ConceptMastery)
        .where(
            and_(
                ConceptMastery.student_name == student_name,
                ConceptMastery.mastery_score >= 80,
            )
        )
    )
    mastery_count_result = await db.execute(mastery_count_query)
    concepts_mastered_count = mastery_count_result.scalar() or 0

    # 4. Active session for resume banner
    active_query = (
        select(LearningSession)
        .where(
            and_(
                LearningSession.student_name == student_name,
                LearningSession.ended_at.is_(None),
                LearningSession.questions_answered > 0,
            )
        )
        .order_by(LearningSession.created_at.desc())
        .limit(1)
    )
    active_result = await db.execute(active_query)
    active_session = active_result.scalars().first()
    active_session_data = None
    if active_session:
        a_state = active_session.state_json or {}
        active_session_data = {
            "session_id": str(active_session.id),
            "topic": active_session.topic,
            "questions_answered": active_session.questions_answered,
            "questions_correct": active_session.questions_correct,
            "total_xp": a_state.get("total_xp", 0),
            "streak": a_state.get("streak", 0),
            "accuracy": round(
                active_session.questions_correct
                / max(1, active_session.questions_answered)
                * 100
            ),
        }

    suggestions = generate_subject_suggestions(subjects)

    return {
        "subjects": subjects,
        "overall": {
            "total_subjects": len(subjects),
            "total_sessions": sum(s["total_sessions"] for s in subjects),
            "total_questions": sum(s["total_questions"] for s in subjects),
            "total_xp": sum(s["total_xp"] for s in subjects),
            "concepts_mastered": concepts_mastered_count,
        },
        "active_session": active_session_data,
        "suggestions": suggestions,
    }

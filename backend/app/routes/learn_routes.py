"""
Learn API Routes
Conversational adaptive learning endpoints.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, delete, func, or_, select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta
import math
import os
import tempfile

from ..database import get_db
from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..db_models import LearningSession, ConceptMastery, SpacedRepetitionItem, SyllabusCache, SubjectResource, User
from ..auth_clerk import get_current_user_clerk_optional, require_teacher_clerk
from ..services.learning_orchestrator import LearningOrchestrator
from ..services.scroll_feed_engine import ScrollFeedEngine
from ..services.content_pool_service import ContentPoolService
from ..services.syllabus_service import SyllabusService
from ..services.knowledge_graph import KnowledgeGraph

router = APIRouter()
logger = get_logger(__name__)


def ensure_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Convert a datetime to UTC ISO string, handling naive datetimes from SQLite."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

# File upload validation
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".doc", ".docx", ".pptx"}


async def validate_upload_file(upload_file: UploadFile) -> bytes:
    """Validate an uploaded file's extension and size.

    Returns the file content if valid.
    Raises HTTPException if invalid.
    """
    # Check extension
    filename = upload_file.filename or "file"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Check content type
    content_type = upload_file.content_type or ""
    allowed_content_types = {
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/octet-stream",  # Fallback for unknown types
    }
    if content_type and content_type not in allowed_content_types:
        raise HTTPException(
            status_code=400,
            detail=f"Content type '{content_type}' not allowed"
        )

    # Read in chunks to enforce size limit without loading entire file
    chunks = []
    total_size = 0
    while True:
        chunk = await upload_file.read(8192)  # 8KB chunks
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File '{filename}' exceeds maximum size of {MAX_UPLOAD_SIZE // (1024 * 1024)}MB"
            )
        chunks.append(chunk)

    return b"".join(chunks)

# In-memory presence tracking: { "subject:node_id": { "students": { name: timestamp } } }
_presence_store: Dict[str, Dict[str, Any]] = {}


# ============================================
# Request/Response Schemas
# ============================================


class StartSessionRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    student_name: str = Field(..., min_length=1)
    student_id: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1)
    confidence: int = Field(default=50, ge=0, le=100)


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1)


class FeedPreferences(BaseModel):
    """User preferences for feed tuning."""
    difficulty: Optional[float] = Field(None, ge=0.0, le=1.0)
    content_mix: Optional[Dict[str, float]] = None
    question_style: Optional[str] = Field(
        None, pattern="^(conceptual|application|analysis|transfer)$"
    )


class ScrollStartRequest(BaseModel):
    """Start a TikTok-style scroll session from notes/topic."""
    topic: str = Field(..., min_length=1)
    student_name: str = Field(..., min_length=1)
    student_id: Optional[str] = None
    notes: Optional[str] = None  # Paste notes/syllabus for question generation
    preferences: Optional[FeedPreferences] = None  # Feed tuning controls


class ScrollAnswerRequest(BaseModel):
    """Submit answer in scroll mode."""
    answer: str = Field(..., min_length=1)
    time_ms: int = Field(default=0, ge=0)  # Time spent on card
    content_item_id: Optional[str] = None  # Pool item ID for interaction tracking
    correct_answer: Optional[str] = None  # Expected answer for grading
    confidence: Optional[int] = Field(default=None, ge=0, le=100)  # Self-rated confidence
    prompt: Optional[str] = None  # Question prompt for history
    options: Optional[list[str]] = None  # Answer options for history
    explanation: Optional[str] = None  # Explanation for history
    concept: Optional[str] = None  # Concept for history


class ScrollSkipRequest(BaseModel):
    """Skip a card in scroll mode."""
    content_item_id: str
    reason: str = Field(default="skipped")  # "skipped", "not_interested", "too_easy", "too_hard"


class ScrollHelpRequest(BaseModel):
    """Send a message to the Socratic help chat."""
    message: str = Field(..., min_length=1)
    card_context: dict = Field(default_factory=dict)  # {prompt, concept, options}


class FlashcardFlipRequest(BaseModel):
    """Submit flashcard interaction."""
    content_item_id: str
    time_to_flip_ms: int = Field(default=0, ge=0)
    self_rated_knowledge: int = Field(default=3, ge=1, le=5)  # 1=no idea, 5=knew it


class ScrollResumeRequest(BaseModel):
    """Resume an existing scroll session."""
    topic: str = Field(..., min_length=1)
    student_name: str = Field(..., min_length=1)


class CurateResourcesRequest(BaseModel):
    """Trigger resource curation for a topic."""
    topic: str = Field(..., min_length=1)
    concepts: list[str] = Field(default_factory=list)
    resource_types: list[str] = Field(default=["video", "article", "tutorial"])


class AssessmentStartRequest(BaseModel):
    """Start a familiarity assessment."""
    subject: str = Field(..., min_length=1)
    student_name: str = Field(..., min_length=1)


class AssessmentSelfRatingsRequest(BaseModel):
    """Submit self-ratings for assessment."""
    subject: str = Field(..., min_length=1)
    student_name: str = Field(..., min_length=1)
    ratings: list[dict] = Field(...)  # [{concept: str, rating: int}]


class AssessmentDiagnosticRequest(BaseModel):
    """Submit diagnostic quiz answers."""
    student_name: str = Field(..., min_length=1)
    assessment_id: str = Field(..., min_length=1)
    answers: list[dict] = Field(...)  # [{concept, answer, correct_answer, time_ms}]


class CodebaseAnalyzeRequest(BaseModel):
    """Analyze a GitHub repository."""
    github_url: str = Field(..., min_length=1)
    student_id: Optional[str] = None


class PregenContentRequest(BaseModel):
    """Pre-generate content for a topic."""
    topic: str = Field(..., min_length=1)
    concepts: list[str] = Field(default_factory=list)
    subject: Optional[str] = None  # Parent subject name for resource lookup


# ============================================
# Endpoints
# ============================================


@router.post("/session/start")
async def start_session(
    request: StartSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Start a new learning session. Runs Retrieve → Plan, returns first question."""
    if current_user and current_user.name != request.student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    orchestrator = LearningOrchestrator(db)
    result = await orchestrator.start_session(
        student_name=request.student_name,
        topic=request.topic,
        student_id=request.student_id,
    )
    return result


@router.post("/session/{session_id}/answer")
async def submit_answer(
    session_id: str,
    request: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Submit an answer. Runs Assess → Refine → next action."""
    orchestrator = LearningOrchestrator(db)
    result = await orchestrator.process_answer(
        session_id=session_id,
        answer=request.answer,
        confidence=request.confidence,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/session/{session_id}/message")
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Send a discussion message during Socratic dialogue."""
    orchestrator = LearningOrchestrator(db)
    result = await orchestrator.process_message(
        session_id=session_id,
        message=request.message,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/session/{session_id}/end")
async def end_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """End session. Final refine pass, mastery updates, spaced rep scheduling."""
    orchestrator = LearningOrchestrator(db)
    result = await orchestrator.end_session(session_id=session_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/review-queue")
async def get_review_queue(
    student_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get spaced repetition items due for review."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    now = datetime.now(timezone.utc)
    query = select(SpacedRepetitionItem).where(
        and_(
            SpacedRepetitionItem.student_name == student_name,
            SpacedRepetitionItem.next_review_at <= now,
        )
    ).order_by(SpacedRepetitionItem.next_review_at)

    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "student_name": student_name,
        "due_count": len(items),
        "items": [
            {
                "id": str(item.id),
                "concept": item.concept,
                "due_at": item.next_review_at.isoformat(),
                "interval_days": item.interval_days,
                "ease_factor": item.ease_factor,
                "question_template": item.question_template,
            }
            for item in items
        ],
    }


@router.get("/progress")
async def get_progress(
    student_name: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get mastery data across all concepts for a student."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")

    # Count total mastery items for pagination metadata
    count_query = select(func.count()).select_from(ConceptMastery).where(
        ConceptMastery.student_name == student_name
    )
    total_count_result = await db.execute(count_query)
    total_mastery = total_count_result.scalar() or 0

    # Paginated mastery query
    query = select(ConceptMastery).where(
        ConceptMastery.student_name == student_name
    ).order_by(ConceptMastery.mastery_score.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    mastery_items = result.scalars().all()

    # Summary counts use full data set (no pagination) for accuracy
    # We need to query all items for summary stats if paginated
    if offset > 0 or len(mastery_items) < total_mastery:
        summary_query = select(
            func.count().label("total"),
            func.sum(case(
                (ConceptMastery.mastery_score >= 80, 1), else_=0
            )).label("mastered"),
            func.sum(case(
                (and_(ConceptMastery.mastery_score >= 30, ConceptMastery.mastery_score < 80), 1), else_=0
            )).label("in_progress"),
            func.sum(case(
                (ConceptMastery.mastery_score < 30, 1), else_=0
            )).label("needs_work"),
        ).where(ConceptMastery.student_name == student_name)
        summary_result = await db.execute(summary_query)
        summary_row = summary_result.one()
        summary = {
            "total_concepts": summary_row.total or 0,
            "mastered": summary_row.mastered or 0,
            "in_progress": summary_row.in_progress or 0,
            "needs_work": summary_row.needs_work or 0,
        }
    else:
        summary = {
            "total_concepts": len(mastery_items),
            "mastered": sum(1 for m in mastery_items if m.mastery_score >= 80),
            "in_progress": sum(
                1 for m in mastery_items if 30 <= m.mastery_score < 80
            ),
            "needs_work": sum(1 for m in mastery_items if m.mastery_score < 30),
        }

    # Recent sessions (always limited to 10, not paginated)
    session_query = select(LearningSession).where(
        LearningSession.student_name == student_name
    ).order_by(LearningSession.created_at.desc()).limit(10)

    session_result = await db.execute(session_query)
    sessions = session_result.scalars().all()

    return {
        "student_name": student_name,
        "mastery": [
            {
                "concept": m.concept,
                "score": round(m.mastery_score, 1),
                "attempts": m.total_attempts,
                "correct": m.correct_attempts,
                "last_seen": ensure_utc_iso(m.last_seen_at),
            }
            for m in mastery_items
        ],
        "recent_sessions": [
            {
                "id": str(s.id),
                "topic": s.topic,
                "phase": s.phase,
                "questions_answered": s.questions_answered,
                "questions_correct": s.questions_correct,
                "accuracy": round(
                    s.questions_correct / max(1, s.questions_answered) * 100
                ),
                "started_at": ensure_utc_iso(s.started_at),
                "ended_at": ensure_utc_iso(s.ended_at),
            }
            for s in sessions
        ],
        "summary": summary,
        "pagination": {
            "offset": offset,
            "limit": limit,
            "total": total_mastery,
        },
    }


# ============================================
# Question History
# ============================================


@router.get("/question-history")
async def get_question_history(
    student_name: str,
    topic: Optional[str] = Query(None),
    concept: Optional[str] = Query(None),
    is_correct: Optional[bool] = Query(None),
    mode: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get paginated question history for a student."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")

    from ..db_models_question_history import QuestionHistory

    conditions = [QuestionHistory.student_name == student_name]
    if topic:
        conditions.append(QuestionHistory.topic == topic)
    if concept:
        conditions.append(QuestionHistory.concept == concept)
    if is_correct is not None:
        conditions.append(QuestionHistory.is_correct == is_correct)
    if mode:
        conditions.append(QuestionHistory.mode == mode)

    count_query = select(func.count()).select_from(QuestionHistory).where(and_(*conditions))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(QuestionHistory)
        .where(and_(*conditions))
        .order_by(QuestionHistory.answered_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": str(item.id),
                "session_id": str(item.session_id),
                "prompt": item.prompt,
                "options": item.options,
                "correct_answer": item.correct_answer,
                "student_answer": item.student_answer,
                "is_correct": item.is_correct,
                "confidence": item.confidence,
                "explanation": item.explanation,
                "concept": item.concept,
                "difficulty": item.difficulty,
                "topic": item.topic,
                "mode": item.mode,
                "answered_at": ensure_utc_iso(item.answered_at),
            }
            for item in items
        ],
        "pagination": {
            "offset": offset,
            "limit": limit,
            "total": total,
        },
    }


@router.get("/question-history/sessions")
async def get_question_history_sessions(
    student_name: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get session summaries with question counts from history."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")

    from ..db_models_question_history import QuestionHistory

    # Aggregate question history by session
    agg_query = (
        select(
            QuestionHistory.session_id,
            func.count().label("questions_answered"),
            func.sum(case((QuestionHistory.is_correct == True, 1), else_=0)).label("questions_correct"),
            func.min(QuestionHistory.answered_at).label("started_at"),
            func.max(QuestionHistory.answered_at).label("ended_at"),
        )
        .where(QuestionHistory.student_name == student_name)
        .group_by(QuestionHistory.session_id)
        .order_by(func.max(QuestionHistory.answered_at).desc())
    )

    # Get total count of sessions
    count_query = select(func.count()).select_from(
        agg_query.subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    agg_query = agg_query.offset(offset).limit(limit)
    result = await db.execute(agg_query)
    rows = result.all()

    # Fetch session metadata (topic, mode) for each session
    session_ids = [row.session_id for row in rows]
    sessions_meta = {}
    if session_ids:
        meta_query = select(
            LearningSession.id,
            LearningSession.topic,
            LearningSession.plan_json,
            LearningSession.started_at,
            LearningSession.ended_at,
        ).where(LearningSession.id.in_(session_ids))
        meta_result = await db.execute(meta_query)
        for m in meta_result.all():
            plan = m.plan_json or {}
            sessions_meta[m.id] = {
                "topic": m.topic,
                "mode": plan.get("mode", "learn"),
                "session_started_at": m.started_at,
                "session_ended_at": m.ended_at,
            }

    items = []
    for row in rows:
        meta = sessions_meta.get(row.session_id, {})
        answered = row.questions_answered or 0
        correct = row.questions_correct or 0
        accuracy = round(correct / max(1, answered) * 100)
        items.append({
            "session_id": str(row.session_id),
            "topic": meta.get("topic", "Unknown"),
            "mode": meta.get("mode", "learn"),
            "questions_answered": answered,
            "questions_correct": correct,
            "accuracy": accuracy,
            "started_at": ensure_utc_iso(meta.get("session_started_at") or row.started_at),
            "ended_at": ensure_utc_iso(meta.get("session_ended_at") or row.ended_at),
        })

    return {
        "sessions": items,
        "pagination": {
            "offset": offset,
            "limit": limit,
            "total": total,
        },
    }


@router.get("/question-history/session/{session_id}")
async def get_session_question_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get all questions for a specific session."""
    from ..db_models_question_history import QuestionHistory
    import uuid as _uuid

    query = (
        select(QuestionHistory)
        .where(QuestionHistory.session_id == _uuid.UUID(session_id))
        .order_by(QuestionHistory.answered_at.asc())
    )
    result = await db.execute(query)
    items = result.scalars().all()

    if not items:
        return {"session_id": session_id, "items": []}

    # Auth check: ensure current user owns this data
    if current_user and items[0].student_name != current_user.name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")

    return {
        "session_id": session_id,
        "items": [
            {
                "id": str(item.id),
                "prompt": item.prompt,
                "options": item.options,
                "correct_answer": item.correct_answer,
                "student_answer": item.student_answer,
                "is_correct": item.is_correct,
                "confidence": item.confidence,
                "explanation": item.explanation,
                "concept": item.concept,
                "difficulty": item.difficulty,
                "topic": item.topic,
                "mode": item.mode,
                "answered_at": ensure_utc_iso(item.answered_at),
            }
            for item in items
        ],
    }


# ============================================
# Learning History (Personalized Home)
# ============================================


@router.get("/history")
async def get_learning_history(
    student_name: str,
    student_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get aggregated learning history per subject for personalized home screen."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")

    # --- Optimized: run session aggregation, syllabus, mastery count, and
    # active-session queries together instead of 4 separate full-table scans ---

    # 1. SQL-level aggregation of sessions by topic (replaces Python loop over all sessions)
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

    # We still need per-session state_json for XP (stored as JSON, not aggregatable in SQL).
    # But only fetch the columns we need, not the full ORM objects with large messages_json.
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

    # Aggregate XP per topic from state_json
    topic_xp: dict[str, int] = {}
    for row in xp_rows:
        state = row.state_json or {}
        xp = state.get("total_xp", 0)
        if xp:
            topic_xp[row.topic] = topic_xp.get(row.topic, 0) + xp

    # Merge "Subject: Subtopic" XP entries into parent subject
    xp_base_topics = sorted(topic_xp.keys(), key=len)
    xp_to_merge = []
    for xp_key in list(topic_xp.keys()):
        for base in xp_base_topics:
            if xp_key != base and xp_key.startswith(base + ": "):
                xp_to_merge.append((xp_key, base))
                break
    for child, parent in xp_to_merge:
        topic_xp[parent] = topic_xp.get(parent, 0) + topic_xp.pop(child)

    # 2. All cached syllabi (to know which subjects have skill trees)
    if student_id:
        syllabus_query = select(SyllabusCache).where(
            or_(SyllabusCache.student_id == student_id, SyllabusCache.student_id.is_(None))
        )
    else:
        syllabus_query = select(SyllabusCache)
    syllabus_result = await db.execute(syllabus_query)
    syllabi = syllabus_result.scalars().all()
    syllabus_subjects = {s.subject.lower(): s for s in syllabi}

    # Build subject_stats from SQL aggregation results
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

    # Also add subjects that have cached syllabi but no answered questions yet
    # (e.g., user generated a skill tree but hasn't studied yet)
    for subj_lower, cache_entry in syllabus_subjects.items():
        # Skip very long subject names (raw pasted text, not a real subject name)
        clean_name = cache_entry.tree_json.get("subject", cache_entry.subject) if isinstance(cache_entry.tree_json, dict) else cache_entry.subject
        if len(clean_name) > 80:
            continue
        if clean_name not in subject_stats and clean_name.lower() not in {s.lower() for s in subject_stats}:
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

    # Merge "Subject: Subtopic" entries into parent subject (covers both sessions and syllabus-only)
    base_topics = sorted(subject_stats.keys(), key=len)
    to_merge = []
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
        if child_stats["last_studied_at"] and (not p["last_studied_at"] or child_stats["last_studied_at"] > p["last_studied_at"]):
            p["last_studied_at"] = child_stats["last_studied_at"]
        p["has_syllabus"] = p["has_syllabus"] or child_stats.get("has_syllabus", False)

    # Compute accuracy and format
    subjects = []
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

    # Sort by most recently studied
    subjects.sort(
        key=lambda x: x["last_studied_at"] or "",
        reverse=True,
    )

    # 3. Optimized: Use SQL COUNT aggregate instead of loading all ConceptMastery rows.
    # Only concepts_mastered (score >= 80) is used from this data.
    mastery_count_query = select(
        func.count()
    ).select_from(ConceptMastery).where(
        and_(
            ConceptMastery.student_name == student_name,
            ConceptMastery.mastery_score >= 80,
        )
    )
    mastery_count_result = await db.execute(mastery_count_query)
    concepts_mastered_count = mastery_count_result.scalar() or 0

    # 4. Find active session for resume banner (not ended, has progress, scroll mode)
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

    # Generate subject suggestions based on what user has studied
    # Use keyword matching to detect domain and suggest related topics
    CS_KEYWORDS = {"c++", "pointer", "struct", "class", "template", "gpu", "llm",
                   "programming", "algorithm", "data structure", "array", "code",
                   "compiler", "memory", "function", "variable", "iterator",
                   "inheritance", "polymorphism", "oop", "software", "cs106",
                   "cs", "python", "javascript", "java", "rust", "go"}
    MATH_KEYWORDS = {"calculus", "algebra", "linear", "matrix", "equation",
                     "derivative", "integral", "statistics", "probability"}
    SCIENCE_KEYWORDS = {"physics", "chemistry", "biology", "cell", "atom",
                        "molecule", "force", "energy", "evolution"}

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

    studied_lower = {s["subject"].lower() for s in subjects}
    studied_words = set()
    for s in subjects:
        studied_words.update(s["subject"].lower().split())

    # Detect user's domain from their studied subjects
    cs_score = len(studied_words & CS_KEYWORDS)
    math_score = len(studied_words & MATH_KEYWORDS)
    science_score = len(studied_words & SCIENCE_KEYWORDS)

    # Pick suggestion pool weighted by domain
    suggestion_pool: list[str] = []
    if cs_score >= math_score and cs_score >= science_score and cs_score > 0:
        suggestion_pool = CS_SUGGESTIONS + MATH_SUGGESTIONS[:3]
    elif math_score >= science_score and math_score > 0:
        suggestion_pool = MATH_SUGGESTIONS + CS_SUGGESTIONS[:3]
    elif science_score > 0:
        suggestion_pool = SCIENCE_SUGGESTIONS + MATH_SUGGESTIONS[:3]
    else:
        suggestion_pool = GENERAL_SUGGESTIONS

    suggestions: list[str] = []
    for s in suggestion_pool:
        if s.lower() not in studied_lower and s not in suggestions:
            suggestions.append(s)
    suggestions = suggestions[:8]

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


# ============================================
# TikTok Scroll Mode Endpoints
# ============================================


@router.post("/scroll/start")
async def scroll_start(
    request: ScrollStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Start a TikTok-style scroll feed. Returns session + first batch of cards."""
    if current_user and current_user.name != request.student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    print(f"[DEBUG] scroll_start called: topic={request.topic}, student={request.student_name}", flush=True)
    engine = ScrollFeedEngine(db)
    prefs_dict = None
    if request.preferences:
        prefs_dict = request.preferences.model_dump(exclude_none=True)
    result = await engine.start_feed(
        student_name=request.student_name,
        topic=request.topic,
        student_id=request.student_id,
        notes=request.notes,
        preferences=prefs_dict,
    )
    return result


@router.post("/scroll/resume")
async def scroll_resume(
    request: ScrollResumeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Resume the most recent active scroll session for a topic."""
    if current_user and current_user.name != request.student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    print(f"[DEBUG] scroll_resume called: topic={request.topic}, student={request.student_name}", flush=True)
    # Find most recent non-ended session with progress for this topic+student
    query = (
        select(LearningSession)
        .where(
            and_(
                LearningSession.student_name == request.student_name,
                LearningSession.topic == request.topic,
                LearningSession.ended_at.is_(None),
                LearningSession.questions_answered > 0,
            )
        )
        .order_by(LearningSession.created_at.desc())
        .limit(1)
    )
    result = await db.execute(query)
    session = result.scalars().first()

    if not session:
        raise HTTPException(status_code=404, detail="No resumable session found")

    # Verify it's a scroll-mode session
    plan = session.plan_json or {}
    if plan.get("mode") != "scroll":
        raise HTTPException(status_code=404, detail="No resumable session found")

    # Load state and fetch fresh cards from pool
    from ..services.scroll_feed_engine import FeedState
    state = FeedState.from_dict(session.state_json)
    engine = ScrollFeedEngine(db)

    # Backfill resource context for sessions created before PDF-context fix
    if not state.notes_context:
        resource_ctx = await engine._get_resource_context(session.topic)
        if resource_ctx:
            state.notes_context = resource_ctx

    cards = await engine._generate_card_batch_from_pool(
        state, session.topic, count=3, student_name=session.student_name
    )

    state.cards_shown += len(cards)
    session.state_json = state.to_dict()
    await db.commit()

    return {
        "session_id": str(session.id),
        "topic": session.topic,
        "concepts": state.concepts,
        "cards": [engine._card_to_dict(c) for c in cards],
        "stats": engine._get_stats(state),
        "resumed": True,
    }


@router.post("/scroll/{session_id}/answer")
async def scroll_answer(
    session_id: str,
    request: ScrollAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Submit answer for current scroll card. Returns result + next cards."""
    engine = ScrollFeedEngine(db)
    result = await engine.process_answer(
        session_id=session_id,
        answer=request.answer,
        time_ms=request.time_ms,
        correct_answer=request.correct_answer,
        confidence=request.confidence,
        prompt=request.prompt,
        options=request.options,
        explanation=request.explanation,
        concept_hint=request.concept,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    # Record content pool interaction if content_item_id provided
    if request.content_item_id:
        pool = ContentPoolService(db)
        await pool.record_interaction(
            student_name=result.get("session_id", ""),  # session tracks student
            content_item_id=request.content_item_id,
            interaction_type="answered",
            answer=request.answer,
            is_correct=result.get("is_correct"),
            time_spent_ms=request.time_ms,
            session_id=session_id,
        )

    return result


@router.get("/scroll/{session_id}/next")
async def scroll_next(
    session_id: str,
    count: int = 3,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get next batch of cards for the scroll feed."""
    engine = ScrollFeedEngine(db)
    result = await engine.get_next_cards(session_id=session_id, count=count)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/scroll/{session_id}/analytics")
async def scroll_analytics(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get live analytics for the scroll session."""
    engine = ScrollFeedEngine(db)
    result = await engine.get_session_analytics(session_id=session_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/scroll/calibration/{student_name}")
async def get_calibration(
    student_name: str,
    subject: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get calibration metrics and DK-overconfident concepts for a student."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    from ..services.calibration_service import CalibrationService
    service = CalibrationService(db)
    return await service.get_student_calibration(student_name, subject)


@router.post("/scroll/{session_id}/help")
async def scroll_help(
    session_id: str,
    request: ScrollHelpRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Socratic help chat for 'I don't know'. Guides without revealing the answer."""
    engine = ScrollFeedEngine(db)
    result = await engine.help_chat(
        session_id=session_id,
        message=request.message,
        card_context=request.card_context,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ============================================
# Content Pool Endpoints
# ============================================


@router.post("/scroll/{session_id}/skip")
async def scroll_skip(
    session_id: str,
    request: ScrollSkipRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Skip a card. Records signal, returns next cards."""
    pool = ContentPoolService(db)

    # Get session to find student name
    session = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session_obj = session.scalars().first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    await pool.record_interaction(
        student_name=session_obj.student_name,
        content_item_id=request.content_item_id,
        interaction_type=request.reason,
        session_id=session_id,
    )

    # Get next cards
    engine = ScrollFeedEngine(db)
    result = await engine.get_next_cards(session_id=session_id, count=2)
    return result


@router.post("/scroll/{session_id}/flashcard-flip")
async def scroll_flashcard_flip(
    session_id: str,
    request: FlashcardFlipRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Record flashcard flip interaction. Awards XP based on self-rating."""
    session = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session_obj = session.scalars().first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    pool = ContentPoolService(db)
    await pool.record_interaction(
        student_name=session_obj.student_name,
        content_item_id=request.content_item_id,
        interaction_type="viewed",
        time_spent_ms=request.time_to_flip_ms,
        session_id=session_id,
    )

    # XP: lower self-rating = more XP (learning more from what you didn't know)
    xp_map = {1: 15, 2: 12, 3: 8, 4: 5, 5: 3}
    xp_earned = xp_map.get(request.self_rated_knowledge, 5)

    # Update session XP
    from ..services.scroll_feed_engine import FeedState
    state = FeedState.from_dict(session_obj.state_json)
    state.total_xp += xp_earned
    state.cards_shown += 1
    session_obj.state_json = state.to_dict()
    await db.commit()

    return {
        "xp_earned": xp_earned,
        "stats": {
            "streak": state.streak,
            "best_streak": state.best_streak,
            "total_xp": state.total_xp,
            "difficulty": round(state.current_difficulty, 2),
            "cards_shown": state.cards_shown,
        },
    }


@router.post("/content/clear-stale-mcqs")
async def clear_stale_mcqs(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_teacher_clerk),
):
    """One-time admin endpoint to clear stale MCQ pool items with bad correct_answer mapping."""
    from ..db_models_content_pool import ContentItem
    result = await db.execute(
        delete(ContentItem).where(ContentItem.content_type == "mcq")
    )
    await db.commit()
    return {"cleared": result.rowcount}


@router.post("/content/clear-pool")
async def clear_pool(
    topic: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_teacher_clerk),
):
    """Admin endpoint to clear all content pool items, optionally filtered by topic."""
    from ..db_models_content_pool import ContentItem
    if topic:
        result = await db.execute(
            delete(ContentItem).where(ContentItem.topic == topic)
        )
    else:
        result = await db.execute(delete(ContentItem))
    await db.commit()
    return {"cleared": result.rowcount}


@router.get("/content/pool-status")
async def pool_status(
    topic: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """Get content pool status for a topic."""
    pool = ContentPoolService(db)
    return await pool.get_pool_status(topic)


@router.post("/content/pregen")
async def pregen_content(
    request: PregenContentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Pre-generate content for a topic. Returns immediately, generates in background."""
    pool = ContentPoolService(db)
    status = await pool.get_pool_status(request.topic)

    if status.get("total_items", 0) >= 15:
        return {"status": "already_ready", "total_items": status["total_items"]}

    # Schedule background generation with its own DB session
    async def _generate():
        import asyncio
        from ..database import async_session
        async with async_session() as bg_db:
            from ..services.content_generation_orchestrator import ContentGenerationOrchestrator
            orchestrator = ContentGenerationOrchestrator(bg_db)
            concepts = request.concepts or [request.topic]
            try:
                await orchestrator.ensure_pool_ready(request.topic, concepts, subject=request.subject)
            except Exception as e:
                capture_exception(e, context={"service": "learn_routes", "operation": "background_pregen", "topic": request.topic})
                log_error(logger, "background_pregen failed", topic=request.topic, error=str(e))
            # Yield control between pregen calls to avoid starving other requests
            await asyncio.sleep(0)

    background_tasks.add_task(_generate)
    return {"status": "generating"}


# ============================================
# Syllabus / Skill Tree
# ============================================


class SyllabusGenerateRequest(BaseModel):
    subject: str = Field(..., min_length=1)
    student_id: Optional[str] = None


@router.post("/syllabus/generate")
async def syllabus_generate(
    request: SyllabusGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate (or return cached) skill tree for a subject."""
    service = SyllabusService(db)
    tree = await service.get_or_generate(
        subject=request.subject,
        student_id=request.student_id,
    )
    return tree


@router.get("/syllabus/{subject}")
async def syllabus_get(
    subject: str,
    student_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Return cached syllabus tree or 404."""
    service = SyllabusService(db)
    cached = await service._get_cached(subject, student_id)
    if not cached:
        raise HTTPException(status_code=404, detail="No cached syllabus found")
    return cached


# ============================================
# Resource Upload & Management
# ============================================


@router.post("/resources/upload")
async def upload_resources(
    subject: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    student_id: Optional[str] = Form(default=None),
    text_content: Optional[str] = Form(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Upload files/text for a subject. Extracts metadata via DocumentProcessor."""
    from ..document_processor import DocumentProcessor

    processor = DocumentProcessor()
    created_resources = []
    total_concepts = 0

    # Process uploaded files
    for upload_file in files:
        tmp_path = None
        try:
            suffix = os.path.splitext(upload_file.filename or "file.txt")[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await validate_upload_file(upload_file)
                tmp.write(content)
                tmp_path = tmp.name

            doc = await processor.process_file(tmp_path)

            key_content = f"{doc.summary}\nKey concepts: {', '.join(doc.concepts)}"
            key_content = key_content[:1000]

            resource = SubjectResource(
                subject=subject,
                student_id=student_id,
                file_name=upload_file.filename or "untitled",
                file_type=doc.file_type,
                summary=doc.summary,
                concepts_json=doc.concepts,
                objectives_json=doc.objectives or [],
                key_content=key_content,
            )
            db.add(resource)
            total_concepts += len(doc.concepts)
            created_resources.append({
                "id": str(resource.id),
                "file_name": resource.file_name,
                "concepts_count": len(doc.concepts),
                "summary_preview": doc.summary[:120] if doc.summary else "",
            })
        except Exception as e:
            created_resources.append({
                "id": None,
                "file_name": upload_file.filename or "unknown",
                "concepts_count": 0,
                "summary_preview": f"Error: {str(e)[:80]}",
            })
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    # Process plain text content
    if text_content and text_content.strip():
        try:
            doc = await processor.process_text(text_content)
            key_content = f"{doc.summary}\nKey concepts: {', '.join(doc.concepts)}"
            key_content = key_content[:1000]

            resource = SubjectResource(
                subject=subject,
                student_id=student_id,
                file_name="pasted_notes.txt",
                file_type="text",
                summary=doc.summary,
                concepts_json=doc.concepts,
                objectives_json=doc.objectives or [],
                key_content=key_content,
            )
            db.add(resource)
            total_concepts += len(doc.concepts)
            created_resources.append({
                "id": str(resource.id),
                "file_name": "pasted_notes.txt",
                "concepts_count": len(doc.concepts),
                "summary_preview": doc.summary[:120] if doc.summary else "",
            })
        except Exception as e:
            created_resources.append({
                "id": None,
                "file_name": "pasted_notes.txt",
                "concepts_count": 0,
                "summary_preview": f"Error: {str(e)[:80]}",
            })

    await db.commit()

    return {
        "resources": created_resources,
        "total_concepts": total_concepts,
    }


@router.get("/resources/{subject}")
async def list_resources(
    subject: str,
    student_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """List uploaded resources for a subject."""
    query = select(SubjectResource).where(
        func.lower(SubjectResource.subject) == subject.lower()
    )
    if student_id:
        query = query.where(
            (SubjectResource.student_id == student_id) | (SubjectResource.student_id.is_(None))
        )
    query = query.order_by(SubjectResource.created_at.desc())

    result = await db.execute(query)
    resources = result.scalars().all()

    return {
        "resources": [
            {
                "id": str(r.id),
                "file_name": r.file_name,
                "file_type": r.file_type,
                "concepts_count": len(r.concepts_json) if isinstance(r.concepts_json, list) else 0,
                "summary_preview": (r.summary or "")[:120],
                "created_at": ensure_utc_iso(r.created_at),
            }
            for r in resources
        ]
    }


@router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a resource by ID."""
    await db.execute(
        delete(SubjectResource).where(SubjectResource.id == resource_id)
    )
    await db.commit()
    return {"ok": True}


class SyllabusRegenerateRequest(BaseModel):
    subject: str = Field(..., min_length=1)
    student_id: Optional[str] = None


@router.post("/syllabus/regenerate")
async def syllabus_regenerate(
    request: SyllabusRegenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete cached syllabus and regenerate with document context."""
    # Delete existing cache
    del_query = delete(SyllabusCache).where(
        SyllabusCache.subject == request.subject
    )
    if request.student_id:
        del_query = del_query.where(SyllabusCache.student_id == request.student_id)
    await db.execute(del_query)
    await db.commit()

    # Re-generate (will auto-load resource context via Step 3)
    service = SyllabusService(db)
    tree = await service.get_or_generate(
        subject=request.subject,
        student_id=request.student_id,
    )
    return tree


@router.post("/pdf-to-syllabus")
async def pdf_to_syllabus(
    files: List[UploadFile] = File(...),
    student_id: Optional[str] = Form(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Upload PDF/text files, extract topic, store resources, generate skill tree."""
    from ..document_processor import DocumentProcessor

    processor = DocumentProcessor()
    subject = None
    created_resources = []
    total_concepts = 0

    for upload_file in files:
        tmp_path = None
        try:
            suffix = os.path.splitext(upload_file.filename or "file.txt")[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await validate_upload_file(upload_file)
                tmp.write(content)
                tmp_path = tmp.name

            doc = await processor.process_file(tmp_path)

            # First file's topic becomes the subject
            if subject is None:
                extracted_topic = getattr(doc, "topic", None) or ""
                if not extracted_topic:
                    # Fallback: use summary first sentence or filename
                    extracted_topic = (doc.summary or "").split(".")[0].strip()
                if not extracted_topic:
                    extracted_topic = os.path.splitext(upload_file.filename or "Document")[0]
                subject = extracted_topic[:80]

            key_content = f"{doc.summary}\nKey concepts: {', '.join(doc.concepts)}"
            key_content = key_content[:1000]

            resource = SubjectResource(
                subject=subject,
                student_id=student_id,
                file_name=upload_file.filename or "untitled",
                file_type=doc.file_type,
                summary=doc.summary,
                concepts_json=doc.concepts,
                objectives_json=doc.objectives or [],
                key_content=key_content,
            )
            db.add(resource)
            total_concepts += len(doc.concepts)
            created_resources.append({
                "id": str(resource.id),
                "file_name": resource.file_name,
                "concepts_count": len(doc.concepts),
                "summary_preview": doc.summary[:120] if doc.summary else "",
            })
        except Exception as e:
            err_str = str(e)
            # Provide user-friendly message for common Gemini errors
            if "pages" in err_str and "exceeds" in err_str:
                user_msg = "PDF has too many pages. Please upload a shorter document (under 300 pages)."
            elif "too large" in err_str.lower() or "size" in err_str.lower():
                user_msg = "File is too large for processing. Try a smaller file."
            else:
                user_msg = f"Processing failed: {err_str[:80]}"
            created_resources.append({
                "id": None,
                "file_name": upload_file.filename or "unknown",
                "concepts_count": 0,
                "summary_preview": user_msg,
            })
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    if not subject:
        # Build a user-friendly error from the resource errors
        errors = [r["summary_preview"] for r in created_resources if r.get("summary_preview", "").startswith(("PDF has", "File is", "Processing failed"))]
        detail = errors[0] if errors else "Could not extract a topic from the uploaded files"
        raise HTTPException(status_code=400, detail=detail)

    await db.commit()

    # Generate skill tree (auto-loads document context)
    service = SyllabusService(db)
    syllabus = await service.get_or_generate(
        subject=subject,
        student_id=student_id,
    )

    return {
        "subject": subject,
        "syllabus": syllabus,
        "resources": created_resources,
        "total_concepts": total_concepts,
    }


@router.delete("/subject/{subject}")
async def delete_subject(
    subject: str,
    student_name: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Delete all data for a subject: syllabi, resources, and learning sessions."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    # Delete syllabus cache
    syl_result = await db.execute(
        delete(SyllabusCache).where(
            func.lower(SyllabusCache.subject) == subject.lower()
        )
    )
    syllabi_deleted = syl_result.rowcount

    # Delete subject resources
    res_result = await db.execute(
        delete(SubjectResource).where(
            func.lower(SubjectResource.subject) == subject.lower()
        )
    )
    resources_deleted = res_result.rowcount

    # Delete learning sessions for this student + topic
    sess_result = await db.execute(
        delete(LearningSession).where(
            and_(
                LearningSession.topic == subject,
                LearningSession.student_name == student_name,
            )
        )
    )
    sessions_deleted = sess_result.rowcount

    await db.commit()

    return {
        "ok": True,
        "deleted": {
            "sessions": sessions_deleted,
            "syllabi": syllabi_deleted,
            "resources": resources_deleted,
        },
    }


# ============================================
# Presence Tracking
# ============================================


class PresenceHeartbeatRequest(BaseModel):
    subject: str = Field(..., min_length=1)
    node_id: str = Field(..., min_length=1)
    student_name: str = Field(..., min_length=1)


@router.post("/presence/heartbeat")
async def presence_heartbeat(
    request: PresenceHeartbeatRequest,
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Record that a student is active on a node. TTL 60s."""
    if current_user and current_user.name != request.student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    key = f"{request.subject}:{request.node_id}"
    now = datetime.now(timezone.utc).timestamp()

    if key not in _presence_store:
        _presence_store[key] = {"students": {}}

    _presence_store[key]["students"][request.student_name] = now
    return {"ok": True}


@router.get("/presence/{subject}")
async def presence_get(subject: str):
    """Return active learner counts per node for a subject."""
    now = datetime.now(timezone.utc).timestamp()
    ttl = 60  # seconds
    result: Dict[str, Any] = {}

    prefix = f"{subject}:"
    keys_to_clean = []

    for key, data in _presence_store.items():
        if not key.startswith(prefix):
            continue

        node_id = key[len(prefix):]
        # Clean expired entries
        active = {
            name: ts
            for name, ts in data["students"].items()
            if now - ts < ttl
        }
        data["students"] = active

        if not active:
            keys_to_clean.append(key)
            continue

        result[node_id] = {
            "count": len(active),
            "names": list(active.keys()),
        }

    for k in keys_to_clean:
        del _presence_store[k]

    return result


# ============================================
# BKT Mastery & Recommended Path
# ============================================


@router.get("/mastery/{student_name}")
async def get_bkt_mastery(
    student_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Return full BKT state for all concepts (P(L), confidence)."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    engine = ScrollFeedEngine(db)
    mastery = await engine.get_bkt_mastery_map(student_name)
    return {
        "student_name": student_name,
        "concepts": mastery,
    }


@router.get("/skill-tree-analysis/{subject}")
async def get_skill_tree_analysis(
    subject: str,
    student_name: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Get comprehensive skill tree analysis for a student+subject."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    from ..services.skill_tree_analytics_service import SkillTreeAnalyticsService
    service = SkillTreeAnalyticsService(db)
    return await service.get_analysis(subject=subject, student_name=student_name)


@router.get("/recommended-path/{subject}")
async def get_recommended_path(
    subject: str,
    student_name: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Return ordered list of concepts to study (knowledge graph optimal path)."""
    if current_user and current_user.name != student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    # Load syllabus
    service = SyllabusService(db)
    tree = await service._get_cached(subject)
    if not tree:
        raise HTTPException(status_code=404, detail="No syllabus found for this subject")

    # Build knowledge graph
    kg = KnowledgeGraph(tree)

    # Get BKT mastery as float dict
    engine = ScrollFeedEngine(db)
    bkt_states = await engine.bkt.get_all_masteries(student_name)
    mastery_floats = {c: s.p_learned for c, s in bkt_states.items()}

    # Compute path and recommended next
    path = kg.get_optimal_path(mastery_floats)
    recommended_next = kg.get_recommended_next(mastery_floats)
    unlockable = kg.get_unlockable(mastery_floats)

    return {
        "subject": subject,
        "student_name": student_name,
        "next": recommended_next,
        "path": path,
        "unlockable": unlockable,
    }


# ============================================
# Curated Resources
# ============================================


@router.get("/resources/curated/{subject}")
async def get_curated_resources(
    subject: str,
    concept: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """List curated resources for a subject/concept from the content pool."""
    from ..db_models_content_pool import ContentItem

    conditions = [
        ContentItem.topic == subject,
        ContentItem.content_type == "resource_card",
        ContentItem.is_active.is_(True),
    ]
    if concept:
        conditions.append(ContentItem.concept == concept)

    query = (
        select(ContentItem)
        .where(and_(*conditions))
        .order_by(ContentItem.quality_score.desc(), ContentItem.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    resources = []
    for item in items:
        cj = item.content_json or {}
        resource = {
            "id": str(item.id),
            "concept": item.concept,
            "title": cj.get("title", ""),
            "url": cj.get("url", ""),
            "source_type": cj.get("source_type", "web"),
            "thumbnail_url": cj.get("thumbnail_url", ""),
            "description": cj.get("description", ""),
            "duration": cj.get("duration", ""),
            "channel": cj.get("channel", ""),
            "difficulty_label": cj.get("difficulty_label", ""),
            "relevance_score": cj.get("relevance_score", 0),
            "external_domain": cj.get("external_domain", ""),
        }
        if resource_type and cj.get("source_type") != resource_type:
            continue
        resources.append(resource)

    return {"subject": subject, "resources": resources}


@router.post("/resources/curate")
async def curate_resources(
    request: CurateResourcesRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger background resource curation for a topic."""
    async def _curate():
        from ..database import async_session
        async with async_session() as bg_db:
            from ..services.content_generation_orchestrator import ContentGenerationOrchestrator
            orchestrator = ContentGenerationOrchestrator(bg_db)
            concepts = request.concepts or [request.topic]
            for concept_name in concepts:
                try:
                    resources = await orchestrator.resource_curator.curate_resources(
                        concept_name, max_results=2
                    )
                    for res in resources:
                        from ..db_models_content_pool import ContentItem
                        import hashlib
                        # Dedup by URL
                        url_hash = hashlib.md5(res.get("url", "").encode()).hexdigest()
                        existing = await bg_db.execute(
                            select(ContentItem.id).where(
                                and_(
                                    ContentItem.topic == request.topic,
                                    ContentItem.content_type == "resource_card",
                                    ContentItem.concept == concept_name,
                                )
                            ).limit(20)
                        )
                        dupe = False
                        for row in existing.all():
                            item = await bg_db.get(ContentItem, row[0])
                            if item and hashlib.md5(
                                (item.content_json or {}).get("url", "").encode()
                            ).hexdigest() == url_hash:
                                dupe = True
                                break
                        if not dupe:
                            item = ContentItem(
                                content_type="resource_card",
                                topic=request.topic,
                                concept=concept_name,
                                difficulty=0.3,
                                content_json=res,
                                tags=[],
                                source="serper_curated",
                                generator_agent="ResourceCuratorAgent",
                            )
                            bg_db.add(item)
                    await bg_db.commit()
                except Exception as e:
                    capture_exception(e, context={"service": "learn_routes", "operation": "background_resource_curation", "concept": concept_name})
                    log_error(logger, "background_resource_curation failed", concept=concept_name, error=str(e))

    background_tasks.add_task(_curate)
    return {"status": "curating"}


# ============================================
# Familiarity Assessment
# ============================================


@router.post("/assessment/start")
async def assessment_start(
    request: AssessmentStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Start a familiarity assessment. Returns self-rating items from syllabus."""
    if current_user and current_user.name != request.student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    from ..services.assessment_service import AssessmentService
    service = AssessmentService(db)
    return await service.start_assessment(
        student_name=request.student_name,
        subject=request.subject,
    )


@router.post("/assessment/self-ratings")
async def assessment_self_ratings(
    request: AssessmentSelfRatingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Submit self-ratings. Returns diagnostic quiz questions."""
    if current_user and current_user.name != request.student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    from ..services.assessment_service import AssessmentService
    service = AssessmentService(db)
    return await service.submit_self_ratings(
        student_name=request.student_name,
        subject=request.subject,
        ratings=request.ratings,
    )


@router.post("/assessment/diagnostic")
async def assessment_diagnostic(
    request: AssessmentDiagnosticRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_clerk_optional),
):
    """Submit diagnostic answers. Seeds BKT, returns summary."""
    if current_user and current_user.name != request.student_name:
        raise HTTPException(status_code=403, detail="Cannot access another user's data")
    from ..services.assessment_service import AssessmentService
    service = AssessmentService(db)
    result = await service.submit_diagnostic_answers(
        student_name=request.student_name,
        assessment_id=request.assessment_id,
        answers=request.answers,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/assessment/{subject}")
async def get_assessment(
    subject: str,
    student_name: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """Get latest assessment results for a student+subject."""
    from ..services.assessment_service import AssessmentService
    service = AssessmentService(db)
    result = await service.get_assessment(subject, student_name)
    if not result:
        raise HTTPException(status_code=404, detail="No assessment found")
    return result


# ============================================
# Codebase Analysis ("Learn this Project")
# ============================================


@router.post("/codebase/analyze")
async def codebase_analyze(
    request: CodebaseAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Analyze a GitHub repository and build a learning skill tree."""
    from ..services.codebase_learning_service import CodebaseLearningService
    service = CodebaseLearningService(db)
    result = await service.analyze_and_build_tree(
        github_url=request.github_url,
        student_id=request.student_id,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/codebase/{analysis_id}")
async def get_codebase_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get cached codebase analysis."""
    from ..db_models import CodebaseAnalysis
    import uuid as _uuid
    query = select(CodebaseAnalysis).where(
        CodebaseAnalysis.id == _uuid.UUID(analysis_id)
    )
    result = await db.execute(query)
    analysis = result.scalars().first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {
        "id": str(analysis.id),
        "github_url": analysis.github_url,
        "repo_name": analysis.repo_name,
        "analysis": analysis.analysis_json,
        "tech_stack": analysis.tech_stack_json,
        "syllabus_subject": analysis.syllabus_subject,
        "created_at": ensure_utc_iso(analysis.created_at),
    }


@router.get("/codebase/{analysis_id}/resources")
async def get_codebase_resources(
    analysis_id: str,
    technology: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get curated resources for codebase technologies."""
    from ..db_models import CodebaseAnalysis
    from ..db_models_content_pool import ContentItem
    import uuid as _uuid

    query = select(CodebaseAnalysis).where(
        CodebaseAnalysis.id == _uuid.UUID(analysis_id)
    )
    result = await db.execute(query)
    analysis = result.scalars().first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Get resources for the syllabus subject
    subject = analysis.syllabus_subject or analysis.repo_name
    conditions = [
        ContentItem.topic == subject,
        ContentItem.content_type == "resource_card",
        ContentItem.is_active.is_(True),
    ]
    if technology:
        conditions.append(ContentItem.concept == technology)

    res_query = (
        select(ContentItem)
        .where(and_(*conditions))
        .order_by(ContentItem.quality_score.desc())
        .limit(20)
    )
    res_result = await db.execute(res_query)
    items = res_result.scalars().all()

    resources = []
    for item in items:
        cj = item.content_json or {}
        resources.append({
            "concept": item.concept,
            "title": cj.get("title", ""),
            "url": cj.get("url", ""),
            "source_type": cj.get("source_type", "web"),
            "description": cj.get("description", ""),
            "external_domain": cj.get("external_domain", ""),
        })

    return {"analysis_id": analysis_id, "resources": resources}


# ============================================
# Leaderboard
# ============================================


@router.get("/leaderboard")
async def get_leaderboard(
    period: str = Query("weekly", regex="^(weekly|alltime)$"),
    student_name: str = Query("", description="Current user name for highlighting"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get leaderboard rankings aggregated from learning sessions."""
    # --- Optimized: Use SQL GROUP BY for count/sum aggregation instead of
    # loading all full LearningSession ORM objects into Python ---

    # Step 1: SQL aggregation for the columns that SQL can handle
    week_ago = datetime.now(timezone.utc) - timedelta(days=7) if period == "weekly" else None

    agg_query = select(
        LearningSession.student_name,
        func.count().label("sessions_played"),
        func.sum(func.coalesce(LearningSession.questions_correct, 0)).label("total_correct"),
        func.sum(func.coalesce(LearningSession.questions_answered, 0)).label("total_answered"),
    )

    if week_ago is not None:
        agg_query = agg_query.where(LearningSession.started_at >= week_ago)

    agg_query = agg_query.group_by(LearningSession.student_name)
    agg_result = await db.execute(agg_query)
    agg_rows = agg_result.all()

    # Step 2: Fetch only state_json for XP/streak (lightweight column-only query,
    # avoids loading large messages_json, plan_json, concepts_covered, etc.)
    xp_query = select(
        LearningSession.student_name,
        LearningSession.state_json,
    )
    if week_ago is not None:
        xp_query = xp_query.where(LearningSession.started_at >= week_ago)

    xp_result = await db.execute(xp_query)
    xp_rows = xp_result.all()

    # Aggregate XP and best_streak from state_json in Python (can't do in SQL portably)
    xp_data: Dict[str, Dict[str, int]] = {}
    for row in xp_rows:
        name = row.student_name
        if name not in xp_data:
            xp_data[name] = {"total_xp": 0, "best_streak": 0}
        state = row.state_json or {}
        xp_data[name]["total_xp"] += state.get("total_xp", 0)
        session_streak = state.get("best_streak", 0)
        if session_streak > xp_data[name]["best_streak"]:
            xp_data[name]["best_streak"] = session_streak

    # Combine SQL aggregates with JSON-extracted data
    player_data: Dict[str, Dict[str, Any]] = {}
    for row in agg_rows:
        name = row.student_name
        xp_info = xp_data.get(name, {"total_xp": 0, "best_streak": 0})
        player_data[name] = {
            "total_xp": xp_info["total_xp"],
            "sessions_played": row.sessions_played,
            "total_correct": row.total_correct or 0,
            "total_answered": row.total_answered or 0,
            "best_streak": xp_info["best_streak"],
        }

    # For sessions without XP (conversational mode), award 10 XP per correct answer
    for name, pd in player_data.items():
        if pd["total_xp"] == 0 and pd["total_correct"] > 0:
            pd["total_xp"] = pd["total_correct"] * 10

    # Sort by XP descending
    sorted_players = sorted(
        player_data.items(), key=lambda x: x[1]["total_xp"], reverse=True
    )

    total_players = len(sorted_players)

    # Build full ranked entries (need all for current_user_rank), then slice
    all_entries = []
    current_user_rank = None
    for rank_idx, (name, pd) in enumerate(sorted_players, start=1):
        total_xp = pd["total_xp"]
        level = int(math.floor(math.sqrt(total_xp / 100))) if total_xp > 0 else 0
        accuracy = (
            round(pd["total_correct"] / max(1, pd["total_answered"]) * 100)
        )
        is_current = name == student_name

        if is_current:
            current_user_rank = rank_idx

        all_entries.append({
            "rank": rank_idx,
            "student_name": name,
            "total_xp": total_xp,
            "level": level,
            "sessions_played": pd["sessions_played"],
            "total_correct": pd["total_correct"],
            "total_answered": pd["total_answered"],
            "accuracy": accuracy,
            "best_streak": pd["best_streak"],
            "is_current_user": is_current,
        })

    # Apply pagination via slicing after aggregation
    entries = all_entries[offset:offset + limit]

    return {
        "period": period,
        "entries": entries,
        "current_user_rank": current_user_rank,
        "total_players": total_players,
        "pagination": {
            "offset": offset,
            "limit": limit,
            "total": total_players,
        },
    }

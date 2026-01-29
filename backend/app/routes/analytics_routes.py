"""
Analytics Routes
API endpoints for session and user analytics.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Dict, Any, List
from datetime import datetime
import math

from ..database import get_db
from ..db_models import Session, Question, Response, Misconception

router = APIRouter()


# Response Models
class SessionAnalytics(BaseModel):
    """Response model for session analytics."""
    session_id: str
    topic: str
    total_questions: int
    total_responses: int
    unique_students: int
    avg_correctness: float
    avg_confidence: float
    concepts_covered: List[str]
    per_question_metrics: List[Dict[str, Any]]


class UserMastery(BaseModel):
    """Response model for user mastery data."""
    user_id: int
    concept_scores: Dict[str, float]
    overall_score: float
    recent_sessions: List[int]


class QuestionMetrics(BaseModel):
    """Metrics for a single question."""
    question_id: str
    concept: str
    prompt: str
    response_count: int
    correct_count: int
    correctness_rate: float
    avg_confidence: float
    answer_distribution: Dict[str, int]


def calculate_entropy(distribution: Dict[str, int]) -> float:
    """Calculate Shannon entropy from answer distribution."""
    total = sum(distribution.values())
    if total == 0:
        return 0.0
    
    entropy = 0.0
    for count in distribution.values():
        if count > 0:
            p = count / total
            entropy -= p * math.log2(p)
    return round(entropy, 3)


@router.get("/session/{session_id}", response_model=SessionAnalytics)
async def get_session_analytics(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive analytics for a session.
    
    GET /analytics/session/{session_id}
    """
    import uuid
    try:
        s_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    # Get session with questions
    query = select(Session).where(Session.id == s_uuid)
    result = await db.execute(query)
    session = result.scalars().first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all questions for this session
    q_query = select(Question).where(Question.session_id == s_uuid).order_by(Question.order_index)
    q_result = await db.execute(q_query)
    questions = list(q_result.scalars().all())
    
    # Get all responses for this session
    r_query = select(Response).where(Response.session_id == s_uuid)
    r_result = await db.execute(r_query)
    responses = list(r_result.scalars().all())
    
    # Calculate metrics
    concepts_covered = list(set(q.concept for q in questions if q.concept))
    unique_students = len(set(r.student_name for r in responses if r.student_name))
    
    # Overall stats
    total_correct = sum(1 for r in responses if r.is_correct)
    avg_correctness = (total_correct / len(responses) * 100) if responses else 0.0
    avg_confidence = sum(r.confidence for r in responses) / len(responses) if responses else 0.0
    
    # Per-question metrics
    per_question_metrics = []
    for q in questions:
        q_responses = [r for r in responses if r.question_id == q.id]
        q_correct = sum(1 for r in q_responses if r.is_correct)
        
        # Answer distribution
        answer_dist: Dict[str, int] = {}
        for r in q_responses:
            answer = r.answer.upper() if r.answer else "?"
            answer_dist[answer] = answer_dist.get(answer, 0) + 1
        
        per_question_metrics.append({
            "question_id": str(q.id),
            "concept": q.concept or "",
            "prompt": q.prompt[:100] + "..." if len(q.prompt) > 100 else q.prompt,
            "response_count": len(q_responses),
            "correct_count": q_correct,
            "correctness_rate": round((q_correct / len(q_responses) * 100) if q_responses else 0, 1),
            "avg_confidence": round(sum(r.confidence for r in q_responses) / len(q_responses) if q_responses else 0, 1),
            "answer_distribution": answer_dist,
            "entropy": calculate_entropy(answer_dist)
        })
    
    return SessionAnalytics(
        session_id=session_id,
        topic=session.topic,
        total_questions=len(questions),
        total_responses=len(responses),
        unique_students=unique_students,
        avg_correctness=round(avg_correctness, 1),
        avg_confidence=round(avg_confidence, 1),
        concepts_covered=concepts_covered,
        per_question_metrics=per_question_metrics
    )


@router.get("/user/{user_id}/mastery", response_model=UserMastery)
async def get_user_mastery(user_id: int):
    """
    Get per-concept mastery for a user.
    
    GET /analytics/user/{user_id}/mastery
    """
    # Placeholder - would compute from actual response history
    return UserMastery(
        user_id=user_id,
        concept_scores={},
        overall_score=0.0,
        recent_sessions=[]
    )


@router.get("/session/{session_id}/pulse")
async def get_session_pulse(
    session_id: str, 
    question_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get real-time class pulse metrics for live teaching decisions.
    
    GET /analytics/session/{session_id}/pulse
    
    Returns:
    - correctness_rate: % of correct answers
    - entropy: Answer distribution entropy (high = split opinions)
    - avg_confidence: Average student confidence
    - recommended_action: AI suggestion for teacher
    """
    import uuid
    try:
        s_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    # Build query
    r_query = select(Response).where(Response.session_id == s_uuid)
    if question_id:
        try:
            q_uuid = uuid.UUID(question_id)
            r_query = r_query.where(Response.question_id == q_uuid)
        except ValueError:
            pass
    
    r_result = await db.execute(r_query)
    responses = list(r_result.scalars().all())
    
    if not responses:
        return {
            "session_id": session_id,
            "question_id": question_id,
            "correctness_rate": 0.0,
            "entropy": 0.0,
            "avg_confidence": 0.0,
            "response_count": 0,
            "recommended_action": "waiting",
            "action_reason": "No responses yet"
        }
    
    # Calculate metrics
    correct_count = sum(1 for r in responses if r.is_correct)
    correctness_rate = correct_count / len(responses) * 100
    avg_confidence = sum(r.confidence for r in responses) / len(responses)
    
    # Answer distribution and entropy
    answer_dist: Dict[str, int] = {}
    for r in responses:
        answer = r.answer.upper() if r.answer else "?"
        answer_dist[answer] = answer_dist.get(answer, 0) + 1
    
    entropy = calculate_entropy(answer_dist)
    
    # Determine recommended action based on peer instruction pedagogy
    if correctness_rate >= 70:
        recommended_action = "move_on"
        action_reason = "Most students understand - safe to advance"
    elif correctness_rate < 30:
        recommended_action = "reteach"
        action_reason = "Low comprehension - consider re-explaining the concept"
    elif entropy > 1.5:
        recommended_action = "peer_discuss"
        action_reason = "High disagreement - perfect for peer instruction!"
    elif avg_confidence < 40:
        recommended_action = "clarify"
        action_reason = "Low confidence - students are unsure"
    else:
        recommended_action = "peer_discuss"
        action_reason = "Mixed results - peer discussion recommended"
    
    # Add confidence-correctness analysis
    confident_correct = sum(1 for r in responses if r.is_correct and (r.confidence or 50) >= 60)
    confident_incorrect = sum(1 for r in responses if not r.is_correct and (r.confidence or 50) >= 60)
    uncertain_correct = sum(1 for r in responses if r.is_correct and (r.confidence or 50) < 60)
    uncertain_incorrect = sum(1 for r in responses if not r.is_correct and (r.confidence or 50) < 60)
    
    misconception_alert = None
    if confident_incorrect > len(responses) * 0.25:
        misconception_alert = {
            "level": "critical",
            "message": f"⚠️ {confident_incorrect} students are confidently wrong - strong misconception detected!",
            "count": confident_incorrect
        }
    elif confident_incorrect > len(responses) * 0.15:
        misconception_alert = {
            "level": "warning",
            "message": f"🟡 {confident_incorrect} students have confident misconceptions",
            "count": confident_incorrect
        }
    
    return {
        "session_id": session_id,
        "question_id": question_id,
        "correctness_rate": round(correctness_rate, 1),
        "entropy": entropy,
        "avg_confidence": round(avg_confidence, 1),
        "response_count": len(responses),
        "answer_distribution": answer_dist,
        "recommended_action": recommended_action,
        "action_reason": action_reason,
        "confidence_correctness": {
            "confident_correct": confident_correct,
            "confident_incorrect": confident_incorrect,
            "uncertain_correct": uncertain_correct,
            "uncertain_incorrect": uncertain_incorrect
        },
        "misconception_alert": misconception_alert
    }


@router.get("/session/{session_id}/misconceptions")
async def get_misconception_clusters(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get identified misconception clusters for a session.
    
    GET /analytics/session/{session_id}/misconceptions
    
    Analyzes wrong answers to identify common misconception patterns.
    """
    import uuid
    try:
        s_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    # Get questions and wrong responses
    q_query = select(Question).where(Question.session_id == s_uuid)
    q_result = await db.execute(q_query)
    questions = {q.id: q for q in q_result.scalars().all()}
    
    r_query = select(Response).where(
        Response.session_id == s_uuid,
        Response.is_correct is False
    )
    r_result = await db.execute(r_query)
    wrong_responses = list(r_result.scalars().all())
    
    # Cluster wrong answers by question and answer choice
    clusters = []
    for q_id, question in questions.items():
        q_wrong = [r for r in wrong_responses if r.question_id == q_id]
        if not q_wrong:
            continue
        
        # Group by wrong answer
        wrong_by_answer: Dict[str, List] = {}
        for r in q_wrong:
            answer = r.answer.upper() if r.answer else "?"
            if answer not in wrong_by_answer:
                wrong_by_answer[answer] = []
            wrong_by_answer[answer].append({
                "student": r.student_name,
                "reasoning": r.reasoning,
                "confidence": r.confidence
            })
        
        for answer, students in wrong_by_answer.items():
            if len(students) >= 2:  # At least 2 students made same mistake
                clusters.append({
                    "question_id": str(q_id),
                    "concept": question.concept,
                    "question_prompt": question.prompt[:80] + "...",
                    "wrong_answer": answer,
                    "correct_answer": question.correct_answer,
                    "student_count": len(students),
                    "sample_reasonings": [s["reasoning"] for s in students[:3] if s["reasoning"]],
                    "severity": "high" if len(students) >= 5 else "medium" if len(students) >= 3 else "low"
                })
    
    # Sort by severity and student count
    clusters.sort(key=lambda x: (-len(x["sample_reasonings"]), -x["student_count"]))
    
    summary = "No significant misconceptions detected"
    if clusters:
        high_severity = [c for c in clusters if c["severity"] == "high"]
        if high_severity:
            summary = f"{len(high_severity)} major misconception(s) identified - review recommended"
        else:
            summary = f"{len(clusters)} minor misconception pattern(s) found"
    
    return {
        "session_id": session_id,
        "clusters": clusters[:10],  # Top 10
        "total_clusters": len(clusters),
        "summary": summary
    }


@router.get("/course/{course_id}/trends")
async def get_course_trends(
    course_id: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    Get mastery trends over recent sessions for a course/class.

    GET /analytics/course/{course_id}/trends

    Returns comprehensive class-level analytics including:
    - Per-student performance across all sessions
    - Quiz-by-quiz progress
    - Concept mastery trends
    - Students needing support
    """
    import uuid
    from ..models.game import GameSession, Player
    from sqlalchemy.orm import selectinload

    try:
        c_uuid = uuid.UUID(course_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid course ID format")

    # Get all game sessions for this course
    sessions_query = select(GameSession).where(
        GameSession.course_id == c_uuid
    ).options(
        selectinload(GameSession.players).selectinload(Player.answers),
        selectinload(GameSession.quiz)
    ).order_by(GameSession.created_at.desc()).limit(limit)

    result = await db.execute(sessions_query)
    sessions = result.scalars().all()

    if not sessions:
        return {
            "course_id": course_id,
            "sessions": [],
            "student_performance": [],
            "concept_trends": {},
            "overall_trend": "no_data",
            "summary": "No quiz sessions found for this class"
        }

    # Aggregate student performance across all sessions
    student_data: Dict[str, Dict[str, Any]] = {}
    session_summaries = []

    for session in sessions:
        quiz_title = session.quiz.title if session.quiz else "Unknown Quiz"
        session_summary = {
            "session_id": str(session.id),
            "quiz_title": quiz_title,
            "game_code": session.game_code,
            "played_at": session.created_at.isoformat() if session.created_at else None,
            "player_count": len(session.players),
            "class_accuracy": 0.0
        }

        total_correct = 0
        total_answers = 0

        for player in session.players:
            student_key = player.nickname.lower()

            if student_key not in student_data:
                student_data[student_key] = {
                    "nickname": player.nickname,
                    "total_correct": 0,
                    "total_answers": 0,
                    "total_confidence": 0,
                    "sessions_participated": 0,
                    "quiz_scores": [],
                    "overconfident_errors": 0,
                    "needs_support": False
                }

            student_data[student_key]["sessions_participated"] += 1

            player_correct = 0
            player_total = 0
            player_confidence_sum = 0

            for answer in player.answers:
                student_data[student_key]["total_answers"] += 1
                player_total += 1
                total_answers += 1

                if answer.is_correct:
                    student_data[student_key]["total_correct"] += 1
                    player_correct += 1
                    total_correct += 1
                elif answer.confidence and answer.confidence >= 70:
                    student_data[student_key]["overconfident_errors"] += 1

                if answer.confidence:
                    player_confidence_sum += answer.confidence
                    student_data[student_key]["total_confidence"] += answer.confidence

            if player_total > 0:
                quiz_score = round(player_correct / player_total * 100, 1)
                student_data[student_key]["quiz_scores"].append({
                    "quiz_title": quiz_title,
                    "score": quiz_score,
                    "played_at": session.created_at.isoformat() if session.created_at else None
                })

        if total_answers > 0:
            session_summary["class_accuracy"] = round(total_correct / total_answers * 100, 1)

        session_summaries.append(session_summary)

    # Calculate final student metrics
    student_performance = []
    students_needing_support = []

    for key, data in student_data.items():
        accuracy = round(data["total_correct"] / data["total_answers"] * 100, 1) if data["total_answers"] > 0 else 0
        avg_confidence = round(data["total_confidence"] / data["total_answers"], 1) if data["total_answers"] > 0 else 0

        # Flag students needing support
        needs_support = (
            accuracy < 60 or
            data["overconfident_errors"] >= 3 or
            (data["sessions_participated"] >= 2 and accuracy < 50)
        )

        student_perf = {
            "nickname": data["nickname"],
            "accuracy": accuracy,
            "avg_confidence": avg_confidence,
            "sessions_participated": data["sessions_participated"],
            "total_questions": data["total_answers"],
            "overconfident_errors": data["overconfident_errors"],
            "needs_support": needs_support,
            "trend": _calculate_trend(data["quiz_scores"]) if len(data["quiz_scores"]) >= 2 else "insufficient_data"
        }

        student_performance.append(student_perf)

        if needs_support:
            students_needing_support.append(data["nickname"])

    # Sort by accuracy (lowest first for easy identification of struggling students)
    student_performance.sort(key=lambda x: x["accuracy"])

    # Calculate overall class trend
    if len(session_summaries) >= 2:
        recent_avg = sum(s["class_accuracy"] for s in session_summaries[:3]) / min(3, len(session_summaries))
        older_avg = sum(s["class_accuracy"] for s in session_summaries[-3:]) / min(3, len(session_summaries))
        overall_trend = "improving" if recent_avg > older_avg + 5 else "declining" if recent_avg < older_avg - 5 else "stable"
    else:
        overall_trend = "insufficient_data"

    return {
        "course_id": course_id,
        "sessions": session_summaries,
        "student_performance": student_performance,
        "students_needing_support": students_needing_support,
        "overall_trend": overall_trend,
        "summary": f"{len(student_performance)} students across {len(sessions)} quiz sessions",
        "class_stats": {
            "total_students": len(student_performance),
            "avg_accuracy": round(sum(s["accuracy"] for s in student_performance) / len(student_performance), 1) if student_performance else 0,
            "students_struggling": len(students_needing_support)
        }
    }


def _calculate_trend(quiz_scores: List[Dict]) -> str:
    """Calculate performance trend from quiz scores."""
    if len(quiz_scores) < 2:
        return "insufficient_data"

    # Sort by date and compare recent to older
    sorted_scores = sorted(quiz_scores, key=lambda x: x.get("played_at") or "")
    recent = sorted_scores[-2:]
    older = sorted_scores[:-2] if len(sorted_scores) > 2 else sorted_scores[:1]

    recent_avg = sum(s["score"] for s in recent) / len(recent)
    older_avg = sum(s["score"] for s in older) / len(older)

    if recent_avg > older_avg + 10:
        return "improving"
    elif recent_avg < older_avg - 10:
        return "declining"
    return "stable"


@router.post("/session/{session_id}/export")
async def export_session_report(session_id: str, format: str = "json"):
    """
    Export session report in JSON or PDF format.
    
    POST /analytics/session/{session_id}/export
    """
    if format not in ["json", "pdf"]:
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'pdf'")
    
    return {
        "session_id": session_id,
        "format": format,
        "status": "generated",
        "download_url": f"/exports/session_{session_id}.{format}"
    }


class MisconceptionResponse(BaseModel):
    """Response model for misconception data."""
    id: int
    topic: str
    misconception: str
    description: Optional[str]
    affected_count: int
    total_count: int
    percentage: float
    severity: str
    common_wrong_answer: Optional[str]
    suggested_intervention: Optional[str]
    session_id: Optional[str]
    detected_at: datetime


@router.get("/misconceptions")
async def get_misconceptions(
    creator_id: Optional[int] = None,
    limit: int = 10,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Get misconceptions for a teacher.
    
    GET /analytics/misconceptions?creator_id=1&limit=10&severity=high
    
    Returns list of detected misconceptions from sessions.
    """
    query = select(Misconception).where(Misconception.is_active is True)
    
    if creator_id:
        query = query.where(Misconception.creator_id == creator_id)
    
    if severity:
        query = query.where(Misconception.severity == severity)
    
    query = query.order_by(Misconception.affected_count.desc()).limit(limit)
    
    result = await db.execute(query)
    misconceptions = result.scalars().all()
    
    return [
        {
            "id": m.id,
            "topic": m.topic,
            "misconception": m.misconception,
            "description": m.description,
            "affected_count": m.affected_count,
            "total_count": m.total_count,
            "percentage": round((m.affected_count / m.total_count * 100) if m.total_count > 0 else 0, 1),
            "severity": m.severity,
            "common_wrong_answer": m.common_wrong_answer,
            "suggested_intervention": m.suggested_intervention,
            "session_id": m.session_id,
            "detected_at": m.detected_at.isoformat() if m.detected_at else None
        }
        for m in misconceptions
    ]


@router.get("/misconceptions/{misconception_id}")
async def get_misconception_detail(
    misconception_id: int,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get detailed information about a specific misconception.
    
    GET /analytics/misconceptions/{misconception_id}
    """
    result = await db.execute(
        select(Misconception).where(Misconception.id == misconception_id)
    )
    misconception = result.scalar_one_or_none()
    
    if not misconception:
        raise HTTPException(status_code=404, detail="Misconception not found")
    
    return {
        "id": misconception.id,
        "topic": misconception.topic,
        "misconception": misconception.misconception,
        "description": misconception.description,
        "affected_count": misconception.affected_count,
        "total_count": misconception.total_count,
        "percentage": round((misconception.affected_count / misconception.total_count * 100) if misconception.total_count > 0 else 0, 1),
        "severity": misconception.severity,
        "common_wrong_answer": misconception.common_wrong_answer,
        "suggested_intervention": misconception.suggested_intervention,
        "session_id": misconception.session_id,
        "question_id": misconception.question_id,
        "detected_at": misconception.detected_at.isoformat() if misconception.detected_at else None
    }

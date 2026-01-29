"""
Adaptive Learning Routes
API endpoints for smart peer matching, intervention detection, and spaced repetition.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel

from ..database import get_db
from ..services.adaptive_learning_service import AdaptiveLearningService
from ..services.session_service import SessionService

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class DynamicThresholdRequest(BaseModel):
    topic_difficulty: float = 0.5
    time_elapsed_ratio: float = 0.0
    historical_discussion_success: float = 0.5
    class_size: int = 20


class ConfidenceAnalysisResponse(BaseModel):
    student_name: str
    answer: str
    confidence: int
    is_correct: bool = False
    reasoning: str = ""


class PeerMatchingRequest(BaseModel):
    responses: List[ConfidenceAnalysisResponse]
    question: dict


class InterventionRequest(BaseModel):
    responses: List[ConfidenceAnalysisResponse]
    discussion_duration_seconds: int = 0
    previous_discussion_outcomes: List[str] = []


class DiscussionQualityRequest(BaseModel):
    messages: List[dict]
    concept_vocabulary: List[str] = []


class SpacedRepetitionUpdateRequest(BaseModel):
    student_name: str
    concept: str
    quality: int  # 0-5 rating
    question_template: dict = {}


class MasteryUpdateRequest(BaseModel):
    student_name: str
    concept: str
    is_correct: bool
    confidence: int = 50


class MisconceptionTrackRequest(BaseModel):
    student_name: str
    concept: str
    misconception: str


# ============================================================================
# DYNAMIC THRESHOLD ENDPOINTS
# ============================================================================

@router.post("/thresholds/dynamic")
async def get_dynamic_thresholds(
    request: DynamicThresholdRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate dynamic discussion thresholds based on context.
    
    Adjusts the classic Mazur 30-70% thresholds based on:
    - Topic difficulty
    - Time elapsed in session
    - Historical discussion success
    - Class size
    """
    service = AdaptiveLearningService(db)
    return service.calculate_dynamic_thresholds(
        topic_difficulty=request.topic_difficulty,
        time_elapsed_ratio=request.time_elapsed_ratio,
        historical_discussion_success=request.historical_discussion_success,
        class_size=request.class_size
    )


@router.get("/session/{session_id}/thresholds")
async def get_session_thresholds(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get recommended thresholds for a specific session based on its data.
    """
    import uuid
    try:
        s_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session_service = SessionService(db)
    session = await session_service.get_session_by_id(s_uuid)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Calculate context-aware thresholds
    total_questions = len(session.questions) or 1
    current_index = session.current_question_index
    time_ratio = current_index / total_questions
    
    # Get participant count
    class_size = len(session.participants) if session.participants else 20
    
    # TODO: Calculate historical discussion success from previous sessions
    historical_success = 0.5
    
    service = AdaptiveLearningService(db)
    thresholds = service.calculate_dynamic_thresholds(
        topic_difficulty=0.5,  # Could be from question metadata
        time_elapsed_ratio=time_ratio,
        historical_discussion_success=historical_success,
        class_size=class_size
    )
    
    return {
        "session_id": session_id,
        "current_question_index": current_index,
        "total_questions": total_questions,
        **thresholds
    }


# ============================================================================
# CONFIDENCE-CORRECTNESS ANALYSIS
# ============================================================================

@router.post("/analyze/confidence-correctness")
async def analyze_confidence_correctness(
    responses: List[ConfidenceAnalysisResponse],
    db: AsyncSession = Depends(get_db)
):
    """
    Analyze the relationship between confidence and correctness.
    
    Identifies dangerous misconceptions (high confidence + wrong answer)
    and provides actionable recommendations.
    """
    service = AdaptiveLearningService(db)
    response_dicts = [r.model_dump() for r in responses]
    return service.analyze_confidence_correctness(response_dicts)


@router.get("/session/{session_id}/question/{question_index}/confidence-analysis")
async def get_question_confidence_analysis(
    session_id: str,
    question_index: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get confidence-correctness analysis for a specific question in a session.
    """
    import uuid
    try:
        s_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session_service = SessionService(db)
    session = await session_service.get_session_by_id(s_uuid)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if question_index >= len(session.questions):
        raise HTTPException(status_code=404, detail="Question not found")
    
    question = session.questions[question_index]
    
    # Build response list
    responses = []
    for r in question.responses:
        is_correct = r.answer.upper() == question.correct_answer.upper() if r.answer else False
        responses.append({
            "student_name": r.student_name,
            "answer": r.answer,
            "confidence": r.confidence or 50,
            "is_correct": is_correct,
            "reasoning": r.reasoning or ""
        })
    
    service = AdaptiveLearningService(db)
    analysis = service.analyze_confidence_correctness(responses)
    
    return {
        "session_id": session_id,
        "question_index": question_index,
        "question_prompt": question.prompt,
        "correct_answer": question.correct_answer,
        "total_responses": len(responses),
        **analysis
    }


# ============================================================================
# SMART PEER MATCHING
# ============================================================================

@router.post("/peer-matching")
async def get_peer_matching(
    request: PeerMatchingRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Get smart peer pairing suggestions for discussion.
    
    Matches students based on their answers and confidence levels
    to maximize productive peer discussion.
    """
    service = AdaptiveLearningService(db)
    response_dicts = [r.model_dump() for r in request.responses]
    return service.suggest_peer_pairs(response_dicts, request.question)


@router.get("/session/{session_id}/question/{question_index}/peer-pairs")
async def get_session_peer_pairs(
    session_id: str,
    question_index: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get suggested peer pairs for a specific question in a session.
    """
    import uuid
    try:
        s_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session_service = SessionService(db)
    session = await session_service.get_session_by_id(s_uuid)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if question_index >= len(session.questions):
        raise HTTPException(status_code=404, detail="Question not found")
    
    question = session.questions[question_index]
    
    # Build response list
    responses = []
    for r in question.responses:
        is_correct = r.answer.upper() == question.correct_answer.upper() if r.answer else False
        responses.append({
            "student_name": r.student_name,
            "answer": r.answer,
            "confidence": r.confidence or 50,
            "is_correct": is_correct,
            "reasoning": r.reasoning or ""
        })
    
    question_dict = {
        "correct_answer": question.correct_answer,
        "prompt": question.prompt
    }
    
    service = AdaptiveLearningService(db)
    pairs = service.suggest_peer_pairs(responses, question_dict)
    
    return {
        "session_id": session_id,
        "question_index": question_index,
        "total_students": len(responses),
        **pairs
    }


# ============================================================================
# INTERVENTION DETECTION
# ============================================================================

@router.post("/intervention/check")
async def check_intervention_needed(
    request: InterventionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Check if instructor intervention is needed.
    
    Analyzes the current state of discussion to detect when
    the instructor should step in.
    """
    service = AdaptiveLearningService(db)
    response_dicts = [r.model_dump() for r in request.responses]
    return service.detect_intervention_needed(
        response_dicts,
        request.discussion_duration_seconds,
        request.previous_discussion_outcomes
    )


# ============================================================================
# DISCUSSION QUALITY ANALYSIS
# ============================================================================

@router.post("/discussion/quality")
async def analyze_discussion_quality(
    request: DiscussionQualityRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Analyze the quality of a peer discussion.
    
    Evaluates reasoning depth, vocabulary usage, and learning signals
    to provide insights on discussion effectiveness.
    """
    service = AdaptiveLearningService(db)
    return service.analyze_discussion_quality(
        request.messages,
        request.concept_vocabulary
    )


# ============================================================================
# SPACED REPETITION
# ============================================================================

@router.post("/spaced-repetition/review")
async def update_spaced_repetition(
    request: SpacedRepetitionUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Update spaced repetition schedule after a review.
    
    Uses the SM-2 algorithm to calculate the next optimal review time.
    Quality rating: 0=blackout, 5=perfect
    """
    service = AdaptiveLearningService(db)
    item = await service.schedule_review(
        student_name=request.student_name,
        concept=request.concept,
        question_template=request.question_template,
        quality=request.quality
    )
    
    return {
        "student_name": item.student_name,
        "concept": item.concept,
        "next_review_at": item.next_review_at,
        "interval_days": item.interval_days,
        "ease_factor": item.ease_factor,
        "repetition_count": item.repetition_count
    }


@router.get("/spaced-repetition/{student_name}/due")
async def get_due_reviews(
    student_name: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all items due for review for a student.
    """
    service = AdaptiveLearningService(db)
    items = await service.get_due_reviews(student_name)
    
    return {
        "student_name": student_name,
        "due_count": len(items),
        "items": [
            {
                "concept": item.concept,
                "next_review_at": item.next_review_at,
                "interval_days": item.interval_days,
                "ease_factor": item.ease_factor,
                "question_template": item.question_template
            }
            for item in items
        ]
    }


# ============================================================================
# MASTERY TRACKING
# ============================================================================

@router.post("/mastery/update")
async def update_mastery(
    request: MasteryUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Update student's concept mastery after a response.
    """
    service = AdaptiveLearningService(db)
    mastery = await service.update_mastery(
        student_name=request.student_name,
        concept=request.concept,
        is_correct=request.is_correct,
        confidence=request.confidence
    )
    
    return {
        "student_name": mastery.student_name,
        "concept": mastery.concept,
        "mastery_score": mastery.mastery_score,
        "total_attempts": mastery.total_attempts,
        "correct_attempts": mastery.correct_attempts,
        "last_seen_at": mastery.last_seen_at
    }


@router.post("/misconception/track")
async def track_misconception(
    request: MisconceptionTrackRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Track a student's misconception for future remediation.
    """
    service = AdaptiveLearningService(db)
    item = await service.track_misconception(
        student_name=request.student_name,
        concept=request.concept,
        misconception=request.misconception
    )
    
    return {
        "student_name": item.student_name,
        "concept": item.concept,
        "misconception": item.misconception,
        "occurrence_count": item.occurrence_count,
        "is_resolved": item.is_resolved
    }


@router.post("/misconception/resolve")
async def resolve_misconception(
    request: MisconceptionTrackRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Mark a misconception as resolved.
    """
    service = AdaptiveLearningService(db)
    item = await service.resolve_misconception(
        student_name=request.student_name,
        concept=request.concept,
        misconception=request.misconception
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Misconception not found or already resolved")
    
    return {
        "student_name": item.student_name,
        "concept": item.concept,
        "misconception": item.misconception,
        "is_resolved": item.is_resolved,
        "resolved_at": item.resolved_at
    }

"""
Student Learning Routes
Endpoints for exit tickets, misconception tracking, adaptive learning, and AI peer discussions.
Integrates AI agents from experimentation folder.
"""

import uuid
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..db_models import User
from ..db_models_learning import ExitTicket, DetailedMisconception, AdaptiveLearningState, DebateSession, PeerDiscussionSession
from ..models.game import Player, GameSession
from ..auth_clerk import get_current_user_clerk

# Add experimentation folder to path for AI agents
EXPERIMENTATION_PATH = Path(__file__).parent.parent.parent.parent / "experimentation" / "ai_agents"
if str(EXPERIMENTATION_PATH) not in sys.path:
    sys.path.insert(0, str(EXPERIMENTATION_PATH))

# Import AI agents
try:
    from exit_ticket_agent import ExitTicketAgent
    from misconception_tagger import MisconceptionTagger, MisconceptionResult  # noqa: F401
    from adaptive_engine import AdaptiveDifficultyEngine
    from debate_judge import DebateJudge
    EXIT_TICKET_AGENT = ExitTicketAgent()
    MISCONCEPTION_TAGGER = MisconceptionTagger()
    ADAPTIVE_ENGINE = AdaptiveDifficultyEngine()
    DEBATE_JUDGE = DebateJudge()
    AI_AGENTS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: AI agents not available: {e}")
    AI_AGENTS_AVAILABLE = False


router = APIRouter()


# ==============================================================================
# Schemas
# ==============================================================================

class ExitTicketRequest(BaseModel):
    student_name: str
    game_id: Optional[str] = None
    session_id: Optional[str] = None
    responses: List[Dict[str, Any]]  # List of student responses from the session
    concepts: List[str]  # Concepts covered in the session


class ExitTicketResponse(BaseModel):
    id: str
    student_name: str
    target_concept: str
    micro_lesson: str
    encouragement: Optional[str]
    question_prompt: str
    question_options: List[str]
    correct_answer: str
    hint: Optional[str]
    is_completed: bool
    created_at: str
    # Enhanced fields
    study_notes: Optional[Dict[str, Any]] = {}
    practice_questions: Optional[List[Dict[str, Any]]] = []
    flashcards: Optional[List[Dict[str, Any]]] = []
    misconceptions: Optional[List[Dict[str, Any]]] = []


class ExitTicketAnswerRequest(BaseModel):
    ticket_id: str
    student_answer: str


class MisconceptionTagRequest(BaseModel):
    student_name: str
    game_id: Optional[str] = None
    session_id: Optional[str] = None
    question: Dict[str, Any]
    student_answer: str
    student_reasoning: Optional[str] = None
    correct_answer: str
    correct_explanation: Optional[str] = None


class MisconceptionResponse(BaseModel):
    id: str
    student_name: str
    misconception_type: str
    category: str
    severity: str
    description: str
    root_cause: Optional[str]
    suggested_remediation: Optional[str]
    is_resolved: bool
    created_at: str


class AdaptiveUpdateRequest(BaseModel):
    student_name: str
    session_id: Optional[str] = None
    question: Dict[str, Any]
    is_correct: bool


class AdaptiveStatsResponse(BaseModel):
    student_name: str
    current_difficulty: float
    questions_answered: int
    overall_accuracy: float
    weak_concepts: List[Dict[str, Any]]
    difficulty_history: List[Dict[str, Any]]


class DebateStartRequest(BaseModel):
    student_name: str
    game_id: Optional[str] = None
    session_id: Optional[str] = None
    question: Dict[str, Any]
    initial_answer: str
    initial_reasoning: Optional[str] = None


class DebateTurnRequest(BaseModel):
    debate_id: str
    argument: str


class DebateEvaluateRequest(BaseModel):
    debate_id: str


class StudyGuideRequest(BaseModel):
    student_name: str


class PeerDiscussionCreateRequest(BaseModel):
    student_name: str
    game_id: Optional[str] = None
    player_id: Optional[str] = None
    question_index: int = 0
    question_text: str
    question_options: Dict[str, str]
    correct_answer: str
    student_answer: str
    student_confidence: int = 50
    student_reasoning: Optional[str] = None
    was_correct: bool = False
    peer_type: str = "ai"  # "ai" or "human"
    peer_name: str = "Alex"
    peer_id: Optional[str] = None


class PeerDiscussionMessageRequest(BaseModel):
    session_id: str
    sender: str  # "student" or "peer"
    content: str


class PeerDiscussionCompleteRequest(BaseModel):
    session_id: str
    revealed_answer: bool = False


class PeerDiscussionResponse(BaseModel):
    id: str
    student_name: str
    question_text: str
    student_answer: str
    was_correct: bool
    peer_type: str
    peer_name: str
    transcript: List[Dict[str, Any]]
    message_count: int
    summary: Optional[str]
    key_insights: List[str]
    misconceptions_identified: List[str]
    status: str
    created_at: str


# ==============================================================================
# Exit Ticket Endpoints
# ==============================================================================

@router.post("/exit-ticket", response_model=ExitTicketResponse)
async def generate_exit_ticket(
    request: ExitTicketRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a personalized exit ticket for a student based on their session performance.
    Uses AI to identify the student's weakest concept and generate a targeted micro-lesson.
    Falls back to a simple exit ticket if AI agents aren't available.
    """
    # Calculate session accuracy
    total_responses = len(request.responses)
    correct_responses = sum(1 for r in request.responses if r.get("is_correct", False))
    session_accuracy = correct_responses / total_responses if total_responses > 0 else 0.0

    # Determine target concept (the one with lowest accuracy)
    concept_stats: Dict[str, Dict[str, int]] = {}
    for r in request.responses:
        concept = r.get("concept", request.concepts[0] if request.concepts else "General")
        if concept not in concept_stats:
            concept_stats[concept] = {"correct": 0, "total": 0}
        concept_stats[concept]["total"] += 1
        if r.get("is_correct", False):
            concept_stats[concept]["correct"] += 1

    # Find weakest concept
    target_concept = request.concepts[0] if request.concepts else "General"
    lowest_accuracy = 1.0
    for concept, stats in concept_stats.items():
        acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        if acc < lowest_accuracy:
            lowest_accuracy = acc
            target_concept = concept

    # Try Gemini for personalized exit ticket generation
    ticket_data = await _generate_exit_ticket_with_gemini(
        student_name=request.student_name,
        target_concept=target_concept,
        session_accuracy=session_accuracy,
        responses=request.responses,
        concepts=request.concepts
    )

    # Store in database
    question_data = ticket_data.get("question", {})
    exit_ticket = ExitTicket(
        student_name=request.student_name,
        game_id=uuid.UUID(request.game_id) if request.game_id else None,
        session_id=uuid.UUID(request.session_id) if request.session_id else None,
        target_concept=ticket_data.get("target_concept", target_concept),
        session_accuracy=session_accuracy,
        micro_lesson=ticket_data.get("micro_lesson", ""),
        encouragement=ticket_data.get("encouragement"),
        question_prompt=question_data.get("prompt", ""),
        question_options=question_data.get("options", []),
        correct_answer=question_data.get("correct_answer", "A"),
        hint=question_data.get("hint"),
        # Enhanced fields
        study_notes=ticket_data.get("study_notes", {}),
        practice_questions=ticket_data.get("practice_questions", []),
        flashcards=ticket_data.get("flashcards", []),
        misconceptions=ticket_data.get("misconceptions", []),
    )

    db.add(exit_ticket)
    await db.commit()
    await db.refresh(exit_ticket)

    return ExitTicketResponse(
        id=str(exit_ticket.id),
        student_name=exit_ticket.student_name,
        target_concept=exit_ticket.target_concept,
        micro_lesson=exit_ticket.micro_lesson,
        encouragement=exit_ticket.encouragement,
        question_prompt=exit_ticket.question_prompt,
        question_options=exit_ticket.question_options,
        correct_answer=exit_ticket.correct_answer,
        hint=exit_ticket.hint,
        is_completed=exit_ticket.is_completed,
        created_at=exit_ticket.created_at.isoformat(),
        study_notes=exit_ticket.study_notes or {},
        practice_questions=exit_ticket.practice_questions or [],
        flashcards=exit_ticket.flashcards or [],
        misconceptions=exit_ticket.misconceptions or [],
    )


@router.get("/exit-tickets", response_model=List[ExitTicketResponse])
async def get_student_exit_tickets(
    student_name: str,
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db)
):
    """Get all exit tickets for a student, ordered by most recent first."""
    result = await db.execute(
        select(ExitTicket)
        .where(ExitTicket.student_name == student_name)
        .order_by(desc(ExitTicket.created_at))
        .limit(limit)
    )
    tickets = result.scalars().all()

    return [
        ExitTicketResponse(
            id=str(t.id),
            student_name=t.student_name,
            target_concept=t.target_concept,
            micro_lesson=t.micro_lesson,
            encouragement=t.encouragement,
            question_prompt=t.question_prompt,
            question_options=t.question_options,
            correct_answer=t.correct_answer,
            hint=t.hint,
            is_completed=t.is_completed,
            created_at=t.created_at.isoformat(),
            study_notes=t.study_notes or {},
            practice_questions=t.practice_questions or [],
            flashcards=t.flashcards or [],
            misconceptions=t.misconceptions or [],
        )
        for t in tickets
    ]


@router.post("/exit-ticket/answer")
async def answer_exit_ticket(
    request: ExitTicketAnswerRequest,
    db: AsyncSession = Depends(get_db)
):
    """Submit an answer to an exit ticket follow-up question."""
    result = await db.execute(
        select(ExitTicket).where(ExitTicket.id == uuid.UUID(request.ticket_id))
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(status_code=404, detail="Exit ticket not found")

    # Check if answer is correct
    is_correct = request.student_answer.upper().strip() == ticket.correct_answer.upper().strip()

    ticket.student_answer = request.student_answer
    ticket.answered_correctly = is_correct
    ticket.is_completed = True
    ticket.completed_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "ticket_id": str(ticket.id),
        "is_correct": is_correct,
        "correct_answer": ticket.correct_answer,
        "hint": ticket.hint if not is_correct else None,
    }


@router.get("/exit-tickets/export")
async def export_study_guide(
    student_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Export all exit tickets as a markdown study guide."""
    result = await db.execute(
        select(ExitTicket)
        .where(ExitTicket.student_name == student_name)
        .order_by(ExitTicket.created_at)
    )
    tickets = result.scalars().all()

    if not tickets:
        return {"markdown": "# Study Guide\n\nNo exit tickets found."}

    # Generate markdown
    lines = [
        f"# Study Guide for {student_name}",
        f"\nGenerated on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "\n---\n",
    ]

    for i, ticket in enumerate(tickets, 1):
        lines.append(f"## Lesson {i}: {ticket.target_concept}")
        lines.append(f"\n**Date:** {ticket.created_at.strftime('%Y-%m-%d')}")
        lines.append(f"\n### Micro-Lesson\n{ticket.micro_lesson}")

        if ticket.encouragement:
            lines.append(f"\n*{ticket.encouragement}*")

        lines.append(f"\n### Practice Question\n{ticket.question_prompt}")
        lines.append("\n**Options:**")
        for opt in ticket.question_options:
            lines.append(f"- {opt}")

        if ticket.is_completed:
            status = "Correct" if ticket.answered_correctly else "Incorrect"
            lines.append(f"\n**Your Answer:** {ticket.student_answer} ({status})")
            lines.append(f"**Correct Answer:** {ticket.correct_answer}")

        lines.append("\n---\n")

    return {"markdown": "\n".join(lines)}


@router.get("/exit-tickets/mine", response_model=List[ExitTicketResponse])
async def get_my_exit_tickets(
    limit: int = Query(default=10, le=50),
    current_user: User = Depends(get_current_user_clerk),
    db: AsyncSession = Depends(get_db)
):
    """
    Get exit tickets for the authenticated user.

    This endpoint queries by student_id (the authenticated user's ID) rather than
    student_name, ensuring that exit tickets linked during sign-up are returned.
    """
    result = await db.execute(
        select(ExitTicket)
        .where(ExitTicket.student_id == current_user.id)
        .order_by(desc(ExitTicket.created_at))
        .limit(limit)
    )
    tickets = result.scalars().all()

    return [
        ExitTicketResponse(
            id=str(t.id),
            student_name=t.student_name,
            target_concept=t.target_concept,
            micro_lesson=t.micro_lesson,
            encouragement=t.encouragement,
            question_prompt=t.question_prompt,
            question_options=t.question_options,
            correct_answer=t.correct_answer,
            hint=t.hint,
            is_completed=t.is_completed,
            created_at=t.created_at.isoformat(),
            study_notes=t.study_notes or {},
            practice_questions=t.practice_questions or [],
            flashcards=t.flashcards or [],
            misconceptions=t.misconceptions or [],
        )
        for t in tickets
    ]


# ==============================================================================
# Misconception Endpoints
# ==============================================================================

@router.post("/misconception/tag", response_model=MisconceptionResponse)
async def tag_misconception(
    request: MisconceptionTagRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Tag a wrong answer with misconception analysis using AI.
    Identifies the type of misconception, its severity, and suggested remediation.
    Falls back to simple classification if AI agents aren't available.
    """
    misconception_type = "unknown"
    category = "conceptual"
    severity = "moderate"
    description = f"Incorrect answer on question about {request.question.get('concept', 'this topic')}"
    root_cause = "Review needed"
    suggested_remediation = "Practice more problems on this topic and review the fundamentals."
    evidence: List[str] = []
    related_concepts: List[str] = []
    confidence = 0.5

    # Try AI agent first
    if AI_AGENTS_AVAILABLE:
        try:
            result = await MISCONCEPTION_TAGGER.tag_response(
                student_id=hash(request.student_name) % 100000,
                question=request.question,
                student_answer=request.student_answer,
                student_reasoning=request.student_reasoning or "",
                correct_answer=request.correct_answer,
                correct_explanation=request.correct_explanation,
            )
            misconception_type = result.misconception_type
            category = result.category.value if hasattr(result.category, 'value') else str(result.category)
            severity = result.severity.value if hasattr(result.severity, 'value') else str(result.severity)
            description = result.description
            root_cause = result.root_cause
            suggested_remediation = result.suggested_remediation
            evidence = result.evidence
            related_concepts = result.related_concepts
            confidence = result.confidence
        except Exception as e:
            print(f"AI misconception tagger error: {e}")
            # Use fallback values set above

    # Store in database
    misconception = DetailedMisconception(
        student_name=request.student_name,
        game_id=uuid.UUID(request.game_id) if request.game_id else None,
        session_id=uuid.UUID(request.session_id) if request.session_id else None,
        question_id=uuid.UUID(request.question.get("id")) if request.question.get("id") else None,
        misconception_type=misconception_type,
        category=category,
        severity=severity,
        description=description,
        root_cause=root_cause,
        evidence=evidence,
        student_answer=request.student_answer,
        correct_answer=request.correct_answer,
        student_reasoning=request.student_reasoning,
        suggested_remediation=suggested_remediation,
        related_concepts=related_concepts,
        confidence=confidence,
    )

    db.add(misconception)
    await db.commit()
    await db.refresh(misconception)

    return MisconceptionResponse(
        id=str(misconception.id),
        student_name=misconception.student_name,
        misconception_type=misconception.misconception_type,
        category=misconception.category,
        severity=misconception.severity,
        description=misconception.description,
        root_cause=misconception.root_cause,
        suggested_remediation=misconception.suggested_remediation,
        is_resolved=misconception.is_resolved,
        created_at=misconception.created_at.isoformat(),
    )


@router.get("/misconceptions", response_model=List[MisconceptionResponse])
async def get_student_misconceptions(
    student_name: str,
    include_resolved: bool = False,
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get all misconceptions for a student, optionally including resolved ones."""
    query = select(DetailedMisconception).where(
        DetailedMisconception.student_name == student_name
    )

    if not include_resolved:
        query = query.where(DetailedMisconception.is_resolved is False)

    query = query.order_by(desc(DetailedMisconception.created_at)).limit(limit)

    result = await db.execute(query)
    misconceptions = result.scalars().all()

    return [
        MisconceptionResponse(
            id=str(m.id),
            student_name=m.student_name,
            misconception_type=m.misconception_type,
            category=m.category,
            severity=m.severity,
            description=m.description,
            root_cause=m.root_cause,
            suggested_remediation=m.suggested_remediation,
            is_resolved=m.is_resolved,
            created_at=m.created_at.isoformat(),
        )
        for m in misconceptions
    ]


@router.post("/misconception/{misconception_id}/resolve")
async def resolve_misconception(
    misconception_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Mark a misconception as resolved."""
    result = await db.execute(
        select(DetailedMisconception).where(
            DetailedMisconception.id == uuid.UUID(misconception_id)
        )
    )
    misconception = result.scalar_one_or_none()

    if not misconception:
        raise HTTPException(status_code=404, detail="Misconception not found")

    misconception.is_resolved = True
    misconception.resolved_at = datetime.now(timezone.utc)

    await db.commit()

    return {"status": "resolved", "misconception_id": misconception_id}


@router.get("/misconceptions/summary")
async def get_misconception_summary(
    student_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a summary of student's misconceptions by category and severity."""
    result = await db.execute(
        select(DetailedMisconception).where(
            DetailedMisconception.student_name == student_name
        )
    )
    misconceptions = result.scalars().all()

    # Aggregate statistics
    category_counts: Dict[str, int] = {}
    severity_counts: Dict[str, int] = {}
    type_counts: Dict[str, int] = {}
    unresolved_count = 0

    for m in misconceptions:
        category_counts[m.category] = category_counts.get(m.category, 0) + 1
        severity_counts[m.severity] = severity_counts.get(m.severity, 0) + 1
        type_counts[m.misconception_type] = type_counts.get(m.misconception_type, 0) + 1
        if not m.is_resolved:
            unresolved_count += 1

    # Get top misconception types
    top_types = sorted(type_counts.items(), key=lambda x: -x[1])[:5]

    return {
        "total_misconceptions": len(misconceptions),
        "unresolved_count": unresolved_count,
        "resolved_count": len(misconceptions) - unresolved_count,
        "category_distribution": category_counts,
        "severity_distribution": severity_counts,
        "top_misconception_types": top_types,
    }


# ==============================================================================
# Adaptive Learning Endpoints
# ==============================================================================

@router.post("/adaptive/update")
async def update_adaptive_state(
    request: AdaptiveUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update adaptive learning state after a question is answered."""
    if not AI_AGENTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI agents not available")

    # Get or create adaptive state for student
    result = await db.execute(
        select(AdaptiveLearningState).where(
            AdaptiveLearningState.student_name == request.student_name,
            AdaptiveLearningState.session_id == (uuid.UUID(request.session_id) if request.session_id else None),
        )
    )
    state = result.scalar_one_or_none()

    if not state:
        state = AdaptiveLearningState(
            student_name=request.student_name,
            session_id=uuid.UUID(request.session_id) if request.session_id else None,
        )
        db.add(state)

    # Update the adaptive engine
    class_accuracy = 1.0 if request.is_correct else 0.0
    adjustment = ADAPTIVE_ENGINE.update_after_question(request.question, class_accuracy)

    # Update state
    state.questions_answered += 1
    if request.is_correct:
        state.correct_answers += 1
    state.overall_accuracy = state.correct_answers / state.questions_answered
    state.current_difficulty = ADAPTIVE_ENGINE.current_difficulty

    # Update concept tracking
    concept = request.question.get("concept", "unknown")
    concept_accuracy = state.concept_accuracy or {}
    if concept not in concept_accuracy:
        concept_accuracy[concept] = []
    concept_accuracy[concept].append(1.0 if request.is_correct else 0.0)
    state.concept_accuracy = concept_accuracy

    # Update weak concepts
    state.weak_concepts = [c for c, _ in ADAPTIVE_ENGINE.get_weak_concepts()]

    # Update history
    history = state.difficulty_history or []
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "difficulty": adjustment.new_difficulty,
        "accuracy": class_accuracy,
        "reason": adjustment.reason,
    })
    state.difficulty_history = history

    await db.commit()

    return {
        "current_difficulty": state.current_difficulty,
        "overall_accuracy": state.overall_accuracy,
        "adjustment_reason": adjustment.reason,
    }


@router.get("/adaptive/stats", response_model=AdaptiveStatsResponse)
async def get_adaptive_stats(
    student_name: str,
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get adaptive learning statistics for a student."""
    query = select(AdaptiveLearningState).where(
        AdaptiveLearningState.student_name == student_name
    )
    if session_id:
        query = query.where(AdaptiveLearningState.session_id == uuid.UUID(session_id))

    result = await db.execute(query.order_by(desc(AdaptiveLearningState.updated_at)))
    state = result.scalar_one_or_none()

    if not state:
        return AdaptiveStatsResponse(
            student_name=student_name,
            current_difficulty=0.5,
            questions_answered=0,
            overall_accuracy=0.0,
            weak_concepts=[],
            difficulty_history=[],
        )

    weak_concepts = []
    if state.concept_accuracy:
        for concept, accuracies in state.concept_accuracy.items():
            avg = sum(accuracies) / len(accuracies) if accuracies else 0
            if avg < 0.6:  # Below 60% is weak
                weak_concepts.append({"concept": concept, "accuracy": avg})

    return AdaptiveStatsResponse(
        student_name=student_name,
        current_difficulty=state.current_difficulty,
        questions_answered=state.questions_answered,
        overall_accuracy=state.overall_accuracy,
        weak_concepts=weak_concepts,
        difficulty_history=state.difficulty_history or [],
    )


# ==============================================================================
# AI Peer Discussion / Debate Endpoints
# ==============================================================================

@router.post("/debate/start")
async def start_debate(
    request: DebateStartRequest,
    db: AsyncSession = Depends(get_db)
):
    """Start an AI peer discussion session after a wrong answer."""
    # Create debate session
    debate = DebateSession(
        student_name=request.student_name,
        game_id=uuid.UUID(request.game_id) if request.game_id else None,
        session_id=uuid.UUID(request.session_id) if request.session_id else None,
        question_id=uuid.UUID(request.question.get("id")) if request.question.get("id") else None,
        initial_answer=request.initial_answer,
        initial_reasoning=request.initial_reasoning,
        transcript=[],
    )

    db.add(debate)
    await db.commit()
    await db.refresh(debate)

    # Generate AI peer's opening argument
    ai_opening = _generate_ai_peer_response(request.question, request.initial_answer, [])

    # Add AI opening to transcript
    debate.transcript = [{
        "speaker": "AI Peer",
        "argument": ai_opening,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }]
    await db.commit()

    return {
        "debate_id": str(debate.id),
        "status": "started",
        "ai_response": ai_opening,
    }


@router.post("/debate/turn")
async def debate_turn(
    request: DebateTurnRequest,
    db: AsyncSession = Depends(get_db)
):
    """Submit a turn in the debate and get AI response."""
    result = await db.execute(
        select(DebateSession).where(DebateSession.id == uuid.UUID(request.debate_id))
    )
    debate = result.scalar_one_or_none()

    if not debate:
        raise HTTPException(status_code=404, detail="Debate session not found")

    if debate.status != "ongoing":
        raise HTTPException(status_code=400, detail="Debate is not ongoing")

    # Add student's argument to transcript
    transcript = debate.transcript or []
    transcript.append({
        "speaker": debate.student_name,
        "argument": request.argument,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # Generate AI response (simplified - would use Gemini in production)
    ai_response = _generate_ai_peer_response({}, debate.initial_answer, transcript)
    transcript.append({
        "speaker": "AI Peer",
        "argument": ai_response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    debate.transcript = transcript
    await db.commit()

    return {
        "debate_id": str(debate.id),
        "ai_response": ai_response,
        "turn_count": len([t for t in transcript if t["speaker"] == debate.student_name]),
    }


@router.post("/debate/evaluate")
async def evaluate_debate(
    request: DebateEvaluateRequest,
    db: AsyncSession = Depends(get_db)
):
    """End and evaluate a debate session."""
    if not AI_AGENTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI agents not available")

    result = await db.execute(
        select(DebateSession).where(DebateSession.id == uuid.UUID(request.debate_id))
    )
    debate = result.scalar_one_or_none()

    if not debate:
        raise HTTPException(status_code=404, detail="Debate session not found")

    # Use AI to evaluate the debate
    # Note: This is simplified - full implementation would retrieve the question and use DebateJudge
    debate.status = "completed"
    debate.completed_at = datetime.now(timezone.utc)

    # Simple judgment based on transcript length
    transcript = debate.transcript or []
    student_turns = [t for t in transcript if t["speaker"] == debate.student_name]

    debate.argument_quality = min(0.5 + len(student_turns) * 0.1, 1.0)
    debate.logical_soundness = 0.6
    debate.learning_recommendation = "Review the concept and try similar problems."

    await db.commit()

    return {
        "debate_id": str(debate.id),
        "status": "completed",
        "argument_quality": debate.argument_quality,
        "logical_soundness": debate.logical_soundness,
        "learning_recommendation": debate.learning_recommendation,
    }


async def _generate_exit_ticket_with_gemini(
    student_name: str,
    target_concept: str,
    session_accuracy: float,
    responses: List[Dict[str, Any]],
    concepts: List[str],
    peer_discussion_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate a comprehensive, rigorous exit ticket using Gemini AI.

    Uses proven prompt engineering techniques:
    1. Chain-of-thought reasoning - analyze patterns before generating content
    2. Few-shot examples - show expected output format
    3. Structured data - provide ALL available context
    4. Role prompting - position AI as expert learning scientist
    5. Output constraints - specific JSON schema with validation
    """
    import os
    import json

    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    # =========================================================================
    # STEP 1: Build comprehensive context from ALL student responses
    # =========================================================================

    response_context = ""
    total_time_ms = 0
    questions_with_reasoning = 0
    questions_with_peer_discussion = 0

    for i, r in enumerate(responses, 1):
        status = "✓ CORRECT" if r.get("is_correct", False) else "✗ INCORRECT"
        conf = r.get("confidence", 50)
        conf_label = "very confident" if conf >= 80 else "somewhat confident" if conf >= 50 else "uncertain"

        # Build detailed question analysis
        response_context += f"\n\n--- QUESTION {i} ---"
        response_context += f"\nSTATUS: {status}"
        response_context += f"\nCONFIDENCE: {conf}% ({conf_label})"
        response_context += f"\nQUESTION: {r.get('question_text', 'N/A')}"

        # Include all options if available
        if r.get('options'):
            response_context += "\nOPTIONS:"
            for opt_key, opt_val in r.get('options', {}).items():
                marker = "→" if opt_key == r.get('student_answer', '')[:1] else " "
                response_context += f"\n  {marker} {opt_key}: {opt_val}"

        response_context += f"\nSTUDENT CHOSE: {r.get('student_answer', 'N/A')}"

        if not r.get("is_correct", False):
            response_context += f"\nCORRECT ANSWER: {r.get('correct_answer', 'N/A')}"

        # Time analysis
        time_ms = r.get('time_taken_ms', 0)
        if time_ms:
            total_time_ms += time_ms
            time_label = "very quick" if time_ms < 5000 else "thoughtful" if time_ms < 20000 else "struggled"
            response_context += f"\nTIME TAKEN: {time_ms/1000:.1f}s ({time_label})"

        # Reasoning - critical for understanding misconceptions
        if r.get('reasoning'):
            questions_with_reasoning += 1
            response_context += f"\nSTUDENT'S REASONING: \"{r.get('reasoning')}\""

        # Peer discussion indicator
        if r.get('had_peer_discussion'):
            questions_with_peer_discussion += 1
            response_context += "\n[Had peer discussion on this question]"

    # =========================================================================
    # STEP 2: Calculate detailed analytics
    # =========================================================================

    wrong_answers = [r for r in responses if not r.get("is_correct", False)]
    high_confidence_wrong = [r for r in wrong_answers if r.get("confidence", 50) >= 70]
    low_confidence_correct = [r for r in responses if r.get("is_correct", False) and r.get("confidence", 50) < 40]

    # Pattern detection
    patterns = []
    if high_confidence_wrong:
        patterns.append(f"HIGH-CONFIDENCE ERRORS: {len(high_confidence_wrong)} questions where student was confident but wrong")
    if low_confidence_correct:
        patterns.append(f"UNDERCONFIDENCE: {len(low_confidence_correct)} questions where student was unsure but correct")
    if questions_with_reasoning < len(wrong_answers) / 2:
        patterns.append("LIMITED REASONING: Student provided little explanation for their answers")

    avg_time = (total_time_ms / len(responses) / 1000) if responses else 0
    if avg_time < 5:
        patterns.append(f"RUSHED: Average {avg_time:.1f}s per question - may be rushing through")
    elif avg_time > 30:
        patterns.append(f"STRUGGLING: Average {avg_time:.1f}s per question - finding material difficult")

    patterns_text = "\n".join(f"- {p}" for p in patterns) if patterns else "No specific patterns detected"

    # =========================================================================
    # STEP 3: Include peer discussion context if available
    # =========================================================================

    discussion_context = ""
    if peer_discussion_data:
        discussion_context = f"""

══════════════════════════════════════════════════════════
PEER DISCUSSION INSIGHTS (Student discussed with AI tutor)
══════════════════════════════════════════════════════════
Summary: {peer_discussion_data.get('summary', 'N/A')}
Key Insights: {', '.join(peer_discussion_data.get('key_insights', [])) or 'None recorded'}
Misconceptions Identified: {', '.join(peer_discussion_data.get('misconceptions_identified', [])) or 'None identified'}
Understanding Improved: {peer_discussion_data.get('understanding_improved', 'Unknown')}
"""

    # =========================================================================
    # STEP 4: Determine exit ticket complexity based on performance
    # =========================================================================

    # Generate substantial homework - more questions for struggling students
    if session_accuracy >= 0.8:
        num_practice = 5  # Challenge with harder questions
        difficulty = "challenging extension"
    elif session_accuracy >= 0.5:
        num_practice = 6  # Reinforce with varied practice
        difficulty = "reinforcement and slight challenge"
    else:
        num_practice = 8  # Intensive practice on fundamentals
        difficulty = "foundational practice building up"

    num_flashcards = 3 if session_accuracy >= 0.7 else 4 if session_accuracy >= 0.4 else 5

    # =========================================================================
    # STEP 5: Build comprehensive prompt using best practices
    # =========================================================================

    prompt = f"""You are an expert learning scientist creating a COMPREHENSIVE personalized study packet for a student. This is NOT a quick check - it's their homework and study guide based on their quiz performance.

══════════════════════════════════════════════════════════
STUDENT PROFILE
══════════════════════════════════════════════════════════
Name: {student_name}
Topic Area: {target_concept}
Session Accuracy: {session_accuracy * 100:.0f}% ({sum(1 for r in responses if r.get('is_correct', False))}/{len(responses)} correct)
Questions with reasoning provided: {questions_with_reasoning}/{len(responses)}
Questions with peer discussion: {questions_with_peer_discussion}/{len(responses)}
Average response time: {avg_time:.1f}s per question

══════════════════════════════════════════════════════════
DETECTED LEARNING PATTERNS
══════════════════════════════════════════════════════════
{patterns_text}

══════════════════════════════════════════════════════════
DETAILED PERFORMANCE LOG (MOST IMPORTANT - Analyze carefully!)
══════════════════════════════════════════════════════════
{response_context}
{discussion_context}

══════════════════════════════════════════════════════════
YOUR TASK: Create a COMPREHENSIVE Study Packet
══════════════════════════════════════════════════════════

This student needs {difficulty} questions. Generate:

1. PERSONALIZED STUDY NOTES (study_notes object)
   Create detailed, structured notes covering:
   - Key concepts they need to master (based on their errors)
   - Common pitfalls to avoid (from their specific mistakes)
   - Step-by-step strategies for this topic
   - Memory tricks or mnemonics where helpful

2. QUICK REVIEW (micro_lesson - 4-6 sentences)
   - Directly address their SPECIFIC errors
   - Reference their actual wrong answers
   - Explain the correct approach

3. HOMEWORK QUESTIONS ({num_practice} practice questions)
   This is their homework - generate EXACTLY {num_practice} varied questions:
   - Questions 1-2: Foundation (easier versions of what they missed)
   - Questions 3-4: Core practice (similar difficulty to quiz)
   - Questions 5+: Extension (slightly harder applications)

   Each question MUST have 4 options and target their specific gaps.

4. FLASHCARDS ({num_flashcards} cards)
   Key terms and concepts for memorization

5. MISCONCEPTION ANALYSIS
   Identify and correct their specific misunderstandings

CRITICAL: Generate EXACTLY {num_practice} practice questions. This is homework, not just a check.

Return ONLY valid JSON:
{{
    "target_concept": "Specific concept to master",
    "study_notes": {{
        "key_concepts": [
            "First key concept they need to understand...",
            "Second key concept...",
            "Third key concept..."
        ],
        "common_mistakes": [
            "Mistake 1: Description and how to avoid it",
            "Mistake 2: Description and how to avoid it"
        ],
        "strategies": [
            "Strategy 1: Step-by-step approach for this topic",
            "Strategy 2: Another helpful technique"
        ],
        "memory_tips": [
            "Tip 1: Mnemonic or memory aid",
            "Tip 2: Another helpful trick"
        ]
    }},
    "micro_lesson": "4-6 sentence personalized explanation addressing THEIR specific errors...",
    "encouragement": "Brief encouraging message...",
    "practice_questions": [
        {{
            "prompt": "Question 1 (Foundation level)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "A",
            "hint": "Guiding hint",
            "explanation": "Why correct and connection to their mistake",
            "difficulty": "foundation"
        }},
        {{
            "prompt": "Question 2 (Foundation level)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "B",
            "hint": "Guiding hint",
            "explanation": "Explanation",
            "difficulty": "foundation"
        }},
        {{
            "prompt": "Question 3 (Core practice)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "C",
            "hint": "Guiding hint",
            "explanation": "Explanation",
            "difficulty": "core"
        }},
        {{
            "prompt": "Question 4 (Core practice)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "D",
            "hint": "Guiding hint",
            "explanation": "Explanation",
            "difficulty": "core"
        }},
        {{
            "prompt": "Question 5+ (Extension)?",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "A",
            "hint": "Guiding hint",
            "explanation": "Explanation",
            "difficulty": "extension"
        }}
    ],
    "flashcards": [
        {{"front": "Term/concept?", "back": "Clear explanation"}}
    ],
    "misconceptions": [
        {{
            "type": "Misconception name",
            "description": "What student incorrectly believes",
            "correction": "Correct understanding"
        }}
    ]
}}"""

    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.7,  # Balanced creativity and accuracy
                "max_output_tokens": 4096,  # More for comprehensive homework packet
            }
        )
        response_text = response.text.strip()
        result = json.loads(response_text)

        # Handle array response (Gemini sometimes returns array)
        if isinstance(result, list):
            result = result[0] if result else {}

        # Extract first question for backwards compatibility
        practice_questions = result.get("practice_questions", [])
        first_question = practice_questions[0] if practice_questions else {
            "prompt": result.get("question", {}).get("prompt", ""),
            "options": result.get("question", {}).get("options", []),
            "correct_answer": result.get("question", {}).get("correct_answer", "A"),
            "hint": result.get("question", {}).get("hint", "")
        }

        # Structure for backwards compatibility + new fields
        return {
            "target_concept": result.get("target_concept", target_concept),
            "study_notes": result.get("study_notes", {}),
            "micro_lesson": result.get("micro_lesson", ""),
            "encouragement": result.get("encouragement", ""),
            "question": first_question,
            "practice_questions": practice_questions,
            "flashcards": result.get("flashcards", []),
            "misconceptions": result.get("misconceptions", [])
        }
    except json.JSONDecodeError as e:
        print(f"JSON parse error in exit ticket: {e}")
        print(f"Raw response: {response_text[:500] if 'response_text' in dir() else 'N/A'}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        print(f"Gemini exit ticket generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate exit ticket: {str(e)}")


def _generate_ai_peer_response(question: Dict, student_answer: str, transcript: List) -> str:
    """Generate AI peer response (simplified version)."""
    turn_count = len([t for t in transcript if t.get("speaker") == "AI Peer"])

    if turn_count == 0:
        return "That's an interesting answer! Let me share my perspective. Can you walk me through your reasoning step by step? I want to understand how you arrived at that answer."
    elif turn_count == 1:
        return "I see your point. Have you considered what would happen if we think about it from a different angle? What assumptions are you making in your reasoning?"
    elif turn_count == 2:
        return "Those are good points. Let me challenge you a bit - can you think of a counterexample or a case where your approach might not work?"
    else:
        return "This has been a great discussion! I think we've explored this problem well. Would you like to reconsider your original answer based on what we discussed?"


# ==============================================================================
# Dashboard Aggregate Endpoints
# ==============================================================================

# ==============================================================================
# Peer Discussion Session Endpoints
# ==============================================================================

@router.post("/peer-discussion/start", response_model=PeerDiscussionResponse)
async def start_peer_discussion(
    request: PeerDiscussionCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Start a new peer discussion session - stores the initial context."""
    session = PeerDiscussionSession(
        student_name=request.student_name,
        game_id=uuid.UUID(request.game_id) if request.game_id else None,
        player_id=uuid.UUID(request.player_id) if request.player_id else None,
        question_index=request.question_index,
        question_text=request.question_text,
        question_options=request.question_options,
        correct_answer=request.correct_answer,
        student_answer=request.student_answer,
        student_confidence=request.student_confidence,
        student_reasoning=request.student_reasoning,
        was_correct=request.was_correct,
        peer_type=request.peer_type,
        peer_name=request.peer_name,
        peer_id=uuid.UUID(request.peer_id) if request.peer_id else None,
        transcript=[],
        message_count=0,
        status="ongoing"
    )

    db.add(session)
    await db.commit()
    await db.refresh(session)

    return PeerDiscussionResponse(
        id=str(session.id),
        student_name=session.student_name,
        question_text=session.question_text,
        student_answer=session.student_answer,
        was_correct=session.was_correct,
        peer_type=session.peer_type,
        peer_name=session.peer_name,
        transcript=session.transcript,
        message_count=session.message_count,
        summary=session.summary,
        key_insights=session.key_insights or [],
        misconceptions_identified=session.misconceptions_identified or [],
        status=session.status,
        created_at=session.started_at.isoformat(),
    )


@router.post("/peer-discussion/message")
async def add_peer_discussion_message(
    request: PeerDiscussionMessageRequest,
    db: AsyncSession = Depends(get_db)
):
    """Add a message to an ongoing peer discussion session."""
    result = await db.execute(
        select(PeerDiscussionSession).where(
            PeerDiscussionSession.id == uuid.UUID(request.session_id)
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Peer discussion session not found")

    if session.status != "ongoing":
        raise HTTPException(status_code=400, detail="Discussion is not ongoing")

    # Add message to transcript
    transcript = session.transcript or []
    transcript.append({
        "sender": request.sender,
        "content": request.content,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    session.transcript = transcript
    session.message_count = len(transcript)

    await db.commit()

    return {
        "session_id": str(session.id),
        "message_count": session.message_count,
        "status": "added"
    }


@router.post("/peer-discussion/complete")
async def complete_peer_discussion(
    request: PeerDiscussionCompleteRequest,
    db: AsyncSession = Depends(get_db)
):
    """Complete a peer discussion session and generate AI summary."""
    result = await db.execute(
        select(PeerDiscussionSession).where(
            PeerDiscussionSession.id == uuid.UUID(request.session_id)
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Peer discussion session not found")

    # Generate AI summary using Gemini
    summary_data = await _generate_discussion_summary(session)

    # Update session
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    session.revealed_answer = request.revealed_answer
    session.summary = summary_data.get("summary", "Discussion completed.")
    session.key_insights = summary_data.get("key_insights", [])
    session.misconceptions_identified = summary_data.get("misconceptions", [])
    session.learning_moments = summary_data.get("learning_moments", [])
    session.understanding_improved = summary_data.get("understanding_improved", None)
    session.discussion_quality = summary_data.get("quality", "fair")

    # Calculate duration
    if session.started_at:
        duration = (session.completed_at - session.started_at).total_seconds()
        session.duration_seconds = int(duration)

    await db.commit()

    return {
        "session_id": str(session.id),
        "status": "completed",
        "summary": session.summary,
        "key_insights": session.key_insights,
        "misconceptions_identified": session.misconceptions_identified,
        "learning_moments": session.learning_moments,
        "understanding_improved": session.understanding_improved,
        "discussion_quality": session.discussion_quality,
        "duration_seconds": session.duration_seconds
    }


async def _generate_discussion_summary(session: PeerDiscussionSession) -> Dict[str, Any]:
    """Generate an AI summary of the peer discussion using Gemini."""
    import os

    try:
        import google.generativeai as genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return _fallback_summary(session)

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Build transcript text
        transcript_text = "\n".join([
            f"{msg.get('sender', 'Unknown')}: {msg.get('content', '')}"
            for msg in (session.transcript or [])
        ])

        prompt = f"""Analyze this peer discussion about a quiz question and provide a detailed summary.

Question: {session.question_text}
Options: {session.question_options}
Correct Answer: {session.correct_answer}
Student's Answer: {session.student_answer} ({"Correct" if session.was_correct else "Incorrect"})
Student's Confidence: {session.student_confidence}%

Discussion Transcript:
{transcript_text}

Provide a JSON response with:
1. "summary": A 2-3 sentence summary of what was discussed and learned
2. "key_insights": Array of 2-3 specific learning insights from the discussion
3. "misconceptions": Array of any misconceptions revealed (empty if none)
4. "learning_moments": Array of moments where understanding improved
5. "understanding_improved": true/false - did the student's understanding improve?
6. "quality": "excellent", "good", "fair", or "poor" - quality of the discussion

Return ONLY valid JSON, no markdown."""

        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Parse JSON response
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        import json
        return json.loads(response_text)

    except Exception as e:
        print(f"Gemini summary generation error: {e}")
        return _fallback_summary(session)


def _fallback_summary(session: PeerDiscussionSession) -> Dict[str, Any]:
    """Fallback summary when AI is not available."""
    message_count = len(session.transcript or [])
    student_messages = [m for m in (session.transcript or []) if m.get("sender") == "student"]

    quality = "fair"
    if message_count >= 6 and len(student_messages) >= 3:
        quality = "good"
    if message_count >= 8 and len(student_messages) >= 4:
        quality = "excellent"

    return {
        "summary": f"Student discussed the question with {session.peer_name}. "
                   f"The conversation had {message_count} messages exploring the concept.",
        "key_insights": [
            f"Discussed why '{session.student_answer}' was chosen",
            f"The correct answer is '{session.correct_answer}'"
        ] if not session.was_correct else [
            "Reinforced understanding of the correct answer",
            "Explored reasoning behind the solution"
        ],
        "misconceptions": [f"Chose '{session.student_answer}' instead of '{session.correct_answer}'"]
            if not session.was_correct else [],
        "learning_moments": ["Engaged in peer discussion about the concept"],
        "understanding_improved": message_count >= 4,
        "quality": quality
    }


@router.get("/peer-discussions", response_model=List[PeerDiscussionResponse])
async def get_student_peer_discussions(
    student_name: str,
    game_id: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get all peer discussion sessions for a student."""
    query = select(PeerDiscussionSession).where(
        PeerDiscussionSession.student_name == student_name
    )

    if game_id:
        query = query.where(PeerDiscussionSession.game_id == uuid.UUID(game_id))

    query = query.order_by(desc(PeerDiscussionSession.started_at)).limit(limit)

    result = await db.execute(query)
    sessions = result.scalars().all()

    return [
        PeerDiscussionResponse(
            id=str(s.id),
            student_name=s.student_name,
            question_text=s.question_text,
            student_answer=s.student_answer,
            was_correct=s.was_correct,
            peer_type=s.peer_type,
            peer_name=s.peer_name,
            transcript=s.transcript or [],
            message_count=s.message_count,
            summary=s.summary,
            key_insights=s.key_insights or [],
            misconceptions_identified=s.misconceptions_identified or [],
            status=s.status,
            created_at=s.started_at.isoformat(),
        )
        for s in sessions
    ]


@router.get("/peer-discussions/game/{game_id}")
async def get_game_peer_discussions(
    game_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all peer discussion sessions for a game (for teacher insights)."""
    result = await db.execute(
        select(PeerDiscussionSession)
        .where(PeerDiscussionSession.game_id == uuid.UUID(game_id))
        .order_by(desc(PeerDiscussionSession.started_at))
    )
    sessions = result.scalars().all()

    # Aggregate insights for teacher
    total_discussions = len(sessions)
    completed_discussions = sum(1 for s in sessions if s.status == "completed")
    all_misconceptions = []
    all_insights = []
    quality_counts = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}

    for s in sessions:
        if s.misconceptions_identified:
            all_misconceptions.extend(s.misconceptions_identified)
        if s.key_insights:
            all_insights.extend(s.key_insights)
        if s.discussion_quality:
            quality_counts[s.discussion_quality] = quality_counts.get(s.discussion_quality, 0) + 1

    # Count common misconceptions
    from collections import Counter
    misconception_counts = Counter(all_misconceptions)
    common_misconceptions = misconception_counts.most_common(5)

    return {
        "game_id": game_id,
        "total_discussions": total_discussions,
        "completed_discussions": completed_discussions,
        "discussions_by_quality": quality_counts,
        "common_misconceptions": [{"misconception": m, "count": c} for m, c in common_misconceptions],
        "sample_insights": list(set(all_insights))[:10],
        "sessions": [
            {
                "id": str(s.id),
                "student_name": s.student_name,
                "question_index": s.question_index,
                "was_correct": s.was_correct,
                "summary": s.summary,
                "discussion_quality": s.discussion_quality,
                "message_count": s.message_count,
                "understanding_improved": s.understanding_improved,
            }
            for s in sessions
        ]
    }


@router.get("/dashboard/{student_name}")
async def get_student_dashboard(
    student_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Get aggregated dashboard data for a student - includes learning profile format."""
    # Get exit tickets
    exit_result = await db.execute(
        select(ExitTicket)
        .where(ExitTicket.student_name == student_name)
        .order_by(desc(ExitTicket.created_at))
        .limit(5)
    )
    exit_tickets = exit_result.scalars().all()

    # Get misconceptions
    misc_result = await db.execute(
        select(DetailedMisconception)
        .where(DetailedMisconception.student_name == student_name)
        .where(DetailedMisconception.is_resolved is False)
        .order_by(desc(DetailedMisconception.created_at))
        .limit(10)
    )
    misconceptions = misc_result.scalars().all()

    # Get adaptive stats
    adaptive_result = await db.execute(
        select(AdaptiveLearningState)
        .where(AdaptiveLearningState.student_name == student_name)
        .order_by(desc(AdaptiveLearningState.updated_at))
    )
    adaptive_state = adaptive_result.scalar_one_or_none()

    # Get game history - find all players with this nickname
    player_result = await db.execute(
        select(Player)
        .options(
            selectinload(Player.answers),
            selectinload(Player.game).selectinload(GameSession.quiz),
            selectinload(Player.game).selectinload(GameSession.players),  # Load all players for ranking
        )
        .where(Player.nickname == student_name)
        .where(Player.is_active is True)
        .order_by(desc(Player.joined_at))
        .limit(10)
    )
    players = player_result.scalars().all()

    # Build recent games list with stats
    recent_games = []
    total_questions_answered = 0
    total_correct = 0
    total_confidence = 0
    confidence_count = 0

    for player in players:
        if player.game and player.game.quiz:
            game = player.game
            quiz = game.quiz
            answers = player.answers

            # Calculate accuracy for this game
            total_answers = len(answers)
            correct_answers = sum(1 for a in answers if a.is_correct)
            accuracy = (correct_answers / total_answers * 100) if total_answers > 0 else 0

            # Track overall stats
            total_questions_answered += total_answers
            total_correct += correct_answers

            # Calculate avg confidence for this game
            for a in answers:
                if a.confidence is not None:
                    total_confidence += a.confidence
                    confidence_count += 1

            # Calculate rank among all players in this game
            all_players = sorted(
                [p for p in game.players if p.is_active],
                key=lambda p: p.total_score,
                reverse=True
            )
            rank = next((i + 1 for i, p in enumerate(all_players) if p.id == player.id), None)

            recent_games.append({
                "game_id": str(game.id),
                "quiz_title": quiz.title,
                "score": player.total_score,
                "rank": rank,
                "accuracy": round(accuracy, 1),
                "played_at": player.joined_at.isoformat() if player.joined_at else datetime.now(timezone.utc).isoformat()
            })

    # Calculate overall stats
    overall_accuracy = (total_correct / total_questions_answered * 100) if total_questions_answered > 0 else 0
    avg_confidence = (total_confidence / confidence_count) if confidence_count > 0 else 50

    # Determine calibration status
    confidence_gap = avg_confidence - overall_accuracy
    if abs(confidence_gap) <= 10:
        calibration_status = "well_calibrated"
    elif confidence_gap > 10:
        calibration_status = "overconfident"
    else:
        calibration_status = "underconfident"

    # Get peer discussion sessions for this student
    peer_result = await db.execute(
        select(PeerDiscussionSession)
        .where(PeerDiscussionSession.student_name == student_name)
        .where(PeerDiscussionSession.status == "completed")
        .order_by(desc(PeerDiscussionSession.completed_at))
        .limit(5)
    )
    peer_sessions = peer_result.scalars().all()

    return {
        # Learning Profile format (for student/profile page)
        "user_id": student_name,
        "name": student_name,
        "total_games_played": len(players),
        "total_questions_answered": total_questions_answered,
        "overall_accuracy": round(overall_accuracy, 1),
        "avg_confidence": round(avg_confidence, 1),
        "calibration_status": calibration_status,
        "learning_streak": 0,  # TODO: implement streak tracking
        "concepts_mastered": [],  # TODO: implement mastery tracking
        "concepts_in_progress": list(set(m.misconception_type for m in misconceptions)),
        "misconceptions": [
            {
                "concept": m.misconception_type,
                "description": m.description,
                "occurrence_count": 1,
                "last_seen": m.created_at.isoformat()
            }
            for m in misconceptions
        ],
        "recent_games": recent_games,
        "review_queue": [],  # TODO: implement spaced repetition
        "strengths": [],  # TODO: derive from performance data
        "weaknesses": list(set(m.misconception_type for m in misconceptions))[:3],

        # Original dashboard format (for backwards compatibility)
        "exit_tickets": [
            {
                "id": str(t.id),
                "target_concept": t.target_concept,
                "micro_lesson": t.micro_lesson[:100] + "..." if len(t.micro_lesson) > 100 else t.micro_lesson,
                "is_completed": t.is_completed,
                "created_at": t.created_at.isoformat(),
            }
            for t in exit_tickets
        ],
        "peer_discussions": [
            {
                "id": str(s.id),
                "question_text": s.question_text[:50] + "..." if len(s.question_text) > 50 else s.question_text,
                "summary": s.summary,
                "discussion_quality": s.discussion_quality,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in peer_sessions
        ],
        "adaptive_learning": {
            "current_difficulty": adaptive_state.current_difficulty if adaptive_state else 0.5,
            "questions_answered": adaptive_state.questions_answered if adaptive_state else 0,
            "overall_accuracy": adaptive_state.overall_accuracy if adaptive_state else 0.0,
            "weak_concepts": adaptive_state.weak_concepts if adaptive_state else [],
        } if adaptive_state else None,
        "summary": {
            "total_exit_tickets": len(exit_tickets),
            "completed_exit_tickets": sum(1 for t in exit_tickets if t.is_completed),
            "active_misconceptions": len(misconceptions),
            "concepts_to_review": list(set(m.misconception_type for m in misconceptions)),
            "total_peer_discussions": len(peer_sessions),
        },
    }

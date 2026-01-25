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
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..db_models_learning import ExitTicket, DetailedMisconception, AdaptiveLearningState, DebateSession

# Add experimentation folder to path for AI agents
EXPERIMENTATION_PATH = Path(__file__).parent.parent.parent.parent / "experimentation" / "ai_agents"
if str(EXPERIMENTATION_PATH) not in sys.path:
    sys.path.insert(0, str(EXPERIMENTATION_PATH))

# Import AI agents
try:
    from exit_ticket_agent import ExitTicketAgent
    from misconception_tagger import MisconceptionTagger, MisconceptionResult
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

    # Try AI agent first, fall back to simple generation
    ticket_data = None
    if AI_AGENTS_AVAILABLE:
        try:
            ticket_data = EXIT_TICKET_AGENT.generate_exit_ticket(
                student_id=hash(request.student_name) % 100000,
                session_responses=request.responses,
                concepts=request.concepts
            )
        except Exception as e:
            print(f"AI agent error: {e}")

    # Fallback if AI not available or failed
    if not ticket_data:
        encouragement = "Great effort!" if session_accuracy >= 0.7 else "Keep practicing, you're improving!"
        ticket_data = {
            "target_concept": target_concept,
            "micro_lesson": f"Review the key concepts of {target_concept}. Focus on understanding the fundamentals and practice with similar problems.",
            "encouragement": encouragement,
            "question": {
                "prompt": f"Which of the following best describes a key concept in {target_concept}?",
                "options": [
                    "A) Understanding the core principles",
                    "B) Memorizing formulas without understanding",
                    "C) Skipping foundational concepts",
                    "D) Avoiding practice problems"
                ],
                "correct_answer": "A",
                "hint": "Focus on building a strong foundation by understanding the underlying principles."
            }
        }

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
            result = MISCONCEPTION_TAGGER.tag_response(
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
        query = query.where(DetailedMisconception.is_resolved == False)

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

@router.get("/dashboard/{student_name}")
async def get_student_dashboard(
    student_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Get aggregated dashboard data for a student."""
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
        .where(DetailedMisconception.is_resolved == False)
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

    return {
        "student_name": student_name,
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
        "misconceptions": [
            {
                "id": str(m.id),
                "misconception_type": m.misconception_type,
                "category": m.category,
                "severity": m.severity,
                "description": m.description,
            }
            for m in misconceptions
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
        },
    }

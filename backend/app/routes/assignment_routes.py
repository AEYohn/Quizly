"""
Assignment Routes
=================
Endpoints for teacher-to-student practice assignments.
"""

from datetime import datetime, timezone
from uuid import UUID
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..db_models_learning import StudentAssignment
from ..services.assignment_service import assignment_service

router = APIRouter(prefix="/assignments", tags=["assignments"])


# ============================================================================
# Request/Response Models
# ============================================================================

class GeneratePreviewRequest(BaseModel):
    student_name: str
    game_id: Optional[str] = None
    misconceptions: List[Dict[str, Any]]  # [{question, wrong_answer, correct_answer}]


class GeneratePreviewResponse(BaseModel):
    title: str
    suggested_questions: List[Dict[str, Any]]
    source_context: Dict[str, Any]


class SendAssignmentRequest(BaseModel):
    student_name: str
    title: str
    note: Optional[str] = None
    questions: List[Dict[str, Any]]
    game_id: Optional[str] = None
    misconceptions: Optional[List[Dict[str, Any]]] = None


class AssignmentResponse(BaseModel):
    id: str
    student_name: str
    title: str
    note: Optional[str]
    status: str
    is_read: bool
    question_count: int
    created_at: str
    completed_at: Optional[str]
    score: Optional[int]
    total_questions: Optional[int]


class AssignmentDetailResponse(AssignmentResponse):
    practice_questions: List[Dict[str, Any]]
    answers: Optional[List[Dict[str, Any]]]


class InboxResponse(BaseModel):
    pending: List[AssignmentResponse]
    completed: List[AssignmentResponse]
    unread_count: int


class SubmitAnswersRequest(BaseModel):
    answers: List[Dict[str, Any]]  # [{question_index, answer}]


class SubmitAnswersResponse(BaseModel):
    score: int
    total: int
    score_percent: float
    feedback: str
    results: List[Dict[str, Any]]


# ============================================================================
# Teacher Endpoints
# ============================================================================

@router.post("/generate-preview", response_model=GeneratePreviewResponse)
async def generate_assignment_preview(
    request: GeneratePreviewRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a preview of practice questions for a student.
    Teacher can review and edit before sending.
    """
    # Generate questions based on misconceptions
    result = await assignment_service.generate_practice_questions(
        student_name=request.student_name,
        misconceptions=request.misconceptions,
        num_questions=4
    )

    return GeneratePreviewResponse(
        title=result.get("title", "Practice Questions"),
        suggested_questions=result.get("questions", []),
        source_context={
            "student_name": request.student_name,
            "game_id": request.game_id,
            "misconception_count": len(request.misconceptions)
        }
    )


@router.post("/send", response_model=AssignmentResponse)
async def send_assignment(
    request: SendAssignmentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Send a practice assignment to a student.
    """
    assignment = StudentAssignment(
        student_name=request.student_name,
        title=request.title,
        note=request.note,
        practice_questions=request.questions,
        source_game_id=UUID(request.game_id) if request.game_id else None,
        source_misconceptions=request.misconceptions or [],
        status="pending",
        is_read=False,
        total_questions=len(request.questions)
    )

    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    return AssignmentResponse(
        id=str(assignment.id),
        student_name=assignment.student_name,
        title=assignment.title,
        note=assignment.note,
        status=assignment.status,
        is_read=assignment.is_read,
        question_count=len(request.questions),
        created_at=assignment.created_at.isoformat(),
        completed_at=None,
        score=None,
        total_questions=assignment.total_questions
    )


# ============================================================================
# Student Endpoints
# ============================================================================

@router.get("/inbox/{student_name}", response_model=InboxResponse)
async def get_student_inbox(
    student_name: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all assignments for a student.
    """
    result = await db.execute(
        select(StudentAssignment)
        .where(StudentAssignment.student_name == student_name)
        .order_by(desc(StudentAssignment.created_at))
    )
    assignments = result.scalars().all()

    pending = []
    completed = []
    unread_count = 0

    for a in assignments:
        response = AssignmentResponse(
            id=str(a.id),
            student_name=a.student_name,
            title=a.title,
            note=a.note,
            status=a.status,
            is_read=a.is_read,
            question_count=len(a.practice_questions) if a.practice_questions else 0,
            created_at=a.created_at.isoformat(),
            completed_at=a.completed_at.isoformat() if a.completed_at else None,
            score=a.score,
            total_questions=a.total_questions
        )

        if a.status == "completed":
            completed.append(response)
        else:
            pending.append(response)
            if not a.is_read:
                unread_count += 1

    return InboxResponse(
        pending=pending,
        completed=completed,
        unread_count=unread_count
    )


@router.get("/{assignment_id}", response_model=AssignmentDetailResponse)
async def get_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific assignment with all questions.
    Marks assignment as read.
    """
    result = await db.execute(
        select(StudentAssignment)
        .where(StudentAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Mark as read
    if not assignment.is_read:
        assignment.is_read = True
        await db.commit()

    return AssignmentDetailResponse(
        id=str(assignment.id),
        student_name=assignment.student_name,
        title=assignment.title,
        note=assignment.note,
        status=assignment.status,
        is_read=assignment.is_read,
        question_count=len(assignment.practice_questions) if assignment.practice_questions else 0,
        created_at=assignment.created_at.isoformat(),
        completed_at=assignment.completed_at.isoformat() if assignment.completed_at else None,
        score=assignment.score,
        total_questions=assignment.total_questions,
        practice_questions=assignment.practice_questions or [],
        answers=assignment.answers if assignment.answers else None
    )


@router.post("/{assignment_id}/start")
async def start_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Mark assignment as started.
    """
    result = await db.execute(
        select(StudentAssignment)
        .where(StudentAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.status == "pending":
        assignment.status = "in_progress"
        assignment.started_at = datetime.now(timezone.utc)
        await db.commit()

    return {"status": "in_progress"}


@router.post("/{assignment_id}/submit", response_model=SubmitAnswersResponse)
async def submit_assignment(
    assignment_id: UUID,
    request: SubmitAnswersRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit answers for an assignment.
    """
    result = await db.execute(
        select(StudentAssignment)
        .where(StudentAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.status == "completed":
        raise HTTPException(status_code=400, detail="Assignment already completed")

    # Generate feedback
    feedback = await assignment_service.generate_feedback(
        questions=assignment.practice_questions or [],
        answers=request.answers
    )

    # Update assignment
    assignment.status = "completed"
    assignment.completed_at = datetime.now(timezone.utc)
    assignment.score = feedback["score"]
    assignment.answers = request.answers

    await db.commit()

    return SubmitAnswersResponse(
        score=feedback["score"],
        total=feedback["total"],
        score_percent=feedback["score_percent"],
        feedback=feedback["feedback"],
        results=feedback["results"]
    )

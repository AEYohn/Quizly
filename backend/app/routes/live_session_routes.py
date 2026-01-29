"""
Live Session Routes
API endpoints for real-time teacher-student session management.
Now redundant file storage replaced with Database.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


from ..database import get_db  # noqa: E402
from ..services.session_service import SessionService  # noqa: E402
from ..schemas import (  # noqa: E402
    LiveSessionStartRequest, 
    LiveSessionResponse, 
    LiveSessionQuestion,
    StudentJoinRequest, 
    StudentJoinResponse,
    StudentSubmissionRequest, 
    StudentSubmissionResponse,
    SessionStatusResponse, 
    ActiveSessionInfo
)

router = APIRouter()

@router.post("/start", response_model=LiveSessionResponse)
async def start_live_session(
    request: LiveSessionStartRequest,
    db: AsyncSession = Depends(get_db)
):
    """Start a new live quiz session.
    
    Multiple concurrent sessions are allowed to support:
    - Async quizzes with different deadlines
    - Multiple classes/sections at once
    - Parallel live + async sessions
    """
    # Debug log to see what questions are being received
    for i, q in enumerate(request.questions):
        print(f"Question {i}: question_type={q.get('question_type')}, has_starter_code={q.get('starter_code') is not None}")
    
    service = SessionService(db)
    
    # No longer restrict to single session - teachers can run multiple concurrent sessions
    session = await service.create_session(request)
    
    return LiveSessionResponse(
        session_id=str(session.id),
        topic=session.topic,
        status=session.status,
        questions=[
            LiveSessionQuestion(
                id=str(q.id),
                concept=q.concept or "",
                prompt=q.prompt,
                options=q.options if isinstance(q.options, list) else [],
                correct_answer=q.correct_answer or "",
                difficulty=q.difficulty,
                explanation=q.explanation or "",
                question_type=q.question_type or "mcq",
                starter_code=getattr(q, 'starter_code', None),
                test_cases=getattr(q, 'test_cases', None),
                language=getattr(q, 'language', None)
            )
            for q in session.questions
        ],
        current_question_index=session.current_question_index,
        student_count=0,
        started_at=session.started_at or utc_now(),
        updated_at=session.created_at
    )


@router.get("/active", response_model=ActiveSessionInfo)
async def get_active_session(db: AsyncSession = Depends(get_db)):
    """Check if there's an active session."""
    service = SessionService(db)
    session = await service.get_latest_active_session()
    
    if not session:
        return ActiveSessionInfo(active=False)
    
    return ActiveSessionInfo(
        active=True,
        session_id=str(session.id),
        topic=session.topic,
        num_questions=len(session.questions),
        updated_at=session.created_at
    )


@router.post("/join", response_model=StudentJoinResponse)
async def join_session(
    request: StudentJoinRequest,
    db: AsyncSession = Depends(get_db)
):
    """Student joins the active session."""
    service = SessionService(db)
    session = await service.get_latest_active_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
    
    # Join student
    await service.add_student(session.id, request.student_name)
    
    current_idx = session.current_question_index
    questions = session.questions
    current_q = questions[current_idx] if current_idx < len(questions) else None
    
    current_q_dict = None
    if current_q:
        current_q_dict = {
            "id": str(current_q.id),
            "prompt": current_q.prompt,
            "options": current_q.options,
            "concept": current_q.concept,
            "question_type": current_q.question_type,
            "correct_answer": current_q.correct_answer,
            "explanation": current_q.explanation,
            "starter_code": current_q.starter_code,
            "test_cases": current_q.test_cases,
            "language": current_q.language
        }

    return StudentJoinResponse(
        session_id=str(session.id),
        topic=session.topic,
        student_name=request.student_name,
        num_questions=len(questions),
        current_question_index=current_idx,
        current_question=current_q_dict
    )


@router.post("/submit", response_model=StudentSubmissionResponse)
async def submit_response(
    request: StudentSubmissionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Student submits a response."""
    service = SessionService(db)
    session = await service.get_latest_active_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
        
    await service.submit_response(session.id, request)
    
    return StudentSubmissionResponse(
        success=True,
        message="Response recorded",
        submitted_at=utc_now()
    )


@router.get("/question/{index}")
async def get_question(index: int, db: AsyncSession = Depends(get_db)):
    """Get a specific question by index."""
    service = SessionService(db)
    session = await service.get_latest_active_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
        
    questions = session.questions
    if index < 0 or index >= len(questions):
        raise HTTPException(status_code=404, detail="Question index out of range")
        
    q = questions[index]
    return {
        "question_index": index,
        "question": {
            "id": str(q.id),
            "prompt": q.prompt,
            "options": q.options,
            "concept": q.concept,
            "question_type": q.question_type,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "starter_code": q.starter_code,
            "test_cases": q.test_cases,
            "language": q.language
        }
    }


@router.get("/status", response_model=SessionStatusResponse)
async def get_session_status(db: AsyncSession = Depends(get_db)):
    """Get real-time session status."""
    service = SessionService(db)
    session = await service.get_latest_active_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No session found")
        
    participants = await service.get_participants(session.id)
    responses = await service.get_all_responses(session.id)
    
    return SessionStatusResponse(
        session_id=str(session.id),
        topic=session.topic,
        status=session.status,
        current_question_index=session.current_question_index,
        total_questions=len(session.questions),
        students_joined=participants,
        responses_count=len(responses),
        last_updated=utc_now()
    )


@router.post("/next-question")
async def advance_to_next_question(db: AsyncSession = Depends(get_db)):
    """Advance to the next question."""
    service = SessionService(db)
    session = await service.get_latest_active_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
        
    new_idx = await service.advance_question(session.id)
    
    if new_idx is None:
        raise HTTPException(status_code=400, detail="Cannot advance")
        
    questions = session.questions
    # Refresh to see if advance_question changed it? No, we got return val.
    
    return {
        "message": "Advanced to next question",
        "current_index": new_idx,
        "question": {
            "id": str(questions[new_idx].id),
            "prompt": questions[new_idx].prompt
        } if new_idx < len(questions) else None
    }


@router.post("/end")
async def end_session(db: AsyncSession = Depends(get_db)):
    """End the active session."""
    service = SessionService(db)
    session = await service.get_latest_active_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No session found")
        
    await service.end_session(session.id)
    
    return {"message": "Session ended", "session_id": str(session.id)}

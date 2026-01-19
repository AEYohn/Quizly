"""
Live Session Routes
API endpoints for real-time teacher-student session management.

These endpoints enable:
- Teachers to start/end live quiz sessions
- Students to join active sessions
- Real-time response submission and monitoring
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
from pathlib import Path

router = APIRouter()


# ==============================================================================
# Request/Response Models
# ==============================================================================

class LiveSessionStartRequest(BaseModel):
    """Request to start a new live session."""
    topic: str = Field(..., description="Session topic")
    questions: List[Dict[str, Any]] = Field(..., description="Approved questions")
    objectives: List[str] = Field(default=[], description="Learning objectives")


class LiveSessionQuestion(BaseModel):
    """Question in a live session."""
    id: str
    concept: str = ""
    prompt: str
    options: List[str] = []
    correct_answer: str = ""
    difficulty: float = 0.5
    explanation: str = ""


class LiveSessionResponse(BaseModel):
    """Response for live session data."""
    session_id: str
    topic: str
    status: str = Field(description="Status: 'active', 'paused', 'completed'")
    questions: List[LiveSessionQuestion]
    current_question_index: int = 0
    student_count: int = 0
    started_at: datetime
    updated_at: datetime


class StudentJoinRequest(BaseModel):
    """Request for a student to join a session."""
    student_name: str = Field(..., description="Student's display name")


class StudentJoinResponse(BaseModel):
    """Response after joining a session."""
    session_id: str
    topic: str
    student_name: str
    num_questions: int
    current_question_index: int
    current_question: Optional[Dict[str, Any]] = None


class StudentSubmissionRequest(BaseModel):
    """Student's response submission."""
    student_name: str = Field(..., description="Student's name")
    question_id: str = Field(..., description="Question ID")
    answer: str = Field(..., description="Selected answer (A, B, C, D) or text")
    reasoning: Optional[str] = Field(default=None, description="Student's reasoning")
    confidence: int = Field(default=50, ge=0, le=100, description="Confidence level")
    response_type: str = Field(default="mcq", description="Type: mcq, code, image, text")
    code_submission: Optional[str] = Field(default=None, description="Code if response_type is 'code'")
    image_description: Optional[str] = Field(default=None, description="Image description if applicable")


class StudentSubmissionResponse(BaseModel):
    """Response after submitting an answer."""
    success: bool
    message: str
    submitted_at: datetime


class SessionStatusResponse(BaseModel):
    """Real-time session status."""
    session_id: str
    topic: str
    status: str
    current_question_index: int
    total_questions: int
    students_joined: List[str]
    responses_count: int
    last_updated: datetime


class ActiveSessionInfo(BaseModel):
    """Brief info about active session."""
    active: bool
    session_id: Optional[str] = None
    topic: Optional[str] = None
    num_questions: int = 0
    updated_at: Optional[datetime] = None


# ==============================================================================
# In-Memory Storage (replace with database in production)
# ==============================================================================

# Session file path (shared with Gradio dashboards for demo)
SESSION_FILE = Path(__file__).parent.parent.parent.parent / "experimentation" / ".active_session.json"


def load_session() -> Optional[Dict[str, Any]]:
    """Load session from shared file."""
    if SESSION_FILE.exists():
        try:
            with open(SESSION_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return None
    return None


def save_session(session_data: Dict[str, Any]) -> bool:
    """Save session to shared file."""
    try:
        session_data["updated_at"] = datetime.now().isoformat()
        with open(SESSION_FILE, 'w') as f:
            json.dump(session_data, f, indent=2, default=str)
        return True
    except Exception as e:
        print(f"Error saving session: {e}")
        return False


def clear_session() -> bool:
    """Clear the active session."""
    try:
        if SESSION_FILE.exists():
            SESSION_FILE.unlink()
        return True
    except Exception:
        return False


# ==============================================================================
# Endpoints
# ==============================================================================

@router.post("/start", response_model=LiveSessionResponse)
async def start_live_session(request: LiveSessionStartRequest):
    """
    Start a new live quiz session.
    
    POST /live-sessions/start
    
    This creates an active session that students can join.
    Only one session can be active at a time.
    """
    # Check if there's already an active session
    existing = load_session()
    if existing and existing.get("status") == "active":
        raise HTTPException(
            status_code=400, 
            detail="A session is already active. End it first."
        )
    
    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    session_data = {
        "session_id": session_id,
        "topic": request.topic,
        "approved_questions": request.questions,
        "objectives": request.objectives,
        "current_question_index": 0,
        "student_responses": {},
        "students_joined": [],
        "started_at": datetime.now().isoformat(),
        "status": "active"
    }
    
    if not save_session(session_data):
        raise HTTPException(status_code=500, detail="Failed to save session")
    
    return LiveSessionResponse(
        session_id=session_id,
        topic=request.topic,
        status="active",
        questions=[
            LiveSessionQuestion(
                id=q.get("id", f"q_{i}"),
                concept=q.get("concept", ""),
                prompt=q.get("prompt", ""),
                options=q.get("options", []),
                correct_answer=q.get("correct_answer", ""),
                difficulty=q.get("difficulty", 0.5),
                explanation=q.get("explanation", "")
            )
            for i, q in enumerate(request.questions)
        ],
        current_question_index=0,
        student_count=0,
        started_at=datetime.now(),
        updated_at=datetime.now()
    )


@router.get("/active", response_model=ActiveSessionInfo)
async def get_active_session():
    """
    Check if there's an active session.
    
    GET /live-sessions/active
    
    Returns session info if active, or {active: false} if no session.
    """
    session = load_session()
    
    if not session or session.get("status") != "active":
        return ActiveSessionInfo(active=False)
    
    return ActiveSessionInfo(
        active=True,
        session_id=session.get("session_id"),
        topic=session.get("topic"),
        num_questions=len(session.get("approved_questions", [])),
        updated_at=datetime.fromisoformat(session.get("updated_at", datetime.now().isoformat()))
    )


@router.post("/join", response_model=StudentJoinResponse)
async def join_session(request: StudentJoinRequest):
    """
    Student joins the active session.
    
    POST /live-sessions/join
    
    Records the student as joined and returns session info + first question.
    """
    session = load_session()
    
    if not session or session.get("status") != "active":
        raise HTTPException(status_code=404, detail="No active session")
    
    # Add student to joined list
    students = session.get("students_joined", [])
    if request.student_name not in students:
        students.append(request.student_name)
        session["students_joined"] = students
        save_session(session)
    
    questions = session.get("approved_questions", [])
    current_idx = session.get("current_question_index", 0)
    current_question = questions[current_idx] if current_idx < len(questions) else None
    
    return StudentJoinResponse(
        session_id=session.get("session_id"),
        topic=session.get("topic"),
        student_name=request.student_name,
        num_questions=len(questions),
        current_question_index=current_idx,
        current_question=current_question
    )


@router.post("/submit", response_model=StudentSubmissionResponse)
async def submit_response(request: StudentSubmissionRequest):
    """
    Student submits a response to a question.
    
    POST /live-sessions/submit
    
    Records the student's answer, reasoning, and confidence.
    """
    session = load_session()
    
    if not session or session.get("status") != "active":
        raise HTTPException(status_code=404, detail="No active session")
    
    # Add response
    responses = session.get("student_responses", {})
    if request.question_id not in responses:
        responses[request.question_id] = {}
    
    responses[request.question_id][request.student_name] = {
        "answer": request.answer,
        "reasoning": request.reasoning,
        "confidence": request.confidence,
        "response_type": request.response_type,
        "code_submission": request.code_submission,
        "image_description": request.image_description,
        "submitted_at": datetime.now().isoformat()
    }
    
    session["student_responses"] = responses
    save_session(session)
    
    return StudentSubmissionResponse(
        success=True,
        message="Response recorded",
        submitted_at=datetime.now()
    )


@router.get("/status", response_model=SessionStatusResponse)
async def get_session_status():
    """
    Get real-time session status.
    
    GET /live-sessions/status
    
    Returns current question, student count, and response count.
    """
    session = load_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No session found")
    
    responses = session.get("student_responses", {})
    total_responses = sum(len(r) for r in responses.values())
    
    return SessionStatusResponse(
        session_id=session.get("session_id"),
        topic=session.get("topic"),
        status=session.get("status", "unknown"),
        current_question_index=session.get("current_question_index", 0),
        total_questions=len(session.get("approved_questions", [])),
        students_joined=session.get("students_joined", []),
        responses_count=total_responses,
        last_updated=datetime.fromisoformat(session.get("updated_at", datetime.now().isoformat()))
    )


@router.get("/question/{question_index}")
async def get_question(question_index: int):
    """
    Get a specific question by index.
    
    GET /live-sessions/question/{index}
    
    Returns the question at the given index (0-based).
    """
    session = load_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No session found")
    
    questions = session.get("approved_questions", [])
    
    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"question_index": question_index, "question": questions[question_index]}


@router.post("/next-question")
async def advance_to_next_question():
    """
    Advance to the next question.
    
    POST /live-sessions/next-question
    
    Teacher control to move to the next question.
    """
    session = load_session()
    
    if not session or session.get("status") != "active":
        raise HTTPException(status_code=404, detail="No active session")
    
    questions = session.get("approved_questions", [])
    current_idx = session.get("current_question_index", 0)
    
    if current_idx >= len(questions) - 1:
        return {"message": "Already at last question", "current_index": current_idx}
    
    session["current_question_index"] = current_idx + 1
    save_session(session)
    
    return {
        "message": "Advanced to next question",
        "current_index": current_idx + 1,
        "question": questions[current_idx + 1] if current_idx + 1 < len(questions) else None
    }


@router.get("/responses/{question_id}")
async def get_question_responses(question_id: str):
    """
    Get all responses for a specific question.
    
    GET /live-sessions/responses/{question_id}
    
    Returns all student responses for the question.
    """
    session = load_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No session found")
    
    responses = session.get("student_responses", {}).get(question_id, {})
    
    return {
        "question_id": question_id,
        "responses": responses,
        "count": len(responses)
    }


@router.post("/end")
async def end_session():
    """
    End the active session.
    
    POST /live-sessions/end
    
    Marks the session as completed. Data is preserved for analytics.
    """
    session = load_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No session found")
    
    session["status"] = "completed"
    session["ended_at"] = datetime.now().isoformat()
    save_session(session)
    
    return {
        "message": "Session ended",
        "session_id": session.get("session_id"),
        "students_participated": len(session.get("students_joined", [])),
        "total_responses": sum(len(r) for r in session.get("student_responses", {}).values())
    }


@router.delete("/clear")
async def clear_active_session():
    """
    Clear the active session completely.
    
    DELETE /live-sessions/clear
    
    Removes the session file. Use with caution.
    """
    if clear_session():
        return {"message": "Session cleared"}
    else:
        raise HTTPException(status_code=500, detail="Failed to clear session")

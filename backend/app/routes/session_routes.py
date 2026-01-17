"""
Session Routes
API endpoints for session management.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

router = APIRouter()


# Request/Response Models
class SessionCreate(BaseModel):
    """Request model for creating a session."""
    course_id: int
    topic: str
    syllabus_json: Dict[str, Any] = {}


class SessionResponse(BaseModel):
    """Response model for session data."""
    id: int
    course_id: int
    topic: str
    status: str
    syllabus_json: Dict[str, Any]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    questions: List[Dict[str, Any]] = []


# Placeholder data (in-memory until DB is connected)
sessions_db: Dict[int, Dict] = {}
session_counter = 0


@router.post("", response_model=SessionResponse)
async def create_session(session: SessionCreate):
    """
    Create a new session from JSON syllabus.
    
    POST /sessions
    """
    global session_counter
    session_counter += 1
    
    new_session = {
        "id": session_counter,
        "course_id": session.course_id,
        "topic": session.topic,
        "status": "draft",
        "syllabus_json": session.syllabus_json,
        "start_time": None,
        "end_time": None,
        "questions": []
    }
    sessions_db[session_counter] = new_session
    
    return SessionResponse(**new_session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int):
    """
    Fetch session with question list.
    
    GET /sessions/{id}
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionResponse(**sessions_db[session_id])


@router.post("/{session_id}/start")
async def start_session(session_id: int):
    """
    Start a live session.
    
    POST /sessions/{id}/start
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions_db[session_id]
    if session["status"] != "draft":
        raise HTTPException(status_code=400, detail="Session already started or completed")
    
    session["status"] = "active"
    session["start_time"] = datetime.utcnow()
    
    return {"message": "Session started", "session_id": session_id, "status": "active"}


@router.post("/{session_id}/next")
async def next_question(session_id: int):
    """
    Advance to next question in session.
    
    POST /sessions/{id}/next
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions_db[session_id]
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is not active")
    
    # Placeholder - would advance question index
    return {
        "message": "Advanced to next question",
        "session_id": session_id,
        "current_question_index": 0  # Would track actual index
    }


@router.post("/{session_id}/end")
async def end_session(session_id: int):
    """
    End a live session.
    
    POST /sessions/{id}/end
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions_db[session_id]
    session["status"] = "completed"
    session["end_time"] = datetime.utcnow()
    
    return {"message": "Session ended", "session_id": session_id, "status": "completed"}


@router.get("")
async def list_sessions(course_id: Optional[int] = None, status: Optional[str] = None):
    """
    List all sessions, optionally filtered by course or status.
    
    GET /sessions
    """
    results = list(sessions_db.values())
    
    if course_id:
        results = [s for s in results if s["course_id"] == course_id]
    if status:
        results = [s for s in results if s["status"] == status]
    
    return {"sessions": results}

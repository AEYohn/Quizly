"""
Session Routes
API endpoints for session management (listing, history).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from ..database import get_db
from ..services.session_service import SessionService
from ..schemas import LiveSessionResponse

router = APIRouter()

@router.get("", response_model=dict)
async def list_sessions(
    db: AsyncSession = Depends(get_db)
):
    """
    List all sessions (Draft, Active, Completed).
    """
    service = SessionService(db)
    sessions = await service.get_all_sessions()
    
    # Convert manually or use Pydantic schema if compatible
    # Here we map to a simple list response
    results = []
    for s in sessions:
        results.append({
            "session_id": str(s.id),
            "topic": s.topic,
            "status": s.status,
            "created_at": s.created_at,
            "num_questions": len(s.questions) if s.questions else 0,
            "active": s.status == "active",
            "participant_count": len(s.participants) if s.participants else 0
        })
        
    return {"sessions": results}

@router.get("/{session_id}", response_model=LiveSessionResponse)
async def get_session_details(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get details for a specific session."""
    service = SessionService(db)
    try:
        import uuid
        s_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
        
    session = await service.get_session_by_id(s_uuid)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return LiveSessionResponse(
        session_id=session.id,
        topic=session.topic,
        status=session.status,
        current_question_index=session.current_question_index,
        active=session.status == "active",
        num_questions=len(session.questions),
        questions=[{
            "id": str(q.id),
            "prompt": q.prompt,
            "options": q.options,
            "concept": q.concept
        } for q in session.questions]
    )

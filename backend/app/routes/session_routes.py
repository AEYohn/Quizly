"""
Session Routes
API endpoints for session management (listing, history).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
import uuid as uuid_module

from ..database import get_db
from ..services.session_service import SessionService
from ..schemas import LiveSessionResponse, LiveSessionQuestion
from ..db_models import Session, User
from ..auth_clerk import get_current_user_clerk as get_current_user

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
            )
            for q in (session.questions or [])
        ],
        current_question_index=session.current_question_index,
        student_count=len(session.participants or []),
        started_at=session.started_at or session.created_at,
        updated_at=session.created_at,
    )


class PublishRequest(BaseModel):
    """Request to publish a session to the marketplace."""
    description: Optional[str] = None
    tags: Optional[List[str]] = []
    difficulty_level: Optional[str] = None
    estimated_duration_mins: Optional[int] = None


@router.post("/{session_id}/publish")
async def publish_session(
    session_id: str,
    request: PublishRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Publish a session to the explore/marketplace.
    Makes it public and forkable by other users.
    """
    try:
        s_uuid = uuid_module.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    result = await db.execute(select(Session).where(Session.id == s_uuid))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Set creator if not set
    if not session.creator_id:
        session.creator_id = current_user.id
    
    # Update visibility and metadata
    session.is_public = True
    session.is_template = True
    if request.description:
        session.description = request.description
    if request.tags:
        session.tags = request.tags
    if request.difficulty_level:
        session.difficulty_level = request.difficulty_level
    if request.estimated_duration_mins:
        session.estimated_duration_mins = request.estimated_duration_mins
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"'{session.topic}' is now published to Explore!",
        "session_id": str(session.id),
        "explore_url": f"/explore/preview/{session.id}"
    }


@router.post("/{session_id}/unpublish")
async def unpublish_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unpublish a session from the marketplace."""
    try:
        s_uuid = uuid_module.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    result = await db.execute(select(Session).where(Session.id == s_uuid))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_public = False
    session.is_template = False
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"'{session.topic}' has been unpublished."
    }

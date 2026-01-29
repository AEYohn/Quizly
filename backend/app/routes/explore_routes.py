"""
Explore/Marketplace Routes
Public session discovery, forking, and social features.
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from pydantic import BaseModel

from ..database import get_db
from ..db_models import Session, Question, User, SessionLike
from ..auth import get_current_user, get_optional_user


router = APIRouter(prefix="/explore", tags=["explore"])


# ============= Schemas =============

class PublicSessionItem(BaseModel):
    id: str
    topic: str
    description: Optional[str] = None
    creator_name: str
    creator_id: str
    num_questions: int
    tags: List[str] = []
    difficulty_level: Optional[str] = None
    estimated_duration_mins: Optional[int] = None
    play_count: int = 0
    fork_count: int = 0
    likes_count: int = 0
    is_liked: bool = False
    thumbnail_url: Optional[str] = None
    created_at: str


class ExploreResponse(BaseModel):
    sessions: List[PublicSessionItem]
    total: int
    page: int
    per_page: int
    has_more: bool


class ForkResponse(BaseModel):
    success: bool
    session_id: str
    message: str


class CreatorProfile(BaseModel):
    id: str
    name: str
    sessions_created: int
    total_plays: int
    total_forks: int
    total_likes: int
    public_sessions: List[PublicSessionItem]


# ============= Routes =============

@router.get("", response_model=ExploreResponse)
async def explore_sessions(
    q: Optional[str] = Query(None, description="Search query"),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    difficulty: Optional[str] = Query(None, description="beginner, intermediate, advanced"),
    sort: str = Query("popular", description="popular, recent, most_forked"),
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Explore public sessions - the marketplace!
    This is the discovery page where users can find and fork sessions.
    """
    # Base query - public sessions only
    query = select(Session).where(
        Session.is_public is True,
        Session.is_template is True
    )
    
    # Search filter
    if q:
        search_term = f"%{q}%"
        query = query.where(
            or_(
                Session.topic.ilike(search_term),
                Session.description.ilike(search_term)
            )
        )
    
    # Difficulty filter
    if difficulty:
        query = query.where(Session.difficulty_level == difficulty)
    
    # Sort
    if sort == "recent":
        query = query.order_by(desc(Session.created_at))
    elif sort == "most_forked":
        query = query.order_by(desc(Session.fork_count))
    else:  # popular (default)
        query = query.order_by(desc(Session.play_count + Session.likes_count))
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Paginate
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)
    
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    # Get liked status if user is logged in
    liked_session_ids = set()
    if current_user:
        likes_query = select(SessionLike.session_id).where(
            SessionLike.user_id == current_user.id,
            SessionLike.session_id.in_([s.id for s in sessions])
        )
        likes_result = await db.execute(likes_query)
        liked_session_ids = {str(lid) for lid in likes_result.scalars().all()}
    
    # Build response
    items = []
    for session in sessions:
        # Get creator name
        creator_name = "Anonymous"
        if session.creator_id:
            creator_result = await db.execute(
                select(User).where(User.id == session.creator_id)
            )
            creator = creator_result.scalar_one_or_none()
            if creator:
                creator_name = creator.name
        
        # Count questions
        q_count = await db.execute(
            select(func.count()).where(Question.session_id == session.id)
        )
        num_questions = q_count.scalar() or 0
        
        items.append(PublicSessionItem(
            id=str(session.id),
            topic=session.topic,
            description=session.description,
            creator_name=creator_name,
            creator_id=str(session.creator_id) if session.creator_id else "",
            num_questions=num_questions,
            tags=session.tags or [],
            difficulty_level=session.difficulty_level,
            estimated_duration_mins=session.estimated_duration_mins,
            play_count=session.play_count,
            fork_count=session.fork_count,
            likes_count=session.likes_count,
            is_liked=str(session.id) in liked_session_ids,
            thumbnail_url=session.thumbnail_url,
            created_at=session.created_at.isoformat()
        ))
    
    return ExploreResponse(
        sessions=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + len(items)) < total
    )


@router.post("/{session_id}/fork", response_model=ForkResponse)
async def fork_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fork a public session to your own collection.
    Like GitHub forks - you get your own copy to modify and use.
    """
    # Get original session
    result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    original = result.scalar_one_or_none()
    
    if not original:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not original.is_public or not original.is_template:
        raise HTTPException(status_code=403, detail="This session cannot be forked")
    
    # Get original questions
    questions_result = await db.execute(
        select(Question).where(Question.session_id == session_id).order_by(Question.order_index)
    )
    original_questions = questions_result.scalars().all()
    
    # Create the fork
    forked_session = Session(
        creator_id=current_user.id,
        topic=f"{original.topic}",  # Keep same name
        description=original.description,
        status="draft",
        objectives=original.objectives,
        is_public=False,  # Forks are private by default
        is_template=False,
        forked_from_id=original.id,
        tags=original.tags,
        difficulty_level=original.difficulty_level,
        estimated_duration_mins=original.estimated_duration_mins
    )
    db.add(forked_session)
    await db.flush()
    
    # Copy questions
    for idx, q in enumerate(original_questions):
        new_question = Question(
            session_id=forked_session.id,
            concept=q.concept,
            prompt=q.prompt,
            options=q.options,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            difficulty=q.difficulty,
            order_index=idx,
            question_type=q.question_type,
            target_misconception=q.target_misconception,
            misconception_trap_option=q.misconception_trap_option
        )
        db.add(new_question)
    
    # Increment fork count on original
    original.fork_count += 1
    
    await db.commit()
    
    return ForkResponse(
        success=True,
        session_id=str(forked_session.id),
        message=f"Successfully forked '{original.topic}' to your sessions!"
    )


@router.post("/{session_id}/like")
async def toggle_like(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle like on a public session."""
    # Check session exists and is public
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.is_public is True)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Public session not found")
    
    # Check if already liked
    like_result = await db.execute(
        select(SessionLike).where(
            SessionLike.session_id == session_id,
            SessionLike.user_id == current_user.id
        )
    )
    existing_like = like_result.scalar_one_or_none()
    
    if existing_like:
        # Unlike
        await db.delete(existing_like)
        session.likes_count = max(0, session.likes_count - 1)
        action = "unliked"
    else:
        # Like
        new_like = SessionLike(
            session_id=session_id,
            user_id=current_user.id
        )
        db.add(new_like)
        session.likes_count += 1
        action = "liked"
    
    await db.commit()
    
    return {
        "success": True,
        "action": action,
        "likes_count": session.likes_count
    }


@router.get("/creators/{creator_id}", response_model=CreatorProfile)
async def get_creator_profile(
    creator_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Get a creator's public profile with their public sessions."""
    # Get creator
    result = await db.execute(select(User).where(User.id == creator_id))
    creator = result.scalar_one_or_none()
    
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    # Get their public sessions
    sessions_result = await db.execute(
        select(Session).where(
            Session.creator_id == creator_id,
            Session.is_public is True
        ).order_by(desc(Session.play_count))
    )
    public_sessions = sessions_result.scalars().all()
    
    # Calculate totals
    total_plays = sum(s.play_count for s in public_sessions)
    total_forks = sum(s.fork_count for s in public_sessions)
    total_likes = sum(s.likes_count for s in public_sessions)
    
    # Get liked status if user is logged in
    liked_session_ids = set()
    if current_user:
        likes_query = select(SessionLike.session_id).where(
            SessionLike.user_id == current_user.id,
            SessionLike.session_id.in_([s.id for s in public_sessions])
        )
        likes_result = await db.execute(likes_query)
        liked_session_ids = {str(lid) for lid in likes_result.scalars().all()}
    
    # Build session items
    items = []
    for session in public_sessions:
        q_count = await db.execute(
            select(func.count()).where(Question.session_id == session.id)
        )
        num_questions = q_count.scalar() or 0
        
        items.append(PublicSessionItem(
            id=str(session.id),
            topic=session.topic,
            description=session.description,
            creator_name=creator.name,
            creator_id=str(creator.id),
            num_questions=num_questions,
            tags=session.tags or [],
            difficulty_level=session.difficulty_level,
            estimated_duration_mins=session.estimated_duration_mins,
            play_count=session.play_count,
            fork_count=session.fork_count,
            likes_count=session.likes_count,
            is_liked=str(session.id) in liked_session_ids,
            thumbnail_url=session.thumbnail_url,
            created_at=session.created_at.isoformat()
        ))
    
    return CreatorProfile(
        id=str(creator.id),
        name=creator.name,
        sessions_created=len(public_sessions),
        total_plays=total_plays,
        total_forks=total_forks,
        total_likes=total_likes,
        public_sessions=items
    )


@router.get("/tags")
async def get_popular_tags(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get popular tags from public sessions for filtering."""
    # This is a simple implementation - in production you'd want a proper tags table
    result = await db.execute(
        select(Session.tags).where(
            Session.is_public is True,
            Session.tags is not None
        )
    )
    
    tag_counts = {}
    for (tags,) in result:
        if tags:
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
    
    # Sort by count and return top N
    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    return {
        "tags": [{"name": tag, "count": count} for tag, count in sorted_tags]
    }

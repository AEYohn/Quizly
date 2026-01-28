"""Student library routes for study items and collections."""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth_clerk import get_current_user_clerk
from ..db_models import (
    User, StudyItem, FlashcardDeck, Flashcard,
    StudyNote, GameContent, Collection, CollectionItem, LibraryStudySession
)

router = APIRouter()


# ============ Pydantic Schemas ============

class StudyItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    visibility: str = Field(default="private")
    tags: List[str] = Field(default_factory=list)


class StudyItemResponse(BaseModel):
    id: str
    type: str
    title: str
    description: Optional[str]
    visibility: str
    tags: List[str]
    source: str
    times_studied: int
    last_studied_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudyItemListResponse(BaseModel):
    items: List[StudyItemResponse]
    total: int


# ============ Study Items Endpoints ============

@router.get("/items", response_model=StudyItemListResponse)
async def list_study_items(
    type: Optional[str] = None,
    visibility: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """List all study items for current user."""
    query = select(StudyItem).where(StudyItem.owner_id == current_user.id)

    if type:
        query = query.where(StudyItem.type == type)
    if visibility:
        query = query.where(StudyItem.visibility == visibility)

    query = query.order_by(StudyItem.updated_at.desc())

    result = await db.execute(query)
    items = result.scalars().all()

    return StudyItemListResponse(
        items=[StudyItemResponse(id=str(i.id), **{
            k: getattr(i, k) for k in StudyItemResponse.model_fields if k != 'id'
        }) for i in items],
        total=len(items)
    )


@router.get("/items/{item_id}", response_model=StudyItemResponse)
async def get_study_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Get a specific study item."""
    result = await db.execute(
        select(StudyItem).where(StudyItem.id == item_id)
    )
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Study item not found")

    # Check access
    if item.owner_id != current_user.id and item.visibility == "private":
        raise HTTPException(status_code=403, detail="Access denied")

    return StudyItemResponse(id=str(item.id), **{
        k: getattr(item, k) for k in StudyItemResponse.model_fields if k != 'id'
    })


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Delete a study item."""
    result = await db.execute(
        select(StudyItem).where(StudyItem.id == item_id)
    )
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Study item not found")

    if item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(item)
    await db.commit()
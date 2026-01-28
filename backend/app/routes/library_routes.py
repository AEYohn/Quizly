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

"""
Content Pool Database Models
Shared content pool for the TikTok-style recommendation engine.
ContentItem is the shared pool — if one user triggers generation for a topic,
all future users on that topic get instant access.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Float, Integer, Boolean, ForeignKey, DateTime, JSON, Uuid, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


class ContentItem(Base):
    """
    Shared content pool item.
    Polymorphic payload via content_json — supports MCQ, flashcard, info_card.
    """
    __tablename__ = "content_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "mcq", "flashcard", "info_card"
    topic: Mapped[str] = mapped_column(String(255), nullable=False)  # normalized topic
    concept: Mapped[str] = mapped_column(String(255), nullable=False)  # specific concept
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)  # 0.0-1.0

    content_json: Mapped[dict] = mapped_column(JSON, default=dict)
    # mcq: {prompt, options, correct_answer, explanation}
    # flashcard: {front, back, hint}
    # info_card: {title, body_markdown, key_takeaway}

    tags: Mapped[dict] = mapped_column(JSON, default=list)  # ["ml", "statistics"]
    source: Mapped[str] = mapped_column(String(50), default="ai_generated")  # "ai_generated" | "user_uploaded"
    generator_agent: Mapped[str] = mapped_column(String(100), default="")  # which subagent created it
    quality_score: Mapped[float] = mapped_column(Float, default=0.5)  # updated by engagement

    # Engagement aggregates
    times_served: Mapped[int] = mapped_column(Integer, default=0)
    times_correct: Mapped[int] = mapped_column(Integer, default=0)  # MCQ only
    times_skipped: Mapped[int] = mapped_column(Integer, default=0)
    avg_time_spent_ms: Mapped[float] = mapped_column(Float, default=0.0)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_content_items_topic_type_active", "topic", "content_type", "is_active"),
        Index("ix_content_items_concept_active", "concept", "is_active"),
    )


class UserContentInteraction(Base):
    """Tracks every user interaction with content for engagement signals."""
    __tablename__ = "user_content_interactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    content_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_items.id"), nullable=False)

    interaction_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "answered", "skipped", "not_interested", "viewed"
    answer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # for MCQ
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    time_spent_ms: Mapped[int] = mapped_column(Integer, default=0)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class UserTopicPreference(Base):
    """Explicit skip/mute signals — 'not interested' in a topic."""
    __tablename__ = "user_topic_preferences"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    preference: Mapped[str] = mapped_column(String(20), nullable=False)  # "interested", "not_interested", "muted"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("student_name", "topic", name="uq_user_topic_pref"),
    )

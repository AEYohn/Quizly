"""
Question History Database Models
Persists every question + answer for review and progress tracking.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Float, Integer, Boolean, Text, DateTime, JSON, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


class QuestionHistory(Base):
    """Stores every question asked and the student's response."""
    __tablename__ = "question_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    student_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Question snapshot
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict] = mapped_column(JSON, default=list)
    correct_answer: Mapped[str] = mapped_column(String(500), nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Response
    student_answer: Mapped[str] = mapped_column(String(500), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, default=50)

    # Metadata
    concept: Mapped[str] = mapped_column(String(500), nullable=False)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(String(50), default="learn")  # "learn" or "scroll"

    # Timestamps
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index('ix_qh_student_answered', 'student_name', 'answered_at'),
        Index('ix_qh_student_topic', 'student_name', 'topic'),
    )

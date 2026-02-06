"""
Assessment Database Models
Stores familiarity assessment results (self-ratings + diagnostic quiz).
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Float, Integer, DateTime, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


class FamiliarityAssessment(Base):
    """Stores a student's familiarity assessment for a subject."""
    __tablename__ = "familiarity_assessments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    student_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)

    self_ratings_json: Mapped[dict] = mapped_column(JSON, default=list)
    # [{concept, rating, timestamp}]
    diagnostic_results_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [{concept, answer, is_correct, time_ms}]

    overall_familiarity: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0-1.0
    concepts_assessed: Mapped[int] = mapped_column(Integer, default=0)
    diagnostic_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

"""
Student Learning Database Models
Extended models for exit tickets, misconception tracking, and adaptive learning.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Float, Integer, Boolean, ForeignKey, DateTime, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


class ExitTicket(Base):
    """
    Personalized exit ticket generated after quiz completion.
    Contains micro-lesson and follow-up question for student's weakest concept.
    """
    __tablename__ = "exit_tickets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)  # For anonymous students
    game_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)  # Reference to game session
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)

    # Target concept from session
    target_concept: Mapped[str] = mapped_column(String(255), nullable=False)
    session_accuracy: Mapped[float] = mapped_column(Float, default=0.0)  # Student's accuracy on this concept

    # Micro-lesson content
    micro_lesson: Mapped[str] = mapped_column(Text, nullable=False)
    encouragement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Follow-up question
    question_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    question_options: Mapped[dict] = mapped_column(JSON, default=list)  # ["A...", "B...", "C...", "D..."]
    correct_answer: Mapped[str] = mapped_column(String(10), nullable=False)
    hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Student's response to follow-up
    student_answer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    answered_correctly: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    student: Mapped[Optional["User"]] = relationship()
    session: Mapped[Optional["Session"]] = relationship()


class DetailedMisconception(Base):
    """
    Detailed misconception tracking with AI-generated analysis.
    Extends the basic StudentMisconception model with more detailed fields.
    """
    __tablename__ = "detailed_misconceptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    game_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    question_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("questions.id"), nullable=True)

    # Misconception classification
    misconception_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "quantifier_flip"
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # conceptual, procedural, careless, etc.
    severity: Mapped[str] = mapped_column(String(20), default="moderate")  # minor, moderate, severe

    # Details
    description: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[dict] = mapped_column(JSON, default=list)  # Quotes showing the misconception

    # Student's response
    student_answer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    correct_answer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    student_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Remediation
    suggested_remediation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    related_concepts: Mapped[dict] = mapped_column(JSON, default=list)

    # Status
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)  # AI confidence in classification

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    student: Mapped[Optional["User"]] = relationship()
    session: Mapped[Optional["Session"]] = relationship()
    question: Mapped[Optional["Question"]] = relationship()


class AdaptiveLearningState(Base):
    """
    Track adaptive learning state for a student in a session.
    Records difficulty trajectory and performance metrics.
    """
    __tablename__ = "adaptive_learning_states"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)

    # Current difficulty state
    current_difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    target_accuracy: Mapped[float] = mapped_column(Float, default=0.6)

    # Performance metrics
    questions_answered: Mapped[int] = mapped_column(Integer, default=0)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0)
    overall_accuracy: Mapped[float] = mapped_column(Float, default=0.0)

    # Concept-level tracking
    concept_accuracy: Mapped[dict] = mapped_column(JSON, default=dict)  # {"concept": [accuracies]}
    weak_concepts: Mapped[dict] = mapped_column(JSON, default=list)

    # Difficulty history
    difficulty_history: Mapped[dict] = mapped_column(JSON, default=list)  # [{timestamp, difficulty, accuracy, reason}]

    # Metadata
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    student: Mapped[Optional["User"]] = relationship()
    session: Mapped[Optional["Session"]] = relationship()


class DebateSession(Base):
    """
    Track AI peer discussion sessions after wrong answers.
    """
    __tablename__ = "debate_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    game_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    question_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("questions.id"), nullable=True)

    # Student's position
    initial_answer: Mapped[str] = mapped_column(String(255), nullable=False)
    initial_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    final_answer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Debate content
    transcript: Mapped[dict] = mapped_column(JSON, default=list)  # List of debate turns

    # AI judgment
    judgment: Mapped[dict] = mapped_column(JSON, default=dict)  # Full judgment result
    argument_quality: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    logical_soundness: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    logical_flaws: Mapped[dict] = mapped_column(JSON, default=list)

    # Outcome
    answer_changed: Mapped[bool] = mapped_column(Boolean, default=False)
    changed_to_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    learning_recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(String(50), default="ongoing")  # ongoing, completed, abandoned

    # Metadata
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    student: Mapped[Optional["User"]] = relationship()
    session: Mapped[Optional["Session"]] = relationship()
    question: Mapped[Optional["Question"]] = relationship()


# Import User, Session, Question for type hints (avoiding circular imports)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .db_models import User, Session, Question

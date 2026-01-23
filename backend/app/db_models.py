"""
Database Models
SQLAlchemy ORM models for Quizly.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Float, Integer, Boolean, ForeignKey, DateTime, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


from .database import Base


class User(Base):
    """User model for teachers and students."""
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # For authenticated users
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # 'teacher' or 'student'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    courses: Mapped[List["Course"]] = relationship(back_populates="teacher")
    responses: Mapped[List["Response"]] = relationship(back_populates="student")


class Course(Base):
    """Course model."""
    __tablename__ = "courses"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    teacher: Mapped[Optional["User"]] = relationship(back_populates="courses")
    sessions: Mapped[List["Session"]] = relationship(back_populates="course")


class Session(Base):
    """Live quiz session model."""
    __tablename__ = "sessions"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("courses.id"), nullable=True)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, active, completed
    current_question_index: Mapped[int] = mapped_column(Integer, default=0)
    objectives: Mapped[dict] = mapped_column(JSON, default=list)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    course: Mapped[Optional["Course"]] = relationship(back_populates="sessions")
    questions: Mapped[List["Question"]] = relationship(back_populates="session", order_by="Question.order_index")
    responses: Mapped[List["Response"]] = relationship(back_populates="session")
    participants: Mapped[List["SessionParticipant"]] = relationship(back_populates="session")


class Question(Base):
    """Question model."""
    __tablename__ = "questions"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    concept: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict] = mapped_column(JSON, nullable=False)  # ["A. ...", "B. ..."]
    correct_answer: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    question_type: Mapped[str] = mapped_column(String(50), default="mcq")  # mcq, code, diagram, ranking, free_response
    target_misconception: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Misconception this Q targets
    misconception_trap_option: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # Which option traps the misconception
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    session: Mapped["Session"] = relationship(back_populates="questions")
    responses: Mapped[List["Response"]] = relationship(back_populates="question")


class Response(Base):
    """Student response model."""
    __tablename__ = "responses"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # For anonymous
    answer: Mapped[str] = mapped_column(String(255), nullable=False)
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, default=50)
    response_type: Mapped[str] = mapped_column(String(50), default="mcq")  # mcq, code, image, text
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    code_submission: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # For code responses
    image_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # For image responses
    vote_round: Mapped[int] = mapped_column(Integer, default=1)  # 1 = initial, 2 = after discussion
    answer_changed: Mapped[bool] = mapped_column(Boolean, default=False)  # Did student change answer?
    previous_answer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # What they answered before
    time_to_answer_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Response time in ms
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    session: Mapped["Session"] = relationship(back_populates="responses")
    question: Mapped["Question"] = relationship(back_populates="responses")
    student: Mapped[Optional["User"]] = relationship(back_populates="responses")


class SessionParticipant(Base):
    """Session participant tracking."""
    __tablename__ = "session_participants"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    session: Mapped["Session"] = relationship(back_populates="participants")


class ConceptMastery(Base):
    """Track student mastery of concepts across sessions."""
    __tablename__ = "concept_mastery"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100
    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct_attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    next_review_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Spaced repetition
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class StudentMisconception(Base):
    """Track persistent misconceptions per student."""
    __tablename__ = "student_misconceptions"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    misconception: Mapped[str] = mapped_column(Text, nullable=False)
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class DiscussionLog(Base):
    """Track discussion quality and outcomes."""
    __tablename__ = "discussion_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    discussion_partner: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # AI or peer name
    discussion_type: Mapped[str] = mapped_column(String(50), default="ai_peer")  # ai_peer, human_peer, teacher
    messages: Mapped[dict] = mapped_column(JSON, default=list)  # Full conversation
    reasoning_depth_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1
    vocabulary_used: Mapped[dict] = mapped_column(JSON, default=list)  # Concept terms used
    learning_signals: Mapped[dict] = mapped_column(JSON, default=list)  # ["asked_why", "gave_example"]
    outcome: Mapped[str] = mapped_column(String(50), default="ongoing")  # ongoing, resolved, needs_teacher, gave_up
    answer_changed: Mapped[bool] = mapped_column(Boolean, default=False)
    changed_to_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SpacedRepetitionItem(Base):
    """Spaced repetition queue for students."""
    __tablename__ = "spaced_repetition_items"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    question_template: Mapped[dict] = mapped_column(JSON, nullable=False)  # Question to show
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)  # SM-2 algorithm
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    repetition_count: Mapped[int] = mapped_column(Integer, default=0)
    next_review_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_quality: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-5 rating
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

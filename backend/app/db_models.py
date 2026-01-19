"""
Database Models
SQLAlchemy ORM models for Quizly.
"""

import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, Float, Integer, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from .database import Base


class User(Base):
    """User model for teachers and students."""
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # 'teacher' or 'student'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    courses: Mapped[List["Course"]] = relationship(back_populates="teacher")
    responses: Mapped[List["Response"]] = relationship(back_populates="student")


class Course(Base):
    """Course model."""
    __tablename__ = "courses"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    teacher: Mapped[Optional["User"]] = relationship(back_populates="courses")
    sessions: Mapped[List["Session"]] = relationship(back_populates="course")


class Session(Base):
    """Live quiz session model."""
    __tablename__ = "sessions"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("courses.id"), nullable=True)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, active, completed
    objectives: Mapped[dict] = mapped_column(JSON, default=list)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    course: Mapped[Optional["Course"]] = relationship(back_populates="sessions")
    questions: Mapped[List["Question"]] = relationship(back_populates="session", order_by="Question.order_index")
    responses: Mapped[List["Response"]] = relationship(back_populates="session")
    participants: Mapped[List["SessionParticipant"]] = relationship(back_populates="session")


class Question(Base):
    """Question model."""
    __tablename__ = "questions"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    concept: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict] = mapped_column(JSON, nullable=False)  # ["A. ...", "B. ..."]
    correct_answer: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session: Mapped["Session"] = relationship(back_populates="questions")
    responses: Mapped[List["Response"]] = relationship(back_populates="question")


class Response(Base):
    """Student response model."""
    __tablename__ = "responses"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # For anonymous
    answer: Mapped[str] = mapped_column(String(255), nullable=False)
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, default=50)
    response_type: Mapped[str] = mapped_column(String(50), default="mcq")  # mcq, code, image, text
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session: Mapped["Session"] = relationship(back_populates="responses")
    question: Mapped["Question"] = relationship(back_populates="responses")
    student: Mapped[Optional["User"]] = relationship(back_populates="responses")


class SessionParticipant(Base):
    """Session participant tracking."""
    __tablename__ = "session_participants"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session: Mapped["Session"] = relationship(back_populates="participants")

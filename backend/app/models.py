"""
Data Models
SQLAlchemy models for Quizly database.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class User(Base):
    """User model for instructors and students."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    role = Column(String(20), nullable=False)  # "instructor" | "student"
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    courses = relationship("Course", back_populates="instructor")
    responses = relationship("Response", back_populates="user")
    mastery_records = relationship("Mastery", back_populates="user")


class Course(Base):
    """Course model."""
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True)
    instructor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    instructor = relationship("User", back_populates="courses")
    sessions = relationship("Session", back_populates="course")


class Session(Base):
    """Learning session model."""
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    topic = Column(String(255), nullable=False)
    syllabus_json = Column(JSON, default={})
    status = Column(String(20), default="draft")  # "draft" | "active" | "completed"
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    course = relationship("Course", back_populates="sessions")
    questions = relationship("Question", back_populates="session")
    pulse_snapshots = relationship("PulseSnapshot", back_populates="session")


class Question(Base):
    """Question model for session questions."""
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    index = Column(Integer, nullable=False)  # Order in session
    concept = Column(String(100), nullable=False)
    difficulty = Column(Float, default=0.5)
    type = Column(String(20), default="mcq")  # "mcq" | "short_answer"
    prompt = Column(String(1000), nullable=False)
    options = Column(JSON, default=[])
    correct_answer = Column(String(255), nullable=False)
    explanation = Column(String(2000), nullable=True)
    
    # Relationships
    session = relationship("Session", back_populates="questions")
    responses = relationship("Response", back_populates="question")
    pulse_snapshots = relationship("PulseSnapshot", back_populates="question")


class Response(Base):
    """Student response to a question."""
    __tablename__ = "responses"
    
    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    answer = Column(String(500), nullable=False)
    confidence = Column(Float, nullable=True)
    rationale = Column(String(1000), nullable=True)
    is_correct = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    question = relationship("Question", back_populates="responses")
    user = relationship("User", back_populates="responses")


class Mastery(Base):
    """Per-student concept mastery tracking."""
    __tablename__ = "mastery"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    concept = Column(String(100), nullable=False)
    score = Column(Float, default=0.5)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="mastery_records")


class PulseSnapshot(Base):
    """Real-time class pulse metrics for a question."""
    __tablename__ = "pulse_snapshots"
    
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    correctness_rate = Column(Float, nullable=True)
    entropy = Column(Float, nullable=True)
    avg_confidence = Column(Float, nullable=True)
    misconception_summary = Column(String(1000), nullable=True)
    recommended_action = Column(String(50), nullable=True)  # "discuss" | "move_on" | "remediate"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("Session", back_populates="pulse_snapshots")
    question = relationship("Question", back_populates="pulse_snapshots")

"""
Game Models for Kahoot-style multiplayer quizzes.

Quiz - Collection of questions created by a teacher
GameSession - Active game instance with join code
Player - Participant in a game session
PlayerAnswer - Individual answer submission
"""

import uuid
import random
import string
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from ..db_models import Course
from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PgUUID

from ..database import Base

# Use generic UUID for SQLite compatibility
from sqlalchemy import Uuid


def utc_now() -> datetime:
    return datetime.utcnow()


def generate_game_code() -> str:
    """Generate a 6-character alphanumeric game code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


class Quiz(Base):
    """A collection of questions created by a teacher or student (for self-study)."""
    __tablename__ = "quizzes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)  # Creator (teacher or student)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    quiz_type: Mapped[str] = mapped_column(String(50), default="teacher")  # "teacher" or "self_study"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Async-first timing settings
    timer_enabled: Mapped[bool] = mapped_column(Boolean, default=False)  # Timer OFF by default for async
    default_time_limit: Mapped[int] = mapped_column(Integer, default=30)  # seconds per question

    # Question behavior settings
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle_answers: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_retries: Mapped[bool] = mapped_column(Boolean, default=True)
    max_retries: Mapped[int] = mapped_column(Integer, default=0)  # 0 = unlimited

    # Feedback settings
    show_correct_answer: Mapped[bool] = mapped_column(Boolean, default=True)
    show_explanation: Mapped[bool] = mapped_column(Boolean, default=True)
    show_distribution: Mapped[bool] = mapped_column(Boolean, default=False)

    # AI feature settings
    difficulty_adaptation: Mapped[bool] = mapped_column(Boolean, default=True)
    peer_discussion_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    peer_discussion_trigger: Mapped[str] = mapped_column(String(50), default="high_confidence_wrong")  # always, high_confidence_wrong, never

    # Live mode settings
    allow_teacher_intervention: Mapped[bool] = mapped_column(Boolean, default=True)
    sync_pacing_available: Mapped[bool] = mapped_column(Boolean, default=False)

    # Classroom/Course link
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("courses.id"), nullable=True)

    # Relationships
    questions: Mapped[List["QuizQuestion"]] = relationship(back_populates="quiz", cascade="all, delete-orphan", order_by="QuizQuestion.order")
    games: Mapped[List["GameSession"]] = relationship(back_populates="quiz", cascade="all, delete-orphan")
    course: Mapped[Optional["Course"]] = relationship()


class QuizQuestion(Base):
    """A question within a quiz."""
    __tablename__ = "quiz_questions"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    quiz_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("quizzes.id"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    # Question content
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(50), default="multiple_choice")  # multiple_choice, true_false
    options: Mapped[dict] = mapped_column(JSON, nullable=False)  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_answer: Mapped[str] = mapped_column(String(10), nullable=False)  # "A", "B", "C", "D"
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timing
    time_limit: Mapped[int] = mapped_column(Integer, default=20)  # seconds
    points: Mapped[int] = mapped_column(Integer, default=1000)  # base points
    
    # Media (optional)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Relationships
    quiz: Mapped["Quiz"] = relationship(back_populates="questions")


class GameSession(Base):
    """An active game instance - like a Kahoot game."""
    __tablename__ = "game_sessions"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    quiz_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("quizzes.id"), nullable=False)
    host_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    
    # Join code (6 characters like Kahoot)
    game_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, default=generate_game_code)
    
    # Game state
    status: Mapped[str] = mapped_column(String(20), default="lobby")  # lobby, playing, question, results, finished
    current_question_index: Mapped[int] = mapped_column(Integer, default=-1)  # -1 = lobby, 0+ = question index
    question_start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timer persistence (for server restart recovery)
    timer_end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    timer_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # original duration in seconds
    
    # Game Mode Settings
    sync_mode: Mapped[bool] = mapped_column(Boolean, default=True)  # True = synchronized (Kahoot-style), False = self-paced
    auto_advance: Mapped[bool] = mapped_column(Boolean, default=False)  # Auto-advance after timer ends (only for sync_mode)
    
    # Display Settings
    show_leaderboard_after_each: Mapped[bool] = mapped_column(Boolean, default=True)
    show_correct_answer: Mapped[bool] = mapped_column(Boolean, default=True)
    show_answer_distribution: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Game Customization
    randomize_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    randomize_answers: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_late_join: Mapped[bool] = mapped_column(Boolean, default=True)  # Allow joining after game starts
    require_nickname: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    quiz: Mapped["Quiz"] = relationship(back_populates="games")
    players: Mapped[List["Player"]] = relationship(back_populates="game", cascade="all, delete-orphan")


class Player(Base):
    """A participant in a game session."""
    __tablename__ = "players"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    game_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("game_sessions.id"), nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)  # Optional - can play as guest
    
    # Player info
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # emoji or avatar id
    
    # Scoring
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    game: Mapped["GameSession"] = relationship(back_populates="players")
    answers: Mapped[List["PlayerAnswer"]] = relationship(back_populates="player", cascade="all, delete-orphan")


class PlayerAnswer(Base):
    """An individual answer submission."""
    __tablename__ = "player_answers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    player_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("players.id"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("quiz_questions.id"), nullable=False)

    # Answer details
    answer: Mapped[str] = mapped_column(String(10), nullable=False)  # "A", "B", "C", "D"
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    response_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)  # milliseconds to answer
    points_earned: Mapped[int] = mapped_column(Integer, default=0)

    # Adaptive learning fields
    confidence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-100 confidence level
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Student's reasoning for answer

    # AI analysis fields
    misconception_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Misconception analysis from AI

    # Timestamp
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    player: Mapped["Player"] = relationship(back_populates="answers")

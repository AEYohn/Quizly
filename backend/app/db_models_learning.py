"""
Student Learning Database Models
Extended models for exit tickets, misconception tracking, and adaptive learning.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
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
    game_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)  # Reference to game session
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)

    # Target concept from session
    target_concept: Mapped[str] = mapped_column(String(255), nullable=False)
    session_accuracy: Mapped[float] = mapped_column(Float, default=0.0)  # Student's accuracy on this concept

    # Micro-lesson content
    micro_lesson: Mapped[str] = mapped_column(Text, nullable=False)
    encouragement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Follow-up question (primary - backwards compatibility)
    question_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    question_options: Mapped[dict] = mapped_column(JSON, default=list)  # ["A...", "B...", "C...", "D..."]
    correct_answer: Mapped[str] = mapped_column(String(10), nullable=False)
    hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Enhanced content - multiple practice questions
    practice_questions: Mapped[dict] = mapped_column(JSON, default=list)  # [{prompt, options, correct_answer, hint, explanation}]

    # Study notes - structured learning content
    study_notes: Mapped[dict] = mapped_column(JSON, default=dict)  # {key_concepts, common_mistakes, strategies, memory_tips}

    # Flashcards for key concepts
    flashcards: Mapped[dict] = mapped_column(JSON, default=list)  # [{front, back}]

    # Identified misconceptions
    misconceptions: Mapped[dict] = mapped_column(JSON, default=list)  # [{type, description, correction}]

    # Student's response to follow-up
    student_answer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    answered_correctly: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    student: Mapped[Optional["User"]] = relationship()
    session: Mapped[Optional["Session"]] = relationship(foreign_keys=[session_id])


class DetailedMisconception(Base):
    """
    Detailed misconception tracking with AI-generated analysis.
    Extends the basic StudentMisconception model with more detailed fields.
    """
    __tablename__ = "detailed_misconceptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    game_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)
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
    session: Mapped[Optional["Session"]] = relationship(foreign_keys=[session_id])
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


class PeerDiscussionSession(Base):
    """
    Track AI peer discussion sessions after wrong answers.
    Stores full transcript and AI-generated summary for both student and teacher review.

    Enhanced with adaptive discussion tracking:
    - Probing questions asked and depth
    - Hint usage (auto vs requested)
    - Misconception detection and resolution
    - Phase progression through discussion
    """
    __tablename__ = "peer_discussion_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    game_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)
    player_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)  # Player in game
    question_index: Mapped[int] = mapped_column(Integer, default=0)

    # Question context
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_options: Mapped[dict] = mapped_column(JSON, default=dict)
    correct_answer: Mapped[str] = mapped_column(String(10), nullable=False)

    # Student's position
    student_answer: Mapped[str] = mapped_column(String(10), nullable=False)
    student_confidence: Mapped[int] = mapped_column(Integer, default=50)
    student_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    was_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    # Peer info (AI or human)
    peer_type: Mapped[str] = mapped_column(String(20), default="ai")  # "ai" or "human"
    peer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    peer_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)

    # Full conversation transcript
    transcript: Mapped[dict] = mapped_column(JSON, default=list)  # [{sender, content, timestamp}]
    message_count: Mapped[int] = mapped_column(Integer, default=0)

    # AI-generated summary (generated when discussion ends)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_insights: Mapped[dict] = mapped_column(JSON, default=list)  # List of insight strings
    misconceptions_identified: Mapped[dict] = mapped_column(JSON, default=list)  # Specific misconceptions
    learning_moments: Mapped[dict] = mapped_column(JSON, default=list)  # Key learning points
    understanding_improved: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Outcome
    revealed_answer: Mapped[bool] = mapped_column(Boolean, default=False)
    discussion_quality: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # excellent, good, fair, poor

    # Status
    status: Mapped[str] = mapped_column(String(50), default="ongoing")  # ongoing, completed, abandoned

    # === NEW: Adaptive Discussion Tracking ===
    # Initial assessment
    error_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # conceptual, procedural, careless, overconfident
    probing_depth: Mapped[int] = mapped_column(Integer, default=3)  # 2-4 based on initial assessment

    # Probing phase tracking
    probing_questions_asked: Mapped[int] = mapped_column(Integer, default=0)

    # Hint tracking
    hints_given: Mapped[int] = mapped_column(Integer, default=0)  # Total hints (0-3)
    hints_auto: Mapped[int] = mapped_column(Integer, default=0)  # Auto-triggered hints
    hints_requested: Mapped[int] = mapped_column(Integer, default=0)  # Student-requested hints

    # Stuck detection
    stuck_count: Mapped[int] = mapped_column(Integer, default=0)  # Times student repeated same wrong idea
    stuck_recoveries: Mapped[int] = mapped_column(Integer, default=0)  # Times we changed approach

    # Misconception tracking
    misconceptions_detected: Mapped[dict] = mapped_column(JSON, default=list)  # [{type, description, evidence, resolved}]
    misconceptions_resolved: Mapped[int] = mapped_column(Integer, default=0)

    # Phase progression
    phases_visited: Mapped[dict] = mapped_column(JSON, default=list)  # ["probing", "hinting", "targeted", "explaining"]
    final_phase: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Student journey
    confusion_areas: Mapped[dict] = mapped_column(JSON, default=list)  # Areas where student showed confusion
    student_reasoning_points: Mapped[dict] = mapped_column(JSON, default=list)  # Key reasoning quotes

    # Metadata
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    student: Mapped[Optional["User"]] = relationship()


class DebateSession(Base):
    """
    Track AI peer discussion sessions after wrong answers.
    (Legacy model - kept for backwards compatibility)
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


class StudentAssignment(Base):
    """
    Practice assignments sent by teachers to specific students.
    Generated from insights when a student needs extra practice.
    """
    __tablename__ = "student_assignments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Teacher's personal note
    practice_questions: Mapped[dict] = mapped_column(JSON, default=list)  # [{prompt, options, correct_answer, explanation}]

    # Source context
    source_game_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)
    source_misconceptions: Mapped[dict] = mapped_column(JSON, default=list)  # What the student got wrong

    # Status
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, in_progress, completed
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Results (when completed)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_questions: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    answers: Mapped[dict] = mapped_column(JSON, default=list)  # Student's responses

    # Relationships
    teacher: Mapped[Optional["User"]] = relationship()


# Import User, Session, Question for type hints (avoiding circular imports)
from typing import TYPE_CHECKING  # noqa: E402
if TYPE_CHECKING:
    from .db_models import User, Session, Question

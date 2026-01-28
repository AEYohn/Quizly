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
    clerk_user_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)  # Clerk auth
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    courses: Mapped[List["Course"]] = relationship(back_populates="teacher")
    responses: Mapped[List["Response"]] = relationship(back_populates="student")
    study_items: Mapped[List["StudyItem"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Course(Base):
    """Canvas-style course with modules and lessons."""
    __tablename__ = "courses"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)  # For marketplace
    enrollment_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Join code for students
    tags: Mapped[dict] = mapped_column(JSON, default=list)
    difficulty_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    estimated_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fork_count: Mapped[int] = mapped_column(Integer, default=0)
    enrollment_count: Mapped[int] = mapped_column(Integer, default=0)
    forked_from_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("courses.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    # Relationships
    teacher: Mapped[Optional["User"]] = relationship(back_populates="courses")
    sessions: Mapped[List["Session"]] = relationship(back_populates="course")
    modules: Mapped[List["CourseModule"]] = relationship(back_populates="course", order_by="CourseModule.order_index")
    enrollments: Mapped[List["CourseEnrollment"]] = relationship(back_populates="course")


class CourseModule(Base):
    """Module within a course (like Canvas modules)."""
    __tablename__ = "course_modules"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    unlock_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Scheduled release
    prerequisites: Mapped[dict] = mapped_column(JSON, default=list)  # Module IDs that must be completed first
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    course: Mapped["Course"] = relationship(back_populates="modules")
    items: Mapped[List["ModuleItem"]] = relationship(back_populates="module", order_by="ModuleItem.order_index")


class ModuleItem(Base):
    """Item within a module (lesson, quiz, assignment, etc)."""
    __tablename__ = "module_items"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("course_modules.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)  # lesson, quiz, assignment, video, page
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Rich text content for lessons/pages
    video_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)  # Link to quiz session
    duration_mins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    points: Mapped[int] = mapped_column(Integer, default=0)  # For grading
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    module: Mapped["CourseModule"] = relationship(back_populates="items")
    session: Mapped[Optional["Session"]] = relationship()
    progress: Mapped[List["StudentProgress"]] = relationship(back_populates="item")


class CourseEnrollment(Base):
    """Student enrollment in a course."""
    __tablename__ = "course_enrollments"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), nullable=False)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)  # For anonymous students
    role: Mapped[str] = mapped_column(String(50), default="student")  # student, ta, observer
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    grade: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Final grade 0-100
    
    # Relationships
    course: Mapped["Course"] = relationship(back_populates="enrollments")
    student: Mapped[Optional["User"]] = relationship()


class StudentProgress(Base):
    """Track student progress on module items."""
    __tablename__ = "student_progress"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("module_items.id"), nullable=False)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="not_started")  # not_started, in_progress, completed
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # For quizzes/assignments
    time_spent_mins: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submission: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # For assignments
    
    # Relationships
    item: Mapped["ModuleItem"] = relationship(back_populates="progress")


class Session(Base):
    """Quiz session model - supports both live and async modes."""
    __tablename__ = "sessions"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("courses.id"), nullable=True)
    creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # For marketplace listing
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, active, completed
    mode: Mapped[str] = mapped_column(String(50), default="live")  # 'live' or 'async'
    current_question_index: Mapped[int] = mapped_column(Integer, default=0)
    objectives: Mapped[dict] = mapped_column(JSON, default=list)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Async mode settings
    allow_async: Mapped[bool] = mapped_column(Boolean, default=False)  # Can students take anytime?
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Deadline for async
    time_limit_mins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Time limit per attempt
    max_attempts: Mapped[int] = mapped_column(Integer, default=1)  # How many times can retry
    show_answers_after: Mapped[str] = mapped_column(String(50), default="submission")  # 'submission', 'due_date', 'never'
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Social/Marketplace fields
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)  # Visible in explore
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)  # Can be forked
    forked_from_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    fork_count: Mapped[int] = mapped_column(Integer, default=0)  # How many times forked
    play_count: Mapped[int] = mapped_column(Integer, default=0)  # Total times played
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[dict] = mapped_column(JSON, default=list)  # ["math", "algebra", "high-school"]
    difficulty_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # beginner, intermediate, advanced
    estimated_duration_mins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Relationships
    course: Mapped[Optional["Course"]] = relationship(back_populates="sessions")
    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[creator_id])
    forked_from: Mapped[Optional["Session"]] = relationship(remote_side=[id], foreign_keys=[forked_from_id])
    questions: Mapped[List["Question"]] = relationship(back_populates="session", order_by="Question.order_index")
    responses: Mapped[List["Response"]] = relationship(back_populates="session")
    participants: Mapped[List["SessionParticipant"]] = relationship(back_populates="session")
    likes: Mapped[List["SessionLike"]] = relationship(back_populates="session")


class SessionLike(Base):
    """Track likes on public sessions."""
    __tablename__ = "session_likes"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    session: Mapped["Session"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship()


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
    # Code question fields
    starter_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    test_cases: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # List of test cases for code questions
    language: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Programming language for code questions
    # Media fields
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Base64 or URL for question image
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


class CodingProblem(Base):
    """LeetCode-style coding problems for competitions."""
    __tablename__ = "coding_problems"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)  # Problem statement (markdown)
    difficulty: Mapped[str] = mapped_column(String(50), default="medium")  # easy, medium, hard
    subject: Mapped[str] = mapped_column(String(100), default="programming")  # programming, math, data-structures
    tags: Mapped[dict] = mapped_column(JSON, default=list)  # ["arrays", "dynamic-programming"]
    hints: Mapped[dict] = mapped_column(JSON, default=list)  # Progressive hints
    constraints: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Time/space constraints
    starter_code: Mapped[dict] = mapped_column(JSON, default=dict)  # {"python": "class Solution:...", "cpp": "class Solution {...}"}
    driver_code: Mapped[dict] = mapped_column(JSON, default=dict)  # {"python": "# parse input...", "cpp": "int main() {...}"} - Test harness
    solution_code: Mapped[dict] = mapped_column(JSON, default=dict)  # Teacher's solution
    function_name: Mapped[str] = mapped_column(String(100), default="solution")  # Method name to call
    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=300)  # 5 min default
    points: Mapped[int] = mapped_column(Integer, default=100)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    solve_count: Mapped[int] = mapped_column(Integer, default=0)  # How many solved it
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)  # How many attempted
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    session: Mapped[Optional["Session"]] = relationship()
    creator: Mapped[Optional["User"]] = relationship()
    test_cases: Mapped[List["TestCase"]] = relationship(back_populates="problem", order_by="TestCase.order_index")
    submissions: Mapped[List["CodeSubmission"]] = relationship(back_populates="problem")


class TestCase(Base):
    """Test cases for coding problems."""
    __tablename__ = "test_cases"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coding_problems.id"), nullable=False)
    input_data: Mapped[str] = mapped_column(Text, nullable=False)  # JSON or raw input
    expected_output: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Why this test case
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)  # Hidden from students
    is_example: Mapped[bool] = mapped_column(Boolean, default=False)  # Shown in problem description
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=10)  # Points for this test case
    
    # Relationships
    problem: Mapped["CodingProblem"] = relationship(back_populates="test_cases")


class CodeSubmission(Base):
    """Student code submissions."""
    __tablename__ = "code_submissions"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coding_problems.id"), nullable=False)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(50), nullable=False)  # python, javascript, java, cpp
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, running, accepted, wrong_answer, error, timeout
    test_results: Mapped[dict] = mapped_column(JSON, default=list)  # [{"passed": true, "time_ms": 50}, ...]
    tests_passed: Mapped[int] = mapped_column(Integer, default=0)
    tests_total: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[int] = mapped_column(Integer, default=0)  # Points earned
    execution_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    memory_used_kb: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    # Relationships
    problem: Mapped["CodingProblem"] = relationship(back_populates="submissions")
    student: Mapped[Optional["User"]] = relationship()


class Misconception(Base):
    """Track detected misconceptions from AI analysis."""
    __tablename__ = "misconceptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    question_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("questions.id"), nullable=True)
    creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)  # Teacher who owns this

    topic: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g., "Recursion"
    misconception: Mapped[str] = mapped_column(Text, nullable=False)  # The actual misconception
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Detailed explanation
    affected_count: Mapped[int] = mapped_column(Integer, default=0)  # Number of students affected
    total_count: Mapped[int] = mapped_column(Integer, default=0)  # Total students in that session
    severity: Mapped[str] = mapped_column(String(50), default="medium")  # high, medium, low
    common_wrong_answer: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    suggested_intervention: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # Still relevant?
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    session: Mapped[Optional["Session"]] = relationship()
    question: Mapped[Optional["Question"]] = relationship()
    creator: Mapped[Optional["User"]] = relationship()


class StudyItem(Base):
    """Base model for all student-created study content."""
    __tablename__ = "study_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # quiz, flashcard_deck, note, game
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(String(20), default="private")  # private, class, public
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual, ai, import

    # Stats
    times_studied: Mapped[int] = mapped_column(Integer, default=0)
    last_studied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="study_items")
    collection_items: Mapped[List["CollectionItem"]] = relationship(back_populates="study_item", cascade="all, delete-orphan")


class FlashcardDeck(Base):
    """Flashcard deck extending StudyItem."""
    __tablename__ = "flashcard_decks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_items.id", ondelete="CASCADE"), nullable=False, unique=True)
    study_mode: Mapped[str] = mapped_column(String(20), default="classic")  # classic, shuffle, spaced

    # Stats
    cards_mastered: Mapped[int] = mapped_column(Integer, default=0)
    cards_struggling: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    study_item: Mapped["StudyItem"] = relationship()
    cards: Mapped[List["Flashcard"]] = relationship(back_populates="deck", cascade="all, delete-orphan")


class Flashcard(Base):
    """Individual flashcard in a deck."""
    __tablename__ = "flashcards"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    deck_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("flashcard_decks.id", ondelete="CASCADE"), nullable=False)
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Spaced repetition
    mastery_level: Mapped[int] = mapped_column(Integer, default=0)  # 0-5
    next_review_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    deck: Mapped["FlashcardDeck"] = relationship(back_populates="cards")


class StudyNote(Base):
    """Study notes with rich markdown content."""
    __tablename__ = "study_notes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_items.id", ondelete="CASCADE"), nullable=False, unique=True)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    attachments: Mapped[Optional[List[dict]]] = mapped_column(JSON, default=list)  # [{url, type, name}]
    highlighted_terms: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)

    # Relationships
    study_item: Mapped["StudyItem"] = relationship()


# Import extended learning models to register them
from . import db_models_learning  # noqa


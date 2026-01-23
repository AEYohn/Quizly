"""
Pydantic Schemas for Quizly API
Request/Response models for all endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


# ==============================================================================
# Question Generation
# ==============================================================================

class ConceptInput(BaseModel):
    """Input for a single concept."""
    id: str = Field(..., description="Unique identifier for the concept")
    name: str = Field(..., description="Human-readable name")
    topics: List[str] = Field(default=[], description="Related subtopics")
    misconceptions: List[str] = Field(default=[], description="Common student misconceptions")


class QuestionGenerateRequest(BaseModel):
    """Request to generate questions for a topic."""
    topic: str = Field(..., description="Main topic for questions")
    concepts: List[ConceptInput] = Field(
        default=[], 
        description="List of concepts. If empty, will be auto-generated from topic"
    )
    num_questions: int = Field(default=4, ge=1, le=10, description="Number of questions")
    course_context: Optional[str] = Field(
        default=None, 
        description="Additional context about the course level"
    )
    question_type: str = Field(
        default="conceptual",
        description="Type: conceptual, application, analysis, or transfer"
    )
    target_misconception: Optional[str] = Field(
        default=None,
        description="Specific misconception to target for remediation"
    )


class QuestionOption(BaseModel):
    """A single multiple choice option."""
    label: str = Field(..., description="Option label (A, B, C, D)")
    text: str = Field(..., description="Option text")


class QuestionResponse(BaseModel):
    """Generated question response."""
    id: str
    concept: str
    difficulty: float
    prompt: str
    options: List[str]
    correct_answer: str
    explanation: str
    common_traps: List[str] = []
    question_type: Optional[str] = None
    target_misconception: Optional[str] = None
    misconception_trap_option: Optional[str] = None


class QuestionGenerateResponse(BaseModel):
    """Response containing generated questions."""
    topic: str
    questions: List[QuestionResponse]
    generated_at: datetime = Field(default_factory=utc_now)


# ==============================================================================
# Student Response Analysis
# ==============================================================================

class AnalyzeResponseRequest(BaseModel):
    """Request to analyze a student's response."""
    question: Dict[str, Any] = Field(..., description="The question that was asked")
    answer: str = Field(..., description="Student's selected answer (A, B, C, D)")
    reasoning: Optional[str] = Field(default=None, description="Student's explanation")
    confidence: int = Field(default=50, ge=0, le=100, description="Confidence 0-100")


class AnalyzeResponseResponse(BaseModel):
    """AI analysis of student response."""
    is_correct: bool
    reasoning_score: int = Field(ge=0, le=100, description="Quality of reasoning")
    strengths: List[str] = []
    misconceptions: List[str] = []
    tips: List[str] = []
    feedback_message: str


# ==============================================================================
# Peer Discussion
# ==============================================================================

class PeerDiscussionRequest(BaseModel):
    """Request for AI-generated peer perspective."""
    question: Dict[str, Any] = Field(..., description="The question")
    student_answer: str = Field(..., description="Student's answer")
    student_reasoning: Optional[str] = Field(default=None, description="Student's reasoning")


class PeerDiscussionResponse(BaseModel):
    """AI peer's perspective."""
    peer_name: str = Field(default="Alex", description="AI peer's name")
    peer_answer: str = Field(..., description="What the AI peer answered")
    peer_reasoning: str = Field(..., description="AI peer's reasoning")
    discussion_prompt: str = Field(..., description="Question for the student to consider")
    insight: str = Field(..., description="Key insight to share")


# ==============================================================================
# Conversational Discussion (Student + Teacher Replies)
# ==============================================================================

class DiscussionMessage(BaseModel):
    """A single message in a discussion thread."""
    role: str = Field(..., description="'student', 'peer', or 'teacher'")
    name: str = Field(..., description="Name of the speaker")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=utc_now)


class StudentReplyRequest(BaseModel):
    """Student's reply in a discussion."""
    question: Dict[str, Any] = Field(..., description="The original question")
    discussion_history: List[DiscussionMessage] = Field(
        default=[], 
        description="Previous messages in the discussion"
    )
    student_reply: str = Field(..., description="Student's reply message")
    student_name: str = Field(default="Student", description="Student's name")
    wants_to_change_answer: bool = Field(
        default=False, 
        description="Does the student want to change their answer?"
    )
    new_answer: Optional[str] = Field(
        default=None, 
        description="New answer if changing (A, B, C, D)"
    )


class TeacherInterventionRequest(BaseModel):
    """Teacher's intervention in a discussion."""
    question: Dict[str, Any] = Field(..., description="The original question")
    discussion_history: List[DiscussionMessage] = Field(
        default=[], 
        description="Previous messages in the discussion"
    )
    intervention_type: str = Field(
        default="hint",
        description="Type: 'hint', 'clarification', 'redirect', 'summary'"
    )
    teacher_message: Optional[str] = Field(
        default=None, 
        description="Optional custom teacher message"
    )
    teacher_name: str = Field(default="Instructor", description="Teacher's name")


class DiscussionContinueResponse(BaseModel):
    """AI's response continuing the discussion."""
    speaker_name: str = Field(..., description="Who is speaking")
    speaker_role: str = Field(..., description="'peer' or 'teacher_ai'")
    message: str = Field(..., description="The reply message")
    follow_up_question: Optional[str] = Field(
        default=None, 
        description="Optional follow-up question"
    )
    discussion_status: str = Field(
        default="ongoing",
        description="'ongoing', 'resolved', 'needs_teacher'"
    )
    learning_moment: Optional[str] = Field(
        default=None,
        description="Key learning point if discussion resolved"
    )


# ==============================================================================
# Exit Ticket
# ==============================================================================

class StudentResponseSummary(BaseModel):
    """Summary of a single student response."""
    question_prompt: str
    student_answer: str
    was_correct: bool
    concept: str


class ExitTicketRequest(BaseModel):
    """Request for personalized exit ticket."""
    student_name: str
    topic: str
    responses: List[StudentResponseSummary]


class ExitTicketResponse(BaseModel):
    """Personalized exit ticket."""
    student_name: str
    overall_score: int = Field(ge=0, le=100)
    strengths: List[str]
    areas_to_improve: List[str]
    micro_lesson: str = Field(..., description="Short lesson for weakest area")
    follow_up_question: Optional[Dict[str, Any]] = None


# ==============================================================================
# Session Management (Enhanced)
# ==============================================================================

# ==============================================================================
# Live Session Management
# ==============================================================================

class LiveSessionQuestion(BaseModel):
    """Question in a live session."""
    id: str
    concept: str = ""
    prompt: str
    options: List[str] = []
    correct_answer: str = ""
    difficulty: float = 0.5
    explanation: str = ""


class LiveSessionStartRequest(BaseModel):
    """Request to start a new live session."""
    topic: str = Field(..., description="Session topic")
    questions: List[Dict[str, Any]] = Field(..., description="Approved questions")
    objectives: List[str] = Field(default=[], description="Learning objectives")


class LiveSessionResponse(BaseModel):
    """Response for live session data."""
    session_id: str
    topic: str
    status: str = Field(description="Status: 'active', 'paused', 'completed'")
    questions: List[LiveSessionQuestion]
    current_question_index: int = 0
    student_count: int = 0
    started_at: datetime
    updated_at: datetime


class StudentJoinRequest(BaseModel):
    """Request for a student to join a session."""
    student_name: str = Field(..., description="Student's display name")


class StudentJoinResponse(BaseModel):
    """Response after joining a session."""
    session_id: str
    topic: str
    student_name: str
    num_questions: int
    current_question_index: int
    current_question: Optional[Dict[str, Any]] = None


class StudentSubmissionRequest(BaseModel):
    """Student's response submission."""
    student_name: str = Field(..., description="Student's name")
    question_id: str = Field(..., description="Question ID")
    answer: str = Field(..., description="Selected answer (A, B, C, D) or text")
    reasoning: Optional[str] = Field(default=None, description="Student's reasoning")
    confidence: int = Field(default=50, ge=0, le=100, description="Confidence level")
    response_type: str = Field(default="mcq", description="Type: mcq, code, image, text")
    code_submission: Optional[str] = Field(default=None, description="Code if response_type is 'code'")
    image_description: Optional[str] = Field(default=None, description="Image description if applicable")


class StudentSubmissionResponse(BaseModel):
    """Response after submitting an answer."""
    success: bool
    message: str
    submitted_at: datetime


class SessionStatusResponse(BaseModel):
    """Real-time session status."""
    session_id: str
    topic: str
    status: str
    current_question_index: int
    total_questions: int
    students_joined: List[str]
    responses_count: int
    last_updated: datetime


class ActiveSessionInfo(BaseModel):
    """Brief info about active session."""
    active: bool
    session_id: Optional[str] = None
    topic: Optional[str] = None
    num_questions: int = 0
    updated_at: Optional[datetime] = None


class SessionCreateWithAI(BaseModel):
    """Create session with AI-generated questions."""
    topic: str = Field(..., description="Session topic")
    concepts: Optional[List[ConceptInput]] = Field(
        default=None,
        description="Concepts to cover. If None, auto-generated from topic"
    )
    num_questions: int = Field(default=4, ge=1, le=10)


class TeachingActionRequest(BaseModel):
    """Request for teaching action on current question."""
    action: str = Field(
        ..., 
        description="Action to take: 'discuss', 'move_on', 'remediate'"
    )
    reason: Optional[str] = Field(default=None, description="Custom reason")


class PulseResponse(BaseModel):
    """Real-time class pulse metrics."""
    correctness_rate: float
    entropy: float
    avg_confidence: float
    recommended_action: str
    misconception_summary: Optional[str] = None


# ==============================================================================
# Curriculum / Material Processing
# ==============================================================================

class MaterialProcessRequest(BaseModel):
    """Request to process uploaded course materials."""
    text_content: Optional[str] = Field(
        default=None, 
        description="Pasted text content"
    )
    url: Optional[str] = Field(
        default=None, 
        description="URL to fetch content from"
    )
    # Note: File uploads handled via FastAPI's UploadFile


class ExtractedQuestion(BaseModel):
    """A question extracted from course materials."""
    prompt: str
    options: List[str] = []
    correct_answer: Optional[str] = None
    source: Optional[str] = None
    concept: Optional[str] = None


class MaterialProcessResponse(BaseModel):
    """Response after processing course materials."""
    status: str
    topic: str = Field(default="", description="Suggested topic from materials")
    concepts: List[str] = []
    objectives: List[str] = []
    extracted_questions: List[ExtractedQuestion] = []
    summary: str = ""
    documents_processed: int = 0


class CurriculumSetupRequest(BaseModel):
    """Full curriculum setup with topic, concepts, objectives."""
    topic: str = Field(..., description="Session topic")
    concepts: List[str] = Field(default=[], description="Key concepts")
    objectives: List[str] = Field(default=[], description="Learning objectives")
    materials_summary: Optional[str] = Field(
        default=None, 
        description="Summary from processed materials"
    )


class GenerateFromCurriculumRequest(BaseModel):
    """Generate questions from full curriculum setup."""
    topic: str
    concepts: List[str]
    objectives: List[str] = []
    num_questions: int = Field(default=4, ge=1, le=10)
    include_extracted: bool = Field(
        default=True,
        description="Include questions extracted from materials"
    )
    materials_context: Optional[str] = Field(
        default=None,
        description="Context from uploaded materials"
    )

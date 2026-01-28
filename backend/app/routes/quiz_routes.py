"""
Quiz Management Routes
CRUD operations for quizzes and questions.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth_clerk import get_current_user_clerk as get_current_user
from ..db_models import User
from ..models.game import Quiz, QuizQuestion, GameSession, Player, PlayerAnswer

router = APIRouter()


# ==============================================================================
# Schemas
# ==============================================================================

class QuestionCreate(BaseModel):
    question_text: str
    question_type: str = "multiple_choice"
    options: dict  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_answer: str
    explanation: Optional[str] = None
    time_limit: int = 20
    points: int = 1000
    image_url: Optional[str] = None


class QuestionResponse(BaseModel):
    id: str
    order: int
    question_text: str
    question_type: str
    options: dict
    correct_answer: str
    explanation: Optional[str]
    time_limit: int
    points: int
    image_url: Optional[str]

    class Config:
        from_attributes = True


class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    is_public: bool = False
    questions: List[QuestionCreate] = []

    # Async-first timing settings
    timer_enabled: bool = False
    default_time_limit: int = 30

    # Question behavior settings
    shuffle_questions: bool = False
    shuffle_answers: bool = False
    allow_retries: bool = True
    max_retries: int = 0  # 0 = unlimited

    # Feedback settings
    show_correct_answer: bool = True
    show_explanation: bool = True
    show_distribution: bool = False

    # AI feature settings
    difficulty_adaptation: bool = True
    peer_discussion_enabled: bool = True
    peer_discussion_trigger: str = "high_confidence_wrong"

    # Live mode settings
    allow_teacher_intervention: bool = True
    sync_pacing_available: bool = False


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    is_public: Optional[bool] = None
    course_id: Optional[str] = None  # Assign to classroom

    # Async-first timing settings
    timer_enabled: Optional[bool] = None
    default_time_limit: Optional[int] = None

    # Question behavior settings
    shuffle_questions: Optional[bool] = None
    shuffle_answers: Optional[bool] = None
    allow_retries: Optional[bool] = None
    max_retries: Optional[int] = None

    # Feedback settings
    show_correct_answer: Optional[bool] = None
    show_explanation: Optional[bool] = None
    show_distribution: Optional[bool] = None

    # AI feature settings
    difficulty_adaptation: Optional[bool] = None
    peer_discussion_enabled: Optional[bool] = None
    peer_discussion_trigger: Optional[str] = None

    # Live mode settings
    allow_teacher_intervention: Optional[bool] = None
    sync_pacing_available: Optional[bool] = None


class QuizResponse(BaseModel):
    id: str
    teacher_id: str
    title: str
    description: Optional[str]
    subject: Optional[str]
    is_public: bool
    question_count: int
    created_at: str
    updated_at: str
    course_id: Optional[str] = None  # Classroom ID

    # Game stats
    times_played: int = 0
    active_game_id: Optional[str] = None
    active_game_code: Optional[str] = None

    # Async-first timing settings
    timer_enabled: bool = False
    default_time_limit: int = 30

    # Question behavior settings
    shuffle_questions: bool = False
    shuffle_answers: bool = False
    allow_retries: bool = True
    max_retries: int = 0

    # Feedback settings
    show_correct_answer: bool = True
    show_explanation: bool = True
    show_distribution: bool = False

    # AI feature settings
    difficulty_adaptation: bool = True
    peer_discussion_enabled: bool = True
    peer_discussion_trigger: str = "high_confidence_wrong"

    # Live mode settings
    allow_teacher_intervention: bool = True
    sync_pacing_available: bool = False

    class Config:
        from_attributes = True


class QuizDetailResponse(QuizResponse):
    questions: List[QuestionResponse]


# ==============================================================================
# Quiz CRUD
# ==============================================================================

@router.post("", response_model=QuizResponse)
@router.post("/", response_model=QuizResponse, include_in_schema=False)
async def create_quiz(
    quiz_data: QuizCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new quiz with questions."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create quizzes")
    
    # Create quiz with all settings
    quiz = Quiz(
        teacher_id=current_user.id,
        title=quiz_data.title,
        description=quiz_data.description,
        subject=quiz_data.subject,
        is_public=quiz_data.is_public,
        # Async-first timing settings
        timer_enabled=quiz_data.timer_enabled,
        default_time_limit=quiz_data.default_time_limit,
        # Question behavior settings
        shuffle_questions=quiz_data.shuffle_questions,
        shuffle_answers=quiz_data.shuffle_answers,
        allow_retries=quiz_data.allow_retries,
        max_retries=quiz_data.max_retries,
        # Feedback settings
        show_correct_answer=quiz_data.show_correct_answer,
        show_explanation=quiz_data.show_explanation,
        show_distribution=quiz_data.show_distribution,
        # AI feature settings
        difficulty_adaptation=quiz_data.difficulty_adaptation,
        peer_discussion_enabled=quiz_data.peer_discussion_enabled,
        peer_discussion_trigger=quiz_data.peer_discussion_trigger,
        # Live mode settings
        allow_teacher_intervention=quiz_data.allow_teacher_intervention,
        sync_pacing_available=quiz_data.sync_pacing_available,
    )
    db.add(quiz)
    
    # Add questions
    for i, q in enumerate(quiz_data.questions):
        question = QuizQuestion(
            quiz=quiz,
            order=i,
            question_text=q.question_text,
            question_type=q.question_type,
            options=q.options,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            time_limit=q.time_limit,
            points=q.points,
            image_url=q.image_url
        )
        db.add(question)
    
    await db.commit()
    await db.refresh(quiz)
    
    return QuizResponse(
        id=str(quiz.id),
        teacher_id=str(quiz.teacher_id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        is_public=quiz.is_public,
        question_count=len(quiz_data.questions),
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat(),
        # Settings
        timer_enabled=quiz.timer_enabled,
        default_time_limit=quiz.default_time_limit,
        shuffle_questions=quiz.shuffle_questions,
        shuffle_answers=quiz.shuffle_answers,
        allow_retries=quiz.allow_retries,
        max_retries=quiz.max_retries,
        show_correct_answer=quiz.show_correct_answer,
        show_explanation=quiz.show_explanation,
        show_distribution=quiz.show_distribution,
        difficulty_adaptation=quiz.difficulty_adaptation,
        peer_discussion_enabled=quiz.peer_discussion_enabled,
        peer_discussion_trigger=quiz.peer_discussion_trigger,
        allow_teacher_intervention=quiz.allow_teacher_intervention,
        sync_pacing_available=quiz.sync_pacing_available,
    )


@router.get("", response_model=List[QuizResponse])
@router.get("/", response_model=List[QuizResponse], include_in_schema=False)
async def list_quizzes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    course_id: Optional[UUID] = Query(None, description="Filter by classroom/course ID")
):
    """List quizzes - teachers see their own, can also see public ones."""
    # Build query with optional course_id filter
    query = select(Quiz).options(
        selectinload(Quiz.questions),
        selectinload(Quiz.games).selectinload(GameSession.players)
    ).where(Quiz.teacher_id == current_user.id)

    if course_id:
        query = query.where(Quiz.course_id == course_id)

    query = query.order_by(Quiz.updated_at.desc())
    result = await db.execute(query)
    quizzes = result.scalars().all()

    responses = []
    for q in quizzes:
        # Count games and find most recent active game
        games = getattr(q, 'games', []) or []
        times_played = len(games)
        active_game = None

        # Find the best game to show (prioritize games with players, then most recent)
        if games:
            # Sort by: 1) player count (descending), 2) created_at (descending)
            sorted_games = sorted(
                games,
                key=lambda g: (len(g.players) if hasattr(g, 'players') and g.players else 0, g.created_at),
                reverse=True
            )
            # Prefer non-finished games with the most players
            active_games = [g for g in sorted_games if g.status != "finished"]
            active_game = active_games[0] if active_games else sorted_games[0]

        responses.append(QuizResponse(
            id=str(q.id),
            teacher_id=str(q.teacher_id),
            title=q.title,
            description=q.description,
            subject=q.subject,
            is_public=q.is_public,
            question_count=len(q.questions),
            created_at=q.created_at.isoformat(),
            updated_at=q.updated_at.isoformat(),
            course_id=str(q.course_id) if q.course_id else None,
            times_played=times_played,
            active_game_id=str(active_game.id) if active_game else None,
            active_game_code=active_game.game_code if active_game else None,
            timer_enabled=getattr(q, 'timer_enabled', False),
            default_time_limit=getattr(q, 'default_time_limit', 30),
            shuffle_questions=getattr(q, 'shuffle_questions', False),
            shuffle_answers=getattr(q, 'shuffle_answers', False),
            allow_retries=getattr(q, 'allow_retries', True),
            max_retries=getattr(q, 'max_retries', 0),
            show_correct_answer=getattr(q, 'show_correct_answer', True),
            show_explanation=getattr(q, 'show_explanation', True),
            show_distribution=getattr(q, 'show_distribution', False),
            difficulty_adaptation=getattr(q, 'difficulty_adaptation', True),
            peer_discussion_enabled=getattr(q, 'peer_discussion_enabled', True),
            peer_discussion_trigger=getattr(q, 'peer_discussion_trigger', 'high_confidence_wrong'),
            allow_teacher_intervention=getattr(q, 'allow_teacher_intervention', True),
            sync_pacing_available=getattr(q, 'sync_pacing_available', False),
        ))

    return responses


@router.get("/{quiz_id}/games")
async def list_quiz_games(
    quiz_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all game sessions for a quiz (game history)."""
    from app.models.game import GameSession

    # Verify quiz ownership
    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.teacher_id == current_user.id)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Get all games for this quiz with player counts
    result = await db.execute(
        select(GameSession)
        .options(selectinload(GameSession.players))
        .where(GameSession.quiz_id == quiz_id)
        .order_by(GameSession.created_at.desc())
    )
    games = result.scalars().all()

    return [
        {
            "id": str(g.id),
            "game_code": g.game_code,
            "status": g.status,
            "player_count": len(g.players) if g.players else 0,
            "created_at": g.created_at.isoformat(),
            "sync_mode": g.sync_mode,
        }
        for g in games
    ]


@router.get("/public", response_model=List[QuizResponse])
async def list_public_quizzes(
    db: AsyncSession = Depends(get_db)
):
    """List all public quizzes."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.is_public == True)
        .order_by(Quiz.updated_at.desc())
        .limit(50)
    )
    quizzes = result.scalars().all()

    return [
        QuizResponse(
            id=str(q.id),
            teacher_id=str(q.teacher_id),
            title=q.title,
            description=q.description,
            subject=q.subject,
            is_public=q.is_public,
            question_count=len(q.questions),
            created_at=q.created_at.isoformat(),
            updated_at=q.updated_at.isoformat(),
            timer_enabled=getattr(q, 'timer_enabled', False),
            default_time_limit=getattr(q, 'default_time_limit', 30),
            shuffle_questions=getattr(q, 'shuffle_questions', False),
            shuffle_answers=getattr(q, 'shuffle_answers', False),
            allow_retries=getattr(q, 'allow_retries', True),
            max_retries=getattr(q, 'max_retries', 0),
            show_correct_answer=getattr(q, 'show_correct_answer', True),
            show_explanation=getattr(q, 'show_explanation', True),
            show_distribution=getattr(q, 'show_distribution', False),
            difficulty_adaptation=getattr(q, 'difficulty_adaptation', True),
            peer_discussion_enabled=getattr(q, 'peer_discussion_enabled', True),
            peer_discussion_trigger=getattr(q, 'peer_discussion_trigger', 'high_confidence_wrong'),
            allow_teacher_intervention=getattr(q, 'allow_teacher_intervention', True),
            sync_pacing_available=getattr(q, 'sync_pacing_available', False),
        )
        for q in quizzes
    ]


@router.get("/public/{quiz_id}", response_model=QuizDetailResponse)
async def get_public_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a public quiz by ID for guest access.
    No authentication required - returns quiz only if is_public=true.
    """
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id, Quiz.is_public == True)
    )
    quiz = result.scalars().first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or not public")

    return QuizDetailResponse(
        id=str(quiz.id),
        teacher_id=str(quiz.teacher_id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        is_public=quiz.is_public,
        question_count=len(quiz.questions),
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat(),
        timer_enabled=getattr(quiz, 'timer_enabled', False),
        default_time_limit=getattr(quiz, 'default_time_limit', 30),
        shuffle_questions=getattr(quiz, 'shuffle_questions', False),
        shuffle_answers=getattr(quiz, 'shuffle_answers', False),
        allow_retries=getattr(quiz, 'allow_retries', True),
        max_retries=getattr(quiz, 'max_retries', 0),
        show_correct_answer=getattr(quiz, 'show_correct_answer', True),
        show_explanation=getattr(quiz, 'show_explanation', True),
        show_distribution=getattr(quiz, 'show_distribution', False),
        difficulty_adaptation=getattr(quiz, 'difficulty_adaptation', True),
        peer_discussion_enabled=getattr(quiz, 'peer_discussion_enabled', True),
        peer_discussion_trigger=getattr(quiz, 'peer_discussion_trigger', 'high_confidence_wrong'),
        allow_teacher_intervention=getattr(quiz, 'allow_teacher_intervention', True),
        sync_pacing_available=getattr(quiz, 'sync_pacing_available', False),
        questions=[
            QuestionResponse(
                id=str(q.id),
                order=q.order,
                question_text=q.question_text,
                question_type=q.question_type,
                options=q.options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                time_limit=q.time_limit,
                points=q.points,
                image_url=q.image_url
            )
            for q in sorted(quiz.questions, key=lambda x: x.order)
        ]
    )


@router.get("/{quiz_id}", response_model=QuizDetailResponse)
async def get_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get quiz details with all questions."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Check access
    if quiz.teacher_id != current_user.id and not quiz.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return QuizDetailResponse(
        id=str(quiz.id),
        teacher_id=str(quiz.teacher_id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        is_public=quiz.is_public,
        question_count=len(quiz.questions),
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat(),
        timer_enabled=getattr(quiz, 'timer_enabled', False),
        default_time_limit=getattr(quiz, 'default_time_limit', 30),
        shuffle_questions=getattr(quiz, 'shuffle_questions', False),
        shuffle_answers=getattr(quiz, 'shuffle_answers', False),
        allow_retries=getattr(quiz, 'allow_retries', True),
        max_retries=getattr(quiz, 'max_retries', 0),
        show_correct_answer=getattr(quiz, 'show_correct_answer', True),
        show_explanation=getattr(quiz, 'show_explanation', True),
        show_distribution=getattr(quiz, 'show_distribution', False),
        difficulty_adaptation=getattr(quiz, 'difficulty_adaptation', True),
        peer_discussion_enabled=getattr(quiz, 'peer_discussion_enabled', True),
        peer_discussion_trigger=getattr(quiz, 'peer_discussion_trigger', 'high_confidence_wrong'),
        allow_teacher_intervention=getattr(quiz, 'allow_teacher_intervention', True),
        sync_pacing_available=getattr(quiz, 'sync_pacing_available', False),
        questions=[
            QuestionResponse(
                id=str(q.id),
                order=q.order,
                question_text=q.question_text,
                question_type=q.question_type,
                options=q.options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                time_limit=q.time_limit,
                points=q.points,
                image_url=q.image_url
            )
            for q in sorted(quiz.questions, key=lambda x: x.order)
        ]
    )


@router.put("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: UUID,
    quiz_data: QuizUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update quiz metadata."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can update it")
    
    # Update fields
    if quiz_data.title is not None:
        quiz.title = quiz_data.title
    if quiz_data.description is not None:
        quiz.description = quiz_data.description
    if quiz_data.subject is not None:
        quiz.subject = quiz_data.subject
    if quiz_data.is_public is not None:
        quiz.is_public = quiz_data.is_public
    if quiz_data.course_id is not None:
        quiz.course_id = UUID(quiz_data.course_id) if quiz_data.course_id else None
    # Update settings
    if quiz_data.timer_enabled is not None:
        quiz.timer_enabled = quiz_data.timer_enabled
    if quiz_data.default_time_limit is not None:
        quiz.default_time_limit = quiz_data.default_time_limit
    if quiz_data.shuffle_questions is not None:
        quiz.shuffle_questions = quiz_data.shuffle_questions
    if quiz_data.shuffle_answers is not None:
        quiz.shuffle_answers = quiz_data.shuffle_answers
    if quiz_data.allow_retries is not None:
        quiz.allow_retries = quiz_data.allow_retries
    if quiz_data.max_retries is not None:
        quiz.max_retries = quiz_data.max_retries
    if quiz_data.show_correct_answer is not None:
        quiz.show_correct_answer = quiz_data.show_correct_answer
    if quiz_data.show_explanation is not None:
        quiz.show_explanation = quiz_data.show_explanation
    if quiz_data.show_distribution is not None:
        quiz.show_distribution = quiz_data.show_distribution
    if quiz_data.difficulty_adaptation is not None:
        quiz.difficulty_adaptation = quiz_data.difficulty_adaptation
    if quiz_data.peer_discussion_enabled is not None:
        quiz.peer_discussion_enabled = quiz_data.peer_discussion_enabled
    if quiz_data.peer_discussion_trigger is not None:
        quiz.peer_discussion_trigger = quiz_data.peer_discussion_trigger
    if quiz_data.allow_teacher_intervention is not None:
        quiz.allow_teacher_intervention = quiz_data.allow_teacher_intervention
    if quiz_data.sync_pacing_available is not None:
        quiz.sync_pacing_available = quiz_data.sync_pacing_available

    await db.commit()
    await db.refresh(quiz)

    return QuizResponse(
        id=str(quiz.id),
        teacher_id=str(quiz.teacher_id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        is_public=quiz.is_public,
        question_count=len(quiz.questions),
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat(),
        course_id=str(quiz.course_id) if quiz.course_id else None,
        timer_enabled=getattr(quiz, 'timer_enabled', False),
        default_time_limit=getattr(quiz, 'default_time_limit', 30),
        shuffle_questions=getattr(quiz, 'shuffle_questions', False),
        shuffle_answers=getattr(quiz, 'shuffle_answers', False),
        allow_retries=getattr(quiz, 'allow_retries', True),
        max_retries=getattr(quiz, 'max_retries', 0),
        show_correct_answer=getattr(quiz, 'show_correct_answer', True),
        show_explanation=getattr(quiz, 'show_explanation', True),
        show_distribution=getattr(quiz, 'show_distribution', False),
        difficulty_adaptation=getattr(quiz, 'difficulty_adaptation', True),
        peer_discussion_enabled=getattr(quiz, 'peer_discussion_enabled', True),
        peer_discussion_trigger=getattr(quiz, 'peer_discussion_trigger', 'high_confidence_wrong'),
        allow_teacher_intervention=getattr(quiz, 'allow_teacher_intervention', True),
        sync_pacing_available=getattr(quiz, 'sync_pacing_available', False),
    )


@router.post("/{quiz_id}/duplicate", response_model=QuizResponse)
async def duplicate_quiz(
    quiz_id: UUID,
    target_course_id: Optional[UUID] = Query(None, description="Assign duplicate to this classroom"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Duplicate a quiz with all its questions."""
    # Fetch original quiz with questions
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    original = result.scalars().first()

    if not original:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check access - must own the quiz or it must be public
    if original.teacher_id != current_user.id and not original.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    # Create new quiz with "(Copy)" suffix
    new_quiz = Quiz(
        teacher_id=current_user.id,
        title=f"{original.title} (Copy)",
        description=original.description,
        subject=original.subject,
        is_public=False,  # New copy is private by default
        course_id=target_course_id,
        timer_enabled=original.timer_enabled,
        default_time_limit=original.default_time_limit,
        shuffle_questions=original.shuffle_questions,
        shuffle_answers=original.shuffle_answers,
        allow_retries=original.allow_retries,
        max_retries=original.max_retries,
        show_correct_answer=original.show_correct_answer,
        show_explanation=original.show_explanation,
        show_distribution=original.show_distribution,
        difficulty_adaptation=original.difficulty_adaptation,
        peer_discussion_enabled=original.peer_discussion_enabled,
        peer_discussion_trigger=original.peer_discussion_trigger,
        allow_teacher_intervention=original.allow_teacher_intervention,
        sync_pacing_available=original.sync_pacing_available,
    )
    db.add(new_quiz)
    await db.flush()

    # Copy all questions
    for q in sorted(original.questions, key=lambda x: x.order):
        new_question = QuizQuestion(
            quiz_id=new_quiz.id,
            order=q.order,
            question_text=q.question_text,
            question_type=q.question_type,
            options=q.options,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            time_limit=q.time_limit,
            points=q.points,
            image_url=q.image_url
        )
        db.add(new_question)

    await db.commit()
    await db.refresh(new_quiz)

    return QuizResponse(
        id=str(new_quiz.id),
        teacher_id=str(new_quiz.teacher_id),
        title=new_quiz.title,
        description=new_quiz.description,
        subject=new_quiz.subject,
        is_public=new_quiz.is_public,
        question_count=len(original.questions),
        created_at=new_quiz.created_at.isoformat(),
        updated_at=new_quiz.updated_at.isoformat(),
        course_id=str(new_quiz.course_id) if new_quiz.course_id else None,
        timer_enabled=new_quiz.timer_enabled,
        default_time_limit=new_quiz.default_time_limit,
        shuffle_questions=new_quiz.shuffle_questions,
        shuffle_answers=new_quiz.shuffle_answers,
        allow_retries=new_quiz.allow_retries,
        max_retries=new_quiz.max_retries,
        show_correct_answer=new_quiz.show_correct_answer,
        show_explanation=new_quiz.show_explanation,
        show_distribution=new_quiz.show_distribution,
        difficulty_adaptation=new_quiz.difficulty_adaptation,
        peer_discussion_enabled=new_quiz.peer_discussion_enabled,
        peer_discussion_trigger=new_quiz.peer_discussion_trigger,
        allow_teacher_intervention=new_quiz.allow_teacher_intervention,
        sync_pacing_available=new_quiz.sync_pacing_available,
    )


@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a quiz and all related data."""
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalars().first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can delete it")

    # Get all question IDs for this quiz
    questions_result = await db.execute(
        select(QuizQuestion.id).where(QuizQuestion.quiz_id == quiz_id)
    )
    question_ids = [q[0] for q in questions_result.fetchall()]

    # Delete player_answers that reference these questions first
    if question_ids:
        await db.execute(
            delete(PlayerAnswer).where(PlayerAnswer.question_id.in_(question_ids))
        )

    # Get all game sessions for this quiz
    games_result = await db.execute(
        select(GameSession.id).where(GameSession.quiz_id == quiz_id)
    )
    game_ids = [g[0] for g in games_result.fetchall()]

    # Get all players for these games
    if game_ids:
        players_result = await db.execute(
            select(Player.id).where(Player.game_id.in_(game_ids))
        )
        player_ids = [p[0] for p in players_result.fetchall()]

        # Delete remaining player_answers by player
        if player_ids:
            await db.execute(
                delete(PlayerAnswer).where(PlayerAnswer.player_id.in_(player_ids))
            )

        # Delete players
        await db.execute(
            delete(Player).where(Player.game_id.in_(game_ids))
        )

        # Delete game sessions
        await db.execute(
            delete(GameSession).where(GameSession.quiz_id == quiz_id)
        )

    # Delete quiz questions
    await db.execute(
        delete(QuizQuestion).where(QuizQuestion.quiz_id == quiz_id)
    )

    # Finally delete the quiz
    await db.delete(quiz)
    await db.commit()

    return {"message": "Quiz deleted"}


# ==============================================================================
# Question Management
# ==============================================================================

@router.post("/{quiz_id}/questions", response_model=QuestionResponse)
async def add_question(
    quiz_id: UUID,
    question_data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a question to a quiz."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can add questions")
    
    # Get next order
    next_order = len(quiz.questions)
    
    question = QuizQuestion(
        quiz_id=quiz_id,
        order=next_order,
        question_text=question_data.question_text,
        question_type=question_data.question_type,
        options=question_data.options,
        correct_answer=question_data.correct_answer,
        explanation=question_data.explanation,
        time_limit=question_data.time_limit,
        points=question_data.points,
        image_url=question_data.image_url
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    
    return QuestionResponse(
        id=str(question.id),
        order=question.order,
        question_text=question.question_text,
        question_type=question.question_type,
        options=question.options,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
        time_limit=question.time_limit,
        points=question.points,
        image_url=question.image_url
    )


@router.put("/{quiz_id}/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    quiz_id: UUID,
    question_id: UUID,
    question_data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a question."""
    # Verify quiz ownership
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can update questions")
    
    # Get question
    result = await db.execute(
        select(QuizQuestion).where(
            QuizQuestion.id == question_id,
            QuizQuestion.quiz_id == quiz_id
        )
    )
    question = result.scalars().first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Update
    question.question_text = question_data.question_text
    question.question_type = question_data.question_type
    question.options = question_data.options
    question.correct_answer = question_data.correct_answer
    question.explanation = question_data.explanation
    question.time_limit = question_data.time_limit
    question.points = question_data.points
    question.image_url = question_data.image_url
    
    await db.commit()
    await db.refresh(question)
    
    return QuestionResponse(
        id=str(question.id),
        order=question.order,
        question_text=question.question_text,
        question_type=question.question_type,
        options=question.options,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
        time_limit=question.time_limit,
        points=question.points,
        image_url=question.image_url
    )


@router.delete("/{quiz_id}/questions/{question_id}")
async def delete_question(
    quiz_id: UUID,
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a question from a quiz."""
    # Verify quiz ownership
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can delete questions")
    
    # Get question
    result = await db.execute(
        select(QuizQuestion).where(
            QuizQuestion.id == question_id,
            QuizQuestion.quiz_id == quiz_id
        )
    )
    question = result.scalars().first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    await db.delete(question)
    await db.commit()
    
    return {"message": "Question deleted"}


# ==============================================================================
# Export Functions
# ==============================================================================

def generate_quiz_markdown(quiz: Quiz, include_answers: bool = True) -> str:
    """Generate a markdown study guide from a quiz."""
    lines = [
        f"# {quiz.title}",
        "",
    ]
    
    if quiz.description:
        lines.extend([quiz.description, ""])
    
    if quiz.subject:
        lines.extend([f"**Subject:** {quiz.subject}", ""])
    
    lines.extend([
        f"**Total Questions:** {len(quiz.questions)}",
        f"**Created:** {quiz.created_at.strftime('%Y-%m-%d')}",
        "",
        "---",
        ""
    ])
    
    questions = sorted(quiz.questions, key=lambda q: q.order)
    
    for i, q in enumerate(questions, 1):
        lines.extend([
            f"## Question {i}",
            "",
            q.question_text,
            ""
        ])
        
        # Options
        if q.options:
            lines.append("**Options:**")
            for key in sorted(q.options.keys()):
                lines.append(f"- **{key})** {q.options[key]}")
            lines.append("")
        
        if include_answers:
            lines.extend([
                f"**Correct Answer:** {q.correct_answer}",
                ""
            ])
            if q.explanation:
                lines.extend([
                    "**Explanation:**",
                    f"> {q.explanation}",
                    ""
                ])
        
        lines.extend(["---", ""])
    
    return "\n".join(lines)


def generate_quiz_json_export(quiz: Quiz, include_answers: bool = True) -> dict:
    """Generate JSON export of a quiz."""
    questions = sorted(quiz.questions, key=lambda q: q.order)
    
    export_data = {
        "title": quiz.title,
        "description": quiz.description,
        "subject": quiz.subject,
        "created_at": quiz.created_at.isoformat(),
        "question_count": len(questions),
        "questions": []
    }
    
    for i, q in enumerate(questions, 1):
        q_data = {
            "number": i,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "time_limit": q.time_limit,
            "points": q.points,
        }
        if include_answers:
            q_data["correct_answer"] = q.correct_answer
            q_data["explanation"] = q.explanation
        export_data["questions"].append(q_data)
    
    return export_data


@router.get("/{quiz_id}/export")
async def export_quiz(
    quiz_id: UUID,
    format: str = Query("md", description="Export format: md (markdown), json, or study (student-friendly, no answers)"),
    include_answers: bool = Query(True, description="Include correct answers and explanations"),
    db: AsyncSession = Depends(get_db)
):
    """
    Export a quiz in various formats.
    
    **Formats:**
    - `md` - Markdown study guide (default)
    - `json` - JSON data for reimporting or processing
    - `study` - Student study guide (markdown, no answers shown during first pass)
    
    **Query Parameters:**
    - `include_answers` - Include answers and explanations (default: true, set false for blank quiz)
    
    No authentication required for public quizzes.
    """
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if format == "study":
        # Student study mode: questions only, answers at the end
        content = generate_study_guide(quiz)
        return PlainTextResponse(
            content=content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="{quiz.title}_study_guide.md"'
            }
        )
    elif format == "json":
        export_data = generate_quiz_json_export(quiz, include_answers)
        return JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f'attachment; filename="{quiz.title}_export.json"'
            }
        )
    else:  # md (default)
        content = generate_quiz_markdown(quiz, include_answers)
        return PlainTextResponse(
            content=content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="{quiz.title}.md"'
            }
        )


def generate_study_guide(quiz: Quiz) -> str:
    """
    Generate a student-friendly study guide.
    Questions first, answers section at the end.
    """
    lines = [
        f"# 📚 Study Guide: {quiz.title}",
        "",
    ]
    
    if quiz.description:
        lines.extend([f"*{quiz.description}*", ""])
    
    if quiz.subject:
        lines.extend([f"**Subject:** {quiz.subject}", ""])
    
    questions = sorted(quiz.questions, key=lambda q: q.order)
    
    lines.extend([
        f"**Total Questions:** {len(questions)}",
        "",
        "---",
        "",
        "# Part 1: Questions",
        "",
        "*Try to answer these questions before checking the answer key below!*",
        ""
    ])
    
    # Questions section (no answers)
    for i, q in enumerate(questions, 1):
        lines.extend([
            f"### Question {i}",
            "",
            q.question_text,
            ""
        ])
        
        if q.options:
            for key in sorted(q.options.keys()):
                lines.append(f"- [ ] **{key})** {q.options[key]}")
            lines.append("")
        
        lines.append("")
    
    # Answer key section
    lines.extend([
        "---",
        "",
        "# Part 2: Answer Key",
        "",
        "*Scroll down only after attempting all questions!*",
        "",
        "<br><br><br><br><br>",  # Space to prevent accidental spoilers
        ""
    ])
    
    for i, q in enumerate(questions, 1):
        lines.extend([
            f"### Question {i} - Answer",
            "",
            f"**Correct Answer:** {q.correct_answer}",
            ""
        ])
        
        if q.options and q.correct_answer in q.options:
            lines.append(f"**{q.correct_answer})** {q.options[q.correct_answer]}")
            lines.append("")
        
        if q.explanation:
            lines.extend([
                "**Explanation:**",
                f"> {q.explanation}",
                ""
            ])
        
        lines.append("")
    
    lines.extend([
        "---",
        "",
        f"*Generated by Quizly on {datetime.utcnow().strftime('%Y-%m-%d')}*"
    ])
    
    return "\n".join(lines)

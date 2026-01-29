"""
Student Quiz Routes
Self-study quiz creation and practice for students.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth_clerk import get_current_user_clerk
from ..db_models import User
from ..models.game import Quiz, QuizQuestion, GameSession, Player, PlayerAnswer

router = APIRouter()


# ==============================================================================
# Schemas
# ==============================================================================

class StudentQuestionCreate(BaseModel):
    question_text: str
    question_type: str = "multiple_choice"
    options: dict  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_answer: str
    explanation: Optional[str] = None
    time_limit: int = 30
    points: int = 100


class StudentQuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    questions: List[StudentQuestionCreate] = []
    # Self-study specific settings
    shuffle_questions: bool = False
    shuffle_answers: bool = False
    show_correct_answer: bool = True
    show_explanation: bool = True
    is_public: bool = False  # Share with other students


class StudentQuestionUpdate(BaseModel):
    id: Optional[str] = None  # Existing question ID (None for new questions)
    question_text: str
    question_type: str = "multiple_choice"
    options: dict
    correct_answer: str
    explanation: Optional[str] = None
    time_limit: int = 30
    points: int = 100


class StudentQuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    questions: Optional[List[StudentQuestionUpdate]] = None
    shuffle_questions: Optional[bool] = None
    shuffle_answers: Optional[bool] = None
    show_correct_answer: Optional[bool] = None
    show_explanation: Optional[bool] = None
    is_public: Optional[bool] = None  # Share with other students


class StudentQuizResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    subject: Optional[str]
    question_count: int
    quiz_type: str
    is_public: bool = False
    created_at: str
    updated_at: str
    # Practice stats
    times_practiced: int = 0
    best_score: Optional[float] = None
    last_practiced: Optional[str] = None


class QuestionResponse(BaseModel):
    id: str
    order: int
    question_text: str
    question_type: str
    options: dict
    correct_answer: Optional[str] = None  # Hidden during practice, shown after
    explanation: Optional[str] = None
    time_limit: int
    points: int

    class Config:
        from_attributes = True


class StudentQuizDetailResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    subject: Optional[str]
    quiz_type: str
    created_at: str
    updated_at: str
    questions: List[QuestionResponse]
    # Settings
    shuffle_questions: bool
    shuffle_answers: bool
    show_correct_answer: bool
    show_explanation: bool
    # Stats
    times_practiced: int = 0
    best_score: Optional[float] = None


class PracticeSessionCreate(BaseModel):
    """Start a practice session."""
    pass  # No special params needed for now


class PracticeSessionResponse(BaseModel):
    session_id: str
    quiz_id: str
    quiz_title: str
    total_questions: int
    started_at: str


class AnswerSubmit(BaseModel):
    question_id: str
    answer: str
    confidence: Optional[int] = None  # 0-100
    reasoning: Optional[str] = None
    response_time_ms: int = 0


class AnswerResult(BaseModel):
    question_id: str
    is_correct: bool
    correct_answer: str
    explanation: Optional[str]
    points_earned: int


class PracticeResultResponse(BaseModel):
    session_id: str
    quiz_title: str
    total_questions: int
    correct_answers: int
    score_percentage: float
    total_points: int
    time_taken_seconds: int
    answers: List[dict]  # Detailed answer breakdown
    completed_at: str


# ==============================================================================
# Routes
# ==============================================================================

@router.get("/quizzes", response_model=List[StudentQuizResponse])
async def list_student_quizzes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    List all self-study quizzes created by the current student.

    GET /student/quizzes
    """
    result = await db.execute(
        select(Quiz)
        .where(Quiz.teacher_id == current_user.id)
        .where(Quiz.quiz_type == "self_study")
        .options(selectinload(Quiz.questions))
        .order_by(Quiz.updated_at.desc())
    )
    quizzes = result.scalars().all()

    response = []
    for quiz in quizzes:
        # Get practice stats
        games_result = await db.execute(
            select(GameSession)
            .where(GameSession.quiz_id == quiz.id)
            .where(GameSession.status == "finished")
        )
        finished_games = games_result.scalars().all()

        best_score = None
        last_practiced = None
        if finished_games:
            # Calculate best score from finished games
            for game in finished_games:
                players_result = await db.execute(
                    select(Player).where(Player.game_id == game.id)
                )
                players = players_result.scalars().all()
                for player in players:
                    if player.user_id == current_user.id:
                        total_questions = len(quiz.questions)
                        if total_questions > 0:
                            score_pct = (player.correct_answers / total_questions) * 100
                            if best_score is None or score_pct > best_score:
                                best_score = score_pct
                        if last_practiced is None or game.ended_at > datetime.fromisoformat(last_practiced.replace('Z', '+00:00')):
                            last_practiced = game.ended_at.isoformat() if game.ended_at else None

        response.append(StudentQuizResponse(
            id=str(quiz.id),
            title=quiz.title,
            description=quiz.description,
            subject=quiz.subject,
            question_count=len(quiz.questions),
            quiz_type=quiz.quiz_type,
            is_public=quiz.is_public,
            created_at=quiz.created_at.isoformat(),
            updated_at=quiz.updated_at.isoformat(),
            times_practiced=len(finished_games),
            best_score=best_score,
            last_practiced=last_practiced
        ))

    return response


@router.post("/quizzes", response_model=StudentQuizResponse, status_code=status.HTTP_201_CREATED)
async def create_student_quiz(
    quiz_data: StudentQuizCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    Create a new self-study quiz.

    POST /student/quizzes

    Students can create quizzes for their own practice and learning.
    """
    # Create quiz
    quiz = Quiz(
        teacher_id=current_user.id,  # Creator is the student
        title=quiz_data.title,
        description=quiz_data.description,
        subject=quiz_data.subject,
        is_public=quiz_data.is_public,
        quiz_type="self_study",
        shuffle_questions=quiz_data.shuffle_questions,
        shuffle_answers=quiz_data.shuffle_answers,
        show_correct_answer=quiz_data.show_correct_answer,
        show_explanation=quiz_data.show_explanation,
        # Self-study defaults
        timer_enabled=False,
        allow_retries=True,
        max_retries=0,  # Unlimited
        difficulty_adaptation=True,
        peer_discussion_enabled=False,  # No peer discussion for self-study
    )
    db.add(quiz)
    await db.flush()  # Get the quiz ID

    # Add questions
    for i, q_data in enumerate(quiz_data.questions):
        question = QuizQuestion(
            quiz_id=quiz.id,
            order=i,
            question_text=q_data.question_text,
            question_type=q_data.question_type,
            options=q_data.options,
            correct_answer=q_data.correct_answer,
            explanation=q_data.explanation,
            time_limit=q_data.time_limit,
            points=q_data.points,
        )
        db.add(question)

    await db.commit()
    await db.refresh(quiz)

    return StudentQuizResponse(
        id=str(quiz.id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        question_count=len(quiz_data.questions),
        quiz_type=quiz.quiz_type,
        is_public=quiz.is_public,
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat(),
        times_practiced=0,
        best_score=None,
        last_practiced=None
    )


@router.patch("/quizzes/{quiz_id}", response_model=StudentQuizResponse)
async def update_student_quiz(
    quiz_id: UUID,
    quiz_data: StudentQuizUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    Update a self-study quiz.

    PATCH /student/quizzes/{quiz_id}

    Allows partial updates - only specified fields will be changed.
    """
    result = await db.execute(
        select(Quiz)
        .where(Quiz.id == quiz_id)
        .options(selectinload(Quiz.questions))
    )
    quiz = result.scalars().first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if quiz.quiz_type != "self_study":
        raise HTTPException(status_code=403, detail="Can only update self-study quizzes")

    # Update basic fields if provided
    if quiz_data.title is not None:
        quiz.title = quiz_data.title
    if quiz_data.description is not None:
        quiz.description = quiz_data.description
    if quiz_data.subject is not None:
        quiz.subject = quiz_data.subject
    if quiz_data.shuffle_questions is not None:
        quiz.shuffle_questions = quiz_data.shuffle_questions
    if quiz_data.shuffle_answers is not None:
        quiz.shuffle_answers = quiz_data.shuffle_answers
    if quiz_data.show_correct_answer is not None:
        quiz.show_correct_answer = quiz_data.show_correct_answer
    if quiz_data.show_explanation is not None:
        quiz.show_explanation = quiz_data.show_explanation
    if quiz_data.is_public is not None:
        quiz.is_public = quiz_data.is_public

    # Update questions if provided
    if quiz_data.questions is not None:
        # Delete existing questions
        for existing_q in quiz.questions:
            await db.delete(existing_q)

        # Add new questions
        for i, q_data in enumerate(quiz_data.questions):
            question = QuizQuestion(
                quiz_id=quiz.id,
                order=i,
                question_text=q_data.question_text,
                question_type=q_data.question_type,
                options=q_data.options,
                correct_answer=q_data.correct_answer,
                explanation=q_data.explanation,
                time_limit=q_data.time_limit,
                points=q_data.points,
            )
            db.add(question)

    quiz.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(quiz)

    # Get updated question count
    result = await db.execute(
        select(Quiz)
        .where(Quiz.id == quiz_id)
        .options(selectinload(Quiz.questions))
    )
    quiz = result.scalars().first()

    return StudentQuizResponse(
        id=str(quiz.id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        question_count=len(quiz.questions),
        quiz_type=quiz.quiz_type,
        is_public=quiz.is_public,
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat(),
        times_practiced=0,
        best_score=None,
        last_practiced=None
    )


@router.get("/quizzes/{quiz_id}", response_model=StudentQuizDetailResponse)
async def get_student_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    Get a specific self-study quiz with all questions.

    GET /student/quizzes/{quiz_id}
    """
    result = await db.execute(
        select(Quiz)
        .where(Quiz.id == quiz_id)
        .options(selectinload(Quiz.questions))
    )
    quiz = result.scalars().first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check ownership
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get practice stats
    games_result = await db.execute(
        select(func.count(GameSession.id))
        .where(GameSession.quiz_id == quiz.id)
        .where(GameSession.status == "finished")
    )
    times_practiced = games_result.scalar() or 0

    questions = [
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
        )
        for q in sorted(quiz.questions, key=lambda x: x.order)
    ]

    return StudentQuizDetailResponse(
        id=str(quiz.id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        quiz_type=quiz.quiz_type,
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat(),
        questions=questions,
        shuffle_questions=quiz.shuffle_questions,
        shuffle_answers=quiz.shuffle_answers,
        show_correct_answer=quiz.show_correct_answer,
        show_explanation=quiz.show_explanation,
        times_practiced=times_practiced,
        best_score=None  # TODO: Calculate from game sessions
    )


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    Delete a self-study quiz.

    DELETE /student/quizzes/{quiz_id}
    """
    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if quiz.quiz_type != "self_study":
        raise HTTPException(status_code=403, detail="Can only delete self-study quizzes")

    await db.delete(quiz)
    await db.commit()


@router.post("/quizzes/{quiz_id}/practice", response_model=PracticeSessionResponse)
async def start_practice_session(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    Start a practice session for a self-study quiz.

    POST /student/quizzes/{quiz_id}/practice

    Creates a game session for solo practice mode.
    """
    result = await db.execute(
        select(Quiz)
        .where(Quiz.id == quiz_id)
        .options(selectinload(Quiz.questions))
    )
    quiz = result.scalars().first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check ownership for self-study quizzes
    if quiz.quiz_type == "self_study" and quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Create a practice game session
    from ..models.game import generate_game_code
    game = GameSession(
        quiz_id=quiz.id,
        host_id=current_user.id,
        game_code=generate_game_code(),
        status="playing",
        sync_mode=False,  # Self-paced
        auto_advance=False,
        current_question_index=0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(game)
    await db.flush()

    # Add the student as a player
    player = Player(
        game_id=game.id,
        user_id=current_user.id,
        nickname=current_user.name or "Student",
        is_active=True,
    )
    db.add(player)
    await db.commit()

    return PracticeSessionResponse(
        session_id=str(game.id),
        quiz_id=str(quiz.id),
        quiz_title=quiz.title,
        total_questions=len(quiz.questions),
        started_at=game.started_at.isoformat()
    )


@router.post("/quizzes/{quiz_id}/practice/{session_id}/answer", response_model=AnswerResult)
async def submit_practice_answer(
    quiz_id: UUID,
    session_id: UUID,
    answer_data: AnswerSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    Submit an answer during a practice session.

    POST /student/quizzes/{quiz_id}/practice/{session_id}/answer
    """
    # Get the game session
    game_result = await db.execute(
        select(GameSession).where(GameSession.id == session_id)
    )
    game = game_result.scalars().first()

    if not game or game.quiz_id != quiz_id:
        raise HTTPException(status_code=404, detail="Practice session not found")

    # Get the player
    player_result = await db.execute(
        select(Player)
        .where(Player.game_id == game.id)
        .where(Player.user_id == current_user.id)
    )
    player = player_result.scalars().first()

    if not player:
        raise HTTPException(status_code=403, detail="Not a participant in this session")

    # Get the question
    question_result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.id == UUID(answer_data.question_id))
    )
    question = question_result.scalars().first()

    if not question or question.quiz_id != quiz_id:
        raise HTTPException(status_code=404, detail="Question not found")

    # Check if already answered
    existing_result = await db.execute(
        select(PlayerAnswer)
        .where(PlayerAnswer.player_id == player.id)
        .where(PlayerAnswer.question_id == question.id)
    )
    if existing_result.scalars().first():
        raise HTTPException(status_code=400, detail="Question already answered")

    # Check answer
    is_correct = answer_data.answer.upper() == question.correct_answer.upper()
    points = question.points if is_correct else 0

    # Save the answer
    player_answer = PlayerAnswer(
        player_id=player.id,
        question_id=question.id,
        answer=answer_data.answer,
        is_correct=is_correct,
        response_time_ms=answer_data.response_time_ms,
        points_earned=points,
        confidence=answer_data.confidence,
        reasoning=answer_data.reasoning,
    )
    db.add(player_answer)

    # Update player stats
    player.total_score += points
    if is_correct:
        player.correct_answers += 1
        player.current_streak += 1
    else:
        player.current_streak = 0

    await db.commit()

    return AnswerResult(
        question_id=str(question.id),
        is_correct=is_correct,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
        points_earned=points
    )


@router.post("/quizzes/{quiz_id}/practice/{session_id}/complete", response_model=PracticeResultResponse)
async def complete_practice_session(
    quiz_id: UUID,
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    Complete a practice session and get results.

    POST /student/quizzes/{quiz_id}/practice/{session_id}/complete
    """
    # Get the game session with quiz
    game_result = await db.execute(
        select(GameSession)
        .where(GameSession.id == session_id)
        .options(selectinload(GameSession.quiz).selectinload(Quiz.questions))
    )
    game = game_result.scalars().first()

    if not game or game.quiz_id != quiz_id:
        raise HTTPException(status_code=404, detail="Practice session not found")

    # Get the player with answers
    player_result = await db.execute(
        select(Player)
        .where(Player.game_id == game.id)
        .where(Player.user_id == current_user.id)
        .options(selectinload(Player.answers))
    )
    player = player_result.scalars().first()

    if not player:
        raise HTTPException(status_code=403, detail="Not a participant in this session")

    # Mark game as finished
    game.status = "finished"
    game.ended_at = datetime.now(timezone.utc)
    await db.commit()

    # Calculate results
    total_questions = len(game.quiz.questions)
    correct_answers = player.correct_answers
    total_points = player.total_score
    score_percentage = (correct_answers / total_questions * 100) if total_questions > 0 else 0

    time_taken = 0
    if game.started_at and game.ended_at:
        time_taken = int((game.ended_at - game.started_at).total_seconds())

    # Build detailed answer breakdown
    answers_breakdown = []
    for answer in player.answers:
        question = next((q for q in game.quiz.questions if q.id == answer.question_id), None)
        if question:
            answers_breakdown.append({
                "question_id": str(question.id),
                "question_text": question.question_text,
                "your_answer": answer.answer,
                "correct_answer": question.correct_answer,
                "is_correct": answer.is_correct,
                "explanation": question.explanation,
                "points_earned": answer.points_earned,
                "response_time_ms": answer.response_time_ms,
            })

    return PracticeResultResponse(
        session_id=str(game.id),
        quiz_title=game.quiz.title,
        total_questions=total_questions,
        correct_answers=correct_answers,
        score_percentage=round(score_percentage, 1),
        total_points=total_points,
        time_taken_seconds=time_taken,
        answers=answers_breakdown,
        completed_at=game.ended_at.isoformat()
    )


@router.get("/quizzes/{quiz_id}/results", response_model=List[PracticeResultResponse])
async def get_quiz_results_history(
    quiz_id: UUID,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """
    Get practice history for a quiz.

    GET /student/quizzes/{quiz_id}/results
    """
    # Verify quiz ownership
    quiz_result = await db.execute(
        select(Quiz)
        .where(Quiz.id == quiz_id)
        .options(selectinload(Quiz.questions))
    )
    quiz = quiz_result.scalars().first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.teacher_id != current_user.id and quiz.quiz_type == "self_study":
        raise HTTPException(status_code=403, detail="Access denied")

    # Get finished games
    games_result = await db.execute(
        select(GameSession)
        .where(GameSession.quiz_id == quiz_id)
        .where(GameSession.status == "finished")
        .order_by(GameSession.ended_at.desc())
        .limit(limit)
    )
    games = games_result.scalars().all()

    results = []
    for game in games:
        # Get player for this user
        player_result = await db.execute(
            select(Player)
            .where(Player.game_id == game.id)
            .where(Player.user_id == current_user.id)
            .options(selectinload(Player.answers))
        )
        player = player_result.scalars().first()

        if player:
            total_questions = len(quiz.questions)
            score_percentage = (player.correct_answers / total_questions * 100) if total_questions > 0 else 0

            time_taken = 0
            if game.started_at and game.ended_at:
                time_taken = int((game.ended_at - game.started_at).total_seconds())

            results.append(PracticeResultResponse(
                session_id=str(game.id),
                quiz_title=quiz.title,
                total_questions=total_questions,
                correct_answers=player.correct_answers,
                score_percentage=round(score_percentage, 1),
                total_points=player.total_score,
                time_taken_seconds=time_taken,
                answers=[],  # Omit detailed answers for list view
                completed_at=game.ended_at.isoformat() if game.ended_at else ""
            ))

    return results

"""
Game Session Routes
Kahoot-style multiplayer game management.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth import get_current_user
from ..db_models import User
from ..models.game import Quiz, QuizQuestion, GameSession, Player, PlayerAnswer, generate_game_code
from ..websocket_manager import manager, active_timers, GameTimer
from .websocket_routes import broadcast_game_state, start_question_timer, stop_game_timer

router = APIRouter()


# ==============================================================================
# Schemas
# ==============================================================================

class GameCreate(BaseModel):
    quiz_id: str
    # Game mode
    sync_mode: bool = True  # True = synchronized (Kahoot-style), False = self-paced
    auto_advance: bool = False  # Auto-advance after timer (sync_mode only)
    # Display settings
    show_leaderboard_after_each: bool = True
    show_correct_answer: bool = True
    show_answer_distribution: bool = True
    # Customization
    randomize_questions: bool = False
    randomize_answers: bool = False
    allow_late_join: bool = True


class GameResponse(BaseModel):
    id: str
    quiz_id: str
    quiz_title: str
    game_code: str
    status: str
    sync_mode: bool
    current_question_index: int
    player_count: int
    created_at: str


class JoinGame(BaseModel):
    game_code: str
    nickname: str
    avatar: Optional[str] = "🎓"


class PlayerResponse(BaseModel):
    id: str
    nickname: str
    avatar: Optional[str]
    total_score: int
    correct_answers: int
    current_streak: int
    rank: Optional[int] = None


class SubmitAnswer(BaseModel):
    answer: str  # "A", "B", "C", or "D"
    response_time_ms: int


class QuestionDisplay(BaseModel):
    """Question data sent to players (no correct answer!)"""
    question_number: int
    total_questions: int
    question_text: str
    question_type: str
    options: dict
    time_limit: int
    points: int
    image_url: Optional[str]


class QuestionResults(BaseModel):
    """Results after a question ends"""
    correct_answer: str
    explanation: Optional[str]
    answer_distribution: dict  # {"A": 5, "B": 10, "C": 2, "D": 1}
    leaderboard: List[PlayerResponse]


class GameState(BaseModel):
    """Full game state for host/player"""
    game_id: str
    game_code: str
    status: str  # lobby, question, results, finished
    current_question_index: int
    total_questions: int
    players: List[PlayerResponse]
    current_question: Optional[QuestionDisplay] = None
    question_results: Optional[QuestionResults] = None
    time_remaining: Optional[int] = None


# ==============================================================================
# Game Management (Teacher/Host)
# ==============================================================================

@router.post("/", response_model=GameResponse)
@router.post("/create", response_model=GameResponse)
async def create_game(
    game_data: GameCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new game session from a quiz."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can host games")
    
    # Get quiz
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == UUID(game_data.quiz_id))
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if len(quiz.questions) == 0:
        raise HTTPException(status_code=400, detail="Quiz has no questions")
    
    # Generate unique game code
    for _ in range(10):  # Try up to 10 times
        code = generate_game_code()
        existing = await db.execute(
            select(GameSession).where(
                GameSession.game_code == code,
                GameSession.status != "finished"
            )
        )
        if not existing.scalars().first():
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique game code")
    
    # Create game
    game = GameSession(
        quiz_id=quiz.id,
        host_id=current_user.id,
        game_code=code,
        status="lobby",
        sync_mode=game_data.sync_mode,
        auto_advance=game_data.auto_advance,
        show_leaderboard_after_each=game_data.show_leaderboard_after_each,
        show_correct_answer=game_data.show_correct_answer,
        show_answer_distribution=game_data.show_answer_distribution,
        randomize_questions=game_data.randomize_questions,
        randomize_answers=game_data.randomize_answers,
        allow_late_join=game_data.allow_late_join
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)
    
    return GameResponse(
        id=str(game.id),
        quiz_id=str(game.quiz_id),
        quiz_title=quiz.title,
        game_code=game.game_code,
        status=game.status,
        sync_mode=game.sync_mode,
        current_question_index=game.current_question_index,
        player_count=0,
        created_at=game.created_at.isoformat()
    )


@router.get("/{game_id}")
async def get_game_state(
    game_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get current game state."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.players),
            selectinload(GameSession.quiz).selectinload(Quiz.questions)
        )
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Build player list with rankings
    players_sorted = sorted(game.players, key=lambda p: p.total_score, reverse=True)
    player_list = [
        {
            "id": str(p.id),
            "nickname": p.nickname,
            "avatar": p.avatar,
            "score": p.total_score,
            "joined_at": p.joined_at.isoformat() if p.joined_at else None
        }
        for i, p in enumerate(players_sorted)
        if p.is_active
    ]
    
    # Build leaderboard
    leaderboard = [
        {
            "player_id": str(p.id),
            "nickname": p.nickname,
            "score": p.total_score,
            "rank": i + 1
        }
        for i, p in enumerate(players_sorted)
        if p.is_active
    ]
    
    # Get current question if playing
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    current_question = None
    time_remaining = None
    
    if game.status == "question" and 0 <= game.current_question_index < len(questions):
        q = questions[game.current_question_index]
        current_question = {
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "time_limit": q.time_limit,
            "points": q.points,
            "image_url": q.image_url
        }
        
        # Calculate time remaining
        if game.question_start_time:
            elapsed = (datetime.utcnow() - game.question_start_time).total_seconds()
            time_remaining = max(0, q.time_limit - int(elapsed))
    
    return {
        "id": str(game.id),
        "game_code": game.game_code,
        "quiz_title": game.quiz.title,
        "status": game.status,
        "current_question_index": game.current_question_index,
        "total_questions": len(questions),
        "player_count": len([p for p in game.players if p.is_active]),
        "players": player_list,
        "leaderboard": leaderboard,
        "current_question": current_question,
        "time_remaining": time_remaining,
        "sync_mode": game.sync_mode,
        "show_correct_answer": game.show_correct_answer,
        "show_answer_distribution": game.show_answer_distribution,
    }


@router.post("/{game_id}/start")
async def start_game(
    game_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start the game - moves from lobby to first question."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.players),
            selectinload(GameSession.quiz).selectinload(Quiz.questions)
        )
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can start the game")
    
    if game.status != "lobby":
        raise HTTPException(status_code=400, detail="Game already started")
    
    if len([p for p in game.players if p.is_active]) == 0:
        raise HTTPException(status_code=400, detail="No players in the game")
    
    # Start the game
    game.status = "question"
    game.current_question_index = 0
    game.started_at = datetime.utcnow()
    game.question_start_time = datetime.utcnow()
    
    await db.commit()
    
    # Get first question for WebSocket broadcast
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    first_question = questions[0]
    
    # Broadcast game started to all connected players via WebSocket
    game_id_str = str(game_id)
    await broadcast_game_state(game_id_str, "game_started", {
        "question_index": 0,
        "total_questions": len(questions)
    })
    
    # Broadcast the first question (without correct answer)
    await broadcast_game_state(game_id_str, "question_start", {
        "question_index": 0,
        "question_text": first_question.question_text,
        "question_type": first_question.question_type,
        "options": first_question.options,
        "time_limit": first_question.time_limit,
        "points": first_question.points
    })
    
    # Start synchronized timer if sync_mode is enabled
    if game.sync_mode:
        await start_question_timer(game_id_str, first_question.time_limit, None)
    
    return {"message": "Game started", "status": "question", "question_index": 0, "sync_mode": game.sync_mode}


@router.post("/{game_id}/next")
async def next_question(
    game_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move to the next question or show results."""
    result = await db.execute(
        select(GameSession)
        .options(selectinload(GameSession.quiz).selectinload(Quiz.questions))
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can advance the game")
    
    game_id_str = str(game_id)
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    total_questions = len(questions)
    
    # Stop any active timer
    await stop_game_timer(game_id_str)
    
    if game.status == "question":
        # Show results for current question
        game.status = "results"
        await db.commit()
        
        # Broadcast results to all players
        current_q = questions[game.current_question_index]
        await broadcast_game_state(game_id_str, "results", {
            "question_index": game.current_question_index,
            "correct_answer": current_q.correct_answer if game.show_correct_answer else None,
            "explanation": current_q.explanation
        })
        
        return {"message": "Showing results", "status": "results"}
    
    elif game.status == "results":
        # Move to next question or finish
        next_index = game.current_question_index + 1
        
        if next_index >= total_questions:
            # Game over
            game.status = "finished"
            game.ended_at = datetime.utcnow()
            await db.commit()
            
            # Broadcast game finished
            await broadcast_game_state(game_id_str, "game_end", {
                "message": "Game complete!"
            })
            
            return {"message": "Game finished", "status": "finished"}
        else:
            # Next question
            game.status = "question"
            game.current_question_index = next_index
            game.question_start_time = datetime.utcnow()
            await db.commit()
            
            # Broadcast next question
            next_q = questions[next_index]
            await broadcast_game_state(game_id_str, "question_start", {
                "question_index": next_index,
                "question_text": next_q.question_text,
                "question_type": next_q.question_type,
                "options": next_q.options,
                "time_limit": next_q.time_limit,
                "points": next_q.points
            })
            
            # Start timer if sync_mode
            if game.sync_mode:
                await start_question_timer(game_id_str, next_q.time_limit, None)

            return {
                "message": "Next question",
                "status": "question",
                "question_index": next_index,
                "current_question_index": next_index,
                "current_question": {
                    "question_text": next_q.question_text,
                    "question_type": next_q.question_type,
                    "options": next_q.options,
                    "time_limit": next_q.time_limit,
                    "points": next_q.points
                }
            }
    
    else:
        raise HTTPException(status_code=400, detail=f"Cannot advance from status: {game.status}")


@router.post("/{game_id}/end")
async def end_game(
    game_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """End the game early."""
    result = await db.execute(select(GameSession).where(GameSession.id == game_id))
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can end the game")
    
    game.status = "finished"
    game.ended_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Game ended"}


# ==============================================================================
# Player Actions
# ==============================================================================

@router.post("/join")
async def join_game(
    join_data: JoinGame,
    db: AsyncSession = Depends(get_db)
):
    """Join a game with a game code."""
    # Find game by code
    result = await db.execute(
        select(GameSession)
        .options(selectinload(GameSession.players))
        .where(
            GameSession.game_code == join_data.game_code.upper(),
            GameSession.status == "lobby"
        )
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found or already started")
    
    # Check if nickname is taken
    for p in game.players:
        if p.nickname.lower() == join_data.nickname.lower() and p.is_active:
            raise HTTPException(status_code=400, detail="Nickname already taken")
    
    # Create player
    player = Player(
        game_id=game.id,
        nickname=join_data.nickname,
        avatar=join_data.avatar
    )
    db.add(player)
    await db.commit()
    await db.refresh(player)

    # Notify host via WebSocket that a new player joined
    # This is critical - without this, the host's lobby won't see the player
    await manager.send_to_host(str(game.id), {
        "type": "player_connected",
        "player_id": str(player.id),
        "nickname": player.nickname,
        "avatar": player.avatar,
        "player_count": len([p for p in game.players if p.is_active]) + 1
    })

    # Return format expected by frontend
    return {
        "player_id": str(player.id),
        "game_id": str(game.id),
        "nickname": player.nickname,
        "avatar": player.avatar
    }


@router.get("/code/{game_code}")
async def get_game_by_code(
    game_code: str,
    db: AsyncSession = Depends(get_db)
):
    """Get game info by code (for joining)."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.quiz),
            selectinload(GameSession.players)
        )
        .where(GameSession.game_code == game_code.upper())
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return {
        "game_id": str(game.id),
        "game_code": game.game_code,
        "quiz_title": game.quiz.title,
        "status": game.status,
        "player_count": len([p for p in game.players if p.is_active])
    }


@router.post("/{game_id}/answer")
async def submit_answer(
    game_id: UUID,
    answer_data: dict,  # Accept flexible dict from frontend
    db: AsyncSession = Depends(get_db)
):
    """Submit an answer for the current question."""
    # Extract data from frontend format
    player_id_str = answer_data.get("player_id")
    answer = answer_data.get("answer")
    time_taken = answer_data.get("time_taken", 0)  # seconds
    
    if not player_id_str or not answer:
        raise HTTPException(status_code=400, detail="Missing player_id or answer")
    
    player_id = UUID(player_id_str)
    response_time_ms = int(time_taken * 1000)
    
    # Get game with current question
    result = await db.execute(
        select(GameSession)
        .options(selectinload(GameSession.quiz).selectinload(Quiz.questions))
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # For sync mode, require game to be in "question" status
    # For async mode (sync_mode=False), allow answers anytime (students play at their own pace)
    if game.sync_mode and game.status != "question":
        raise HTTPException(status_code=400, detail="Not accepting answers")
    
    # Get player
    result = await db.execute(
        select(Player).where(Player.id == player_id, Player.game_id == game_id)
    )
    player = result.scalars().first()
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Get current question
    questions = sorted(game.quiz.questions, key=lambda q: q.order)

    # For async mode, use question_index from request; for sync mode, use game's index
    if game.sync_mode:
        question_index = game.current_question_index
    else:
        # Async mode: player specifies which question they're answering
        question_index = answer_data.get("question_index", 0)

    if question_index >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index")

    question = questions[question_index]
    
    # Check if already answered
    result = await db.execute(
        select(PlayerAnswer).where(
            PlayerAnswer.player_id == player_id,
            PlayerAnswer.question_id == question.id
        )
    )
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Already answered this question")
    
    # Calculate if correct and points
    is_correct = answer.upper() == question.correct_answer.upper()
    
    # Points based on speed (faster = more points)
    points_earned = 0
    if is_correct:
        time_factor = max(0, 1 - (response_time_ms / (question.time_limit * 1000)))
        # Minimum 50% of points for correct answer
        points_earned = int(question.points * (0.5 + 0.5 * time_factor))
    
    # Create answer record
    player_answer = PlayerAnswer(
        player_id=player_id,
        question_id=question.id,
        answer=answer.upper(),
        is_correct=is_correct,
        response_time_ms=response_time_ms,
        points_earned=points_earned
    )
    db.add(player_answer)
    
    # Update player score
    player.total_score += points_earned
    if is_correct:
        player.correct_answers += 1
        player.current_streak += 1
    else:
        player.current_streak = 0
    
    await db.commit()
    
    return {
        "submitted": True,
        "points_earned": points_earned,
    }


@router.get("/{game_id}/results")
async def get_question_results(
    game_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get results for the current question (after it ends)."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.players).selectinload(Player.answers),
            selectinload(GameSession.quiz).selectinload(Quiz.questions)
        )
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game.status not in ["results", "finished"]:
        raise HTTPException(status_code=400, detail="Results not available yet")
    
    # Get current question
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    question = questions[game.current_question_index]
    
    # Calculate answer distribution
    answer_distribution = {"A": 0, "B": 0, "C": 0, "D": 0}
    for player in game.players:
        for answer in player.answers:
            if answer.question_id == question.id:
                answer_distribution[answer.answer] = answer_distribution.get(answer.answer, 0) + 1
    
    # Build leaderboard
    players_sorted = sorted(game.players, key=lambda p: p.total_score, reverse=True)
    leaderboard = [
        PlayerResponse(
            id=str(p.id),
            nickname=p.nickname,
            avatar=p.avatar,
            total_score=p.total_score,
            correct_answers=p.correct_answers,
            current_streak=p.current_streak,
            rank=i + 1
        )
        for i, p in enumerate(players_sorted)
        if p.is_active
    ]
    
    return QuestionResults(
        correct_answer=question.correct_answer,
        explanation=question.explanation,
        answer_distribution=answer_distribution,
        leaderboard=leaderboard
    )


@router.get("/{game_id}/leaderboard", response_model=List[PlayerResponse])
async def get_leaderboard(
    game_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get current leaderboard."""
    result = await db.execute(
        select(GameSession)
        .options(selectinload(GameSession.players))
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    players_sorted = sorted(game.players, key=lambda p: p.total_score, reverse=True)
    
    return [
        PlayerResponse(
            id=str(p.id),
            nickname=p.nickname,
            avatar=p.avatar,
            total_score=p.total_score,
            correct_answers=p.correct_answers,
            current_streak=p.current_streak,
            rank=i + 1
        )
        for i, p in enumerate(players_sorted)
        if p.is_active
    ]


@router.get("/{game_id}/player")
async def get_game_for_player(
    game_id: UUID,
    question_index: Optional[int] = Query(None, description="Question index for async mode"),
    db: AsyncSession = Depends(get_db)
):
    """Get game state for player view (no auth required).

    For async mode (sync_mode=False), pass question_index to get a specific question.
    """
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.quiz).selectinload(Quiz.questions)
        )
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    questions = sorted(game.quiz.questions, key=lambda q: q.order)

    # Build current question (without correct answer!)
    current_question = None
    effective_status = game.status
    effective_question_index = game.current_question_index

    # For async mode (sync_mode=False), students can start immediately without waiting
    # They don't need the teacher to click "Start Game"
    if not game.sync_mode:
        effective_status = "question"  # Always treat as active for async
        # Use provided question_index, or default to 0
        q_idx = question_index if question_index is not None else 0
        effective_question_index = q_idx
        if 0 <= q_idx < len(questions):
            q = questions[q_idx]
            current_question = {
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options,
                "time_limit": q.time_limit,
                "points": q.points,
            }
    elif game.status == "question" and 0 <= game.current_question_index < len(questions):
        q = questions[game.current_question_index]
        current_question = {
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "time_limit": q.time_limit,
            "points": q.points,
        }

    return {
        "id": str(game.id),
        "status": effective_status,
        "current_question_index": effective_question_index,
        "total_questions": len(questions),
        "quiz_title": game.quiz.title,
        "current_question": current_question,
        "sync_mode": game.sync_mode,
    }


@router.get("/{game_id}/players/{player_id}/state")
async def get_player_state(
    game_id: UUID,
    player_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get player's current state including score and last answer result."""
    # Get player with answers
    result = await db.execute(
        select(Player)
        .options(selectinload(Player.answers))
        .where(Player.id == player_id, Player.game_id == game_id)
    )
    player = result.scalars().first()
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Get game for ranking
    result = await db.execute(
        select(GameSession)
        .options(selectinload(GameSession.players))
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    # Calculate rank
    players_sorted = sorted(game.players, key=lambda p: p.total_score, reverse=True)
    rank = 1
    for i, p in enumerate(players_sorted):
        if p.id == player_id:
            rank = i + 1
            break
    
    # Get last answer result
    last_answer = None
    if player.answers:
        last_answer = sorted(player.answers, key=lambda a: a.submitted_at, reverse=True)[0]
    
    return {
        "score": player.total_score,
        "rank": rank,
        "correct_answers": player.correct_answers,
        "current_streak": player.current_streak,
        "last_answer_correct": last_answer.is_correct if last_answer else None,
        "last_answer_points": last_answer.points_earned if last_answer else 0
    }


@router.get("/{game_id}/questions/{question_index}/results")
async def get_specific_question_results(
    game_id: UUID,
    question_index: int,
    db: AsyncSession = Depends(get_db)
):
    """Get results for a specific question."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.players).selectinload(Player.answers),
            selectinload(GameSession.quiz).selectinload(Quiz.questions)
        )
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Get question
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    if question_index >= len(questions):
        raise HTTPException(status_code=404, detail="Question not found")
    
    question = questions[question_index]
    
    # Calculate answer distribution
    answer_distribution = {"A": 0, "B": 0, "C": 0, "D": 0}
    total_answers = 0
    correct_count = 0
    
    for player in game.players:
        for answer in player.answers:
            if answer.question_id == question.id:
                answer_distribution[answer.answer] = answer_distribution.get(answer.answer, 0) + 1
                total_answers += 1
                if answer.is_correct:
                    correct_count += 1
    
    return {
        "question_text": question.question_text,
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
        "answer_distribution": answer_distribution,
        "total_answers": total_answers,
        "correct_count": correct_count
    }


# ==============================================================================
# Teacher's Games
# ==============================================================================

@router.get("", response_model=List[GameResponse])
@router.get("/", response_model=List[GameResponse], include_in_schema=False)
async def get_my_games(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all games for the current teacher."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.quiz),
            selectinload(GameSession.players)
        )
        .where(GameSession.host_id == current_user.id)
        .order_by(GameSession.created_at.desc())
    )
    games = result.scalars().all()

    return [
        GameResponse(
            id=str(g.id),
            quiz_id=str(g.quiz_id),
            quiz_title=g.quiz.title,
            game_code=g.game_code,
            status=g.status,
            sync_mode=g.sync_mode,
            current_question_index=g.current_question_index,
            player_count=len([p for p in g.players if p.is_active]),
            created_at=g.created_at.isoformat()
        )
        for g in games
    ]


@router.get("/my/active", response_model=List[GameResponse])
async def get_my_active_games(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get teacher's active (non-finished) games."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.quiz),
            selectinload(GameSession.players)
        )
        .where(
            GameSession.host_id == current_user.id,
            GameSession.status != "finished"
        )
        .order_by(GameSession.created_at.desc())
    )
    games = result.scalars().all()
    
    return [
        GameResponse(
            id=str(g.id),
            quiz_id=str(g.quiz_id),
            quiz_title=g.quiz.title,
            game_code=g.game_code,
            status=g.status,
            sync_mode=g.sync_mode,
            current_question_index=g.current_question_index,
            player_count=len([p for p in g.players if p.is_active]),
            created_at=g.created_at.isoformat()
        )
        for g in games
    ]


# ==============================================================================
# Game Results Export
# ==============================================================================

@router.get("/{game_id}/export")
async def export_game_results(
    game_id: UUID,
    format: str = Query("md", description="Export format: md (markdown), json, or csv"),
    db: AsyncSession = Depends(get_db)
):
    """
    Export game results in various formats.
    
    **Formats:**
    - `md` - Markdown results report with leaderboard and per-question breakdown
    - `json` - Complete JSON data for analysis
    - `csv` - CSV format for spreadsheet import
    
    Students can access their own results via the game code.
    """
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.quiz).selectinload(Quiz.questions),
            selectinload(GameSession.players).selectinload(Player.answers)
        )
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if format == "json":
        export_data = generate_game_json_export(game)
        return JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f'attachment; filename="game_{game.game_code}_results.json"'
            }
        )
    elif format == "csv":
        content = generate_game_csv_export(game)
        return PlainTextResponse(
            content=content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="game_{game.game_code}_results.csv"'
            }
        )
    else:  # md (default)
        content = generate_game_markdown_export(game)
        return PlainTextResponse(
            content=content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="game_{game.game_code}_results.md"'
            }
        )


def generate_game_markdown_export(game: GameSession) -> str:
    """Generate markdown results report."""
    lines = [
        f"# 🏆 Game Results: {game.quiz.title}",
        "",
        f"**Game Code:** `{game.game_code}`",
        f"**Status:** {game.status.title()}",
    ]
    
    if game.started_at:
        lines.append(f"**Started:** {game.started_at.strftime('%Y-%m-%d %H:%M')}")
    if game.ended_at:
        lines.append(f"**Ended:** {game.ended_at.strftime('%Y-%m-%d %H:%M')}")
    
    active_players = [p for p in game.players if p.is_active]
    lines.extend([
        f"**Total Players:** {len(active_players)}",
        "",
        "---",
        "",
        "## 🥇 Leaderboard",
        "",
    ])
    
    # Leaderboard
    players_sorted = sorted(active_players, key=lambda p: p.total_score, reverse=True)
    medals = ["🥇", "🥈", "🥉"]
    
    lines.append("| Rank | Player | Score | Correct | Streak |")
    lines.append("|------|--------|-------|---------|--------|")
    
    for i, player in enumerate(players_sorted):
        medal = medals[i] if i < 3 else f"{i+1}"
        lines.append(
            f"| {medal} | {player.nickname} | {player.total_score:,} | "
            f"{player.correct_answers}/{len(game.quiz.questions)} | {player.best_streak} |"
        )
    
    lines.extend(["", "---", "", "## 📊 Question Breakdown", ""])
    
    # Per-question breakdown
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    
    for i, q in enumerate(questions, 1):
        # Get answers for this question
        question_answers = []
        for player in active_players:
            for ans in player.answers:
                if ans.question_id == q.id:
                    question_answers.append(ans)
        
        correct_count = sum(1 for a in question_answers if a.is_correct)
        total = len(question_answers)
        pct = (correct_count / total * 100) if total > 0 else 0
        
        lines.extend([
            f"### Question {i}",
            "",
            f"> {q.question_text}",
            "",
            f"**Correct Answer:** {q.correct_answer}",
            f"**Success Rate:** {correct_count}/{total} ({pct:.0f}%)",
            "",
        ])
        
        # Answer distribution
        distribution = {}
        for ans in question_answers:
            distribution[ans.answer] = distribution.get(ans.answer, 0) + 1
        
        if distribution:
            lines.append("**Answer Distribution:**")
            for opt in sorted(distribution.keys()):
                count = distribution[opt]
                bar = "█" * min(count, 20)
                is_correct = "✓" if opt == q.correct_answer else ""
                lines.append(f"- {opt}: {bar} ({count}) {is_correct}")
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
        f"*Generated by Quizly on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}*"
    ])
    
    return "\n".join(lines)


def generate_game_json_export(game: GameSession) -> dict:
    """Generate complete JSON export of game results."""
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    active_players = [p for p in game.players if p.is_active]
    players_sorted = sorted(active_players, key=lambda p: p.total_score, reverse=True)
    
    export_data = {
        "game_code": game.game_code,
        "quiz_title": game.quiz.title,
        "status": game.status,
        "started_at": game.started_at.isoformat() if game.started_at else None,
        "ended_at": game.ended_at.isoformat() if game.ended_at else None,
        "total_questions": len(questions),
        "total_players": len(active_players),
        "leaderboard": [
            {
                "rank": i + 1,
                "nickname": p.nickname,
                "score": p.total_score,
                "correct_answers": p.correct_answers,
                "best_streak": p.best_streak,
                "avatar": p.avatar
            }
            for i, p in enumerate(players_sorted)
        ],
        "questions": [],
        "player_responses": []
    }
    
    # Question data with stats
    for i, q in enumerate(questions):
        question_answers = []
        for player in active_players:
            for ans in player.answers:
                if ans.question_id == q.id:
                    question_answers.append(ans)
        
        correct_count = sum(1 for a in question_answers if a.is_correct)
        distribution = {}
        for ans in question_answers:
            distribution[ans.answer] = distribution.get(ans.answer, 0) + 1
        
        export_data["questions"].append({
            "number": i + 1,
            "question_text": q.question_text,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "total_responses": len(question_answers),
            "correct_count": correct_count,
            "success_rate": correct_count / len(question_answers) if question_answers else 0,
            "answer_distribution": distribution
        })
    
    # Per-player responses
    for player in players_sorted:
        player_data = {
            "nickname": player.nickname,
            "total_score": player.total_score,
            "answers": []
        }
        for ans in sorted(player.answers, key=lambda a: a.submitted_at):
            q = next((q for q in questions if q.id == ans.question_id), None)
            if q:
                player_data["answers"].append({
                    "question_number": questions.index(q) + 1,
                    "answer": ans.answer,
                    "is_correct": ans.is_correct,
                    "points_earned": ans.points_earned,
                    "response_time_ms": ans.response_time_ms
                })
        export_data["player_responses"].append(player_data)
    
    return export_data


def generate_game_csv_export(game: GameSession) -> str:
    """Generate CSV export for spreadsheet analysis."""
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    active_players = [p for p in game.players if p.is_active]
    players_sorted = sorted(active_players, key=lambda p: p.total_score, reverse=True)
    
    lines = []
    
    # Header
    header = ["Rank", "Nickname", "Total Score", "Correct Answers", "Best Streak"]
    for i, q in enumerate(questions, 1):
        header.append(f"Q{i} Answer")
        header.append(f"Q{i} Correct")
        header.append(f"Q{i} Points")
    lines.append(",".join(header))
    
    # Player rows
    for rank, player in enumerate(players_sorted, 1):
        row = [
            str(rank),
            f'"{player.nickname}"',
            str(player.total_score),
            str(player.correct_answers),
            str(player.best_streak)
        ]
        
        for q in questions:
            ans = next((a for a in player.answers if a.question_id == q.id), None)
            if ans:
                row.append(ans.answer)
                row.append("Yes" if ans.is_correct else "No")
                row.append(str(ans.points_earned))
            else:
                row.extend(["", "", "0"])
        
        lines.append(",".join(row))
    
    return "\n".join(lines)

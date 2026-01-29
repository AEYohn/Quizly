"""
Game Session Routes
Kahoot-style multiplayer game management.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth_clerk import get_current_user_clerk as get_current_user
from ..db_models import User
from ..models.game import Quiz, GameSession, Player, PlayerAnswer, generate_game_code
from ..websocket_manager import manager
from ..rate_limiter import limiter, ANSWER_RATE_LIMIT
from .websocket_routes import broadcast_game_state, start_question_timer, stop_game_timer
from ..services.smart_peer_service import get_peer_name

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


# ==============================================================================
# Public Endpoints (no auth required)
# ==============================================================================

@router.get("/lobby")
async def get_lobby_games(
    db: AsyncSession = Depends(get_db)
):
    """Get all games currently in lobby status."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.quiz),
            selectinload(GameSession.players)
        )
        .where(GameSession.status == "lobby")
        .order_by(GameSession.created_at.desc())
        .limit(20)
    )
    games = result.scalars().all()

    return [
        {
            "id": str(g.id),
            "game_code": g.game_code,
            "quiz_title": g.quiz.title if g.quiz else "Unknown",
            "player_count": len(g.players) if g.players else 0,
            "created_at": g.created_at.isoformat() if g.created_at else None
        }
        for g in games
    ]


@router.get("/history/{student_name}")
async def get_student_game_history(
    student_name: str,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    """Get game history for a student by nickname."""
    # Find players with this nickname, eager load game -> quiz -> questions
    result = await db.execute(
        select(Player)
        .options(
            selectinload(Player.game)
            .selectinload(GameSession.quiz)
            .selectinload(Quiz.questions)
        )
        .where(Player.nickname.ilike(student_name))
        .order_by(Player.joined_at.desc())
        .limit(limit)
    )
    players = result.scalars().all()

    return [
        {
            "game_id": str(p.game_id),
            "quiz_title": p.game.quiz.title if p.game and p.game.quiz else "Unknown",
            "score": p.correct_answers,
            "total_questions": len(p.game.quiz.questions) if p.game and p.game.quiz and p.game.quiz.questions else 0,
            "played_at": p.joined_at.isoformat() if p.joined_at else None,
            "nickname": p.nickname
        }
        for p in players if p.game
    ]


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
            elapsed = (datetime.now(timezone.utc) - game.question_start_time).total_seconds()
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
    game.started_at = datetime.now(timezone.utc)
    game.question_start_time = datetime.now(timezone.utc)
    
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
        "points": first_question.points,
        "image_url": first_question.image_url
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
            game.ended_at = datetime.now(timezone.utc)
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
            game.question_start_time = datetime.now(timezone.utc)
            await db.commit()
            
            # Broadcast next question
            next_q = questions[next_index]
            await broadcast_game_state(game_id_str, "question_start", {
                "question_index": next_index,
                "question_text": next_q.question_text,
                "question_type": next_q.question_type,
                "options": next_q.options,
                "time_limit": next_q.time_limit,
                "points": next_q.points,
                "image_url": next_q.image_url
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
                    "points": next_q.points,
                    "image_url": next_q.image_url
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
    game.ended_at = datetime.now(timezone.utc)
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

    # Check if nickname already exists - allow rejoin
    existing_player = None
    for p in game.players:
        if p.nickname.lower() == join_data.nickname.lower():
            if p.is_active:
                # Player already active - allow rejoin (e.g., page refresh)
                existing_player = p
                break
            else:
                # Reactivate inactive player
                p.is_active = True
                existing_player = p
                break

    if existing_player:
        await db.commit()
        await db.refresh(existing_player)
        player = existing_player
    else:
        # Create new player
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


@router.post("/{game_id}/join")
async def join_game_by_id(
    game_id: UUID,
    join_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Join a game by ID (alternative to joining by game code)."""
    # Find game by ID
    result = await db.execute(
        select(GameSession)
        .options(selectinload(GameSession.players))
        .where(
            GameSession.id == game_id,
            GameSession.status == "lobby"
        )
    )
    game = result.scalars().first()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found or already started")

    nickname = join_data.get("nickname", "Player")
    avatar = join_data.get("avatar", "🎓")

    # Check if nickname already exists - allow rejoin
    existing_player = None
    for p in game.players:
        if p.nickname.lower() == nickname.lower():
            if p.is_active:
                # Player already active - allow rejoin (e.g., page refresh)
                existing_player = p
                break
            else:
                # Reactivate inactive player
                p.is_active = True
                existing_player = p
                break

    if existing_player:
        await db.commit()
        await db.refresh(existing_player)
        player = existing_player
    else:
        # Create new player
        player = Player(
            game_id=game.id,
            nickname=nickname,
            avatar=avatar
        )
        db.add(player)
        await db.commit()
        await db.refresh(player)

    # Notify host via WebSocket
    await manager.send_to_host(str(game.id), {
        "type": "player_connected",
        "player_id": str(player.id),
        "nickname": player.nickname,
        "avatar": player.avatar,
        "player_count": len([p for p in game.players if p.is_active]) + 1
    })

    return {
        "player_id": str(player.id),
        "game_id": str(game.id),
        "nickname": player.nickname,
        "avatar": player.avatar
    }


@router.get("/quiz/{quiz_id}/active")
async def get_active_game_for_quiz(
    quiz_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get active (lobby) game session for a quiz, if one exists."""
    from uuid import UUID
    try:
        result = await db.execute(
            select(GameSession)
            .where(
                GameSession.quiz_id == UUID(quiz_id),
                GameSession.status == "lobby"
            )
            .order_by(GameSession.created_at.desc())
            .limit(1)
        )
        game = result.scalars().first()

        if not game:
            return None

        return {
            "id": str(game.id),
            "game_code": game.game_code,
            "status": game.status,
            "created_at": game.created_at.isoformat() if game.created_at else None
        }
    except Exception:
        return None


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
@limiter.limit(ANSWER_RATE_LIMIT)
async def submit_answer(
    request: Request,  # Required for rate limiter
    game_id: UUID,
    answer_data: dict,  # Accept flexible dict from frontend
    db: AsyncSession = Depends(get_db)
):
    """Submit an answer for the current question.

    Rate limited to prevent spam (default: 2 submissions per second per IP).
    """
    # Extract data from frontend format
    player_id_str = answer_data.get("player_id")
    answer = answer_data.get("answer")
    time_taken = answer_data.get("time_taken", 0)  # seconds
    confidence = answer_data.get("confidence")  # 0-100 confidence level (optional)
    reasoning = answer_data.get("reasoning")  # Student's reasoning (optional)

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
        points_earned=points_earned,
        confidence=confidence,
        reasoning=reasoning
    )

    # If wrong answer with reasoning, run misconception analysis
    misconception_data = None
    if not is_correct and reasoning:
        try:
            from ..services.misconception_service import analyze_wrong_answer
            misconception_data = await analyze_wrong_answer(
                question={
                    "question_text": question.question_text,
                    "options": question.options,
                    "explanation": question.explanation
                },
                student_answer=answer.upper(),
                student_reasoning=reasoning,
                correct_answer=question.correct_answer,
                options=question.options
            )
            player_answer.misconception_data = misconception_data
        except Exception as e:
            print(f"Misconception analysis failed: {e}")

    db.add(player_answer)

    # Update player score
    player.total_score += points_earned
    if is_correct:
        player.correct_answers += 1
        player.current_streak += 1
    else:
        player.current_streak = 0

    await db.commit()

    # Broadcast real-time score update to all players and host
    try:
        await manager.broadcast_to_game(str(game_id), {
            "type": "score_update",
            "player_id": str(player_id),
            "nickname": player.nickname,
            "points_earned": points_earned,
            "total_score": player.total_score,
            "is_correct": is_correct,
            "current_streak": player.current_streak,
        })
    except Exception as e:
        # Don't fail the answer submission if broadcast fails
        print(f"Score broadcast failed: {e}")

    response_data = {
        "submitted": True,
        "is_correct": is_correct,
        "correct_answer": question.correct_answer,
        "points_earned": points_earned,
        "total_score": player.total_score,
    }

    # Include misconception data if available
    if misconception_data:
        response_data["misconception"] = misconception_data

    return response_data


@router.get("/{game_id}/results")
async def get_game_results(
    game_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get game results.

    For finished games: Returns full game summary with leaderboard and per-question breakdown.
    For in-progress games (results phase): Returns current question results.
    """
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

    # For sync mode, results only available during "results" or "finished" phases
    # For async mode, allow results access anytime there are player answers
    if game.sync_mode:
        if game.status not in ["results", "finished"]:
            raise HTTPException(status_code=400, detail="Results not available yet")
    else:
        # Async mode: allow results if there are any player answers
        # (In async mode, status might stay "lobby" but students can still play)
        has_answers = any(len(p.answers) > 0 for p in game.players if p.is_active)
        if not has_answers:
            raise HTTPException(status_code=400, detail="No quiz responses yet")

    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    active_players = [p for p in game.players if p.is_active]

    # Build leaderboard
    players_sorted = sorted(active_players, key=lambda p: p.total_score, reverse=True)

    # For finished games, return full game results
    if game.status == "finished":
        # Build leaderboard with full stats
        leaderboard = []
        for i, p in enumerate(players_sorted):
            total_answers = len(p.answers)
            leaderboard.append({
                "player_id": str(p.id),
                "nickname": p.nickname,
                "score": p.total_score,
                "rank": i + 1,
                "correct_answers": p.correct_answers,
                "total_answers": total_answers
            })

        # Build questions summary
        questions_summary = []
        for q in questions:
            correct_count = 0
            total_answers = 0
            for player in active_players:
                for answer in player.answers:
                    if answer.question_id == q.id:
                        total_answers += 1
                        if answer.is_correct:
                            correct_count += 1

            questions_summary.append({
                "question_text": q.question_text,
                "correct_count": correct_count,
                "total_answers": total_answers
            })

        return {
            "id": str(game.id),
            "quiz_title": game.quiz.title,
            "player_count": len(active_players),
            "leaderboard": leaderboard,
            "questions_summary": questions_summary
        }

    # For results phase (between questions), return current question results
    question = questions[game.current_question_index]

    # Calculate answer distribution
    answer_distribution = {"A": 0, "B": 0, "C": 0, "D": 0}
    for player in active_players:
        for answer in player.answers:
            if answer.question_id == question.id:
                answer_distribution[answer.answer] = answer_distribution.get(answer.answer, 0) + 1

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

    # Get quiz settings for async-first behavior
    quiz = game.quiz
    quiz_settings = {
        # Timing
        "timer_enabled": getattr(quiz, "timer_enabled", False),
        "default_time_limit": getattr(quiz, "default_time_limit", 30),
        # Question behavior
        "shuffle_questions": getattr(quiz, "shuffle_questions", False),
        "shuffle_answers": getattr(quiz, "shuffle_answers", False),
        "allow_retries": getattr(quiz, "allow_retries", True),
        "max_retries": getattr(quiz, "max_retries", 0),
        # Feedback
        "show_correct_answer": getattr(quiz, "show_correct_answer", True),
        "show_explanation": getattr(quiz, "show_explanation", True),
        "show_distribution": getattr(quiz, "show_distribution", False),
        # AI features
        "difficulty_adaptation": getattr(quiz, "difficulty_adaptation", True),
        "peer_discussion_enabled": getattr(quiz, "peer_discussion_enabled", True),
        "peer_discussion_trigger": getattr(quiz, "peer_discussion_trigger", "high_confidence_wrong"),
        # Live mode
        "allow_teacher_intervention": getattr(quiz, "allow_teacher_intervention", True),
        "sync_pacing_available": getattr(quiz, "sync_pacing_available", False),
    }

    return {
        "id": str(game.id),
        "status": effective_status,
        "current_question_index": effective_question_index,
        "total_questions": len(questions),
        "quiz_title": game.quiz.title,
        "current_question": current_question,
        "sync_mode": game.sync_mode,
        "quiz_settings": quiz_settings,
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

    # Calculate correct_answers from actual answers (more reliable than pre-computed counter)
    actual_correct = sum(1 for a in player.answers if a.is_correct)

    return {
        "score": player.total_score,
        "rank": rank,
        "correct_answers": actual_correct,  # Use calculated value, not potentially stale counter
        "current_streak": player.current_streak,
        "last_answer_correct": last_answer.is_correct if last_answer else None,
        "last_answer_points": last_answer.points_earned if last_answer else 0
    }


@router.post("/{game_id}/player-finish")
async def mark_player_finished(
    game_id: UUID,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Mark a player as finished with the quiz (for analytics tracking)."""
    player_id_str = data.get("player_id")
    if not player_id_str:
        raise HTTPException(status_code=400, detail="Missing player_id")

    try:
        player_id = UUID(player_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid player_id format")

    # Get player
    result = await db.execute(
        select(Player)
        .where(Player.id == player_id, Player.game_id == game_id)
    )
    player = result.scalars().first()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Mark player as finished (update finished_at timestamp if the field exists)
    # For now, we just acknowledge the request for analytics purposes
    # The player's answers are already recorded

    return {
        "success": True,
        "player_id": str(player.id),
        "nickname": player.nickname,
        "final_score": player.total_score,
        "correct_answers": player.correct_answers
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
# Player Learning Analytics
# ==============================================================================

@router.get("/{game_id}/players/{player_id}/analytics")
async def get_player_analytics(
    game_id: UUID,
    player_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive learning analytics for a player in a game.

    Returns:
    - Confidence-correctness quadrant analysis
    - Misconception detection (high confidence + wrong answers)
    - Time analysis per question
    - Learning insights and recommendations
    """
    # Get player with all answers
    result = await db.execute(
        select(Player)
        .options(selectinload(Player.answers))
        .where(Player.id == player_id, Player.game_id == game_id)
    )
    player = result.scalars().first()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Get game with questions for context
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.quiz).selectinload(Quiz.questions),
            selectinload(GameSession.players)
        )
        .where(GameSession.id == game_id)
    )
    game = result.scalars().first()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    questions = {q.id: q for q in game.quiz.questions}

    # Analyze answers
    answers_with_confidence = [a for a in player.answers if a.confidence is not None]
    total_answers = len(player.answers)

    # Confidence-Correctness Quadrant Analysis
    quadrants = {
        "confident_correct": [],      # High confidence (>=70) + correct
        "confident_incorrect": [],     # High confidence (>=70) + incorrect (MISCONCEPTION!)
        "uncertain_correct": [],       # Low confidence (<70) + correct (lucky guess or self-doubt)
        "uncertain_incorrect": []      # Low confidence (<70) + incorrect (knowledge gap)
    }

    misconceptions = []
    time_analysis = []

    for answer in player.answers:
        question = questions.get(answer.question_id)
        if not question:
            continue

        confidence = answer.confidence or 50  # default to 50 if not provided
        is_high_confidence = confidence >= 70

        # Categorize into quadrants
        if is_high_confidence and answer.is_correct:
            quadrants["confident_correct"].append({
                "question_id": str(answer.question_id),
                "question_text": question.question_text,
                "confidence": confidence
            })
        elif is_high_confidence and not answer.is_correct:
            quadrants["confident_incorrect"].append({
                "question_id": str(answer.question_id),
                "question_text": question.question_text,
                "confidence": confidence,
                "student_answer": answer.answer,
                "correct_answer": question.correct_answer,
                "reasoning": answer.reasoning
            })
            # This is a misconception - high confidence but wrong!
            misconceptions.append({
                "question_text": question.question_text,
                "student_answer": answer.answer,
                "correct_answer": question.correct_answer,
                "confidence": confidence,
                "reasoning": answer.reasoning,
                "explanation": question.explanation,
                "severity": "high" if confidence >= 85 else "medium"
            })
        elif not is_high_confidence and answer.is_correct:
            quadrants["uncertain_correct"].append({
                "question_id": str(answer.question_id),
                "question_text": question.question_text,
                "confidence": confidence
            })
        else:
            quadrants["uncertain_incorrect"].append({
                "question_id": str(answer.question_id),
                "question_text": question.question_text,
                "confidence": confidence
            })

        # Time analysis
        time_analysis.append({
            "question_index": question.order,
            "time_ms": answer.response_time_ms,
            "is_correct": answer.is_correct,
            "confidence": confidence
        })

    # Calculate statistics
    total_with_confidence = len(answers_with_confidence)
    avg_confidence = sum(a.confidence for a in answers_with_confidence) / total_with_confidence if total_with_confidence > 0 else 0
    avg_confidence_correct = sum(a.confidence for a in answers_with_confidence if a.is_correct) / max(1, len([a for a in answers_with_confidence if a.is_correct]))
    avg_confidence_incorrect = sum(a.confidence for a in answers_with_confidence if not a.is_correct) / max(1, len([a for a in answers_with_confidence if not a.is_correct]))

    # Calculate misconception rate
    misconception_rate = len(quadrants["confident_incorrect"]) / max(1, total_answers) * 100

    # Determine calibration (is student's confidence aligned with actual performance?)
    accuracy = player.correct_answers / max(1, total_answers) * 100
    calibration_gap = avg_confidence - accuracy

    if calibration_gap > 20:
        calibration_status = "overconfident"
        calibration_message = "You tend to be more confident than your accuracy suggests. Take more time to verify your answers."
    elif calibration_gap < -20:
        calibration_status = "underconfident"
        calibration_message = "You know more than you think! Trust your knowledge more."
    else:
        calibration_status = "well_calibrated"
        calibration_message = "Your confidence aligns well with your performance. Keep it up!"

    # Generate personalized tips based on analysis
    tips = []
    if len(misconceptions) > 0:
        tips.append(f"Review the {len(misconceptions)} question(s) where you were confident but incorrect - these are misconceptions to address.")
    if len(quadrants["uncertain_correct"]) > 2:
        tips.append("You got several questions right despite low confidence. Trust your knowledge more!")
    if len(quadrants["uncertain_incorrect"]) > len(quadrants["confident_incorrect"]):
        tips.append("Most of your incorrect answers came from knowledge gaps (low confidence), not misconceptions. Focus on learning new material.")

    # Calculate rank among all players
    players_sorted = sorted(game.players, key=lambda p: p.total_score, reverse=True)
    rank = next((i + 1 for i, p in enumerate(players_sorted) if p.id == player_id), 1)

    return {
        "player_id": str(player_id),
        "game_id": str(game_id),
        "nickname": player.nickname,
        "total_score": player.total_score,
        "rank": rank,
        "total_players": len([p for p in game.players if p.is_active]),

        # Core metrics
        "accuracy": accuracy,
        "total_questions": total_answers,
        "correct_answers": player.correct_answers,

        # Confidence analysis
        "avg_confidence": round(avg_confidence, 1),
        "avg_confidence_correct": round(avg_confidence_correct, 1),
        "avg_confidence_incorrect": round(avg_confidence_incorrect, 1),

        # Quadrant analysis
        "quadrants": {
            "confident_correct": len(quadrants["confident_correct"]),
            "confident_incorrect": len(quadrants["confident_incorrect"]),
            "uncertain_correct": len(quadrants["uncertain_correct"]),
            "uncertain_incorrect": len(quadrants["uncertain_incorrect"])
        },
        "quadrant_details": quadrants,

        # Misconception detection
        "misconceptions": misconceptions,
        "misconception_rate": round(misconception_rate, 1),

        # Calibration
        "calibration": {
            "status": calibration_status,
            "gap": round(calibration_gap, 1),
            "message": calibration_message
        },

        # Time analysis
        "time_analysis": time_analysis,
        "avg_response_time_ms": sum(a.response_time_ms for a in player.answers) / max(1, total_answers),

        # Tips
        "personalized_tips": tips,

        # Summary insights
        "insights": {
            "strongest_area": "consistent_performance" if len(quadrants["confident_correct"]) >= total_answers * 0.5 else "needs_improvement",
            "focus_areas": "misconception_correction" if len(misconceptions) > 0 else "knowledge_building",
            "learning_style": "confident_learner" if avg_confidence >= 70 else "careful_learner"
        }
    }


@router.get("/{game_id}/class-analytics")
async def get_class_analytics(
    game_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive class-level analytics for a game.
    Aggregates data across all players for teacher dashboard.
    """
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

    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    active_players = [p for p in game.players if p.is_active]

    if not active_players:
        return {
            "game_id": str(game_id),
            "quiz_title": game.quiz.title,
            "game_code": game.game_code,
            "total_players": 0,
            "class_accuracy": 0,
            "class_avg_confidence": 0,
            "calibration_summary": {"well_calibrated": 0, "overconfident": 0, "underconfident": 0},
            "misconception_clusters": [],
            "intervention_alerts": [],
            "question_performance": [],
            "student_performance": []
        }

    # Calculate class-level metrics
    total_correct = sum(p.correct_answers for p in active_players)
    total_answers = sum(len(p.answers) for p in active_players)
    class_accuracy = (total_correct / total_answers * 100) if total_answers > 0 else 0

    # Aggregate confidence data
    all_confidences = []
    calibration_summary = {"well_calibrated": 0, "overconfident": 0, "underconfident": 0}
    student_performance = []

    for player in active_players:
        player_answers = player.answers
        player_total = len(player_answers)
        player_accuracy = (player.correct_answers / player_total * 100) if player_total > 0 else 0

        confidences = [a.confidence for a in player_answers if a.confidence is not None]
        avg_conf = sum(confidences) / len(confidences) if confidences else 50
        all_confidences.extend(confidences)

        # Determine calibration status
        calibration_gap = avg_conf - player_accuracy
        if calibration_gap > 20:
            cal_status = "overconfident"
            calibration_summary["overconfident"] += 1
        elif calibration_gap < -20:
            cal_status = "underconfident"
            calibration_summary["underconfident"] += 1
        else:
            cal_status = "well_calibrated"
            calibration_summary["well_calibrated"] += 1

        # Count misconceptions (high confidence + wrong)
        misconception_count = sum(
            1 for a in player_answers
            if not a.is_correct and a.confidence is not None and a.confidence >= 70
        )

        student_performance.append({
            "player_id": str(player.id),
            "nickname": player.nickname,
            "score": player.total_score,
            "accuracy": round(player_accuracy, 1),
            "avg_confidence": round(avg_conf, 1),
            "calibration_status": cal_status,
            "misconception_count": misconception_count
        })

    class_avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0

    # Question-level performance
    question_performance = []
    misconception_clusters = []

    for idx, q in enumerate(questions):
        q_answers = []
        answer_dist = {"A": 0, "B": 0, "C": 0, "D": 0}
        confidences = []
        times = []
        wrong_by_answer = {}  # Track which wrong answers are most common

        for player in active_players:
            for a in player.answers:
                if a.question_id == q.id:
                    q_answers.append(a)
                    if a.answer in answer_dist:
                        answer_dist[a.answer] += 1
                    if a.confidence is not None:
                        confidences.append(a.confidence)
                    if a.response_time_ms:
                        times.append(a.response_time_ms)

                    # Track wrong answers with high confidence (misconceptions)
                    if not a.is_correct and a.confidence is not None and a.confidence >= 70:
                        if a.answer not in wrong_by_answer:
                            wrong_by_answer[a.answer] = {
                                "count": 0,
                                "students": [],
                                "reasonings": []
                            }
                        wrong_by_answer[a.answer]["count"] += 1
                        wrong_by_answer[a.answer]["students"].append(player.nickname)
                        if a.reasoning:
                            wrong_by_answer[a.answer]["reasonings"].append(a.reasoning)

        correct_count = sum(1 for a in q_answers if a.is_correct)
        correct_rate = (correct_count / len(q_answers) * 100) if q_answers else 0

        question_performance.append({
            "question_index": idx,
            "question_text": q.question_text,
            "correct_rate": round(correct_rate, 1),
            "avg_confidence": round(sum(confidences) / len(confidences), 1) if confidences else 0,
            "avg_time_ms": round(sum(times) / len(times)) if times else 0,
            "answer_distribution": answer_dist
        })

        # Build misconception clusters for this question
        for wrong_ans, data in wrong_by_answer.items():
            if data["count"] >= 2:  # At least 2 students with same wrong answer
                percentage = round(data["count"] / len(active_players) * 100)
                misconception_clusters.append({
                    "question_text": q.question_text,
                    "question_index": idx,
                    "wrong_answer": wrong_ans,
                    "count": data["count"],
                    "percentage": percentage,
                    "students": data["students"],
                    "common_reasoning": list(set(data["reasonings"]))[:3]  # Top 3 unique reasonings
                })

    # Generate intervention alerts
    intervention_alerts = []

    # Alert: Many misconceptions on a question
    for cluster in misconception_clusters:
        if cluster["percentage"] >= 25:
            intervention_alerts.append({
                "type": "misconception",
                "severity": "high" if cluster["percentage"] >= 40 else "medium",
                "message": f"{cluster['percentage']}% of class has misconception on Q{cluster['question_index'] + 1}",
                "affected_students": cluster["students"],
                "suggested_action": f"Review: {cluster['question_text'][:50]}..."
            })

    # Alert: Low performers
    low_performers = [s for s in student_performance if s["accuracy"] < 50]
    if low_performers:
        intervention_alerts.append({
            "type": "low_performance",
            "severity": "high" if len(low_performers) >= 3 else "medium",
            "message": f"{len(low_performers)} student{'s' if len(low_performers) > 1 else ''} scoring below 50%",
            "affected_students": [s["nickname"] for s in low_performers],
            "suggested_action": "Consider one-on-one review session"
        })

    # Alert: Overconfident students
    overconfident = [s for s in student_performance if s["calibration_status"] == "overconfident"]
    if len(overconfident) >= 3:
        intervention_alerts.append({
            "type": "calibration",
            "severity": "medium",
            "message": f"{len(overconfident)} students showing overconfidence",
            "affected_students": [s["nickname"] for s in overconfident],
            "suggested_action": "Discuss metacognitive strategies"
        })

    return {
        "game_id": str(game_id),
        "quiz_title": game.quiz.title,
        "game_code": game.game_code,
        "total_players": len(active_players),
        "class_accuracy": round(class_accuracy, 1),
        "class_avg_confidence": round(class_avg_confidence, 1),
        "calibration_summary": calibration_summary,
        "misconception_clusters": misconception_clusters,
        "intervention_alerts": intervention_alerts,
        "question_performance": question_performance,
        "student_performance": student_performance
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
        f"*Generated by Quizly on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}*"
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


# ==============================================================================
# Peer Matching for Async Discussions
# ==============================================================================

from collections import defaultdict  # noqa: E402
import time  # noqa: E402

# In-memory storage for peer matching (consider Redis for production scale)
peer_queues: Dict[str, Dict[int, List[Dict]]] = defaultdict(lambda: defaultdict(list))  # game_id -> question_index -> list of waiting players
peer_matches: Dict[str, Dict[str, Dict]] = defaultdict(dict)  # game_id -> player_id -> match info
chat_rooms: Dict[str, List[Dict]] = defaultdict(list)  # room_id -> messages


class PeerFindRequest(BaseModel):
    player_id: str
    player_name: str
    question_index: int
    player_answer: str
    is_correct: bool
    confidence: int = 50


class PeerMatchResponse(BaseModel):
    status: str  # "waiting", "matched", "timeout"
    peer_id: Optional[str] = None
    peer_name: Optional[str] = None
    peer_answer: Optional[str] = None
    room_id: Optional[str] = None
    use_ai: bool = False
    ai_peer_name: Optional[str] = None


class ChatMessage(BaseModel):
    sender_id: str
    sender_name: str
    content: str


class ChatMessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    content: str
    timestamp: float


@router.post("/{game_id}/peer/find", response_model=PeerMatchResponse)
async def find_peer_for_discussion(
    game_id: UUID,
    request: PeerFindRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Find a peer for discussion in async mode.

    Matching strategy:
    1. If player got it WRONG: Find someone who got it RIGHT (mentor)
    2. If player got it RIGHT: Find someone who got it WRONG (be a mentor)
    3. Fall back to AI peer if no match within timeout
    """
    game_key = str(game_id)
    player_key = request.player_id
    q_idx = request.question_index

    # Check if already matched
    if player_key in peer_matches[game_key]:
        match = peer_matches[game_key][player_key]
        return PeerMatchResponse(
            status="matched",
            peer_id=match["peer_id"],
            peer_name=match["peer_name"],
            peer_answer=match["peer_answer"],
            room_id=match["room_id"],
            use_ai=match.get("use_ai", False),
            ai_peer_name=match.get("ai_peer_name")
        )

    # Try to find a match from the queue
    queue = peer_queues[game_key][q_idx]

    # Look for complementary match (wrong student needs correct mentor, vice versa)
    match_found = None
    for i, waiting in enumerate(queue):
        if waiting["player_id"] == player_key:
            continue  # Skip self

        # Match strategy: pair opposite correctness
        if waiting["is_correct"] != request.is_correct:
            match_found = queue.pop(i)
            break

    if match_found:
        # Create chat room
        room_id = f"{game_key}_{q_idx}_{player_key}_{match_found['player_id']}"

        # Determine mentor/learner roles
        if request.is_correct:
            _mentor_id, mentor_name = player_key, request.player_name
            _learner_id, learner_name = match_found["player_id"], match_found["player_name"]
        else:
            _mentor_id, mentor_name = match_found["player_id"], match_found["player_name"]
            _learner_id, learner_name = player_key, request.player_name

        # Store match for both players
        match_info_requester = {
            "peer_id": match_found["player_id"],
            "peer_name": match_found["player_name"],
            "peer_answer": match_found["player_answer"],
            "room_id": room_id,
            "is_mentor": request.is_correct,
            "use_ai": False
        }
        match_info_other = {
            "peer_id": player_key,
            "peer_name": request.player_name,
            "peer_answer": request.player_answer,
            "room_id": room_id,
            "is_mentor": not request.is_correct,
            "use_ai": False
        }

        peer_matches[game_key][player_key] = match_info_requester
        peer_matches[game_key][match_found["player_id"]] = match_info_other

        # Initialize chat room with system message
        chat_rooms[room_id] = [{
            "id": f"sys_{int(time.time()*1000)}",
            "sender_id": "system",
            "sender_name": "Quizly",
            "content": f"🎯 {mentor_name} (got it right) is paired with {learner_name} to discuss this question. Help each other understand!",
            "timestamp": time.time()
        }]

        return PeerMatchResponse(
            status="matched",
            peer_id=match_found["player_id"],
            peer_name=match_found["player_name"],
            peer_answer=match_found["player_answer"],
            room_id=room_id,
            use_ai=False
        )

    # No match found - add to queue if not already waiting
    already_waiting = any(w["player_id"] == player_key for w in queue)
    if not already_waiting:
        queue.append({
            "player_id": player_key,
            "player_name": request.player_name,
            "player_answer": request.player_answer,
            "is_correct": request.is_correct,
            "confidence": request.confidence,
            "joined_at": time.time()
        })

    # Check if been waiting too long (5 seconds for quick fallback to AI)
    for waiting in queue:
        if waiting["player_id"] == player_key:
            wait_time = time.time() - waiting["joined_at"]
            if wait_time > 5:
                # Remove from queue
                queue[:] = [w for w in queue if w["player_id"] != player_key]

                # Create AI peer match - use consistent name function from smart_peer_service
                ai_name = get_peer_name(player_key)
                room_id = f"{game_key}_{q_idx}_{player_key}_ai"

                ai_match = {
                    "peer_id": "ai",
                    "peer_name": ai_name,
                    "peer_answer": "B" if request.player_answer == "A" else "A",  # Different answer
                    "room_id": room_id,
                    "use_ai": True,
                    "ai_peer_name": ai_name
                }
                peer_matches[game_key][player_key] = ai_match

                return PeerMatchResponse(
                    status="matched",
                    peer_id="ai",
                    peer_name=ai_name,
                    room_id=room_id,
                    use_ai=True,
                    ai_peer_name=ai_name
                )
            break

    return PeerMatchResponse(status="waiting", use_ai=False)


@router.get("/{game_id}/peer/status/{player_id}", response_model=PeerMatchResponse)
async def get_peer_match_status(
    game_id: UUID,
    player_id: str
):
    """Check if a peer match has been found."""
    game_key = str(game_id)

    if player_id in peer_matches[game_key]:
        match = peer_matches[game_key][player_id]
        return PeerMatchResponse(
            status="matched",
            peer_id=match["peer_id"],
            peer_name=match["peer_name"],
            peer_answer=match.get("peer_answer"),
            room_id=match["room_id"],
            use_ai=match.get("use_ai", False),
            ai_peer_name=match.get("ai_peer_name")
        )

    return PeerMatchResponse(status="waiting", use_ai=False)


@router.post("/{game_id}/peer/message/{room_id}")
async def send_peer_message(
    game_id: UUID,
    room_id: str,
    message: ChatMessage
):
    """Send a message in a peer chat room."""
    msg = {
        "id": f"msg_{int(time.time()*1000)}_{message.sender_id[:4]}",
        "sender_id": message.sender_id,
        "sender_name": message.sender_name,
        "content": message.content,
        "timestamp": time.time()
    }
    chat_rooms[room_id].append(msg)

    # Keep only last 50 messages per room
    if len(chat_rooms[room_id]) > 50:
        chat_rooms[room_id] = chat_rooms[room_id][-50:]

    return {"status": "sent", "message_id": msg["id"]}


@router.get("/{game_id}/peer/messages/{room_id}")
async def get_peer_messages(
    game_id: UUID,
    room_id: str,
    after: Optional[float] = Query(None, description="Get messages after this timestamp")
) -> List[ChatMessageResponse]:
    """Get messages from a peer chat room."""
    messages = chat_rooms.get(room_id, [])

    if after:
        messages = [m for m in messages if m["timestamp"] > after]

    return [
        ChatMessageResponse(
            id=m["id"],
            sender_id=m["sender_id"],
            sender_name=m["sender_name"],
            content=m["content"],
            timestamp=m["timestamp"]
        )
        for m in messages
    ]


@router.delete("/{game_id}/peer/leave/{player_id}")
async def leave_peer_queue(
    game_id: UUID,
    player_id: str
):
    """Leave the peer matching queue."""
    game_key = str(game_id)

    # Remove from all queues
    for q_idx in peer_queues[game_key]:
        peer_queues[game_key][q_idx] = [
            w for w in peer_queues[game_key][q_idx]
            if w["player_id"] != player_id
        ]

    # Clear match
    if player_id in peer_matches[game_key]:
        del peer_matches[game_key][player_id]

    return {"status": "left"}


# ==============================================================================
# Smart AI Peer Chat
# ==============================================================================

class SmartChatAttachment(BaseModel):
    """Attachment for smart chat (image or PDF)."""
    type: str  # "image" or "pdf"
    name: str
    data: str  # base64 encoded


class SmartChatRequest(BaseModel):
    """Request for smart AI peer chat."""
    player_id: str
    question_index: int
    message: str
    context: Optional[Dict[str, Any]] = None  # {student_answer, is_correct, question, reasoning}
    attachment: Optional[SmartChatAttachment] = None  # Optional image/PDF attachment


class SmartChatResponse(BaseModel):
    """Response from smart AI peer."""
    name: str
    message: str
    follow_up_question: Optional[str] = None
    ready_for_check: bool = False  # True when student should try the question again
    ask_if_ready: bool = False  # True when AI gave lesson and asks if ready to try again
    # New adaptive fields
    phase: Optional[str] = None  # "probing" | "hinting" | "targeted" | "explaining"
    hints_given: int = 0
    can_request_hint: bool = True
    stuck_detected: bool = False
    misconceptions_count: int = 0


# In-memory chat history storage per player/question (consider Redis for production)
smart_chat_histories: Dict[str, List[Dict[str, str]]] = {}
# In-memory discussion state storage per player/question
smart_chat_states: Dict[str, Dict[str, Any]] = {}


@router.post("/{game_id}/peer/smart-chat", response_model=SmartChatResponse)
async def smart_peer_chat(
    game_id: UUID,
    request: SmartChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    AI peer that understands the question context and student's reasoning.

    Unlike basic AI peer:
    - Shows actual option text, not just "A" or "C"
    - Asks about concepts and reasoning, not letter choices
    - Helps students discover the answer through guided discussion

    Adaptive features:
    - Adjusts probing depth based on confidence/error type
    - Detects when student is stuck and changes approach
    - Provides graduated hints (3 levels)
    - Personalizes final explanation to student's journey
    """
    from ..services.smart_peer_service import generate_smart_peer_response, get_peer_name, DiscussionState

    # Get chat history key
    history_key = f"{game_id}_{request.player_id}_{request.question_index}"

    # Initialize history and state if needed
    if history_key not in smart_chat_histories:
        smart_chat_histories[history_key] = []
    if history_key not in smart_chat_states:
        smart_chat_states[history_key] = None

    # Get context from request or fetch from DB
    context = request.context or {}
    question_data = context.get("question", {})
    student_answer = context.get("student_answer", "A")
    is_correct = context.get("is_correct", False)
    student_reasoning = context.get("reasoning")
    confidence = context.get("confidence")

    # If no question in context, try to fetch from DB
    if not question_data:
        result = await db.execute(
            select(GameSession)
            .options(selectinload(GameSession.quiz).selectinload(Quiz.questions))
            .where(GameSession.id == game_id)
        )
        game = result.scalars().first()

        if game:
            questions = sorted(game.quiz.questions, key=lambda q: q.order)
            if 0 <= request.question_index < len(questions):
                q = questions[request.question_index]
                question_data = {
                    "question_text": q.question_text,
                    "options": q.options,
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation
                }

    # Add user message to history
    get_peer_name(request.player_id)
    if request.message:
        smart_chat_histories[history_key].append({
            "role": "student",
            "name": "Student",
            "content": request.message
        })

    # Prepare attachment if present
    attachment_data = None
    if request.attachment:
        attachment_data = {
            "type": request.attachment.type,
            "name": request.attachment.name,
            "data": request.attachment.data
        }

    # Restore discussion state
    discussion_state = None
    if smart_chat_states[history_key]:
        discussion_state = DiscussionState.from_dict(smart_chat_states[history_key])

    # Generate AI response with adaptive logic
    response = await generate_smart_peer_response(
        question=question_data,
        student_answer=student_answer,
        student_reasoning=student_reasoning,
        correct_answer=question_data.get("correct_answer", "A"),
        is_correct=is_correct,
        chat_history=smart_chat_histories[history_key],
        player_id=request.player_id,
        confidence=confidence,
        attachment=attachment_data,
        discussion_state=discussion_state,
        hint_requested=False
    )

    # Add AI response to history
    smart_chat_histories[history_key].append({
        "role": "peer",
        "name": response["name"],
        "content": response["message"]
    })

    # Save updated discussion state
    if response.get("discussion_state"):
        smart_chat_states[history_key] = response["discussion_state"]

    # Keep history limited
    if len(smart_chat_histories[history_key]) > 20:
        smart_chat_histories[history_key] = smart_chat_histories[history_key][-20:]

    return SmartChatResponse(
        name=response["name"],
        message=response["message"],
        follow_up_question=response.get("follow_up_question"),
        ready_for_check=response.get("ready_for_check", False),
        ask_if_ready=response.get("ask_if_ready", False),
        # New adaptive fields
        phase=response.get("phase"),
        hints_given=response.get("hints_given", 0),
        can_request_hint=response.get("can_request_hint", True),
        stuck_detected=response.get("stuck_detected", False),
        misconceptions_count=response.get("misconceptions_count", 0)
    )


class HintRequest(BaseModel):
    """Request for a hint during peer discussion."""
    player_id: str
    question_index: int
    context: Optional[Dict[str, Any]] = None


@router.post("/{game_id}/peer/request-hint", response_model=SmartChatResponse)
async def request_hint(
    game_id: UUID,
    request: HintRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Request a hint during peer discussion.

    Provides graduated hints (up to 3 levels):
    - Level 1: Direction hint - conceptual nudge
    - Level 2: Contrast hint - key distinction
    - Level 3: Strong scaffolding - most of the reasoning

    Returns the hint as a peer message.
    """
    from ..services.smart_peer_service import generate_smart_peer_response, get_peer_name, DiscussionState

    # Get chat history key
    history_key = f"{game_id}_{request.player_id}_{request.question_index}"

    # Check if we have state and history
    if history_key not in smart_chat_histories:
        smart_chat_histories[history_key] = []
    if history_key not in smart_chat_states:
        smart_chat_states[history_key] = None

    # Restore discussion state
    discussion_state = None
    if smart_chat_states[history_key]:
        discussion_state = DiscussionState.from_dict(smart_chat_states[history_key])
    else:
        discussion_state = DiscussionState()

    # Check if hints are available
    if discussion_state.hints_given >= 3:
        return SmartChatResponse(
            name=get_peer_name(request.player_id),
            message="I've already given you all my hints! Let me explain the concept instead...",
            phase="explaining",
            hints_given=discussion_state.hints_given,
            can_request_hint=False
        )

    # Get context from request or fetch from DB
    context = request.context or {}
    question_data = context.get("question", {})
    student_answer = context.get("student_answer", "A")
    is_correct = context.get("is_correct", False)
    student_reasoning = context.get("reasoning")
    confidence = context.get("confidence")

    # If no question in context, try to fetch from DB
    if not question_data:
        result = await db.execute(
            select(GameSession)
            .options(selectinload(GameSession.quiz).selectinload(Quiz.questions))
            .where(GameSession.id == game_id)
        )
        game = result.scalars().first()

        if game:
            questions = sorted(game.quiz.questions, key=lambda q: q.order)
            if 0 <= request.question_index < len(questions):
                q = questions[request.question_index]
                question_data = {
                    "question_text": q.question_text,
                    "options": q.options,
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation
                }

    # Generate hint response
    response = await generate_smart_peer_response(
        question=question_data,
        student_answer=student_answer,
        student_reasoning=student_reasoning,
        correct_answer=question_data.get("correct_answer", "A"),
        is_correct=is_correct,
        chat_history=smart_chat_histories[history_key],
        player_id=request.player_id,
        confidence=confidence,
        discussion_state=discussion_state,
        hint_requested=True  # This triggers hint generation
    )

    # Add hint to history
    smart_chat_histories[history_key].append({
        "role": "peer",
        "name": response["name"],
        "content": response["message"]
    })

    # Save updated state
    if response.get("discussion_state"):
        smart_chat_states[history_key] = response["discussion_state"]

    return SmartChatResponse(
        name=response["name"],
        message=response["message"],
        follow_up_question=response.get("follow_up_question"),
        ready_for_check=response.get("ready_for_check", False),
        ask_if_ready=response.get("ask_if_ready", False),
        phase=response.get("phase"),
        hints_given=response.get("hints_given", 0),
        can_request_hint=response.get("can_request_hint", True),
        stuck_detected=response.get("stuck_detected", False),
        misconceptions_count=response.get("misconceptions_count", 0)
    )


@router.delete("/{game_id}/peer/smart-chat/{player_id}")
async def clear_smart_chat_history(
    game_id: UUID,
    player_id: str,
    question_index: Optional[int] = Query(None)
):
    """Clear chat history and state for a player (optionally for specific question)."""
    if question_index is not None:
        history_key = f"{game_id}_{player_id}_{question_index}"
        if history_key in smart_chat_histories:
            del smart_chat_histories[history_key]
        if history_key in smart_chat_states:
            del smart_chat_states[history_key]
    else:
        # Clear all histories and states for this player in this game
        keys_to_delete = [k for k in smart_chat_histories.keys()
                         if k.startswith(f"{game_id}_{player_id}_")]
        for key in keys_to_delete:
            del smart_chat_histories[key]
        keys_to_delete = [k for k in smart_chat_states.keys()
                         if k.startswith(f"{game_id}_{player_id}_")]
        for key in keys_to_delete:
            del smart_chat_states[key]

    return {"status": "cleared"}


# ==============================================================================
# Misconception Insights for Teachers
# ==============================================================================

@router.get("/{game_id}/insights/misconceptions")
async def get_game_misconception_insights(
    game_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed misconception insights for a game.

    Returns aggregated misconception data including:
    - Top misconception types across all students
    - Category distribution (conceptual, procedural, careless, etc.)
    - Severity distribution
    - Per-question misconception breakdown
    - Individual student misconceptions with remediation suggestions
    """
    # Verify game exists and user is the host
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

    if game.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can view insights")

    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    question_map = {str(q.id): q for q in questions}

    # Import misconception analysis service
    from ..services.misconception_service import analyze_wrong_answer

    # Collect all misconceptions
    all_misconceptions = []
    student_misconceptions = []
    question_misconceptions: Dict[str, List[Dict]] = {str(q.id): [] for q in questions}

    for player in game.players:
        if not player.is_active:
            continue

        player_misconceptions = []
        for answer in player.answers:
            # Skip correct answers
            if answer.is_correct:
                continue

            # Get the question for context
            q = question_map.get(str(answer.question_id))
            if not q:
                continue

            # Use stored misconception_data if available, otherwise generate on-the-fly
            misconception_data = answer.misconception_data
            if not misconception_data:
                # Generate misconception analysis for this wrong answer
                try:
                    misconception_data = await analyze_wrong_answer(
                        question={
                            "question_text": q.question_text,
                            "options": q.options,
                            "explanation": q.explanation
                        },
                        student_answer=answer.answer,
                        student_reasoning=answer.reasoning,
                        correct_answer=q.correct_answer,
                        options=q.options
                    )
                    # Store for future use
                    answer.misconception_data = misconception_data
                except Exception as e:
                    print(f"Misconception analysis failed for answer {answer.id}: {e}")
                    # Use fallback analysis
                    misconception_data = {
                        "misconception_type": "analysis_pending",
                        "category": "unknown",
                        "severity": "moderate",
                        "description": f"Student answered {answer.answer}, correct was {q.correct_answer}",
                        "root_cause": "Analysis not available",
                        "evidence": [],
                        "remediation": "Review the question explanation",
                        "related_concepts": [],
                        "confidence": 0.0
                    }

            misconception = {
                "player_id": str(player.id),
                "player_name": player.nickname,
                "question_id": str(answer.question_id),
                "answer": answer.answer,
                "confidence": answer.confidence,
                "reasoning": answer.reasoning,
                **misconception_data
            }
            all_misconceptions.append(misconception_data)
            player_misconceptions.append(misconception)

            # Add to question breakdown
            q_id = str(answer.question_id)
            if q_id in question_misconceptions:
                question_misconceptions[q_id].append(misconception)

        if player_misconceptions:
            student_misconceptions.append({
                "player_id": str(player.id),
                "nickname": player.nickname,
                "misconception_count": len(player_misconceptions),
                "misconceptions": player_misconceptions
            })

    # Commit any newly generated misconception data
    await db.commit()

    # Aggregate misconception stats
    from ..services.misconception_service import get_class_misconception_summary
    summary = await get_class_misconception_summary(all_misconceptions)

    # Build per-question breakdown
    questions_breakdown = []
    for i, q in enumerate(questions):
        q_id = str(q.id)
        q_misconceptions = question_misconceptions.get(q_id, [])

        # Count unique misconception types for this question
        type_counts: Dict[str, int] = {}
        for m in q_misconceptions:
            mtype = m.get("misconception_type", "unknown")
            type_counts[mtype] = type_counts.get(mtype, 0) + 1

        questions_breakdown.append({
            "question_index": i,
            "question_text": q.question_text[:100] + "..." if len(q.question_text) > 100 else q.question_text,
            "correct_answer": q.correct_answer,
            "misconception_count": len(q_misconceptions),
            "top_misconceptions": sorted(type_counts.items(), key=lambda x: -x[1])[:3],
            "misconceptions": q_misconceptions
        })

    return {
        "game_id": str(game_id),
        "quiz_title": game.quiz.title,
        "total_players": len([p for p in game.players if p.is_active]),
        "total_misconceptions": summary["total_misconceptions"],

        # Aggregated insights
        "summary": summary,

        # Per-question breakdown
        "questions_breakdown": questions_breakdown,

        # Per-student breakdown
        "student_misconceptions": sorted(
            student_misconceptions,
            key=lambda x: x["misconception_count"],
            reverse=True
        )
    }

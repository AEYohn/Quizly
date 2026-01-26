"""
Game Host API Routes

Endpoints for the AI Game Host (Quizzy) to react to game events
and provide explanations.
"""

from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import json

from ..services.game_host import game_host, HostEvent
from ..services.insights_service import insights_service
from ..database import get_db
from ..models.game import GameSession, Player, Quiz, PlayerAnswer
from ..db_models_learning import PeerDiscussionSession

router = APIRouter(prefix="/host", tags=["game-host"])


class GameStartRequest(BaseModel):
    quiz_title: str
    player_count: int


class QuestionStartRequest(BaseModel):
    question_num: int
    total: int
    question_text: str


class AnswerRequest(BaseModel):
    player_id: str
    player_name: str
    question_text: str
    their_answer: str
    correct_answer: str
    is_correct: bool
    time_taken: float
    options: Dict[str, str]


class ExplainRequest(BaseModel):
    question_text: str
    correct_answer: str
    student_answer: str
    options: Dict[str, str]


class GameEndRequest(BaseModel):
    winner_name: str
    winner_score: int
    player_count: int
    avg_score: float


class InsightsRequest(BaseModel):
    quiz_title: str
    questions: List[Dict[str, Any]]
    responses: List[Dict[str, Any]]
    player_count: int


# ============================================================================
# Reaction Endpoints
# ============================================================================

@router.post("/react/game-start")
async def react_game_start(data: GameStartRequest):
    """Get host reaction for game starting."""
    game_host.reset_game()
    reaction = await game_host.react(
        HostEvent.GAME_START,
        {
            "quiz_title": data.quiz_title,
            "player_count": data.player_count
        }
    )
    return {"reaction": reaction, "event": "game_start"}


@router.post("/react/question-start")
async def react_question_start(data: QuestionStartRequest):
    """Get host reaction for a new question."""
    reaction = await game_host.react(
        HostEvent.QUESTION_START,
        {
            "question_num": data.question_num,
            "total": data.total,
            "question_text": data.question_text
        }
    )
    return {"reaction": reaction, "event": "question_start"}


@router.post("/react/answer")
async def react_answer(data: AnswerRequest):
    """Get host reaction for a player's answer."""
    if data.is_correct:
        reaction = await game_host.react(
            HostEvent.CORRECT_ANSWER,
            {
                "player_id": data.player_id,
                "player_name": data.player_name,
                "answer": data.their_answer,
                "time_taken": data.time_taken
            }
        )
        return {
            "reaction": reaction,
            "event": "correct_answer",
            "explanation": None
        }
    else:
        # For wrong answers, get both reaction and explanation
        reaction = await game_host.react(
            HostEvent.WRONG_ANSWER,
            {
                "player_id": data.player_id,
                "player_name": data.player_name,
                "their_answer": data.their_answer,
                "correct_answer": data.correct_answer,
                "question_text": data.question_text
            }
        )
        return {
            "reaction": reaction,
            "event": "wrong_answer",
            "explanation": reaction  # The reaction includes the explanation
        }


@router.post("/react/game-end")
async def react_game_end(data: GameEndRequest):
    """Get host reaction for game ending."""
    reaction = await game_host.react(
        HostEvent.GAME_END,
        {
            "winner_name": data.winner_name,
            "winner_score": data.winner_score,
            "player_count": data.player_count,
            "avg_score": data.avg_score
        }
    )
    return {"reaction": reaction, "event": "game_end"}


# ============================================================================
# Streaming Endpoint for Real-time Feel
# ============================================================================

@router.post("/react/answer/stream")
async def react_answer_stream(data: AnswerRequest):
    """Stream host reaction for real-time display."""

    async def generate():
        if data.is_correct:
            event = HostEvent.CORRECT_ANSWER
            context = {
                "player_id": data.player_id,
                "player_name": data.player_name,
                "answer": data.their_answer,
                "time_taken": data.time_taken
            }
        else:
            event = HostEvent.WRONG_ANSWER
            context = {
                "player_id": data.player_id,
                "player_name": data.player_name,
                "their_answer": data.their_answer,
                "correct_answer": data.correct_answer,
                "question_text": data.question_text
            }

        async for chunk in game_host.react_stream(event, context):
            yield f"data: {json.dumps({'text': chunk})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


# ============================================================================
# Explanation Endpoint
# ============================================================================

@router.post("/explain")
async def explain_answer(data: ExplainRequest):
    """Get a detailed explanation for a wrong answer."""
    explanation = await game_host.explain_answer(
        question_text=data.question_text,
        correct_answer=data.correct_answer,
        student_answer=data.student_answer,
        options=data.options
    )
    return {"explanation": explanation}


# ============================================================================
# Teacher Insights
# ============================================================================

@router.post("/insights")
async def generate_insights(data: InsightsRequest):
    """Generate AI insights for the teacher after a game (legacy endpoint)."""
    insights = await game_host.generate_insights(
        quiz_title=data.quiz_title,
        questions=data.questions,
        responses=data.responses,
        player_count=data.player_count
    )
    return {"insights": insights}


@router.get("/insights/{game_id}")
async def get_comprehensive_insights(
    game_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate comprehensive AI insights for a game.

    Uses full game data including:
    - All player answers with confidence and reasoning
    - Peer discussion sessions
    - Per-question analysis
    - Confidence calibration analysis
    - Misconception clustering

    Returns detailed, actionable insights for teachers.
    """
    # Fetch full game data
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

    # Build game data dict
    questions = sorted(game.quiz.questions, key=lambda q: q.order)
    question_map = {str(q.id): q for q in questions}

    # Build player data with answers
    players_data = []
    for player in game.players:
        if not player.is_active:
            continue

        answers_data = []
        for answer in player.answers:
            q = question_map.get(str(answer.question_id))
            answers_data.append({
                "question_id": str(answer.question_id),
                "question_text": q.question_text if q else "",
                "answer": answer.answer,
                "is_correct": answer.is_correct,
                "confidence": answer.confidence or 50,
                "reasoning": answer.reasoning or "",
                "correct_answer": q.correct_answer if q else "",
                "time_taken": (answer.response_time_ms or 0) / 1000,  # Convert ms to seconds
            })

        players_data.append({
            "player_id": str(player.id),
            "nickname": player.nickname,
            "total_score": player.total_score,
            "answers": answers_data,
        })

    # Build questions data
    questions_data = [
        {
            "id": str(q.id),
            "question_text": q.question_text,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "concept": "general",  # QuizQuestion doesn't have concept field
            "explanation": q.explanation,
        }
        for q in questions
    ]

    game_data = {
        "quiz_title": game.quiz.title,
        "questions": questions_data,
        "players": players_data,
    }

    # Fetch peer discussions for this game
    peer_result = await db.execute(
        select(PeerDiscussionSession)
        .where(PeerDiscussionSession.game_id == game_id)
    )
    peer_sessions = peer_result.scalars().all()

    peer_discussions = [
        {
            "student_name": s.student_name,
            "question_text": s.question_text,
            "student_answer": s.student_answer,
            "was_correct": s.was_correct,
            "summary": s.summary,
            "key_insights": s.key_insights or [],
            "misconceptions_identified": s.misconceptions_identified or [],
            "understanding_improved": s.understanding_improved,
            "discussion_quality": s.discussion_quality,
            "message_count": s.message_count,
            "status": s.status,
        }
        for s in peer_sessions
    ]

    # Generate comprehensive insights
    insights = await insights_service.generate_comprehensive_insights(
        game_data=game_data,
        peer_discussions=peer_discussions if peer_discussions else None
    )

    return insights


# ============================================================================
# Quick Reactions (Pre-generated for speed)
# ============================================================================

QUICK_REACTIONS = {
    "correct": [
        "Nailed it! ✨",
        "Boom! Correct! 💥",
        "You're on fire! 🔥",
        "That's the one! 🎯",
        "Brilliant! 🌟",
        "Yes! Keep it up! 💪",
    ],
    "wrong": [
        "Not quite, but keep going! 💪",
        "Close! You'll get the next one!",
        "Learning happens! Try again! 🌱",
        "Almost there! Keep pushing! 🚀",
    ],
    "streak": [
        "Unstoppable! 🔥🔥🔥",
        "On a roll! 🎲",
        "Can't be stopped! 💪",
    ]
}


@router.get("/quick-reaction/{reaction_type}")
async def get_quick_reaction(reaction_type: str):
    """Get a quick pre-generated reaction for speed."""
    import random
    reactions = QUICK_REACTIONS.get(reaction_type, ["Great job!"])
    return {"reaction": random.choice(reactions)}

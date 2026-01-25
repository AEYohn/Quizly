"""
Game Host API Routes

Endpoints for the AI Game Host (Quizzy) to react to game events
and provide explanations.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import json

from ..services.game_host import game_host, HostEvent

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
    """Generate AI insights for the teacher after a game."""
    insights = await game_host.generate_insights(
        quiz_title=data.quiz_title,
        questions=data.questions,
        responses=data.responses,
        player_count=data.player_count
    )
    return {"insights": insights}


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

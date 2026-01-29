"""
Data Export Routes
Endpoints for exporting quiz data in CSV and JSON formats.
"""

import csv
import io
from typing import Optional
from uuid import UUID
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth_clerk import get_current_user_clerk as get_current_user
from ..db_models import User
from ..models.game import Quiz, GameSession, Player

router = APIRouter()


async def verify_quiz_ownership(
    quiz_id: UUID,
    db: AsyncSession,
    current_user: User
) -> Quiz:
    """Verify the current user owns the quiz."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can export data")

    return quiz


async def verify_session_ownership(
    session_id: UUID,
    db: AsyncSession,
    current_user: User
) -> GameSession:
    """Verify the current user owns the game session (via quiz)."""
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.quiz),
            selectinload(GameSession.players)
        )
        .where(GameSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    if session.quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can export session data")

    return session


def generate_csv_response(rows: list, headers: list, filename: str) -> StreamingResponse:
    """Generate a streaming CSV response."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/quiz/{quiz_id}/responses/csv")
async def export_quiz_responses_csv(
    quiz_id: UUID,
    session_id: Optional[UUID] = Query(None, description="Filter by specific game session"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export all responses for a quiz as CSV.

    Columns: Student Name, Question, Answer, Correct Answer, Is Correct, Score, Confidence, Time Taken, Submitted At

    Optionally filter by a specific game session.
    """
    # Verify ownership
    quiz = await verify_quiz_ownership(quiz_id, db, current_user)

    # Build question lookup map
    questions_map = {q.id: q for q in quiz.questions}

    # Get game sessions for this quiz
    sessions_query = select(GameSession).options(
        selectinload(GameSession.players).selectinload(Player.answers)
    ).where(GameSession.quiz_id == quiz_id)

    if session_id:
        sessions_query = sessions_query.where(GameSession.id == session_id)

    result = await db.execute(sessions_query)
    sessions = result.scalars().all()

    # Collect all responses
    rows = []
    for session in sessions:
        for player in session.players:
            for answer in player.answers:
                question = questions_map.get(answer.question_id)
                if not question:
                    continue

                rows.append([
                    player.nickname,
                    question.question_text,
                    answer.answer,
                    question.correct_answer,
                    "Yes" if answer.is_correct else "No",
                    answer.points_earned,
                    answer.confidence if answer.confidence is not None else "",
                    f"{answer.response_time_ms}ms",
                    answer.submitted_at.isoformat()
                ])

    headers = [
        "Student Name",
        "Question",
        "Answer",
        "Correct Answer",
        "Is Correct",
        "Score",
        "Confidence",
        "Time Taken",
        "Submitted At"
    ]

    filename = f"{quiz.title.replace(' ', '_')}_responses.csv"
    return generate_csv_response(rows, headers, filename)


@router.get("/session/{session_id}/leaderboard/csv")
async def export_session_leaderboard_csv(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export session leaderboard as CSV.

    Columns: Rank, Name, Score, Joined At

    Ordered by score descending.
    """
    # Verify ownership
    session = await verify_session_ownership(session_id, db, current_user)

    # Sort players by score descending
    players_sorted = sorted(session.players, key=lambda p: p.total_score, reverse=True)

    rows = []
    for rank, player in enumerate(players_sorted, start=1):
        rows.append([
            rank,
            player.nickname,
            player.total_score,
            player.joined_at.isoformat()
        ])

    headers = ["Rank", "Name", "Score", "Joined At"]

    filename = f"game_{session.game_code}_leaderboard.csv"
    return generate_csv_response(rows, headers, filename)


@router.get("/quiz/{quiz_id}/analytics/json")
async def export_quiz_analytics_json(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export quiz analytics as JSON.

    Includes:
    - Quiz info (title, description, question count)
    - Per-question stats:
        - Total responses
        - Correct count
        - Accuracy percentage
        - Answer distribution
        - Average response time
    """
    # Verify ownership
    quiz = await verify_quiz_ownership(quiz_id, db, current_user)

    # Get all game sessions with players and answers
    result = await db.execute(
        select(GameSession)
        .options(
            selectinload(GameSession.players).selectinload(Player.answers)
        )
        .where(GameSession.quiz_id == quiz_id)
    )
    sessions = result.scalars().all()

    # Build question lookup and initialize stats
    {q.id: q for q in quiz.questions}
    question_stats = {}

    for question in quiz.questions:
        question_stats[str(question.id)] = {
            "question_id": str(question.id),
            "question_text": question.question_text,
            "correct_answer": question.correct_answer,
            "total_responses": 0,
            "correct_count": 0,
            "answer_distribution": defaultdict(int),
            "total_response_time_ms": 0
        }

    # Aggregate stats from all sessions
    for session in sessions:
        for player in session.players:
            for answer in player.answers:
                question_id_str = str(answer.question_id)
                if question_id_str not in question_stats:
                    continue

                stats = question_stats[question_id_str]
                stats["total_responses"] += 1
                if answer.is_correct:
                    stats["correct_count"] += 1
                stats["answer_distribution"][answer.answer] += 1
                stats["total_response_time_ms"] += answer.response_time_ms

    # Calculate final stats
    questions_analytics = []
    for question in sorted(quiz.questions, key=lambda q: q.order):
        stats = question_stats[str(question.id)]
        total = stats["total_responses"]

        accuracy = (stats["correct_count"] / total * 100) if total > 0 else 0
        avg_time = (stats["total_response_time_ms"] / total) if total > 0 else 0

        questions_analytics.append({
            "question_id": stats["question_id"],
            "question_text": stats["question_text"],
            "correct_answer": stats["correct_answer"],
            "total_responses": total,
            "correct_count": stats["correct_count"],
            "accuracy_percent": round(accuracy, 2),
            "answer_distribution": dict(stats["answer_distribution"]),
            "avg_response_time_ms": round(avg_time, 2)
        })

    # Calculate overall stats
    total_responses = sum(q["total_responses"] for q in questions_analytics)
    total_correct = sum(q["correct_count"] for q in questions_analytics)
    overall_accuracy = (total_correct / total_responses * 100) if total_responses > 0 else 0

    analytics = {
        "quiz": {
            "id": str(quiz.id),
            "title": quiz.title,
            "description": quiz.description,
            "subject": quiz.subject,
            "question_count": len(quiz.questions),
            "created_at": quiz.created_at.isoformat(),
            "updated_at": quiz.updated_at.isoformat()
        },
        "overall_stats": {
            "total_sessions": len(sessions),
            "total_players": sum(len(s.players) for s in sessions),
            "total_responses": total_responses,
            "total_correct": total_correct,
            "overall_accuracy_percent": round(overall_accuracy, 2)
        },
        "questions": questions_analytics
    }

    return JSONResponse(
        content=analytics,
        headers={
            "Content-Disposition": f'attachment; filename="{quiz.title.replace(" ", "_")}_analytics.json"'
        }
    )

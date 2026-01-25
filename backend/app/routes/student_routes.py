"""
Student Learning Profile Routes
Endpoints for student learning profiles, mastery tracking, and review queues.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth import get_current_user
from ..db_models import User
from ..models.game import Player, PlayerAnswer, GameSession, Quiz, QuizQuestion

router = APIRouter()


# ==============================================================================
# Schemas
# ==============================================================================

class MasteryItem(BaseModel):
    concept: str
    mastery_score: float
    total_attempts: int
    correct_attempts: int
    last_practiced: Optional[str] = None


class MisconceptionItem(BaseModel):
    concept: str
    description: str
    occurrence_count: int
    last_seen: str


class ReviewQueueItem(BaseModel):
    concept: str
    due_date: str
    priority: str
    question_template: Optional[dict] = None


class RecentGame(BaseModel):
    game_id: str
    quiz_title: str
    score: int
    rank: int
    accuracy: float
    played_at: str


class LearningProfile(BaseModel):
    user_id: str
    name: str
    total_games_played: int
    total_questions_answered: int
    overall_accuracy: float
    avg_confidence: float
    calibration_status: str
    learning_streak: int
    concepts_mastered: List[str]
    concepts_in_progress: List[str]
    misconceptions: List[MisconceptionItem]
    recent_games: List[RecentGame]
    review_queue: List[ReviewQueueItem]
    strengths: List[str]
    weaknesses: List[str]


# ==============================================================================
# Student Profile Endpoints
# ==============================================================================

@router.get("/profile", response_model=LearningProfile)
async def get_student_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current student's learning profile with comprehensive analytics.

    Includes:
    - Overall performance metrics
    - Confidence calibration status
    - Mastery levels per concept
    - Detected misconceptions
    - Spaced repetition review queue
    - Personalized strengths and weaknesses
    """
    user_id = current_user.id

    # Get all player records for this user across games
    result = await db.execute(
        select(Player)
        .options(
            selectinload(Player.answers),
            selectinload(Player.game).selectinload(GameSession.quiz)
        )
        .where(Player.user_id == user_id)
    )
    players = result.scalars().all()

    if not players:
        # Return empty profile for new students
        return LearningProfile(
            user_id=str(user_id),
            name=current_user.name,
            total_games_played=0,
            total_questions_answered=0,
            overall_accuracy=0.0,
            avg_confidence=0.0,
            calibration_status="no_data",
            learning_streak=0,
            concepts_mastered=[],
            concepts_in_progress=[],
            misconceptions=[],
            recent_games=[],
            review_queue=[],
            strengths=[],
            weaknesses=[]
        )

    # Aggregate all answers across games
    all_answers = []
    game_results = []

    for player in players:
        for answer in player.answers:
            all_answers.append(answer)

        # Get game info for recent games
        game = player.game
        if game and game.quiz:
            total_questions = len([a for a in player.answers])
            correct = sum(1 for a in player.answers if a.is_correct)
            accuracy = (correct / total_questions * 100) if total_questions > 0 else 0

            game_results.append({
                "game_id": str(game.id),
                "quiz_title": game.quiz.title,
                "score": player.total_score,
                "rank": 1,  # Would need to query other players for actual rank
                "accuracy": accuracy,
                "played_at": player.joined_at.isoformat() if player.joined_at else datetime.utcnow().isoformat()
            })

    # Calculate overall metrics
    total_answers = len(all_answers)
    correct_answers = sum(1 for a in all_answers if a.is_correct)
    overall_accuracy = (correct_answers / total_answers * 100) if total_answers > 0 else 0.0

    # Calculate average confidence
    answers_with_confidence = [a for a in all_answers if a.confidence is not None]
    avg_confidence = sum(a.confidence for a in answers_with_confidence) / len(answers_with_confidence) if answers_with_confidence else 0.0

    # Calculate calibration status
    avg_confidence_correct = sum(a.confidence for a in answers_with_confidence if a.is_correct) / max(1, len([a for a in answers_with_confidence if a.is_correct]))
    avg_confidence_incorrect = sum(a.confidence for a in answers_with_confidence if not a.is_correct) / max(1, len([a for a in answers_with_confidence if not a.is_correct]))

    calibration_gap = avg_confidence - overall_accuracy
    if calibration_gap > 20:
        calibration_status = "overconfident"
    elif calibration_gap < -20:
        calibration_status = "underconfident"
    else:
        calibration_status = "well_calibrated"

    # Detect misconceptions (high confidence + wrong)
    misconceptions = []
    misconception_tracker = {}

    for answer in all_answers:
        if not answer.is_correct and (answer.confidence or 0) >= 70:
            # This is a potential misconception
            concept = "General"  # Would need question metadata for actual concept
            if concept not in misconception_tracker:
                misconception_tracker[concept] = {
                    "count": 0,
                    "last_seen": answer.submitted_at
                }
            misconception_tracker[concept]["count"] += 1
            if answer.submitted_at > misconception_tracker[concept]["last_seen"]:
                misconception_tracker[concept]["last_seen"] = answer.submitted_at

    for concept, data in misconception_tracker.items():
        if data["count"] >= 2:  # Only track repeated misconceptions
            misconceptions.append(MisconceptionItem(
                concept=concept,
                description=f"High confidence errors in {concept}",
                occurrence_count=data["count"],
                last_seen=data["last_seen"].isoformat()
            ))

    # Build review queue based on missed concepts
    review_queue = []
    for concept, data in misconception_tracker.items():
        priority = "high" if data["count"] >= 3 else "medium" if data["count"] >= 2 else "low"
        review_queue.append(ReviewQueueItem(
            concept=concept,
            due_date=datetime.utcnow().isoformat(),
            priority=priority
        ))

    # Determine strengths and weaknesses
    strengths = []
    weaknesses = []

    if overall_accuracy >= 80:
        strengths.append("Strong overall accuracy")
    if avg_confidence >= 70 and calibration_status == "well_calibrated":
        strengths.append("Well-calibrated confidence")
    if len([p for p in players]) >= 5:
        strengths.append("Consistent participation")

    if len(misconceptions) > 0:
        weaknesses.append(f"{len(misconceptions)} concept areas need review")
    if calibration_status == "overconfident":
        weaknesses.append("Tends to be overconfident")
    if overall_accuracy < 60:
        weaknesses.append("Accuracy needs improvement")

    # Sort recent games by date
    recent_games = sorted(game_results, key=lambda x: x["played_at"], reverse=True)[:5]

    return LearningProfile(
        user_id=str(user_id),
        name=current_user.name,
        total_games_played=len(players),
        total_questions_answered=total_answers,
        overall_accuracy=overall_accuracy,
        avg_confidence=avg_confidence,
        calibration_status=calibration_status,
        learning_streak=calculate_learning_streak(players),
        concepts_mastered=[],  # Would need concept tagging on questions
        concepts_in_progress=[],
        misconceptions=misconceptions,
        recent_games=[RecentGame(**g) for g in recent_games],
        review_queue=review_queue,
        strengths=strengths,
        weaknesses=weaknesses
    )


@router.get("/mastery")
async def get_student_mastery(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed mastery levels for each concept the student has practiced.
    """
    user_id = current_user.id

    # Get all answers for this user
    result = await db.execute(
        select(Player)
        .options(selectinload(Player.answers))
        .where(Player.user_id == user_id)
    )
    players = result.scalars().all()

    # Aggregate by concept (simplified - would use question metadata)
    concept_stats = {}

    for player in players:
        for answer in player.answers:
            concept = "General"  # Would extract from question
            if concept not in concept_stats:
                concept_stats[concept] = {
                    "total": 0,
                    "correct": 0,
                    "last_practiced": answer.submitted_at
                }
            concept_stats[concept]["total"] += 1
            if answer.is_correct:
                concept_stats[concept]["correct"] += 1
            if answer.submitted_at > concept_stats[concept]["last_practiced"]:
                concept_stats[concept]["last_practiced"] = answer.submitted_at

    mastery_items = []
    for concept, stats in concept_stats.items():
        mastery_score = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
        mastery_items.append({
            "concept": concept,
            "mastery_score": mastery_score,
            "total_attempts": stats["total"],
            "correct_attempts": stats["correct"],
            "last_practiced": stats["last_practiced"].isoformat()
        })

    return {
        "user_id": str(user_id),
        "mastery": mastery_items
    }


@router.get("/review-queue")
async def get_review_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the student's spaced repetition review queue.
    Items are concepts that need review based on the SM-2 algorithm.
    """
    user_id = current_user.id

    # In a full implementation, this would query a separate review_items table
    # For now, we'll generate based on misconceptions and missed questions

    result = await db.execute(
        select(Player)
        .options(selectinload(Player.answers))
        .where(Player.user_id == user_id)
    )
    players = result.scalars().all()

    # Find concepts that need review (incorrect answers with high confidence)
    review_items = []
    seen_concepts = set()

    for player in players:
        for answer in player.answers:
            if not answer.is_correct:
                concept = "General"
                if concept not in seen_concepts:
                    seen_concepts.add(concept)
                    # Calculate priority based on confidence
                    confidence = answer.confidence or 50
                    priority = "high" if confidence >= 80 else "medium" if confidence >= 60 else "low"

                    # Due date based on when it was missed
                    days_since = (datetime.utcnow() - answer.submitted_at).days if answer.submitted_at else 0
                    due_date = datetime.utcnow() if days_since >= 1 else datetime.utcnow() + timedelta(days=1)

                    review_items.append({
                        "concept": concept,
                        "due_date": due_date.isoformat(),
                        "priority": priority,
                        "interval_days": max(1, days_since),
                        "ease_factor": 2.5  # SM-2 default
                    })

    return {
        "user_id": str(user_id),
        "due_count": len([r for r in review_items if r["due_date"] <= datetime.utcnow().isoformat()]),
        "items": sorted(review_items, key=lambda x: (x["priority"] == "high", x["due_date"]), reverse=True)
    }


@router.post("/review-complete")
async def complete_review(
    concept: str,
    quality: int,  # 0-5 rating of recall quality (SM-2)
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a concept as reviewed with a quality rating.
    Updates spaced repetition schedule using SM-2 algorithm.

    Quality ratings:
    - 0-2: Failed recall, reset interval
    - 3: Correct with difficulty
    - 4: Correct with minor hesitation
    - 5: Perfect recall
    """
    if quality < 0 or quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be between 0 and 5")

    # SM-2 algorithm implementation
    # In a full implementation, this would update a review_schedule table

    if quality >= 3:
        # Successful recall
        new_interval = 1 if quality == 3 else 3 if quality == 4 else 7
        ease_factor = 2.5 + (quality - 3) * 0.1
    else:
        # Failed recall - reset
        new_interval = 1
        ease_factor = 2.5

    next_review = datetime.utcnow() + timedelta(days=new_interval)

    return {
        "concept": concept,
        "quality": quality,
        "next_review_at": next_review.isoformat(),
        "interval_days": new_interval,
        "ease_factor": round(ease_factor, 2)
    }


# ==============================================================================
# Helper Functions
# ==============================================================================

def calculate_learning_streak(players: List[Player]) -> int:
    """Calculate consecutive days of learning activity."""
    if not players:
        return 0

    # Get all activity dates
    activity_dates = set()
    for player in players:
        if player.joined_at:
            activity_dates.add(player.joined_at.date())

    if not activity_dates:
        return 0

    # Count consecutive days from today
    streak = 0
    current_date = datetime.utcnow().date()

    while current_date in activity_dates:
        streak += 1
        current_date -= timedelta(days=1)

    return streak

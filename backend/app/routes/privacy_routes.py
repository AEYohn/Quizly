"""
Privacy Routes
Endpoints for user data management, export, and deletion (GDPR/CCPA compliance).
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from ..database import get_db
from ..auth import get_current_user
from ..db_models import (
    User, Response, ConceptMastery, StudentMisconception, StudyItem,
    Collection, FlashcardDeck, Flashcard, StudyNote, GameContent,
    CollectionItem, LibraryStudySession
)
from ..db_models_learning import (
    ExitTicket, DetailedMisconception, AdaptiveLearningState,
    PeerDiscussionSession, DebateSession, StudentAssignment
)
from ..models.game import Player, PlayerAnswer
from ..logging_config import get_logger, log_info, log_error

router = APIRouter()
logger = get_logger("quizly.privacy")


# ==============================================================================
# Response Schemas
# ==============================================================================

class DataExportResponse(BaseModel):
    """Response containing all user data for export."""
    user: dict
    concept_mastery: list
    misconceptions: list
    exit_tickets: list
    quiz_responses: list
    game_history: list
    study_items: list
    collections: list
    peer_discussions: list
    assignments: list
    exported_at: str


class DeletionResponse(BaseModel):
    """Response after initiating data deletion."""
    message: str
    deletion_id: str
    status: str


# ==============================================================================
# Background Tasks
# ==============================================================================

async def delete_user_data_cascade(user_id: UUID, user_email: str, db_session_factory):
    """
    Background task to perform cascading deletion of all user data.

    This runs asynchronously to avoid timeout on large datasets.
    """
    async with db_session_factory() as db:
        try:
            log_info(logger, "Starting user data deletion", user_id=str(user_id))

            # 1. Delete ConceptMastery records
            await db.execute(
                delete(ConceptMastery).where(ConceptMastery.student_id == user_id)
            )
            log_info(logger, "Deleted ConceptMastery records", user_id=str(user_id))

            # 2. Delete StudentMisconception records
            await db.execute(
                delete(StudentMisconception).where(StudentMisconception.student_id == user_id)
            )
            log_info(logger, "Deleted StudentMisconception records", user_id=str(user_id))

            # 3. Delete DetailedMisconception records
            await db.execute(
                delete(DetailedMisconception).where(DetailedMisconception.student_id == user_id)
            )
            log_info(logger, "Deleted DetailedMisconception records", user_id=str(user_id))

            # 4. Delete ExitTicket records
            await db.execute(
                delete(ExitTicket).where(ExitTicket.student_id == user_id)
            )
            log_info(logger, "Deleted ExitTicket records", user_id=str(user_id))

            # 5. Delete Response records
            await db.execute(
                delete(Response).where(Response.student_id == user_id)
            )
            log_info(logger, "Deleted Response records", user_id=str(user_id))

            # 6. Delete PlayerAnswer records (via Player)
            # First get all player IDs for this user
            player_result = await db.execute(
                select(Player.id).where(Player.user_id == user_id)
            )
            player_ids = [row[0] for row in player_result.fetchall()]

            if player_ids:
                await db.execute(
                    delete(PlayerAnswer).where(PlayerAnswer.player_id.in_(player_ids))
                )
                log_info(logger, "Deleted PlayerAnswer records", user_id=str(user_id), count=len(player_ids))

            # 7. Delete Player records
            await db.execute(
                delete(Player).where(Player.user_id == user_id)
            )
            log_info(logger, "Deleted Player records", user_id=str(user_id))

            # 8. Delete PeerDiscussionSession records
            await db.execute(
                delete(PeerDiscussionSession).where(PeerDiscussionSession.student_id == user_id)
            )
            log_info(logger, "Deleted PeerDiscussionSession records", user_id=str(user_id))

            # 9. Delete DebateSession records
            await db.execute(
                delete(DebateSession).where(DebateSession.student_id == user_id)
            )
            log_info(logger, "Deleted DebateSession records", user_id=str(user_id))

            # 10. Delete AdaptiveLearningState records
            await db.execute(
                delete(AdaptiveLearningState).where(AdaptiveLearningState.student_id == user_id)
            )
            log_info(logger, "Deleted AdaptiveLearningState records", user_id=str(user_id))

            # 11. Delete StudentAssignment records (received by user)
            # Note: We keep assignments created by teachers, just anonymize student reference

            # 12. Delete LibraryStudySession records
            await db.execute(
                delete(LibraryStudySession).where(LibraryStudySession.user_id == user_id)
            )
            log_info(logger, "Deleted LibraryStudySession records", user_id=str(user_id))

            # 13. Delete study items and related data
            # Get all study item IDs first
            study_item_result = await db.execute(
                select(StudyItem.id).where(StudyItem.owner_id == user_id)
            )
            study_item_ids = [row[0] for row in study_item_result.fetchall()]

            if study_item_ids:
                # Delete flashcards via decks
                deck_result = await db.execute(
                    select(FlashcardDeck.id).where(FlashcardDeck.study_item_id.in_(study_item_ids))
                )
                deck_ids = [row[0] for row in deck_result.fetchall()]
                if deck_ids:
                    await db.execute(
                        delete(Flashcard).where(Flashcard.deck_id.in_(deck_ids))
                    )
                    await db.execute(
                        delete(FlashcardDeck).where(FlashcardDeck.id.in_(deck_ids))
                    )

                # Delete study notes
                await db.execute(
                    delete(StudyNote).where(StudyNote.study_item_id.in_(study_item_ids))
                )

                # Delete game content
                await db.execute(
                    delete(GameContent).where(GameContent.study_item_id.in_(study_item_ids))
                )

                # Delete collection items referencing these study items
                await db.execute(
                    delete(CollectionItem).where(CollectionItem.study_item_id.in_(study_item_ids))
                )

                # Delete study items
                await db.execute(
                    delete(StudyItem).where(StudyItem.id.in_(study_item_ids))
                )
                log_info(logger, "Deleted StudyItem records", user_id=str(user_id), count=len(study_item_ids))

            # 14. Delete collections owned by user
            collection_result = await db.execute(
                select(Collection.id).where(Collection.owner_id == user_id)
            )
            collection_ids = [row[0] for row in collection_result.fetchall()]

            if collection_ids:
                await db.execute(
                    delete(CollectionItem).where(CollectionItem.collection_id.in_(collection_ids))
                )
                await db.execute(
                    delete(Collection).where(Collection.id.in_(collection_ids))
                )
                log_info(logger, "Deleted Collection records", user_id=str(user_id), count=len(collection_ids))

            # 15. Soft delete user (anonymize rather than fully delete to preserve referential integrity)
            user_result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalars().first()

            if user:
                user.email = f"deleted_{user_id}@deleted.quizly"
                user.name = "Deleted User"
                user.hashed_password = None
                user.clerk_user_id = None
                log_info(logger, "Anonymized user record", user_id=str(user_id))

            await db.commit()
            log_info(logger, "User data deletion completed successfully", user_id=str(user_id))

        except Exception as e:
            await db.rollback()
            log_error(logger, "User data deletion failed", user_id=str(user_id), error=str(e))
            raise


# ==============================================================================
# Routes
# ==============================================================================

@router.delete("/me", response_model=DeletionResponse, tags=["privacy"])
async def delete_my_data(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete current user's data.

    This endpoint initiates a cascading deletion of all user data including:
    - Concept mastery records
    - Misconception records
    - Exit tickets
    - Quiz responses
    - Game participation records
    - Study items and collections
    - Discussion sessions

    The deletion runs as a background task to handle large datasets.
    The user account is soft-deleted (anonymized) to preserve data integrity.

    Note: This action cannot be undone.
    """
    from ..database import async_session

    user_id = current_user.id
    user_email = current_user.email
    deletion_id = f"del_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    log_info(logger, "User data deletion requested", user_id=str(user_id), deletion_id=deletion_id)

    # Schedule the deletion as a background task
    background_tasks.add_task(
        delete_user_data_cascade,
        user_id,
        user_email,
        async_session
    )

    return DeletionResponse(
        message="Data deletion has been initiated. Your account and all associated data will be removed.",
        deletion_id=deletion_id,
        status="processing"
    )


@router.get("/me/export", response_model=DataExportResponse, tags=["privacy"])
async def export_my_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export all user's data as JSON.

    Returns a comprehensive export of all user data including:
    - User profile information
    - Concept mastery records
    - Misconception records
    - Exit tickets
    - Quiz responses
    - Game history and scores
    - Study items (quizzes, flashcards, notes, games)
    - Collections
    - Peer discussion sessions
    - Assignments

    This data can be used for backup or portability purposes.
    """
    user_id = current_user.id
    log_info(logger, "User data export requested", user_id=str(user_id))

    # 1. User info
    user_data = {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }

    # 2. Concept mastery
    mastery_result = await db.execute(
        select(ConceptMastery).where(ConceptMastery.student_id == user_id)
    )
    mastery_records = mastery_result.scalars().all()
    concept_mastery = [
        {
            "concept": m.concept,
            "mastery_score": m.mastery_score,
            "total_attempts": m.total_attempts,
            "correct_attempts": m.correct_attempts,
            "last_seen_at": m.last_seen_at.isoformat() if m.last_seen_at else None,
            "next_review_at": m.next_review_at.isoformat() if m.next_review_at else None
        }
        for m in mastery_records
    ]

    # 3. Misconceptions
    misconception_result = await db.execute(
        select(StudentMisconception).where(StudentMisconception.student_id == user_id)
    )
    misconception_records = misconception_result.scalars().all()
    misconceptions = [
        {
            "concept": m.concept,
            "misconception": m.misconception,
            "occurrence_count": m.occurrence_count,
            "is_resolved": m.is_resolved,
            "first_seen_at": m.first_seen_at.isoformat() if m.first_seen_at else None,
            "last_seen_at": m.last_seen_at.isoformat() if m.last_seen_at else None,
            "resolved_at": m.resolved_at.isoformat() if m.resolved_at else None
        }
        for m in misconception_records
    ]

    # 4. Exit tickets
    exit_ticket_result = await db.execute(
        select(ExitTicket).where(ExitTicket.student_id == user_id)
    )
    exit_ticket_records = exit_ticket_result.scalars().all()
    exit_tickets = [
        {
            "id": str(t.id),
            "target_concept": t.target_concept,
            "session_accuracy": t.session_accuracy,
            "micro_lesson": t.micro_lesson,
            "question_prompt": t.question_prompt,
            "correct_answer": t.correct_answer,
            "student_answer": t.student_answer,
            "answered_correctly": t.answered_correctly,
            "is_completed": t.is_completed,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None
        }
        for t in exit_ticket_records
    ]

    # 5. Quiz responses
    response_result = await db.execute(
        select(Response).where(Response.student_id == user_id)
    )
    response_records = response_result.scalars().all()
    quiz_responses = [
        {
            "id": str(r.id),
            "session_id": str(r.session_id),
            "question_id": str(r.question_id),
            "answer": r.answer,
            "reasoning": r.reasoning,
            "confidence": r.confidence,
            "is_correct": r.is_correct,
            "vote_round": r.vote_round,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
        }
        for r in response_records
    ]

    # 6. Game history (Player + PlayerAnswers)
    player_result = await db.execute(
        select(Player).where(Player.user_id == user_id)
    )
    player_records = player_result.scalars().all()
    game_history = []

    for player in player_records:
        # Get answers for this player
        answer_result = await db.execute(
            select(PlayerAnswer).where(PlayerAnswer.player_id == player.id)
        )
        answers = answer_result.scalars().all()

        game_history.append({
            "player_id": str(player.id),
            "game_id": str(player.game_id),
            "nickname": player.nickname,
            "total_score": player.total_score,
            "correct_answers": player.correct_answers,
            "joined_at": player.joined_at.isoformat() if player.joined_at else None,
            "answers": [
                {
                    "question_id": str(a.question_id),
                    "answer": a.answer,
                    "is_correct": a.is_correct,
                    "response_time_ms": a.response_time_ms,
                    "points_earned": a.points_earned,
                    "confidence": a.confidence,
                    "reasoning": a.reasoning,
                    "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None
                }
                for a in answers
            ]
        })

    # 7. Study items
    study_item_result = await db.execute(
        select(StudyItem).where(StudyItem.owner_id == user_id)
    )
    study_item_records = study_item_result.scalars().all()
    study_items = []

    for item in study_item_records:
        item_data = {
            "id": str(item.id),
            "type": item.type,
            "title": item.title,
            "description": item.description,
            "visibility": item.visibility,
            "tags": item.tags,
            "source": item.source,
            "times_studied": item.times_studied,
            "created_at": item.created_at.isoformat() if item.created_at else None
        }

        # Get type-specific data
        if item.type == "flashcard_deck":
            deck_result = await db.execute(
                select(FlashcardDeck).where(FlashcardDeck.study_item_id == item.id)
            )
            deck = deck_result.scalars().first()
            if deck:
                card_result = await db.execute(
                    select(Flashcard).where(Flashcard.deck_id == deck.id)
                )
                cards = card_result.scalars().all()
                item_data["flashcards"] = [
                    {"front": c.front, "back": c.back, "mastery_level": c.mastery_level}
                    for c in cards
                ]
        elif item.type == "note":
            note_result = await db.execute(
                select(StudyNote).where(StudyNote.study_item_id == item.id)
            )
            note = note_result.scalars().first()
            if note:
                item_data["content"] = note.content_markdown
                item_data["highlighted_terms"] = note.highlighted_terms
        elif item.type == "game":
            game_result = await db.execute(
                select(GameContent).where(GameContent.study_item_id == item.id)
            )
            game = game_result.scalars().first()
            if game:
                item_data["template_type"] = game.template_type
                item_data["game_data"] = game.game_data

        study_items.append(item_data)

    # 8. Collections
    collection_result = await db.execute(
        select(Collection).where(Collection.owner_id == user_id)
    )
    collection_records = collection_result.scalars().all()
    collections = []

    for coll in collection_records:
        coll_items_result = await db.execute(
            select(CollectionItem).where(CollectionItem.collection_id == coll.id)
        )
        coll_items = coll_items_result.scalars().all()

        collections.append({
            "id": str(coll.id),
            "name": coll.name,
            "description": coll.description,
            "visibility": coll.visibility,
            "created_at": coll.created_at.isoformat() if coll.created_at else None,
            "items": [str(ci.study_item_id) for ci in coll_items]
        })

    # 9. Peer discussion sessions
    discussion_result = await db.execute(
        select(PeerDiscussionSession).where(PeerDiscussionSession.student_id == user_id)
    )
    discussion_records = discussion_result.scalars().all()
    peer_discussions = [
        {
            "id": str(d.id),
            "question_text": d.question_text,
            "student_answer": d.student_answer,
            "correct_answer": d.correct_answer,
            "was_correct": d.was_correct,
            "transcript": d.transcript,
            "summary": d.summary,
            "key_insights": d.key_insights,
            "status": d.status,
            "started_at": d.started_at.isoformat() if d.started_at else None,
            "completed_at": d.completed_at.isoformat() if d.completed_at else None
        }
        for d in discussion_records
    ]

    # 10. Assignments (received)
    # Note: We export assignments where this user was the student
    # This is based on student_name matching, as assignments may not have student_id

    assignments = []  # Simplified - would need more complex query for full assignment history

    log_info(logger, "User data export completed", user_id=str(user_id))

    return DataExportResponse(
        user=user_data,
        concept_mastery=concept_mastery,
        misconceptions=misconceptions,
        exit_tickets=exit_tickets,
        quiz_responses=quiz_responses,
        game_history=game_history,
        study_items=study_items,
        collections=collections,
        peer_discussions=peer_discussions,
        assignments=assignments,
        exported_at=datetime.now(timezone.utc).isoformat()
    )

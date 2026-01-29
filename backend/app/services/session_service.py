"""
Session Service
Handles business logic for session management using sqlalchemy (Async).
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid
from datetime import datetime, timezone

from ..db_models import Session, Question, Response, SessionParticipant
from ..schemas import LiveSessionStartRequest, StudentSubmissionRequest


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, data: LiveSessionStartRequest) -> Session:
        """Create a new live session."""
        session = Session(
            topic=data.topic,
            status="active",
            objectives=data.objectives,
            current_question_index=0,
            started_at=utc_now()
        )
        self.db.add(session)
        await self.db.flush()

        for idx, q_data in enumerate(data.questions):
            question = Question(
                session_id=session.id,
                concept=q_data.get("concept"),
                prompt=q_data.get("prompt"),
                options=q_data.get("options", []),
                correct_answer=q_data.get("correct_answer"),
                explanation=q_data.get("explanation"),
                difficulty=q_data.get("difficulty", 0.5),
                order_index=idx,
                question_type=q_data.get("question_type", "mcq"),
                starter_code=q_data.get("starter_code"),
                test_cases=q_data.get("test_cases"),
                language=q_data.get("language")
            )
            self.db.add(question)
        
        await self.db.commit()
        
        # Load relationships
        query = select(Session).where(Session.id == session.id).options(selectinload(Session.questions))
        result = await self.db.execute(query)
        created = result.scalars().first()
        if created is None:
            raise RuntimeError("Failed to load newly-created session")
        return created

    async def get_latest_active_session(self) -> Optional[Session]:
        """Get the most recent active session."""
        query = select(Session).where(Session.status == "active") \
            .order_by(Session.created_at.desc()) \
            .options(selectinload(Session.questions), selectinload(Session.participants))
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_session_by_id(self, session_id: uuid.UUID) -> Optional[Session]:
        query = select(Session).where(Session.id == session_id).options(
            selectinload(Session.questions),
            selectinload(Session.participants),
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_all_sessions(self) -> List[Session]:
        """Get all sessions ordered by creation date."""
        query = select(Session).order_by(Session.created_at.desc()) \
            .options(selectinload(Session.participants), selectinload(Session.questions))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def end_session(self, session_id: uuid.UUID) -> Optional[Session]:
        query = getattr(select(Session), "where")(Session.id == session_id)
        result = await self.db.execute(query)
        session = result.scalars().first()
        
        if session:
            session.status = "completed"
            session.ended_at = utc_now()
            await self.db.commit()
        return session

    async def add_student(self, session_id: uuid.UUID, student_name: str) -> SessionParticipant:
        """Register a student joining the session."""
        query = select(SessionParticipant).where(
            SessionParticipant.session_id == session_id,
            SessionParticipant.student_name == student_name
        )
        result = await self.db.execute(query)
        existing = result.scalars().first()
        
        if existing:
            return existing
            
        participant = SessionParticipant(
            session_id=session_id,
            student_name=student_name
        )
        self.db.add(participant)
        await self.db.commit()
        return participant

    async def get_participants(self, session_id: uuid.UUID) -> List[str]:
        query = select(SessionParticipant.student_name).where(SessionParticipant.session_id == session_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def submit_response(self, session_id: uuid.UUID, data: StudentSubmissionRequest) -> Response:
        """Submit a student response."""
        question_uuid = uuid.UUID(data.question_id)

        q_result = await self.db.execute(
            select(Question).where(
                Question.id == question_uuid,
                Question.session_id == session_id,
            )
        )
        question = q_result.scalars().first()
        if not question:
            raise ValueError("Question not found for session")

        is_correct = None
        if data.response_type == "mcq" and question.correct_answer:
            is_correct = data.answer.strip().upper() == question.correct_answer.strip().upper()

        response = Response(
            session_id=session_id,
            question_id=question_uuid,
            student_name=data.student_name,
            answer=data.answer,
            reasoning=data.reasoning,
            confidence=data.confidence,
            response_type=data.response_type,
            is_correct=is_correct,
            code_submission=data.code_submission,
            image_description=data.image_description
        )
        self.db.add(response)
        await self.db.commit()
        return response

    async def get_question_responses(self, session_id: uuid.UUID, question_id: uuid.UUID) -> List[Response]:
        query = select(Response).where(
            Response.session_id == session_id,
            Response.question_id == question_id
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_all_responses(self, session_id: uuid.UUID) -> List[Response]:
        query = select(Response).where(Response.session_id == session_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def advance_question(self, session_id: uuid.UUID) -> Optional[int]:
        """Advance to next question index if possible."""
        session = await self.get_session_by_id(session_id)
        if not session or not session.questions:
            return None
        
        current_idx = session.current_question_index
        if current_idx >= len(session.questions) - 1:
            return current_idx  # Already at end
            
        session.current_question_index = current_idx + 1
        await self.db.commit()
        return current_idx + 1

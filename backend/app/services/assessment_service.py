"""
Assessment Service — Orchestrates the 3-step familiarity assessment flow.

1. start_assessment → return self-rating items from syllabus
2. submit_self_ratings → seed BKT priors, generate diagnostic quiz
3. submit_diagnostic_answers → grade, adjust BKT, return summary
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..ai_agents.familiarity_assessment import FamiliarityAssessmentAgent
from ..services.bkt_engine import BKTEngine
from ..services.syllabus_service import SyllabusService


# Self-rating → P(L0) mapping
RATING_TO_P_L0 = {
    1: 0.05,  # Never heard of it
    2: 0.15,  # Heard of it
    3: 0.35,  # Can explain basics
    4: 0.60,  # Can apply it
    5: 0.80,  # Can teach it
}


class AssessmentService:
    """Orchestrates the familiarity assessment flow."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.agent = FamiliarityAssessmentAgent()
        self.bkt = BKTEngine(db)
        self.syllabus_service = SyllabusService(db)

    async def start_assessment(
        self,
        student_name: str,
        subject: str,
        syllabus_tree: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Step 1: Return self-rating items from syllabus.
        If syllabus_tree not provided, loads from cache.
        """
        if not syllabus_tree:
            syllabus_tree = await self.syllabus_service._get_cached(subject)
            if not syllabus_tree:
                syllabus_tree = await self.syllabus_service.get_or_generate(subject)

        items = self.agent.generate_self_rating_items(syllabus_tree)

        return {
            "subject": subject,
            "student_name": student_name,
            "self_rating_items": items,
            "total_concepts": len(items),
            "instructions": "Rate each concept 1-5: 1=Never heard of it, 2=Heard of it, 3=Can explain basics, 4=Can apply it, 5=Can teach it",
        }

    async def submit_self_ratings(
        self,
        student_name: str,
        subject: str,
        ratings: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Step 2: Seed BKT priors from self-ratings, generate diagnostic quiz.

        Args:
            ratings: List of {concept: str, rating: int (1-5)}
        """
        # Seed BKT priors
        for item in ratings:
            concept = item.get("concept", "")
            rating = item.get("rating", 3)
            await self.bkt.seed_from_assessment(
                student_name=student_name,
                concept=concept,
                self_rating=rating,
            )
        await self.db.flush()

        # Generate diagnostic quiz for uncertain concepts
        concepts_with_ratings = [
            {"concept": r["concept"], "rating": r["rating"]}
            for r in ratings
        ]
        diagnostic_questions = self.agent.generate_diagnostic_quiz(
            concepts_with_ratings, count=6
        )

        # Store assessment record
        from ..db_models_assessment import FamiliarityAssessment
        overall = sum(r.get("rating", 3) for r in ratings) / max(len(ratings), 1) / 5.0

        assessment = FamiliarityAssessment(
            student_name=student_name,
            subject=subject,
            self_ratings_json=[
                {"concept": r["concept"], "rating": r["rating"]}
                for r in ratings
            ],
            overall_familiarity=overall,
            concepts_assessed=len(ratings),
        )
        self.db.add(assessment)
        await self.db.commit()
        await self.db.refresh(assessment)

        return {
            "assessment_id": str(assessment.id),
            "subject": subject,
            "diagnostic_questions": diagnostic_questions,
            "total_questions": len(diagnostic_questions),
            "concepts_assessed": len(ratings),
            "initial_familiarity": round(overall, 2),
        }

    async def submit_diagnostic_answers(
        self,
        student_name: str,
        assessment_id: str,
        answers: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Step 3: Grade diagnostic answers, adjust BKT, return summary.

        Args:
            answers: List of {concept, answer, correct_answer, time_ms}
        """
        from ..db_models_assessment import FamiliarityAssessment

        # Load assessment
        query = select(FamiliarityAssessment).where(
            FamiliarityAssessment.id == uuid.UUID(assessment_id)
        )
        result = await self.db.execute(query)
        assessment = result.scalars().first()
        if not assessment:
            return {"error": "Assessment not found"}

        # Grade and adjust BKT
        results = []
        correct_count = 0
        for ans in answers:
            concept = ans.get("concept", "")
            student_answer = ans.get("answer", "")
            correct_answer = ans.get("correct_answer", "")
            time_ms = ans.get("time_ms", 0)
            is_correct = student_answer.strip().upper() == correct_answer.strip().upper()

            if is_correct:
                correct_count += 1

            # Adjust BKT based on diagnostic result
            await self.bkt.seed_from_assessment(
                student_name=student_name,
                concept=concept,
                self_rating=None,
                diagnostic_correct=is_correct,
            )

            results.append({
                "concept": concept,
                "answer": student_answer,
                "is_correct": is_correct,
                "time_ms": time_ms,
            })

        # Update assessment record
        assessment.diagnostic_results_json = results
        assessment.diagnostic_accuracy = correct_count / max(len(answers), 1)
        assessment.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        # Build summary
        diagnostic_accuracy = round(correct_count / max(len(answers), 1) * 100)

        return {
            "assessment_id": assessment_id,
            "subject": assessment.subject,
            "diagnostic_results": results,
            "diagnostic_accuracy": diagnostic_accuracy,
            "total_questions": len(answers),
            "correct_count": correct_count,
            "overall_familiarity": round(assessment.overall_familiarity, 2),
            "completed": True,
        }

    async def get_assessment(
        self, subject: str, student_name: str
    ) -> Optional[Dict[str, Any]]:
        """Get the latest assessment for a student+subject."""
        from ..db_models_assessment import FamiliarityAssessment

        query = (
            select(FamiliarityAssessment)
            .where(
                FamiliarityAssessment.student_name == student_name,
                FamiliarityAssessment.subject == subject,
            )
            .order_by(FamiliarityAssessment.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        assessment = result.scalars().first()
        if not assessment:
            return None

        return {
            "id": str(assessment.id),
            "subject": assessment.subject,
            "student_name": assessment.student_name,
            "self_ratings": assessment.self_ratings_json,
            "diagnostic_results": assessment.diagnostic_results_json,
            "overall_familiarity": round(assessment.overall_familiarity, 2),
            "diagnostic_accuracy": round(assessment.diagnostic_accuracy * 100) if assessment.diagnostic_accuracy else None,
            "concepts_assessed": assessment.concepts_assessed,
            "completed": assessment.completed_at is not None,
            "created_at": assessment.created_at.isoformat() if assessment.created_at else None,
        }

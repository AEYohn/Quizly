"""
Skill Tree Analytics Service
=============================
Aggregates mastery, misconceptions, spaced repetition, and session data
to produce a comprehensive analysis of a student's skill tree progress.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, select

from ..utils.llm_utils import GEMINI_AVAILABLE, call_gemini_with_timeout

from ..db_models import (
    ConceptMastery,
    LearningSession,
    SpacedRepetitionItem,
    StudentMisconception,
    SyllabusCache,
)
from ..logging_config import get_logger
from ..sentry_config import capture_exception

logger = get_logger(__name__)


class SkillTreeAnalyticsService:
    """Aggregates analytics for a student's skill tree."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_analysis(
        self, subject: str, student_name: str
    ) -> Dict[str, Any]:
        """Build full skill tree analysis for a student+subject."""

        # Fetch syllabus to know which concepts belong to this subject
        syllabus_concepts = await self._get_syllabus_concepts(subject)

        # Run all queries concurrently-ish (sequential for SQLite compat)
        mastery_rows = await self._get_mastery(student_name, syllabus_concepts)
        misconceptions = await self._get_misconceptions(student_name, syllabus_concepts)
        overdue_items = await self._get_overdue_items(student_name, syllabus_concepts)
        sessions = await self._get_sessions(student_name, subject)

        # Build summary counts
        mastery_map: Dict[str, Dict[str, Any]] = {}
        for row in mastery_rows:
            mastery_map[row.concept] = {
                "mastery_score": round(row.mastery_score, 1),
                "total_attempts": row.total_attempts,
                "correct_attempts": row.correct_attempts,
                "p_learned": round(row.p_learned, 3),
                "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
            }

        overdue_concepts = {item.concept for item in overdue_items}

        mastered = sum(1 for m in mastery_rows if m.mastery_score >= 80)
        in_progress = sum(1 for m in mastery_rows if 30 <= m.mastery_score < 80)
        struggling = sum(1 for m in mastery_rows if m.mastery_score < 30 and m.total_attempts > 0)
        overdue_count = len(overdue_items)

        total_concepts = len(syllabus_concepts) if syllabus_concepts else len(mastery_rows)
        overall_mastery_pct = (
            round(sum(m.mastery_score for m in mastery_rows) / max(1, total_concepts))
            if mastery_rows
            else 0
        )

        # Trend from recent sessions
        trend = self._compute_trend(sessions)

        # Weaknesses: concepts with mastery < 60, sorted by mastery ascending
        weaknesses = []
        for row in sorted(mastery_rows, key=lambda r: r.mastery_score):
            if row.mastery_score >= 60:
                continue
            concept_misconceptions = [
                {
                    "type": m.misconception,
                    "severity": self._infer_severity(m.occurrence_count),
                    "count": m.occurrence_count,
                }
                for m in misconceptions
                if m.concept == row.concept and not m.is_resolved
            ]
            weaknesses.append({
                "concept": row.concept,
                "mastery_score": round(row.mastery_score, 1),
                "total_attempts": row.total_attempts,
                "active_misconceptions": concept_misconceptions,
                "is_overdue": row.concept in overdue_concepts,
            })
            if len(weaknesses) >= 10:
                break

        # Strengths: concepts with mastery >= 80
        strengths = []
        for row in sorted(mastery_rows, key=lambda r: -r.mastery_score):
            if row.mastery_score < 80:
                break
            strengths.append({
                "concept": row.concept,
                "mastery_score": round(row.mastery_score, 1),
                "best_streak": row.correct_attempts,
            })
            if len(strengths) >= 8:
                break

        # Misconceptions summary (active only)
        active_misconceptions = [m for m in misconceptions if not m.is_resolved]
        misconceptions_summary = [
            {
                "concept": m.concept,
                "misconception": m.misconception,
                "occurrence_count": m.occurrence_count,
                "severity": self._infer_severity(m.occurrence_count),
                "first_seen_at": m.first_seen_at.isoformat() if m.first_seen_at else None,
            }
            for m in sorted(active_misconceptions, key=lambda x: -x.occurrence_count)[:10]
        ]

        # Mastery timeline from sessions
        mastery_timeline = self._build_timeline(sessions)

        # AI insights (best-effort, degrade gracefully)
        ai_insights = await self._generate_ai_insights(
            subject=subject,
            overall_mastery_pct=overall_mastery_pct,
            trend=trend,
            weaknesses=weaknesses[:5],
            strengths=strengths[:5],
            misconceptions_summary=misconceptions_summary[:5],
            overdue_count=overdue_count,
        )

        return {
            "overall_mastery_pct": overall_mastery_pct,
            "trend": trend,
            "summary": {
                "mastered": mastered,
                "in_progress": in_progress,
                "struggling": struggling,
                "overdue": overdue_count,
            },
            "weaknesses": weaknesses,
            "strengths": strengths,
            "misconceptions_summary": misconceptions_summary,
            "ai_insights": ai_insights,
            "mastery_timeline": mastery_timeline,
        }

    # ------------------------------------------------------------------
    # Data queries
    # ------------------------------------------------------------------

    async def _get_syllabus_concepts(self, subject: str) -> List[str]:
        """Extract concept/topic names from the cached syllabus tree."""
        query = select(SyllabusCache).where(
            func.lower(SyllabusCache.subject) == subject.lower()
        ).limit(1)
        result = await self.db.execute(query)
        cache = result.scalars().first()
        if not cache:
            return []

        tree = cache.tree_json
        concepts: List[str] = []
        for unit in tree.get("units", []):
            for topic in unit.get("topics", []):
                concepts.append(topic.get("name", topic.get("id", "")))
                for c in topic.get("concepts", []):
                    if isinstance(c, str):
                        concepts.append(c)
        return concepts

    async def _get_mastery(
        self, student_name: str, concepts: List[str]
    ) -> List[Any]:
        """Get mastery rows for the student, optionally filtered to subject concepts."""
        query = select(ConceptMastery).where(
            ConceptMastery.student_name == student_name
        )
        if concepts:
            query = query.where(ConceptMastery.concept.in_(concepts))
        query = query.order_by(ConceptMastery.mastery_score.asc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _get_misconceptions(
        self, student_name: str, concepts: List[str]
    ) -> List[Any]:
        query = select(StudentMisconception).where(
            StudentMisconception.student_name == student_name
        )
        if concepts:
            query = query.where(StudentMisconception.concept.in_(concepts))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _get_overdue_items(
        self, student_name: str, concepts: List[str]
    ) -> List[Any]:
        now = datetime.now(timezone.utc)
        query = select(SpacedRepetitionItem).where(
            and_(
                SpacedRepetitionItem.student_name == student_name,
                SpacedRepetitionItem.next_review_at <= now,
            )
        )
        if concepts:
            query = query.where(SpacedRepetitionItem.concept.in_(concepts))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _get_sessions(
        self, student_name: str, subject: str
    ) -> List[Any]:
        """Get recent sessions for this subject (including subtopics)."""
        query = (
            select(LearningSession)
            .where(
                and_(
                    LearningSession.student_name == student_name,
                    LearningSession.questions_answered > 0,
                )
            )
            .order_by(LearningSession.created_at.desc())
            .limit(50)
        )
        result = await self.db.execute(query)
        all_sessions = list(result.scalars().all())
        # Filter to sessions that match the subject or are subtopics
        subject_lower = subject.lower()
        return [
            s for s in all_sessions
            if s.topic.lower() == subject_lower
            or s.topic.lower().startswith(subject_lower + ": ")
        ]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _compute_trend(self, sessions: List[Any]) -> str:
        """Determine if the student is improving, stable, or declining."""
        if len(sessions) < 3:
            return "stable"

        recent_3 = sessions[:3]
        older_3 = sessions[3:6] if len(sessions) >= 6 else sessions[3:]

        recent_acc = sum(
            s.questions_correct / max(1, s.questions_answered) for s in recent_3
        ) / len(recent_3)

        if not older_3:
            return "stable"

        older_acc = sum(
            s.questions_correct / max(1, s.questions_answered) for s in older_3
        ) / len(older_3)

        diff = recent_acc - older_acc
        if diff > 0.08:
            return "improving"
        elif diff < -0.08:
            return "declining"
        return "stable"

    def _infer_severity(self, occurrence_count: int) -> str:
        if occurrence_count >= 5:
            return "high"
        if occurrence_count >= 2:
            return "moderate"
        return "low"

    def _build_timeline(self, sessions: List[Any]) -> List[Dict[str, Any]]:
        """Build daily mastery timeline from session history."""
        if not sessions:
            return []

        # Group sessions by date
        date_map: Dict[str, List[Any]] = {}
        for s in reversed(sessions):  # oldest first
            dt = s.started_at or s.created_at
            if dt and dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            date_key = dt.strftime("%Y-%m-%d") if dt else "unknown"
            date_map.setdefault(date_key, []).append(s)

        timeline = []
        for date_key, day_sessions in date_map.items():
            total_q = sum(s.questions_answered for s in day_sessions)
            total_c = sum(s.questions_correct for s in day_sessions)
            acc = round(total_c / max(1, total_q) * 100)
            timeline.append({"date": date_key, "overall": acc})

        return timeline[-30:]  # Last 30 data points

    async def _generate_ai_insights(
        self,
        subject: str,
        overall_mastery_pct: int,
        trend: str,
        weaknesses: List[Dict],
        strengths: List[Dict],
        misconceptions_summary: List[Dict],
        overdue_count: int,
    ) -> Dict[str, Any]:
        """Generate AI-powered insights via Gemini."""
        if not GEMINI_AVAILABLE:
            return self._fallback_insights(
                overall_mastery_pct, trend, weaknesses, strengths, overdue_count
            )

        prompt = f"""You are a learning analytics AI. Analyze this student's progress in "{subject}" and provide actionable insights.

Data:
- Overall mastery: {overall_mastery_pct}%
- Trend: {trend}
- Weak concepts: {json.dumps(weaknesses[:5], default=str)}
- Strong concepts: {json.dumps(strengths[:5], default=str)}
- Active misconceptions: {json.dumps(misconceptions_summary[:5], default=str)}
- Overdue for review: {overdue_count} concepts

Return ONLY a JSON object (no markdown fences) with this structure:
{{
    "summary": "2-3 sentence summary of the student's state — what's going well and what needs work.",
    "recommendations": ["1-2 sentence actionable recommendation", ...],
    "overconfidence_alerts": ["Alert about concepts where student may be overconfident", ...],
    "pattern_insights": ["Pattern observation about learning style or common mistakes", ...]
}}

Keep it concise, encouraging, and specific. Max 3 recommendations, 2 overconfidence alerts, 2 pattern insights."""

        try:
            response = await call_gemini_with_timeout(prompt)
            if not response:
                return self._fallback_insights(
                    overall_mastery_pct, trend, weaknesses, strengths, overdue_count
                )
            text = response.text.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3].strip()
            if text.startswith("json"):
                text = text[4:].strip()

            data = json.loads(text)
            return {
                "summary": data.get("summary", ""),
                "recommendations": data.get("recommendations", [])[:3],
                "overconfidence_alerts": data.get("overconfidence_alerts", [])[:2],
                "pattern_insights": data.get("pattern_insights", [])[:2],
            }
        except Exception as e:
            capture_exception(e, context={
                "service": "skill_tree_analytics",
                "operation": "generate_ai_insights",
                "subject": subject,
            })
            logger.warning(f"AI insights generation failed: {e}")
            return self._fallback_insights(
                overall_mastery_pct, trend, weaknesses, strengths, overdue_count
            )

    def _fallback_insights(
        self,
        overall_mastery_pct: int,
        trend: str,
        weaknesses: List[Dict],
        strengths: List[Dict],
        overdue_count: int,
    ) -> Dict[str, Any]:
        """Rule-based fallback when Gemini is unavailable."""
        summary_parts = []
        if overall_mastery_pct >= 70:
            summary_parts.append(f"You're making strong progress at {overall_mastery_pct}% overall mastery.")
        elif overall_mastery_pct >= 40:
            summary_parts.append(f"You're building knowledge at {overall_mastery_pct}% overall mastery.")
        else:
            summary_parts.append(f"You're getting started at {overall_mastery_pct}% overall mastery.")

        if trend == "improving":
            summary_parts.append("Your recent performance shows an upward trend.")
        elif trend == "declining":
            summary_parts.append("Your recent accuracy has dipped — consider revisiting weak areas.")

        recommendations = []
        if weaknesses:
            top_weak = weaknesses[0]["concept"]
            recommendations.append(f"Focus on \"{top_weak}\" — it has your lowest mastery score.")
        if overdue_count > 0:
            recommendations.append(f"Review {overdue_count} overdue concept{'s' if overdue_count != 1 else ''} to maintain retention.")
        if not recommendations:
            recommendations.append("Keep up the good work! Try advancing to new topics.")

        return {
            "summary": " ".join(summary_parts),
            "recommendations": recommendations[:3],
            "overconfidence_alerts": [],
            "pattern_insights": [],
        }

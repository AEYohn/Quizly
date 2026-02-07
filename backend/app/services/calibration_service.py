"""
Calibration Service — Dunning-Kruger detection and calibration metrics.

Computes:
- Brier score (lower = better calibrated)
- Expected Calibration Error (ECE)
- Per-concept DK (overconfidence) detection
- Calibration buckets for visualization
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db_models import LearningSession


BUCKETS = [
    {"range": "0-20", "lo": 0, "hi": 20, "midpoint": 0.1},
    {"range": "20-40", "lo": 20, "hi": 40, "midpoint": 0.3},
    {"range": "40-60", "lo": 40, "hi": 60, "midpoint": 0.5},
    {"range": "60-80", "lo": 60, "hi": 80, "midpoint": 0.7},
    {"range": "80-100", "lo": 80, "hi": 101, "midpoint": 0.9},
]


def compute_calibration(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute calibration metrics from confidence records.

    Returns buckets, Brier score, ECE, and overconfidence index.
    """
    if not records:
        return {
            "buckets": [],
            "brier_score": 0.0,
            "ece": 0.0,
            "overconfidence_index": 0.0,
            "total_responses": 0,
        }

    # Brier score: mean((confidence/100 - is_correct)^2)
    brier_sum = 0.0
    overconf_sum = 0.0
    for r in records:
        p = r["confidence"] / 100.0
        outcome = 1.0 if r["is_correct"] else 0.0
        brier_sum += (p - outcome) ** 2
        overconf_sum += max(0.0, p - outcome)

    brier_score = brier_sum / len(records)
    overconfidence_index = overconf_sum / len(records)

    # Bucket calibration
    bucket_results = []
    ece_sum = 0.0
    for bucket in BUCKETS:
        bucket_records = [
            r for r in records
            if bucket["lo"] <= r["confidence"] < bucket["hi"]
        ]
        if not bucket_records:
            bucket_results.append({
                "range": bucket["range"],
                "midpoint": bucket["midpoint"],
                "count": 0,
                "accuracy": 0.0,
            })
            continue

        count = len(bucket_records)
        accuracy = sum(1 for r in bucket_records if r["is_correct"]) / count
        avg_conf = sum(r["confidence"] for r in bucket_records) / count / 100.0

        bucket_results.append({
            "range": bucket["range"],
            "midpoint": bucket["midpoint"],
            "count": count,
            "accuracy": round(accuracy, 3),
        })

        # ECE: weighted |accuracy - avg_confidence|
        ece_sum += count * abs(accuracy - avg_conf)

    ece = ece_sum / len(records) if records else 0.0

    return {
        "buckets": bucket_results,
        "brier_score": round(brier_score, 4),
        "ece": round(ece, 4),
        "overconfidence_index": round(overconfidence_index, 4),
        "total_responses": len(records),
    }


def detect_dk_concepts(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detect Dunning-Kruger overconfident concepts.

    A concept is DK-flagged when avg_confidence - accuracy > 25pp with ≥3 attempts.
    """
    # Group by concept
    by_concept: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        concept = r.get("concept", "unknown")
        by_concept.setdefault(concept, []).append(r)

    dk_concepts = []
    for concept, concept_records in by_concept.items():
        if len(concept_records) < 3:
            continue

        avg_confidence = sum(r["confidence"] for r in concept_records) / len(concept_records)
        accuracy = sum(1 for r in concept_records if r["is_correct"]) / len(concept_records) * 100
        dk_score = max(0.0, avg_confidence - accuracy) / 100.0

        if avg_confidence - accuracy >= 25:
            dk_concepts.append({
                "concept": concept,
                "avg_confidence": round(avg_confidence, 1),
                "accuracy": round(accuracy, 1),
                "dk_score": round(dk_score, 3),
            })

    # Sort by dk_score descending
    dk_concepts.sort(key=lambda x: x["dk_score"], reverse=True)
    return dk_concepts


class CalibrationService:
    """Aggregates calibration data from sessions for the profile view."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_student_calibration(
        self,
        student_name: str,
        subject: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get full calibration data for a student's profile.

        Aggregates confidence_records from all scroll sessions.
        """
        # Fetch all sessions for this student
        query = select(LearningSession).where(
            LearningSession.student_name == student_name,
            LearningSession.questions_answered > 0,
        )
        if subject:
            query = query.where(LearningSession.topic == subject)

        result = await self.db.execute(query)
        sessions = result.scalars().all()

        # Collect all confidence records across sessions
        all_records: List[Dict[str, Any]] = []
        for session in sessions:
            state = session.state_json or {}
            records = state.get("confidence_records", [])
            all_records.extend(records)

        calibration = compute_calibration(all_records)
        dk_concepts = detect_dk_concepts(all_records)

        return {
            "calibration": calibration,
            "dk_concepts": dk_concepts,
        }

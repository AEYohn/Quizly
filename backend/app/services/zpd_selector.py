"""
Zone of Proximal Development (ZPD) Difficulty Selector.

IRT-inspired difficulty targeting. Goal: select difficulty so
P(correct) ≈ 0.65 — the "zone of proximal development" sweet spot
where material is challenging but achievable.

Based on Vygotsky 1978, IRT models.

Engagement adjustments:
  - Streak ≥ 5: target_p drops to 0.55 (harder, prevent boredom)
  - 2+ wrong in a row: target_p rises to 0.75 (easier, prevent frustration)
  - Avg response_time < 2s: target_p drops to 0.5 (too easy)
"""

import math
from typing import Any, Dict

from .bkt_engine import BKTState


def _logit(p: float) -> float:
    """Log-odds transform. Clamp to avoid ±inf."""
    p = max(0.01, min(0.99, p))
    return math.log(p / (1 - p))


def _inv_logit(x: float) -> float:
    """Inverse logit (sigmoid)."""
    return 1.0 / (1.0 + math.exp(-x))


class ZPDSelector:
    """Select optimal difficulty for a student on a concept."""

    BASE_TARGET_P = 0.65

    def select_difficulty(
        self,
        bkt_state: BKTState,
        feed_state_dict: Dict[str, Any],
    ) -> float:
        """
        Compute the optimal difficulty level.

        Returns a float in [0.1, 0.95] representing question difficulty.
        """
        target_p = self.BASE_TARGET_P

        # --- Engagement-based adjustments ---
        streak = feed_state_dict.get("streak", 0)
        concept = bkt_state.concept
        concept_stats = feed_state_dict.get("concept_stats", {}).get(concept, {})
        wrong_streak = concept_stats.get("wrong_streak", 0)
        avg_time_ms = feed_state_dict.get("avg_time_ms", 5000.0)

        # --- Dunning-Kruger "Prove It" override ---
        confidence_records = feed_state_dict.get("confidence_records", [])
        concept_records = [r for r in confidence_records if r.get("concept") == concept]
        if len(concept_records) >= 3:
            avg_conf = sum(r["confidence"] for r in concept_records) / len(concept_records)
            accuracy = sum(1 for r in concept_records if r["is_correct"]) / len(concept_records) * 100
            if (avg_conf - accuracy) / 100.0 > 0.25:
                target_p = 0.50  # "Prove it" — harder than normal

        if streak >= 5:
            # Student is on a roll — push harder to prevent boredom
            target_p = min(target_p, 0.55)
        elif wrong_streak >= 2:
            # Struggling — back off to prevent frustration
            target_p = 0.75

        if avg_time_ms < 2000:
            # Answering very fast — probably too easy
            target_p = min(target_p, 0.50)

        # --- IRT difficulty mapping ---
        # Student ability θ = logit(P(L))
        theta = _logit(bkt_state.p_learned)
        # Optimal item difficulty: θ - logit(target_p)
        optimal_b = theta - _logit(target_p)

        # Map difficulty parameter to [0.1, 0.95] range
        # b in [-4, 4] → difficulty in [0.1, 0.95]
        difficulty = _inv_logit(optimal_b * 0.5)  # compress range
        difficulty = max(0.1, min(0.95, difficulty))

        return difficulty

    def adjust_for_response(
        self,
        current_difficulty: float,
        is_correct: bool,
        response_time_ms: int,
        streak: int,
    ) -> float:
        """
        Quick micro-adjustment after a single answer.
        Used as a supplement when full BKT update isn't available yet.
        """
        delta = 0.0

        if is_correct:
            delta += 0.03
            if response_time_ms > 0 and response_time_ms < 2000:
                delta += 0.02  # Too easy
        else:
            delta -= 0.05  # Drop faster on mistakes

        # Streak bonus
        if streak >= 3:
            delta += 0.01

        new_diff = current_difficulty + delta
        return max(0.1, min(0.95, new_diff))

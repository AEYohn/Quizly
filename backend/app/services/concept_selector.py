"""
Thompson Sampling Concept Selector.

Multi-armed bandit for "which concept should I show next?"

Each concept arm tracks:
  α = learning events (mastery increased after showing)
  β = non-learning events (mastery stayed flat or decreased)

Selection uses Thompson Sampling: sample from Beta(α, β) and pick the
concept with the highest sampled "learning potential", weighted by ZPD
fit and recency.
"""

import random
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db_models import ConceptMastery
from .bkt_engine import BKTState
from .knowledge_graph import KnowledgeGraph


def _beta_sample(alpha: float, beta: float) -> float:
    """Sample from Beta distribution. Handles degenerate cases."""
    a = max(0.01, alpha)
    b = max(0.01, beta)
    return random.betavariate(a, b)


class ConceptSelector:
    """Thompson Sampling-based concept selection."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def select(
        self,
        available_concepts: List[str],
        bkt_states: Dict[str, BKTState],
        knowledge_graph: Optional[KnowledgeGraph],
        feed_state_dict: Dict[str, Any],
    ) -> str:
        """
        Pick the best concept to show next.

        Combines Thompson Sampling with ZPD weighting and recency penalty.
        """
        if not available_concepts:
            return "general"

        # Filter to ready concepts if we have a knowledge graph
        if knowledge_graph:
            mastery_floats = {
                c: bkt_states[c].p_learned if c in bkt_states else 0.0
                for c in available_concepts
            }
            ready = knowledge_graph.get_ready_concepts(mastery_floats)
            # Fall back to all concepts if nothing is ready (shouldn't happen)
            candidates = ready if ready else available_concepts
        else:
            candidates = available_concepts

        # Check reintroduction queue first
        reintro_queue = feed_state_dict.get("reintroduction_queue", [])
        for item in reintro_queue:
            if item.get("cooldown", 1) <= 0 and item.get("concept") in candidates:
                return item["concept"]

        # Score each candidate via Thompson Sampling
        concept_stats = feed_state_dict.get("concept_stats", {})
        cards_shown = feed_state_dict.get("cards_shown", 0)

        scores: Dict[str, float] = {}
        for c in candidates:
            state = bkt_states.get(c)
            alpha = state.ts_alpha if state else 1.0
            beta_val = state.ts_beta if state else 1.0

            # Thompson sample: higher uncertainty = more exploration
            learning_potential = _beta_sample(alpha, beta_val)

            # ZPD bonus: concepts near mastery threshold are most valuable
            p_l = state.p_learned if state else 0.1
            zpd_bonus = 1.0 if 0.3 < p_l < 0.7 else 0.5

            # Recency penalty: avoid showing the same concept repeatedly
            stats = concept_stats.get(c, {})
            attempts = stats.get("attempts", 0)
            recency_penalty = 1.0 / (1 + attempts) if cards_shown > 0 else 1.0

            scores[c] = learning_potential * zpd_bonus * (1 - 0.3 * recency_penalty)

        return max(scores, key=scores.get)  # type: ignore[arg-type]

    async def update_reward(
        self,
        student_name: str,
        concept: str,
        learning_gain: float,
    ) -> None:
        """
        Update Thompson Sampling arms based on observed learning gain.

        learning_gain > 0 → reward (α += 1)
        learning_gain ≤ 0 → no reward (β += 1)
        """
        query = select(ConceptMastery).where(
            ConceptMastery.student_name == student_name,
            ConceptMastery.concept == concept,
        )
        result = await self.db.execute(query)
        row = result.scalars().first()

        if row is None:
            return

        if learning_gain > 0.01:
            row.ts_alpha += 1.0
        else:
            row.ts_beta += 1.0

        await self.db.flush()

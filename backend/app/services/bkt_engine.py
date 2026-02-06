"""
Bayesian Knowledge Tracing (BKT) Engine.

Per-concept mastery estimation based on Corbett & Anderson 1994.

Four parameters per concept:
    P(L₀) = 0.1   — prior knowledge
    P(T)  = 0.2   — probability of learning on each opportunity
    P(G)  = 0.15  — probability of guessing correctly
    P(S)  = 0.1   — probability of slipping (knows but answers wrong)

Update rule after observing correct/incorrect:
    P(L|correct) = P(L)*(1-P(S)) / [P(L)*(1-P(S)) + (1-P(L))*P(G)]
    P(L|wrong)   = P(L)*P(S)     / [P(L)*P(S)     + (1-P(L))*(1-P(G))]
    P(Lₙ)        = P(L|obs) + (1 - P(L|obs)) * P(T)
"""

from dataclasses import dataclass
from typing import Dict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db_models import ConceptMastery


@dataclass
class BKTState:
    """Snapshot of BKT parameters for a single concept."""
    concept: str
    p_learned: float = 0.1
    p_guess: float = 0.15
    p_slip: float = 0.1
    p_transit: float = 0.2
    # Thompson Sampling arms
    ts_alpha: float = 1.0
    ts_beta: float = 1.0


class BKTEngine:
    """Bayesian Knowledge Tracing engine backed by the ConceptMastery table."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def update(
        self,
        student_name: str,
        concept: str,
        is_correct: bool,
        response_time_ms: int = 0,
    ) -> BKTState:
        """
        Run one BKT update step for (student, concept).

        Returns the updated BKTState.
        """
        row = await self._get_or_create(student_name, concept)

        p_l = row.p_learned
        p_g = row.p_guess
        p_s = row.p_slip
        p_t = row.p_transit

        # --- Posterior P(L | observation) ---
        if is_correct:
            numerator = p_l * (1 - p_s)
            denominator = p_l * (1 - p_s) + (1 - p_l) * p_g
        else:
            numerator = p_l * p_s
            denominator = p_l * p_s + (1 - p_l) * (1 - p_g)

        p_l_given_obs = numerator / max(denominator, 1e-9)

        # --- Learning transition ---
        p_l_new = p_l_given_obs + (1 - p_l_given_obs) * p_t

        # Clamp to [0.01, 0.99] to avoid degenerate states
        p_l_new = max(0.01, min(0.99, p_l_new))

        # --- Response-time hint: fast correct = maybe guessing ---
        if is_correct and response_time_ms > 0 and response_time_ms < 1500:
            # Very fast correct — might be guessing; nudge p_guess up slightly
            row.p_guess = min(0.4, p_g + 0.005)
        elif not is_correct and response_time_ms > 10000:
            # Very slow incorrect — genuine struggle; nudge p_slip down
            row.p_slip = max(0.02, p_s - 0.005)

        # Persist
        row.p_learned = p_l_new
        row.mastery_score = p_l_new * 100  # keep legacy 0-100 column in sync
        row.total_attempts += 1
        if is_correct:
            row.correct_attempts += 1

        from ..db_models import utc_now
        row.last_seen_at = utc_now()

        await self.db.flush()

        return BKTState(
            concept=concept,
            p_learned=row.p_learned,
            p_guess=row.p_guess,
            p_slip=row.p_slip,
            p_transit=row.p_transit,
            ts_alpha=row.ts_alpha,
            ts_beta=row.ts_beta,
        )

    def get_mastery(self, state: BKTState) -> float:
        """Return P(L) — the probability the student has learned the concept."""
        return state.p_learned

    async def get_all_masteries(self, student_name: str) -> Dict[str, BKTState]:
        """Load all BKT states for a student."""
        query = select(ConceptMastery).where(
            ConceptMastery.student_name == student_name
        )
        result = await self.db.execute(query)
        rows = result.scalars().all()

        return {
            row.concept: BKTState(
                concept=row.concept,
                p_learned=row.p_learned,
                p_guess=row.p_guess,
                p_slip=row.p_slip,
                p_transit=row.p_transit,
                ts_alpha=row.ts_alpha,
                ts_beta=row.ts_beta,
            )
            for row in rows
        }

    def estimate_confidence(self, state: BKTState) -> float:
        """
        Posterior variance as a proxy for uncertainty.

        For a Bernoulli with P(L), variance = P(L) * (1-P(L)).
        Returns value in [0, 0.25]; lower = more confident.
        """
        p = state.p_learned
        return p * (1 - p)

    # ------------------------------------------------------------------
    # Assessment seeding
    # ------------------------------------------------------------------

    # Self-rating → P(L0) mapping
    RATING_TO_P_L0 = {
        1: 0.05,  # Never heard of it
        2: 0.15,  # Heard of it
        3: 0.35,  # Can explain basics
        4: 0.60,  # Can apply it
        5: 0.80,  # Can teach it
    }

    async def seed_from_assessment(
        self,
        student_name: str,
        concept: str,
        self_rating: int | None = None,
        diagnostic_correct: bool | None = None,
    ) -> BKTState:
        """
        Seed or adjust BKT prior from familiarity assessment.

        - self_rating (1-5): Sets initial P(L0)
        - diagnostic_correct: Nudges P(L) after diagnostic quiz
          - Correct: +0.10
          - Wrong: -0.15 (overconfidence penalty)
        """
        row = await self._get_or_create(student_name, concept)

        if self_rating is not None:
            p_l0 = self.RATING_TO_P_L0.get(self_rating, 0.35)
            row.p_learned = p_l0
            row.mastery_score = p_l0 * 100

        if diagnostic_correct is not None:
            if diagnostic_correct:
                row.p_learned = min(0.99, row.p_learned + 0.10)
            else:
                row.p_learned = max(0.01, row.p_learned - 0.15)
            row.mastery_score = row.p_learned * 100

        await self.db.flush()

        return BKTState(
            concept=concept,
            p_learned=row.p_learned,
            p_guess=row.p_guess,
            p_slip=row.p_slip,
            p_transit=row.p_transit,
            ts_alpha=row.ts_alpha,
            ts_beta=row.ts_beta,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_or_create(
        self, student_name: str, concept: str
    ) -> ConceptMastery:
        """Fetch existing row or create a new one with BKT defaults."""
        query = select(ConceptMastery).where(
            ConceptMastery.student_name == student_name,
            ConceptMastery.concept == concept,
        )
        result = await self.db.execute(query)
        row = result.scalars().first()

        if row is None:
            row = ConceptMastery(
                student_name=student_name,
                concept=concept,
                mastery_score=10.0,  # P(L₀) = 0.1 → 10%
                p_learned=0.1,
                p_guess=0.15,
                p_slip=0.1,
                p_transit=0.2,
                ts_alpha=1.0,
                ts_beta=1.0,
            )
            self.db.add(row)
            await self.db.flush()

        return row

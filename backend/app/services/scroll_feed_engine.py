"""
Scroll Feed Engine — TikTok-style adaptive question feed.

Design philosophy (learned from TikTok's algorithm):
1. INSTANT FEEDBACK — no waiting, answer → result → next card
2. VARIABLE RATIO REINFORCEMENT — mix easy wins with challenges
3. STREAK MECHANICS — build momentum with correct answer streaks
4. SMART REINTRODUCTION — wrong answers come back later at lower difficulty
5. NOVELTY + FAMILIARITY — mix new concepts with review
6. OPTIMAL DIFFICULTY — keep the "flow state" zone (not too easy, not too hard)
7. SESSION MOMENTUM — difficulty ramps gradually, never cliff drops

The algorithm works like a recommendation engine:
- Each card has a "show probability" based on mastery, recency, difficulty
- Wrong answers get queued for reintroduction with a decay timer
- Streak bonuses push toward harder content
- Fatigue detection switches topics for variety
"""

import os
import json
import uuid
import random
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..utils.llm_utils import call_gemini_with_timeout

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..cache import CacheService

from ..db_models import (
    LearningSession,
    ConceptMastery,
)
from ..services.adaptive_learning_service import AdaptiveLearningService
from ..services.bkt_engine import BKTEngine
from ..services.zpd_selector import ZPDSelector
from ..services.concept_selector import ConceptSelector
from ..services.knowledge_graph import KnowledgeGraph
from ..ai_agents.question_generator import QuestionBankGenerator

try:
    import google.generativeai as genai

    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = get_logger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    FEED_MODEL = genai.GenerativeModel("gemini-2.0-flash")
else:
    FEED_MODEL = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Feed State
# ---------------------------------------------------------------------------


@dataclass
class ScrollCard:
    """A single card in the scroll feed."""
    id: str
    question: Dict[str, Any]
    concept: str
    difficulty: float
    card_type: str = "question"  # question, review, streak_bonus, insight, flashcard, info_card
    is_reintroduction: bool = False
    xp_value: int = 10
    content_item_id: Optional[str] = None  # link to shared pool item


FEED_STATE_VERSION = 2


@dataclass
class FeedState:
    """Full state of the scroll feed — stored as JSON in LearningSession."""

    # Schema version — bump when adding/removing/renaming fields
    version: int = FEED_STATE_VERSION

    # Topic and concepts
    concepts: List[str] = field(default_factory=list)
    notes_context: str = ""

    # Difficulty algorithm (like TikTok's engagement optimization)
    base_difficulty: float = 0.4
    current_difficulty: float = 0.4
    difficulty_momentum: float = 0.0  # positive = trending harder

    # Streak mechanics
    streak: int = 0
    best_streak: int = 0
    total_xp: int = 0

    # Performance tracking per concept
    concept_stats: Dict[str, Dict[str, int]] = field(default_factory=dict)
    # {"photosynthesis": {"attempts": 3, "correct": 2, "wrong_streak": 0}}

    # Reintroduction queue (wrong answers come back later)
    reintroduction_queue: List[Dict[str, Any]] = field(default_factory=list)
    # [{"concept": "x", "misconception": "y", "cooldown": 3, "difficulty": 0.3}]

    # Card history for avoiding repetition
    previous_prompts: List[str] = field(default_factory=list)
    cards_shown: int = 0

    # Engagement metrics (for the algorithm)
    avg_time_ms: float = 5000.0
    fast_answers: int = 0  # Answered < 2s (probably too easy)
    slow_answers: int = 0  # Answered > 15s (probably too hard)

    # Topic rotation (prevent fatigue on one concept)
    current_concept_idx: int = 0
    cards_on_current_concept: int = 0

    # Content pool tracking
    content_type_counts: Dict[str, int] = field(default_factory=dict)  # {"mcq": 5, "flashcard": 2, ...}
    served_content_ids: List[str] = field(default_factory=list)
    skipped_content_ids: List[str] = field(default_factory=list)
    not_interested_topics: List[str] = field(default_factory=list)

    # User preferences (from feed tuning controls)
    user_preferences: Dict[str, Any] = field(default_factory=dict)

    # Confidence tracking (Dunning-Kruger detection)
    confidence_records: List[Dict[str, Any]] = field(default_factory=list)
    # [{"concept": "x", "confidence": 75, "is_correct": true, "timestamp": "..."}]

    # Socratic help chat history
    help_history: List[Dict[str, str]] = field(default_factory=list)

    def _cap_lists(self) -> None:
        """Enforce size caps on all unbounded lists before serialization."""
        if len(self.previous_prompts) > 100:
            self.previous_prompts = self.previous_prompts[-50:]
        if len(self.served_content_ids) > 500:
            self.served_content_ids = self.served_content_ids[-300:]
        if len(self.skipped_content_ids) > 200:
            self.skipped_content_ids = self.skipped_content_ids[-100:]
        if len(self.not_interested_topics) > 50:
            self.not_interested_topics = self.not_interested_topics[-25:]
        if len(self.confidence_records) > 200:
            self.confidence_records = self.confidence_records[-200:]
        if len(self.reintroduction_queue) > 30:
            self.reintroduction_queue = self.reintroduction_queue[-20:]
        if len(self.help_history) > 50:
            self.help_history = self.help_history[-30:]

    def to_dict(self) -> Dict[str, Any]:
        self._cap_lists()
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeedState":
        if not data:
            return cls()
        # Defensive: ignore unknown keys from future versions, use defaults for missing keys
        known = cls.__dataclass_fields__
        return cls(**{k: data[k] for k in known if k in data})


# ---------------------------------------------------------------------------
# Feed Engine
# ---------------------------------------------------------------------------


class ScrollFeedEngine:
    """
    TikTok-style adaptive question feed engine.

    The "algorithm" that decides what to show next, optimizing for:
    1. Learning outcomes (mastery improvement)
    2. Engagement (keeping the student in flow state)
    3. Retention (spaced reintroduction of mistakes)
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.adaptive = AdaptiveLearningService(db)
        self.question_gen = QuestionBankGenerator()
        # Content pool integration (lazy import to avoid circular)
        from ..services.content_generation_orchestrator import ContentGenerationOrchestrator
        from ..services.content_pool_service import ContentPoolService
        self.content_orchestrator = ContentGenerationOrchestrator(db)
        self.pool_service = ContentPoolService(db)
        # RL-adaptive components
        self.bkt = BKTEngine(db)
        self.zpd = ZPDSelector()
        self.concept_selector = ConceptSelector(db)
        self.knowledge_graph: Optional[KnowledgeGraph] = None

    # ===================================================================
    # START FEED
    # ===================================================================

    async def start_feed(
        self,
        student_name: str,
        topic: str,
        student_id: Optional[str] = None,
        notes: Optional[str] = None,
        preferences: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Start a scroll feed session. Returns session + first batch of cards."""

        # Load resource context if no explicit notes provided
        if not notes:
            resource_context = await self._get_resource_context(topic)
            if resource_context:
                notes = resource_context

        # Extract concepts from topic/notes
        concepts = await self._extract_concepts(topic, notes)

        # Get existing mastery
        mastery = await self._get_mastery_map(student_name)

        # Calculate starting difficulty based on existing mastery
        avg_mastery = 0.0
        known_concepts = [c for c in concepts if c in mastery]
        if known_concepts:
            avg_mastery = sum(mastery[c]["score"] for c in known_concepts) / len(known_concepts)

        starting_difficulty = max(0.3, min(0.7, avg_mastery / 150))

        # Override difficulty if user set it manually
        if preferences and preferences.get("difficulty") is not None:
            starting_difficulty = preferences["difficulty"]

        state = FeedState(
            concepts=concepts,
            notes_context=notes or "",
            base_difficulty=starting_difficulty,
            current_difficulty=starting_difficulty,
            user_preferences=preferences or {},
        )

        # Create session
        session = LearningSession(
            student_name=student_name,
            student_id=uuid.UUID(student_id) if student_id else None,
            topic=topic,
            phase="learning",
            state_json=state.to_dict(),
            plan_json={"mode": "scroll", "concepts": concepts},
            concepts_covered=concepts,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        # NOTE: We do NOT call ensure_pool_ready() here — it blocks for 60-120s
        # generating content for ALL concepts via Gemini. Instead we rely on:
        # 1. The pregen endpoint (called by frontend after syllabus loads)
        # 2. The inline fallback in _generate_card_batch_from_pool
        # This keeps start_feed fast (<10s even with empty pool).

        # Generate first batch of cards (pool-first, inline fallback)
        cards = await self._generate_card_batch_from_pool(state, topic, count=3, student_name=student_name)

        # Store first card as current
        if cards:
            state.cards_shown = len(cards)
            session.state_json = state.to_dict()
            await self.db.commit()

        return {
            "session_id": str(session.id),
            "topic": topic,
            "concepts": concepts,
            "cards": [self._card_to_dict(c) for c in cards],
            "stats": self._get_stats(state),
        }

    # ===================================================================
    # PROCESS ANSWER (the core algorithm)
    # ===================================================================

    async def process_answer(
        self,
        session_id: str,
        answer: str,
        time_ms: int = 0,
        correct_answer: Optional[str] = None,
        confidence: Optional[int] = None,
        prompt: Optional[str] = None,
        options: Optional[list] = None,
        explanation: Optional[str] = None,
        concept_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process an answer. This is where the algorithm runs.

        Like TikTok's recommendation engine, it:
        1. Evaluates the answer
        2. Updates the student model
        3. Adjusts difficulty in real-time
        4. Decides what to show next (the "recommendation")
        """
        session = await self._get_session(session_id)
        if not session:
            return {"error": "Session not found"}

        state = FeedState.from_dict(session.state_json)

        # Determine concept from state
        concept_idx = state.current_concept_idx % max(1, len(state.concepts))
        concept = state.concepts[concept_idx] if state.concepts else session.topic

        # Grade answer
        is_correct = self._grade_answer(answer, state, correct_answer)

        # ---- Confidence tracking (Dunning-Kruger detection) ----
        conf = confidence if confidence is not None else self._estimate_confidence(time_ms, is_correct)
        state.confidence_records.append({
            "concept": concept,
            "confidence": conf,
            "is_correct": is_correct,
            "timestamp": utc_now().isoformat(),
        })
        # List caps enforced in FeedState._cap_lists() on save

        # ---- BKT UPDATE (replaces simple mastery) ----
        old_mastery = (await self.bkt.get_all_masteries(session.student_name)).get(concept)
        old_p_learned = old_mastery.p_learned if old_mastery else 0.1
        bkt_state = await self.bkt.update(session.student_name, concept, is_correct, time_ms)
        new_p_learned = bkt_state.p_learned

        # Thompson Sampling reward signal
        learning_gain = new_p_learned - old_p_learned
        await self.concept_selector.update_reward(session.student_name, concept, learning_gain)

        # ---- THE ALGORITHM ----

        # 1. Update concept stats
        if concept not in state.concept_stats:
            state.concept_stats[concept] = {"attempts": 0, "correct": 0, "wrong_streak": 0}
        stats = state.concept_stats[concept]
        stats["attempts"] += 1
        if is_correct:
            stats["correct"] += 1
            stats["wrong_streak"] = 0
        else:
            stats["wrong_streak"] = stats.get("wrong_streak", 0) + 1

        # 2. Update streak (variable ratio reinforcement)
        xp_earned = 0
        streak_broken = False
        if is_correct:
            state.streak += 1
            state.best_streak = max(state.best_streak, state.streak)
            # XP with streak multiplier (1x, 1.5x, 2x, 2.5x, 3x...)
            multiplier = min(3.0, 1.0 + (state.streak - 1) * 0.5)
            xp_earned = int(10 * multiplier * (1 + state.current_difficulty))
            state.total_xp += xp_earned
        else:
            streak_broken = state.streak >= 3  # Only notable if decent streak
            state.streak = 0

            # 3. Queue for reintroduction (wrong answers come back)
            state.reintroduction_queue.append({
                "concept": concept,
                "cooldown": random.randint(2, 4),  # Show again after 2-4 more cards
                "difficulty": max(0.2, state.current_difficulty - 0.15),  # Easier next time
            })
            # List caps enforced in FeedState._cap_lists() on save

        # 4. Adjust difficulty via ZPD (replaces momentum heuristic)
        self._adjust_difficulty_zpd(state, bkt_state, is_correct, time_ms)

        # 5. Update engagement metrics
        state.cards_shown += 1
        if time_ms > 0:
            state.avg_time_ms = state.avg_time_ms * 0.8 + time_ms * 0.2
            if time_ms < 2000:
                state.fast_answers += 1
            elif time_ms > 15000:
                state.slow_answers += 1

        # 6. Rotate concept if needed (prevent fatigue)
        state.cards_on_current_concept += 1
        if state.cards_on_current_concept >= 3 or (not is_correct and stats["wrong_streak"] >= 2):
            state.current_concept_idx = (state.current_concept_idx + 1) % max(1, len(state.concepts))
            state.cards_on_current_concept = 0

        # 7. Tick reintroduction cooldowns
        for item in state.reintroduction_queue:
            item["cooldown"] = item.get("cooldown", 0) - 1

        # 8. Record content pool interaction (if card came from pool)
        # content_item_id is passed from the frontend; we record it if present
        # (handled by the API layer, not here directly)

        # 9. Generate next cards
        next_cards = await self._generate_card_batch_from_pool(
            state, session.topic, count=2, student_name=session.student_name
        )

        # Update session
        session.questions_answered += 1
        if is_correct:
            session.questions_correct += 1

        # Record question history
        try:
            from ..db_models_question_history import QuestionHistory
            qh = QuestionHistory(
                session_id=session.id,
                student_name=session.student_name,
                student_id=str(session.student_id) if session.student_id else None,
                prompt=prompt or "",
                options=options or [],
                correct_answer=correct_answer or "",
                explanation=explanation,
                student_answer=answer,
                is_correct=is_correct,
                confidence=conf,
                concept=concept_hint or concept,
                difficulty=state.current_difficulty,
                topic=session.topic,
                mode="scroll",
            )
            self.db.add(qh)
        except Exception:
            pass  # Don't break answer flow for history recording

        session.state_json = state.to_dict()
        await self.db.commit()

        # Build analytics snippet (shown on card)
        analytics = self._build_card_analytics(state, concept, is_correct)

        # Check for Dunning-Kruger nudge
        dk_nudge = self._check_dk_nudge(state, concept, conf, is_correct)
        if dk_nudge:
            analytics["calibration_nudge"] = dk_nudge

        return {
            "session_id": session_id,
            "is_correct": is_correct,
            "xp_earned": xp_earned,
            "streak": state.streak,
            "best_streak": state.best_streak,
            "streak_broken": streak_broken,
            "total_xp": state.total_xp,
            "difficulty": round(state.current_difficulty, 2),
            "next_cards": [self._card_to_dict(c) for c in next_cards],
            "analytics": analytics,
            "stats": self._get_stats(state),
        }

    # ===================================================================
    # GET NEXT CARDS
    # ===================================================================

    async def get_next_cards(
        self, session_id: str, count: int = 3
    ) -> Dict[str, Any]:
        """Get next batch of cards for infinite scroll."""
        session = await self._get_session(session_id)
        if not session:
            return {"error": "Session not found"}

        state = FeedState.from_dict(session.state_json)
        cards = await self._generate_card_batch_from_pool(
            state, session.topic, count=count, student_name=session.student_name
        )

        session.state_json = state.to_dict()
        await self.db.commit()

        return {
            "session_id": session_id,
            "cards": [self._card_to_dict(c) for c in cards],
            "stats": self._get_stats(state),
        }

    # ===================================================================
    # SESSION ANALYTICS
    # ===================================================================

    async def get_session_analytics(self, session_id: str) -> Dict[str, Any]:
        """Get detailed analytics for the scroll session."""
        session = await self._get_session(session_id)
        if not session:
            return {"error": "Session not found"}

        state = FeedState.from_dict(session.state_json)

        concept_breakdown = []
        for concept, stats in state.concept_stats.items():
            attempts = stats.get("attempts", 0)
            correct = stats.get("correct", 0)
            accuracy = round(correct / max(1, attempts) * 100)
            concept_breakdown.append({
                "concept": concept,
                "attempts": attempts,
                "correct": correct,
                "accuracy": accuracy,
                "status": "mastered" if accuracy >= 80 and attempts >= 3
                    else "strong" if accuracy >= 60
                    else "needs_work",
            })

        # Sort: needs_work first, then strong, then mastered
        status_order = {"needs_work": 0, "strong": 1, "mastered": 2}
        concept_breakdown.sort(key=lambda x: status_order.get(x["status"], 1))

        total = session.questions_answered
        correct = session.questions_correct
        accuracy = round(correct / max(1, total) * 100)

        return {
            "session_id": session_id,
            "total_questions": total,
            "total_correct": correct,
            "accuracy": accuracy,
            "streak": state.streak,
            "best_streak": state.best_streak,
            "total_xp": state.total_xp,
            "current_difficulty": round(state.current_difficulty, 2),
            "concepts": concept_breakdown,
            "improvement_areas": [
                c["concept"] for c in concept_breakdown if c["status"] == "needs_work"
            ],
            "strengths": [
                c["concept"] for c in concept_breakdown if c["status"] == "mastered"
            ],
            "engagement": {
                "cards_shown": state.cards_shown,
                "avg_time_ms": round(state.avg_time_ms),
                "fast_answers": state.fast_answers,
                "slow_answers": state.slow_answers,
                "reintroductions_queued": len(state.reintroduction_queue),
            },
        }

    # ===================================================================
    # INTERNAL: The Algorithm
    # ===================================================================

    def _adjust_difficulty_zpd(self, state: FeedState, bkt_state, is_correct: bool, time_ms: int):
        """
        ZPD-backed difficulty adjustment using BKT mastery estimate.

        Replaces the momentum-based heuristic with IRT-inspired targeting.
        Falls back to momentum if BKT state is unavailable.
        """
        if bkt_state is not None:
            state.current_difficulty = self.zpd.select_difficulty(
                bkt_state, state.to_dict()
            )
        else:
            # Fallback: momentum-based adjustment
            self._adjust_difficulty_momentum(state, is_correct, time_ms)

    def _adjust_difficulty_momentum(self, state: FeedState, is_correct: bool, time_ms: int):
        """Legacy momentum-based difficulty adjustment (fallback)."""
        if is_correct:
            state.difficulty_momentum += 0.05
        else:
            state.difficulty_momentum -= 0.08

        if time_ms > 0:
            if time_ms < 2000 and is_correct:
                state.difficulty_momentum += 0.03
            elif time_ms > 12000:
                state.difficulty_momentum -= 0.02

        state.difficulty_momentum *= 0.85
        state.difficulty_momentum = max(-0.15, min(0.15, state.difficulty_momentum))
        state.current_difficulty += state.difficulty_momentum
        state.current_difficulty = max(0.15, min(0.95, state.current_difficulty))

    def _estimate_confidence(self, time_ms: int, is_correct: bool) -> int:
        """Estimate confidence from answer time (no explicit slider in scroll mode)."""
        if time_ms <= 0:
            return 50
        if time_ms < 3000:
            return 80 if is_correct else 70  # Fast answer = high confidence
        if time_ms < 8000:
            return 60  # Medium
        return 35  # Slow = uncertain

    def _check_dk_nudge(
        self, state: FeedState, concept: str, confidence: int, is_correct: bool
    ) -> Optional[Dict[str, Any]]:
        """Check for Dunning-Kruger overconfidence nudge."""
        # Only trigger on high-confidence wrong answers
        if is_correct or confidence < 60:
            return None

        # Need ≥3 records for this concept
        concept_records = [r for r in state.confidence_records if r["concept"] == concept]
        if len(concept_records) < 3:
            return None

        avg_confidence = sum(r["confidence"] for r in concept_records) / len(concept_records)
        accuracy = sum(1 for r in concept_records if r["is_correct"]) / len(concept_records) * 100
        gap = avg_confidence - accuracy

        if gap >= 25:
            messages = [
                f"Your confidence on {concept} is running ahead of your accuracy. Try slowing down and double-checking.",
                f"You feel {int(avg_confidence)}% confident on {concept}, but your accuracy is {int(accuracy)}%. Let's close that gap.",
                f"Calibration check: your gut says {int(avg_confidence)}% but results show {int(accuracy)}%. Focus on understanding, not speed.",
            ]
            import random as _rand
            return {
                "type": "dk_overconfident",
                "message": _rand.choice(messages),
                "confidence_avg": round(avg_confidence, 1),
                "accuracy": round(accuracy, 1),
                "gap": round(gap, 1),
            }
        return None

    def _grade_answer(self, answer: str, state: FeedState, correct_answer: Optional[str] = None) -> bool:
        """Grade the answer against the correct answer sent by the frontend."""
        if correct_answer is not None:
            return answer.strip().upper() == correct_answer.strip().upper()
        # Fallback: accept any valid option (backwards compat)
        return answer.strip().upper() in ["A", "B", "C", "D"]

    def _should_reintroduce(self, state: FeedState) -> Optional[Dict]:
        """Check if any reintroduction cards are ready."""
        ready = [r for r in state.reintroduction_queue if r.get("cooldown", 0) <= 0]
        if ready:
            item = ready[0]
            state.reintroduction_queue.remove(item)
            return item
        return None

    def _pick_next_concept_ts(self, state: FeedState, bkt_states: Dict[str, Any]) -> str:
        """
        Thompson Sampling concept selector — replaces fixed-ratio heuristic.

        Falls back to legacy method if BKT states are empty.
        """
        if not state.concepts:
            return "general"

        if bkt_states:
            return self.concept_selector.select(
                available_concepts=state.concepts,
                bkt_states=bkt_states,
                knowledge_graph=self.knowledge_graph,
                feed_state_dict=state.to_dict(),
            )

        # Fallback to legacy behavior
        return self._pick_next_concept_legacy(state)

    def _pick_next_concept_legacy(self, state: FeedState) -> str:
        """Legacy concept selection (60/20/20 ratio) — used as fallback."""
        if not state.concepts:
            return "general"

        reintro = self._should_reintroduce(state)
        if reintro:
            return reintro["concept"]

        roll = random.random()
        if roll < 0.6:
            idx = state.current_concept_idx % len(state.concepts)
            return state.concepts[idx]
        elif roll < 0.8:
            weakest = None
            lowest_acc = 1.0
            for concept in state.concepts:
                stats = state.concept_stats.get(concept, {})
                attempts = stats.get("attempts", 0)
                if attempts == 0:
                    return concept
                acc = stats.get("correct", 0) / attempts
                if acc < lowest_acc:
                    lowest_acc = acc
                    weakest = concept
            return weakest or state.concepts[0]
        else:
            return random.choice(state.concepts)

    async def _generate_card_batch(
        self, state: FeedState, count: int = 3,
        bkt_states: Optional[Dict] = None,
        notes_context: str = "",
    ) -> List[ScrollCard]:
        """Generate a batch of cards for the feed."""
        cards = []

        for _ in range(count):
            concept = self._pick_next_concept_ts(state, bkt_states or {})

            # Check if this is a reintroduction
            is_reintro = any(
                r.get("concept") == concept and r.get("cooldown", 1) <= 0
                for r in state.reintroduction_queue
            )

            difficulty = state.current_difficulty
            if is_reintro:
                difficulty = max(0.2, difficulty - 0.15)  # Easier for reintroductions

            # Generate question
            target_misconception = None
            # If concept has wrong streak, target the misconception
            stats = state.concept_stats.get(concept, {})
            if stats.get("wrong_streak", 0) >= 2:
                target_misconception = f"Common mistake in {concept}"

            concept_dict = {
                "id": concept.lower().replace(" ", "_"),
                "name": concept,
                "topics": [],
                "misconceptions": [target_misconception] if target_misconception else [],
            }

            question = await self.question_gen.generate_question(
                concept_dict,
                difficulty=difficulty,
                previous_prompts=state.previous_prompts[-10:],
                target_misconception=target_misconception,
                context=notes_context or None,
            )

            # Skip placeholder questions where LLM was unavailable
            if question.get("llm_required") or "[LLM Required]" in question.get("prompt", "") or "[LLM required" in question.get("prompt", ""):
                continue

            state.previous_prompts.append(question.get("prompt", ""))

            # Calculate XP value based on difficulty
            xp_value = int(10 * (1 + difficulty))

            card = ScrollCard(
                id=f"card_{uuid.uuid4().hex[:8]}",
                question=question,
                concept=concept,
                difficulty=difficulty,
                is_reintroduction=is_reintro,
                xp_value=xp_value,
            )
            cards.append(card)

        return cards

    async def _generate_card_batch_from_pool(
        self, state: FeedState, topic: str, count: int = 3,
        student_name: Optional[str] = None,
    ) -> List[ScrollCard]:
        """Pool-first card generation. Falls back to inline if pool is empty."""
        # Load BKT states for concept selection
        bkt_states = {}
        if student_name:
            bkt_states = await self.bkt.get_all_masteries(student_name)

        try:
            # Pass user content_mix preference as type_weights override
            type_weights = state.user_preferences.get("content_mix")
            pool_cards = await self.pool_service.select_cards(
                topic=topic,
                concepts=state.concepts,
                difficulty_range=(
                    max(0.0, state.current_difficulty - 0.25),
                    min(1.0, state.current_difficulty + 0.25),
                ),
                exclude_ids=state.served_content_ids,
                count=count,
                type_weights=type_weights,
            )
            if pool_cards:
                for c in pool_cards:
                    if c.content_item_id:
                        state.served_content_ids.append(c.content_item_id)
                    ctype = c.card_type
                    state.content_type_counts[ctype] = state.content_type_counts.get(ctype, 0) + 1
                    if c.question.get("prompt"):
                        state.previous_prompts.append(c.question["prompt"])
                return pool_cards
        except Exception as e:
            capture_exception(e, context={"service": "scroll_feed_engine", "operation": "pool_card_selection"})
            log_error(logger, "pool_card_selection failed, falling back to inline", error=str(e))

        # Backfill resource context for sessions created before PDF-context fix
        if not state.notes_context:
            resource_ctx = await self._get_resource_context(topic)
            if resource_ctx:
                state.notes_context = resource_ctx

        # Fallback to inline generation with BKT-aware concept selection
        return await self._generate_card_batch(state, count=count, bkt_states=bkt_states, notes_context=state.notes_context)

    def _card_to_dict(self, card: ScrollCard) -> Dict[str, Any]:
        """Convert card to API response dict."""
        d: Dict[str, Any] = {
            "id": card.id,
            "prompt": card.question.get("prompt", ""),
            "options": card.question.get("options", []),
            "correct_answer": card.question.get("correct_answer", ""),
            "explanation": card.question.get("explanation", ""),
            "concept": card.concept,
            "difficulty": round(card.difficulty, 2),
            "card_type": card.card_type,
            "is_reintroduction": card.is_reintroduction,
            "xp_value": card.xp_value,
        }
        if card.content_item_id:
            d["content_item_id"] = card.content_item_id
        # Flashcard fields
        if card.card_type == "flashcard":
            d["flashcard_front"] = card.question.get("flashcard_front", "")
            d["flashcard_back"] = card.question.get("flashcard_back", "")
            d["flashcard_hint"] = card.question.get("flashcard_hint", "")
        # Info card fields
        if card.card_type == "info_card":
            d["info_title"] = card.question.get("info_title", "")
            d["info_body"] = card.question.get("info_body", "")
            d["info_takeaway"] = card.question.get("info_takeaway", "")
        # Resource card fields
        if card.card_type == "resource_card":
            d["resource_title"] = card.question.get("resource_title", "")
            d["resource_url"] = card.question.get("resource_url", "")
            d["resource_type"] = card.question.get("resource_type", "web")
            d["resource_thumbnail"] = card.question.get("resource_thumbnail", "")
            d["resource_description"] = card.question.get("resource_description", "")
            d["resource_duration"] = card.question.get("resource_duration", "")
            d["resource_channel"] = card.question.get("resource_channel", "")
            d["resource_domain"] = card.question.get("resource_domain", "")
        return d

    def _get_stats(self, state: FeedState) -> Dict[str, Any]:
        """Get current session stats for the UI."""
        return {
            "streak": state.streak,
            "best_streak": state.best_streak,
            "total_xp": state.total_xp,
            "difficulty": round(state.current_difficulty, 2),
            "cards_shown": state.cards_shown,
        }

    def _build_card_analytics(
        self, state: FeedState, concept: str, is_correct: bool
    ) -> Dict[str, Any]:
        """Build the analytics snippet shown after answering."""
        stats = state.concept_stats.get(concept, {"attempts": 0, "correct": 0})
        attempts = stats.get("attempts", 0)
        correct = stats.get("correct", 0)
        accuracy = round(correct / max(1, attempts) * 100)

        # Find improvement areas
        weak = []
        strong = []
        for c, s in state.concept_stats.items():
            a = s.get("attempts", 0)
            if a >= 2:
                acc = s.get("correct", 0) / a * 100
                if acc < 50:
                    weak.append(c)
                elif acc >= 80:
                    strong.append(c)

        return {
            "concept": concept,
            "concept_accuracy": accuracy,
            "concept_attempts": attempts,
            "improvement_areas": weak[:3],
            "strengths": strong[:3],
            "difficulty_trend": "harder" if state.difficulty_momentum > 0.02
                else "easier" if state.difficulty_momentum < -0.02
                else "stable",
        }

    # ===================================================================
    # SOCRATIC HELP CHAT
    # ===================================================================

    async def help_chat(
        self, session_id: str, message: str, card_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Socratic tutoring for 'I don't know' — guides without revealing."""
        if not FEED_MODEL:
            return {"message": "AI tutoring is not available right now.", "phase": "unavailable", "ready_to_try": False}

        session = await self._get_session(session_id)
        if not session:
            return {"error": "Session not found"}

        state = FeedState.from_dict(session.state_json)

        # Build system prompt on first message (empty history)
        if not state.help_history:
            system_msg = (
                "You are a Socratic tutor helping a student who is stuck on a question. "
                "NEVER reveal the answer directly. Guide the student to discover it themselves.\n\n"
                "Rules:\n"
                "- Ask probing questions to uncover what the student already knows\n"
                "- Give graduated hints: first probe, then hint, then explain the underlying concept\n"
                "- Keep responses short (2-3 sentences max)\n"
                "- Be encouraging and warm\n"
                "- If the student seems to understand, tell them you think they're ready to try\n\n"
                f"Question: {card_context.get('prompt', 'N/A')}\n"
                f"Concept: {card_context.get('concept', 'N/A')}\n"
                f"Options: {', '.join(card_context.get('options', []))}\n"
                "Remember: Do NOT reveal which option is correct."
            )
            state.help_history.append({"role": "system", "content": system_msg})

        # Append student message
        state.help_history.append({"role": "user", "content": message})

        # Build Gemini conversation from history
        # Gemini uses "user"/"model" roles; system goes as first user message
        gemini_history = []
        system_text = ""
        for msg in state.help_history:
            if msg["role"] == "system":
                system_text = msg["content"]
            elif msg["role"] == "user":
                content = msg["content"]
                if system_text and not gemini_history:
                    content = system_text + "\n\nStudent: " + content
                gemini_history.append({"role": "user", "parts": [content]})
            elif msg["role"] == "assistant":
                gemini_history.append({"role": "model", "parts": [msg["content"]]})

        try:
            chat = FEED_MODEL.start_chat(history=gemini_history[:-1])
            response = chat.send_message(gemini_history[-1]["parts"][0])
            ai_text = response.text.strip()
        except Exception as e:
            ai_text = "I'm having trouble thinking right now. Try rephrasing your thought?"
            capture_exception(e, context={"service": "scroll_feed_engine", "operation": "help_chat_gemini"})
            log_error(logger, "help_chat_gemini failed", error=str(e))

        # Append AI response
        state.help_history.append({"role": "assistant", "content": ai_text})

        # List caps enforced in FeedState._cap_lists() on save

        # Determine phase based on exchange count (exclude system message)
        exchanges = sum(1 for m in state.help_history if m["role"] == "user")
        if exchanges <= 2:
            phase = "probing"
        elif exchanges <= 4:
            phase = "hinting"
        else:
            phase = "explaining"

        # Detect readiness from AI response
        ready_keywords = ["ready to try", "give it a shot", "try answering", "go ahead and answer", "you've got this"]
        ready_to_try = any(kw in ai_text.lower() for kw in ready_keywords) or exchanges >= 5

        # Save state
        session.state_json = state.to_dict()
        await self.db.commit()

        return {
            "message": ai_text,
            "phase": phase,
            "ready_to_try": ready_to_try,
        }

    # ===================================================================
    # HELPERS
    # ===================================================================

    async def load_knowledge_graph(self, syllabus_tree: Dict[str, Any]) -> None:
        """Load the knowledge graph from a syllabus tree JSON."""
        self.knowledge_graph = KnowledgeGraph(syllabus_tree)

    async def get_bkt_mastery_map(self, student_name: str) -> Dict[str, Dict[str, Any]]:
        """Get BKT mastery data for all concepts — used by API endpoints."""
        states = await self.bkt.get_all_masteries(student_name)
        return {
            concept: {
                "p_learned": state.p_learned,
                "mastery_pct": round(state.p_learned * 100, 1),
                "confidence": round(1 - self.bkt.estimate_confidence(state), 3),
                "total_parameters": {
                    "p_guess": state.p_guess,
                    "p_slip": state.p_slip,
                    "p_transit": state.p_transit,
                },
            }
            for concept, state in states.items()
        }

    async def _get_resource_context(self, topic: str) -> Optional[str]:
        """Load stored resource context for a topic's subject.

        Resources are stored under the subject name (e.g. "Flow Matching and
        Diffusion Models") but topics use a shorter name (e.g. "Flow Matching").
        We try exact match first, then fall back to substring matching.
        """
        from ..db_models import SubjectResource

        # Try exact match first
        query = select(SubjectResource).where(
            SubjectResource.subject == topic
        ).limit(5)
        result = await self.db.execute(query)
        resources = result.scalars().all()

        # Fallback: substring match (topic contained in subject or vice versa)
        if not resources:
            query = select(SubjectResource).where(
                SubjectResource.subject.contains(topic)
            ).limit(5)
            result = await self.db.execute(query)
            resources = result.scalars().all()

        if not resources:
            query = select(SubjectResource).limit(20)
            result = await self.db.execute(query)
            all_resources = result.scalars().all()
            resources = [
                r for r in all_resources
                if topic.lower() in (r.subject or "").lower()
                or (r.subject or "").lower() in topic.lower()
            ]

        if not resources:
            return None
        parts = [r.key_content for r in resources if r.key_content]
        return "\n".join(parts)[:2000] if parts else None

    async def _get_resource_concepts(self, topic: str) -> Optional[List[str]]:
        """Load pre-extracted concepts from SubjectResource for a topic's subject."""
        from ..db_models import SubjectResource

        # Try exact match first, then substring
        for query in [
            select(SubjectResource).where(SubjectResource.subject == topic).limit(5),
            select(SubjectResource).where(SubjectResource.subject.contains(topic)).limit(5),
        ]:
            result = await self.db.execute(query)
            resources = result.scalars().all()
            if resources:
                break

        if not resources:
            return None

        # Merge concepts from all resources
        all_concepts: List[str] = []
        for r in resources:
            if isinstance(r.concepts_json, list):
                all_concepts.extend(r.concepts_json)
        # Deduplicate while preserving order
        seen = set()
        unique: List[str] = []
        for c in all_concepts:
            if isinstance(c, str) and c not in seen:
                seen.add(c)
                unique.append(c)
        return unique[:8] if unique else None

    async def _extract_concepts(
        self, topic: str, notes: Optional[str]
    ) -> List[str]:
        """Extract key concepts from topic or notes using LLM."""
        # Try stored concepts from SubjectResource first (from PDF extraction)
        stored_concepts = await self._get_resource_concepts(topic)
        if stored_concepts and len(stored_concepts) >= 2:
            return stored_concepts

        # Check cache for previously extracted concepts
        cache_key = f"concepts:{topic.strip().lower()}"
        try:
            cached = await CacheService.get(cache_key)
            if isinstance(cached, list) and len(cached) >= 2:
                return cached
        except Exception:
            pass  # Cache unavailable — fall through to Gemini

        if not notes and not FEED_MODEL:
            return [topic]

        if FEED_MODEL:
            prompt_text = f"""Extract 4-8 key concepts from this topic/notes for a quiz session.

TOPIC: {topic}
{"NOTES:" + chr(10) + notes[:2000] if notes else ""}

Return JSON array of concept names (short, specific):
["concept1", "concept2", "concept3", ...]"""

            try:
                response = await call_gemini_with_timeout(
                    FEED_MODEL, prompt_text,
                    generation_config={"response_mime_type": "application/json"},
                    context={"agent": "scroll_feed_engine", "operation": "extract_concepts"},
                )
                if response is not None:
                    concepts = json.loads(response.text)
                    if isinstance(concepts, list) and len(concepts) >= 2:
                        concepts = concepts[:8]
                        # Cache the extracted concepts (1 hour TTL)
                        try:
                            await CacheService.set(cache_key, concepts, ttl=3600)
                        except Exception:
                            pass  # Cache unavailable — continue without caching
                        return concepts
            except Exception as e:
                capture_exception(e, context={"service": "scroll_feed_engine", "operation": "extract_concepts"})
                log_error(logger, "extract_concepts failed", error=str(e))

        return [topic]

    async def _get_mastery_map(self, student_name: str) -> Dict[str, Dict]:
        """Get mastery map for a student."""
        query = select(ConceptMastery).where(
            ConceptMastery.student_name == student_name
        )
        result = await self.db.execute(query)
        return {
            m.concept: {"score": m.mastery_score, "attempts": m.total_attempts}
            for m in result.scalars().all()
        }

    async def _get_session(self, session_id: str) -> Optional[LearningSession]:
        query = select(LearningSession).where(
            LearningSession.id == uuid.UUID(session_id)
        )
        result = await self.db.execute(query)
        return result.scalars().first()

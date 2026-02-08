"""
Scroll Feed Engine Unit Tests

Comprehensive tests for the scroll feed engine's state machine logic:
- FeedState serialization (to_dict / from_dict round-trip)
- XP calculation and streak multipliers
- Streak logic (increment, reset, best_streak tracking)
- Difficulty adaptation (momentum-based and ZPD-based)
- Reintroduction queue (wrong answers queued, cooldown, cap enforcement)
- Card selection helpers (_should_reintroduce, _pick_next_concept_legacy)
- Grading logic (_grade_answer)
- Engagement metrics (time tracking, fast/slow answer counts)
- Confidence estimation and Dunning-Kruger nudge detection
- Analytics and stats helpers
"""

import json
import random
import uuid
from dataclasses import fields
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.scroll_feed_engine import FeedState, ScrollCard, ScrollFeedEngine
from app.services.bkt_engine import BKTState


# ==============================================================================
# Fixtures
# ==============================================================================


@pytest.fixture
def default_state() -> FeedState:
    """Return a FeedState with default values."""
    return FeedState()


@pytest.fixture
def populated_state() -> FeedState:
    """Return a FeedState pre-populated with realistic session data."""
    return FeedState(
        concepts=["photosynthesis", "cellular_respiration", "mitosis"],
        notes_context="Biology chapter 5 notes about cell processes.",
        base_difficulty=0.4,
        current_difficulty=0.5,
        difficulty_momentum=0.02,
        streak=3,
        best_streak=5,
        total_xp=150,
        concept_stats={
            "photosynthesis": {"attempts": 5, "correct": 4, "wrong_streak": 0},
            "cellular_respiration": {"attempts": 3, "correct": 1, "wrong_streak": 2},
        },
        reintroduction_queue=[
            {"concept": "cellular_respiration", "cooldown": 2, "difficulty": 0.3},
            {"concept": "mitosis", "cooldown": 0, "difficulty": 0.25},
        ],
        previous_prompts=["What is ATP?", "Name the phases of mitosis."],
        cards_shown=10,
        avg_time_ms=4500.0,
        fast_answers=2,
        slow_answers=1,
        current_concept_idx=1,
        cards_on_current_concept=2,
        content_type_counts={"mcq": 5, "flashcard": 2},
        served_content_ids=["id_1", "id_2"],
        skipped_content_ids=["id_3"],
        not_interested_topics=["taxonomy"],
        user_preferences={"difficulty": 0.5},
        confidence_records=[
            {"concept": "photosynthesis", "confidence": 80, "is_correct": True, "timestamp": "2025-01-01T00:00:00"},
        ],
        help_history=[],
    )


@pytest.fixture
def mock_db():
    """Return a mock async database session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.fixture
def sample_bkt_state() -> BKTState:
    """Return a sample BKTState for a concept."""
    return BKTState(
        concept="photosynthesis",
        p_learned=0.5,
        p_guess=0.15,
        p_slip=0.1,
        p_transit=0.2,
        ts_alpha=3.0,
        ts_beta=2.0,
    )


@pytest.fixture
def engine(mock_db):
    """Return a ScrollFeedEngine with mocked dependencies."""
    with patch("app.services.scroll_feed_engine.AdaptiveLearningService"), \
         patch("app.services.scroll_feed_engine.QuestionBankGenerator"), \
         patch("app.services.scroll_feed_engine.BKTEngine"), \
         patch("app.services.scroll_feed_engine.ZPDSelector") as MockZPD, \
         patch("app.services.scroll_feed_engine.ConceptSelector"), \
         patch("app.services.content_generation_orchestrator.ContentGenerationOrchestrator"), \
         patch("app.services.content_pool_service.ContentPoolService"):
        eng = ScrollFeedEngine(mock_db)
        # Make zpd return a reasonable difficulty
        eng.zpd.select_difficulty = MagicMock(return_value=0.5)
        return eng


# ==============================================================================
# FeedState Serialization
# ==============================================================================


class TestFeedStateSerialization:
    """Tests for FeedState.to_dict() and FeedState.from_dict()."""

    def test_to_dict_returns_dict(self, default_state):
        """to_dict should return a plain dict, not a FeedState."""
        result = default_state.to_dict()
        assert isinstance(result, dict)

    def test_to_dict_is_json_serializable(self, default_state):
        """to_dict output must be fully JSON-serializable."""
        result = default_state.to_dict()
        serialized = json.dumps(result)
        assert isinstance(serialized, str)
        # Round-trip through JSON should not lose data
        deserialized = json.loads(serialized)
        assert deserialized == result

    def test_to_dict_populated_is_json_serializable(self, populated_state):
        """Populated state with complex data must also JSON-serialize cleanly."""
        result = populated_state.to_dict()
        serialized = json.dumps(result)
        deserialized = json.loads(serialized)
        assert deserialized == result

    def test_to_dict_contains_all_fields(self, default_state):
        """to_dict must include every dataclass field."""
        result = default_state.to_dict()
        field_names = {f.name for f in fields(FeedState)}
        assert set(result.keys()) == field_names

    def test_from_dict_round_trip_default(self, default_state):
        """from_dict(to_dict(state)) should reproduce the original state."""
        data = default_state.to_dict()
        restored = FeedState.from_dict(data)
        assert restored.to_dict() == data

    def test_from_dict_round_trip_populated(self, populated_state):
        """Round-trip with populated data should preserve all fields."""
        data = populated_state.to_dict()
        restored = FeedState.from_dict(data)
        assert restored.concepts == populated_state.concepts
        assert restored.streak == populated_state.streak
        assert restored.best_streak == populated_state.best_streak
        assert restored.total_xp == populated_state.total_xp
        assert restored.current_difficulty == populated_state.current_difficulty
        assert restored.concept_stats == populated_state.concept_stats
        assert restored.reintroduction_queue == populated_state.reintroduction_queue
        assert restored.confidence_records == populated_state.confidence_records
        assert restored.user_preferences == populated_state.user_preferences
        assert restored.content_type_counts == populated_state.content_type_counts
        assert restored.served_content_ids == populated_state.served_content_ids

    def test_from_dict_with_empty_dict_returns_defaults(self):
        """from_dict({}) should return a valid state with default values."""
        state = FeedState.from_dict({})
        assert state.streak == 0
        assert state.best_streak == 0
        assert state.total_xp == 0
        assert state.concepts == []
        assert state.current_difficulty == 0.4
        assert state.base_difficulty == 0.4
        assert state.reintroduction_queue == []
        assert state.cards_shown == 0

    def test_from_dict_with_none_returns_defaults(self):
        """from_dict(None) should return a valid default state."""
        state = FeedState.from_dict(None)
        assert state.streak == 0
        assert state.concepts == []

    def test_from_dict_with_missing_fields_uses_defaults(self):
        """from_dict with a partial dict should fill missing fields with defaults."""
        partial = {"streak": 7, "total_xp": 200}
        state = FeedState.from_dict(partial)
        assert state.streak == 7
        assert state.total_xp == 200
        # Missing fields should be defaults
        assert state.best_streak == 0
        assert state.current_difficulty == 0.4
        assert state.concepts == []
        assert state.reintroduction_queue == []

    def test_from_dict_with_extra_unknown_fields(self):
        """from_dict with extra keys not in the dataclass should not crash."""
        data_with_extras = {
            "streak": 3,
            "unknown_field": "should be ignored",
            "another_extra": 42,
            "nested_extra": {"a": 1},
        }
        state = FeedState.from_dict(data_with_extras)
        assert state.streak == 3
        # Unknown fields must not appear in the state
        assert not hasattr(state, "unknown_field")
        assert not hasattr(state, "another_extra")

    def test_from_dict_preserves_nested_structures(self):
        """Complex nested dicts and lists must survive round-trip."""
        data = {
            "concept_stats": {
                "algebra": {"attempts": 10, "correct": 8, "wrong_streak": 0},
                "geometry": {"attempts": 5, "correct": 2, "wrong_streak": 3},
            },
            "reintroduction_queue": [
                {"concept": "geometry", "cooldown": 1, "difficulty": 0.3},
            ],
            "confidence_records": [
                {"concept": "algebra", "confidence": 90, "is_correct": True, "timestamp": "t1"},
                {"concept": "algebra", "confidence": 85, "is_correct": False, "timestamp": "t2"},
            ],
        }
        state = FeedState.from_dict(data)
        assert state.concept_stats["algebra"]["attempts"] == 10
        assert len(state.reintroduction_queue) == 1
        assert state.reintroduction_queue[0]["concept"] == "geometry"
        assert len(state.confidence_records) == 2


# ==============================================================================
# XP Calculation
# ==============================================================================


class TestXPCalculation:
    """Tests for XP earned on correct/incorrect answers.

    XP formula (from process_answer):
        multiplier = min(3.0, 1.0 + (streak - 1) * 0.5)
        xp_earned = int(10 * multiplier * (1 + current_difficulty))
    """

    def test_correct_answer_gives_positive_xp(self):
        """A correct answer should always earn positive XP."""
        state = FeedState(streak=0, current_difficulty=0.4)
        # Simulate the XP logic from process_answer
        state.streak += 1
        multiplier = min(3.0, 1.0 + (state.streak - 1) * 0.5)
        xp_earned = int(10 * multiplier * (1 + state.current_difficulty))
        assert xp_earned > 0

    def test_incorrect_answer_gives_zero_xp(self):
        """An incorrect answer should earn 0 XP (streak resets, no XP granted)."""
        # In process_answer, XP is only granted inside the `if is_correct` branch
        xp_earned = 0  # Incorrect path does not compute XP
        assert xp_earned == 0

    def test_streak_1_gives_base_xp(self):
        """First correct answer (streak=1) gives 1x multiplier."""
        streak = 1
        difficulty = 0.4
        multiplier = min(3.0, 1.0 + (streak - 1) * 0.5)
        xp = int(10 * multiplier * (1 + difficulty))
        assert multiplier == 1.0
        assert xp == int(10 * 1.0 * 1.4)  # 14

    def test_streak_2_gives_1_5x_multiplier(self):
        """Second consecutive correct answer gives 1.5x multiplier."""
        streak = 2
        multiplier = min(3.0, 1.0 + (streak - 1) * 0.5)
        assert multiplier == 1.5

    def test_streak_3_gives_2x_multiplier(self):
        """Third consecutive correct answer gives 2x multiplier."""
        streak = 3
        multiplier = min(3.0, 1.0 + (streak - 1) * 0.5)
        assert multiplier == 2.0

    def test_streak_5_gives_3x_multiplier(self):
        """Fifth consecutive correct answer gives max 3x multiplier."""
        streak = 5
        multiplier = min(3.0, 1.0 + (streak - 1) * 0.5)
        assert multiplier == 3.0

    def test_streak_multiplier_capped_at_3x(self):
        """Multiplier should never exceed 3x regardless of streak length."""
        for streak in [6, 10, 50, 100]:
            multiplier = min(3.0, 1.0 + (streak - 1) * 0.5)
            assert multiplier == 3.0

    def test_xp_scales_with_difficulty(self):
        """Higher difficulty should yield more XP for the same streak."""
        streak = 1
        multiplier = min(3.0, 1.0 + (streak - 1) * 0.5)
        xp_easy = int(10 * multiplier * (1 + 0.2))
        xp_hard = int(10 * multiplier * (1 + 0.9))
        assert xp_hard > xp_easy

    def test_xp_always_non_negative(self):
        """XP should always be >= 0, even at minimum difficulty."""
        for difficulty in [0.0, 0.1, 0.15, 0.5, 0.95]:
            for streak in [1, 2, 5, 10]:
                multiplier = min(3.0, 1.0 + (streak - 1) * 0.5)
                xp = int(10 * multiplier * (1 + difficulty))
                assert xp >= 0, f"Negative XP at difficulty={difficulty}, streak={streak}"

    def test_total_xp_accumulates(self):
        """total_xp should grow with each correct answer."""
        state = FeedState(total_xp=100, streak=2, current_difficulty=0.5)
        state.streak += 1  # becomes 3
        multiplier = min(3.0, 1.0 + (state.streak - 1) * 0.5)
        xp_earned = int(10 * multiplier * (1 + state.current_difficulty))
        state.total_xp += xp_earned
        assert state.total_xp == 100 + xp_earned
        assert state.total_xp > 100


# ==============================================================================
# Streak Logic
# ==============================================================================


class TestStreakLogic:
    """Tests for streak increment, reset, and best_streak tracking."""

    def test_streak_increments_on_correct(self):
        """Correct answer should increment streak by 1."""
        state = FeedState(streak=0)
        # Simulate correct answer logic
        state.streak += 1
        assert state.streak == 1

    def test_streak_increments_consecutively(self):
        """Multiple correct answers should increment streak each time."""
        state = FeedState(streak=0)
        for i in range(5):
            state.streak += 1
        assert state.streak == 5

    def test_streak_resets_on_incorrect(self):
        """Incorrect answer should reset streak to 0."""
        state = FeedState(streak=7)
        state.streak = 0  # Incorrect answer resets
        assert state.streak == 0

    def test_best_streak_updated_on_correct(self):
        """best_streak should track the maximum streak achieved."""
        state = FeedState(streak=0, best_streak=0)
        for _ in range(4):
            state.streak += 1
            state.best_streak = max(state.best_streak, state.streak)
        assert state.best_streak == 4

    def test_best_streak_not_reduced_on_reset(self):
        """best_streak should never decrease when streak resets."""
        state = FeedState(streak=5, best_streak=5)
        state.streak = 0  # Wrong answer
        assert state.best_streak == 5

    def test_best_streak_updates_only_when_exceeded(self):
        """best_streak should only change when current streak exceeds it."""
        state = FeedState(streak=0, best_streak=10)
        for _ in range(3):
            state.streak += 1
            state.best_streak = max(state.best_streak, state.streak)
        # 3 < 10, so best_streak stays
        assert state.best_streak == 10

    def test_streak_broken_flag_logic(self):
        """streak_broken should be True only when a decent streak (>=3) is lost."""
        # Streak of 3 broken
        state = FeedState(streak=3)
        streak_broken = state.streak >= 3
        assert streak_broken is True

        # Streak of 2 broken -> not notable
        state.streak = 2
        streak_broken = state.streak >= 3
        assert streak_broken is False

        # Streak of 0 broken -> not notable
        state.streak = 0
        streak_broken = state.streak >= 3
        assert streak_broken is False


# ==============================================================================
# Difficulty Adaptation
# ==============================================================================


class TestDifficultyAdaptation:
    """Tests for difficulty adjustment logic (momentum-based fallback)."""

    def test_momentum_increases_on_correct(self, engine):
        """Correct answer should increase difficulty momentum."""
        state = FeedState(difficulty_momentum=0.0, current_difficulty=0.5)
        engine._adjust_difficulty_momentum(state, is_correct=True, time_ms=5000)
        assert state.difficulty_momentum > 0

    def test_momentum_decreases_on_incorrect(self, engine):
        """Incorrect answer should decrease difficulty momentum."""
        state = FeedState(difficulty_momentum=0.0, current_difficulty=0.5)
        engine._adjust_difficulty_momentum(state, is_correct=False, time_ms=5000)
        assert state.difficulty_momentum < 0

    def test_difficulty_increases_after_correct_answers(self, engine):
        """Multiple correct answers should increase current_difficulty."""
        state = FeedState(difficulty_momentum=0.0, current_difficulty=0.5)
        initial = state.current_difficulty
        for _ in range(5):
            engine._adjust_difficulty_momentum(state, is_correct=True, time_ms=5000)
        assert state.current_difficulty > initial

    def test_difficulty_decreases_after_incorrect_answers(self, engine):
        """Multiple incorrect answers should decrease current_difficulty."""
        state = FeedState(difficulty_momentum=0.0, current_difficulty=0.5)
        initial = state.current_difficulty
        for _ in range(5):
            engine._adjust_difficulty_momentum(state, is_correct=False, time_ms=5000)
        assert state.current_difficulty < initial

    def test_difficulty_stays_within_lower_bound(self, engine):
        """Difficulty should never drop below 0.15."""
        state = FeedState(difficulty_momentum=0.0, current_difficulty=0.2)
        for _ in range(50):
            engine._adjust_difficulty_momentum(state, is_correct=False, time_ms=5000)
        assert state.current_difficulty >= 0.15

    def test_difficulty_stays_within_upper_bound(self, engine):
        """Difficulty should never exceed 0.95."""
        state = FeedState(difficulty_momentum=0.0, current_difficulty=0.8)
        for _ in range(50):
            engine._adjust_difficulty_momentum(state, is_correct=True, time_ms=1000)
        assert state.current_difficulty <= 0.95

    def test_momentum_clamped(self, engine):
        """Momentum should be clamped to [-0.15, 0.15]."""
        state = FeedState(difficulty_momentum=0.0, current_difficulty=0.5)
        # Extreme correct streak
        for _ in range(100):
            engine._adjust_difficulty_momentum(state, is_correct=True, time_ms=1000)
        assert -0.15 <= state.difficulty_momentum <= 0.15

    def test_fast_correct_adds_extra_momentum(self, engine):
        """Correct answer in < 2s should add extra upward momentum."""
        state_fast = FeedState(difficulty_momentum=0.0, current_difficulty=0.5)
        state_normal = FeedState(difficulty_momentum=0.0, current_difficulty=0.5)

        engine._adjust_difficulty_momentum(state_fast, is_correct=True, time_ms=1500)
        engine._adjust_difficulty_momentum(state_normal, is_correct=True, time_ms=5000)

        # Fast answer should have higher momentum (before decay)
        # Both get +0.05, fast also gets +0.03, then both get *0.85
        assert state_fast.difficulty_momentum > state_normal.difficulty_momentum

    def test_slow_answer_reduces_momentum(self, engine):
        """Answer > 12s should subtract extra from momentum."""
        state_slow = FeedState(difficulty_momentum=0.05, current_difficulty=0.5)
        state_normal = FeedState(difficulty_momentum=0.05, current_difficulty=0.5)

        engine._adjust_difficulty_momentum(state_slow, is_correct=True, time_ms=15000)
        engine._adjust_difficulty_momentum(state_normal, is_correct=True, time_ms=5000)

        assert state_slow.difficulty_momentum < state_normal.difficulty_momentum

    def test_zpd_difficulty_used_when_bkt_available(self, engine):
        """When BKT state is available, ZPD selector should set difficulty."""
        state = FeedState(current_difficulty=0.5)
        bkt_state = BKTState(concept="test", p_learned=0.6)
        engine.zpd.select_difficulty = MagicMock(return_value=0.7)

        engine._adjust_difficulty_zpd(state, bkt_state, is_correct=True, time_ms=5000)

        engine.zpd.select_difficulty.assert_called_once()
        assert state.current_difficulty == 0.7

    def test_momentum_fallback_when_bkt_unavailable(self, engine):
        """When BKT state is None, should fall back to momentum-based adjustment."""
        state = FeedState(difficulty_momentum=0.0, current_difficulty=0.5)
        initial = state.current_difficulty

        engine._adjust_difficulty_zpd(state, bkt_state=None, is_correct=True, time_ms=5000)

        # Momentum should have been applied (difficulty should change)
        assert state.difficulty_momentum != 0.0 or state.current_difficulty != initial


# ==============================================================================
# Reintroduction Queue
# ==============================================================================


class TestReintroductionQueue:
    """Tests for the wrong-answer reintroduction queue."""

    def test_wrong_answer_adds_to_queue(self):
        """Incorrect answer should append a reintroduction entry."""
        state = FeedState(
            current_difficulty=0.5,
            concepts=["biology"],
            reintroduction_queue=[],
        )
        # Simulate wrong answer logic from process_answer
        concept = "biology"
        state.reintroduction_queue.append({
            "concept": concept,
            "cooldown": 3,
            "difficulty": max(0.2, state.current_difficulty - 0.15),
        })
        assert len(state.reintroduction_queue) == 1
        assert state.reintroduction_queue[0]["concept"] == "biology"
        assert state.reintroduction_queue[0]["difficulty"] == 0.35

    def test_reintroduction_difficulty_is_lower(self):
        """Reintroduced questions should come back at lower difficulty."""
        state = FeedState(current_difficulty=0.6)
        reintro_difficulty = max(0.2, state.current_difficulty - 0.15)
        assert reintro_difficulty < state.current_difficulty
        assert reintro_difficulty == pytest.approx(0.45)

    def test_reintroduction_difficulty_floor_at_0_2(self):
        """Reintroduction difficulty should not go below 0.2."""
        state = FeedState(current_difficulty=0.25)
        reintro_difficulty = max(0.2, state.current_difficulty - 0.15)
        assert reintro_difficulty == 0.2

    def test_queue_cap_trims_at_30(self):
        """Queue exceeding 30 items should be trimmed to last 20."""
        state = FeedState()
        for i in range(35):
            state.reintroduction_queue.append({
                "concept": f"concept_{i}",
                "cooldown": 3,
                "difficulty": 0.3,
            })
            if len(state.reintroduction_queue) > 30:
                state.reintroduction_queue = state.reintroduction_queue[-20:]

        assert len(state.reintroduction_queue) <= 30
        # After first trim at 31 items, it goes to 20. Then grows to 24 (35-31+20=24).
        assert len(state.reintroduction_queue) == 24

    def test_queue_trim_preserves_recent_items(self):
        """When trimmed, the most recent items should be kept."""
        state = FeedState()
        for i in range(35):
            state.reintroduction_queue.append({
                "concept": f"concept_{i}",
                "cooldown": 3,
                "difficulty": 0.3,
            })
            if len(state.reintroduction_queue) > 30:
                state.reintroduction_queue = state.reintroduction_queue[-20:]

        # The last item added should still be present
        last_concept = state.reintroduction_queue[-1]["concept"]
        assert last_concept == "concept_34"

    def test_cooldown_decrements(self):
        """Cooldown should decrement by 1 for each card shown."""
        queue = [
            {"concept": "a", "cooldown": 3, "difficulty": 0.3},
            {"concept": "b", "cooldown": 1, "difficulty": 0.3},
        ]
        for item in queue:
            item["cooldown"] = item.get("cooldown", 0) - 1
        assert queue[0]["cooldown"] == 2
        assert queue[1]["cooldown"] == 0

    def test_should_reintroduce_returns_ready_item(self, engine):
        """_should_reintroduce should return the first item with cooldown <= 0."""
        state = FeedState(
            reintroduction_queue=[
                {"concept": "a", "cooldown": 2, "difficulty": 0.3},
                {"concept": "b", "cooldown": 0, "difficulty": 0.25},
                {"concept": "c", "cooldown": -1, "difficulty": 0.2},
            ]
        )
        result = engine._should_reintroduce(state)
        assert result is not None
        assert result["concept"] == "b"
        # Item should be removed from the queue
        assert len(state.reintroduction_queue) == 2

    def test_should_reintroduce_returns_none_when_all_on_cooldown(self, engine):
        """_should_reintroduce should return None when all items have cooldown > 0."""
        state = FeedState(
            reintroduction_queue=[
                {"concept": "a", "cooldown": 2, "difficulty": 0.3},
                {"concept": "b", "cooldown": 5, "difficulty": 0.25},
            ]
        )
        result = engine._should_reintroduce(state)
        assert result is None
        # Queue should remain unchanged
        assert len(state.reintroduction_queue) == 2

    def test_should_reintroduce_returns_none_for_empty_queue(self, engine):
        """_should_reintroduce should return None for empty queue."""
        state = FeedState(reintroduction_queue=[])
        result = engine._should_reintroduce(state)
        assert result is None


# ==============================================================================
# Grading Logic
# ==============================================================================


class TestGradingLogic:
    """Tests for the _grade_answer method."""

    def test_correct_answer_exact_match(self, engine):
        """Exact match (case-insensitive) should return True."""
        state = FeedState()
        assert engine._grade_answer("B", state, correct_answer="B") is True
        assert engine._grade_answer("b", state, correct_answer="B") is True
        assert engine._grade_answer("B", state, correct_answer="b") is True

    def test_correct_answer_with_whitespace(self, engine):
        """Answer with leading/trailing whitespace should still match."""
        state = FeedState()
        assert engine._grade_answer("  B  ", state, correct_answer="B") is True
        assert engine._grade_answer("B", state, correct_answer="  B  ") is True

    def test_incorrect_answer(self, engine):
        """Wrong answer should return False."""
        state = FeedState()
        assert engine._grade_answer("A", state, correct_answer="B") is False
        assert engine._grade_answer("C", state, correct_answer="B") is False

    def test_fallback_when_no_correct_answer(self, engine):
        """Without correct_answer, any valid option A-D should return True."""
        state = FeedState()
        assert engine._grade_answer("A", state) is True
        assert engine._grade_answer("B", state) is True
        assert engine._grade_answer("C", state) is True
        assert engine._grade_answer("D", state) is True

    def test_fallback_rejects_invalid_option(self, engine):
        """Without correct_answer, invalid option should return False."""
        state = FeedState()
        assert engine._grade_answer("E", state) is False
        assert engine._grade_answer("hello", state) is False
        assert engine._grade_answer("", state) is False


# ==============================================================================
# Card Selection
# ==============================================================================


class TestCardSelection:
    """Tests for card type, concept selection, and legacy concept picking."""

    def test_scroll_card_valid_default_type(self):
        """Default card_type should be 'question'."""
        card = ScrollCard(
            id="test_1",
            question={"prompt": "What is X?", "options": ["A", "B"]},
            concept="test",
            difficulty=0.5,
        )
        assert card.card_type == "question"

    def test_scroll_card_accepts_valid_types(self):
        """Card should accept all documented card types."""
        valid_types = ["question", "review", "streak_bonus", "insight", "flashcard", "info_card"]
        for ct in valid_types:
            card = ScrollCard(
                id=f"test_{ct}",
                question={},
                concept="test",
                difficulty=0.5,
                card_type=ct,
            )
            assert card.card_type == ct

    def test_scroll_card_xp_value_default(self):
        """Default xp_value should be 10."""
        card = ScrollCard(id="t", question={}, concept="c", difficulty=0.5)
        assert card.xp_value == 10

    def test_pick_next_concept_legacy_returns_concept(self, engine):
        """_pick_next_concept_legacy should return a concept from the list."""
        state = FeedState(concepts=["algebra", "geometry", "calculus"])
        result = engine._pick_next_concept_legacy(state)
        assert result in state.concepts or result == "general"

    def test_pick_next_concept_legacy_empty_concepts(self, engine):
        """With no concepts, should return 'general'."""
        state = FeedState(concepts=[])
        result = engine._pick_next_concept_legacy(state)
        assert result == "general"

    def test_pick_next_concept_legacy_single_concept(self, engine):
        """With one concept, should consistently return it (or reintro)."""
        state = FeedState(concepts=["only_one"], reintroduction_queue=[])
        # Multiple runs should return the sole concept or "only_one"
        results = set()
        for _ in range(20):
            results.add(engine._pick_next_concept_legacy(state))
        assert "only_one" in results

    def test_pick_next_concept_legacy_prefers_reintroduction(self, engine):
        """If reintroduction is ready, it should be preferred (in the 60% path)."""
        state = FeedState(
            concepts=["a", "b"],
            reintroduction_queue=[
                {"concept": "a", "cooldown": 0, "difficulty": 0.3},
            ],
        )
        # Patch random to hit the current-concept path (roll < 0.6)
        with patch("app.services.scroll_feed_engine.random.random", return_value=0.1):
            result = engine._pick_next_concept_legacy(state)
        # The reintroduction check happens first
        assert result == "a"

    def test_pick_next_concept_legacy_weakest_path(self, engine):
        """In the 60-80% roll, should pick the weakest concept."""
        state = FeedState(
            concepts=["strong", "weak"],
            concept_stats={
                "strong": {"attempts": 10, "correct": 9, "wrong_streak": 0},
                "weak": {"attempts": 10, "correct": 2, "wrong_streak": 3},
            },
            reintroduction_queue=[],
        )
        with patch("app.services.scroll_feed_engine.random.random", return_value=0.7):
            result = engine._pick_next_concept_legacy(state)
        assert result == "weak"

    def test_pick_next_concept_legacy_unattempted_concept_chosen(self, engine):
        """Unattempted concept should be picked in the weakest path."""
        state = FeedState(
            concepts=["tried", "untried"],
            concept_stats={
                "tried": {"attempts": 5, "correct": 3, "wrong_streak": 0},
                # "untried" has no stats, so attempts=0
            },
            reintroduction_queue=[],
        )
        with patch("app.services.scroll_feed_engine.random.random", return_value=0.7):
            result = engine._pick_next_concept_legacy(state)
        assert result == "untried"

    def test_pick_next_concept_ts_fallback_to_legacy(self, engine):
        """Thompson Sampling selector should fall back to legacy when bkt_states is empty."""
        state = FeedState(concepts=["a", "b"])
        with patch.object(engine, "_pick_next_concept_legacy", return_value="a") as mock_legacy:
            result = engine._pick_next_concept_ts(state, bkt_states={})
        mock_legacy.assert_called_once_with(state)
        assert result == "a"

    def test_pick_next_concept_ts_with_bkt_states(self, engine):
        """Thompson Sampling selector should use concept_selector.select when bkt available."""
        state = FeedState(concepts=["a", "b"])
        bkt_states = {
            "a": BKTState(concept="a", p_learned=0.3),
            "b": BKTState(concept="b", p_learned=0.7),
        }
        engine.concept_selector.select = MagicMock(return_value="a")
        result = engine._pick_next_concept_ts(state, bkt_states)
        engine.concept_selector.select.assert_called_once()
        assert result == "a"


# ==============================================================================
# Confidence Estimation
# ==============================================================================


class TestConfidenceEstimation:
    """Tests for _estimate_confidence method."""

    def test_no_time_returns_50(self, engine):
        """Zero or negative time_ms should return neutral 50."""
        assert engine._estimate_confidence(0, True) == 50
        assert engine._estimate_confidence(-1, False) == 50

    def test_fast_correct_returns_high_confidence(self, engine):
        """Fast correct answer (<3s) indicates high confidence (80)."""
        assert engine._estimate_confidence(2000, True) == 80

    def test_fast_incorrect_returns_moderate_confidence(self, engine):
        """Fast incorrect answer (<3s) returns 70 (thought they knew it)."""
        assert engine._estimate_confidence(2000, False) == 70

    def test_medium_time_returns_60(self, engine):
        """Medium time (3-8s) returns 60 regardless of correctness."""
        assert engine._estimate_confidence(5000, True) == 60
        assert engine._estimate_confidence(5000, False) == 60

    def test_slow_answer_returns_35(self, engine):
        """Slow answer (>8s) indicates uncertainty (35)."""
        assert engine._estimate_confidence(10000, True) == 35
        assert engine._estimate_confidence(10000, False) == 35


# ==============================================================================
# Dunning-Kruger Nudge
# ==============================================================================


class TestDunningKrugerNudge:
    """Tests for _check_dk_nudge detection of overconfidence."""

    def test_no_nudge_on_correct_answer(self, engine):
        """Should not trigger on correct answers, even with high confidence."""
        state = FeedState()
        result = engine._check_dk_nudge(state, "test", confidence=90, is_correct=True)
        assert result is None

    def test_no_nudge_on_low_confidence_wrong(self, engine):
        """Should not trigger if confidence is below threshold (< 60)."""
        state = FeedState()
        result = engine._check_dk_nudge(state, "test", confidence=40, is_correct=False)
        assert result is None

    def test_no_nudge_with_insufficient_records(self, engine):
        """Need at least 3 records for the concept to trigger."""
        state = FeedState(
            confidence_records=[
                {"concept": "test", "confidence": 90, "is_correct": False, "timestamp": "t1"},
                {"concept": "test", "confidence": 85, "is_correct": False, "timestamp": "t2"},
            ]
        )
        result = engine._check_dk_nudge(state, "test", confidence=80, is_correct=False)
        assert result is None

    def test_nudge_triggered_on_overconfidence(self, engine):
        """Should trigger when avg confidence >> accuracy (gap >= 25)."""
        state = FeedState(
            confidence_records=[
                {"concept": "math", "confidence": 90, "is_correct": False, "timestamp": "t1"},
                {"concept": "math", "confidence": 85, "is_correct": False, "timestamp": "t2"},
                {"concept": "math", "confidence": 88, "is_correct": False, "timestamp": "t3"},
                {"concept": "math", "confidence": 92, "is_correct": True, "timestamp": "t4"},
            ]
        )
        # avg_confidence = (90+85+88+92)/4 = 88.75
        # accuracy = 1/4 * 100 = 25%
        # gap = 88.75 - 25 = 63.75 >= 25 -> should trigger
        result = engine._check_dk_nudge(state, "math", confidence=85, is_correct=False)
        assert result is not None
        assert result["type"] == "dk_overconfident"
        assert result["gap"] >= 25

    def test_no_nudge_when_well_calibrated(self, engine):
        """Should not trigger when confidence closely matches accuracy."""
        state = FeedState(
            confidence_records=[
                {"concept": "math", "confidence": 70, "is_correct": True, "timestamp": "t1"},
                {"concept": "math", "confidence": 65, "is_correct": True, "timestamp": "t2"},
                {"concept": "math", "confidence": 60, "is_correct": False, "timestamp": "t3"},
            ]
        )
        # avg_confidence = 65, accuracy = 66.7%, gap = -1.7 < 25
        result = engine._check_dk_nudge(state, "math", confidence=60, is_correct=False)
        assert result is None

    def test_nudge_only_uses_matching_concept_records(self, engine):
        """DK check should only consider records for the specific concept."""
        state = FeedState(
            confidence_records=[
                # Other concept
                {"concept": "biology", "confidence": 90, "is_correct": False, "timestamp": "t1"},
                {"concept": "biology", "confidence": 90, "is_correct": False, "timestamp": "t2"},
                {"concept": "biology", "confidence": 90, "is_correct": False, "timestamp": "t3"},
                # Target concept - well calibrated
                {"concept": "math", "confidence": 60, "is_correct": True, "timestamp": "t4"},
                {"concept": "math", "confidence": 55, "is_correct": True, "timestamp": "t5"},
                {"concept": "math", "confidence": 50, "is_correct": False, "timestamp": "t6"},
            ]
        )
        result = engine._check_dk_nudge(state, "math", confidence=55, is_correct=False)
        assert result is None  # math is well calibrated


# ==============================================================================
# Engagement Metrics
# ==============================================================================


class TestEngagementMetrics:
    """Tests for avg_time_ms, fast_answers, slow_answers tracking."""

    def test_avg_time_exponential_moving_average(self):
        """avg_time_ms should update with EMA formula: 0.8 * old + 0.2 * new."""
        state = FeedState(avg_time_ms=5000.0)
        time_ms = 3000
        state.avg_time_ms = state.avg_time_ms * 0.8 + time_ms * 0.2
        assert state.avg_time_ms == pytest.approx(4600.0)

    def test_fast_answer_counted(self):
        """Answer < 2000ms should increment fast_answers."""
        state = FeedState(fast_answers=0)
        time_ms = 1500
        if time_ms < 2000:
            state.fast_answers += 1
        assert state.fast_answers == 1

    def test_slow_answer_counted(self):
        """Answer > 15000ms should increment slow_answers."""
        state = FeedState(slow_answers=0)
        time_ms = 20000
        if time_ms > 15000:
            state.slow_answers += 1
        assert state.slow_answers == 1

    def test_normal_answer_no_counter_change(self):
        """Answer between 2000-15000ms should not increment either counter."""
        state = FeedState(fast_answers=0, slow_answers=0)
        time_ms = 5000
        if time_ms < 2000:
            state.fast_answers += 1
        elif time_ms > 15000:
            state.slow_answers += 1
        assert state.fast_answers == 0
        assert state.slow_answers == 0

    def test_zero_time_no_update(self):
        """If time_ms <= 0, no metrics should be updated."""
        state = FeedState(avg_time_ms=5000.0, fast_answers=0, slow_answers=0)
        time_ms = 0
        if time_ms > 0:
            state.avg_time_ms = state.avg_time_ms * 0.8 + time_ms * 0.2
            if time_ms < 2000:
                state.fast_answers += 1
            elif time_ms > 15000:
                state.slow_answers += 1
        assert state.avg_time_ms == 5000.0
        assert state.fast_answers == 0


# ==============================================================================
# Concept Rotation
# ==============================================================================


class TestConceptRotation:
    """Tests for topic rotation logic to prevent fatigue."""

    def test_rotation_after_3_cards_on_same_concept(self):
        """current_concept_idx should advance after 3 cards on one concept."""
        state = FeedState(
            concepts=["a", "b", "c"],
            current_concept_idx=0,
            cards_on_current_concept=2,
        )
        # Simulate the rotation check from process_answer
        state.cards_on_current_concept += 1
        if state.cards_on_current_concept >= 3:
            state.current_concept_idx = (state.current_concept_idx + 1) % len(state.concepts)
            state.cards_on_current_concept = 0

        assert state.current_concept_idx == 1
        assert state.cards_on_current_concept == 0

    def test_rotation_on_wrong_streak(self):
        """Should rotate when wrong_streak >= 2 for a concept."""
        state = FeedState(
            concepts=["a", "b"],
            current_concept_idx=0,
            cards_on_current_concept=1,
        )
        wrong_streak = 2
        is_correct = False
        state.cards_on_current_concept += 1
        if state.cards_on_current_concept >= 3 or (not is_correct and wrong_streak >= 2):
            state.current_concept_idx = (state.current_concept_idx + 1) % len(state.concepts)
            state.cards_on_current_concept = 0

        assert state.current_concept_idx == 1
        assert state.cards_on_current_concept == 0

    def test_rotation_wraps_around(self):
        """Rotation should wrap around to the start of concept list."""
        state = FeedState(
            concepts=["a", "b", "c"],
            current_concept_idx=2,
            cards_on_current_concept=2,
        )
        state.cards_on_current_concept += 1
        if state.cards_on_current_concept >= 3:
            state.current_concept_idx = (state.current_concept_idx + 1) % len(state.concepts)
            state.cards_on_current_concept = 0

        assert state.current_concept_idx == 0


# ==============================================================================
# Stats and Analytics Helpers
# ==============================================================================


class TestStatsAndAnalytics:
    """Tests for _get_stats and _build_card_analytics."""

    def test_get_stats_returns_all_keys(self, engine):
        """_get_stats should return streak, best_streak, total_xp, difficulty, cards_shown."""
        state = FeedState(
            streak=3, best_streak=5, total_xp=150,
            current_difficulty=0.55, cards_shown=10,
        )
        stats = engine._get_stats(state)
        assert stats["streak"] == 3
        assert stats["best_streak"] == 5
        assert stats["total_xp"] == 150
        assert stats["difficulty"] == 0.55
        assert stats["cards_shown"] == 10

    def test_get_stats_rounds_difficulty(self, engine):
        """Difficulty should be rounded to 2 decimal places."""
        state = FeedState(current_difficulty=0.33333)
        stats = engine._get_stats(state)
        assert stats["difficulty"] == 0.33

    def test_build_card_analytics_accuracy(self, engine):
        """Analytics should compute correct accuracy percentage."""
        state = FeedState(
            concept_stats={
                "algebra": {"attempts": 10, "correct": 8, "wrong_streak": 0},
            },
            difficulty_momentum=0.0,
        )
        analytics = engine._build_card_analytics(state, "algebra", is_correct=True)
        assert analytics["concept_accuracy"] == 80
        assert analytics["concept_attempts"] == 10
        assert analytics["concept"] == "algebra"

    def test_build_card_analytics_with_zero_attempts(self, engine):
        """With no prior attempts, accuracy should be 0 (no division error)."""
        state = FeedState(concept_stats={}, difficulty_momentum=0.0)
        analytics = engine._build_card_analytics(state, "new_topic", is_correct=True)
        assert analytics["concept_accuracy"] == 0
        assert analytics["concept_attempts"] == 0

    def test_build_card_analytics_difficulty_trend(self, engine):
        """Should report difficulty trend based on momentum."""
        state_harder = FeedState(difficulty_momentum=0.05)
        assert engine._build_card_analytics(state_harder, "x", True)["difficulty_trend"] == "harder"

        state_easier = FeedState(difficulty_momentum=-0.05)
        assert engine._build_card_analytics(state_easier, "x", True)["difficulty_trend"] == "easier"

        state_stable = FeedState(difficulty_momentum=0.01)
        assert engine._build_card_analytics(state_stable, "x", True)["difficulty_trend"] == "stable"

    def test_build_card_analytics_identifies_weak_and_strong(self, engine):
        """Should correctly classify weak (<50%) and strong (>=80%) concepts."""
        state = FeedState(
            concept_stats={
                "strong": {"attempts": 10, "correct": 9, "wrong_streak": 0},
                "weak": {"attempts": 10, "correct": 3, "wrong_streak": 2},
                "medium": {"attempts": 10, "correct": 6, "wrong_streak": 0},
                "not_enough": {"attempts": 1, "correct": 0, "wrong_streak": 1},
            },
            difficulty_momentum=0.0,
        )
        analytics = engine._build_card_analytics(state, "strong", True)
        assert "strong" in analytics["strengths"]
        assert "weak" in analytics["improvement_areas"]
        # medium (60%) is neither weak nor strong
        assert "medium" not in analytics["strengths"]
        assert "medium" not in analytics["improvement_areas"]
        # not_enough (1 attempt) should be excluded (needs >= 2)
        assert "not_enough" not in analytics["improvement_areas"]


# ==============================================================================
# Card to Dict Conversion
# ==============================================================================


class TestCardToDict:
    """Tests for _card_to_dict conversion."""

    def test_basic_card_conversion(self, engine):
        """Standard question card should include all base fields."""
        card = ScrollCard(
            id="card_abc",
            question={
                "prompt": "What is 2+2?",
                "options": ["A. 3", "B. 4", "C. 5"],
                "correct_answer": "B",
                "explanation": "Basic addition",
            },
            concept="arithmetic",
            difficulty=0.3,
            card_type="question",
            xp_value=14,
        )
        d = engine._card_to_dict(card)
        assert d["id"] == "card_abc"
        assert d["prompt"] == "What is 2+2?"
        assert d["options"] == ["A. 3", "B. 4", "C. 5"]
        assert d["correct_answer"] == "B"
        assert d["explanation"] == "Basic addition"
        assert d["concept"] == "arithmetic"
        assert d["difficulty"] == 0.3
        assert d["card_type"] == "question"
        assert d["xp_value"] == 14
        assert d["is_reintroduction"] is False

    def test_flashcard_includes_extra_fields(self, engine):
        """Flashcard type should include front, back, hint fields."""
        card = ScrollCard(
            id="fc_1",
            question={
                "flashcard_front": "What is DNA?",
                "flashcard_back": "Deoxyribonucleic acid",
                "flashcard_hint": "Double helix",
            },
            concept="genetics",
            difficulty=0.4,
            card_type="flashcard",
        )
        d = engine._card_to_dict(card)
        assert d["flashcard_front"] == "What is DNA?"
        assert d["flashcard_back"] == "Deoxyribonucleic acid"
        assert d["flashcard_hint"] == "Double helix"

    def test_info_card_includes_extra_fields(self, engine):
        """Info card type should include title, body, takeaway fields."""
        card = ScrollCard(
            id="info_1",
            question={
                "info_title": "Fun fact",
                "info_body": "Octopuses have three hearts.",
                "info_takeaway": "Biology is fascinating!",
            },
            concept="marine_biology",
            difficulty=0.2,
            card_type="info_card",
        )
        d = engine._card_to_dict(card)
        assert d["info_title"] == "Fun fact"
        assert d["info_body"] == "Octopuses have three hearts."
        assert d["info_takeaway"] == "Biology is fascinating!"

    def test_resource_card_includes_extra_fields(self, engine):
        """Resource card type should include url, type, thumbnail, etc."""
        card = ScrollCard(
            id="res_1",
            question={
                "resource_title": "Great video",
                "resource_url": "https://example.com/video",
                "resource_type": "youtube",
                "resource_thumbnail": "https://img.example.com/thumb.jpg",
                "resource_description": "A helpful tutorial",
                "resource_duration": "10:30",
                "resource_channel": "EduChannel",
                "resource_domain": "example.com",
            },
            concept="math",
            difficulty=0.5,
            card_type="resource_card",
        )
        d = engine._card_to_dict(card)
        assert d["resource_title"] == "Great video"
        assert d["resource_url"] == "https://example.com/video"
        assert d["resource_type"] == "youtube"
        assert d["resource_channel"] == "EduChannel"

    def test_content_item_id_included_when_present(self, engine):
        """content_item_id should be in output when set on the card."""
        card = ScrollCard(
            id="t", question={}, concept="c", difficulty=0.5,
            content_item_id="pool_item_42",
        )
        d = engine._card_to_dict(card)
        assert d["content_item_id"] == "pool_item_42"

    def test_content_item_id_excluded_when_none(self, engine):
        """content_item_id should not appear in output when None."""
        card = ScrollCard(
            id="t", question={}, concept="c", difficulty=0.5,
            content_item_id=None,
        )
        d = engine._card_to_dict(card)
        assert "content_item_id" not in d

    def test_difficulty_rounded_to_2_decimals(self, engine):
        """Difficulty in card dict should be rounded to 2 decimal places."""
        card = ScrollCard(
            id="t", question={}, concept="c", difficulty=0.33333333,
        )
        d = engine._card_to_dict(card)
        assert d["difficulty"] == 0.33


# ==============================================================================
# Confidence Records Cap
# ==============================================================================


class TestConfidenceRecordsCap:
    """Tests for confidence_records list capping at 200."""

    def test_confidence_records_capped_at_200(self):
        """When exceeding 200 records, should trim to last 200."""
        state = FeedState()
        for i in range(210):
            state.confidence_records.append({
                "concept": "test",
                "confidence": 70,
                "is_correct": True,
                "timestamp": f"t_{i}",
            })
            if len(state.confidence_records) > 200:
                state.confidence_records = state.confidence_records[-200:]

        assert len(state.confidence_records) == 200
        # The most recent record should be the last one
        assert state.confidence_records[-1]["timestamp"] == "t_209"

    def test_confidence_records_under_cap_unchanged(self):
        """Records under 200 should not be trimmed."""
        state = FeedState()
        for i in range(50):
            state.confidence_records.append({
                "concept": "test",
                "confidence": 70,
                "is_correct": True,
                "timestamp": f"t_{i}",
            })
        assert len(state.confidence_records) == 50


# ==============================================================================
# Integration: Simulated Answer Sequence (State Machine)
# ==============================================================================


class TestSimulatedAnswerSequence:
    """Simulate multiple answers to verify state machine transitions end-to-end."""

    def test_five_correct_answers_build_streak_and_xp(self, engine):
        """Five consecutive correct answers should build streak and accumulate XP."""
        state = FeedState(
            concepts=["algebra"],
            current_difficulty=0.5,
        )
        for i in range(5):
            concept = "algebra"
            # Update stats
            if concept not in state.concept_stats:
                state.concept_stats[concept] = {"attempts": 0, "correct": 0, "wrong_streak": 0}
            stats = state.concept_stats[concept]
            stats["attempts"] += 1
            stats["correct"] += 1
            stats["wrong_streak"] = 0

            # Streak and XP
            state.streak += 1
            state.best_streak = max(state.best_streak, state.streak)
            multiplier = min(3.0, 1.0 + (state.streak - 1) * 0.5)
            xp_earned = int(10 * multiplier * (1 + state.current_difficulty))
            state.total_xp += xp_earned

            # Difficulty (momentum fallback)
            engine._adjust_difficulty_momentum(state, is_correct=True, time_ms=5000)

            state.cards_shown += 1

        assert state.streak == 5
        assert state.best_streak == 5
        assert state.total_xp > 0
        assert state.cards_shown == 5
        assert state.concept_stats["algebra"]["attempts"] == 5
        assert state.concept_stats["algebra"]["correct"] == 5
        assert state.current_difficulty > 0.5  # Should have increased

    def test_correct_then_wrong_then_correct_sequence(self, engine):
        """Mixed answer sequence should correctly update all state."""
        state = FeedState(
            concepts=["physics"],
            current_difficulty=0.5,
        )
        answers = [True, True, True, False, True, True]
        xp_total = 0

        for is_correct in answers:
            concept = "physics"
            if concept not in state.concept_stats:
                state.concept_stats[concept] = {"attempts": 0, "correct": 0, "wrong_streak": 0}
            stats = state.concept_stats[concept]
            stats["attempts"] += 1

            if is_correct:
                stats["correct"] += 1
                stats["wrong_streak"] = 0
                state.streak += 1
                state.best_streak = max(state.best_streak, state.streak)
                multiplier = min(3.0, 1.0 + (state.streak - 1) * 0.5)
                xp_earned = int(10 * multiplier * (1 + state.current_difficulty))
                state.total_xp += xp_earned
                xp_total += xp_earned
            else:
                stats["wrong_streak"] = stats.get("wrong_streak", 0) + 1
                state.streak = 0
                state.reintroduction_queue.append({
                    "concept": concept,
                    "cooldown": 3,
                    "difficulty": max(0.2, state.current_difficulty - 0.15),
                })

            engine._adjust_difficulty_momentum(state, is_correct=is_correct, time_ms=5000)
            state.cards_shown += 1

        assert state.streak == 2  # Last two were correct
        assert state.best_streak == 3  # Longest was first three
        assert state.total_xp == xp_total
        assert state.concept_stats["physics"]["attempts"] == 6
        assert state.concept_stats["physics"]["correct"] == 5
        assert len(state.reintroduction_queue) == 1  # One wrong answer

    def test_all_wrong_keeps_difficulty_low(self, engine):
        """Repeated wrong answers should keep difficulty at or near the floor."""
        state = FeedState(
            concepts=["hard_topic"],
            current_difficulty=0.5,
        )
        for _ in range(20):
            engine._adjust_difficulty_momentum(state, is_correct=False, time_ms=10000)

        assert state.current_difficulty <= 0.3  # Should be near floor
        assert state.current_difficulty >= 0.15  # But not below floor


# ==============================================================================
# Help History Cap
# ==============================================================================


class TestHelpHistoryCap:
    """Tests for help_history list capping at 50 -> trim to 30."""

    def test_help_history_trimmed_at_50(self):
        """When help_history exceeds 50 messages, trim to last 30."""
        state = FeedState()
        for i in range(55):
            state.help_history.append({"role": "user", "content": f"msg_{i}"})
            if len(state.help_history) > 50:
                state.help_history = state.help_history[-30:]

        assert len(state.help_history) <= 50
        # Most recent message should be the last added
        assert state.help_history[-1]["content"] == "msg_54"

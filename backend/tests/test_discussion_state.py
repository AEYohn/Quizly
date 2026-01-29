"""
Unit tests for DiscussionState dataclass in smart_peer_service.

Tests:
- Default values
- to_dict() serialization
- from_dict() deserialization
- Round-trip serialization
- Handling of missing/extra fields
"""

import pytest
from app.services.smart_peer_service import DiscussionState


class TestDiscussionStateDefaults:
    """Test default values of DiscussionState."""

    def test_default_phase(self):
        state = DiscussionState()
        assert state.phase == "probing"

    def test_default_probing_depth(self):
        state = DiscussionState()
        assert state.probing_depth == 3

    def test_default_counts(self):
        state = DiscussionState()
        assert state.current_probing_count == 0
        assert state.stuck_count == 0
        assert state.hints_given == 0
        assert state.hints_requested == 0

    def test_default_lists(self):
        state = DiscussionState()
        assert state.detected_misconceptions == []
        assert state.confusion_areas == []
        assert state.student_reasoning_points == []

    def test_default_strings(self):
        state = DiscussionState()
        assert state.last_reasoning_theme == ""
        assert state.error_type == ""

    def test_default_confidence(self):
        state = DiscussionState()
        assert state.initial_confidence == 50

    def test_default_making_progress(self):
        state = DiscussionState()
        assert state.making_progress is True


class TestDiscussionStateToDict:
    """Test to_dict() serialization."""

    def test_to_dict_returns_dict(self):
        state = DiscussionState()
        result = state.to_dict()
        assert isinstance(result, dict)

    def test_to_dict_contains_all_fields(self):
        state = DiscussionState()
        result = state.to_dict()
        expected_fields = [
            "phase", "probing_depth", "current_probing_count", "stuck_count",
            "hints_given", "hints_requested", "detected_misconceptions",
            "confusion_areas", "student_reasoning_points", "last_reasoning_theme",
            "error_type", "initial_confidence", "making_progress"
        ]
        for field in expected_fields:
            assert field in result, f"Missing field: {field}"

    def test_to_dict_preserves_values(self):
        state = DiscussionState(
            phase="hinting",
            probing_depth=4,
            hints_given=2,
            error_type="conceptual"
        )
        result = state.to_dict()
        assert result["phase"] == "hinting"
        assert result["probing_depth"] == 4
        assert result["hints_given"] == 2
        assert result["error_type"] == "conceptual"

    def test_to_dict_with_lists(self):
        state = DiscussionState(
            detected_misconceptions=[{"type": "definition", "description": "test"}],
            confusion_areas=["area1", "area2"],
            student_reasoning_points=["point1"]
        )
        result = state.to_dict()
        assert len(result["detected_misconceptions"]) == 1
        assert len(result["confusion_areas"]) == 2
        assert len(result["student_reasoning_points"]) == 1


class TestDiscussionStateFromDict:
    """Test from_dict() deserialization."""

    def test_from_dict_with_empty_dict(self):
        state = DiscussionState.from_dict({})
        # Should use defaults
        assert state.phase == "probing"
        assert state.probing_depth == 3

    def test_from_dict_with_none(self):
        state = DiscussionState.from_dict(None)
        # Should return default state
        assert state.phase == "probing"
        assert state.probing_depth == 3

    def test_from_dict_with_partial_data(self):
        data = {"phase": "explaining", "hints_given": 3}
        state = DiscussionState.from_dict(data)
        assert state.phase == "explaining"
        assert state.hints_given == 3
        # Other fields should be defaults
        assert state.probing_depth == 3
        assert state.stuck_count == 0

    def test_from_dict_ignores_extra_fields(self):
        data = {
            "phase": "targeted",
            "unknown_field": "should be ignored",
            "another_unknown": 123
        }
        state = DiscussionState.from_dict(data)
        assert state.phase == "targeted"
        # Should not raise error for unknown fields

    def test_from_dict_with_full_data(self):
        data = {
            "phase": "hinting",
            "probing_depth": 2,
            "current_probing_count": 1,
            "stuck_count": 2,
            "hints_given": 1,
            "hints_requested": 1,
            "detected_misconceptions": [{"type": "scope"}],
            "confusion_areas": ["variables"],
            "student_reasoning_points": ["I think..."],
            "last_reasoning_theme": "variable confusion",
            "error_type": "conceptual",
            "initial_confidence": 85,
            "making_progress": False
        }
        state = DiscussionState.from_dict(data)
        assert state.phase == "hinting"
        assert state.probing_depth == 2
        assert state.current_probing_count == 1
        assert state.stuck_count == 2
        assert state.hints_given == 1
        assert state.hints_requested == 1
        assert len(state.detected_misconceptions) == 1
        assert len(state.confusion_areas) == 1
        assert len(state.student_reasoning_points) == 1
        assert state.last_reasoning_theme == "variable confusion"
        assert state.error_type == "conceptual"
        assert state.initial_confidence == 85
        assert state.making_progress is False


class TestDiscussionStateRoundTrip:
    """Test serialization round-trip (to_dict -> from_dict)."""

    def test_roundtrip_preserves_data(self):
        original = DiscussionState(
            phase="targeted",
            probing_depth=4,
            current_probing_count=2,
            stuck_count=1,
            hints_given=2,
            hints_requested=1,
            detected_misconceptions=[
                {"type": "definition", "description": "confused about propositions"}
            ],
            confusion_areas=["propositions", "variables"],
            student_reasoning_points=["I think A because..."],
            last_reasoning_theme="sky color change",
            error_type="overconfident",
            initial_confidence=95,
            making_progress=True
        )

        # Serialize and deserialize
        data = original.to_dict()
        restored = DiscussionState.from_dict(data)

        # Verify all fields match
        assert restored.phase == original.phase
        assert restored.probing_depth == original.probing_depth
        assert restored.current_probing_count == original.current_probing_count
        assert restored.stuck_count == original.stuck_count
        assert restored.hints_given == original.hints_given
        assert restored.hints_requested == original.hints_requested
        assert restored.detected_misconceptions == original.detected_misconceptions
        assert restored.confusion_areas == original.confusion_areas
        assert restored.student_reasoning_points == original.student_reasoning_points
        assert restored.last_reasoning_theme == original.last_reasoning_theme
        assert restored.error_type == original.error_type
        assert restored.initial_confidence == original.initial_confidence
        assert restored.making_progress == original.making_progress

    def test_roundtrip_with_empty_lists(self):
        original = DiscussionState()
        data = original.to_dict()
        restored = DiscussionState.from_dict(data)

        assert restored.detected_misconceptions == []
        assert restored.confusion_areas == []
        assert restored.student_reasoning_points == []


class TestDiscussionStateMutability:
    """Test that DiscussionState can be mutated correctly."""

    def test_increment_counters(self):
        state = DiscussionState()
        state.current_probing_count += 1
        state.hints_given += 1
        state.stuck_count += 1

        assert state.current_probing_count == 1
        assert state.hints_given == 1
        assert state.stuck_count == 1

    def test_append_to_lists(self):
        state = DiscussionState()
        state.detected_misconceptions.append({"type": "test"})
        state.confusion_areas.append("area")
        state.student_reasoning_points.append("point")

        assert len(state.detected_misconceptions) == 1
        assert len(state.confusion_areas) == 1
        assert len(state.student_reasoning_points) == 1

    def test_change_phase(self):
        state = DiscussionState()
        assert state.phase == "probing"

        state.phase = "hinting"
        assert state.phase == "hinting"

        state.phase = "explaining"
        assert state.phase == "explaining"

    def test_reset_stuck_count(self):
        state = DiscussionState(stuck_count=3)
        assert state.stuck_count == 3

        state.stuck_count = 0
        assert state.stuck_count == 0

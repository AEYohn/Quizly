"""Simulation module for student modeling and session simulation."""

from .student_model import SimulatedStudent, generate_students
from .session_simulator import SessionSimulator
from .llm_student import LLMStudent, generate_llm_students

# Rigorous simulation with LLM reasoning and debates
from .reasoning_student import (
    ReasoningStudent,
    generate_reasoning_students,
    ReasoningChain,
    DebatePosition,
    Misconception,
    PERSONA_TEMPLATES
)
from .debate_engine import DebateEngine, DebateResult, ConsensusResult
from .learning_tracker import LearningTracker, LearningEvent, ClassLearningMetrics
from .rigorous_experiment import (
    RigorousExperiment,
    ExperimentResult,
    run_comparison_experiment,
    CS70_QUESTIONS
)

__all__ = [
    # Legacy simulation
    "SimulatedStudent", "generate_students", "SessionSimulator",
    "LLMStudent", "generate_llm_students",
    # Rigorous simulation
    "ReasoningStudent", "generate_reasoning_students", "ReasoningChain",
    "DebatePosition", "Misconception", "PERSONA_TEMPLATES",
    "DebateEngine", "DebateResult", "ConsensusResult",
    "LearningTracker", "LearningEvent", "ClassLearningMetrics",
    "RigorousExperiment", "ExperimentResult", "run_comparison_experiment",
    "CS70_QUESTIONS"
]


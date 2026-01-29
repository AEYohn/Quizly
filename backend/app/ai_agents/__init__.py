"""AI Agents for Quizly Backend."""

from .question_generator import QuestionBankGenerator, generate_questions, shuffle_options
from .exit_ticket_agent import ExitTicketAgent
from .misconception_tagger import MisconceptionTagger, MisconceptionResult
from .debate_judge import DebateJudge, JudgmentResult
from .demo_cache import with_demo_fallback, is_demo_mode, demo_cache, DemoCache

__all__ = [
    "QuestionBankGenerator",
    "generate_questions",
    "shuffle_options",
    "ExitTicketAgent",
    "MisconceptionTagger",
    "MisconceptionResult",
    "DebateJudge",
    "JudgmentResult",
    # Demo mode utilities
    "with_demo_fallback",
    "is_demo_mode",
    "demo_cache",
    "DemoCache",
]

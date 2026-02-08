"""
Flashcard Generator — AI Subagent for Content Pool

Generates difficulty-calibrated flashcards for the scroll feed.
Follows the same Gemini + fallback pattern as QuestionBankGenerator.
"""

import os
import json
from typing import Dict, Any, Optional

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..utils.llm_utils import call_gemini_with_timeout, GEMINI_MODEL_NAME

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = get_logger(__name__)


class FlashcardGenerator:
    """
    Generates flashcards from concepts using Gemini LLM.

    Easy cards → definitional (What is X?)
    Medium cards → compare/contrast (How does X differ from Y?)
    Hard cards → application (When would you use X over Y?)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None

        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(GEMINI_MODEL_NAME)
            except Exception as e:
                capture_exception(e, context={"service": "flashcard_generator", "operation": "initialize_gemini"})
                log_error(logger, "initialize_gemini failed", error=str(e))

    async def generate_flashcard(
        self,
        concept: Dict[str, Any],
        difficulty: float = 0.5,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a single flashcard for a concept.

        Args:
            concept: Dict with id, name, topics, misconceptions
            difficulty: 0.0-1.0
            context: Optional notes/topic context

        Returns:
            {front, back, hint, concept, difficulty}
        """
        if not self.model:
            return self._fallback_flashcard(concept, difficulty)

        difficulty_label = "easy" if difficulty < 0.4 else "medium" if difficulty < 0.7 else "hard"

        style_guidance = {
            "easy": "Ask a simple definitional question. 'What is X?' or 'Define X.'",
            "medium": "Ask a compare/contrast or explain-why question. 'How does X differ from Y?' or 'Why is X important?'",
            "hard": "Ask an application or analysis question. 'When would you choose X over Y?' or 'What happens if X fails?'",
        }[difficulty_label]

        context_line = f"\nCONTEXT: {context[:500]}" if context else ""

        prompt = f"""You are creating a study flashcard for a student.

CONCEPT: {concept['name']}
RELATED TOPICS: {', '.join(concept.get('topics', []))}
DIFFICULTY: {difficulty_label} ({difficulty:.1f}/1.0)
STYLE: {style_guidance}{context_line}

Create a flashcard with:
- FRONT: A clear, specific question or prompt (1-2 sentences)
- BACK: A concise, complete answer (2-4 sentences)
- HINT: An optional nudge that helps without giving the answer away (1 sentence)

Return ONLY valid JSON:
{{
    "front": "The question or prompt",
    "back": "The complete answer",
    "hint": "A helpful nudge"
}}"""

        try:
            response = await call_gemini_with_timeout(
                self.model, prompt,
                generation_config={"response_mime_type": "application/json"},
                context={"agent": "flashcard_generator", "operation": "generate_flashcard"},
            )
            if response is not None:
                result = json.loads(response.text)
                if self._validate_flashcard(result):
                    result["concept"] = concept.get("id", concept.get("name", "unknown"))
                    result["difficulty"] = difficulty
                    return result
        except Exception as e:
            capture_exception(e, context={"service": "flashcard_generator", "operation": "generate_flashcard"})
            log_error(logger, "generate_flashcard failed", error=str(e))

        return self._fallback_flashcard(concept, difficulty)

    def _validate_flashcard(self, card: Dict) -> bool:
        """Check flashcard has real content."""
        front = card.get("front", "")
        back = card.get("back", "")
        if len(front) < 10 or len(back) < 10:
            return False
        if "[placeholder" in front.lower() or "[llm" in front.lower():
            return False
        return True

    def _fallback_flashcard(self, concept: Dict, difficulty: float) -> Dict[str, Any]:
        """Minimal flashcard when Gemini is unavailable."""
        name = concept.get("name", "Unknown Concept")
        return {
            "front": f"[LLM Required] What is {name}?",
            "back": f"[LLM required to generate answer for {name}]",
            "hint": "",
            "concept": concept.get("id", name),
            "difficulty": difficulty,
            "llm_required": True,
        }

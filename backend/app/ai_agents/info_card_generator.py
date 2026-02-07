"""
Info Card Generator — AI Subagent for Content Pool

Generates scannable informational cards for the scroll feed.
Designed for passive learning — no question, just insight delivery.
Follows the same Gemini + fallback pattern as QuestionBankGenerator.
"""

import os
import json
import time
import random
from typing import Dict, Any, Optional

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..utils.llm_utils import call_gemini_with_timeout

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = get_logger(__name__)

INFO_CARD_STYLES = ["key_insight", "comparison", "example", "history"]


class InfoCardGenerator:
    """
    Generates informational cards — bite-sized knowledge for the scroll feed.

    Styles:
    - key_insight: Core principle or rule of thumb
    - comparison: X vs Y breakdown
    - example: Concrete worked example
    - history: Brief origin/context story
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None

        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception as e:
                capture_exception(e, context={"service": "info_card_generator", "operation": "initialize_gemini"})
                log_error(logger, "initialize_gemini failed", error=str(e))

    async def generate_info_card(
        self,
        concept: Dict[str, Any],
        style: Optional[str] = None,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate an info card for a concept.

        Args:
            concept: Dict with id, name, topics, misconceptions
            style: One of INFO_CARD_STYLES, or random if None
            context: Optional notes/topic context

        Returns:
            {title, body_markdown, key_takeaway, concept, style}
        """
        if style is None:
            style = random.choice(INFO_CARD_STYLES)

        if not self.model:
            return self._fallback_info_card(concept, style)

        style_guidance = {
            "key_insight": "Explain the single most important insight about this concept. Make it memorable.",
            "comparison": "Compare this concept with a related/contrasting concept. Use a clear X vs Y structure.",
            "example": "Give a concrete, worked example that makes the concept click. Numbers, scenarios, real-world.",
            "history": "Tell the brief origin story — who discovered it, when, why it matters. Keep it interesting.",
        }.get(style, "Explain the concept clearly.")

        context_line = f"\nCONTEXT: {context[:500]}" if context else ""

        prompt = f"""You are creating a short, scannable info card for a student scrolling through a learning feed.

CONCEPT: {concept['name']}
RELATED TOPICS: {', '.join(concept.get('topics', []))}
STYLE: {style.upper()} — {style_guidance}{context_line}

Create an info card with:
- TITLE: Catchy, specific title (5-10 words)
- BODY: 100-200 words of content, designed for quick scanning. Use short paragraphs, bold key terms with **term**, and bullet points where helpful.
- KEY_TAKEAWAY: One-sentence summary — the one thing to remember

Return ONLY valid JSON:
{{
    "title": "Catchy specific title",
    "body_markdown": "Scannable content with **bold** and bullets...",
    "key_takeaway": "The one sentence takeaway"
}}"""

        try:
            response = await call_gemini_with_timeout(
                self.model, prompt,
                generation_config={"response_mime_type": "application/json"},
                context={"agent": "info_card_generator", "operation": "generate_info_card"},
            )
            if response is not None:
                result = json.loads(response.text)
                if self._validate_info_card(result):
                    result["concept"] = concept.get("id", concept.get("name", "unknown"))
                    result["style"] = style
                    return result
        except Exception as e:
            capture_exception(e, context={"service": "info_card_generator", "operation": "generate_info_card"})
            log_error(logger, "generate_info_card failed", error=str(e))

        return self._fallback_info_card(concept, style)

    def _validate_info_card(self, card: Dict) -> bool:
        """Check info card has real content."""
        title = card.get("title", "")
        body = card.get("body_markdown", "")
        takeaway = card.get("key_takeaway", "")
        if len(title) < 5 or len(body) < 50 or len(takeaway) < 10:
            return False
        if "[placeholder" in body.lower() or "[llm" in body.lower():
            return False
        return True

    def _fallback_info_card(self, concept: Dict, style: str) -> Dict[str, Any]:
        """Minimal info card when Gemini is unavailable."""
        name = concept.get("name", "Unknown Concept")
        return {
            "title": f"[LLM Required] About {name}",
            "body_markdown": f"[LLM required to generate content about {name}]",
            "key_takeaway": f"[LLM required for {name} takeaway]",
            "concept": concept.get("id", name),
            "style": style,
            "llm_required": True,
        }

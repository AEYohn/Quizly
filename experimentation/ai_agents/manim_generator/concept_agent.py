"""
Concept Agent - Analyzes educational topics for Manim animation generation.

This agent breaks down a topic into:
- Main concepts to visualize
- Prerequisites (simplified Reverse Knowledge Tree)
- Key equations in LaTeX
- Suggested visual elements
- Duration estimate
"""

import os
import json
from dataclasses import dataclass, field, asdict
from typing import List, Optional

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class ConceptBreakdown:
    """Result of concept analysis for an educational topic."""
    topic: str
    main_concepts: List[str] = field(default_factory=list)
    prerequisites: List[str] = field(default_factory=list)
    key_equations: List[str] = field(default_factory=list)  # LaTeX format
    visual_elements: List[str] = field(default_factory=list)
    suggested_duration: int = 30  # seconds
    audience_level: str = "high_school"  # elementary, middle_school, high_school, undergraduate, graduate
    summary: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "ConceptBreakdown":
        return cls(**data)


class ConceptAgent:
    """
    Agent that analyzes educational topics and breaks them down
    for Manim animation planning.
    """

    SYSTEM_PROMPT = """You are an expert educator and curriculum designer specializing in visual learning.
Your task is to analyze educational topics and break them down into components suitable for animated explanations.

When analyzing a topic:
1. Identify the CORE concepts that must be visualized (2-5 key ideas)
2. List prerequisites a viewer should understand first
3. Extract key equations in LaTeX format (use \\\\frac{}{}, \\\\sqrt{}, etc.)
4. Suggest visual elements that would help explain the concept (shapes, graphs, diagrams)
5. Estimate an appropriate duration based on complexity

Focus on creating clear, pedagogically sound breakdowns that will translate well to animations."""

    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-2.0-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None
        self.model_name = model_name

        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(model_name)
            except Exception as e:
                print(f"Failed to initialize Gemini: {e}")

    def analyze(
        self,
        topic: str,
        audience_level: str = "high_school",
        style: str = "educational"
    ) -> ConceptBreakdown:
        """
        Analyze a topic and return a structured breakdown.

        Args:
            topic: The educational topic to analyze (e.g., "Pythagorean theorem")
            audience_level: Target audience (elementary, middle_school, high_school, undergraduate, graduate)
            style: Animation style preference (educational, entertaining, technical)

        Returns:
            ConceptBreakdown with analyzed topic components
        """
        if not self.model:
            return self._fallback_breakdown(topic, audience_level)

        prompt = f"""{self.SYSTEM_PROMPT}

TOPIC: {topic}
AUDIENCE LEVEL: {audience_level}
STYLE: {style}

Analyze this topic and provide a structured breakdown for creating an educational animation.

Return ONLY valid JSON matching this structure:
{{
    "topic": "{topic}",
    "main_concepts": ["concept1", "concept2", ...],
    "prerequisites": ["prereq1", "prereq2", ...],
    "key_equations": ["latex equation 1", "latex equation 2", ...],
    "visual_elements": ["element1", "element2", ...],
    "suggested_duration": <seconds as integer>,
    "audience_level": "{audience_level}",
    "summary": "Brief 1-2 sentence summary of how to explain this visually"
}}

IMPORTANT:
- For key_equations, use proper LaTeX syntax (e.g., "a^2 + b^2 = c^2", "\\\\frac{{d}}{{dx}}")
- visual_elements should be specific Manim-friendly suggestions (e.g., "right triangle with labeled sides", "number line", "coordinate plane")
- suggested_duration should be realistic (15-120 seconds typically)
"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )

            result = json.loads(response.text)

            # Validate and create ConceptBreakdown
            return ConceptBreakdown(
                topic=result.get("topic", topic),
                main_concepts=result.get("main_concepts", []),
                prerequisites=result.get("prerequisites", []),
                key_equations=result.get("key_equations", []),
                visual_elements=result.get("visual_elements", []),
                suggested_duration=result.get("suggested_duration", 30),
                audience_level=result.get("audience_level", audience_level),
                summary=result.get("summary", "")
            )

        except Exception as e:
            print(f"Concept analysis failed: {e}")
            return self._fallback_breakdown(topic, audience_level)

    def _fallback_breakdown(self, topic: str, audience_level: str) -> ConceptBreakdown:
        """Fallback when LLM is unavailable."""
        return ConceptBreakdown(
            topic=topic,
            main_concepts=[f"Core concept of {topic}"],
            prerequisites=["Basic math understanding"],
            key_equations=[],
            visual_elements=["Title text", "Explanatory labels"],
            suggested_duration=30,
            audience_level=audience_level,
            summary=f"[LLM required] Animation explaining {topic}"
        )


if __name__ == "__main__":
    # Test the concept agent
    from dotenv import load_dotenv
    load_dotenv()

    agent = ConceptAgent()

    print("Testing Concept Agent...")
    result = agent.analyze("Pythagorean theorem", audience_level="high_school")

    print(f"\nTopic: {result.topic}")
    print(f"Main concepts: {result.main_concepts}")
    print(f"Prerequisites: {result.prerequisites}")
    print(f"Key equations: {result.key_equations}")
    print(f"Visual elements: {result.visual_elements}")
    print(f"Duration: {result.suggested_duration}s")
    print(f"Summary: {result.summary}")

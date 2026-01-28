"""
Scene Planner Agent - Plans Manim animation scenes from concept breakdowns.

This agent takes a ConceptBreakdown and creates:
- Scene-by-scene timeline
- Manim objects to use (Square, MathTex, Arrow, etc.)
- Animation types (Create, Transform, FadeIn, etc.)
- Timing for each scene
"""

import os
import json
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from .concept_agent import ConceptBreakdown


@dataclass
class AnimationScene:
    """A single scene in the animation plan."""
    scene_id: str
    title: str
    duration: float  # seconds
    description: str
    manim_objects: List[str] = field(default_factory=list)
    animations: List[str] = field(default_factory=list)
    narration: str = ""  # Optional narration text

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "AnimationScene":
        return cls(**data)


@dataclass
class ScenePlan:
    """Complete scene plan for an animation."""
    topic: str
    total_duration: float
    scenes: List[AnimationScene] = field(default_factory=list)
    manim_imports: List[str] = field(default_factory=list)
    color_scheme: Dict[str, str] = field(default_factory=dict)
    style_notes: str = ""

    def to_dict(self) -> dict:
        result = asdict(self)
        result["scenes"] = [s.to_dict() if hasattr(s, 'to_dict') else s for s in self.scenes]
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "ScenePlan":
        scenes = [AnimationScene.from_dict(s) if isinstance(s, dict) else s for s in data.get("scenes", [])]
        return cls(
            topic=data.get("topic", ""),
            total_duration=data.get("total_duration", 30),
            scenes=scenes,
            manim_imports=data.get("manim_imports", []),
            color_scheme=data.get("color_scheme", {}),
            style_notes=data.get("style_notes", "")
        )


class ScenePlanner:
    """
    Agent that plans animation scenes from concept breakdowns.
    """

    # Common Manim objects for reference
    MANIM_OBJECTS = """
Common Manim objects:
- Text, MathTex, Tex - for text and equations
- Circle, Square, Rectangle, Triangle, Polygon - basic shapes
- Line, Arrow, DoubleArrow, Vector - lines and arrows
- Dot, NumberLine, Axes, CoordinateSystem - coordinate elements
- VGroup, Group - for grouping objects
- SVGMobject, ImageMobject - for external images
- Graph, DiGraph - for graphs
- Table - for tables
"""

    MANIM_ANIMATIONS = """
Common Manim animations:
- Create, Write, DrawBorderThenFill - drawing objects
- FadeIn, FadeOut - fading
- Transform, ReplacementTransform, TransformMatchingShapes - morphing
- GrowFromCenter, GrowFromPoint, GrowArrow - growing
- Indicate, Circumscribe, Flash, ShowPassingFlash - emphasis
- Rotate, MoveToTarget, ApplyMethod - transformations
- AnimationGroup, Succession, LaggedStart - sequencing
- Wait - pausing
"""

    SYSTEM_PROMPT = f"""You are an expert Manim animator and educational content designer.
Your task is to plan scene-by-scene animations that effectively teach concepts visually.

{MANIM_OBJECTS}

{MANIM_ANIMATIONS}

When planning scenes:
1. Start with a clear introduction/title
2. Build up concepts progressively
3. Use appropriate Manim objects for each visual element
4. Choose animations that enhance understanding
5. Allow time for viewers to absorb information
6. End with a summary or key takeaway
"""

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

    def plan(
        self,
        concept: ConceptBreakdown,
        style: str = "educational"
    ) -> ScenePlan:
        """
        Create a scene plan from a concept breakdown.

        Args:
            concept: ConceptBreakdown from the Concept Agent
            style: Animation style (educational, entertaining, technical)

        Returns:
            ScenePlan with scene-by-scene breakdown
        """
        if not self.model:
            return self._fallback_plan(concept)

        prompt = f"""{self.SYSTEM_PROMPT}

TOPIC: {concept.topic}
MAIN CONCEPTS: {', '.join(concept.main_concepts)}
KEY EQUATIONS: {', '.join(concept.key_equations) if concept.key_equations else 'None'}
VISUAL ELEMENTS SUGGESTED: {', '.join(concept.visual_elements)}
TARGET DURATION: {concept.suggested_duration} seconds
AUDIENCE: {concept.audience_level}
STYLE: {style}

SUMMARY: {concept.summary}

Create a detailed scene-by-scene animation plan.

Return ONLY valid JSON matching this structure:
{{
    "topic": "{concept.topic}",
    "total_duration": {concept.suggested_duration},
    "scenes": [
        {{
            "scene_id": "scene_1",
            "title": "Introduction",
            "duration": 5.0,
            "description": "What happens in this scene",
            "manim_objects": ["Text", "..."],
            "animations": ["Write", "FadeIn", "..."],
            "narration": "Optional text that could be spoken"
        }},
        ...
    ],
    "manim_imports": ["from manim import *"],
    "color_scheme": {{
        "primary": "#3b82f6",
        "secondary": "#10b981",
        "accent": "#f59e0b",
        "background": "#1e1e1e"
    }},
    "style_notes": "Any special styling considerations"
}}

IMPORTANT:
- Create 3-8 scenes depending on complexity
- Each scene should have specific Manim objects and animations
- Durations should sum to approximately the target duration
- manim_objects should be actual Manim class names
- animations should be actual Manim animation names
"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )

            result = json.loads(response.text)

            # Parse scenes
            scenes = []
            for s in result.get("scenes", []):
                scenes.append(AnimationScene(
                    scene_id=s.get("scene_id", f"scene_{len(scenes)+1}"),
                    title=s.get("title", "Scene"),
                    duration=float(s.get("duration", 5.0)),
                    description=s.get("description", ""),
                    manim_objects=s.get("manim_objects", []),
                    animations=s.get("animations", []),
                    narration=s.get("narration", "")
                ))

            return ScenePlan(
                topic=result.get("topic", concept.topic),
                total_duration=float(result.get("total_duration", concept.suggested_duration)),
                scenes=scenes,
                manim_imports=result.get("manim_imports", ["from manim import *"]),
                color_scheme=result.get("color_scheme", {}),
                style_notes=result.get("style_notes", "")
            )

        except Exception as e:
            print(f"Scene planning failed: {e}")
            return self._fallback_plan(concept)

    def _fallback_plan(self, concept: ConceptBreakdown) -> ScenePlan:
        """Fallback when LLM is unavailable."""
        scenes = [
            AnimationScene(
                scene_id="scene_1",
                title="Introduction",
                duration=5.0,
                description=f"Display title: {concept.topic}",
                manim_objects=["Text", "VGroup"],
                animations=["Write", "FadeIn"],
                narration=f"Introduction to {concept.topic}"
            ),
            AnimationScene(
                scene_id="scene_2",
                title="Main Content",
                duration=max(15.0, concept.suggested_duration - 10),
                description="[LLM required for detailed scene planning]",
                manim_objects=concept.visual_elements or ["Text"],
                animations=["Create", "Transform"],
                narration=""
            ),
            AnimationScene(
                scene_id="scene_3",
                title="Conclusion",
                duration=5.0,
                description="Summary and fade out",
                manim_objects=["Text"],
                animations=["FadeOut"],
                narration="Summary"
            )
        ]

        return ScenePlan(
            topic=concept.topic,
            total_duration=concept.suggested_duration,
            scenes=scenes,
            manim_imports=["from manim import *"],
            color_scheme={
                "primary": "#3b82f6",
                "secondary": "#10b981",
                "background": "#1e1e1e"
            },
            style_notes="[LLM required for detailed planning]"
        )


if __name__ == "__main__":
    # Test the scene planner
    from dotenv import load_dotenv
    load_dotenv()

    from .concept_agent import ConceptAgent

    concept_agent = ConceptAgent()
    planner = ScenePlanner()

    print("Testing Scene Planner...")

    # First get concept breakdown
    concept = concept_agent.analyze("Pythagorean theorem")
    print(f"\nConcept: {concept.topic}")

    # Then plan scenes
    plan = planner.plan(concept)

    print(f"\nScene Plan:")
    print(f"Total duration: {plan.total_duration}s")
    print(f"Number of scenes: {len(plan.scenes)}")

    for scene in plan.scenes:
        print(f"\n  {scene.scene_id}: {scene.title} ({scene.duration}s)")
        print(f"    Objects: {scene.manim_objects}")
        print(f"    Animations: {scene.animations}")

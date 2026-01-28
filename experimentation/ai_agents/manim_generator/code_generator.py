"""
Code Generator Agent - Generates executable Manim Python code.

This agent takes a ScenePlan and generates:
- Complete Python file with Scene class
- Proper imports and configuration
- Animation code following the scene plan
"""

import os
import json
import re
from dataclasses import dataclass, field, asdict
from typing import List, Optional

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from .scene_planner import ScenePlan, AnimationScene


@dataclass
class ManimCode:
    """Generated Manim code with metadata."""
    code: str
    class_name: str
    imports: List[str] = field(default_factory=list)
    is_valid: bool = False
    errors: List[str] = field(default_factory=list)
    scene_plan: Optional[ScenePlan] = None

    def to_dict(self) -> dict:
        result = asdict(self)
        if self.scene_plan:
            result["scene_plan"] = self.scene_plan.to_dict()
        return result


# Few-shot examples for better code generation
MANIM_EXAMPLES = '''
# Example 1: Simple text animation
from manim import *

class SimpleText(Scene):
    def construct(self):
        title = Text("Hello, Manim!", font_size=72)
        self.play(Write(title))
        self.wait(1)
        self.play(FadeOut(title))

# Example 2: Pythagorean theorem visualization
from manim import *

class PythagoreanTheorem(Scene):
    def construct(self):
        # Create right triangle
        triangle = Polygon(
            ORIGIN, RIGHT * 3, RIGHT * 3 + UP * 4,
            color=WHITE, fill_opacity=0.3
        )

        # Labels for sides using MathTex
        a_label = MathTex("a").next_to(triangle, DOWN)
        b_label = MathTex("b").next_to(triangle, RIGHT)
        c_label = MathTex("c").move_to(triangle.get_center() + LEFT * 0.5 + UP * 0.5)

        # Show triangle
        self.play(Create(triangle))
        self.play(Write(a_label), Write(b_label), Write(c_label))
        self.wait(1)

        # Show equation
        equation = MathTex("a^2", "+", "b^2", "=", "c^2")
        equation.to_edge(UP)
        self.play(Write(equation))
        self.wait(2)

# Example 3: Circle area derivation
from manim import *

class CircleArea(Scene):
    def construct(self):
        # Title
        title = Text("Area of a Circle", font_size=48)
        self.play(Write(title))
        self.wait(0.5)
        self.play(title.animate.to_edge(UP))

        # Create circle
        circle = Circle(radius=2, color=BLUE, fill_opacity=0.5)
        radius_line = Line(ORIGIN, RIGHT * 2, color=YELLOW)
        r_label = MathTex("r").next_to(radius_line, UP, buff=0.1)

        self.play(Create(circle))
        self.play(Create(radius_line), Write(r_label))
        self.wait(1)

        # Show formula with MathTex
        formula = MathTex("A", "=", r"\\pi", "r^2")
        formula.next_to(circle, DOWN, buff=1)

        self.play(Write(formula))
        self.wait(2)

# Example 4: Function graphing
from manim import *

class GraphFunction(Scene):
    def construct(self):
        # Create axes
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[-1, 5, 1],
            axis_config={"include_numbers": True}
        )

        # Create graph
        graph = axes.plot(lambda x: x**2, color=BLUE)
        graph_label = MathTex("f(x) = x^2").next_to(axes, UP)

        self.play(Create(axes))
        self.play(Create(graph), Write(graph_label))
        self.wait(2)

# Example 5: Quadratic formula
from manim import *

class QuadraticFormula(Scene):
    def construct(self):
        # Show the quadratic formula step by step
        title = Text("Quadratic Formula", font_size=48)
        self.play(Write(title))
        self.play(title.animate.to_edge(UP))

        equation = MathTex("ax^2 + bx + c = 0")
        self.play(Write(equation))
        self.wait(1)

        formula = MathTex(r"x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}")
        formula.next_to(equation, DOWN, buff=1)
        self.play(Write(formula))
        self.wait(2)
'''


class CodeGenerator:
    """
    Agent that generates executable Manim code from scene plans.
    """

    SYSTEM_PROMPT = f"""You are an expert Manim programmer. Your task is to generate clean, working Manim code
that implements the given scene plan.

Here are example Manim animations for reference:

{MANIM_EXAMPLES}

IMPORTANT CODING GUIDELINES:
1. Always start with 'from manim import *'
2. Create a single Scene class with construct(self) method
3. Use self.play() for animations, self.wait() for pauses
4. Position objects using .to_edge(), .next_to(), .move_to()
5. Use MathTex() for mathematical equations with LaTeX syntax
   - Use double backslashes: MathTex(r"\\frac{{a}}{{b}}", r"\\pi", r"\\sqrt{{x}}")
   - Use raw strings (r"...") for LaTeX
6. Use Text() for regular text labels and titles
7. Group related objects with VGroup when needed
8. Use appropriate colors from Manim (BLUE, RED, GREEN, YELLOW, WHITE, etc.)
9. Keep animations smooth with appropriate run_time parameters
10. The class name should be descriptive (e.g., PythagoreanTheorem, not Scene1)
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

    def generate(self, scene_plan: ScenePlan) -> ManimCode:
        """
        Generate Manim code from a scene plan.

        Args:
            scene_plan: ScenePlan from the Scene Planner

        Returns:
            ManimCode with generated Python code
        """
        if not self.model:
            return self._fallback_code(scene_plan)

        # Build scene descriptions for the prompt
        scene_descriptions = []
        for scene in scene_plan.scenes:
            scene_descriptions.append(f"""
Scene {scene.scene_id}: {scene.title} ({scene.duration}s)
  Description: {scene.description}
  Objects: {', '.join(scene.manim_objects)}
  Animations: {', '.join(scene.animations)}
  Narration: {scene.narration}
""")

        prompt = f"""{self.SYSTEM_PROMPT}

Generate Manim code for the following animation:

TOPIC: {scene_plan.topic}
TOTAL DURATION: {scene_plan.total_duration} seconds
COLOR SCHEME: {json.dumps(scene_plan.color_scheme)}
STYLE NOTES: {scene_plan.style_notes}

SCENE BREAKDOWN:
{''.join(scene_descriptions)}

Generate COMPLETE, WORKING Manim Python code.
Return ONLY the Python code, no explanations. Start with imports.
Make sure:
1. The code is syntactically correct Python
2. All Manim imports are included
3. The class name is descriptive (CamelCase, based on the topic)
4. All scenes from the plan are implemented
5. Timing roughly matches the scene durations
6. Use proper LaTeX escaping in MathTex (double backslashes)
"""

        try:
            response = self.model.generate_content(prompt)

            # Extract code from response
            code = self._extract_code(response.text)

            # Determine class name from code
            class_name = self._extract_class_name(code)

            # Validate the code
            is_valid, errors = self._validate_code(code)

            return ManimCode(
                code=code,
                class_name=class_name,
                imports=scene_plan.manim_imports,
                is_valid=is_valid,
                errors=errors,
                scene_plan=scene_plan
            )

        except Exception as e:
            print(f"Code generation failed: {e}")
            return self._fallback_code(scene_plan)

    def _extract_code(self, text: str) -> str:
        """Extract Python code from LLM response."""
        # Try to find code block
        code_match = re.search(r'```python\s*(.*?)```', text, re.DOTALL)
        if code_match:
            return code_match.group(1).strip()

        code_match = re.search(r'```\s*(.*?)```', text, re.DOTALL)
        if code_match:
            return code_match.group(1).strip()

        # If no code block, assume the whole response is code
        # Remove any non-code lines at the start
        lines = text.strip().split('\n')
        code_lines = []
        in_code = False

        for line in lines:
            if line.startswith('from manim') or line.startswith('import') or in_code:
                in_code = True
                code_lines.append(line)
            elif line.strip().startswith('class ') and 'Scene' in line:
                in_code = True
                code_lines.append(line)

        return '\n'.join(code_lines) if code_lines else text

    def _extract_class_name(self, code: str) -> str:
        """Extract the Scene class name from code."""
        match = re.search(r'class\s+(\w+)\s*\([^)]*Scene[^)]*\)', code)
        if match:
            return match.group(1)
        return "GeneratedScene"

    def _validate_code(self, code: str) -> tuple:
        """Basic validation of generated code."""
        errors = []

        # Check for required elements
        if 'from manim import' not in code and 'import manim' not in code:
            errors.append("Missing manim import")

        if 'class ' not in code or 'Scene' not in code:
            errors.append("Missing Scene class definition")

        if 'def construct' not in code:
            errors.append("Missing construct method")

        if 'self.play' not in code and 'self.wait' not in code:
            errors.append("No animations found (no self.play or self.wait)")

        # Try to compile the code
        try:
            compile(code, '<string>', 'exec')
        except SyntaxError as e:
            errors.append(f"Syntax error: {e}")

        return len(errors) == 0, errors

    def _fallback_code(self, scene_plan: ScenePlan) -> ManimCode:
        """Fallback code when LLM is unavailable."""
        class_name = self._sanitize_class_name(scene_plan.topic)

        code = f'''from manim import *

class {class_name}(Scene):
    """
    [LLM Required for full implementation]
    Topic: {scene_plan.topic}
    Duration: {scene_plan.total_duration}s
    """
    def construct(self):
        # Title
        title = Text("{scene_plan.topic}", font_size=48)
        self.play(Write(title))
        self.wait(1)
        self.play(title.animate.to_edge(UP))

        # Placeholder for content
        placeholder = Text("[LLM required for animation content]", font_size=24)
        self.play(FadeIn(placeholder))
        self.wait(2)

        # End
        self.play(FadeOut(placeholder), FadeOut(title))
'''

        return ManimCode(
            code=code,
            class_name=class_name,
            imports=["from manim import *"],
            is_valid=True,
            errors=["LLM unavailable - generated placeholder code"],
            scene_plan=scene_plan
        )

    def _sanitize_class_name(self, topic: str) -> str:
        """Convert topic to valid Python class name."""
        # Remove non-alphanumeric characters and convert to CamelCase
        words = re.sub(r'[^a-zA-Z0-9\s]', '', topic).split()
        return ''.join(word.capitalize() for word in words) or "GeneratedScene"


if __name__ == "__main__":
    # Test the code generator
    from dotenv import load_dotenv
    load_dotenv()

    from .concept_agent import ConceptAgent
    from .scene_planner import ScenePlanner

    concept_agent = ConceptAgent()
    planner = ScenePlanner()
    generator = CodeGenerator()

    print("Testing Code Generator...")

    # Get concept breakdown
    concept = concept_agent.analyze("Pythagorean theorem")

    # Plan scenes
    plan = planner.plan(concept)

    # Generate code
    result = generator.generate(plan)

    print(f"\nGenerated code for: {result.class_name}")
    print(f"Valid: {result.is_valid}")
    if result.errors:
        print(f"Errors: {result.errors}")
    print(f"\n{'-'*50}")
    print(result.code)

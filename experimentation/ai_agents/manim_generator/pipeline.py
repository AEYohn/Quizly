"""
Manim Pipeline - Orchestrates the 3-agent Manim animation generator.

Pipeline flow:
1. Concept Agent - Analyzes topic
2. Scene Planner - Plans animation scenes
3. Code Generator - Generates Manim code

Optional: Renders the animation using Manim CLI
"""

import os
import subprocess
import time
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, List

from .concept_agent import ConceptAgent, ConceptBreakdown
from .scene_planner import ScenePlanner, ScenePlan
from .code_generator import CodeGenerator, ManimCode
from .validator import ManimValidator, ValidationResult


@dataclass
class PipelineResult:
    """Complete result from the Manim generation pipeline."""
    topic: str
    concept: Optional[ConceptBreakdown] = None
    scene_plan: Optional[ScenePlan] = None
    code: Optional[ManimCode] = None
    validation: Optional[ValidationResult] = None
    output_path: Optional[str] = None
    video_path: Optional[str] = None
    success: bool = False
    errors: List[str] = field(default_factory=list)
    timing: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "topic": self.topic,
            "concept": self.concept.to_dict() if self.concept else None,
            "scene_plan": self.scene_plan.to_dict() if self.scene_plan else None,
            "code": self.code.to_dict() if self.code else None,
            "validation": asdict(self.validation) if self.validation else None,
            "output_path": self.output_path,
            "video_path": self.video_path,
            "success": self.success,
            "errors": self.errors,
            "timing": self.timing
        }


class ManimPipeline:
    """
    Orchestrates the 3-agent Manim generation pipeline.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        output_dir: Optional[str] = None,
        model_name: str = "gemini-2.0-flash"
    ):
        """
        Initialize the pipeline.

        Args:
            api_key: Gemini API key (defaults to GEMINI_API_KEY env var)
            output_dir: Directory for generated files (defaults to experiments/manim_outputs/)
            model_name: Gemini model to use
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")

        # Set up output directory
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            self.output_dir = Path(__file__).parent.parent.parent / "experiments" / "manim_outputs"

        self.code_dir = self.output_dir / "generated_code"
        self.video_dir = self.output_dir / "rendered_videos"

        # Create directories
        self.code_dir.mkdir(parents=True, exist_ok=True)
        self.video_dir.mkdir(parents=True, exist_ok=True)

        # Initialize agents
        self.concept_agent = ConceptAgent(api_key=self.api_key, model_name=model_name)
        self.scene_planner = ScenePlanner(api_key=self.api_key, model_name=model_name)
        self.code_generator = CodeGenerator(api_key=self.api_key, model_name=model_name)
        self.validator = ManimValidator()

    def generate(
        self,
        topic: str,
        audience_level: str = "high_school",
        style: str = "educational",
        render: bool = False,
        render_quality: str = "low"
    ) -> PipelineResult:
        """
        Run the full pipeline to generate Manim code.

        Args:
            topic: Educational topic to animate (e.g., "Pythagorean theorem")
            audience_level: Target audience (elementary, middle_school, high_school, undergraduate, graduate)
            style: Animation style (educational, entertaining, technical)
            render: Whether to render the video (requires manim installed)
            render_quality: Rendering quality (low, medium, high)

        Returns:
            PipelineResult with all generated artifacts
        """
        result = PipelineResult(topic=topic)
        timing = {}

        try:
            # Step 1: Concept Analysis
            print(f"[1/3] Analyzing concept: {topic}")
            start = time.time()
            concept = self.concept_agent.analyze(topic, audience_level, style)
            timing["concept_analysis"] = time.time() - start
            result.concept = concept
            print(f"      -> Found {len(concept.main_concepts)} main concepts, {len(concept.key_equations)} equations")

            # Step 2: Scene Planning
            print(f"[2/3] Planning scenes...")
            start = time.time()
            scene_plan = self.scene_planner.plan(concept, style)
            timing["scene_planning"] = time.time() - start
            result.scene_plan = scene_plan
            print(f"      -> Created {len(scene_plan.scenes)} scenes, {scene_plan.total_duration}s duration")

            # Step 3: Code Generation
            print(f"[3/3] Generating Manim code...")
            start = time.time()
            code = self.code_generator.generate(scene_plan)
            timing["code_generation"] = time.time() - start
            result.code = code
            print(f"      -> Generated {code.class_name} ({len(code.code)} chars)")

            # Validate
            validation = self.validator.validate(code.code)
            result.validation = validation

            if not validation.is_valid:
                result.errors.extend(validation.errors)
                print(f"      -> Validation errors: {validation.errors}")
            else:
                print(f"      -> Code validated successfully")

            # Save code to file
            output_path = self._save_code(code, topic)
            result.output_path = str(output_path)
            print(f"      -> Saved to: {output_path}")

            # Optional: Render
            if render and validation.is_valid:
                print(f"[+] Rendering video ({render_quality} quality)...")
                start = time.time()
                video_path = self._render_video(output_path, code.class_name, render_quality)
                timing["rendering"] = time.time() - start
                if video_path:
                    result.video_path = str(video_path)
                    print(f"      -> Video: {video_path}")
                else:
                    result.errors.append("Rendering failed")
                    print(f"      -> Rendering failed")

            result.success = validation.is_valid and len(result.errors) == 0
            result.timing = timing

        except Exception as e:
            result.errors.append(f"Pipeline error: {str(e)}")
            result.success = False
            import traceback
            traceback.print_exc()

        return result

    def _save_code(self, code: ManimCode, topic: str) -> Path:
        """Save generated code to a file."""
        # Create filename from topic
        filename = self._sanitize_filename(topic) + ".py"
        filepath = self.code_dir / filename

        # Handle duplicates
        counter = 1
        while filepath.exists():
            filename = f"{self._sanitize_filename(topic)}_{counter}.py"
            filepath = self.code_dir / filename
            counter += 1

        with open(filepath, 'w') as f:
            f.write(code.code)

        return filepath

    def _sanitize_filename(self, topic: str) -> str:
        """Convert topic to valid filename."""
        import re
        # Remove special characters, convert spaces to underscores
        filename = re.sub(r'[^a-zA-Z0-9\s]', '', topic)
        filename = filename.strip().replace(' ', '_').lower()
        return filename or "animation"

    def _render_video(
        self,
        code_path: Path,
        class_name: str,
        quality: str = "low"
    ) -> Optional[Path]:
        """
        Render the Manim animation to video.

        Args:
            code_path: Path to the Python file
            class_name: Name of the Scene class
            quality: Rendering quality (low, medium, high)

        Returns:
            Path to rendered video or None if failed
        """
        # Quality flags
        quality_flags = {
            "low": "-pql",      # preview quality low
            "medium": "-pqm",   # preview quality medium
            "high": "-pqh"      # preview quality high
        }

        flag = quality_flags.get(quality, "-pql")

        # Build command
        cmd = [
            "manim",
            flag,
            str(code_path),
            class_name,
            "-o", str(self.video_dir)
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            if result.returncode == 0:
                # Find the output video
                video_files = list(self.video_dir.glob(f"**/{class_name}*.mp4"))
                if video_files:
                    return video_files[-1]  # Return most recent

            print(f"Manim stderr: {result.stderr}")
            return None

        except subprocess.TimeoutExpired:
            print("Rendering timed out")
            return None
        except FileNotFoundError:
            print("Manim not found. Install with: pip install manim")
            return None
        except Exception as e:
            print(f"Rendering error: {e}")
            return None

    def regenerate_code(self, result: PipelineResult) -> ManimCode:
        """
        Regenerate only the code from an existing scene plan.

        Useful if code generation failed but concept/scene planning succeeded.
        """
        if not result.scene_plan:
            raise ValueError("No scene plan available to regenerate from")

        code = self.code_generator.generate(result.scene_plan)
        return code


# Convenience function
def generate_animation(
    topic: str,
    audience_level: str = "high_school",
    render: bool = False
) -> PipelineResult:
    """
    Quick function to generate a Manim animation.

    Args:
        topic: Topic to animate
        audience_level: Target audience level
        render: Whether to render video

    Returns:
        PipelineResult with generated code
    """
    pipeline = ManimPipeline()
    return pipeline.generate(topic, audience_level, render=render)


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    print("Testing Manim Pipeline...")
    print("=" * 50)

    pipeline = ManimPipeline()

    # Test with Pythagorean theorem
    result = pipeline.generate(
        "Pythagorean theorem",
        audience_level="high_school",
        style="educational",
        render=False
    )

    print("\n" + "=" * 50)
    print("PIPELINE RESULT")
    print("=" * 50)
    print(f"Success: {result.success}")
    print(f"Errors: {result.errors}")
    print(f"Timing: {result.timing}")
    print(f"Output: {result.output_path}")

    if result.code:
        print(f"\nGenerated Code ({result.code.class_name}):")
        print("-" * 50)
        print(result.code.code[:500] + "..." if len(result.code.code) > 500 else result.code.code)

"""
Manim Animation Generator - Gradio Interface

A visual interface for generating educational Manim animations from natural language descriptions.

Features:
- Topic input with audience level selection
- Step-by-step pipeline visualization
- Syntax-highlighted code output
- Video rendering and playback
- Example topics for quick testing
"""

import os
import sys
import json
import time
import subprocess
import tempfile
from pathlib import Path
import gradio as gr

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from ai_agents.manim_generator import (
    ManimPipeline,
    ConceptAgent,
    ScenePlanner,
    CodeGenerator,
    ManimValidator
)


# Example topics for quick testing
EXAMPLE_TOPICS = [
    "Pythagorean theorem",
    "Area of a circle",
    "Quadratic formula derivation",
    "Simple harmonic motion",
    "Newton's laws of motion",
    "Binary search algorithm",
    "Fourier transform basics",
    "DNA replication process",
]

# Global pipeline instance
pipeline = None


def get_pipeline():
    """Get or create pipeline instance."""
    global pipeline
    if pipeline is None:
        pipeline = ManimPipeline()
    return pipeline


def check_manim_installed():
    """Check if manim is installed and available."""
    try:
        result = subprocess.run(
            ["manim", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def render_manim_video(code: str, class_name: str, quality: str = "low") -> tuple:
    """
    Render Manim code to video.

    Returns:
        tuple: (video_path or None, error_message or None)
    """
    quality_flags = {
        "low": "-pql",
        "medium": "-pqm",
        "high": "-pqh"
    }
    flag = quality_flags.get(quality, "-pql")

    # Create temp directory for output
    output_dir = Path(tempfile.mkdtemp(prefix="manim_"))
    code_file = output_dir / "animation.py"

    # Write code to temp file
    with open(code_file, 'w') as f:
        f.write(code)

    try:
        # Run manim
        cmd = [
            "manim",
            flag,
            str(code_file),
            class_name,
            "--media_dir", str(output_dir / "media")
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            cwd=str(output_dir)
        )

        # First check if video was created (success indicator)
        video_files = list((output_dir / "media" / "videos").rglob("*.mp4"))
        if video_files:
            return str(video_files[0]), None

        # No video - extract actual error from output
        # Filter out progress bars and info lines
        def extract_error(output):
            if not output:
                return None
            lines = output.split('\n')
            error_lines = []
            for line in lines:
                # Skip progress bars and info lines
                if any(skip in line for skip in ['Animation', 'it/s]', 'INFO', '%|', 'Partial movie']):
                    continue
                # Look for actual errors
                if any(err in line.lower() for err in ['error', 'exception', 'traceback', 'failed', 'not found']):
                    error_lines.append(line.strip())
            return '\n'.join(error_lines) if error_lines else None

        error_msg = extract_error(result.stderr) or extract_error(result.stdout)
        if error_msg:
            return None, f"Manim error:\n{error_msg[:800]}"

        # Generic failure
        if result.returncode != 0:
            return None, f"Manim failed with code {result.returncode}"

        return None, "No video file generated"

    except subprocess.TimeoutExpired:
        return None, "Rendering timed out (5 min limit)"
    except Exception as e:
        return None, f"Render error: {str(e)}"


def format_concept_breakdown(concept):
    """Format concept breakdown as markdown."""
    if concept is None:
        return "No concept analysis available"

    md = f"""### Concept Analysis: {concept.topic}

**Audience Level:** {concept.audience_level}
**Suggested Duration:** {concept.suggested_duration} seconds

#### Main Concepts
{chr(10).join(f'- {c}' for c in concept.main_concepts)}

#### Prerequisites
{chr(10).join(f'- {p}' for p in concept.prerequisites) if concept.prerequisites else '- None identified'}

#### Key Equations
{chr(10).join(f'- `{eq}`' for eq in concept.key_equations) if concept.key_equations else '- None'}

#### Visual Elements
{chr(10).join(f'- {v}' for v in concept.visual_elements)}

#### Summary
{concept.summary}
"""
    return md


def format_scene_plan(plan):
    """Format scene plan as markdown."""
    if plan is None:
        return "No scene plan available"

    scenes_md = ""
    for i, scene in enumerate(plan.scenes, 1):
        scenes_md += f"""
**Scene {i}: {scene.title}** ({scene.duration}s)
- Description: {scene.description}
- Objects: {', '.join(scene.manim_objects[:5])}{'...' if len(scene.manim_objects) > 5 else ''}
- Animations: {', '.join(scene.animations[:5])}{'...' if len(scene.animations) > 5 else ''}
"""

    md = f"""### Scene Plan: {plan.topic}

**Total Duration:** {plan.total_duration} seconds
**Number of Scenes:** {len(plan.scenes)}

#### Color Scheme
```json
{json.dumps(plan.color_scheme, indent=2)}
```

#### Scenes
{scenes_md}

#### Style Notes
{plan.style_notes}
"""
    return md


def format_validation(validation):
    """Format validation result as markdown."""
    if validation is None:
        return "No validation performed"

    status = "VALID" if validation.is_valid else "INVALID"

    errors_md = '\n'.join(f'- {e}' for e in validation.errors) if validation.errors else '- None'
    warnings_md = '\n'.join(f'- {w}' for w in validation.warnings) if validation.warnings else '- None'
    suggestions_md = '\n'.join(f'- {s}' for s in validation.suggestions) if validation.suggestions else '- None'

    md = f"""### Validation Result: **{status}**

#### Checks
- Syntax: {'PASS' if validation.syntax_valid else 'FAIL'}
- Structure: {'PASS' if validation.structure_valid else 'FAIL'}
- Imports: {'PASS' if validation.imports_valid else 'FAIL'}

#### Errors
{errors_md}

#### Warnings
{warnings_md}

#### Suggestions
{suggestions_md}
"""
    return md


def generate_animation(topic, audience_level, style, show_steps, render_video, render_quality):
    """Generate animation with optional step-by-step display and video rendering."""
    if not topic.strip():
        yield (
            "Please enter a topic",
            "",
            "",
            "",
            "",
            "",
            None  # video output
        )
        return

    p = get_pipeline()

    # Initialize outputs
    status = f"Generating animation for: {topic}..."
    concept_md = "Analyzing concept..."
    scene_md = "Waiting..."
    code_output = "Waiting..."
    validation_md = "Waiting..."
    timing_md = ""
    video_output = None

    if show_steps:
        yield (status, concept_md, scene_md, code_output, validation_md, timing_md, video_output)

    # Step 1: Concept Analysis
    start = time.time()
    concept = p.concept_agent.analyze(topic, audience_level, style)
    concept_time = time.time() - start

    concept_md = format_concept_breakdown(concept)
    status = "Concept analyzed. Planning scenes..."

    if show_steps:
        yield (status, concept_md, scene_md, code_output, validation_md, timing_md, video_output)

    # Step 2: Scene Planning
    start = time.time()
    scene_plan = p.scene_planner.plan(concept, style)
    scene_time = time.time() - start

    scene_md = format_scene_plan(scene_plan)
    status = "Scenes planned. Generating code..."

    if show_steps:
        yield (status, concept_md, scene_md, code_output, validation_md, timing_md, video_output)

    # Step 3: Code Generation
    start = time.time()
    code = p.code_generator.generate(scene_plan)
    code_time = time.time() - start

    code_output = code.code
    status = "Code generated. Validating..."

    if show_steps:
        yield (status, concept_md, scene_md, code_output, validation_md, timing_md, video_output)

    # Step 4: Validation
    validation = p.validator.validate(code.code)
    validation_md = format_validation(validation)

    # Save the code
    output_path = p._save_code(code, topic)

    # Step 5: Optional Video Rendering
    render_time = 0
    render_status = ""

    if render_video and validation.is_valid:
        if not check_manim_installed():
            render_status = "\n\n**Rendering skipped:** Manim not installed. Run `pip install manim` to enable."
        else:
            status = "Rendering video... (this may take a minute)"
            if show_steps:
                yield (status, concept_md, scene_md, code_output, validation_md, timing_md, video_output)

            start = time.time()
            video_path, error = render_manim_video(code.code, code.class_name, render_quality)
            render_time = time.time() - start

            if video_path:
                video_output = video_path
                render_status = f"\n\n**Video rendered** in {render_time:.1f}s"
            else:
                render_status = f"\n\n**Rendering failed:** {error}"

    # Final status and timing
    total_time = concept_time + scene_time + code_time + render_time
    timing_md = f"""### Generation Complete

**Output File:** `{output_path}`

| Step | Time |
|------|------|
| Concept Analysis | {concept_time:.2f}s |
| Scene Planning | {scene_time:.2f}s |
| Code Generation | {code_time:.2f}s |
{"| Video Rendering | " + f"{render_time:.2f}s |" if render_time > 0 else ""}
| **Total** | **{total_time:.2f}s** |
{render_status}

#### Manual Render Command
```bash
cd {output_path.parent}
manim -pql {output_path.name} {code.class_name}
```
"""

    if validation.is_valid:
        if video_output:
            status = f"Animation generated and rendered in {total_time:.1f}s"
        else:
            status = f"Animation generated successfully in {total_time:.1f}s"
    else:
        status = f"Animation generated with validation errors in {total_time:.1f}s"

    yield (status, concept_md, scene_md, code_output, validation_md, timing_md, video_output)


def render_existing_code(code, class_name, quality):
    """Render existing code from the code editor."""
    if not code.strip():
        return None, "No code to render"

    if not check_manim_installed():
        return None, "Manim not installed. Run `pip install manim`"

    # Extract class name if not provided
    if not class_name.strip():
        import re
        match = re.search(r'class\s+(\w+)\s*\([^)]*Scene[^)]*\)', code)
        if match:
            class_name = match.group(1)
        else:
            return None, "Could not find Scene class name"

    video_path, error = render_manim_video(code, class_name, quality)

    if video_path:
        return video_path, f"Rendered successfully: {class_name}"
    else:
        return None, error


def load_example(example_name):
    """Load an example topic."""
    return example_name


# Build Gradio Interface
def create_app():
    manim_available = check_manim_installed()

    with gr.Blocks(
        title="Manim Animation Generator",
        theme=gr.themes.Soft(),
        css="""
        .code-output textarea {
            font-family: 'Fira Code', 'Monaco', monospace !important;
            font-size: 12px !important;
        }
        """
    ) as app:
        gr.Markdown("""
        # Manim Animation Generator

        Generate educational Manim animations from natural language descriptions using Gemini AI.

        **Pipeline:** Topic Analysis → Scene Planning → Code Generation → Video Rendering
        """)

        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("### Input")

                topic = gr.Textbox(
                    label="Topic",
                    placeholder="e.g., Pythagorean theorem, quadratic formula, binary search...",
                    lines=2
                )

                with gr.Row():
                    audience = gr.Dropdown(
                        choices=["elementary", "middle_school", "high_school", "undergraduate", "graduate"],
                        value="high_school",
                        label="Audience Level"
                    )
                    style = gr.Dropdown(
                        choices=["educational", "entertaining", "technical"],
                        value="educational",
                        label="Style"
                    )

                show_steps = gr.Checkbox(
                    value=True,
                    label="Show step-by-step progress"
                )

                with gr.Row():
                    render_video = gr.Checkbox(
                        value=manim_available,
                        label="Render Video",
                        interactive=True
                    )
                    render_quality = gr.Dropdown(
                        choices=["low", "medium", "high"],
                        value="low",
                        label="Quality",
                        scale=1
                    )

                generate_btn = gr.Button("Generate Animation", variant="primary")

                if not manim_available:
                    gr.Markdown("*Manim not installed. Install with `pip install manim` for video rendering.*")

                gr.Markdown("### Examples")
                with gr.Row():
                    for ex in EXAMPLE_TOPICS[:4]:
                        btn = gr.Button(ex, size="sm")
                        btn.click(load_example, inputs=[gr.State(ex)], outputs=[topic])
                with gr.Row():
                    for ex in EXAMPLE_TOPICS[4:]:
                        btn = gr.Button(ex, size="sm")
                        btn.click(load_example, inputs=[gr.State(ex)], outputs=[topic])

                status_output = gr.Textbox(
                    label="Status",
                    interactive=False,
                    lines=2
                )

            with gr.Column(scale=2):
                with gr.Tabs():
                    with gr.TabItem("Video"):
                        video_output = gr.Video(
                            label="Rendered Animation",
                            autoplay=True,
                            height=400
                        )
                        with gr.Row():
                            class_name_input = gr.Textbox(
                                label="Class Name (auto-detected)",
                                placeholder="e.g., PythagoreanTheorem",
                                scale=2
                            )
                            render_btn = gr.Button("Re-render Code", scale=1)
                        render_status = gr.Textbox(label="Render Status", interactive=False)

                    with gr.TabItem("Generated Code"):
                        code_output = gr.Code(
                            label="Manim Python Code",
                            language="python",
                            lines=25,
                            interactive=True
                        )
                        timing_output = gr.Markdown(label="Output Info")

                    with gr.TabItem("Concept Analysis"):
                        concept_output = gr.Markdown()

                    with gr.TabItem("Scene Plan"):
                        scene_output = gr.Markdown()

                    with gr.TabItem("Validation"):
                        validation_output = gr.Markdown()

        # Event handlers
        generate_btn.click(
            generate_animation,
            inputs=[topic, audience, style, show_steps, render_video, render_quality],
            outputs=[status_output, concept_output, scene_output, code_output, validation_output, timing_output, video_output]
        )

        # Allow Enter key to generate
        topic.submit(
            generate_animation,
            inputs=[topic, audience, style, show_steps, render_video, render_quality],
            outputs=[status_output, concept_output, scene_output, code_output, validation_output, timing_output, video_output]
        )

        # Re-render button for editing code
        render_btn.click(
            render_existing_code,
            inputs=[code_output, class_name_input, render_quality],
            outputs=[video_output, render_status]
        )

        gr.Markdown("""
        ---
        ### Tips
        - Be specific with your topic (e.g., "Pythagorean theorem proof using squares" instead of just "geometry")
        - Use **low** quality for quick previews, **high** for final renders
        - You can edit the generated code and click "Re-render Code" to see changes
        - The generated code may need minor adjustments for complex animations

        ### Requirements
        - **Gemini API key** in `.env` file or `GEMINI_API_KEY` environment variable
        - **Manim** (for rendering): `pip install manim`
        - **FFmpeg** (for video output): `brew install ffmpeg`
        """)

    return app


if __name__ == "__main__":
    print("Starting Manim Animation Generator...")
    print("Visit: http://localhost:7864")

    if check_manim_installed():
        print("Manim: INSTALLED (video rendering enabled)")
    else:
        print("Manim: NOT INSTALLED (code generation only)")
        print("  Install with: pip install manim")

    app = create_app()
    app.launch(server_port=7864, share=False)

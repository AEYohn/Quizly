"""
Question Quality Inspector
Review and rate AI-generated questions for quality.
"""

import gradio as gr
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_agents.question_designer import QuestionDesigner


def generate_question(concept: str, difficulty: float, question_type: str):
    """Generate a question using the AI agent."""
    designer = QuestionDesigner()
    question = designer.design_question(
        concept=concept,
        difficulty=difficulty,
        question_type=question_type
    )
    
    # Format for display
    prompt = question.get("prompt", "Error generating question")
    options = question.get("options", [])
    correct = question.get("correct_answer", "")
    explanation = question.get("explanation", "")
    
    options_text = "\n".join([f"  {chr(65+i)}. {opt}" for i, opt in enumerate(options)])
    
    formatted = f"""## Question

{prompt}

### Options
{options_text}

### Correct Answer
{correct}

### Explanation
{explanation}
"""
    return formatted, question


def submit_rating(question_json, clarity: int, depth: int, distractors: int, notes: str):
    """Save rating for a generated question."""
    # In production, save to database
    avg_score = (clarity + depth + distractors) / 3
    
    return f"""## Rating Submitted ✅

| Criterion | Score |
|-----------|-------|
| Clarity | {clarity}/5 |
| Conceptual Depth | {depth}/5 |
| Distractor Quality | {distractors}/5 |
| **Average** | **{avg_score:.1f}/5** |

**Notes:** {notes if notes else 'None'}
"""


# Gradio Interface
with gr.Blocks(title="Question Quality Inspector") as demo:
    gr.Markdown("# 🔍 Question Quality Inspector")
    gr.Markdown("Generate and evaluate AI-created questions for quality assurance.")
    
    question_state = gr.State({})
    
    with gr.Row():
        with gr.Column():
            concept = gr.Textbox(label="Concept", placeholder="e.g., Conservation of momentum")
            difficulty = gr.Slider(0.1, 1.0, 0.5, step=0.1, label="Difficulty (0.1=easy, 1.0=hard)")
            q_type = gr.Dropdown(
                ["mcq", "short_answer"],
                value="mcq",
                label="Question Type"
            )
            generate_btn = gr.Button("🎲 Generate Question", variant="primary")
        
        with gr.Column():
            question_display = gr.Markdown(label="Generated Question")
    
    gr.Markdown("---")
    gr.Markdown("## Rate This Question")
    
    with gr.Row():
        clarity = gr.Slider(1, 5, 3, step=1, label="Clarity")
        depth = gr.Slider(1, 5, 3, step=1, label="Conceptual Depth")
        distractors = gr.Slider(1, 5, 3, step=1, label="Distractor Quality")
    
    notes = gr.Textbox(label="Notes (optional)", placeholder="Any feedback on this question...")
    submit_btn = gr.Button("📝 Submit Rating")
    rating_result = gr.Markdown()
    
    generate_btn.click(
        fn=generate_question,
        inputs=[concept, difficulty, q_type],
        outputs=[question_display, question_state]
    )
    
    submit_btn.click(
        fn=submit_rating,
        inputs=[question_state, clarity, depth, distractors, notes],
        outputs=[rating_result]
    )


if __name__ == "__main__":
    demo.launch(server_port=7862)

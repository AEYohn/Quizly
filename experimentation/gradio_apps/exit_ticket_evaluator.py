"""
Exit-Ticket Evaluator
Evaluate personalized exit tickets generated for students.
"""

import gradio as gr
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_agents.exit_ticket_agent import ExitTicketAgent


SAMPLE_HISTORIES = {
    "struggling_student": {
        "name": "Alex",
        "mastery": {"Concept A": 0.3, "Concept B": 0.4, "Concept C": 0.7},
        "recent_responses": [
            {"concept": "Concept A", "correct": False, "confidence": 0.6},
            {"concept": "Concept B", "correct": False, "confidence": 0.4},
        ]
    },
    "average_student": {
        "name": "Jordan",
        "mastery": {"Concept A": 0.6, "Concept B": 0.5, "Concept C": 0.55},
        "recent_responses": [
            {"concept": "Concept A", "correct": True, "confidence": 0.5},
            {"concept": "Concept B", "correct": False, "confidence": 0.3},
        ]
    },
    "high_performer": {
        "name": "Sam",
        "mastery": {"Concept A": 0.85, "Concept B": 0.9, "Concept C": 0.75},
        "recent_responses": [
            {"concept": "Concept A", "correct": True, "confidence": 0.9},
            {"concept": "Concept C", "correct": False, "confidence": 0.7},
        ]
    }
}


def load_sample_history(profile: str):
    """Load a sample student history."""
    history = SAMPLE_HISTORIES.get(profile, SAMPLE_HISTORIES["average_student"])
    return json.dumps(history, indent=2)


def generate_exit_ticket(history_json: str):
    """Generate personalized exit ticket."""
    try:
        history = json.loads(history_json)
    except json.JSONDecodeError:
        return "❌ Invalid JSON. Please check the format."
    
    agent = ExitTicketAgent()
    ticket = agent.generate_ticket(history)
    
    # Format output
    output = f"""## Exit Ticket for {history.get('name', 'Student')}

### 🎯 Targeted Concept
**{ticket.get('target_concept', 'Unknown')}** (Current mastery: {ticket.get('current_mastery', 0):.0%})

### 📚 Micro-Lesson
{ticket.get('micro_lesson', 'No lesson generated.')}

### ❓ Practice Question
{ticket.get('question', {}).get('prompt', 'No question generated.')}

**Options:**
{chr(10).join([f"  {chr(65+i)}. {opt}" for i, opt in enumerate(ticket.get('question', {}).get('options', []))])}

### ✅ Correct Answer
{ticket.get('question', {}).get('correct_answer', 'N/A')}
"""
    return output


def submit_evaluation(weakness_targeting: int, difficulty_match: int, clarity: int, notes: str):
    """Submit evaluation of exit ticket."""
    avg_score = (weakness_targeting + difficulty_match + clarity) / 3
    
    return f"""## Evaluation Submitted ✅

| Criterion | Score |
|-----------|-------|
| Weakness Targeting | {weakness_targeting}/5 |
| Difficulty Match | {difficulty_match}/5 |
| Clarity | {clarity}/5 |
| **Average** | **{avg_score:.1f}/5** |

**Notes:** {notes if notes else 'None'}
"""


# Gradio Interface
with gr.Blocks(title="Exit-Ticket Evaluator") as demo:
    gr.Markdown("# 🎫 Exit-Ticket Evaluator")
    gr.Markdown("Generate and evaluate personalized exit tickets for students.")
    
    with gr.Row():
        with gr.Column():
            gr.Markdown("### Student Profile")
            profile_dropdown = gr.Dropdown(
                choices=list(SAMPLE_HISTORIES.keys()),
                value="average_student",
                label="Load Sample Profile"
            )
            load_btn = gr.Button("📥 Load Profile")
            
            history_input = gr.Code(
                label="Student History (JSON)",
                language="json",
                lines=15
            )
            
            generate_btn = gr.Button("🎫 Generate Exit Ticket", variant="primary")
        
        with gr.Column():
            ticket_display = gr.Markdown(label="Generated Exit Ticket")
    
    gr.Markdown("---")
    gr.Markdown("## Evaluate Exit Ticket")
    
    with gr.Row():
        weakness = gr.Slider(1, 5, 3, step=1, label="Weakness Targeting")
        difficulty = gr.Slider(1, 5, 3, step=1, label="Difficulty Match")
        clarity = gr.Slider(1, 5, 3, step=1, label="Clarity")
    
    notes = gr.Textbox(label="Notes", placeholder="Feedback on this exit ticket...")
    eval_btn = gr.Button("📝 Submit Evaluation")
    eval_result = gr.Markdown()
    
    load_btn.click(
        fn=load_sample_history,
        inputs=[profile_dropdown],
        outputs=[history_input]
    )
    
    generate_btn.click(
        fn=generate_exit_ticket,
        inputs=[history_input],
        outputs=[ticket_display]
    )
    
    eval_btn.click(
        fn=submit_evaluation,
        inputs=[weakness, difficulty, clarity, notes],
        outputs=[eval_result]
    )


if __name__ == "__main__":
    demo.launch(server_port=7863)

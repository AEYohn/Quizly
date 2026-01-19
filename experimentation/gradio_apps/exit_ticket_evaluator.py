"""
Exit Ticket Evaluator - Gradio Interface
Test personalized exit ticket generation based on student performance.
"""

import os
import sys
import numpy as np
import gradio as gr
import plotly.graph_objects as go

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from simulation.llm_student import LLMStudent, generate_llm_students
from ai_agents.exit_ticket_agent import ExitTicketAgent

# Initialize agent
exit_agent = ExitTicketAgent()

# Sample concepts
CONCEPTS = ["bfs_traversal", "dfs_traversal", "graph_connectivity", "cycle_detection", "tree_properties"]


def create_student_profile(preset, custom_mastery=None):
    """Create a student with specific profile."""
    if preset == "struggling":
        mastery = {c: np.random.uniform(0.2, 0.4) for c in CONCEPTS}
    elif preset == "advanced":
        mastery = {c: np.random.uniform(0.7, 0.9) for c in CONCEPTS}
    elif preset == "mixed":
        mastery = {CONCEPTS[i]: 0.3 + 0.1 * i for i in range(len(CONCEPTS))}
    elif preset == "custom" and custom_mastery:
        mastery = {c: float(v) for c, v in zip(CONCEPTS, custom_mastery.split(","))}
    else:
        mastery = {c: np.random.uniform(0.4, 0.6) for c in CONCEPTS}
    
    student = LLMStudent(
        id=1,
        name="Test Student",
        mastery=mastery,
        personality="average"
    )
    
    return student


def generate_exit_ticket(preset, custom_mastery, use_llm):
    """Generate personalized exit ticket for student."""
    student = create_student_profile(preset, custom_mastery)
    
    # Build session history
    session_history = [
        {"concept": c, "correct": student.mastery[c] > 0.5, "confidence": student.mastery[c]}
        for c in CONCEPTS
    ]
    
    # Generate exit ticket
    ticket = exit_agent.generate_ticket(
        student_id=student.id,
        session_summary=session_history,
        weak_concepts=sorted(CONCEPTS, key=lambda c: student.mastery[c])[:2]
    )
    
    # Create mastery visualization
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        x=[c.replace("_", " ").title() for c in CONCEPTS],
        y=[student.mastery[c] for c in CONCEPTS],
        marker_color=['#ef4444' if student.mastery[c] < 0.5 else '#22c55e' for c in CONCEPTS]
    ))
    
    fig.add_hline(y=0.5, line_dash="dash", line_color="gray")
    fig.update_layout(title="Student Mastery Profile", yaxis_range=[0, 1], height=300)
    
    # Format ticket display
    ticket_md = f"""
## 📝 Personalized Exit Ticket

### Student Profile
- **Weakest Concept:** {ticket.get('target_concept', 'Unknown').replace('_', ' ').title()}
- **Current Mastery:** {student.mastery.get(ticket.get('target_concept', ''), 0.5):.0%}

---

### Micro-Lesson

{ticket.get('micro_lesson', 'No lesson generated')}

---

### Follow-Up Question

**{ticket.get('question', {}).get('prompt', 'No question generated')}**

"""
    for opt in ticket.get('question', {}).get('options', []):
        marker = "✅" if opt.startswith(ticket.get('question', {}).get('correct_answer', '')) else "⬜"
        ticket_md += f"{marker} {opt}\n"
    
    ticket_md += f"\n**Explanation:** {ticket.get('question', {}).get('explanation', '')[:200]}..."
    
    return fig, ticket_md, ticket


def evaluate_ticket(ticket_state, weakness_targeting, difficulty_match, clarity):
    """Evaluate exit ticket quality."""
    if not ticket_state:
        return "No ticket to evaluate"
    
    avg = (weakness_targeting + difficulty_match + clarity) / 3
    
    eval_md = f"""
## Exit Ticket Evaluation

| Criterion | Score | Description |
|-----------|-------|-------------|
| Weakness Targeting | {weakness_targeting}/5 | Does it address the student's actual weak concept? |
| Difficulty Match | {difficulty_match}/5 | Is it appropriate for the student's level? |
| Clarity | {clarity}/5 | Is the lesson and question clear? |
| **Overall** | **{avg:.1f}/5** | |

"""
    
    if avg >= 4:
        eval_md += "✅ **Excellent** — Exit ticket is well-targeted and appropriate."
    elif avg >= 3:
        eval_md += "⚠️ **Good** — Minor adjustments may improve effectiveness."
    else:
        eval_md += "❌ **Needs Improvement** — Ticket may not effectively address student needs."
    
    return eval_md


def batch_test(num_students, distribution):
    """Test exit tickets for a batch of students."""
    students = generate_llm_students(int(num_students), CONCEPTS, distribution)
    
    results = []
    for student in students:
        session_history = [
            {"concept": c, "correct": student.mastery[c] > 0.5, "confidence": student.mastery[c]}
            for c in CONCEPTS
        ]
        
        weak = sorted(CONCEPTS, key=lambda c: student.mastery[c])[:2]
        
        ticket = exit_agent.generate_ticket(
            student_id=student.id,
            session_summary=session_history,
            weak_concepts=weak
        )
        
        # Check if ticket targets actual weakness
        target = ticket.get("target_concept", "")
        is_targeted = target in weak
        
        results.append({
            "student_id": student.id,
            "personality": student.personality,
            "weakest": weak[0],
            "target": target,
            "targeted_correctly": is_targeted
        })
    
    # Create summary
    correct = sum(1 for r in results if r["targeted_correctly"])
    
    fig = go.Figure()
    fig.add_trace(go.Pie(
        labels=["Correctly Targeted", "Missed"],
        values=[correct, len(results) - correct],
        marker_colors=["#22c55e", "#ef4444"]
    ))
    fig.update_layout(title=f"Targeting Accuracy: {correct}/{len(results)} ({100*correct/len(results):.0f}%)")
    
    summary_md = f"""
## Batch Test Results

| Metric | Value |
|--------|-------|
| Students Tested | {len(results)} |
| Correctly Targeted | {correct} ({100*correct/len(results):.0f}%) |
| Missed | {len(results) - correct} |

### Sample Results

| Student | Personality | Weakest | Targeted | ✓ |
|---------|-------------|---------|----------|---|
"""
    
    for r in results[:10]:
        check = "✅" if r["targeted_correctly"] else "❌"
        summary_md += f"| S{r['student_id']} | {r['personality']} | {r['weakest'][:10]} | {r['target'][:10]} | {check} |\n"
    
    return fig, summary_md


# Gradio Interface
with gr.Blocks(title="Exit Ticket Evaluator", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🎫 Exit Ticket Evaluator
    
    Test personalized exit ticket generation based on student performance history.
    
    Exit tickets should:
    - Target the student's **weakest concept**
    - Be at an **appropriate difficulty** level
    - Provide a **brief micro-lesson** before the question
    """)
    
    with gr.Tabs():
        with gr.Tab("Single Student"):
            with gr.Row():
                with gr.Column():
                    preset = gr.Dropdown(
                        ["struggling", "average", "advanced", "mixed", "custom"],
                        value="average",
                        label="Student Preset"
                    )
                    custom = gr.Textbox(
                        value="0.3, 0.4, 0.5, 0.6, 0.7",
                        label="Custom Mastery (comma-separated, one per concept)",
                        visible=True
                    )
                    use_llm = gr.Checkbox(value=True, label="Use LLM")
                    gen_btn = gr.Button("🎫 Generate Exit Ticket", variant="primary")
                
                with gr.Column():
                    profile_plot = gr.Plot()
            
            ticket_display = gr.Markdown("")
            ticket_state = gr.State({})
            
            gr.Markdown("### Evaluate Ticket")
            with gr.Row():
                weak_tgt = gr.Slider(1, 5, value=3, step=1, label="Weakness Targeting")
                diff_match = gr.Slider(1, 5, value=3, step=1, label="Difficulty Match")
                clarity = gr.Slider(1, 5, value=3, step=1, label="Clarity")
                eval_btn = gr.Button("📊 Evaluate")
            
            eval_result = gr.Markdown("")
        
        with gr.Tab("Batch Test"):
            with gr.Row():
                batch_n = gr.Slider(10, 50, value=20, step=5, label="Number of Students")
                batch_dist = gr.Dropdown(["realistic", "bimodal", "struggling"], value="realistic")
                batch_btn = gr.Button("🔬 Run Batch Test", variant="primary")
            
            batch_chart = gr.Plot()
            batch_summary = gr.Markdown("")
    
    # Events
    gen_btn.click(generate_exit_ticket,
                 inputs=[preset, custom, use_llm],
                 outputs=[profile_plot, ticket_display, ticket_state])
    
    eval_btn.click(evaluate_ticket,
                  inputs=[ticket_state, weak_tgt, diff_match, clarity],
                  outputs=[eval_result])
    
    batch_btn.click(batch_test,
                   inputs=[batch_n, batch_dist],
                   outputs=[batch_chart, batch_summary])


if __name__ == "__main__":
    print("🚀 Starting Exit Ticket Evaluator on http://localhost:7863")
    demo.launch(server_port=7863, share=False)

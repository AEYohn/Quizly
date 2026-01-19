"""
Instructor Sandbox - Gradio Interface
Full simulation of a classroom session from the instructor's perspective.
"""

import os
import sys
import json
import numpy as np
import gradio as gr
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from simulation.llm_student import LLMStudent, generate_llm_students
from ai_agents.teaching_policy import TeachingPolicy, StaticPolicy, TeachingAction
from ai_agents.session_planner import SessionPlanner
from ai_agents.question_designer import QuestionDesigner

# Global state
class SessionState:
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.students = []
        self.questions = []
        self.results = []
        self.policy = None
        self.current_q = 0
        self.pre_mastery = {}
        self.use_llm = True

state = SessionState()


def generate_session(topic, concepts_text, num_students, distribution, duration, difficulty_curve, use_llm):
    """Generate a new session plan and student cohort."""
    state.reset()
    state.use_llm = use_llm
    
    # Parse concepts
    concepts = [c.strip() for c in concepts_text.split(",") if c.strip()]
    if not concepts:
        concepts = ["concept_1", "concept_2", "concept_3"]
    
    # Generate students
    state.students = generate_llm_students(int(num_students), concepts, distribution)
    
    # Record pre-mastery
    state.pre_mastery = {c: np.mean([s.mastery.get(c, 0.5) for s in state.students]) for c in concepts}
    
    # Generate questions using AI
    planner = SessionPlanner()
    plan = planner.generate_plan(topic, concepts, int(duration), difficulty_curve)
    state.questions = plan.get("questions", [])
    
    # Initialize policy
    state.policy = TeachingPolicy(name="adaptive")
    
    # Create distribution heatmap
    heatmap = create_mastery_heatmap(concepts)
    
    # Create question preview
    q_preview = "### Generated Questions\n\n"
    for i, q in enumerate(state.questions):
        q_preview += f"**Q{i+1}** ({q['concept']}, diff={q['difficulty']:.2f}): {q.get('question_prompt', '')[:80]}...\n\n"
    
    return (
        f"✅ Generated {len(state.questions)} questions for {len(state.students)} students",
        heatmap,
        q_preview,
        create_empty_plot("Response Distribution"),
        create_empty_plot("Session Progress"),
        ""
    )


def run_next_question():
    """Run the next question in the session."""
    if state.current_q >= len(state.questions):
        return get_session_summary()
    
    q = state.questions[state.current_q]
    
    # Collect responses
    responses = []
    for student in state.students:
        # Adapt question format for student model
        q_adapted = {
            "concept": q.get("concept", "unknown"),
            "difficulty": q.get("difficulty", 0.5),
            "prompt": q.get("question_prompt", ""),
            "options": q.get("options", ["A", "B", "C", "D"]),
            "correct_answer": q.get("correct_answer", "A")
        }
        resp = student.answer_question(q_adapted, use_llm=state.use_llm)
        responses.append(resp)
    
    # Calculate metrics
    correct = sum(1 for r in responses if r["is_correct"])
    correctness = correct / len(responses)
    avg_conf = np.mean([r["confidence"] for r in responses])
    
    # Entropy
    counts = defaultdict(int)
    for r in responses:
        counts[r["answer"]] += 1
    entropy = 0
    for c in counts.values():
        if c > 0:
            p = c / len(responses)
            entropy -= p * np.log2(p)
    entropy = entropy / np.log2(4) if entropy > 0 else 0
    
    result = {
        "question_idx": state.current_q,
        "concept": q.get("concept"),
        "correctness_rate": correctness,
        "avg_confidence": avg_conf,
        "entropy": entropy,
        "responses": responses,
        "answer_counts": dict(counts)
    }
    
    # Get policy decision
    action = state.policy.decide_action(result, use_llm=state.use_llm)
    result["action"] = action["action"].value
    result["reason"] = action.get("reason", "")
    
    # Apply learning
    if action["action"] == TeachingAction.PEER_DISCUSSION:
        for s in state.students:
            if any(r["student_id"] == s.id and not r["is_correct"] for r in responses):
                s.learn_from_discussion(q["concept"], "", [])
    elif action["action"] == TeachingAction.REMEDIATE:
        for s in state.students:
            s.update_mastery(q["concept"], 0.08)
    
    state.results.append(result)
    state.current_q += 1
    
    # Create visualizations
    response_dist = create_response_distribution(result)
    progress = create_progress_chart()
    
    # Log entry
    log = f"""
### Q{state.current_q}: {q['concept'].replace('_', ' ').title()}

{q.get('question_prompt', '')[:150]}...

| Metric | Value |
|--------|-------|
| Correctness | {correctness:.1%} |
| Confidence | {avg_conf:.1%} |
| Entropy | {entropy:.2f} |

**Action:** {action['action'].value} — {action.get('reason', '')}

---
"""
    
    return (
        f"✅ Completed Q{state.current_q}/{len(state.questions)}",
        create_mastery_heatmap([q["concept"] for q in state.questions]),
        log,
        response_dist,
        progress,
        log
    )


def run_full_session():
    """Run all remaining questions."""
    logs = []
    while state.current_q < len(state.questions):
        run_next_question()
        logs.append(state.results[-1])
    
    return get_session_summary()


def get_session_summary():
    """Generate final session summary."""
    if not state.results:
        return ("No results yet",) + (None,) * 5
    
    avg_correct = np.mean([r["correctness_rate"] for r in state.results])
    avg_conf = np.mean([r["avg_confidence"] for r in state.results])
    disc_rate = sum(1 for r in state.results if r["action"] == "peer_discussion") / len(state.results)
    
    # Learning gain
    concepts = list(state.pre_mastery.keys())
    post_mastery = {c: np.mean([s.mastery.get(c, 0.5) for s in state.students]) for c in concepts}
    gains = {c: post_mastery[c] - state.pre_mastery[c] for c in concepts}
    avg_gain = np.mean(list(gains.values()))
    
    summary = f"""
## 📊 Session Complete!

| Metric | Value |
|--------|-------|
| Questions | {len(state.results)} |
| Avg Correctness | {avg_correct:.1%} |
| Avg Confidence | {avg_conf:.1%} |
| Discussion Rate | {disc_rate:.1%} |
| **Learning Gain** | **{avg_gain:+.3f}** |

### Per-Concept Gains
"""
    for c, g in gains.items():
        summary += f"- {c.replace('_', ' ').title()}: {g:+.3f}\n"
    
    return (
        "🏁 Session complete!",
        create_final_mastery_comparison(),
        summary,
        create_response_distribution(state.results[-1]) if state.results else None,
        create_progress_chart(),
        summary
    )


def create_mastery_heatmap(concepts):
    """Create student mastery heatmap."""
    if not state.students:
        return create_empty_plot("Student Mastery")
    
    z = [[s.mastery.get(c, 0.5) for c in concepts] for s in state.students]
    
    fig = go.Figure(data=go.Heatmap(
        z=z,
        x=[c.replace("_", " ").title()[:12] for c in concepts],
        y=[f"S{s.id}" for s in state.students],
        colorscale='RdYlGn',
        zmin=0, zmax=1
    ))
    fig.update_layout(title="Student Mastery", height=350)
    return fig


def create_response_distribution(result):
    """Create response distribution bar chart."""
    counts = result.get("answer_counts", {})
    options = ["A", "B", "C", "D"]
    values = [counts.get(o, 0) for o in options]
    
    fig = go.Figure(data=[go.Bar(x=options, y=values, marker_color=['#22c55e', '#94a3b8', '#94a3b8', '#94a3b8'])])
    fig.update_layout(title=f"Q{result['question_idx']+1} Responses", height=250)
    return fig


def create_progress_chart():
    """Create session progress line chart."""
    if not state.results:
        return create_empty_plot("Progress")
    
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True)
    
    x = list(range(1, len(state.results) + 1))
    correctness = [r["correctness_rate"] for r in state.results]
    entropy = [r["entropy"] for r in state.results]
    
    fig.add_trace(go.Scatter(x=x, y=correctness, mode='lines+markers', name='Correctness',
                            line=dict(color='#0ea5e9')), row=1, col=1)
    fig.add_hrect(y0=0.3, y1=0.7, fillcolor="green", opacity=0.1, row=1, col=1)
    
    fig.add_trace(go.Scatter(x=x, y=entropy, mode='lines+markers', name='Entropy',
                            line=dict(color='#f59e0b')), row=2, col=1)
    
    fig.update_layout(height=300, showlegend=True)
    return fig


def create_final_mastery_comparison():
    """Compare pre vs post mastery."""
    if not state.pre_mastery:
        return create_empty_plot("Mastery Comparison")
    
    concepts = list(state.pre_mastery.keys())
    pre = [state.pre_mastery[c] for c in concepts]
    post = [np.mean([s.mastery.get(c, 0.5) for s in state.students]) for c in concepts]
    
    fig = go.Figure(data=[
        go.Bar(name='Pre', x=concepts, y=pre, marker_color='#94a3b8'),
        go.Bar(name='Post', x=concepts, y=post, marker_color='#0ea5e9')
    ])
    fig.update_layout(barmode='group', title="Mastery: Pre vs Post", height=300)
    return fig


def create_empty_plot(title):
    fig = go.Figure()
    fig.update_layout(title=title, height=250)
    return fig


# Build Gradio Interface
with gr.Blocks(title="Quizly Instructor Sandbox", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🎓 Quizly — Instructor Sandbox
    
    Simulate complete classroom sessions with AI-generated questions and adaptive teaching policies.
    """)
    
    with gr.Row():
        with gr.Column(scale=1):
            gr.Markdown("### 📝 Session Setup")
            topic = gr.Textbox(value="Graph Theory", label="Topic")
            concepts = gr.Textbox(value="bfs_traversal, dfs_traversal, graph_connectivity, cycle_detection", 
                                 label="Concepts (comma-separated)")
            num_students = gr.Slider(10, 100, value=30, step=5, label="Students")
            distribution = gr.Dropdown(["realistic", "bimodal", "struggling", "uniform"], 
                                       value="realistic", label="Distribution")
            duration = gr.Slider(15, 60, value=30, step=5, label="Duration (min)")
            difficulty = gr.Dropdown(["gradual", "flat", "challenging"], value="gradual", label="Difficulty Curve")
            use_llm = gr.Checkbox(value=True, label="Use LLM (Gemini)")
            
            gen_btn = gr.Button("🚀 Generate Session", variant="primary")
            status = gr.Textbox(label="Status", interactive=False)
            
            gr.Markdown("### 🎮 Controls")
            step_btn = gr.Button("▶️ Next Question")
            run_btn = gr.Button("⏩ Run All")
        
        with gr.Column(scale=2):
            mastery_plot = gr.Plot(label="Student Mastery")
            questions_md = gr.Markdown("### Questions will appear here...")
    
    with gr.Row():
        response_plot = gr.Plot(label="Response Distribution")
        progress_plot = gr.Plot(label="Session Progress")
    
    with gr.Row():
        session_log = gr.Markdown("### Session log will appear here...")
    
    # Events
    gen_btn.click(generate_session, 
                 inputs=[topic, concepts, num_students, distribution, duration, difficulty, use_llm],
                 outputs=[status, mastery_plot, questions_md, response_plot, progress_plot, session_log])
    
    step_btn.click(run_next_question,
                  outputs=[status, mastery_plot, questions_md, response_plot, progress_plot, session_log])
    
    run_btn.click(run_full_session,
                 outputs=[status, mastery_plot, questions_md, response_plot, progress_plot, session_log])


if __name__ == "__main__":
    print("🚀 Starting Instructor Sandbox on http://localhost:7860")
    demo.launch(server_port=7860, share=False)

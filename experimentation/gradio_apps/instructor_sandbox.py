"""
Instructor-View Sandbox
Interactive simulation of classroom scenarios with configurable parameters.
"""

import gradio as gr
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from dotenv import load_dotenv
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulation.student_model import SimulatedStudent, generate_students
from simulation.session_simulator import SessionSimulator
from ai_agents.session_planner import SessionPlanner
from ai_agents.question_designer import QuestionDesigner

load_dotenv()


def run_simulation(
    topic: str,
    concepts: str,
    num_students: int,
    mastery_distribution: str,
    session_minutes: int
):
    """Run a simulated classroom session."""
    
    # Parse concepts
    concept_list = [c.strip() for c in concepts.split(",")]
    
    # Generate students
    students = generate_students(
        n=num_students,
        concepts=concept_list,
        distribution=mastery_distribution
    )
    
    # Generate session plan
    planner = SessionPlanner()
    session_plan = planner.generate_plan(
        topic=topic,
        concepts=concept_list,
        time_budget_minutes=session_minutes
    )
    
    # Run simulation
    simulator = SessionSimulator(students=students)
    results = simulator.run_session(session_plan)
    
    # Create visualizations
    response_fig = create_response_distribution_plot(results)
    entropy_fig = create_entropy_timeline_plot(results)
    action_log = format_action_log(results)
    
    return response_fig, entropy_fig, action_log


def create_response_distribution_plot(results):
    """Create per-question response distribution bar chart."""
    fig = go.Figure()
    
    for i, q_result in enumerate(results.get("questions", [])):
        correctness = q_result.get("correctness_rate", 0.5)
        fig.add_trace(go.Bar(
            name=f"Q{i+1}",
            x=[f"Question {i+1}"],
            y=[correctness * 100],
            marker_color='green' if correctness > 0.7 else 'orange' if correctness > 0.3 else 'red'
        ))
    
    fig.update_layout(
        title="Response Correctness by Question",
        yaxis_title="% Correct",
        showlegend=False
    )
    return fig


def create_entropy_timeline_plot(results):
    """Create entropy time series plot."""
    questions = results.get("questions", [])
    entropies = [q.get("entropy", 0) for q in questions]
    
    fig = px.line(
        x=list(range(1, len(entropies) + 1)),
        y=entropies,
        markers=True,
        title="Class 'Pulse' (Entropy) Over Time"
    )
    fig.update_layout(xaxis_title="Question", yaxis_title="Response Entropy")
    return fig


def format_action_log(results):
    """Format action log as markdown."""
    log_lines = ["| Question | Correctness | Action Taken | Recommended |",
                 "|----------|-------------|--------------|-------------|"]
    
    for i, q_result in enumerate(results.get("questions", [])):
        correctness = q_result.get("correctness_rate", 0.5)
        action = q_result.get("action_taken", "move_on")
        recommended = q_result.get("recommended_action", "move_on")
        match = "✅" if action == recommended else "⚠️"
        
        log_lines.append(
            f"| Q{i+1} | {correctness:.0%} | {action} | {recommended} {match} |"
        )
    
    return "\n".join(log_lines)


# Gradio Interface
with gr.Blocks(title="Quizly Instructor Sandbox") as demo:
    gr.Markdown("# 🎓 Quizly Instructor Sandbox")
    gr.Markdown("Simulate classroom scenarios to test AI behavior and adaptive policies.")
    
    with gr.Row():
        with gr.Column(scale=1):
            topic_input = gr.Textbox(
                label="Topic",
                placeholder="e.g., Newton's Laws of Motion"
            )
            concepts_input = gr.Textbox(
                label="Concepts (comma-separated)",
                placeholder="e.g., Inertia, F=ma, Action-Reaction"
            )
            num_students = gr.Slider(
                minimum=10, maximum=100, value=30, step=5,
                label="Number of Students"
            )
            distribution = gr.Dropdown(
                choices=["normal", "bimodal", "uniform"],
                value="normal",
                label="Mastery Distribution"
            )
            session_time = gr.Slider(
                minimum=15, maximum=60, value=30, step=5,
                label="Session Length (minutes)"
            )
            run_btn = gr.Button("🚀 Run Simulation", variant="primary")
        
        with gr.Column(scale=2):
            response_plot = gr.Plot(label="Response Distributions")
            entropy_plot = gr.Plot(label="Entropy Timeline")
            action_log = gr.Markdown(label="Action Log")
    
    run_btn.click(
        fn=run_simulation,
        inputs=[topic_input, concepts_input, num_students, distribution, session_time],
        outputs=[response_plot, entropy_plot, action_log]
    )


if __name__ == "__main__":
    demo.launch(server_port=7860)

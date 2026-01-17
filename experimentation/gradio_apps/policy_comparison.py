"""
Policy Comparison Dashboard
Compare different adaptive policies on simulated classrooms.
"""

import gradio as gr
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulation.student_model import generate_students
from simulation.session_simulator import SessionSimulator


POLICIES = {
    "basic_threshold": {
        "name": "Basic Threshold",
        "description": "<70% correct → discuss",
        "config": {"threshold_low": 0.3, "threshold_high": 0.7}
    },
    "entropy_based": {
        "name": "Entropy-Based",
        "description": "Trigger discussion when entropy > 0.8",
        "config": {"entropy_threshold": 0.8}
    },
    "confidence_weighted": {
        "name": "Confidence-Weighted",
        "description": "Weight correctness by confidence levels",
        "config": {"use_confidence": True}
    }
}


def compare_policies(
    num_students: int,
    num_questions: int,
    mastery_distribution: str
):
    """Run simulation with multiple policies and compare results."""
    
    concepts = ["Concept A", "Concept B", "Concept C"]
    results = {}
    
    for policy_id, policy in POLICIES.items():
        students = generate_students(
            n=num_students,
            concepts=concepts,
            distribution=mastery_distribution
        )
        
        simulator = SessionSimulator(
            students=students,
            policy=policy_id,
            policy_config=policy["config"]
        )
        
        results[policy_id] = simulator.run_session({
            "questions": [{"concept": c, "difficulty": 0.5} for c in concepts * (num_questions // 3 + 1)][:num_questions]
        })
    
    # Create comparison visualizations
    learning_gains_fig = create_learning_gains_chart(results)
    time_allocation_fig = create_time_allocation_chart(results)
    coverage_fig = create_coverage_chart(results)
    
    summary = create_summary_table(results)
    
    return learning_gains_fig, time_allocation_fig, coverage_fig, summary


def create_learning_gains_chart(results):
    """Create learning gains comparison chart."""
    fig = go.Figure()
    
    for policy_id, result in results.items():
        gains = result.get("learning_gains", [0.1, 0.15, 0.12])
        fig.add_trace(go.Bar(
            name=POLICIES[policy_id]["name"],
            x=["Concept A", "Concept B", "Concept C"],
            y=gains
        ))
    
    fig.update_layout(
        title="Learning Gains by Policy",
        yaxis_title="Normalized Gain",
        barmode="group"
    )
    return fig


def create_time_allocation_chart(results):
    """Create time allocation pie charts."""
    fig = make_subplots(rows=1, cols=len(results), subplot_titles=[POLICIES[p]["name"] for p in results])
    
    for i, (policy_id, result) in enumerate(results.items(), 1):
        time_alloc = result.get("time_allocation", {"Concept A": 33, "Concept B": 33, "Concept C": 34})
        fig.add_trace(
            go.Pie(labels=list(time_alloc.keys()), values=list(time_alloc.values()), name=policy_id),
            row=1, col=i
        )
    
    fig.update_layout(title="Time Allocation by Policy")
    return fig


def create_coverage_chart(results):
    """Create student coverage chart."""
    fig = go.Figure()
    
    policies = list(results.keys())
    coverages = [results[p].get("student_coverage", 0.75) * 100 for p in policies]
    
    fig.add_trace(go.Bar(
        x=[POLICIES[p]["name"] for p in policies],
        y=coverages,
        marker_color=['#2ecc71', '#3498db', '#9b59b6']
    ))
    
    fig.update_layout(
        title="% Students Reaching Target Mastery",
        yaxis_title="Coverage (%)",
        yaxis_range=[0, 100]
    )
    return fig


def create_summary_table(results):
    """Create summary comparison table."""
    rows = ["| Policy | Avg Gain | Coverage | Discussion Triggers |",
            "|--------|----------|----------|---------------------|"]
    
    for policy_id, result in results.items():
        avg_gain = np.mean(result.get("learning_gains", [0.1]))
        coverage = result.get("student_coverage", 0.75)
        triggers = result.get("discussion_triggers", 3)
        
        rows.append(f"| {POLICIES[policy_id]['name']} | {avg_gain:.2f} | {coverage:.0%} | {triggers} |")
    
    return "\n".join(rows)


# Gradio Interface
with gr.Blocks(title="Policy Comparison Dashboard") as demo:
    gr.Markdown("# 📊 Policy Comparison Dashboard")
    gr.Markdown("Compare adaptive policies to find the most effective approach.")
    
    with gr.Row():
        num_students = gr.Slider(10, 100, 30, step=5, label="Students")
        num_questions = gr.Slider(5, 20, 10, step=1, label="Questions")
        distribution = gr.Dropdown(
            ["normal", "bimodal", "uniform"],
            value="normal",
            label="Distribution"
        )
    
    compare_btn = gr.Button("🔬 Compare Policies", variant="primary")
    
    with gr.Row():
        learning_plot = gr.Plot(label="Learning Gains")
        coverage_plot = gr.Plot(label="Student Coverage")
    
    time_plot = gr.Plot(label="Time Allocation")
    summary = gr.Markdown(label="Summary")
    
    compare_btn.click(
        fn=compare_policies,
        inputs=[num_students, num_questions, distribution],
        outputs=[learning_plot, time_plot, coverage_plot, summary]
    )


if __name__ == "__main__":
    demo.launch(server_port=7861)

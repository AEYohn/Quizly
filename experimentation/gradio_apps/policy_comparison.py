"""
Policy Comparison Dashboard - Gradio Interface
Compare different teaching policies on simulated classrooms.
"""

import os
import sys
import numpy as np
import gradio as gr
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from simulation.llm_student import generate_llm_students
from ai_agents.teaching_policy import TeachingPolicy, StaticPolicy, TeachingAction


# Policy definitions
class EntropyPolicy(TeachingPolicy):
    """Trigger discussion based on entropy threshold."""
    def __init__(self, entropy_threshold=0.6):
        super().__init__(name=f"entropy_{entropy_threshold}")
        self.entropy_threshold = entropy_threshold
    
    def decide_action(self, result, **kwargs):
        self._history.append(result)
        entropy = result.get("entropy", 0)
        correctness = result.get("correctness_rate", 0.5)
        
        if entropy > self.entropy_threshold:
            return {"action": TeachingAction.PEER_DISCUSSION, "reason": f"High entropy ({entropy:.2f})"}
        elif correctness < 0.3:
            return {"action": TeachingAction.REMEDIATE, "reason": f"Low correctness ({correctness:.1%})"}
        else:
            return {"action": TeachingAction.MOVE_ON, "reason": "Entropy below threshold"}


class ConfidenceWeightedPolicy(TeachingPolicy):
    """Weight correctness by confidence levels."""
    def __init__(self):
        super().__init__(name="confidence_weighted")
    
    def decide_action(self, result, **kwargs):
        self._history.append(result)
        correctness = result.get("correctness_rate", 0.5)
        confidence = result.get("avg_confidence", 0.5)
        
        # Weighted score: low confidence + low correctness = discuss
        weighted = correctness * 0.6 + confidence * 0.4
        
        if weighted < 0.4:
            return {"action": TeachingAction.REMEDIATE, "reason": f"Low weighted score ({weighted:.2f})"}
        elif weighted < 0.65:
            return {"action": TeachingAction.PEER_DISCUSSION, "reason": f"Moderate weighted score ({weighted:.2f})"}
        else:
            return {"action": TeachingAction.MOVE_ON, "reason": f"High weighted score ({weighted:.2f})"}


# Test questions
TEST_QUESTIONS = [
    {"concept": "concept_a", "difficulty": 0.4, "options": ["A", "B", "C", "D"], "correct_answer": "A"},
    {"concept": "concept_b", "difficulty": 0.5, "options": ["A", "B", "C", "D"], "correct_answer": "B"},
    {"concept": "concept_c", "difficulty": 0.55, "options": ["A", "B", "C", "D"], "correct_answer": "A"},
    {"concept": "concept_a", "difficulty": 0.6, "options": ["A", "B", "C", "D"], "correct_answer": "C"},
    {"concept": "concept_b", "difficulty": 0.65, "options": ["A", "B", "C", "D"], "correct_answer": "A"},
    {"concept": "concept_c", "difficulty": 0.7, "options": ["A", "B", "C", "D"], "correct_answer": "D"},
]

CONCEPTS = ["concept_a", "concept_b", "concept_c"]


def run_policy_experiment(policy, students, questions):
    """Run a single policy experiment."""
    # Clone students to reset mastery
    import copy
    students = copy.deepcopy(students)
    
    pre_mastery = {c: np.mean([s.mastery.get(c, 0.5) for s in students]) for c in CONCEPTS}
    results = []
    
    for q in questions:
        # Collect responses
        responses = []
        for s in students:
            resp = s.answer_question(q, use_llm=False)
            responses.append(resp)
        
        correctness = sum(1 for r in responses if r["is_correct"]) / len(responses)
        confidence = np.mean([r["confidence"] for r in responses])
        
        # Entropy
        counts = defaultdict(int)
        for r in responses:
            counts[r["answer"]] += 1
        entropy = 0
        for c in counts.values():
            p = c / len(responses)
            if p > 0:
                entropy -= p * np.log2(p)
        entropy = entropy / np.log2(4) if entropy > 0 else 0
        
        result = {
            "concept": q["concept"],
            "correctness_rate": correctness,
            "avg_confidence": confidence,
            "entropy": entropy,
            "responses": responses
        }
        
        # Get action
        action = policy.decide_action(result, use_llm=False)
        result["action"] = action["action"].value
        
        # Apply learning
        if action["action"] == TeachingAction.PEER_DISCUSSION:
            for s in students:
                if any(r["student_id"] == s.id and not r["is_correct"] for r in responses):
                    s.learn_from_discussion(q["concept"], "", [])
        elif action["action"] == TeachingAction.REMEDIATE:
            for s in students:
                s.update_mastery(q["concept"], 0.08)
        
        results.append(result)
    
    # Post mastery
    post_mastery = {c: np.mean([s.mastery.get(c, 0.5) for s in students]) for c in CONCEPTS}
    
    return {
        "policy": policy.name,
        "results": results,
        "pre_mastery": pre_mastery,
        "post_mastery": post_mastery,
        "learning_gain": {c: post_mastery[c] - pre_mastery[c] for c in CONCEPTS},
        "avg_correctness": np.mean([r["correctness_rate"] for r in results]),
        "discussion_rate": sum(1 for r in results if r["action"] == "peer_discussion") / len(results)
    }


def run_comparison(num_students, distribution, num_runs):
    """Run comparison across all policies."""
    policies = [
        StaticPolicy(),
        TeachingPolicy(name="adaptive_30_70"),
        EntropyPolicy(entropy_threshold=0.5),
        EntropyPolicy(entropy_threshold=0.7),
        ConfidenceWeightedPolicy()
    ]
    
    all_results = {p.name: [] for p in policies}
    
    for run in range(int(num_runs)):
        # Generate fresh students
        students = generate_llm_students(int(num_students), CONCEPTS, distribution)
        
        for policy in policies:
            result = run_policy_experiment(policy, students, TEST_QUESTIONS)
            all_results[policy.name].append(result)
    
    # Aggregate results
    summary = {}
    for policy_name, runs in all_results.items():
        summary[policy_name] = {
            "avg_correctness": np.mean([r["avg_correctness"] for r in runs]),
            "avg_learning_gain": np.mean([np.mean(list(r["learning_gain"].values())) for r in runs]),
            "discussion_rate": np.mean([r["discussion_rate"] for r in runs]),
            "std_gain": np.std([np.mean(list(r["learning_gain"].values())) for r in runs])
        }
    
    return summary, all_results


def compare_policies(num_students, distribution, num_runs):
    """Main comparison function for Gradio."""
    summary, all_results = run_comparison(num_students, distribution, num_runs)
    
    # Create comparison bar chart
    policies = list(summary.keys())
    
    fig = make_subplots(rows=2, cols=2, 
                       subplot_titles=("Learning Gain", "Discussion Rate", "Avg Correctness", "Gain Variability"))
    
    gains = [summary[p]["avg_learning_gain"] for p in policies]
    disc = [summary[p]["discussion_rate"] for p in policies]
    correct = [summary[p]["avg_correctness"] for p in policies]
    std = [summary[p]["std_gain"] for p in policies]
    
    colors = px.colors.qualitative.Set2[:len(policies)]
    
    fig.add_trace(go.Bar(x=policies, y=gains, marker_color=colors, name="Learning Gain"), row=1, col=1)
    fig.add_trace(go.Bar(x=policies, y=disc, marker_color=colors, showlegend=False), row=1, col=2)
    fig.add_trace(go.Bar(x=policies, y=correct, marker_color=colors, showlegend=False), row=2, col=1)
    fig.add_trace(go.Bar(x=policies, y=std, marker_color=colors, showlegend=False), row=2, col=2)
    
    fig.update_layout(height=500, showlegend=False, title_text="Policy Comparison Results")
    
    # Create learning trajectory plot
    traj_fig = go.Figure()
    for policy_name in policies[:3]:  # Top 3 for clarity
        if all_results[policy_name]:
            run = all_results[policy_name][0]
            correctness = [r["correctness_rate"] for r in run["results"]]
            traj_fig.add_trace(go.Scatter(
                x=list(range(1, len(correctness)+1)),
                y=correctness,
                mode='lines+markers',
                name=policy_name
            ))
    
    traj_fig.add_hrect(y0=0.3, y1=0.7, fillcolor="green", opacity=0.1)
    traj_fig.update_layout(title="Correctness Trajectory", xaxis_title="Question", yaxis_title="Correctness")
    
    # Summary table
    table_md = "### Policy Comparison Summary\n\n"
    table_md += "| Policy | Learning Gain | Discussion Rate | Correctness |\n"
    table_md += "|--------|--------------|-----------------|-------------|\n"
    for p in policies:
        s = summary[p]
        table_md += f"| {p} | {s['avg_learning_gain']:+.4f} | {s['discussion_rate']:.1%} | {s['avg_correctness']:.1%} |\n"
    
    # Best policy
    best = max(summary.items(), key=lambda x: x[1]["avg_learning_gain"])
    table_md += f"\n\n🏆 **Best Policy:** {best[0]} (gain: {best[1]['avg_learning_gain']:+.4f})"
    
    return fig, traj_fig, table_md


# Gradio Interface
with gr.Blocks(title="Policy Comparison Dashboard", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 📊 Policy Comparison Dashboard
    
    Compare teaching policies on simulated classrooms to find optimal adaptive strategies.
    
    **Policies tested:**
    - **Static**: Always move on
    - **Adaptive 30-70**: Discuss when 30-70% correct
    - **Entropy 0.5/0.7**: Discuss when response entropy exceeds threshold
    - **Confidence-Weighted**: Weight correctness by confidence
    """)
    
    with gr.Row():
        num_students = gr.Slider(10, 100, value=30, step=10, label="Students per Run")
        distribution = gr.Dropdown(["realistic", "bimodal", "struggling"], value="realistic", label="Distribution")
        num_runs = gr.Slider(1, 10, value=3, step=1, label="Number of Runs")
        run_btn = gr.Button("🔬 Run Comparison", variant="primary")
    
    with gr.Row():
        comparison_plot = gr.Plot(label="Policy Metrics")
        trajectory_plot = gr.Plot(label="Learning Trajectories")
    
    summary_md = gr.Markdown("")
    
    run_btn.click(compare_policies, 
                 inputs=[num_students, distribution, num_runs],
                 outputs=[comparison_plot, trajectory_plot, summary_md])


if __name__ == "__main__":
    print("🚀 Starting Policy Comparison Dashboard on http://localhost:7861")
    demo.launch(server_port=7861, share=False)

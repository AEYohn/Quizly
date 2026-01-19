"""
Rigorous Experiment Visualization
Visualize debate dynamics, learning evolution, and policy comparison for rigorous simulations.
"""

import os
import json
import glob
from typing import Dict, List, Any, Tuple
from datetime import datetime

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# Style settings
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['figure.figsize'] = (14, 10)
plt.rcParams['font.size'] = 11
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['axes.labelsize'] = 12

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "visualizations", "rigorous")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_rigorous_results() -> Dict[str, List[Dict]]:
    """Load all rigorous experiment results."""
    results = {"adaptive": [], "static": []}
    
    for filepath in glob.glob(os.path.join(RESULTS_DIR, "rigorous_*.json")):
        if "_debates" in filepath or "_learning" in filepath:
            continue
            
        with open(filepath) as f:
            data = json.load(f)
            
        policy = data.get("policy_name", "unknown")
        if policy in results:
            results[policy].append(data)
    
    print(f"Loaded {len(results['adaptive'])} adaptive and {len(results['static'])} static experiments")
    return results


def load_debate_transcripts(experiment_id: str) -> List[Dict]:
    """Load debate transcripts for an experiment."""
    filepath = os.path.join(RESULTS_DIR, f"{experiment_id}_debates.json")
    if os.path.exists(filepath):
        with open(filepath) as f:
            return json.load(f)
    return []


def load_learning_events(experiment_id: str) -> List[Dict]:
    """Load learning events for an experiment."""
    filepath = os.path.join(RESULTS_DIR, f"{experiment_id}_learning.json")
    if os.path.exists(filepath):
        with open(filepath) as f:
            return json.load(f)
    return []


def plot_policy_comparison(results: Dict[str, List[Dict]]) -> str:
    """Create policy comparison dashboard."""
    fig, axes = plt.subplots(2, 3, figsize=(16, 10))
    fig.suptitle("Rigorous Experiment: Adaptive vs Static Policy Comparison", fontsize=16, fontweight='bold')
    
    # Aggregate metrics across experiments
    metrics = {
        "adaptive": {"correctness": [], "discussion_rate": [], "learning_gain": [], 
                     "genuine_learning": [], "positive_outcomes": [], "negative_outcomes": []},
        "static": {"correctness": [], "discussion_rate": [], "learning_gain": [],
                   "genuine_learning": [], "positive_outcomes": [], "negative_outcomes": []}
    }
    
    for policy, experiments in results.items():
        for exp in experiments:
            metrics[policy]["correctness"].append(exp.get("avg_correctness", 0))
            metrics[policy]["discussion_rate"].append(exp.get("discussion_rate", 0))
            metrics[policy]["learning_gain"].append(exp.get("genuine_learning_gain", 0))
            metrics[policy]["genuine_learning"].append(exp.get("genuine_learning_events", 0))
            metrics[policy]["positive_outcomes"].append(exp.get("positive_debate_outcomes", 0))
            metrics[policy]["negative_outcomes"].append(exp.get("negative_debate_outcomes", 0))
    
    colors = {"adaptive": "#2ecc71", "static": "#e74c3c"}
    
    # 1. Correctness comparison
    ax = axes[0, 0]
    x = np.arange(2)
    vals = [np.mean(metrics["adaptive"]["correctness"]) * 100, 
            np.mean(metrics["static"]["correctness"]) * 100]
    bars = ax.bar(x, vals, color=[colors["adaptive"], colors["static"]])
    ax.set_xticks(x)
    ax.set_xticklabels(["Adaptive", "Static"])
    ax.set_ylabel("Correctness (%)")
    ax.set_title("Average Correctness")
    ax.set_ylim(0, 100)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, f'{val:.1f}%', 
                ha='center', fontsize=10)
    
    # 2. Discussion Rate
    ax = axes[0, 1]
    vals = [np.mean(metrics["adaptive"]["discussion_rate"]) * 100, 
            np.mean(metrics["static"]["discussion_rate"]) * 100]
    bars = ax.bar(x, vals, color=[colors["adaptive"], colors["static"]])
    ax.set_xticks(x)
    ax.set_xticklabels(["Adaptive", "Static"])
    ax.set_ylabel("Discussion Rate (%)")
    ax.set_title("Peer Discussion Trigger Rate")
    ax.set_ylim(0, 100)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, f'{val:.1f}%', 
                ha='center', fontsize=10)
    
    # 3. Learning Gain
    ax = axes[0, 2]
    vals = [np.mean(metrics["adaptive"]["learning_gain"]), 
            np.mean(metrics["static"]["learning_gain"])]
    bars = ax.bar(x, vals, color=[colors["adaptive"], colors["static"]])
    ax.set_xticks(x)
    ax.set_xticklabels(["Adaptive", "Static"])
    ax.set_ylabel("Learning Gain")
    ax.set_title("Genuine Learning Gain")
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.002, f'{val:.3f}', 
                ha='center', fontsize=10)
    
    # 4. Learning Events
    ax = axes[1, 0]
    vals = [np.mean(metrics["adaptive"]["genuine_learning"]), 
            np.mean(metrics["static"]["genuine_learning"])]
    bars = ax.bar(x, vals, color=[colors["adaptive"], colors["static"]])
    ax.set_xticks(x)
    ax.set_xticklabels(["Adaptive", "Static"])
    ax.set_ylabel("Count")
    ax.set_title("Genuine Learning Events")
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.2, f'{val:.1f}', 
                ha='center', fontsize=10)
    
    # 5. Debate Outcomes (Adaptive only)
    ax = axes[1, 1]
    positive = np.sum(metrics["adaptive"]["positive_outcomes"])
    negative = np.sum(metrics["adaptive"]["negative_outcomes"])
    if positive + negative > 0:
        ax.pie([positive, negative], labels=["Positive\n(Wrong→Correct)", "Negative\n(Correct→Wrong)"],
               colors=["#27ae60", "#c0392b"], autopct='%1.0f%%', startangle=90)
    else:
        ax.text(0.5, 0.5, "No debates yet", ha='center', va='center', fontsize=12)
    ax.set_title("Debate Outcomes (Adaptive Policy)")
    
    # 6. Experiments Over Time
    ax = axes[1, 2]
    adaptive_times = [datetime.strptime(exp["timestamp"], "%Y%m%d_%H%M%S") 
                      for exp in results["adaptive"]]
    adaptive_gains = metrics["adaptive"]["learning_gain"]
    if adaptive_times:
        ax.plot(range(len(adaptive_times)), adaptive_gains, 'o-', color=colors["adaptive"], 
                label="Adaptive", markersize=8)
    static_times = [datetime.strptime(exp["timestamp"], "%Y%m%d_%H%M%S") 
                    for exp in results["static"]]
    static_gains = metrics["static"]["learning_gain"]
    if static_times:
        ax.plot(range(len(static_times)), static_gains, 's-', color=colors["static"], 
                label="Static", markersize=8)
    ax.set_xlabel("Experiment #")
    ax.set_ylabel("Learning Gain")
    ax.set_title("Learning Gain Across Experiments")
    ax.legend()
    
    plt.tight_layout()
    output_path = os.path.join(OUTPUT_DIR, "policy_comparison.png")
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"Saved: {output_path}")
    return output_path


def plot_question_analysis(results: Dict[str, List[Dict]]) -> str:
    """Analyze performance by question."""
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle("Question-Level Analysis", fontsize=16, fontweight='bold')
    
    # Collect question-level data from latest adaptive experiment
    if not results["adaptive"]:
        print("No adaptive experiments to visualize")
        return ""
    
    latest_exp = sorted(results["adaptive"], key=lambda x: x["timestamp"])[-1]
    question_results = latest_exp.get("question_results", [])
    
    if not question_results:
        print("No question results found")
        return ""
    
    questions = [q["question_id"].replace("q_", "").replace("_", "\n") for q in question_results]
    initial_rates = [q["initial_correct_rate"] * 100 for q in question_results]
    final_rates = [q["final_correct_rate"] * 100 for q in question_results]
    difficulties = [q.get("difficulty", 0.5) for q in question_results]
    debates = [q.get("num_debates", 0) for q in question_results]
    
    # 1. Initial vs Final Correctness
    ax = axes[0, 0]
    x = np.arange(len(questions))
    width = 0.35
    ax.bar(x - width/2, initial_rates, width, label='Initial', color='#3498db', alpha=0.8)
    ax.bar(x + width/2, final_rates, width, label='Final', color='#2ecc71', alpha=0.8)
    ax.set_xticks(x)
    ax.set_xticklabels(questions, rotation=45, ha='right', fontsize=8)
    ax.set_ylabel("Correctness (%)")
    ax.set_title("Initial vs Final Correctness by Question")
    ax.legend()
    ax.set_ylim(0, 110)
    
    # 2. Improvement per question
    ax = axes[0, 1]
    improvements = [f - i for i, f in zip(initial_rates, final_rates)]
    colors = ['#27ae60' if imp >= 0 else '#c0392b' for imp in improvements]
    ax.barh(x, improvements, color=colors)
    ax.set_yticks(x)
    ax.set_yticklabels(questions, fontsize=8)
    ax.set_xlabel("Change in Correctness (%)")
    ax.set_title("Learning Improvement by Question")
    ax.axvline(x=0, color='black', linewidth=0.5)
    
    # 3. Difficulty vs Correctness
    ax = axes[1, 0]
    ax.scatter(difficulties, initial_rates, label='Initial', s=100, alpha=0.7, color='#3498db')
    ax.scatter(difficulties, final_rates, label='Final', s=100, alpha=0.7, color='#2ecc71')
    
    # Connect initial to final with arrows
    for d, i, f in zip(difficulties, initial_rates, final_rates):
        ax.annotate('', xy=(d, f), xytext=(d, i),
                   arrowprops=dict(arrowstyle='->', color='gray', alpha=0.5))
    
    ax.set_xlabel("Question Difficulty")
    ax.set_ylabel("Correctness (%)")
    ax.set_title("Difficulty vs Correctness")
    ax.legend()
    
    # 4. Debates per question
    ax = axes[1, 1]
    debate_colors = ['#e74c3c' if d > 0 else '#bdc3c7' for d in debates]
    ax.bar(x, debates, color=debate_colors)
    ax.set_xticks(x)
    ax.set_xticklabels(questions, rotation=45, ha='right', fontsize=8)
    ax.set_ylabel("Number of Debates")
    ax.set_title("Debates Triggered per Question")
    
    plt.tight_layout()
    output_path = os.path.join(OUTPUT_DIR, "question_analysis.png")
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"Saved: {output_path}")
    return output_path


def plot_debate_flow(experiment_id: str) -> str:
    """Visualize debate flow and belief changes."""
    debates = load_debate_transcripts(experiment_id)
    
    if not debates:
        print(f"No debates found for {experiment_id}")
        return ""
    
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    fig.suptitle(f"Debate Dynamics: {experiment_id}", fontsize=14, fontweight='bold')
    
    # 1. Debate outcomes distribution
    ax = axes[0]
    outcomes = {}
    for debate in debates:
        outcome = debate.get("outcome", "unknown")
        outcomes[outcome] = outcomes.get(outcome, 0) + 1
    
    if outcomes:
        labels = [o.replace("_", "\n") for o in outcomes.keys()]
        values = list(outcomes.values())
        colors = plt.cm.Set3(np.linspace(0, 1, len(values)))
        ax.pie(values, labels=labels, autopct='%1.0f%%', colors=colors, startangle=90)
        ax.set_title("Debate Outcome Distribution")
    
    # 2. Belief changes over turns
    ax = axes[1]
    belief_changes = []
    for debate in debates:
        for change in debate.get("belief_changes", []):
            belief_changes.append(change.get("turn", 0))
    
    if belief_changes:
        ax.hist(belief_changes, bins=range(max(belief_changes) + 2), color='#3498db', 
                edgecolor='white', alpha=0.8)
        ax.set_xlabel("Turn Number")
        ax.set_ylabel("Number of Mind Changes")
        ax.set_title("When Do Students Change Their Mind?")
    else:
        ax.text(0.5, 0.5, "No belief changes recorded", ha='center', va='center', fontsize=12)
    
    plt.tight_layout()
    output_path = os.path.join(OUTPUT_DIR, f"debate_flow_{experiment_id}.png")
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"Saved: {output_path}")
    return output_path


def plot_learning_types(experiment_id: str) -> str:
    """Visualize learning event types."""
    events = load_learning_events(experiment_id)
    
    if not events:
        print(f"No learning events found for {experiment_id}")
        return ""
    
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    fig.suptitle(f"Learning Analysis: {experiment_id}", fontsize=14, fontweight='bold')
    
    # 1. Learning type distribution
    ax = axes[0]
    types = {}
    for event in events:
        lt = event.get("learning_type", "none")
        types[lt] = types.get(lt, 0) + 1
    
    type_colors = {"genuine": "#27ae60", "superficial": "#f39c12", "negative": "#c0392b", "none": "#95a5a6"}
    labels = list(types.keys())
    values = list(types.values())
    colors = [type_colors.get(t, "#3498db") for t in labels]
    ax.bar(labels, values, color=colors)
    ax.set_ylabel("Count")
    ax.set_title("Learning Type Distribution")
    
    # 2. Reasoning quality improvement
    ax = axes[1]
    initial_quality = [e.get("initial_quality", 0.5) for e in events]
    final_quality = [e.get("final_quality", 0.5) for e in events]
    ax.scatter(initial_quality, final_quality, alpha=0.6, s=50)
    ax.plot([0, 1], [0, 1], 'r--', label='No change')
    ax.set_xlabel("Initial Reasoning Quality")
    ax.set_ylabel("Final Reasoning Quality")
    ax.set_title("Reasoning Quality Improvement")
    ax.legend()
    ax.set_xlim(-0.05, 1.05)
    ax.set_ylim(-0.05, 1.05)
    
    # 3. By concept
    ax = axes[2]
    concepts = {}
    for event in events:
        concept = event.get("concept", "unknown").replace("_", "\n")
        if concept not in concepts:
            concepts[concept] = {"correct": 0, "total": 0}
        concepts[concept]["total"] += 1
        if event.get("was_finally_correct", False):
            concepts[concept]["correct"] += 1
    
    concept_names = list(concepts.keys())
    correct_rates = [concepts[c]["correct"] / concepts[c]["total"] * 100 for c in concept_names]
    ax.barh(concept_names, correct_rates, color='#3498db')
    ax.set_xlabel("Final Correctness (%)")
    ax.set_title("Performance by Concept")
    ax.set_xlim(0, 100)
    
    plt.tight_layout()
    output_path = os.path.join(OUTPUT_DIR, f"learning_analysis_{experiment_id}.png")
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"Saved: {output_path}")
    return output_path


def generate_all_visualizations():
    """Generate all visualizations for rigorous experiments."""
    print("=" * 60)
    print("RIGOROUS EXPERIMENT VISUALIZATION")
    print("=" * 60)
    
    results = load_rigorous_results()
    outputs = []
    
    # Policy comparison
    print("\n1. Generating policy comparison...")
    outputs.append(plot_policy_comparison(results))
    
    # Question analysis
    print("\n2. Generating question analysis...")
    outputs.append(plot_question_analysis(results))
    
    # Debate and learning analysis for latest experiments
    print("\n3. Generating debate and learning analysis...")
    for policy, experiments in results.items():
        if experiments:
            latest = sorted(experiments, key=lambda x: x["timestamp"])[-1]
            exp_id = latest["experiment_id"]
            outputs.append(plot_debate_flow(exp_id))
            outputs.append(plot_learning_types(exp_id))
    
    print("\n" + "=" * 60)
    print(f"Generated {len([o for o in outputs if o])} visualizations")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 60)
    
    return [o for o in outputs if o]


if __name__ == "__main__":
    generate_all_visualizations()

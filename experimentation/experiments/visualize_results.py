"""
Experiment Visualization
Visualize results from CS70 Graphs simulation with clustering analysis.
"""

import os
import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from collections import defaultdict

# Set style
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['figure.figsize'] = (12, 8)
plt.rcParams['font.size'] = 11

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "visualizations")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_results():
    """Load all experiment result files."""
    results = {}
    for filename in os.listdir(RESULTS_DIR):
        if filename.endswith(".json"):
            filepath = os.path.join(RESULTS_DIR, filename)
            with open(filepath) as f:
                data = json.load(f)
                policy = data.get("policy_name", filename.split("_")[0])
                results[policy] = data
    return results


def plot_question_metrics(results):
    """Plot correctness, confidence, and entropy per question."""
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    
    for policy_name, data in results.items():
        questions = data.get("question_results", [])
        x = list(range(1, len(questions) + 1))
        
        correctness = [q["correctness_rate"] for q in questions]
        confidence = [q["avg_confidence"] for q in questions]
        entropy = [q["entropy"] for q in questions]
        concepts = [q["concept"].replace("_", " ").title() for q in questions]
        
        linestyle = "-" if policy_name == "adaptive" else "--"
        marker = "o" if policy_name == "adaptive" else "s"
        color = "#0ea5e9" if policy_name == "adaptive" else "#94a3b8"
        
        # Correctness
        axes[0, 0].plot(x, correctness, marker=marker, linestyle=linestyle, 
                       label=policy_name.title(), color=color, linewidth=2, markersize=8)
        axes[0, 0].axhspan(0.3, 0.7, alpha=0.15, color='green', label='Discussion Zone' if policy_name == "adaptive" else "")
        axes[0, 0].set_ylabel("Correctness Rate")
        axes[0, 0].set_title("Correctness per Question")
        axes[0, 0].set_ylim(0, 1)
        
        # Confidence
        axes[0, 1].plot(x, confidence, marker=marker, linestyle=linestyle,
                       label=policy_name.title(), color=color, linewidth=2, markersize=8)
        axes[0, 1].set_ylabel("Average Confidence")
        axes[0, 1].set_title("Student Confidence per Question")
        axes[0, 1].set_ylim(0, 1)
        
        # Entropy
        axes[1, 0].plot(x, entropy, marker=marker, linestyle=linestyle,
                       label=policy_name.title(), color=color, linewidth=2, markersize=8)
        axes[1, 0].set_ylabel("Response Entropy")
        axes[1, 0].set_title("Response Distribution Entropy")
        axes[1, 0].set_ylim(0, 1)
    
    # Action distribution (adaptive only)
    if "adaptive" in results:
        actions = defaultdict(int)
        for q in results["adaptive"]["question_results"]:
            actions[q.get("action", "unknown")] += 1
        
        action_labels = list(actions.keys())
        action_counts = list(actions.values())
        colors = ['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
        
        axes[1, 1].bar(action_labels, action_counts, color=colors[:len(action_labels)])
        axes[1, 1].set_ylabel("Count")
        axes[1, 1].set_title("Teaching Actions Taken (Adaptive Policy)")
        axes[1, 1].tick_params(axis='x', rotation=15)
    
    for ax in axes.flat:
        ax.legend()
        ax.set_xlabel("Question #")
    
    plt.tight_layout()
    filepath = os.path.join(OUTPUT_DIR, "question_metrics.png")
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {filepath}")
    return filepath


def plot_student_clustering(results):
    """Cluster students by mastery and visualize."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    
    for idx, (policy_name, data) in enumerate(results.items()):
        questions = data.get("question_results", [])
        
        # Build student feature matrix from responses
        student_data = defaultdict(list)
        for q in questions:
            for r in q.get("responses", []):
                sid = r.get("student_id", 0)
                student_data[sid].append({
                    "correct": 1 if r.get("is_correct") else 0,
                    "confidence": r.get("confidence", 0.5),
                    "mastery": r.get("concept_mastery", 0.5)
                })
        
        # Create feature vectors: avg correctness, avg confidence, avg mastery
        X = []
        student_ids = []
        for sid, responses in student_data.items():
            if responses:
                avg_correct = np.mean([r["correct"] for r in responses])
                avg_conf = np.mean([r["confidence"] for r in responses])
                avg_mastery = np.mean([r["mastery"] for r in responses])
                X.append([avg_correct, avg_conf, avg_mastery])
                student_ids.append(sid)
        
        X = np.array(X)
        
        if len(X) > 3:
            # K-means clustering
            kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
            clusters = kmeans.fit_predict(X)
            
            # Scatter plot: correctness vs confidence, colored by cluster
            ax = axes[idx]
            scatter = ax.scatter(X[:, 0], X[:, 1], c=clusters, cmap='viridis', 
                               s=80, alpha=0.7, edgecolors='white', linewidth=0.5)
            
            # Add cluster centers
            centers = kmeans.cluster_centers_
            ax.scatter(centers[:, 0], centers[:, 1], c='red', marker='X', 
                      s=200, edgecolors='black', linewidth=2, label='Cluster Centers')
            
            ax.set_xlabel("Average Correctness")
            ax.set_ylabel("Average Confidence")
            ax.set_title(f"{policy_name.title()} Policy - Student Clusters")
            ax.set_xlim(-0.05, 1.05)
            ax.set_ylim(-0.05, 1.05)
            ax.legend()
            
            # Add colorbar
            cbar = plt.colorbar(scatter, ax=ax)
            cbar.set_label("Cluster")
    
    plt.tight_layout()
    filepath = os.path.join(OUTPUT_DIR, "student_clustering.png")
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {filepath}")
    return filepath


def plot_concept_mastery(results):
    """Compare concept mastery between policies."""
    fig, ax = plt.subplots(figsize=(12, 6))
    
    concepts = list(results.get("adaptive", results.get("static", {})).get("final_mastery", {}).keys())
    x = np.arange(len(concepts))
    width = 0.35
    
    for i, (policy_name, data) in enumerate(results.items()):
        mastery = data.get("final_mastery", {})
        values = [mastery.get(c, 0.5) for c in concepts]
        
        color = "#0ea5e9" if policy_name == "adaptive" else "#94a3b8"
        offset = width/2 if i == 0 else -width/2
        bars = ax.bar(x + offset, values, width, label=policy_name.title(), color=color)
        
        # Add value labels
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, 
                   f'{val:.2f}', ha='center', va='bottom', fontsize=9)
    
    ax.set_ylabel("Final Mastery Level")
    ax.set_title("Concept Mastery After Session")
    ax.set_xticks(x)
    ax.set_xticklabels([c.replace("_", " ").title() for c in concepts], rotation=20, ha='right')
    ax.set_ylim(0, 1)
    ax.legend()
    ax.axhline(y=0.5, color='gray', linestyle='--', alpha=0.5, label='Baseline')
    
    plt.tight_layout()
    filepath = os.path.join(OUTPUT_DIR, "concept_mastery.png")
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {filepath}")
    return filepath


def plot_learning_heatmap(results):
    """Create heatmap of student performance by concept."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 8))
    
    for idx, (policy_name, data) in enumerate(results.items()):
        questions = data.get("question_results", [])
        
        # Build matrix: students x concepts
        concepts = sorted(set(q["concept"] for q in questions))
        student_ids = sorted(set(
            r["student_id"] 
            for q in questions 
            for r in q.get("responses", [])
        ))
        
        # Aggregate correctness per student per concept
        matrix = np.zeros((len(student_ids), len(concepts)))
        counts = np.zeros((len(student_ids), len(concepts)))
        
        for q in questions:
            concept_idx = concepts.index(q["concept"])
            for r in q.get("responses", []):
                student_idx = student_ids.index(r["student_id"])
                matrix[student_idx, concept_idx] += 1 if r["is_correct"] else 0
                counts[student_idx, concept_idx] += 1
        
        # Average where we have data
        with np.errstate(divide='ignore', invalid='ignore'):
            matrix = np.where(counts > 0, matrix / counts, 0.5)
        
        ax = axes[idx]
        im = ax.imshow(matrix, cmap='RdYlGn', aspect='auto', vmin=0, vmax=1)
        
        ax.set_xticks(range(len(concepts)))
        ax.set_xticklabels([c.replace("_", " ").title()[:10] for c in concepts], rotation=45, ha='right')
        ax.set_ylabel("Student ID")
        ax.set_title(f"{policy_name.title()} Policy - Performance Heatmap")
        
        # Only show some y-tick labels
        ax.set_yticks(range(0, len(student_ids), 5))
        ax.set_yticklabels([str(student_ids[i]) for i in range(0, len(student_ids), 5)])
        
        plt.colorbar(im, ax=ax, label="Correctness")
    
    plt.tight_layout()
    filepath = os.path.join(OUTPUT_DIR, "learning_heatmap.png")
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {filepath}")
    return filepath


def plot_summary_dashboard(results):
    """Create summary dashboard comparing policies."""
    fig = plt.figure(figsize=(16, 10))
    
    # Summary metrics as text
    ax1 = fig.add_subplot(2, 3, 1)
    ax1.axis('off')
    
    text = "📊 EXPERIMENT SUMMARY\n\n"
    for policy_name, data in results.items():
        text += f"━━━ {policy_name.upper()} ━━━\n"
        text += f"  Correctness: {data['avg_correctness']:.1%}\n"
        text += f"  Confidence: {data['avg_confidence']:.1%}\n"
        text += f"  Discussion Rate: {data['discussion_rate']:.1%}\n"
        text += f"  Learning Gain: {data['learning_gain']:.4f}\n\n"
    
    ax1.text(0.1, 0.9, text, transform=ax1.transAxes, fontsize=12,
            verticalalignment='top', fontfamily='monospace',
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    # Bar comparison
    ax2 = fig.add_subplot(2, 3, 2)
    metrics = ['avg_correctness', 'avg_confidence', 'discussion_rate']
    labels = ['Correctness', 'Confidence', 'Discussion Rate']
    x = np.arange(len(metrics))
    width = 0.35
    
    for i, (policy_name, data) in enumerate(results.items()):
        values = [data.get(m, 0) for m in metrics]
        color = "#0ea5e9" if policy_name == "adaptive" else "#94a3b8"
        offset = width/2 if i == 0 else -width/2
        ax2.bar(x + offset, values, width, label=policy_name.title(), color=color)
    
    ax2.set_xticks(x)
    ax2.set_xticklabels(labels)
    ax2.set_ylabel("Rate")
    ax2.set_title("Policy Comparison")
    ax2.legend()
    ax2.set_ylim(0, 1)
    
    # Learning gain comparison
    ax3 = fig.add_subplot(2, 3, 3)
    policies = list(results.keys())
    gains = [results[p]["learning_gain"] for p in policies]
    colors = ["#0ea5e9" if p == "adaptive" else "#94a3b8" for p in policies]
    ax3.bar(policies, gains, color=colors)
    ax3.set_ylabel("Learning Gain")
    ax3.set_title("Learning Gain by Policy")
    ax3.axhline(y=0, color='gray', linestyle='--')
    
    # Correctness over questions
    ax4 = fig.add_subplot(2, 3, 4)
    for policy_name, data in results.items():
        questions = data.get("question_results", [])
        correctness = [q["correctness_rate"] for q in questions]
        linestyle = "-" if policy_name == "adaptive" else "--"
        color = "#0ea5e9" if policy_name == "adaptive" else "#94a3b8"
        ax4.plot(range(1, len(correctness)+1), correctness, marker='o',
                linestyle=linestyle, label=policy_name.title(), color=color)
    ax4.axhspan(0.3, 0.7, alpha=0.1, color='green')
    ax4.set_xlabel("Question #")
    ax4.set_ylabel("Correctness")
    ax4.set_title("Correctness Trajectory")
    ax4.legend()
    
    # Action distribution pie
    ax5 = fig.add_subplot(2, 3, 5)
    if "adaptive" in results:
        actions = defaultdict(int)
        for q in results["adaptive"]["question_results"]:
            actions[q.get("action", "unknown")] += 1
        ax5.pie(actions.values(), labels=actions.keys(), autopct='%1.0f%%',
               colors=['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'])
        ax5.set_title("Adaptive Policy Actions")
    
    # Concept mastery radar would go here
    ax6 = fig.add_subplot(2, 3, 6)
    if "adaptive" in results:
        mastery = results["adaptive"].get("final_mastery", {})
        concepts = list(mastery.keys())
        values = list(mastery.values())
        ax6.barh(range(len(concepts)), values, color='#0ea5e9')
        ax6.set_yticks(range(len(concepts)))
        ax6.set_yticklabels([c.replace("_", " ").title() for c in concepts])
        ax6.set_xlabel("Mastery")
        ax6.set_title("Final Concept Mastery (Adaptive)")
        ax6.set_xlim(0, 1)
    
    plt.tight_layout()
    filepath = os.path.join(OUTPUT_DIR, "summary_dashboard.png")
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {filepath}")
    return filepath


def main():
    """Generate all visualizations."""
    print("=" * 60)
    print("Generating Experiment Visualizations")
    print("=" * 60)
    
    results = load_results()
    print(f"\nLoaded {len(results)} experiment results: {list(results.keys())}")
    
    print("\n[1/5] Question metrics...")
    plot_question_metrics(results)
    
    print("[2/5] Student clustering...")
    plot_student_clustering(results)
    
    print("[3/5] Concept mastery...")
    plot_concept_mastery(results)
    
    print("[4/5] Learning heatmap...")
    plot_learning_heatmap(results)
    
    print("[5/5] Summary dashboard...")
    dashboard_path = plot_summary_dashboard(results)
    
    print(f"\n✅ All visualizations saved to: {OUTPUT_DIR}")
    print(f"   Main dashboard: {dashboard_path}")
    
    return OUTPUT_DIR


if __name__ == "__main__":
    main()

"""
CS70 Graphs Experiment - Gradio Interface
Interactive classroom simulation with live visualizations.
"""

import os
import sys
import json
import time
import numpy as np
import gradio as gr
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from collections import defaultdict
from datetime import datetime

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from simulation.llm_student import LLMStudent, generate_llm_students
from ai_agents.teaching_policy import TeachingPolicy, StaticPolicy, TeachingAction

# CS 70 Graph Theory Concepts and Questions
CS70_CONCEPTS = [
    "bfs_traversal", "dfs_traversal", "graph_connectivity",
    "cycle_detection", "tree_properties", "bipartite_graphs"
]

CS70_QUESTIONS = [
    {
        "concept": "bfs_traversal",
        "difficulty": 0.4,
        "prompt": "In BFS starting from vertex A, which data structure determines the order vertices are visited?",
        "options": ["A. Queue (FIFO)", "B. Stack (LIFO)", "C. Priority Queue", "D. Hash Set"],
        "correct_answer": "A",
    },
    {
        "concept": "dfs_traversal",
        "difficulty": 0.45,
        "prompt": "When performing DFS on a graph, a vertex is marked as visited:",
        "options": ["A. When first discovered", "B. When all neighbors explored", "C. When popped from stack", "D. Never"],
        "correct_answer": "A",
    },
    {
        "concept": "graph_connectivity",
        "difficulty": 0.5,
        "prompt": "A directed graph with n vertices is strongly connected if:",
        "options": ["A. Path from every vertex to every other", "B. Underlying undirected is connected", "C. Has n-1 edges", "D. Has no cycles"],
        "correct_answer": "A",
    },
    {
        "concept": "cycle_detection",
        "difficulty": 0.55,
        "prompt": "To detect a cycle in an undirected graph using DFS, we check if:",
        "options": ["A. Visit vertex in current path (not parent)", "B. Any vertex has >1 neighbor", "C. Edges = vertices", "D. Can return to start"],
        "correct_answer": "A",
    },
    {
        "concept": "tree_properties",
        "difficulty": 0.5,
        "prompt": "Which statement is TRUE about a tree with n vertices?",
        "options": ["A. Exactly n-1 edges, connected", "B. Exactly n edges, no cycles", "C. Must have a root", "D. Every vertex degree ≥2"],
        "correct_answer": "A",
    },
    {
        "concept": "bipartite_graphs",
        "difficulty": 0.6,
        "prompt": "A graph is bipartite if and only if:",
        "options": ["A. No odd-length cycles", "B. 2-colorable", "C. Both A and B", "D. Even number of vertices"],
        "correct_answer": "C",
    },
]


class ExperimentState:
    """Manages experiment state across Gradio interface."""
    
    def __init__(self):
        self.students = []
        self.current_question_idx = 0
        self.results = []
        self.policy = None
        self.session_log = []
        
    def reset(self, num_students, distribution, policy_type, use_llm):
        self.students = generate_llm_students(num_students, CS70_CONCEPTS, distribution)
        self.current_question_idx = 0
        self.results = []
        self.session_log = []
        
        if policy_type == "static":
            self.policy = StaticPolicy()
        else:
            self.policy = TeachingPolicy(name="adaptive")
        
        self.use_llm = use_llm
        return f"✅ Initialized {num_students} students ({distribution} distribution) with {policy_type} policy"


# Global state
state = ExperimentState()


def initialize_session(num_students, distribution, policy_type, use_llm):
    """Initialize a new simulation session."""
    msg = state.reset(int(num_students), distribution, policy_type, use_llm)
    
    # Create initial student distribution plot
    fig = create_student_distribution_plot()
    
    return msg, fig, "", create_empty_results_plot(), create_empty_actions_plot()


def create_student_distribution_plot():
    """Create plot showing student mastery distribution."""
    if not state.students:
        return go.Figure()
    
    # Collect mastery data
    data = []
    for student in state.students:
        for concept, mastery in student.mastery.items():
            data.append({
                "Student": student.name,
                "Concept": concept.replace("_", " ").title(),
                "Mastery": mastery,
                "Personality": student.personality
            })
    
    # Create heatmap
    students = [s.name for s in state.students]
    concepts = [c.replace("_", " ").title() for c in CS70_CONCEPTS]
    
    z = [[state.students[i].mastery.get(CS70_CONCEPTS[j], 0.5) 
          for j in range(len(CS70_CONCEPTS))] 
         for i in range(len(state.students))]
    
    fig = go.Figure(data=go.Heatmap(
        z=z,
        x=concepts,
        y=[f"S{i+1}" for i in range(len(students))],
        colorscale='RdYlGn',
        zmin=0, zmax=1,
        colorbar=dict(title="Mastery")
    ))
    
    fig.update_layout(
        title="Initial Student Mastery Distribution",
        xaxis_title="Concept",
        yaxis_title="Student",
        height=400
    )
    
    return fig


def run_single_question():
    """Run the next question in the session."""
    if state.current_question_idx >= len(CS70_QUESTIONS):
        return "🏁 Session complete! All questions answered.", None, None, None
    
    question = CS70_QUESTIONS[state.current_question_idx]
    
    # Collect responses
    responses = []
    for student in state.students:
        response = student.answer_question(question, use_llm=state.use_llm)
        responses.append(response)
    
    # Calculate metrics
    correctness = sum(1 for r in responses if r["is_correct"]) / len(responses)
    avg_confidence = sum(r["confidence"] for r in responses) / len(responses)
    
    # Calculate entropy
    counts = defaultdict(int)
    for r in responses:
        counts[r["answer"]] += 1
    total = len(responses)
    entropy = 0
    for count in counts.values():
        if count > 0:
            p = count / total
            entropy -= p * np.log2(p)
    max_entropy = np.log2(4)
    entropy = entropy / max_entropy if max_entropy > 0 else 0
    
    q_result = {
        "question_idx": state.current_question_idx,
        "concept": question["concept"],
        "difficulty": question["difficulty"],
        "correctness_rate": correctness,
        "avg_confidence": avg_confidence,
        "entropy": entropy,
        "responses": responses
    }
    
    # Get policy decision
    action = state.policy.decide_action(q_result, use_llm=state.use_llm)
    q_result["action"] = action["action"].value
    q_result["action_reason"] = action.get("reason", "")
    
    # Simulate learning
    if action["action"] == TeachingAction.PEER_DISCUSSION:
        for student in state.students:
            if any(r["student_id"] == student.id and not r["is_correct"] for r in responses):
                student.learn_from_discussion(question["concept"], "", [])
    elif action["action"] == TeachingAction.REMEDIATE:
        for student in state.students:
            delta = 0.05 + (0.1 * (1 - student.mastery.get(question["concept"], 0.5)))
            student.update_mastery(question["concept"], delta)
    
    state.results.append(q_result)
    state.current_question_idx += 1
    
    # Create log entry
    log_entry = f"""
### Question {state.current_question_idx}: {question['concept'].replace('_', ' ').title()}

**Prompt:** {question['prompt']}

**Results:**
- Correctness: {correctness:.1%}
- Confidence: {avg_confidence:.1%}
- Entropy: {entropy:.2f}

**Policy Decision:** {action['action'].value}
> {action.get('reason', 'No reason provided')}

---
"""
    state.session_log.append(log_entry)
    
    # Create plots
    results_fig = create_results_plot()
    actions_fig = create_actions_plot()
    responses_fig = create_response_distribution_plot(q_result)
    
    return "".join(state.session_log), results_fig, actions_fig, responses_fig


def run_full_session():
    """Run all remaining questions."""
    while state.current_question_idx < len(CS70_QUESTIONS):
        run_single_question()
    
    # Final summary
    avg_correctness = np.mean([r["correctness_rate"] for r in state.results])
    discussion_rate = sum(1 for r in state.results if r["action"] == "peer_discussion") / len(state.results)
    
    summary = f"""
## 📊 Session Complete!

| Metric | Value |
|--------|-------|
| Questions | {len(state.results)} |
| Avg Correctness | {avg_correctness:.1%} |
| Discussion Rate | {discussion_rate:.1%} |
"""
    state.session_log.append(summary)
    
    return "".join(state.session_log), create_results_plot(), create_actions_plot(), create_final_mastery_plot()


def create_results_plot():
    """Create plot showing question results over time."""
    if not state.results:
        return create_empty_results_plot()
    
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True,
                       subplot_titles=("Correctness & Confidence", "Response Entropy"))
    
    x = list(range(1, len(state.results) + 1))
    correctness = [r["correctness_rate"] for r in state.results]
    confidence = [r["avg_confidence"] for r in state.results]
    entropy = [r["entropy"] for r in state.results]
    
    # Correctness and confidence
    fig.add_trace(go.Scatter(x=x, y=correctness, mode='lines+markers', 
                            name='Correctness', line=dict(color='#0ea5e9', width=3)), row=1, col=1)
    fig.add_trace(go.Scatter(x=x, y=confidence, mode='lines+markers',
                            name='Confidence', line=dict(color='#8b5cf6', width=2, dash='dash')), row=1, col=1)
    
    # Discussion zone
    fig.add_hrect(y0=0.3, y1=0.7, fillcolor="green", opacity=0.1, 
                  annotation_text="Discussion Zone", row=1, col=1)
    
    # Entropy
    fig.add_trace(go.Scatter(x=x, y=entropy, mode='lines+markers',
                            name='Entropy', line=dict(color='#f59e0b', width=2)), row=2, col=1)
    
    fig.update_layout(height=400, showlegend=True, title="Session Progress")
    fig.update_xaxes(title_text="Question #", row=2, col=1)
    fig.update_yaxes(range=[0, 1])
    
    return fig


def create_actions_plot():
    """Create pie chart of actions taken."""
    if not state.results:
        return create_empty_actions_plot()
    
    actions = defaultdict(int)
    for r in state.results:
        actions[r.get("action", "unknown")] += 1
    
    fig = go.Figure(data=[go.Pie(
        labels=list(actions.keys()),
        values=list(actions.values()),
        hole=0.4,
        marker_colors=['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
    )])
    
    fig.update_layout(title="Teaching Actions", height=300)
    return fig


def create_response_distribution_plot(q_result):
    """Create bar chart of response distribution."""
    responses = q_result.get("responses", [])
    counts = defaultdict(int)
    for r in responses:
        counts[r["answer"]] += 1
    
    options = ["A", "B", "C", "D"]
    values = [counts.get(opt, 0) for opt in options]
    
    # Color correct answer differently
    question = CS70_QUESTIONS[q_result["question_idx"]]
    colors = ['#22c55e' if opt == question["correct_answer"] else '#94a3b8' for opt in options]
    
    fig = go.Figure(data=[go.Bar(x=options, y=values, marker_color=colors)])
    fig.update_layout(title=f"Response Distribution (Q{q_result['question_idx']+1})", 
                     xaxis_title="Answer", yaxis_title="Count", height=300)
    return fig


def create_final_mastery_plot():
    """Create plot comparing initial vs final mastery."""
    if not state.students:
        return go.Figure()
    
    concepts = [c.replace("_", " ").title() for c in CS70_CONCEPTS]
    final_mastery = [np.mean([s.mastery.get(c, 0.5) for s in state.students]) for c in CS70_CONCEPTS]
    
    fig = go.Figure(data=[go.Bar(x=concepts, y=final_mastery, marker_color='#0ea5e9')])
    fig.update_layout(title="Final Class Mastery", xaxis_title="Concept", 
                     yaxis_title="Average Mastery", yaxis_range=[0, 1], height=300)
    fig.add_hline(y=0.5, line_dash="dash", line_color="gray", annotation_text="Baseline")
    
    return fig


def create_empty_results_plot():
    fig = go.Figure()
    fig.update_layout(title="Session Progress (waiting...)", height=400)
    return fig


def create_empty_actions_plot():
    fig = go.Figure()
    fig.update_layout(title="Teaching Actions (waiting...)", height=300)
    return fig


def create_student_cluster_plot():
    """Create clustering visualization of students."""
    if not state.students or not state.results:
        return go.Figure()
    
    # Collect student performance data
    student_data = defaultdict(lambda: {"correct": 0, "total": 0, "confidence": []})
    
    for r in state.results:
        for resp in r.get("responses", []):
            sid = resp["student_id"]
            student_data[sid]["correct"] += 1 if resp["is_correct"] else 0
            student_data[sid]["total"] += 1
            student_data[sid]["confidence"].append(resp["confidence"])
    
    x, y, colors, texts = [], [], [], []
    for sid, data in student_data.items():
        if data["total"] > 0:
            correctness = data["correct"] / data["total"]
            confidence = np.mean(data["confidence"])
            student = next((s for s in state.students if s.id == sid), None)
            
            x.append(correctness)
            y.append(confidence)
            colors.append(student.personality if student else "unknown")
            texts.append(f"S{sid}")
    
    fig = px.scatter(x=x, y=y, color=colors, text=texts,
                    labels={"x": "Correctness", "y": "Confidence", "color": "Personality"})
    fig.update_traces(textposition="top center", marker=dict(size=12))
    fig.update_layout(title="Student Performance Clusters", height=400)
    
    return fig


# Build Gradio Interface
with gr.Blocks(title="Quizly - CS70 Graphs Experiment", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🎓 Quizly - AI Classroom Simulation
    ## CS 70 Graphs Experiment
    
    Run simulated classroom sessions comparing **static** vs **adaptive** teaching policies.
    """)
    
    with gr.Row():
        with gr.Column(scale=1):
            gr.Markdown("### ⚙️ Configuration")
            num_students = gr.Slider(10, 50, value=30, step=5, label="Number of Students")
            distribution = gr.Dropdown(
                ["realistic", "bimodal", "struggling", "uniform"],
                value="realistic",
                label="Student Distribution"
            )
            policy_type = gr.Dropdown(
                ["adaptive", "static"],
                value="adaptive",
                label="Teaching Policy"
            )
            use_llm = gr.Checkbox(value=True, label="Use LLM for rationales")
            
            init_btn = gr.Button("🚀 Initialize Session", variant="primary")
            status = gr.Textbox(label="Status", interactive=False)
            
            gr.Markdown("### 🎮 Controls")
            step_btn = gr.Button("▶️ Run Next Question")
            run_all_btn = gr.Button("⏩ Run Full Session", variant="secondary")
        
        with gr.Column(scale=2):
            gr.Markdown("### 📊 Student Distribution")
            student_dist_plot = gr.Plot(label="Initial Mastery")
    
    with gr.Row():
        with gr.Column(scale=2):
            gr.Markdown("### 📝 Session Log")
            session_log = gr.Markdown("")
        
        with gr.Column(scale=1):
            gr.Markdown("### 📈 Live Metrics")
            results_plot = gr.Plot(label="Progress")
            actions_plot = gr.Plot(label="Actions")
    
    with gr.Row():
        response_plot = gr.Plot(label="Last Response Distribution")
    
    # Event handlers
    init_btn.click(
        initialize_session,
        inputs=[num_students, distribution, policy_type, use_llm],
        outputs=[status, student_dist_plot, session_log, results_plot, actions_plot]
    )
    
    step_btn.click(
        run_single_question,
        outputs=[session_log, results_plot, actions_plot, response_plot]
    )
    
    run_all_btn.click(
        run_full_session,
        outputs=[session_log, results_plot, actions_plot, response_plot]
    )


if __name__ == "__main__":
    print("🚀 Starting Quizly CS70 Graphs Experiment...")
    print("   Open http://localhost:7861 in your browser")
    demo.launch(server_port=7861, share=False)

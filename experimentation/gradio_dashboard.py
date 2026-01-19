#!/usr/bin/env python3
"""
Quizly Simulation Dashboard - Gradio Interface
===============================================
Interactive dashboard to view simulation results, run experiments, and explore debate transcripts.
"""

import os
import json
import glob
from datetime import datetime
from typing import Dict, List, Any, Tuple

import gradio as gr
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import numpy as np

# Set API key
os.environ['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY', '')

from simulation.reasoning_student import (
    ReasoningStudent,
    generate_reasoning_students,
    Misconception,
    PERSONA_TEMPLATES
)
from simulation.rigorous_experiment import CS70_QUESTIONS, RigorousExperiment

# Paths
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "experiments", "results")
LESSON_DIR = os.path.join(os.path.dirname(__file__), "lesson_simulation_output")
VIZ_DIR = os.path.join(LESSON_DIR, "visualizations")


# ============================================================================
# DATA LOADING FUNCTIONS
# ============================================================================

def load_latest_lesson_results() -> Dict:
    """Load latest lesson simulation results."""
    transcript_path = os.path.join(LESSON_DIR, "lesson_transcript.json")
    if os.path.exists(transcript_path):
        with open(transcript_path) as f:
            return json.load(f)
    return {}


def load_all_experiments() -> List[Dict]:
    """Load all rigorous experiment results."""
    experiments = []
    for filepath in sorted(glob.glob(os.path.join(RESULTS_DIR, "rigorous_*.json")), reverse=True):
        if "_debates" in filepath or "_learning" in filepath:
            continue
        with open(filepath) as f:
            data = json.load(f)
            experiments.append(data)
    return experiments[:10]  # Last 10 experiments


def get_visualization_paths() -> Dict[str, str]:
    """Get paths to visualization images."""
    return {
        "learning_gains": os.path.join(VIZ_DIR, "learning_gains.png"),
        "performance_timeline": os.path.join(VIZ_DIR, "performance_timeline.png"),
        "debate_outcomes": os.path.join(VIZ_DIR, "debate_outcomes.png"),
        "student_distribution": os.path.join(VIZ_DIR, "student_distribution.png")
    }


# ============================================================================
# DASHBOARD COMPONENTS
# ============================================================================

def create_summary_html(data: Dict) -> str:
    """Create HTML summary of lesson results."""
    if not data:
        return "<p>No lesson results found. Run a simulation first!</p>"
    
    summary = data.get("summary", {})
    config = data.get("config", {})
    
    avg_gain = summary.get("avg_learning_gain", 0) * 100
    discussion_rate = summary.get("discussion_rate", 0) * 100
    total_debates = summary.get("total_debates", 0)
    
    html = f"""
    <div style="font-family: system-ui; padding: 20px;">
        <h2 style="color: #2ecc71;">📊 Lesson Summary</h2>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 28px; font-weight: bold;">{data.get('num_students', 0)}</div>
                <div style="font-size: 14px; opacity: 0.9;">Students</div>
            </div>
            <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 20px; border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 28px; font-weight: bold;">+{avg_gain:.1f}%</div>
                <div style="font-size: 14px; opacity: 0.9;">Learning Gain</div>
            </div>
            <div style="background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%); padding: 20px; border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 28px; font-weight: bold;">{total_debates}</div>
                <div style="font-size: 14px; opacity: 0.9;">Debates</div>
            </div>
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 28px; font-weight: bold;">{discussion_rate:.0f}%</div>
                <div style="font-size: 14px; opacity: 0.9;">Discussion Rate</div>
            </div>
        </div>
        
        <h3 style="color: #333;">📋 Question Results</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Question</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Before</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">After</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Gain</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Action</th>
            </tr>
    """
    
    for q in data.get("question_results", []):
        initial = q.get("initial_rate", 0) * 100
        final = q.get("final_rate", 0) * 100
        gain = q.get("learning_gain", 0) * 100
        action = q.get("action", "MOVE_ON")
        
        gain_color = "#27ae60" if gain > 0 else ("#c0392b" if gain < 0 else "#95a5a6")
        action_badge = "🗣️ Discussion" if action == "PEER_DISCUSSION" else "➡️ Move On"
        
        html += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">{q.get('concept', 'Unknown').replace('_', ' ').title()}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">{initial:.0f}%</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">{final:.0f}%</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6; color: {gain_color}; font-weight: bold;">{gain:+.1f}%</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #dee2e6;">{action_badge}</td>
            </tr>
        """
    
    html += """
        </table>
    </div>
    """
    return html


def create_experiments_table(experiments: List[Dict]) -> str:
    """Create HTML table of past experiments."""
    if not experiments:
        return "<p>No experiments found.</p>"
    
    html = """
    <div style="font-family: system-ui;">
        <h3>📁 Recent Experiments</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left;">ID</th>
                <th style="padding: 10px; text-align: center;">Policy</th>
                <th style="padding: 10px; text-align: center;">Students</th>
                <th style="padding: 10px; text-align: center;">Correctness</th>
                <th style="padding: 10px; text-align: center;">Learning Gain</th>
                <th style="padding: 10px; text-align: center;">Debates</th>
            </tr>
    """
    
    for exp in experiments:
        policy_color = "#27ae60" if exp.get("policy_name") == "adaptive" else "#e74c3c"
        html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 12px;">{exp.get('experiment_id', 'N/A')[:30]}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">
                    <span style="background: {policy_color}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px;">
                        {exp.get('policy_name', 'N/A')}
                    </span>
                </td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">{exp.get('num_students', 0)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">{exp.get('avg_correctness', 0)*100:.1f}%</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee; color: #27ae60; font-weight: bold;">
                    {exp.get('genuine_learning_gain', 0)*100:+.2f}%
                </td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">{exp.get('total_debates', 0)}</td>
            </tr>
        """
    
    html += "</table></div>"
    return html


def run_new_simulation(num_students: int, distribution: str, progress=gr.Progress()):
    """Run a new simulation and return results."""
    progress(0, desc="Initializing students...")
    
    from run_full_lesson import FullLessonSimulation, LESSON_CONFIG
    
    config = LESSON_CONFIG.copy()
    config["num_students"] = num_students
    config["distribution"] = distribution
    
    progress(0.1, desc=f"Created {num_students} {distribution} students...")
    
    sim = FullLessonSimulation(config)
    
    progress(0.2, desc="Running lesson simulation...")
    
    # Run the simulation (simplified for Gradio)
    for i, question in enumerate(sim.questions):
        progress((0.2 + 0.6 * i / len(sim.questions)), desc=f"Question {i+1}/{len(sim.questions)}...")
        sim.run_question(i + 1, question)
    
    progress(0.85, desc="Generating visualizations...")
    sim.print_lesson_summary()
    sim.generate_visualizations()
    sim.save_results()
    
    progress(1.0, desc="Complete!")
    
    # Reload and return
    data = load_latest_lesson_results()
    viz = get_visualization_paths()
    
    return (
        create_summary_html(data),
        viz.get("learning_gains"),
        viz.get("performance_timeline"),
        viz.get("debate_outcomes"),
        viz.get("student_distribution")
    )


def refresh_dashboard():
    """Refresh dashboard with latest data."""
    data = load_latest_lesson_results()
    experiments = load_all_experiments()
    viz = get_visualization_paths()
    
    return (
        create_summary_html(data),
        create_experiments_table(experiments),
        viz.get("learning_gains") if os.path.exists(viz.get("learning_gains", "")) else None,
        viz.get("performance_timeline") if os.path.exists(viz.get("performance_timeline", "")) else None,
        viz.get("debate_outcomes") if os.path.exists(viz.get("debate_outcomes", "")) else None,
        viz.get("student_distribution") if os.path.exists(viz.get("student_distribution", "")) else None
    )


# ============================================================================
# GRADIO APP
# ============================================================================

def create_app():
    """Create the Gradio app."""
    
    with gr.Blocks(
        title="Quizly Simulation Dashboard",
        theme=gr.themes.Soft(primary_hue="green"),
        css="""
        .gradio-container { max-width: 1400px !important; }
        .tab-nav button { font-size: 16px !important; }
        """
    ) as app:
        
        gr.Markdown("""
        # 🎓 Quizly Peer Instruction Simulation Dashboard
        
        Explore AI-powered peer instruction simulations with LLM-driven student reasoning and debates.
        """)
        
        with gr.Tabs():
            # Tab 1: Latest Lesson Results
            with gr.TabItem("📊 Lesson Results", id=1):
                with gr.Row():
                    refresh_btn = gr.Button("🔄 Refresh", variant="secondary", size="sm")
                
                summary_html = gr.HTML(label="Summary")
                
                gr.Markdown("### 📈 Visualizations")
                with gr.Row():
                    with gr.Column():
                        learning_img = gr.Image(label="Learning Gains", type="filepath")
                    with gr.Column():
                        timeline_img = gr.Image(label="Performance Timeline", type="filepath")
                
                with gr.Row():
                    with gr.Column():
                        debate_img = gr.Image(label="Debate Outcomes", type="filepath")
                    with gr.Column():
                        student_img = gr.Image(label="Student Distribution", type="filepath")
            
            # Tab 2: Run New Simulation
            with gr.TabItem("🚀 Run Simulation", id=2):
                gr.Markdown("""
                ### Configure and Run a New Lesson Simulation
                
                Choose the class composition and number of students to simulate a complete peer instruction lesson.
                """)
                
                with gr.Row():
                    num_students = gr.Slider(
                        minimum=6, maximum=30, value=12, step=2,
                        label="Number of Students"
                    )
                    distribution = gr.Dropdown(
                        choices=["struggling", "realistic", "advanced"],
                        value="struggling",
                        label="Class Distribution"
                    )
                
                run_btn = gr.Button("▶️ Run Full Lesson Simulation", variant="primary", size="lg")
                
                gr.Markdown("### Results")
                sim_summary = gr.HTML()
                
                with gr.Row():
                    sim_learning = gr.Image(label="Learning Gains")
                    sim_timeline = gr.Image(label="Performance Timeline")
                
                with gr.Row():
                    sim_debate = gr.Image(label="Debate Outcomes")
                    sim_students = gr.Image(label="Student Distribution")
                
                run_btn.click(
                    fn=run_new_simulation,
                    inputs=[num_students, distribution],
                    outputs=[sim_summary, sim_learning, sim_timeline, sim_debate, sim_students]
                )
            
            # Tab 3: Experiment History
            with gr.TabItem("📁 History", id=3):
                experiments_html = gr.HTML()
                refresh_hist_btn = gr.Button("🔄 Refresh History")
                
                refresh_hist_btn.click(
                    fn=lambda: create_experiments_table(load_all_experiments()),
                    outputs=[experiments_html]
                )
            
            # Tab 4: Question Bank
            with gr.TabItem("❓ Questions", id=4):
                gr.Markdown("### CS70 Graph Theory Question Bank")
                
                questions_md = ""
                for i, q in enumerate(CS70_QUESTIONS, 1):
                    questions_md += f"""
**{i}. {q['concept'].replace('_', ' ').title()}** (Difficulty: {q['difficulty']})

{q['prompt']}

"""
                    for opt in q['options']:
                        marker = "✓" if opt.startswith(q['correct_answer']) else " "
                        questions_md += f"- {marker} {opt}\n"
                    questions_md += "\n---\n"
                
                gr.Markdown(questions_md)
            
            # Tab 5: Student Personas
            with gr.TabItem("👥 Personas", id=5):
                gr.Markdown("### Student Persona Templates")
                
                for persona, details in PERSONA_TEMPLATES.items():
                    misconceptions = ", ".join([m.name for m in details.get("common_misconceptions", [])])
                    gr.Markdown(f"""
**{persona.title()}**
- Description: {details['description']}
- Knowledge Level: {details['knowledge_level']:.0%}
- Confidence Bias: {details['confidence_bias']:+.0%}
- Susceptibility to Persuasion: {details['susceptibility_to_persuasion']:.0%}
- Common Misconceptions: {misconceptions or 'None'}

---
""")
        
        # Initial load
        app.load(
            fn=refresh_dashboard,
            outputs=[summary_html, experiments_html, learning_img, timeline_img, debate_img, student_img]
        )
        
        refresh_btn.click(
            fn=refresh_dashboard,
            outputs=[summary_html, experiments_html, learning_img, timeline_img, debate_img, student_img]
        )
    
    return app


if __name__ == "__main__":
    app = create_app()
    app.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True
    )

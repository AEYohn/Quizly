#!/usr/bin/env python3
"""
Quizly FULL FLOW Simulation Dashboard
=====================================
Complete end-to-end peer instruction simulation:
1. Session Planning (AI generates question plan)
2. Question Generation (AI creates questions)
3. Student Responses (LLM reasoning)
4. Teaching Policy Decisions (AI decides actions)
5. Peer Discussions & Debates
6. Exit Tickets (personalized follow-ups)
"""

import os
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Tuple

import gradio as gr
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import numpy as np

# Set API key
os.environ['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY', '')

# Import all AI agents
from ai_agents.session_planner import SessionPlanner
from ai_agents.question_designer import QuestionDesigner
from ai_agents.teaching_policy import TeachingPolicy
from ai_agents.exit_ticket_agent import ExitTicketAgent

# Import simulation components
from simulation.reasoning_student import (
    ReasoningStudent, 
    generate_reasoning_students,
    PERSONA_TEMPLATES,
    Misconception
)
from simulation.debate_engine import DebateEngine
from simulation.learning_tracker import LearningTracker


# ============================================================================
# FULL FLOW ORCHESTRATOR
# ============================================================================

class FullFlowSimulation:
    """Orchestrates the entire peer instruction flow."""
    
    def __init__(self, topic: str, concepts: List[str], num_students: int = 10, 
                 distribution: str = "realistic"):
        # Initialize all AI agents
        self.session_planner = SessionPlanner()
        self.question_designer = QuestionDesigner()
        self.teaching_policy = TeachingPolicy()
        self.exit_ticket_agent = ExitTicketAgent()
        
        # Initialize simulation components
        self.debate_engine = DebateEngine(max_turns=2)
        self.learning_tracker = LearningTracker(use_llm_grading=True)
        
        # Configuration
        self.topic = topic
        self.concepts = concepts
        self.num_students = num_students
        self.distribution = distribution
        
        # State
        self.students = None
        self.session_plan = None
        self.questions = []
        self.question_results = []
        self.debates = []
        self.exit_tickets = []
        self.log = []
    
    def log_event(self, phase: str, message: str, data: Any = None):
        """Log an event in the simulation."""
        self.log.append({
            "timestamp": datetime.now().isoformat(),
            "phase": phase,
            "message": message,
            "data": data
        })
    
    def run_phase_1_planning(self) -> Dict:
        """Phase 1: Session Planning - AI generates question plan."""
        self.log_event("PLANNING", f"Starting session planning for {self.topic}")
        
        self.session_plan = self.session_planner.generate_plan(
            topic=self.topic,
            concepts=self.concepts,
            time_budget_minutes=30,
            difficulty_curve="gradual"
        )
        
        self.log_event("PLANNING", f"Generated plan with {len(self.session_plan.get('questions', []))} questions")
        return self.session_plan
    
    def run_phase_2_questions(self) -> List[Dict]:
        """Phase 2: Question Generation - Enhance questions with AI."""
        self.log_event("QUESTIONS", "Designing questions with AI")
        
        self.questions = []
        for i, q_spec in enumerate(self.session_plan.get("questions", [])):
            # Use QuestionDesigner to enhance each question
            enhanced = self.question_designer.design_question(
                concept=q_spec.get("concept", self.concepts[0]),
                difficulty=q_spec.get("difficulty", 0.5),
                question_type="mcq"
            )
            
            # Merge with plan spec
            question = {
                "id": f"q_{i+1}",
                "concept": q_spec.get("concept", self.concepts[0]),
                "difficulty": q_spec.get("difficulty", 0.5),
                "prompt": enhanced.get("prompt", q_spec.get("question_prompt", "")),
                "options": enhanced.get("options", q_spec.get("options", [])),
                "correct_answer": enhanced.get("correct_answer", q_spec.get("correct_answer", "A")),
                "explanation": enhanced.get("explanation", ""),
                "misconceptions_targeted": enhanced.get("misconceptions_targeted", [])
            }
            self.questions.append(question)
        
        self.log_event("QUESTIONS", f"Designed {len(self.questions)} questions")
        return self.questions
    
    def run_phase_3_students(self) -> List[Dict]:
        """Phase 3: Initialize Student Cohort."""
        self.log_event("STUDENTS", f"Creating {self.num_students} {self.distribution} students")
        
        self.students = generate_reasoning_students(
            self.num_students, 
            self.concepts,
            distribution=self.distribution
        )
        
        student_summaries = [
            {
                "id": s.id,
                "name": s.name,
                "persona": s.persona_type,
                "misconceptions": [m.name for m in s.active_misconceptions]
            }
            for s in self.students
        ]
        
        self.log_event("STUDENTS", f"Created {len(self.students)} students", student_summaries)
        return student_summaries
    
    def run_phase_4_lesson(self, progress_callback=None) -> List[Dict]:
        """Phase 4: Run the lesson with teaching policy decisions."""
        self.log_event("LESSON", "Starting lesson simulation")
        
        student_session_responses = {s.id: [] for s in self.students}
        
        for q_idx, question in enumerate(self.questions):
            if progress_callback:
                progress_callback(q_idx / len(self.questions), 
                                f"Question {q_idx+1}/{len(self.questions)}: {question['concept']}")
            
            self.log_event("LESSON", f"Question {q_idx+1}: {question['concept']}")
            
            # Collect student responses
            responses = {}
            correct_count = 0
            answer_distribution = {}
            
            for student in self.students:
                answer, reasoning = student.reason_about_question(question)
                is_correct = answer.startswith(question["correct_answer"][0])
                if is_correct:
                    correct_count += 1
                
                answer_key = answer[0] if answer else "?"
                answer_distribution[answer_key] = answer_distribution.get(answer_key, 0) + 1
                
                responses[student.id] = {
                    "answer": answer,
                    "reasoning": reasoning,
                    "is_correct": is_correct,
                    "confidence": reasoning.confidence,
                    "rationale": reasoning.conclusion
                }
                
                # Track for exit tickets
                student_session_responses[student.id].append({
                    "concept": question["concept"],
                    "is_correct": is_correct,
                    "confidence": reasoning.confidence
                })
                
                time.sleep(0.05)  # Rate limiting
            
            initial_rate = correct_count / len(self.students)
            
            # Teaching Policy Decision
            question_result = {
                "question_id": question["id"],
                "concept": question["concept"],
                "answer_distribution": answer_distribution,
                "correctness_rate": initial_rate,
                "avg_confidence": sum(r["confidence"] for r in responses.values()) / len(responses)
            }
            
            policy_decision = self.teaching_policy.decide_action(
                question_result,
                use_llm=True
            )
            
            action = policy_decision.get("action", "move_on")
            
            self.log_event("POLICY", f"Teaching decision: {action}", policy_decision)
            
            # Execute action
            final_responses = responses.copy()
            debate_results = []
            
            if action == "peer_discussion":
                # Run peer discussions
                pairs = self.debate_engine.pair_students(self.students, 
                    {sid: (r["answer"], r["reasoning"]) for sid, r in responses.items()})
                
                for student_a, student_b in pairs:
                    resp_a = responses[student_a.id]
                    resp_b = responses[student_b.id]
                    
                    if resp_a["answer"][0] != resp_b["answer"][0]:
                        debate = self.debate_engine.run_debate(
                            student_a, student_b, question,
                            {sid: (r["answer"], r["reasoning"]) for sid, r in responses.items()}
                        )
                        
                        debate_results.append({
                            "student_a": student_a.name,
                            "student_b": student_b.name,
                            "outcome": debate._compute_outcome(),
                            "turns": len(debate.turns)
                        })
                        
                        self.debates.append(debate)
                        
                        # Update final responses
                        final_responses[student_a.id]["answer"] = debate.final_positions.get(
                            student_a.id, resp_a["answer"])
                        final_responses[student_b.id]["answer"] = debate.final_positions.get(
                            student_b.id, resp_b["answer"])
            
            # Calculate final results
            final_correct = sum(
                1 for r in final_responses.values()
                if r["answer"].startswith(question["correct_answer"][0])
            )
            final_rate = final_correct / len(self.students)
            
            result = {
                "question_id": question["id"],
                "concept": question["concept"],
                "initial_rate": initial_rate,
                "final_rate": final_rate,
                "learning_gain": final_rate - initial_rate,
                "action": action,
                "action_reason": policy_decision.get("reasoning", ""),
                "debates": debate_results,
                "num_debates": len(debate_results)
            }
            
            self.question_results.append(result)
            self.log_event("LESSON", f"Q{q_idx+1} complete: {initial_rate:.0%} → {final_rate:.0%}")
        
        # Store responses for exit tickets
        self._student_session_responses = student_session_responses
        
        return self.question_results
    
    def run_phase_5_exit_tickets(self) -> List[Dict]:
        """Phase 5: Generate personalized exit tickets."""
        self.log_event("EXIT_TICKETS", "Generating personalized exit tickets")
        
        self.exit_tickets = self.exit_ticket_agent.batch_generate(
            self._student_session_responses,
            self.concepts
        )
        
        self.log_event("EXIT_TICKETS", f"Generated {len(self.exit_tickets)} exit tickets")
        return self.exit_tickets
    
    def get_summary(self) -> Dict:
        """Get overall simulation summary."""
        if not self.question_results:
            return {}
        
        avg_initial = sum(r["initial_rate"] for r in self.question_results) / len(self.question_results)
        avg_final = sum(r["final_rate"] for r in self.question_results) / len(self.question_results)
        
        return {
            "topic": self.topic,
            "concepts": self.concepts,
            "num_students": self.num_students,
            "num_questions": len(self.questions),
            "avg_initial_correctness": avg_initial,
            "avg_final_correctness": avg_final,
            "learning_gain": avg_final - avg_initial,
            "total_debates": len(self.debates),
            "discussion_rate": sum(1 for r in self.question_results if r["action"] == "peer_discussion") / len(self.question_results),
            "exit_tickets_generated": len(self.exit_tickets)
        }


# ============================================================================
# GRADIO UI COMPONENTS
# ============================================================================

def create_summary_cards(summary: Dict) -> str:
    """Create HTML summary cards."""
    if not summary:
        return "<p>Run a simulation to see results.</p>"
    
    gain = summary.get("learning_gain", 0) * 100
    gain_color = "#27ae60" if gain > 0 else "#e74c3c"
    
    return f"""
    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 15px 0;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 10px; color: white; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">{summary.get('num_students', 0)}</div>
            <div style="font-size: 12px;">Students</div>
        </div>
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 15px; border-radius: 10px; color: white; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">{summary.get('num_questions', 0)}</div>
            <div style="font-size: 12px;">Questions</div>
        </div>
        <div style="background: linear-gradient(135deg, {gain_color} 0%, {'#1abc9c' if gain > 0 else '#c0392b'} 100%); padding: 15px; border-radius: 10px; color: white; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">{gain:+.1f}%</div>
            <div style="font-size: 12px;">Learning Gain</div>
        </div>
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 15px; border-radius: 10px; color: white; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">{summary.get('total_debates', 0)}</div>
            <div style="font-size: 12px;">Debates</div>
        </div>
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 15px; border-radius: 10px; color: white; text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">{summary.get('discussion_rate', 0)*100:.0f}%</div>
            <div style="font-size: 12px;">Discussion Rate</div>
        </div>
    </div>
    """


def create_phase_output(phase: str, data: Any) -> str:
    """Format phase output as HTML."""
    if phase == "PLANNING":
        questions = data.get("questions", [])
        html = f"""
        <div style="padding: 10px;">
            <h4>📋 Session Plan: {data.get('topic', 'N/A')}</h4>
            <p>Time Budget: {data.get('time_budget_minutes', 30)} minutes | Questions: {len(questions)}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr style="background: #f8f9fa;">
                    <th style="padding: 8px; text-align: left;">#</th>
                    <th style="padding: 8px; text-align: left;">Concept</th>
                    <th style="padding: 8px; text-align: center;">Difficulty</th>
                </tr>
        """
        for i, q in enumerate(questions, 1):
            diff = q.get("difficulty", 0.5)
            diff_bar = "🟢" if diff < 0.4 else "🟡" if diff < 0.7 else "🔴"
            html += f"""
                <tr>
                    <td style="padding: 8px;">{i}</td>
                    <td style="padding: 8px;">{q.get('concept', 'N/A')}</td>
                    <td style="padding: 8px; text-align: center;">{diff_bar} {diff:.1f}</td>
                </tr>
            """
        html += "</table></div>"
        return html
    
    elif phase == "STUDENTS":
        html = "<div style='padding: 10px;'><h4>👥 Student Roster</h4><div style='display: flex; flex-wrap: wrap; gap: 8px;'>"
        for s in data:
            persona_colors = {"novice": "#e74c3c", "average": "#3498db", "competent": "#27ae60", "overconfident": "#9b59b6"}
            color = persona_colors.get(s.get("persona", ""), "#95a5a6")
            html += f"""
                <div style="background: {color}22; border: 1px solid {color}; border-radius: 6px; padding: 6px 10px; font-size: 12px;">
                    <strong>{s.get('name', 'N/A')}</strong> ({s.get('persona', 'N/A')})
                </div>
            """
        html += "</div></div>"
        return html
    
    elif phase == "RESULTS":
        html = """
        <div style="padding: 10px;">
            <h4>📊 Question Results</h4>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #f8f9fa;">
                    <th style="padding: 8px;">Concept</th>
                    <th style="padding: 8px; text-align: center;">Before</th>
                    <th style="padding: 8px; text-align: center;">After</th>
                    <th style="padding: 8px; text-align: center;">Gain</th>
                    <th style="padding: 8px; text-align: center;">Action</th>
                    <th style="padding: 8px; text-align: center;">Debates</th>
                </tr>
        """
        for r in data:
            gain = r.get("learning_gain", 0) * 100
            gain_color = "#27ae60" if gain > 0 else ("#e74c3c" if gain < 0 else "#95a5a6")
            action_icon = "🗣️" if r.get("action") == "peer_discussion" else "➡️"
            html += f"""
                <tr>
                    <td style="padding: 8px;">{r.get('concept', 'N/A').replace('_', ' ').title()}</td>
                    <td style="padding: 8px; text-align: center;">{r.get('initial_rate', 0)*100:.0f}%</td>
                    <td style="padding: 8px; text-align: center;">{r.get('final_rate', 0)*100:.0f}%</td>
                    <td style="padding: 8px; text-align: center; color: {gain_color}; font-weight: bold;">{gain:+.1f}%</td>
                    <td style="padding: 8px; text-align: center;">{action_icon} {r.get('action', 'N/A')}</td>
                    <td style="padding: 8px; text-align: center;">{r.get('num_debates', 0)}</td>
                </tr>
            """
        html += "</table></div>"
        return html
    
    elif phase == "EXIT_TICKETS":
        html = "<div style='padding: 10px;'><h4>🎟️ Exit Tickets</h4>"
        for ticket in data[:3]:  # Show first 3
            html += f"""
                <div style="background: #f8f9fa; border-radius: 8px; padding: 10px; margin: 8px 0;">
                    <strong>Student {ticket.get('student_id', 'N/A')}</strong> - Focus: {ticket.get('target_concept', 'N/A')}
                    <p style="font-size: 13px; margin: 5px 0;">{ticket.get('micro_lesson', 'N/A')[:100]}...</p>
                    <p style="font-size: 12px; color: #666;">{ticket.get('encouragement', '')}</p>
                </div>
            """
        if len(data) > 3:
            html += f"<p style='color: #666;'>...and {len(data)-3} more exit tickets</p>"
        html += "</div>"
        return html
    
    return f"<pre>{json.dumps(data, indent=2, default=str)[:500]}</pre>"


# Global simulation state
_current_sim = None


def run_full_flow(topic: str, concepts_text: str, num_students: int, 
                  distribution: str, progress=gr.Progress()):
    """Run the complete simulation flow."""
    global _current_sim
    
    concepts = [c.strip() for c in concepts_text.split(",") if c.strip()]
    if not concepts:
        concepts = ["graph traversal", "trees", "shortest paths"]
    
    _current_sim = FullFlowSimulation(
        topic=topic,
        concepts=concepts,
        num_students=num_students,
        distribution=distribution
    )
    
    outputs = []
    
    # Phase 1: Planning
    progress(0.1, desc="🗓️ Phase 1: AI Session Planning...")
    plan = _current_sim.run_phase_1_planning()
    phase1_html = create_phase_output("PLANNING", plan)
    
    # Phase 2: Questions
    progress(0.2, desc="❓ Phase 2: AI Question Generation...")
    questions = _current_sim.run_phase_2_questions()
    
    # Phase 3: Students
    progress(0.3, desc="👥 Phase 3: Creating Student Cohort...")
    students = _current_sim.run_phase_3_students()
    phase3_html = create_phase_output("STUDENTS", students)
    
    # Phase 4: Lesson
    def lesson_progress(frac, msg):
        progress(0.3 + 0.5 * frac, desc=f"📚 Phase 4: {msg}")
    
    results = _current_sim.run_phase_4_lesson(lesson_progress)
    phase4_html = create_phase_output("RESULTS", results)
    
    # Phase 5: Exit Tickets
    progress(0.9, desc="🎟️ Phase 5: Generating Exit Tickets...")
    tickets = _current_sim.run_phase_5_exit_tickets()
    phase5_html = create_phase_output("EXIT_TICKETS", tickets)
    
    # Summary
    progress(1.0, desc="✅ Complete!")
    summary = _current_sim.get_summary()
    summary_html = create_summary_cards(summary)
    
    # Create visualization
    viz_path = create_results_visualization(_current_sim)
    
    return (
        summary_html,
        phase1_html,
        phase3_html,
        phase4_html,
        phase5_html,
        viz_path
    )


def create_results_visualization(sim: FullFlowSimulation) -> str:
    """Create visualization of results."""
    if not sim.question_results:
        return None
    
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    
    # Learning gains bar chart
    ax = axes[0]
    concepts = [r["concept"].replace("_", "\n")[:15] for r in sim.question_results]
    initial = [r["initial_rate"] * 100 for r in sim.question_results]
    final = [r["final_rate"] * 100 for r in sim.question_results]
    
    x = np.arange(len(concepts))
    width = 0.35
    ax.bar(x - width/2, initial, width, label='Before', color='#3498db', alpha=0.8)
    ax.bar(x + width/2, final, width, label='After', color='#27ae60', alpha=0.8)
    ax.set_ylabel('Correctness (%)')
    ax.set_title('Learning Gains by Question')
    ax.set_xticks(x)
    ax.set_xticklabels(concepts, fontsize=8)
    ax.legend()
    ax.set_ylim(0, 110)
    
    # Debate outcomes pie
    ax = axes[1]
    outcomes = {}
    for debate in sim.debates:
        outcome = debate._compute_outcome() if hasattr(debate, '_compute_outcome') else "unknown"
        outcomes[outcome] = outcomes.get(outcome, 0) + 1
    
    if outcomes:
        colors = {"correct_convinced_wrong": "#27ae60", "wrong_convinced_correct": "#e74c3c"}
        pie_colors = [colors.get(o, "#3498db") for o in outcomes.keys()]
        ax.pie(list(outcomes.values()), labels=[o.replace("_", "\n") for o in outcomes.keys()], 
               autopct='%1.0f%%', colors=pie_colors)
        ax.set_title('Debate Outcomes')
    else:
        ax.text(0.5, 0.5, 'No debates', ha='center', va='center')
        ax.set_title('Debate Outcomes')
    
    plt.tight_layout()
    
    viz_path = "/tmp/quizly_full_flow_viz.png"
    plt.savefig(viz_path, dpi=120)
    plt.close()
    
    return viz_path


def create_app():
    """Create the Gradio app."""
    
    with gr.Blocks(
        title="Quizly Full Flow Simulation",
        theme=gr.themes.Soft(primary_hue="green"),
        css="""
        .gradio-container { max-width: 1400px !important; }
        .phase-output { border: 1px solid #e0e0e0; border-radius: 8px; margin: 8px 0; }
        """
    ) as app:
        
        gr.Markdown("""
        # 🎓 Quizly Full Flow Simulation
        
        **Complete end-to-end peer instruction simulation** with all AI agents:
        1. **Session Planning** → AI generates lesson structure
        2. **Question Generation** → AI creates conceptual questions
        3. **Student Simulation** → LLM-powered student reasoning
        4. **Teaching Policy** → AI decides when to trigger discussions
        5. **Peer Debates** → Students argue and learn
        6. **Exit Tickets** → Personalized follow-up micro-lessons
        """)
        
        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("### ⚙️ Configuration")
                topic = gr.Textbox(
                    label="Topic",
                    value="Graph Algorithms (CS 70)",
                    placeholder="e.g., Newton's Laws, Organic Chemistry"
                )
                concepts = gr.Textbox(
                    label="Concepts (comma-separated)",
                    value="BFS, DFS, trees, shortest paths, graph connectivity",
                    placeholder="e.g., momentum, energy, friction"
                )
                num_students = gr.Slider(
                    minimum=6, maximum=24, value=12, step=2,
                    label="Number of Students"
                )
                distribution = gr.Dropdown(
                    choices=["struggling", "realistic", "advanced"],
                    value="struggling",
                    label="Class Distribution"
                )
                
                run_btn = gr.Button("▶️ Run Full Simulation", variant="primary", size="lg")
            
            with gr.Column(scale=2):
                gr.Markdown("### 📊 Summary")
                summary_output = gr.HTML()
                results_viz = gr.Image(label="Results Visualization")
        
        gr.Markdown("---")
        gr.Markdown("### 📋 Phase Outputs")
        
        with gr.Row():
            with gr.Column():
                gr.Markdown("#### 1️⃣ Session Plan")
                phase1_output = gr.HTML(elem_classes=["phase-output"])
            with gr.Column():
                gr.Markdown("#### 2️⃣ Student Roster")
                phase3_output = gr.HTML(elem_classes=["phase-output"])
        
        with gr.Row():
            with gr.Column():
                gr.Markdown("#### 3️⃣ Question Results")
                phase4_output = gr.HTML(elem_classes=["phase-output"])
            with gr.Column():
                gr.Markdown("#### 4️⃣ Exit Tickets")
                phase5_output = gr.HTML(elem_classes=["phase-output"])
        
        run_btn.click(
            fn=run_full_flow,
            inputs=[topic, concepts, num_students, distribution],
            outputs=[summary_output, phase1_output, phase3_output, phase4_output, phase5_output, results_viz]
        )
    
    return app


if __name__ == "__main__":
    app = create_app()
    app.launch(
        server_name="0.0.0.0",
        server_port=7861,  # Different port
        share=False,
        show_error=True
    )

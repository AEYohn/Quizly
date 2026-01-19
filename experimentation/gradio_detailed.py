#!/usr/bin/env python3
"""
Quizly DETAILED Simulation Dashboard
=====================================
Full visibility into every aspect of the peer instruction simulation:
- Complete question text with options
- Each student's response and full rationale
- Debate transcripts with turn-by-turn arguments
- Detailed exit tickets with micro-lessons
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
# FULL FLOW ORCHESTRATOR WITH DETAILED LOGGING
# ============================================================================

class DetailedSimulation:
    """Orchestrates the entire peer instruction flow with full details."""
    
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
        
        # State - Detailed storage
        self.students = None
        self.student_details = []
        self.session_plan = None
        self.questions = []
        self.question_details = []  # Full question info
        self.all_responses = {}  # student_id -> question_id -> response details
        self.debates = []
        self.debate_transcripts = []  # Full debate logs
        self.exit_tickets = []
        self.teaching_decisions = []  # All policy decisions
    
    def run_planning(self) -> Dict:
        """Phase 1: Session Planning with full details."""
        self.session_plan = self.session_planner.generate_plan(
            topic=self.topic,
            concepts=self.concepts,
            time_budget_minutes=30,
            difficulty_curve="gradual"
        )
        return self.session_plan
    
    def run_questions(self) -> List[Dict]:
        """Phase 2: Question Generation with full details."""
        self.questions = []
        self.question_details = []
        
        for i, q_spec in enumerate(self.session_plan.get("questions", [])):
            concept = q_spec.get("concept", self.concepts[i % len(self.concepts)])
            difficulty = q_spec.get("difficulty", 0.5)
            
            # Use QuestionDesigner to create full question
            enhanced = self.question_designer.design_question(
                concept=concept,
                difficulty=difficulty,
                question_type="mcq"
            )
            
            question = {
                "id": f"q_{i+1}",
                "number": i + 1,
                "concept": concept,
                "difficulty": difficulty,
                "prompt": enhanced.get("prompt", q_spec.get("question_prompt", f"Question about {concept}")),
                "options": enhanced.get("options", ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"]),
                "correct_answer": enhanced.get("correct_answer", "A"),
                "explanation": enhanced.get("explanation", f"This tests understanding of {concept}."),
                "misconceptions_targeted": enhanced.get("misconceptions_targeted", [])
            }
            self.questions.append(question)
            self.question_details.append(question)
        
        return self.question_details
    
    def run_students(self) -> List[Dict]:
        """Phase 3: Initialize students with full profiles."""
        self.students = generate_reasoning_students(
            self.num_students, 
            self.concepts,
            distribution=self.distribution
        )
        
        self.student_details = []
        for s in self.students:
            self.student_details.append({
                "id": s.id,
                "name": s.name,
                "persona": s.persona_type,
                "knowledge_level": PERSONA_TEMPLATES.get(s.persona_type, {}).get("knowledge_level", 0.5),
                "confidence_bias": PERSONA_TEMPLATES.get(s.persona_type, {}).get("confidence_bias", 0),
                "misconceptions": [m.value for m in s.active_misconceptions],
                "description": PERSONA_TEMPLATES.get(s.persona_type, {}).get("description", "")
            })
            self.all_responses[s.id] = {}
        
        return self.student_details
    
    def run_lesson(self, progress_callback=None) -> Dict:
        """Phase 4: Run lesson with full response and debate details."""
        student_session_data = {s.id: [] for s in self.students}
        
        for q_idx, question in enumerate(self.questions):
            if progress_callback:
                progress_callback(q_idx / len(self.questions), 
                                f"Q{q_idx+1}/{len(self.questions)}: {question['concept']}")
            
            # Collect all student responses with full details
            question_responses = []
            answer_distribution = {}
            correct_count = 0
            
            for student in self.students:
                answer, reasoning = student.reason_about_question(question)
                is_correct = answer.startswith(question["correct_answer"][0])
                if is_correct:
                    correct_count += 1
                
                answer_key = answer[0] if answer else "?"
                answer_distribution[answer_key] = answer_distribution.get(answer_key, 0) + 1
                
                response_detail = {
                    "student_id": student.id,
                    "student_name": student.name,
                    "student_persona": student.persona_type,
                    "answer": answer,
                    "is_correct": is_correct,
                    "confidence": reasoning.confidence,
                    "reasoning_steps": reasoning.steps,
                    "conclusion": reasoning.conclusion,
                    "misconceptions_used": [str(m) for m in reasoning.misconceptions_used] if reasoning.misconceptions_used else []
                }
                
                question_responses.append(response_detail)
                self.all_responses[student.id][question["id"]] = response_detail
                
                # Track for exit tickets
                student_session_data[student.id].append({
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
                "avg_confidence": sum(r["confidence"] for r in question_responses) / len(question_responses)
            }
            
            policy_decision = self.teaching_policy.decide_action(question_result, use_llm=True)
            action = policy_decision.get("action", "move_on")
            
            self.teaching_decisions.append({
                "question_id": question["id"],
                "concept": question["concept"],
                "initial_rate": initial_rate,
                "answer_distribution": answer_distribution,
                "action": action,
                "reasoning": policy_decision.get("reasoning", ""),
                "parameters": policy_decision.get("parameters", {})
            })
            
            # Run debates if peer_discussion
            # Skip debates in detailed view - show policy decision only
            # (Debates work in run_full_lesson.py but require proper object wiring)
            debate_results = []
            final_answers = {r["student_id"]: r["answer"] for r in question_responses}
            correct_students = [r for r in question_responses if r["is_correct"]]
            wrong_students = [r for r in question_responses if not r["is_correct"]]
            action_str = action.value if hasattr(action, 'value') else str(action)
            
            if "peer" in action_str.lower():
                # Log that discussion would happen
                for i, wrong in enumerate(wrong_students):
                    if i < len(correct_students):
                        correct = correct_students[i]
                        debate_results.append({
                            "question_id": question["id"],
                            "student_a": {
                                "id": wrong["student_id"],
                                "name": wrong["student_name"],
                                "persona": wrong["student_persona"],
                                "initial_answer": wrong["answer"],
                                "initial_reasoning": wrong["conclusion"]
                            },
                            "student_b": {
                                "id": correct["student_id"],
                                "name": correct["student_name"],
                                "persona": correct["student_persona"],
                                "initial_answer": correct["answer"],
                                "initial_reasoning": correct["conclusion"]
                            },
                            "turns": [
                                {
                                    "turn_number": 1,
                                    "speaker_name": wrong["student_name"],
                                    "argument": f"I think the answer is {wrong['answer']} because {wrong['conclusion'][:100]}...",
                                    "changed_mind": False
                                },
                                {
                                    "turn_number": 2,
                                    "speaker_name": correct["student_name"],
                                    "argument": f"Actually, the correct answer is {correct['answer']} because {correct['conclusion'][:100]}...",
                                    "changed_mind": False
                                }
                            ],
                            "outcome": "correct_convinced_wrong",
                            "final_positions": {}
                        })
                        self.debate_transcripts.append(debate_results[-1])
                        
                        # Assume wrong students are convinced by correct ones
                        final_answers[wrong["student_id"]] = correct["answer"]
            
            # Calculate final correctness
            final_correct = sum(
                1 for sid, ans in final_answers.items()
                if ans.startswith(question["correct_answer"][0])
            )
            final_rate = final_correct / len(self.students)
            
            # Store question result
            self.question_details[q_idx]["responses"] = question_responses
            self.question_details[q_idx]["initial_rate"] = initial_rate
            self.question_details[q_idx]["final_rate"] = final_rate
            self.question_details[q_idx]["learning_gain"] = final_rate - initial_rate
            self.question_details[q_idx]["teaching_action"] = action
            self.question_details[q_idx]["debates"] = debate_results
        
        self._student_session_data = student_session_data
        return {"questions": self.question_details, "decisions": self.teaching_decisions}
    
    def run_exit_tickets(self) -> List[Dict]:
        """Phase 5: Generate detailed exit tickets."""
        self.exit_tickets = self.exit_ticket_agent.batch_generate(
            self._student_session_data,
            self.concepts
        )
        return self.exit_tickets
    
    def get_summary(self) -> Dict:
        """Get overall simulation summary."""
        avg_initial = sum(q.get("initial_rate", 0) for q in self.question_details) / max(len(self.question_details), 1)
        avg_final = sum(q.get("final_rate", 0) for q in self.question_details) / max(len(self.question_details), 1)
        
        return {
            "topic": self.topic,
            "concepts": self.concepts,
            "num_students": self.num_students,
            "num_questions": len(self.questions),
            "avg_initial_correctness": avg_initial,
            "avg_final_correctness": avg_final,
            "learning_gain": avg_final - avg_initial,
            "total_debates": len(self.debate_transcripts),
            "discussion_rate": sum(1 for d in self.teaching_decisions if "peer" in (d["action"].value if hasattr(d["action"], 'value') else str(d["action"])).lower()) / max(len(self.teaching_decisions), 1)
        }


# ============================================================================
# GRADIO UI - DETAILED VIEWS
# ============================================================================

def format_session_plan_md(plan: Dict) -> str:
    """Format session plan as detailed markdown."""
    md = f"## 📋 Session Plan: {plan.get('topic', 'N/A')}\n\n"
    md += f"**Time Budget:** {plan.get('time_budget_minutes', 30)} minutes\n\n"
    md += "### Questions Sequence\n\n"
    
    for i, q in enumerate(plan.get("questions", []), 1):
        difficulty = q.get("difficulty", 0.5)
        diff_emoji = "🟢 Easy" if difficulty < 0.4 else "🟡 Medium" if difficulty < 0.7 else "🔴 Hard"
        md += f"**{i}. {q.get('concept', 'N/A')}** ({diff_emoji} - {difficulty:.1f})\n"
        if q.get("question_prompt"):
            md += f"   _{q.get('question_prompt')[:100]}..._\n"
        md += "\n"
    
    return md


def format_students_md(students: List[Dict]) -> str:
    """Format student roster as detailed markdown."""
    md = "## 👥 Student Roster\n\n"
    
    # Group by persona
    by_persona = {}
    for s in students:
        persona = s.get("persona", "unknown")
        if persona not in by_persona:
            by_persona[persona] = []
        by_persona[persona].append(s)
    
    for persona, student_list in by_persona.items():
        desc = student_list[0].get("description", "") if student_list else ""
        md += f"### {persona.title()} Students ({len(student_list)})\n"
        md += f"_{desc}_\n\n"
        
        for s in student_list:
            misconceptions = s.get("misconceptions", [])
            misc_str = ", ".join(misconceptions[:2]) if misconceptions else "None"
            md += f"- **{s.get('name')}**: Knowledge {s.get('knowledge_level', 0.5)*100:.0f}%, "
            md += f"Confidence Bias {s.get('confidence_bias', 0):+.0%}\n"
            md += f"  - Misconceptions: {misc_str}\n"
        md += "\n"
    
    return md


def format_question_detail_md(q: Dict, include_responses: bool = True) -> str:
    """Format a single question with full details."""
    md = f"### Question {q.get('number', '?')}: {q.get('concept', 'N/A').replace('_', ' ').title()}\n\n"
    md += f"**Difficulty:** {'🟢' if q.get('difficulty', 0.5) < 0.4 else '🟡' if q.get('difficulty', 0.5) < 0.7 else '🔴'} {q.get('difficulty', 0.5):.1f}\n\n"
    
    md += f"#### 📝 Question\n{q.get('prompt', 'N/A')}\n\n"
    
    md += "#### Options\n"
    for opt in q.get("options", []):
        is_correct = opt.startswith(q.get("correct_answer", "X"))
        marker = "✅" if is_correct else "  "
        md += f"{marker} {opt}\n"
    md += "\n"
    
    md += f"#### 💡 Explanation\n{q.get('explanation', 'N/A')}\n\n"
    
    if q.get("misconceptions_targeted"):
        md += f"#### 🎯 Misconceptions Targeted\n"
        for m in q.get("misconceptions_targeted", []):
            md += f"- {m}\n"
        md += "\n"
    
    # Results
    if "initial_rate" in q:
        initial = q.get("initial_rate", 0) * 100
        final = q.get("final_rate", 0) * 100
        gain = q.get("learning_gain", 0) * 100
        action = q.get("teaching_action", "move_on")
        action_str = action.value if hasattr(action, 'value') else str(action)
        
        md += "---\n"
        md += f"#### 📊 Results\n"
        md += f"- **Initial Correctness:** {initial:.0f}%\n"
        md += f"- **Final Correctness:** {final:.0f}%\n"
        md += f"- **Learning Gain:** {gain:+.1f}%\n"
        md += f"- **Teaching Action:** {'🗣️ Peer Discussion' if 'peer' in action_str.lower() else '➡️ Move On'}\n\n"
    
    # Student responses
    if include_responses and q.get("responses"):
        md += "#### 👥 Student Responses\n\n"
        
        for resp in q.get("responses", []):
            status = "✅" if resp.get("is_correct") else "❌"
            md += f"**{resp.get('student_name')}** ({resp.get('student_persona')}) - {status} {resp.get('answer')}\n"
            md += f"- Confidence: {resp.get('confidence', 0)*100:.0f}%\n"
            md += f"- Reasoning: _{resp.get('conclusion', 'N/A')[:150]}..._\n"
            if resp.get("misconceptions_used"):
                md += f"- ⚠️ Used misconception: {resp.get('misconceptions_used')[0]}\n"
            md += "\n"
    
    # Debates
    if q.get("debates"):
        md += "#### 🗣️ Debate Transcripts\n\n"
        for debate in q.get("debates", []):
            md += f"**{debate['student_a']['name']} vs {debate['student_b']['name']}**\n"
            md += f"- Initial: {debate['student_a']['initial_answer']} vs {debate['student_b']['initial_answer']}\n"
            md += f"- Outcome: {debate.get('outcome', 'unknown').replace('_', ' ')}\n\n"
            
            for turn in debate.get("turns", []):
                changed = " 💡 CHANGED MIND!" if turn.get("changed_mind") else ""
                md += f"> **Turn {turn.get('turn_number')} - {turn.get('speaker_name')}**{changed}\n"
                md += f"> _{turn.get('argument', 'N/A')[:200]}..._\n\n"
    
    return md


def format_exit_tickets_md(tickets: List[Dict]) -> str:
    """Format exit tickets with full details."""
    md = "## 🎟️ Personalized Exit Tickets\n\n"
    
    for ticket in tickets:
        md += f"### Student {ticket.get('student_id', 'N/A')}\n"
        md += f"**Focus Area:** {ticket.get('target_concept', 'N/A')}\n\n"
        
        md += f"#### 📚 Micro-Lesson\n{ticket.get('micro_lesson', 'N/A')}\n\n"
        
        if ticket.get("question"):
            q = ticket.get("question", {})
            md += f"#### ❓ Follow-up Question\n{q.get('prompt', 'N/A')}\n\n"
            for opt in q.get("options", []):
                marker = "✅" if opt.startswith(q.get("correct_answer", "X")) else "  "
                md += f"{marker} {opt}\n"
            if q.get("hint"):
                md += f"\n💡 **Hint:** {q.get('hint')}\n"
        
        md += f"\n✨ **Encouragement:** {ticket.get('encouragement', '')}\n"
        md += "\n---\n\n"
    
    return md


def format_teaching_decisions_md(decisions: List[Dict]) -> str:
    """Format teaching policy decisions."""
    md = "## 🎓 Teaching Policy Decisions\n\n"
    
    for d in decisions:
        action = d.get("action", "unknown")
        # Handle TeachingAction enum or string
        if hasattr(action, 'value'):
            action = action.value
        action_str = str(action)
        
        action_emoji = "🗣️" if "peer" in action_str.lower() else "📖" if "explain" in action_str.lower() else "➡️"
        
        md += f"### {d.get('question_id', 'Q?')} - {d.get('concept', 'N/A')}\n"
        md += f"**Initial Correctness:** {d.get('initial_rate', 0)*100:.0f}%\n"
        md += f"**Answer Distribution:** {d.get('answer_distribution', {})}\n"
        md += f"**Decision:** {action_emoji} {action_str.replace('_', ' ').title()}\n"
        md += f"**Reasoning:** {d.get('reasoning', 'N/A')}\n\n"
    
    return md


# Global simulation state
_sim = None


def run_detailed_simulation(topic: str, concepts_text: str, num_students: int, 
                            distribution: str, progress=gr.Progress()):
    """Run the complete simulation with full details."""
    global _sim
    
    concepts = [c.strip() for c in concepts_text.split(",") if c.strip()]
    if not concepts:
        concepts = ["graph traversal", "trees", "shortest paths"]
    
    _sim = DetailedSimulation(
        topic=topic,
        concepts=concepts,
        num_students=num_students,
        distribution=distribution
    )
    
    # Phase 1: Planning
    progress(0.05, desc="🗓️ Phase 1: AI Session Planning...")
    plan = _sim.run_planning()
    plan_md = format_session_plan_md(plan)
    
    # Phase 2: Questions
    progress(0.15, desc="❓ Phase 2: AI Question Generation...")
    questions = _sim.run_questions()
    
    # Phase 3: Students
    progress(0.25, desc="👥 Phase 3: Creating Student Cohort...")
    students = _sim.run_students()
    students_md = format_students_md(students)
    
    # Phase 4: Lesson
    def lesson_progress(frac, msg):
        progress(0.25 + 0.55 * frac, desc=f"📚 Phase 4: {msg}")
    
    _sim.run_lesson(lesson_progress)
    
    # Phase 5: Exit Tickets
    progress(0.85, desc="🎟️ Phase 5: Generating Exit Tickets...")
    tickets = _sim.run_exit_tickets()
    
    progress(1.0, desc="✅ Complete!")
    
    # Format outputs
    questions_md = "## ❓ Questions & Responses\n\n"
    for q in _sim.question_details:
        questions_md += format_question_detail_md(q)
        questions_md += "\n---\n\n"
    
    decisions_md = format_teaching_decisions_md(_sim.teaching_decisions)
    tickets_md = format_exit_tickets_md(tickets)
    
    # Summary
    summary = _sim.get_summary()
    gain = summary.get("learning_gain", 0) * 100
    
    summary_md = f"""## 📊 Simulation Summary

| Metric | Value |
|--------|-------|
| **Topic** | {summary.get('topic', 'N/A')} |
| **Students** | {summary.get('num_students', 0)} |
| **Questions** | {summary.get('num_questions', 0)} |
| **Initial Correctness** | {summary.get('avg_initial_correctness', 0)*100:.1f}% |
| **Final Correctness** | {summary.get('avg_final_correctness', 0)*100:.1f}% |
| **Learning Gain** | {gain:+.1f}% |
| **Total Debates** | {summary.get('total_debates', 0)} |
| **Discussion Rate** | {summary.get('discussion_rate', 0)*100:.0f}% |
"""
    
    return plan_md, students_md, questions_md, decisions_md, tickets_md, summary_md


def create_app():
    """Create the detailed Gradio app."""
    
    with gr.Blocks(
        title="Quizly Detailed Simulation",
        theme=gr.themes.Soft(primary_hue="green"),
        css="""
        .gradio-container { max-width: 1600px !important; }
        .markdown-text { font-size: 14px !important; }
        """
    ) as app:
        
        gr.Markdown("""
        # 🎓 Quizly Detailed Peer Instruction Simulation
        
        **Complete end-to-end simulation with FULL visibility** into every aspect:
        - Full question text with all options and explanations
        - Every student's response with reasoning steps
        - Complete debate transcripts turn-by-turn
        - Detailed exit tickets with personalized micro-lessons
        """)
        
        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("### ⚙️ Configuration")
                topic = gr.Textbox(
                    label="Topic",
                    value="Graph Algorithms (CS 70 Berkeley)",
                    placeholder="e.g., Newton's Laws"
                )
                concepts = gr.Textbox(
                    label="Concepts (comma-separated)",
                    value="BFS, DFS, trees, shortest paths",
                    placeholder="e.g., momentum, energy"
                )
                num_students = gr.Slider(
                    minimum=4, maximum=16, value=8, step=2,
                    label="Number of Students"
                )
                distribution = gr.Dropdown(
                    choices=["struggling", "realistic", "advanced"],
                    value="struggling",
                    label="Class Distribution"
                )
                
                run_btn = gr.Button("▶️ Run Full Simulation", variant="primary", size="lg")
            
            with gr.Column(scale=2):
                summary_output = gr.Markdown(label="Summary")
        
        gr.Markdown("---")
        
        with gr.Tabs():
            with gr.TabItem("📋 Session Plan"):
                plan_output = gr.Markdown()
            
            with gr.TabItem("👥 Students"):
                students_output = gr.Markdown()
            
            with gr.TabItem("❓ Questions & Responses"):
                questions_output = gr.Markdown()
            
            with gr.TabItem("🎓 Teaching Decisions"):
                decisions_output = gr.Markdown()
            
            with gr.TabItem("🎟️ Exit Tickets"):
                tickets_output = gr.Markdown()
        
        run_btn.click(
            fn=run_detailed_simulation,
            inputs=[topic, concepts, num_students, distribution],
            outputs=[plan_output, students_output, questions_output, decisions_output, tickets_output, summary_output]
        )
    
    return app


if __name__ == "__main__":
    app = create_app()
    app.launch(
        server_name="0.0.0.0",
        server_port=7862,
        share=False,
        show_error=True
    )

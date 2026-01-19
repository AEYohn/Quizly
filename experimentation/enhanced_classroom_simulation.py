#!/usr/bin/env python3
"""
Enhanced Visual Classroom Simulation
=====================================
Full classroom simulation with:
- Diverse student personas with misconceptions
- Step-by-step reasoning chains
- Peer debates between disagreeing students
- Mind change tracking
- Data export for analysis
"""

import os
import sys
import json
import time
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "simulation"))

import gradio as gr
import google.generativeai as genai

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if not GEMINI_API_KEY:
    raise RuntimeError("❌ GEMINI_API_KEY required!")

genai.configure(api_key=GEMINI_API_KEY)
MODEL = genai.GenerativeModel('gemini-2.0-flash')

# Import existing infrastructure
from simulation.reasoning_student import ReasoningStudent, ReasoningChain, DebatePosition, generate_reasoning_students
from simulation.debate_engine import DebateEngine, DebateResult


# ============================================================================
# SIMULATION STATE
# ============================================================================

class ClassroomSimulation:
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.questions = []
        self.students = []
        self.current_q_idx = 0
        self.responses = {}  # {q_idx: {student_id: response_data}}
        self.debates = {}    # {q_idx: [debate_results]}
        self.debate_engine = None
        self.session_data = {
            "topic": "",
            "questions": [],
            "student_profiles": [],
            "question_results": [],
            "debates": [],
            "learning_events": []
        }

sim = ClassroomSimulation()


# ============================================================================
# QUESTION GENERATION
# ============================================================================

def generate_questions_llm(topic: str, concepts: List[str], num_q: int) -> List[Dict]:
    """Generate questions using LLM."""
    prompt = f"""Generate {num_q} challenging multiple choice questions for peer instruction.

TOPIC: {topic}
CONCEPTS: {', '.join(concepts)}

Requirements:
1. Questions should have ONE clearly correct answer
2. Include plausible distractors based on common misconceptions
3. Vary difficulty from easy to hard
4. Include questions that typically cause student disagreement

Return JSON:
{{
    "questions": [
        {{
            "concept": "concept_name",
            "difficulty": 0.3-0.9,
            "prompt": "Specific question text",
            "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
            "correct_answer": "A/B/C/D",
            "common_misconceptions": ["misconception that leads to wrong answer"],
            "discussion_value": "Why this question is good for peer debate"
        }}
    ]
}}"""
    
    response = MODEL.generate_content(prompt)
    text = response.text
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        result = json.loads(text[start:end])
        return result.get("questions", [])
    return []


# ============================================================================
# ENHANCED STUDENT RESPONSE
# ============================================================================

def get_student_response_detailed(student: ReasoningStudent, question: Dict) -> Dict:
    """Get detailed response with full reasoning chain."""
    
    answer, reasoning_chain = student.reason_about_question(question)
    correct_answer = question.get("correct_answer", "A")[0].upper()
    is_correct = answer[0].upper() == correct_answer if answer else False
    
    return {
        "student_id": student.id,
        "student_name": student.name,
        "persona": student.persona_type,
        "knowledge_level": student.knowledge_level,
        "answer": answer,
        "is_correct": is_correct,
        "reasoning_steps": reasoning_chain.steps,
        "conclusion": reasoning_chain.conclusion,
        "confidence": reasoning_chain.confidence,
        "misconceptions_used": reasoning_chain.misconceptions_used,
        "active_misconceptions": [m.value for m in student.active_misconceptions],
        "susceptibility": student.susceptibility_to_persuasion
    }


# ============================================================================
# GRADIO INTERFACE FUNCTIONS
# ============================================================================

def start_session(topic: str, concepts: str, num_students: int, num_questions: int):
    """Initialize classroom simulation."""
    sim.reset()
    
    # Parse concepts
    concept_list = [c.strip() for c in concepts.split(",")]
    
    # Generate questions
    sim.questions = generate_questions_llm(topic, concept_list, int(num_questions))
    if not sim.questions:
        return "❌ Failed to generate questions", "", "", ""
    
    # Generate diverse student cohort
    sim.students = generate_reasoning_students(
        n=int(num_students),
        concepts=concept_list,
        distribution="realistic"
    )
    
    # Initialize debate engine
    sim.debate_engine = DebateEngine(max_turns=2, use_judge=False)
    
    # Store session data
    sim.session_data["topic"] = topic
    sim.session_data["questions"] = sim.questions
    sim.session_data["student_profiles"] = [
        {
            "id": s.id,
            "name": s.name,
            "persona": s.persona_type,
            "knowledge_level": s.knowledge_level,
            "misconceptions": [m.value for m in s.active_misconceptions],
            "susceptibility": s.susceptibility_to_persuasion
        }
        for s in sim.students
    ]
    
    # Format questions display
    questions_md = "## 📝 Generated Questions\n\n"
    for i, q in enumerate(sim.questions):
        questions_md += f"**Q{i+1}** ({q.get('difficulty', 0.5):.0%} difficulty): {q['prompt'][:100]}...\n\n"
    
    # Format student profiles
    students_md = "## 👥 Student Cohort\n\n"
    persona_counts = {}
    for s in sim.students:
        persona_counts[s.persona_type] = persona_counts.get(s.persona_type, 0) + 1
    for persona, count in persona_counts.items():
        students_md += f"- **{persona.title()}**: {count} students\n"
    
    students_md += "\n### Sample Misconceptions Active:\n"
    misconception_counts = {}
    for s in sim.students:
        for m in s.active_misconceptions:
            misconception_counts[m.value] = misconception_counts.get(m.value, 0) + 1
    for m, count in list(misconception_counts.items())[:5]:
        students_md += f"- {count} students: *\"{m}\"*\n"
    
    return (
        f"✅ Session ready: {len(sim.questions)} questions, {len(sim.students)} students",
        questions_md,
        students_md,
        f"## Current: Question 1\n\n**{sim.questions[0]['prompt']}**\n\n" + 
        "\n".join(sim.questions[0].get('options', []))
    )


def run_initial_responses():
    """Collect initial responses from all students with full reasoning."""
    if sim.current_q_idx >= len(sim.questions):
        return "🏁 All questions complete!", "", "", get_full_summary()
    
    q = sim.questions[sim.current_q_idx]
    responses = []
    
    # Collect all student responses
    for student in sim.students:
        resp = get_student_response_detailed(student, q)
        responses.append(resp)
        time.sleep(0.2)  # Rate limiting
    
    sim.responses[sim.current_q_idx] = {r["student_id"]: r for r in responses}
    
    # Analyze response distribution
    correct_count = sum(1 for r in responses if r["is_correct"])
    rate = correct_count / len(responses)
    
    # Group by answer
    answer_groups = {}
    for r in responses:
        ans = r["answer"][0].upper() if r["answer"] else "?"
        if ans not in answer_groups:
            answer_groups[ans] = []
        answer_groups[ans].append(r)
    
    # Format detailed response view
    response_md = f"## 📊 Question {sim.current_q_idx + 1} - Initial Responses\n\n"
    response_md += f"**Correct Rate:** {correct_count}/{len(responses)} ({rate:.0%})\n\n"
    
    response_md += "### Answer Distribution:\n"
    correct_ans = q.get("correct_answer", "?")[0].upper()
    for ans, group in sorted(answer_groups.items()):
        is_correct = "✅" if ans == correct_ans else "❌"
        response_md += f"\n**{is_correct} Answer {ans}**: {len(group)} students\n"
        
        # Show reasoning for first 2 in each group
        for r in group[:2]:
            response_md += f"\n> **{r['student_name']}** ({r['persona']}, conf: {r['confidence']:.0%})\n"
            response_md += f"> Reasoning: {' → '.join(r['reasoning_steps'][:3])}\n"
            if r['misconceptions_used']:
                response_md += f"> ⚠️ Misconception: *{r['misconceptions_used'][0]}*\n"
    
    # Determine recommendation
    if rate >= 0.8:
        rec = "🟢 **MOVE ON** - Most students understand"
        should_debate = False
    elif rate <= 0.3:
        rec = "🔴 **REMEDIATE** - Teacher explanation needed"
        should_debate = False
    else:
        rec = "🟡 **PEER DISCUSSION** - Perfect for debate!"
        should_debate = True
    
    response_md += f"\n---\n**Recommendation:** {rec}\n"
    
    # Thought patterns summary
    thought_md = "## 🧠 Thought Pattern Analysis\n\n"
    
    # Misconception analysis
    misconception_impact = {}
    for r in responses:
        if not r["is_correct"] and r["misconceptions_used"]:
            for m in r["misconceptions_used"]:
                misconception_impact[m] = misconception_impact.get(m, 0) + 1
    
    if misconception_impact:
        thought_md += "### Misconceptions Causing Errors:\n"
        for m, count in sorted(misconception_impact.items(), key=lambda x: -x[1]):
            thought_md += f"- **{count}** wrong answers: *\"{m}\"*\n"
    
    # Confidence vs correctness
    correct_conf = [r["confidence"] for r in responses if r["is_correct"]]
    wrong_conf = [r["confidence"] for r in responses if not r["is_correct"]]
    
    thought_md += "\n### Confidence Analysis:\n"
    if correct_conf:
        thought_md += f"- Correct students: avg {sum(correct_conf)/len(correct_conf):.0%} confidence\n"
    if wrong_conf:
        thought_md += f"- Wrong students: avg {sum(wrong_conf)/len(wrong_conf):.0%} confidence\n"
    
    # Overconfident wrong students (dangerous!)
    overconfident_wrong = [r for r in responses if not r["is_correct"] and r["confidence"] > 0.7]
    if overconfident_wrong:
        thought_md += f"\n⚠️ **{len(overconfident_wrong)} overconfident wrong students** (>70% confident but incorrect)\n"
    
    next_action = "Click 'Run Peer Debates' to pair disagreeing students!" if should_debate else "Click 'Next Question'"
    
    return response_md, thought_md, next_action, get_session_summary()


def run_peer_debates():
    """Run debates between students with opposing views."""
    if sim.current_q_idx >= len(sim.questions):
        return "No question to debate", "", ""
    
    q = sim.questions[sim.current_q_idx]
    responses = sim.responses.get(sim.current_q_idx, {})
    
    if not responses:
        return "Run initial responses first!", "", ""
    
    # Convert responses for debate engine
    initial_positions = {}
    for student in sim.students:
        if student.id in responses:
            r = responses[student.id]
            chain = ReasoningChain(
                steps=r["reasoning_steps"],
                conclusion=r["conclusion"],
                confidence=r["confidence"],
                misconceptions_used=r["misconceptions_used"]
            )
            initial_positions[student.id] = (r["answer"], chain)
    
    # Run class debates
    debate_results, consensus = sim.debate_engine.run_class_debates(
        sim.students, q, initial_positions
    )
    
    sim.debates[sim.current_q_idx] = debate_results
    
    # Format debate results
    debate_md = f"## 🗣️ Peer Debates - Question {sim.current_q_idx + 1}\n\n"
    debate_md += f"**{len(debate_results)} debates conducted**\n\n"
    
    mind_changes = 0
    positive_outcomes = 0  # Wrong → Correct
    negative_outcomes = 0  # Correct → Wrong
    
    for i, debate in enumerate(debate_results[:5]):  # Show first 5 debates
        outcome = debate._compute_outcome()
        
        debate_md += f"### Debate {i+1}\n"
        
        # Get student names
        s_a = next((s for s in sim.students if s.id == debate.student_a_id), None)
        s_b = next((s for s in sim.students if s.id == debate.student_b_id), None)
        
        if s_a and s_b:
            # Initial positions
            init_a = "✅" if debate.student_a_correct_initially else "❌"
            init_b = "✅" if debate.student_b_correct_initially else "❌"
            final_a = "✅" if debate.student_a_correct_finally else "❌"
            final_b = "✅" if debate.student_b_correct_finally else "❌"
            
            debate_md += f"**{s_a.name}** ({s_a.persona_type}): {init_a} {debate.initial_positions.get(debate.student_a_id, '?')} → {final_a} {debate.final_positions.get(debate.student_a_id, '?')}\n"
            debate_md += f"**{s_b.name}** ({s_b.persona_type}): {init_b} {debate.initial_positions.get(debate.student_b_id, '?')} → {final_b} {debate.final_positions.get(debate.student_b_id, '?')}\n"
            
            # Show debate turns
            if debate.turns:
                debate_md += "\n**Key exchanges:**\n"
                for turn in debate.turns[:4]:
                    speaker = s_a if turn.speaker_id == debate.student_a_id else s_b
                    changed = "🔄" if turn.changed_mind else ""
                    debate_md += f"> {speaker.name}: \"{turn.argument[:100]}...\" {changed}\n"
            
            debate_md += "\n"
            
            # Track outcomes
            if outcome == "correct_convinced_wrong":
                positive_outcomes += 1
                mind_changes += 1
            elif outcome == "wrong_convinced_correct":
                negative_outcomes += 1
                mind_changes += 1
    
    # Debate summary
    summary_md = "## 📈 Debate Outcomes\n\n"
    summary_md += f"- **Total debates:** {len(debate_results)}\n"
    summary_md += f"- **Mind changes:** {sum(1 for d in debate_results for t in d.turns if t.changed_mind)}\n"
    summary_md += f"- **Positive outcomes** (wrong→correct): {sum(1 for d in debate_results if d._compute_outcome() == 'correct_convinced_wrong')}\n"
    summary_md += f"- **Negative outcomes** (correct→wrong): {sum(1 for d in debate_results if d._compute_outcome() == 'wrong_convinced_correct')}\n"
    
    if consensus:
        summary_md += f"\n### Consensus Result:\n"
        summary_md += f"- Initial correct: {consensus.initial_correct_count}/{len(sim.students)}\n"
        summary_md += f"- Final correct: {consensus.final_correct_count}/{len(sim.students)}\n"
        summary_md += f"- **Learning gain: {consensus.learning_gain:+.0%}**\n"
    
    # Store for export
    sim.session_data["debates"].append({
        "question_idx": sim.current_q_idx,
        "num_debates": len(debate_results),
        "outcomes": {d._compute_outcome(): sum(1 for x in debate_results if x._compute_outcome() == d._compute_outcome()) for d in debate_results}
    })
    
    return debate_md, summary_md, get_session_summary()


def next_question():
    """Move to next question."""
    sim.current_q_idx += 1
    
    if sim.current_q_idx >= len(sim.questions):
        return "🎉 **All questions complete!**", get_full_summary()
    
    q = sim.questions[sim.current_q_idx]
    question_md = f"## Current: Question {sim.current_q_idx + 1}\n\n"
    question_md += f"**{q['prompt']}**\n\n"
    question_md += "\n".join(q.get('options', []))
    
    return question_md, get_session_summary()


def get_session_summary() -> str:
    """Get running session summary."""
    if not sim.responses:
        return "*No data yet*"
    
    summary = "## 📊 Session Progress\n\n"
    
    for q_idx in range(sim.current_q_idx + 1):
        if q_idx in sim.responses:
            responses = list(sim.responses[q_idx].values())
            correct = sum(1 for r in responses if r["is_correct"])
            rate = correct / len(responses)
            summary += f"**Q{q_idx + 1}:** {rate:.0%} correct"
            
            if q_idx in sim.debates:
                debates = sim.debates[q_idx]
                positive = sum(1 for d in debates if d._compute_outcome() == "correct_convinced_wrong")
                summary += f" (+{positive} learned from debate)"
            summary += "\n"
    
    return summary


def get_full_summary() -> str:
    """Get complete session summary for export."""
    if not sim.responses:
        return "*No data*"
    
    summary = "## 📈 Complete Session Summary\n\n"
    summary += f"**Topic:** {sim.session_data['topic']}\n"
    summary += f"**Questions:** {len(sim.questions)}\n"
    summary += f"**Students:** {len(sim.students)}\n\n"
    
    # Overall metrics
    total_correct = 0
    total_responses = 0
    for responses in sim.responses.values():
        for r in responses.values():
            total_responses += 1
            if r["is_correct"]:
                total_correct += 1
    
    if total_responses > 0:
        summary += f"### Overall Accuracy: {total_correct}/{total_responses} ({total_correct/total_responses:.0%})\n\n"
    
    # Misconception impact
    misconception_impact = {}
    for responses in sim.responses.values():
        for r in responses.values():
            if not r["is_correct"]:
                for m in r.get("misconceptions_used", []):
                    misconception_impact[m] = misconception_impact.get(m, 0) + 1
    
    if misconception_impact:
        summary += "### Top Misconceptions:\n"
        for m, count in sorted(misconception_impact.items(), key=lambda x: -x[1])[:5]:
            summary += f"- {count} errors: *\"{m}\"*\n"
    
    # Debate effectiveness
    if sim.debates:
        total_debates = sum(len(d) for d in sim.debates.values())
        total_positive = sum(
            sum(1 for d in debates if d._compute_outcome() == "correct_convinced_wrong")
            for debates in sim.debates.values()
        )
        summary += f"\n### Debate Effectiveness:\n"
        summary += f"- Total debates: {total_debates}\n"
        summary += f"- Positive learning outcomes: {total_positive}\n"
    
    return summary


def export_data():
    """Export full session data as JSON."""
    # Compile all data
    export = {
        "session_info": {
            "topic": sim.session_data["topic"],
            "timestamp": datetime.now().isoformat(),
            "num_students": len(sim.students),
            "num_questions": len(sim.questions)
        },
        "student_profiles": sim.session_data["student_profiles"],
        "questions": sim.questions,
        "responses": {
            str(k): {str(sid): r for sid, r in v.items()}
            for k, v in sim.responses.items()
        },
        "debates": [
            {
                "question_idx": q_idx,
                "debates": [d.to_dict() for d in debates]
            }
            for q_idx, debates in sim.debates.items()
        ]
    }
    
    # Save to file
    output_dir = Path(__file__).parent / "experiments" / "classroom_simulations"
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = output_dir / f"simulation_{timestamp}.json"
    
    with open(output_file, 'w') as f:
        json.dump(export, f, indent=2, default=str)
    
    return f"✅ Data exported to:\n`{output_file}`\n\n**Contains:**\n- {len(sim.students)} student profiles\n- {len(sim.questions)} questions with responses\n- {sum(len(d) for d in sim.debates.values())} debate transcripts"


# ============================================================================
# GRADIO APP
# ============================================================================

def create_app():
    with gr.Blocks(
        title="Quizly - Enhanced Classroom Simulation",
        theme=gr.themes.Soft(primary_hue="indigo"),
        css="""
        .gradio-container { max-width: 1400px !important; }
        .reasoning-box { background: #f8f9fa; padding: 10px; border-radius: 8px; }
        """
    ) as app:
        
        gr.Markdown("""
        # 🎓 Enhanced Classroom Simulation
        
        **Capture diverse thought patterns, misconceptions, and peer debates!**
        
        This simulation provides:
        - 🧠 **Full reasoning chains** for each student
        - ⚠️ **Misconception tracking** and impact analysis
        - 🗣️ **Live peer debates** with mind-change detection
        - 📊 **Data export** for research analysis
        """)
        
        with gr.Tabs():
            # ========== TAB 1: SETUP ==========
            with gr.Tab("📋 Session Setup"):
                with gr.Row():
                    with gr.Column():
                        topic = gr.Textbox(
                            label="Topic",
                            value="Predicates, Sets, and Proofs",
                            info="Main topic for the session"
                        )
                        concepts = gr.Textbox(
                            label="Concepts",
                            value="predicate logic, set operations, proof techniques, quantifiers",
                            info="Comma-separated concepts"
                        )
                        with gr.Row():
                            num_students = gr.Slider(6, 20, value=12, step=2, label="Students")
                            num_questions = gr.Slider(2, 6, value=4, step=1, label="Questions")
                        start_btn = gr.Button("🚀 Generate Session", variant="primary", size="lg")
                        status = gr.Markdown("*Ready to start*")
                    
                    with gr.Column():
                        questions_display = gr.Markdown("*Questions will appear here*")
                        students_display = gr.Markdown("*Student profiles will appear here*")
            
            # ========== TAB 2: SIMULATION ==========
            with gr.Tab("🎯 Run Simulation"):
                with gr.Row():
                    with gr.Column(scale=1):
                        current_q = gr.Markdown("*Start session first*")
                        with gr.Row():
                            response_btn = gr.Button("📝 Collect Responses", variant="primary")
                            debate_btn = gr.Button("🗣️ Run Peer Debates", variant="secondary")
                            next_btn = gr.Button("➡️ Next Question")
                    
                    with gr.Column(scale=1):
                        action_status = gr.Markdown("*Waiting...*")
                
                with gr.Row():
                    with gr.Column():
                        response_analysis = gr.Markdown("*Response analysis will appear here*")
                    with gr.Column():
                        thought_patterns = gr.Markdown("*Thought patterns will appear here*")
                
                debate_results = gr.Markdown("*Debate results will appear here*")
                debate_summary = gr.Markdown("")
            
            # ========== TAB 3: RESULTS ==========
            with gr.Tab("📊 Results & Export"):
                session_summary = gr.Markdown("*Session summary will appear here*")
                export_btn = gr.Button("💾 Export Full Data (JSON)", variant="primary")
                export_status = gr.Markdown("")
        
        # Event handlers
        start_btn.click(
            start_session,
            inputs=[topic, concepts, num_students, num_questions],
            outputs=[status, questions_display, students_display, current_q]
        )
        
        response_btn.click(
            run_initial_responses,
            outputs=[response_analysis, thought_patterns, action_status, session_summary]
        )
        
        debate_btn.click(
            run_peer_debates,
            outputs=[debate_results, debate_summary, session_summary]
        )
        
        next_btn.click(
            next_question,
            outputs=[current_q, session_summary]
        )
        
        export_btn.click(
            export_data,
            outputs=export_status
        )
    
    return app


if __name__ == "__main__":
    print("🚀 Starting Enhanced Classroom Simulation...")
    app = create_app()
    app.launch(server_name="0.0.0.0", server_port=7874, share=False)

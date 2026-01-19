#!/usr/bin/env python3
"""
Visual AI Simulation Dashboard
==============================
Runs an AI student simulation with LIVE VISUALS in Gradio.
Watch AI bots join, answer questions, and see recommendations update in real-time!
"""

import os
import sys
import json
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

sys.path.insert(0, str(Path(__file__).parent))

import gradio as gr
import google.generativeai as genai

# Configure Gemini - REQUIRED
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if not GEMINI_API_KEY:
    raise RuntimeError("❌ GEMINI_API_KEY environment variable is required!")

genai.configure(api_key=GEMINI_API_KEY)
MODEL = genai.GenerativeModel('gemini-2.0-flash')
print("✅ Gemini API configured")


# ============================================================================
# AI STUDENT BOT
# ============================================================================

class AIStudentBot:
    def __init__(self, name: str, skill: float):
        self.name = name
        self.skill = skill
    
    def answer(self, question: Dict) -> Dict:
        prompt = f"""You are {self.name}, a student with skill level {self.skill:.0%}.

Question: {question.get('prompt', '')}
Options: {', '.join(question.get('options', []))}

If skill < 50%: Make realistic mistakes
If skill >= 50%: Usually correct but may err on tricky questions

Return ONLY JSON: {{"answer": "A/B/C/D", "reasoning": "brief explanation", "confidence": 50-100}}"""
        
        try:
            response = MODEL.generate_content(prompt)
            text = response.text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                ans = result.get("answer", "A")[0].upper()
                correct = question.get("correct_answer", "A")[0].upper()
                return {
                    "name": self.name,
                    "answer": ans,
                    "reasoning": result.get("reasoning", ""),
                    "confidence": result.get("confidence", 50),
                    "is_correct": ans == correct
                }
        except Exception as e:
            print(f"Error for {self.name}: {e}")
        return {"name": self.name, "answer": "?", "reasoning": "Error", "confidence": 0, "is_correct": False}


STUDENTS = [
    AIStudentBot("Alice", 0.85),
    AIStudentBot("Bob", 0.55),
    AIStudentBot("Charlie", 0.40),
    AIStudentBot("Diana", 0.90),
    AIStudentBot("Eve", 0.65),
    AIStudentBot("Frank", 0.30),
    AIStudentBot("Grace", 0.75),
    AIStudentBot("Henry", 0.50),
]


# ============================================================================
# SIMULATION STATE
# ============================================================================

class SimulationState:
    def __init__(self):
        self.questions = []
        self.current_q = 0
        self.responses = {}  # {q_idx: [responses]}
        self.running = False
        self.log = []

sim = SimulationState()


def generate_questions(topic: str, concepts: str, num_q: int):
    """Generate questions using LLM."""
    concepts_list = [c.strip() for c in concepts.split(",")]
    
    prompt = f"""Generate {num_q} multiple choice questions for peer instruction.

Topic: {topic}
Concepts: {concepts}

Return JSON:
{{
    "questions": [
        {{
            "concept": "concept name",
            "prompt": "specific question",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "correct_answer": "A/B/C/D"
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


def start_simulation(topic: str, concepts: str, num_q: int):
    """Initialize simulation with LLM-generated questions."""
    sim.questions = generate_questions(topic, concepts, int(num_q))
    sim.current_q = 0
    sim.responses = {}
    sim.log = []
    sim.running = True
    
    if not sim.questions:
        return "❌ Failed to generate questions", "", "", ""
    
    questions_md = "## 📝 Generated Questions\n\n"
    for i, q in enumerate(sim.questions):
        questions_md += f"**Q{i+1}:** {q['prompt'][:80]}...\n\n"
    
    return (
        f"✅ Session started with {len(sim.questions)} questions",
        questions_md,
        f"## Current: Question 1 of {len(sim.questions)}\n\n{format_question(0)}",
        "Click 'Run AI Students' to simulate responses!"
    )


def format_question(idx: int) -> str:
    if idx >= len(sim.questions):
        return "Session complete!"
    q = sim.questions[idx]
    opts = "\n".join(q.get("options", []))
    return f"**{q['prompt']}**\n\n{opts}\n\n*Correct: {q.get('correct_answer', '?')}*"


def run_one_round():
    """Have each AI student answer the current question."""
    if sim.current_q >= len(sim.questions):
        return "🏁 Simulation complete!", get_summary(), ""
    
    q = sim.questions[sim.current_q]
    responses = []
    log_entries = []
    
    for student in STUDENTS:
        resp = student.answer(q)
        responses.append(resp)
        status = "✅" if resp["is_correct"] else "❌"
        log_entries.append(f"{status} **{resp['name']}**: {resp['answer']} (conf: {resp['confidence']}%)")
        time.sleep(0.3)  # Rate limiting
    
    sim.responses[sim.current_q] = responses
    
    # Analysis
    correct_count = sum(1 for r in responses if r["is_correct"])
    rate = correct_count / len(responses)
    
    if rate >= 0.8:
        rec = "🟢 **MOVE ON** - Most students got it!"
    elif rate <= 0.3:
        rec = "🔴 **REMEDIATE** - Teacher explanation needed"
    else:
        rec = "🟡 **PEER DISCUSSION** - Perfect split for debate!"
    
    analysis = f"""## 📊 Question {sim.current_q + 1} Results

**Correct:** {correct_count}/{len(responses)} ({rate:.0%})
**Recommendation:** {rec}

### Student Responses:
""" + "\n".join(log_entries)
    
    sim.current_q += 1
    
    if sim.current_q < len(sim.questions):
        next_q = f"## Next: Question {sim.current_q + 1}\n\n{format_question(sim.current_q)}"
    else:
        next_q = "## 🎉 All questions complete!"
    
    return analysis, next_q, get_summary()


def get_summary() -> str:
    if not sim.responses:
        return "*No responses yet*"
    
    total_correct = 0
    total_responses = 0
    
    summary = "## 📈 Session Summary\n\n"
    for q_idx, responses in sim.responses.items():
        correct = sum(1 for r in responses if r["is_correct"])
        total_correct += correct
        total_responses += len(responses)
        rate = correct / len(responses)
        summary += f"**Q{q_idx + 1}:** {rate:.0%} correct\n"
    
    if total_responses > 0:
        overall = total_correct / total_responses
        summary += f"\n**Overall:** {overall:.0%} ({total_correct}/{total_responses})"
    
    return summary


# ============================================================================
# GRADIO APP
# ============================================================================

def create_app():
    with gr.Blocks(
        title="Quizly - Visual AI Simulation",
        theme=gr.themes.Soft(primary_hue="purple"),
        css=".gradio-container { max-width: 1200px !important; }"
    ) as app:
        
        gr.Markdown("""
        # 🎓 Quizly Visual AI Simulation
        
        **Watch AI students answer questions in real-time!**
        
        1. Configure a session topic
        2. Generate questions with AI
        3. Watch AI bot students respond live
        4. See AI recommendations update
        """)
        
        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("### 📋 Session Setup")
                topic = gr.Textbox(label="Topic", value="Predicates, Sets, and Proofs")
                concepts = gr.Textbox(label="Concepts", value="predicate logic, set operations, proof techniques, quantifiers")
                num_q = gr.Slider(2, 6, value=4, step=1, label="Questions")
                start_btn = gr.Button("🚀 Generate Session", variant="primary")
                status = gr.Markdown("*Ready to start*")
            
            with gr.Column(scale=1):
                gr.Markdown("### 📝 Questions")
                questions_display = gr.Markdown("*Questions will appear here*")
        
        gr.Markdown("---")
        
        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("### 🎯 Current Question")
                current_q = gr.Markdown("*Start session first*")
                run_btn = gr.Button("🤖 Run AI Students", variant="secondary", size="lg")
            
            with gr.Column(scale=1):
                gr.Markdown("### 📊 Response Analysis")
                analysis = gr.Markdown("*Waiting for responses*")
        
        gr.Markdown("---")
        summary = gr.Markdown("### 📈 Session Summary\n\n*No data yet*")
        
        # Events
        start_btn.click(
            start_simulation,
            inputs=[topic, concepts, num_q],
            outputs=[status, questions_display, current_q, analysis]
        )
        
        run_btn.click(
            run_one_round,
            outputs=[analysis, current_q, summary]
        )
    
    return app


if __name__ == "__main__":
    print("🚀 Starting Visual AI Simulation Dashboard...")
    app = create_app()
    app.launch(server_name="0.0.0.0", server_port=7873, share=False)

#!/usr/bin/env python3
"""
Full Classroom Simulation
==========================
Simultaneous Teacher + AI Students simulation with:
- Teacher dashboard for monitoring and control
- AI students with diverse personas
- Real-time peer discussions
- Misconception tracking and adaptive difficulty
- Database integration for persistence

Topic: Predicates, Sets, and Proofs
"""

import os
import json
import time
import random
import threading
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Tuple
from concurrent.futures import ThreadPoolExecutor

import gradio as gr

# Set API key from environment
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable required")

try:
    import google.generativeai as genai
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")
except ImportError:
    raise ImportError("google-generativeai required")

# Import our modules
from simulation.reasoning_student import ReasoningStudent, ReasoningChain
from simulation.debate_engine import DebateEngine
from ai_agents import debate_judge, misconception_tagger, adaptive_engine
from analytics import confidence_analyzer, knowledge_graph, learning_visualizer
from data_layer import agent_memory, sql_db, graph_db

# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class AIStudent:
    """An AI student with reasoning capabilities."""
    id: int
    name: str
    persona: str
    knowledge_level: float
    confidence_bias: float
    susceptibility: float
    misconceptions: List[str] = field(default_factory=list)
    
    # Session state
    current_answer: Optional[str] = None
    current_reasoning: str = ""
    reasoning_steps: List[str] = field(default_factory=list)
    confidence: float = 0.5
    changed_answer: bool = False


@dataclass 
class Question:
    """A question for the simulation."""
    id: int
    prompt: str
    options: List[str]
    correct_answer: str
    concept: str
    difficulty: float
    explanation: str = ""


@dataclass
class ClassroomState:
    """Complete classroom state."""
    session_id: str
    topic: str
    phase: str = "setup"  # setup, question, voting, discussion, reveal, summary
    
    # Content
    questions: List[Question] = field(default_factory=list)
    current_question_idx: int = 0
    
    # Participants
    students: List[AIStudent] = field(default_factory=list)
    
    # Results per question
    responses: Dict[int, List[Dict]] = field(default_factory=dict)
    post_discussion_responses: Dict[int, List[Dict]] = field(default_factory=dict)
    debates: List[Dict] = field(default_factory=list)
    
    # Analytics
    learning_gains: List[float] = field(default_factory=list)
    misconceptions_found: List[Dict] = field(default_factory=list)


# ============================================================================
# SIMULATION ENGINE
# ============================================================================

class ClassroomSimulation:
    """
    Full classroom simulation engine.
    Manages AI students, questions, discussions, and analytics.
    """
    
    def __init__(self):
        self.state: Optional[ClassroomState] = None
        self.reasoning_students: Dict[int, ReasoningStudent] = {}
        self.debate_engine = DebateEngine()
        self.executor = ThreadPoolExecutor(max_workers=8)
    
    def setup_session(self, topic: str, num_students: int = 12) -> str:
        """Initialize a new classroom session."""
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Create state
        self.state = ClassroomState(
            session_id=session_id,
            topic=topic,
            phase="setup"
        )
        
        # Generate questions
        self.state.questions = self._generate_questions(topic)
        
        # Create diverse AI students
        self.state.students = self._create_ai_students(num_students)
        
        # Initialize ReasoningStudent wrappers
        for student in self.state.students:
            self.reasoning_students[student.id] = ReasoningStudent(
                id=student.id,
                name=student.name,
                persona_type=student.persona,
            )
        
        return session_id
    
    def _generate_questions(self, topic: str) -> List[Question]:
        """Generate questions for the topic using LLM. Raises error on failure."""
        if not topic or not topic.strip():
            raise ValueError("Topic cannot be empty")
        
        prompt = f"""Generate 5 multiple choice questions about {topic}.

Each question should:
1. Test a different key concept related to {topic}
2. Have 4 options (A, B, C, D)
3. Be challenging enough that students might have misconceptions
4. Include common wrong answer traps

Return JSON array:
[
    {{
        "prompt": "Question text with proper notation",
        "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
        "correct_answer": "A",
        "concept": "concept_name",
        "difficulty": 0.5,
        "explanation": "Why the correct answer is right"
    }}
]"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Extract JSON
        start = text.find("[")
        end = text.rfind("]") + 1
        if start < 0 or end <= start:
            raise ValueError(f"Failed to parse questions from LLM response for topic: {topic}")
        
        questions_data = json.loads(text[start:end])
        if not questions_data:
            raise ValueError(f"No questions generated for topic: {topic}")
        
        return [
            Question(
                id=i,
                prompt=q["prompt"],
                options=q["options"],
                correct_answer=q["correct_answer"],
                concept=q["concept"],
                difficulty=q.get("difficulty", 0.5),
                explanation=q.get("explanation", "")
            )
            for i, q in enumerate(questions_data)
        ]
    
    def _create_ai_students(self, n: int) -> List[AIStudent]:
        """Create diverse AI students."""
        personas = [
            ("overconfident", 0.7, 0.3, 0.2, ["quantifier_flip", "contrapositive_confusion"]),
            ("competent", 0.8, 0.0, 0.3, []),
            ("average", 0.5, 0.0, 0.5, ["off_by_one"]),
            ("novice", 0.3, -0.2, 0.8, ["negation_scope", "subset_membership"]),
        ]
        
        names = [
            "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank",
            "Grace", "Henry", "Ivy", "Jack", "Kate", "Leo"
        ]
        
        students = []
        for i in range(n):
            persona_data = personas[i % len(personas)]
            students.append(AIStudent(
                id=i + 1,
                name=names[i % len(names)],
                persona=persona_data[0],
                knowledge_level=persona_data[1] + random.uniform(-0.1, 0.1),
                confidence_bias=persona_data[2],
                susceptibility=persona_data[3],
                misconceptions=list(persona_data[4])
            ))
        
        return students
    
    def run_question_phase(self, progress_callback=None) -> Dict[str, Any]:
        """Run the initial voting phase for current question."""
        if not self.state:
            return {"error": "No session active"}
        
        question = self.state.questions[self.state.current_question_idx]
        self.state.phase = "voting"
        
        responses = []
        
        def get_student_response(student: AIStudent) -> Dict:
            """Get one student's response with realistic error injection."""
            rs = self.reasoning_students[student.id]
            
            # Generate answer with reasoning - returns (answer, ReasoningChain)
            try:
                answer, reasoning_chain = rs.reason_about_question({
                    "prompt": question.prompt,
                    "options": question.options,
                    "concept": question.concept
                })
                
                student.current_answer = answer
                student.current_reasoning = reasoning_chain.to_string() if reasoning_chain else ""
                student.reasoning_steps = reasoning_chain.steps if reasoning_chain else []
                student.confidence = reasoning_chain.confidence if reasoning_chain else 0.5
            except Exception as e:
                print(f"Error in reason_about_question for {student.name}: {e}")
                # Fallback - random answer
                student.current_answer = random.choice(["A", "B", "C", "D"])
                student.current_reasoning = "I'm not sure about this."
                student.reasoning_steps = []
                student.confidence = 0.3
            
            # ===== CRITICAL: ERROR INJECTION FOR REALISTIC SIMULATION =====
            # Students with lower knowledge_level should often get wrong answers
            # This ensures diverse answers and triggers debates
            
            error_probability = 1.0 - student.knowledge_level  # 0.3 → 70% error rate
            
            if random.random() < error_probability:
                # Pick a WRONG answer with misconception-based reasoning
                correct = question.correct_answer[0].upper()
                wrong_options = [opt[0] for opt in question.options if opt[0].upper() != correct]
                
                if wrong_options:
                    student.current_answer = random.choice(wrong_options)
                    
                    # Generate misconception-based explanation
                    misconception_reasons = {
                        "quantifier": [
                            "I confused ∀ and ∃ - they seem interchangeable to me",
                            "I forgot that negation swaps the quantifier type", 
                            "I thought the scope of the quantifier was different",
                        ],
                        "set": [
                            "I mixed up ⊆ and ∈ - they both mean 'in' right?",
                            "I forgot that intersection and union have different properties",
                            "I thought subset relation works the other way",
                        ],
                        "proof": [
                            "I confused contrapositive with converse",
                            "I forgot how proof by contradiction starts",
                            "I mixed up direct proof with contrapositive",
                        ],
                        "predicate": [
                            "I had trouble parsing the nested quantifiers",
                            "I wasn't sure about the order of operations",
                            "I thought the predicate variables were independent",
                        ],
                    }
                    
                    # Find matching misconception
                    concept_lower = question.concept.lower()
                    for key, reasons in misconception_reasons.items():
                        if key in concept_lower:
                            student.current_reasoning = random.choice(reasons)
                            break
                    else:
                        student.current_reasoning = f"I'm not confident, but I think it's {student.current_answer}"
                    
                    student.confidence = random.uniform(0.3, 0.6)
                    
                    # Overconfident students stay confident even when wrong
                    if student.persona == "overconfident":
                        student.confidence = random.uniform(0.7, 0.9)
                        student.current_reasoning = f"I'm certain it's {student.current_answer}. " + student.current_reasoning
            
            is_correct = student.current_answer[0].upper() == question.correct_answer[0].upper()
            
            return {
                "student_id": student.id,
                "student_name": student.name,
                "persona": student.persona,
                "answer": student.current_answer,
                "is_correct": is_correct,
                "confidence": student.confidence,
                "reasoning": student.current_reasoning,
                "reasoning_steps": student.reasoning_steps
            }
        
        # Parallel execution
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = [executor.submit(get_student_response, s) for s in self.state.students]
            for i, future in enumerate(futures):
                try:
                    resp = future.result(timeout=30)
                    responses.append(resp)
                    if progress_callback:
                        progress_callback(f"Student {i+1}/{len(self.state.students)} responded")
                except Exception as e:
                    print(f"Response error: {e}")
        
        self.state.responses[question.id] = responses
        
        # Calculate stats
        correct_count = sum(1 for r in responses if r["is_correct"])
        accuracy = correct_count / len(responses) if responses else 0
        
        # Update adaptive engine
        adaptive_engine.update_after_question(
            {"id": question.id, "concept": question.concept, "difficulty": question.difficulty},
            accuracy
        )
        
        return {
            "question": asdict(question),
            "responses": responses,
            "accuracy": accuracy,
            "total_students": len(responses),
            "correct_count": correct_count
        }
    
    def run_peer_discussion(self, progress_callback=None) -> Dict[str, Any]:
        """Run peer discussion phase with debates."""
        if not self.state:
            return {"error": "No session active"}
        
        question = self.state.questions[self.state.current_question_idx]
        responses = self.state.responses.get(question.id, [])
        self.state.phase = "discussion"
        
        # Group by answer
        answer_groups: Dict[str, List[Dict]] = {}
        for resp in responses:
            ans = resp["answer"][0].upper()
            if ans not in answer_groups:
                answer_groups[ans] = []
            answer_groups[ans].append(resp)
        
        debates = []
        mind_changes = []
        
        # Pair students with different answers for debates
        answers = list(answer_groups.keys())
        if len(answers) >= 2:
            for i in range(min(3, len(answer_groups[answers[0]]), len(answer_groups[answers[1]]))):
                student_a_resp = answer_groups[answers[0]][i]
                student_b_resp = answer_groups[answers[1]][i]
                
                student_a = next(s for s in self.state.students if s.id == student_a_resp["student_id"])
                student_b = next(s for s in self.state.students if s.id == student_b_resp["student_id"])
                
                rs_a = self.reasoning_students[student_a.id]
                rs_b = self.reasoning_students[student_b.id]
                
                if progress_callback:
                    progress_callback(f"Debate: {student_a.name} vs {student_b.name}")
                
                # Construct initial positions for debate engine
                chain_a = ReasoningChain(
                    steps=student_a.reasoning_steps,
                    conclusion=student_a.current_reasoning,
                    confidence=student_a.confidence
                )
                chain_b = ReasoningChain(
                    steps=student_b.reasoning_steps,
                    conclusion=student_b.current_reasoning,
                    confidence=student_b.confidence
                )
                
                initial_positions = {
                    student_a.id: (student_a.current_answer, chain_a),
                    student_b.id: (student_b.current_answer, chain_b)
                }
                
                # Run debate
                debate_result = self.debate_engine.run_debate(
                    rs_a, rs_b,
                    {
                        "prompt": question.prompt,
                        "options": question.options,
                        "correct_answer": question.correct_answer,
                        "concept": question.concept
                    },
                    initial_positions=initial_positions,
                    max_turns=2
                )
                
                # Get debate data
                transcript_dicts = [
                    {
                        "turn": t.turn_number,
                        "speaker": t.speaker_name,
                        "position": t.position.answer,
                        "argument": t.argument,
                        "changed_mind": t.changed_mind
                    }
                    for t in debate_result.turns
                ]
                
                # Get LLM judge evaluation
                judgment = debate_judge.evaluate_debate(
                    debate_id=f"debate_{question.id}_{i}",
                    question={
                        "prompt": question.prompt,
                        "options": question.options,
                        "correct_answer": question.correct_answer
                    },
                    student_a={
                        "id": student_a.id,
                        "name": student_a.name,
                        "initial_answer": student_a_resp["answer"],
                        "final_answer": debate_result.final_positions.get(student_a.id, student_a_resp["answer"]),
                        "initial_reasoning": student_a_resp["reasoning"]
                    },
                    student_b={
                        "id": student_b.id,
                        "name": student_b.name,
                        "initial_answer": student_b_resp["answer"],
                        "final_answer": debate_result.final_positions.get(student_b.id, student_b_resp["answer"]),
                        "initial_reasoning": student_b_resp["reasoning"]
                    },
                    debate_transcript=transcript_dicts
                )
                
                debates.append({
                    "student_a": {"id": student_a.id, "name": student_a.name},
                    "student_b": {"id": student_b.id, "name": student_b.name},
                    "transcript": transcript_dicts,
                    "judgment": judgment.to_dict() if judgment else {},
                    "mind_changes": debate_result.belief_changes
                })
                
                # Track mind changes
                student_a_changed = debate_result.final_positions[student_a.id] != debate_result.initial_positions[student_a.id]
                if student_a_changed:
                    student_a.changed_answer = True
                    student_a.current_answer = debate_result.final_positions.get(student_a.id, student_a.current_answer)
                    mind_changes.append({"student": student_a.name, "from": student_a_resp["answer"], "to": student_a.current_answer})
                
                student_b_changed = debate_result.final_positions[student_b.id] != debate_result.initial_positions[student_b.id]
                if student_b_changed:
                    student_b.changed_answer = True
                    student_b.current_answer = debate_result.final_positions.get(student_b.id, student_b.current_answer)
                    mind_changes.append({"student": student_b.name, "from": student_b_resp["answer"], "to": student_b.current_answer})
                
                # Record in graph database
                graph_db.record_debate(
                    student_a.id, student_b.id,
                    judgment.reasoning if judgment else "completed",
                    bool(mind_changes)
                )
        
        self.state.debates.extend(debates)
        
        return {
            "debates": debates,
            "mind_changes": mind_changes,
            "total_debates": len(debates)
        }
    
    def run_revote(self, progress_callback=None) -> Dict[str, Any]:
        """Run post-discussion revote."""
        if not self.state:
            return {"error": "No session active"}
        
        question = self.state.questions[self.state.current_question_idx]
        self.state.phase = "reveal"
        
        post_responses = []
        
        for student in self.state.students:
            is_correct = student.current_answer[0].upper() == question.correct_answer[0].upper()
            
            post_responses.append({
                "student_id": student.id,
                "student_name": student.name,
                "answer": student.current_answer,
                "is_correct": is_correct,
                "confidence": student.confidence,
                "changed": student.changed_answer
            })
            
            # Record in database
            agent_memory.record_interaction(
                student_id=student.id,
                question={"id": question.id, "concept": question.concept},
                answer=student.current_answer,
                reasoning=student.current_reasoning,
                is_correct=is_correct,
                confidence=student.confidence,
                is_post_discussion=True
            )
            
            # Tag misconceptions for wrong answers
            if not is_correct:
                misc_result = misconception_tagger.tag_response(
                    student_id=student.id,
                    question={"prompt": question.prompt, "concept": question.concept, "options": question.options},
                    student_answer=student.current_answer,
                    student_reasoning=student.current_reasoning,
                    correct_answer=question.correct_answer, 
                    correct_explanation=question.explanation
                )
                
                self.state.misconceptions_found.append({
                    "student": student.name,
                    "type": misc_result.misconception_type,
                    "severity": misc_result.severity.value,
                    "remediation": misc_result.suggested_remediation
                })
        
        self.state.post_discussion_responses[question.id] = post_responses
        
        # Calculate learning gain
        initial = self.state.responses.get(question.id, [])
        initial_correct = sum(1 for r in initial if r["is_correct"]) / len(initial) if initial else 0
        final_correct = sum(1 for r in post_responses if r["is_correct"]) / len(post_responses) if post_responses else 0
        learning_gain = final_correct - initial_correct
        self.state.learning_gains.append(learning_gain)
        
        return {
            "post_responses": post_responses,
            "initial_accuracy": initial_correct,
            "final_accuracy": final_correct,
            "learning_gain": learning_gain,
            "correct_answer": question.correct_answer,
            "explanation": question.explanation
        }
    
    def next_question(self) -> bool:
        """Move to next question. Returns False if no more questions."""
        if not self.state:
            return False
        
        self.state.current_question_idx += 1
        
        # Reset student states
        for student in self.state.students:
            student.current_answer = None
            student.current_reasoning = ""
            student.reasoning_steps = []
            student.changed_answer = False
        
        return self.state.current_question_idx < len(self.state.questions)
    
    def get_session_summary(self) -> Dict[str, Any]:
        """Get complete session summary."""
        if not self.state:
            return {"error": "No session active"}
        
        return {
            "session_id": self.state.session_id,
            "topic": self.state.topic,
            "total_questions": len(self.state.questions),
            "questions_completed": self.state.current_question_idx + 1,
            "total_students": len(self.state.students),
            "average_learning_gain": sum(self.state.learning_gains) / len(self.state.learning_gains) if self.state.learning_gains else 0,
            "total_debates": len(self.state.debates),
            "misconceptions_found": self.state.misconceptions_found,
            "analytics": agent_memory.get_class_analytics()
        }


# ============================================================================
# GRADIO INTERFACE
# ============================================================================

simulation = ClassroomSimulation()

def create_interface():
    """Create the Gradio interface."""
    
    with gr.Blocks(
        title="🎓 Quizly Classroom Simulation",
        theme=gr.themes.Soft(),
        css="""
        .student-card { border: 1px solid #ddd; padding: 10px; margin: 5px; border-radius: 8px; }
        .correct { background-color: #d4edda; }
        .incorrect { background-color: #f8d7da; }
        .debate-box { background: #f0f0f0; padding: 15px; border-radius: 10px; margin: 10px 0; }
        .mind-change { color: #856404; font-weight: bold; }
        """
    ) as demo:
        
        gr.Markdown("# 🎓 Quizly Full Classroom Simulation")
        gr.Markdown("### Simultaneous Teacher + AI Students")
        
        # Session state
        session_started = gr.State(False)
        
        with gr.Row():
            # ===== LEFT: Teacher Dashboard =====
            with gr.Column(scale=1):
                gr.Markdown("## 👨‍🏫 Teacher Dashboard")
                
                with gr.Group():
                    gr.Markdown("### Session Control")
                    topic_input = gr.Textbox(
                        value="",
                        label="Topic",
                        placeholder="Enter any topic (e.g., 'Designing a function C++', 'Machine Learning basics')...",
                        interactive=True
                    )
                    num_students = gr.Slider(4, 20, value=12, step=1, label="Number of AI Students")
                    start_btn = gr.Button("🚀 Start Session", variant="primary", size="lg")
                
                with gr.Group():
                    gr.Markdown("### Current Question")
                    question_display = gr.Markdown("*Click Start Session to begin*")
                    question_num = gr.Markdown("")
                
                with gr.Group():
                    gr.Markdown("### Phase Control")
                    with gr.Row():
                        vote_btn = gr.Button("📊 Collect Votes", interactive=False)
                        discuss_btn = gr.Button("💬 Peer Discussion", interactive=False)
                        reveal_btn = gr.Button("✅ Reveal & Analyze", interactive=False)
                        next_btn = gr.Button("➡️ Next Question", interactive=False)
                
                with gr.Group():
                    gr.Markdown("### Live Statistics")
                    stats_display = gr.Markdown("*Waiting for session...*")
                
                with gr.Accordion("📈 Learning Analytics", open=False):
                    analytics_display = gr.Markdown("*Analytics will appear here*")
            
            # ===== RIGHT: Student View =====
            with gr.Column(scale=1):
                gr.Markdown("## 👥 AI Student Responses")
                
                with gr.Tabs():
                    with gr.TabItem("📝 Initial Votes"):
                        initial_votes_display = gr.HTML("<p>Waiting for votes...</p>")
                    
                    with gr.TabItem("💬 Debates"):
                        debates_display = gr.HTML("<p>No debates yet...</p>")
                    
                    with gr.TabItem("📊 Final Results"):
                        final_results_display = gr.HTML("<p>Waiting for results...</p>")
                    
                    with gr.TabItem("🧠 Misconceptions"):
                        misconceptions_display = gr.HTML("<p>No misconceptions detected...</p>")
        
        with gr.Row():
            gr.Markdown("---")
        
        with gr.Group():
            gr.Markdown("### 📜 Session Log")
            log_display = gr.Markdown("*Session log will appear here*")
        
        # ===== CALLBACKS =====
        
        def start_session(topic, n_students):
            """Start a new session."""
            log = []
            log.append(f"🚀 Starting session: **{topic}** with {n_students} AI students")
            
            session_id = simulation.setup_session(topic, int(n_students))
            log.append(f"✅ Session created: `{session_id}`")
            log.append(f"📚 Generated {len(simulation.state.questions)} questions")
            
            # Format question
            q = simulation.state.questions[0]
            q_html = f"**Q1:** {q.prompt}\n\n"
            for opt in q.options:
                q_html += f"- {opt}\n"
            
            # Student summary
            personas = {}
            for s in simulation.state.students:
                personas[s.persona] = personas.get(s.persona, 0) + 1
            
            student_summary = "**Students:**\n"
            for persona, count in personas.items():
                student_summary += f"- {persona.title()}: {count}\n"
            
            stats = f"""
**Session:** `{session_id}`

**Topic:** {topic}

**Questions:** {len(simulation.state.questions)}

{student_summary}
"""
            
            return (
                q_html,
                f"Question 1 of {len(simulation.state.questions)}",
                stats,
                "\n".join(log),
                True,  # session_started
                gr.update(interactive=True),  # vote_btn
                gr.update(interactive=False),  # discuss_btn
                gr.update(interactive=False),  # reveal_btn
                gr.update(interactive=False),  # next_btn
            )
        
        def collect_votes():
            """Collect initial votes from all students."""
            log = ["📊 **Collecting votes...**"]
            
            def progress(msg):
                log.append(f"  - {msg}")
            
            result = simulation.run_question_phase(progress)
            
            # Format responses as HTML
            html = "<div style='display: flex; flex-wrap: wrap;'>"
            for resp in result["responses"]:
                correct_class = "correct" if resp["is_correct"] else "incorrect"
                html += f"""
                <div class='student-card {correct_class}' style='width: 180px;'>
                    <strong>{resp["student_name"]}</strong> ({resp["persona"]})<br>
                    Answer: <b>{resp["answer"]}</b><br>
                    Confidence: {resp["confidence"]:.0%}<br>
                    <small>{resp["reasoning"][:60]}...</small>
                </div>
                """
            html += "</div>"
            
            # Stats
            stats = f"""
**Current Question:** {simulation.state.current_question_idx + 1}

**Responses:** {result["total_students"]}

**Correct:** {result["correct_count"]} ({result["accuracy"]:.0%})

**Answer Distribution:**
"""
            # Count answers
            answer_counts = {}
            for r in result["responses"]:
                a = r["answer"][0].upper()
                answer_counts[a] = answer_counts.get(a, 0) + 1
            
            for ans, count in sorted(answer_counts.items()):
                bar = "█" * count
                stats += f"\n- **{ans}:** {bar} ({count})"
            
            log.append(f"✅ Collected {result['total_students']} responses")
            log.append(f"📈 Initial accuracy: **{result['accuracy']:.0%}**")
            
            return (
                html,
                stats,
                "\n".join(log),
                gr.update(interactive=False),  # vote_btn
                gr.update(interactive=True),   # discuss_btn
                gr.update(interactive=False),  # reveal_btn
            )
        
        def run_discussion():
            """Run peer discussion phase."""
            log = ["💬 **Starting peer discussions...**"]
            
            def progress(msg):
                log.append(f"  - {msg}")
            
            result = simulation.run_peer_discussion(progress)
            
            # Format debates as HTML
            html = ""
            for i, debate in enumerate(result["debates"]):
                html += f"""
                <div class='debate-box'>
                    <h4>Debate {i+1}: {debate["student_a"]["name"]} vs {debate["student_b"]["name"]}</h4>
                """
                
                for turn in debate.get("transcript", [])[:4]:
                    speaker = turn.get("speaker_name", "Student")
                    arg = turn.get("argument", "...")[:200]
                    changed = " ⚡ CONVINCED!" if turn.get("changed_mind") else ""
                    html += f"<p><b>{speaker}:</b> {arg}{changed}</p>"
                
                if debate.get("judgment"):
                    j = debate["judgment"]
                    html += f"<p><em>🏆 Winner: {j.get('winner_name', 'None')}</em></p>"
                    html += f"<p><small>{j.get('reasoning', '')[:150]}</small></p>"
                
                html += "</div>"
            
            if result["mind_changes"]:
                html += "<h4>🔄 Mind Changes:</h4><ul>"
                for mc in result["mind_changes"]:
                    html += f"<li class='mind-change'>{mc['student']}: {mc['from']} → {mc['to']}</li>"
                html += "</ul>"
            
            log.append(f"✅ Completed {result['total_debates']} debates")
            log.append(f"🔄 {len(result['mind_changes'])} students changed their minds")
            
            return (
                html if html else "<p>No debates (consensus reached)</p>",
                "\n".join(log),
                gr.update(interactive=False),  # discuss_btn
                gr.update(interactive=True),   # reveal_btn
            )
        
        def reveal_results():
            """Reveal correct answer and analyze."""
            log = ["✅ **Revealing results...**"]
            
            result = simulation.run_revote()
            q = simulation.state.questions[simulation.state.current_question_idx]
            
            # Format results
            html = f"""
            <div style='background: #e8f5e9; padding: 20px; border-radius: 10px;'>
                <h3>✅ Correct Answer: {q.correct_answer}</h3>
                <p>{q.explanation}</p>
            </div>
            
            <h4>📊 Learning Gain: {result['learning_gain']:+.0%}</h4>
            <p>Initial: {result['initial_accuracy']:.0%} → Final: {result['final_accuracy']:.0%}</p>
            
            <h4>Student Results:</h4>
            <div style='display: flex; flex-wrap: wrap;'>
            """
            
            for resp in result["post_responses"]:
                correct_class = "correct" if resp["is_correct"] else "incorrect"
                changed = " 🔄" if resp["changed"] else ""
                html += f"""
                <div class='student-card {correct_class}' style='width: 150px;'>
                    <strong>{resp["student_name"]}</strong>{changed}<br>
                    Answer: <b>{resp["answer"]}</b>
                </div>
                """
            
            html += "</div>"
            
            # Misconceptions
            misc_html = ""
            for misc in simulation.state.misconceptions_found:
                misc_html += f"""
                <div style='background: #fff3cd; padding: 10px; margin: 5px; border-radius: 5px;'>
                    <strong>{misc['student']}</strong>: {misc['type']}<br>
                    <small>Severity: {misc['severity']} | {misc['remediation'][:80]}...</small>
                </div>
                """
            
            log.append(f"📊 Learning gain: **{result['learning_gain']:+.0%}**")
            log.append(f"🧠 Found {len(simulation.state.misconceptions_found)} misconceptions")
            
            can_continue = simulation.state.current_question_idx < len(simulation.state.questions) - 1
            
            return (
                html,
                misc_html if misc_html else "<p>No misconceptions detected!</p>",
                "\n".join(log),
                gr.update(interactive=False),  # reveal_btn
                gr.update(interactive=can_continue),  # next_btn
            )
        
        def next_question():
            """Move to next question."""
            if not simulation.next_question():
                summary = simulation.get_session_summary()
                return (
                    "**Session Complete!** 🎉",
                    "",
                    f"**Session Summary:**\n\nLearning Gain: {summary['average_learning_gain']:.0%}\nDebates: {summary['total_debates']}",
                    "<p>Session complete!</p>",
                    gr.update(interactive=False),
                    gr.update(interactive=False),
                    gr.update(interactive=False),
                    gr.update(interactive=False),
                )
            
            q = simulation.state.questions[simulation.state.current_question_idx]
            q_html = f"**Q{simulation.state.current_question_idx + 1}:** {q.prompt}\n\n"
            for opt in q.options:
                q_html += f"- {opt}\n"
            
            return (
                q_html,
                f"Question {simulation.state.current_question_idx + 1} of {len(simulation.state.questions)}",
                gr.update(),  # stats unchanged
                "<p>Click 'Collect Votes' to begin...</p>",
                gr.update(interactive=True),   # vote_btn
                gr.update(interactive=False),  # discuss_btn
                gr.update(interactive=False),  # reveal_btn
                gr.update(interactive=False),  # next_btn
            )
        
        # Wire up buttons
        start_btn.click(
            start_session,
            inputs=[topic_input, num_students],
            outputs=[
                question_display, question_num, stats_display, log_display,
                session_started, vote_btn, discuss_btn, reveal_btn, next_btn
            ]
        )
        
        vote_btn.click(
            collect_votes,
            outputs=[initial_votes_display, stats_display, log_display, vote_btn, discuss_btn, reveal_btn]
        )
        
        discuss_btn.click(
            run_discussion,
            outputs=[debates_display, log_display, discuss_btn, reveal_btn]
        )
        
        reveal_btn.click(
            reveal_results,
            outputs=[final_results_display, misconceptions_display, log_display, reveal_btn, next_btn]
        )
        
        next_btn.click(
            next_question,
            outputs=[question_display, question_num, stats_display, initial_votes_display, vote_btn, discuss_btn, reveal_btn, next_btn]
        )
    
    return demo


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("🎓 Starting Quizly Full Classroom Simulation...")
    print("📚 Enter any topic to generate questions dynamically")
    print("🤖 AI Students with diverse personas")
    print()
    
    demo = create_interface()
    demo.launch(
        server_name="0.0.0.0",
        server_port=7875,
        share=False,
        show_error=True
    )

#!/usr/bin/env python3
"""
Quizly TEACHER DASHBOARD v2 - Curriculum Development
=====================================================
Enhanced teacher dashboard with:
1. Material Upload - PDFs, images, text for AI context
2. Question Curation - Approve/Edit/Reject AI questions
3. Learning Objectives - Map questions to objectives
4. Question Bank - Save and reuse questions
"""

import os
import json
import time
import random
import base64
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
from threading import Lock

import gradio as gr

# Document Processor - Native Gemini PDF understanding
try:
    from document_processor import DocumentProcessor, process_materials_efficient
    DOC_PROCESSOR_AVAILABLE = True
    doc_processor = DocumentProcessor()
except ImportError:
    DOC_PROCESSOR_AVAILABLE = False
    doc_processor = None
    print("⚠️ Document processor not available")

# Shared Session Store - connects teacher and student dashboards
try:
    import shared_session
    SHARED_SESSION_AVAILABLE = True
except ImportError:
    SHARED_SESSION_AVAILABLE = False
    print("⚠️ Shared session not available")

# RAG System for materials (fallback)
try:
    from rag_system import RAGSystem
    RAG_AVAILABLE = True
    rag_system = RAGSystem()
except ImportError:
    RAG_AVAILABLE = False
    rag_system = None

# Gemini setup
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if GEMINI_API_KEY and GEMINI_AVAILABLE:
    genai.configure(api_key=GEMINI_API_KEY)
    MODEL = genai.GenerativeModel('gemini-2.0-flash')
    print("✅ Gemini API configured")
else:
    MODEL = None
    print("⚠️ GEMINI_API_KEY not set")


# ============================================================================
# SHARED SESSION STATE
# ============================================================================

class SharedSession:
    """Shared state between teacher and student dashboards."""
    
    _instance = None
    _lock = Lock()
    STATE_FILE = Path(__file__).parent / ".shared_session_state.json"
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._init_state()
        return cls._instance
    
    def _init_state(self):
        self.session_id = None
        self.topic = ""
        self.concepts = []
        self.questions = []
        self.pending_questions = []  # Questions awaiting approval
        self.approved_questions = []  # Approved questions
        self.materials = []  # Uploaded materials context
        self.objectives = []  # Learning objectives
        self.current_question_idx = 0
        self.student_responses = {}
        self.teacher_decisions = {}
        self.is_active = False
        self.created_at = None
        self.students_joined = []
    
    def _save_to_file(self):
        with self._lock:
            state = {
                "session_id": self.session_id,
                "topic": self.topic,
                "concepts": self.concepts,
                "questions": self.questions,
                "pending_questions": self.pending_questions,
                "approved_questions": self.approved_questions,
                "materials": self.materials,
                "objectives": self.objectives,
                "current_question_idx": self.current_question_idx,
                "student_responses": self.student_responses,
                "teacher_decisions": self.teacher_decisions,
                "is_active": self.is_active,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "students_joined": self.students_joined
            }
            try:
                with open(self.STATE_FILE, 'w') as f:
                    json.dump(state, f, indent=2)
            except Exception as e:
                print(f"Error saving state: {e}")
    
    def _load_from_file(self):
        with self._lock:
            if not self.STATE_FILE.exists():
                return
            try:
                with open(self.STATE_FILE, 'r') as f:
                    state = json.load(f)
                self.session_id = state.get("session_id")
                self.topic = state.get("topic", "")
                self.concepts = state.get("concepts", [])
                self.questions = state.get("questions", [])
                self.pending_questions = state.get("pending_questions", [])
                self.approved_questions = state.get("approved_questions", [])
                self.materials = state.get("materials", [])
                self.objectives = state.get("objectives", [])
                self.current_question_idx = state.get("current_question_idx", 0)
                raw_responses = state.get("student_responses", {})
                self.student_responses = {
                    sid: {int(k): v for k, v in resps.items()}
                    for sid, resps in raw_responses.items()
                }
                raw_decisions = state.get("teacher_decisions", {})
                self.teacher_decisions = {int(k): v for k, v in raw_decisions.items()}
                self.is_active = state.get("is_active", False)
                created = state.get("created_at")
                self.created_at = datetime.fromisoformat(created) if created else None
                self.students_joined = state.get("students_joined", [])
            except Exception as e:
                print(f"Error loading state: {e}")
    
    def reset(self):
        self._init_state()
        self._save_to_file()
    
    def start_session(self, topic: str, concepts: List[str], questions: List[Dict]):
        self.reset()
        self.session_id = f"session_{datetime.now().strftime('%H%M%S')}"
        self.topic = topic
        self.concepts = concepts
        self.questions = questions
        self.is_active = True
        self.created_at = datetime.now()
        self._save_to_file()
        return self.session_id
    
    def refresh(self):
        self._load_from_file()
    
    def add_student_response(self, student_id: str, question_idx: int, response: Dict):
        self._load_from_file()
        if student_id not in self.student_responses:
            self.student_responses[student_id] = {}
        self.student_responses[student_id][question_idx] = response
        if student_id not in self.students_joined:
            self.students_joined.append(student_id)
        self._save_to_file()
    
    def get_question_responses(self, question_idx: int) -> List[Dict]:
        self._load_from_file()
        responses = []
        for student_id, student_responses in self.student_responses.items():
            if question_idx in student_responses:
                resp = student_responses[question_idx].copy()
                resp['student_id'] = student_id
                responses.append(resp)
        return responses

# Global shared session (for legacy live monitoring - renamed to avoid shadowing import)
live_session = SharedSession()


# ============================================================================
# AI FUNCTIONS WITH MATERIAL CONTEXT
# ============================================================================

def ai_extract_concepts_from_materials(materials: List[str], topic: str) -> List[str]:
    """Extract key concepts from uploaded materials."""
    if not MODEL or not materials:
        return []
    
    materials_text = "\n\n".join(materials[:5000])  # Limit context
    
    prompt = f"""Analyze these course materials and extract key concepts for a quiz on "{topic}".

MATERIALS:
{materials_text[:3000]}

Return a JSON list of 4-6 key concepts that would make good quiz questions:
["concept1", "concept2", "concept3", ...]"""

    try:
        response = MODEL.generate_content(prompt)
        text = response.text.strip()
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except Exception as e:
        print(f"Concept extraction error: {e}")
    return []


def ai_generate_questions_with_context(
    topic: str, 
    concepts: List[str], 
    num_questions: int,
    materials: List[str] = None,
    objectives: List[str] = None
) -> List[Dict]:
    """Generate questions with material context."""
    if not MODEL:
        return []
    
    material_context = ""
    if materials:
        material_context = f"""
COURSE MATERIALS (use these for specific examples and content):
{chr(10).join(materials[:3000])}
"""
    
    objectives_context = ""
    if objectives:
        objectives_context = f"""
LEARNING OBJECTIVES (align questions to these):
{chr(10).join(f'- {obj}' for obj in objectives)}
"""
    
    prompt = f"""You are an expert professor creating peer instruction questions.

TOPIC: {topic}
CONCEPTS: {', '.join(concepts)}
{material_context}
{objectives_context}

Generate {num_questions} high-quality multiple choice questions.

For EACH question:
1. Make it SPECIFIC with real content (use material examples if provided)
2. Include 4 options with ONE correct answer
3. Vary the correct answer position (A, B, C, or D)
4. Include a detailed explanation
5. Tag with the learning objective it addresses (if objectives provided)

Return JSON array:
[
    {{
        "concept": "concept_name",
        "prompt": "Specific question text",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "correct_answer": "A/B/C/D",
        "explanation": "Why correct is right and others are wrong",
        "difficulty": 0.0-1.0,
        "objective": "Which learning objective this addresses",
        "source": "From material section X" or "Generated from concept"
    }}
]"""

    try:
        print("Calling Gemini API for question generation...")
        response = MODEL.generate_content(prompt)
        print(f"Got response, length: {len(response.text)}")
        text = response.text.strip()
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            questions = json.loads(text[start:end])
            print(f"Parsed {len(questions)} questions")
            # Add status to each
            for q in questions:
                q["status"] = "pending"
                q["id"] = f"q_{random.randint(1000,9999)}"
            return questions
        else:
            print(f"No JSON array found in response: {text[:200]}...")
    except Exception as e:
        print(f"Question generation error: {e}")
    return []


def ai_regenerate_question(question: Dict, feedback: str) -> Dict:
    """Regenerate a single question with teacher feedback."""
    if not MODEL:
        return question
    
    prompt = f"""Improve this question based on teacher feedback.

ORIGINAL QUESTION:
{json.dumps(question, indent=2)}

TEACHER FEEDBACK:
{feedback}

Return an improved version as JSON with the same format."""

    try:
        response = MODEL.generate_content(prompt)
        text = response.text.strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            improved = json.loads(text[start:end])
            improved["status"] = "pending"
            improved["id"] = question.get("id", f"q_{random.randint(1000,9999)}")
            return improved
    except Exception as e:
        print(f"Regeneration error: {e}")
    return question


# ============================================================================
# TEACHER SESSION WITH CURATION
# ============================================================================

class CurriculumSession:
    """Teacher session with curriculum development features."""
    
    def __init__(self):
        self.topic = ""
        self.concepts = []
        self.materials_text = []  # Extracted text from materials
        self.objectives = []
        self.pending_questions = []  # Awaiting review
        self.approved_questions = []  # Ready to use
        self.rejected_questions = []  # Rejected
        self.question_bank = []  # Saved for reuse
    
    def add_materials(self, files, text_content, url_content) -> tuple:
        """Process materials using Gemini's native document understanding."""
        global doc_processor
        
        # Use native Gemini document processor if available
        if DOC_PROCESSOR_AVAILABLE and doc_processor:
            return process_materials_efficient(files, text_content, url_content)
        
        # Fallback to text extraction
        added = []
        all_concepts = []
        
        if files:
            for f in files:
                try:
                    if f.name.endswith(('.txt', '.md')):
                        with open(f.name, 'r') as file:
                            content = file.read()
                            self.materials_text.append(content[:5000])
                            added.append(f"📄 {Path(f.name).name}")
                            # Extract concepts with Gemini
                            if MODEL:
                                concepts = self._extract_concepts_llm(content[:3000])
                                all_concepts.extend(concepts)
                    elif f.name.endswith('.pdf'):
                        added.append(f"📕 {Path(f.name).name} (use native processor)")
                except Exception as e:
                    added.append(f"❌ {Path(f.name).name}: {e}")
        
        if text_content and text_content.strip():
            self.materials_text.append(text_content.strip()[:5000])
            added.append("📝 Pasted text")
            if MODEL:
                concepts = self._extract_concepts_llm(text_content[:3000])
                all_concepts.extend(concepts)
        
        if not added:
            return "No materials added.", "", "", ""
        
        # Dedupe concepts
        unique = []
        seen = set()
        for c in all_concepts:
            if c.lower() not in seen:
                unique.append(c)
                seen.add(c.lower())
        
        status = f"✅ Added {len(added)} materials"
        if unique:
            status += f"\n🔍 Extracted {len(unique)} concepts"
        
        # Return 4 values: status, topic (empty), concepts, objectives (empty)
        return status, "", ", ".join(unique), ""
    
    def _extract_concepts_llm(self, text: str) -> List[str]:
        """Extract concepts from text using LLM."""
        if not MODEL:
            return []
        
        prompt = f"""Extract 6-10 key educational concepts from this text.
Return ONLY a JSON array: ["concept1", "concept2", ...]

TEXT:
{text[:3000]}"""
        
        try:
            response = MODEL.generate_content(prompt)
            text = response.text.strip()
            start = text.find("[")
            end = text.rfind("]") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except Exception as e:
            print(f"Concept extraction error: {e}")
        return []
    
    def set_objectives(self, objectives_text: str) -> str:
        """Set learning objectives."""
        self.objectives = [
            obj.strip() for obj in objectives_text.split("\n") 
            if obj.strip() and not obj.strip().startswith('#')
        ]
        return f"✅ Set {len(self.objectives)} learning objectives"
    
    def generate_questions(self, topic: str, concepts_text: str, num_q: int) -> str:
        """Generate questions for review."""
        self.topic = topic
        self.concepts = [c.strip() for c in concepts_text.split(",") if c.strip()]
        
        if not self.concepts:
            return "❌ Enter at least one concept (or upload materials to extract them)"
        
        # Get context from document processor if available
        materials_context = []
        if DOC_PROCESSOR_AVAILABLE and doc_processor and doc_processor.processed_docs:
            # Get summaries from processed documents
            for doc in doc_processor.processed_docs:
                if doc.summary:
                    materials_context.append(f"From {doc.source}: {doc.summary}")
        elif self.materials_text:
            materials_context = self.materials_text
        
        # Generate questions with context
        print(f"Generating {num_q} questions for topic: {self.topic}")
        print(f"Concepts: {self.concepts}")
        print(f"Materials context: {len(materials_context)} items")
        
        questions = ai_generate_questions_with_context(
            topic=self.topic,
            concepts=self.concepts[:num_q],
            num_questions=num_q,
            materials=materials_context,
            objectives=self.objectives
        )
        
        self.pending_questions = questions
        
        if not questions:
            return "❌ Failed to generate questions. Check API key and try again."
        
        return self._format_review_queue()
    
    def _format_review_queue(self) -> str:
        """Format pending questions for review."""
        if not self.pending_questions:
            return "📋 **Review Queue Empty**\n\nAll questions have been reviewed!"
        
        output = f"# 📋 Review Queue ({len(self.pending_questions)} pending)\n\n"
        
        for i, q in enumerate(self.pending_questions):
            output += f"""---
### Q{i+1}: {q.get('concept', 'Unknown')} 
**Difficulty:** {q.get('difficulty', 0.5):.0%} | **Status:** 🟡 Pending

**{q.get('prompt', 'No prompt')}**

"""
            for opt in q.get('options', []):
                correct = "✅" if opt.startswith(q.get('correct_answer', 'X')) else ""
                output += f"- {opt} {correct}\n"
            
            if q.get('objective'):
                output += f"\n*Objective: {q['objective']}*\n"
            if q.get('source'):
                output += f"*Source: {q['source']}*\n"
            
            output += "\n"
        
        return output
    
    def approve_question(self, index: int) -> str:
        """Approve a question."""
        if 0 <= index < len(self.pending_questions):
            q = self.pending_questions.pop(index)
            q["status"] = "approved"
            self.approved_questions.append(q)
            return f"✅ Approved Q{index+1}\n\n" + self._format_review_queue()
        return "Invalid question index"
    
    def reject_question(self, index: int) -> str:
        """Reject a question."""
        if 0 <= index < len(self.pending_questions):
            q = self.pending_questions.pop(index)
            q["status"] = "rejected"
            self.rejected_questions.append(q)
            return f"❌ Rejected Q{index+1}\n\n" + self._format_review_queue()
        return "Invalid question index"
    
    def approve_all(self) -> str:
        """Approve all pending questions."""
        count = len(self.pending_questions)
        for q in self.pending_questions:
            q["status"] = "approved"
            self.approved_questions.append(q)
        self.pending_questions = []
        return f"✅ Approved all {count} questions!\n\n" + self._format_approved()
    
    def _format_approved(self) -> str:
        """Format approved questions."""
        if not self.approved_questions:
            return "No approved questions yet."
        
        output = f"# ✅ Approved Questions ({len(self.approved_questions)})\n\n"
        for i, q in enumerate(self.approved_questions):
            output += f"{i+1}. **{q.get('prompt', 'Question')[:60]}...** (Answer: {q.get('correct_answer', '?')})\n"
        return output
    
    def edit_question(self, index: int, new_prompt: str, new_correct: str) -> str:
        """Edit a pending question."""
        if 0 <= index < len(self.pending_questions):
            q = self.pending_questions[index]
            if new_prompt:
                q["prompt"] = new_prompt
            if new_correct in ['A', 'B', 'C', 'D']:
                q["correct_answer"] = new_correct
            return f"✏️ Updated Q{index+1}\n\n" + self._format_review_queue()
        return "Invalid question index"
    
    def regenerate_question(self, index: int, feedback: str) -> str:
        """Regenerate a question with feedback."""
        if 0 <= index < len(self.pending_questions):
            old_q = self.pending_questions[index]
            new_q = ai_regenerate_question(old_q, feedback)
            self.pending_questions[index] = new_q
            return f"🔄 Regenerated Q{index+1}\n\n" + self._format_review_queue()
        return "Invalid question index"
    
    def start_session(self) -> str:
        """Start session with approved questions."""
        if not self.approved_questions:
            return "❌ No approved questions. Approve some questions first!"
        
        if not SHARED_SESSION_AVAILABLE:
            return "❌ Shared session module not available!"
        
        # Start shared session - pass (topic, questions, objectives)
        session_id = shared_session.start_session(
            self.topic,
            self.approved_questions,  # Questions go second
            self.objectives  # Objectives go third
        )
        
        if not session_id:
            return "❌ Failed to start session. Check logs."
        
        return f"""# 🚀 Session Started!

**Session ID:** {session_id}
**Topic:** {self.topic}
**Questions:** {len(self.approved_questions)}

## 📱 Student Access
Tell students to go to: **http://localhost:7871**

The session is now live!
"""
    
    def save_to_bank(self) -> str:
        """Save approved questions to bank."""
        for q in self.approved_questions:
            if q not in self.question_bank:
                self.question_bank.append(q.copy())
        
        return f"💾 Saved {len(self.approved_questions)} questions to bank (Total: {len(self.question_bank)})"


# Global session
curriculum_session = CurriculumSession()


# ============================================================================
# GRADIO APP
# ============================================================================

def create_teacher_app():
    with gr.Blocks(
        title="Quizly - Teacher Dashboard v2",
        theme=gr.themes.Soft(primary_hue="emerald"),
        css=".gradio-container { max-width: 1200px !important; margin: auto; }"
    ) as app:
        
        gr.Markdown("""
        # 🎓 Quizly Teacher Dashboard v2
        
        **Curriculum Development + Session Control**
        
        Upload materials → Generate questions → Review & approve → Start session
        """)
        
        with gr.Tabs():
            # Tab 1: Materials & Setup
            with gr.Tab("📚 Materials & Setup"):
                gr.Markdown("### Upload course materials to improve AI question generation")
                
                with gr.Row():
                    with gr.Column():
                        topic_input = gr.Textbox(
                            label="Session Topic",
                            value="Sorting Algorithms in Python",
                            placeholder="e.g., Graph Algorithms, Database Design"
                        )
                        
                        concepts_input = gr.Textbox(
                            label="Key Concepts (comma-separated)",
                            value="bubble sort, merge sort, quick sort, time complexity",
                            placeholder="concept1, concept2, ..."
                        )
                        
                        with gr.Accordion("📚 Upload Course Materials", open=True):
                            material_files = gr.File(
                                label="Upload Files (PDF, TXT, Images)",
                                file_types=[".pdf", ".txt", ".md", ".png", ".jpg"],
                                file_count="multiple"
                            )
                            material_text = gr.Textbox(
                                label="Or Paste Content",
                                placeholder="Paste lecture notes, textbook excerpts, etc.",
                                lines=4
                            )
                            material_url = gr.Textbox(
                                label="Resource URL (optional)",
                                placeholder="https://docs.python.org/..."
                            )
                            add_materials_btn = gr.Button("📎 Add Materials")
                        
                        materials_status = gr.Markdown("*No materials added yet*")
                    
                    with gr.Column():
                        with gr.Accordion("🎯 Learning Objectives", open=True):
                            objectives_input = gr.Textbox(
                                label="Learning Objectives (one per line)",
                                value="Understand how bubble sort works\nCompare time complexity of sorting algorithms\nIdentify when to use each sorting algorithm",
                                lines=4
                            )
                            set_objectives_btn = gr.Button("🎯 Set Objectives")
                        
                        objectives_status = gr.Markdown("*No objectives set*")
                        
                        num_questions = gr.Slider(2, 8, value=4, step=1, label="Number of Questions")
                        
                        generate_btn = gr.Button(
                            "🤖 Generate Questions for Review",
                            variant="primary",
                            size="lg"
                        )
                
                # Events
                add_materials_btn.click(
                    curriculum_session.add_materials,
                    [material_files, material_text, material_url],
                    [materials_status, topic_input, concepts_input, objectives_input]  # Auto-populate all
                )
                
                set_objectives_btn.click(
                    curriculum_session.set_objectives,
                    [objectives_input],
                    [objectives_status]
                )
            
            # Tab 2: Question Curation
            with gr.Tab("✏️ Question Curation"):
                gr.Markdown("### Review and curate AI-generated questions")
                
                review_display = gr.Markdown("*Generate questions first*")
                
                with gr.Row():
                    with gr.Column(scale=2):
                        gr.Markdown("#### Quick Actions")
                        with gr.Row():
                            q_index = gr.Number(label="Question #", value=1, minimum=1, precision=0)
                            approve_btn = gr.Button("✅ Approve", variant="primary")
                            reject_btn = gr.Button("❌ Reject")
                            regen_btn = gr.Button("🔄 Regenerate")
                        
                        regen_feedback = gr.Textbox(
                            label="Feedback for Regeneration",
                            placeholder="Make it harder / Add a diagram / Focus more on..."
                        )
                    
                    with gr.Column(scale=1):
                        gr.Markdown("#### Bulk Actions")
                        approve_all_btn = gr.Button("✅ Approve All", variant="secondary")
                        save_bank_btn = gr.Button("💾 Save to Question Bank")
                
                gr.Markdown("---")
                
                with gr.Accordion("✏️ Edit Question", open=False):
                    edit_index = gr.Number(label="Question # to Edit", value=1, minimum=1, precision=0)
                    edit_prompt = gr.Textbox(label="New Prompt", lines=2)
                    edit_correct = gr.Radio(["A", "B", "C", "D"], label="Correct Answer")
                    edit_btn = gr.Button("💾 Save Edit")
                
                approved_display = gr.Markdown()
                
                # Generate questions event
                generate_btn.click(
                    curriculum_session.generate_questions,
                    [topic_input, concepts_input, num_questions],
                    [review_display]
                )
                
                # Curation events
                approve_btn.click(
                    lambda i: curriculum_session.approve_question(int(i)-1),
                    [q_index],
                    [review_display]
                )
                reject_btn.click(
                    lambda i: curriculum_session.reject_question(int(i)-1),
                    [q_index],
                    [review_display]
                )
                regen_btn.click(
                    lambda i, f: curriculum_session.regenerate_question(int(i)-1, f),
                    [q_index, regen_feedback],
                    [review_display]
                )
                approve_all_btn.click(
                    curriculum_session.approve_all,
                    outputs=[approved_display]
                )
                edit_btn.click(
                    lambda i, p, c: curriculum_session.edit_question(int(i)-1, p, c),
                    [edit_index, edit_prompt, edit_correct],
                    [review_display]
                )
                save_bank_btn.click(
                    curriculum_session.save_to_bank,
                    outputs=[approved_display]
                )
            
            # Tab 3: Start Session
            with gr.Tab("🚀 Start Session"):
                gr.Markdown("### Launch your session for students")
                
                with gr.Row():
                    with gr.Column():
                        approved_summary = gr.Markdown()
                        
                        refresh_approved_btn = gr.Button("🔄 Refresh Approved Questions")
                        start_session_btn = gr.Button(
                            "▶️ Start Session",
                            variant="primary",
                            size="lg"
                        )
                    
                    with gr.Column():
                        session_status = gr.Markdown("*Session not started*")
                
                refresh_approved_btn.click(
                    curriculum_session._format_approved,
                    outputs=[approved_summary]
                )
                start_session_btn.click(
                    curriculum_session.start_session,
                    outputs=[session_status]
                )
            
            # Tab 4: Live Monitoring
            with gr.Tab("📊 Live Monitoring"):
                gr.Markdown("### Monitor student responses in real-time")
                
                with gr.Row():
                    refresh_live_btn = gr.Button("🔄 Refresh Status")
                
                live_display = gr.Markdown("*Start a session to see live data*")
                
                def get_live_status():
                    live_session.refresh()
                    if not live_session.is_active:
                        return "⏸️ No active session"
                    
                    q_idx = live_session.current_question_idx
                    responses = live_session.get_question_responses(q_idx)
                    
                    return f"""# 📊 Live Status

**Session:** {live_session.session_id}
**Topic:** {live_session.topic}
**Students:** {len(live_session.students_joined)}
**Current Question:** {q_idx + 1} / {len(live_session.questions)}
**Responses:** {len(responses)}

### Students Joined
{', '.join(live_session.students_joined) or 'None yet'}
"""
                
                refresh_live_btn.click(get_live_status, outputs=[live_display])
        
        gr.Markdown("""
        ---
        **Student Dashboard:** [localhost:7871](http://localhost:7871) | 
        **Teacher Dashboard:** localhost:7872
        """)
    
    return app


if __name__ == "__main__":
    print("🎓 Starting Teacher Dashboard v2 on http://localhost:7872")
    print("📚 Features: Material Upload, Question Curation, Learning Objectives")
    app = create_teacher_app()
    app.launch(server_name="0.0.0.0", server_port=7872, share=False, show_error=True)

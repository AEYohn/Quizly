#!/usr/bin/env python3
"""
Quizly Multimodal Student Experience
====================================
Enhanced student experience with multimodal input:
1. Code submissions with syntax highlighting
2. Diagram/image uploads with AI analysis
3. Written text/essay responses
4. Smart input type based on topic/question

The LLM adapts analysis based on input modality.
"""

import os
import json
import base64
import time
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

import gradio as gr

# Configure Gemini
try:
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        # Use gemini-2.0-flash for text and multimodal
        MODEL = genai.GenerativeModel('gemini-2.0-flash')
        GEMINI_AVAILABLE = True
    else:
        MODEL = None
        GEMINI_AVAILABLE = False
except ImportError:
    MODEL = None
    GEMINI_AVAILABLE = False

# Try to import shared session
try:
    import shared_session as ss
    SHARED_SESSION_AVAILABLE = True
except ImportError:
    ss = None
    SHARED_SESSION_AVAILABLE = False
    print("⚠️ Running in standalone mode - sessions not connected to teacher")

print("✅ Gemini API configured" if GEMINI_AVAILABLE else "⚠️ No Gemini API")


# ============================================================================
# INPUT TYPE DETECTION
# ============================================================================

def detect_input_type(topic: str, question: Dict) -> str:
    """
    Detect what type of input is most appropriate for this question/topic.
    Returns: 'mcq', 'code', 'diagram', 'text', or 'mixed'
    """
    topic_lower = topic.lower()
    prompt_lower = question.get("prompt", "").lower()
    
    # Code-heavy topics
    code_keywords = ['programming', 'code', 'python', 'java', 'c++', 'algorithm', 
                     'function', 'class', 'implement', 'write a program', 'debug',
                     'syntax', 'compile', 'runtime', 'data structure']
    
    # Diagram-heavy topics  
    diagram_keywords = ['draw', 'diagram', 'graph', 'tree', 'flowchart', 'circuit',
                        'architecture', 'uml', 'network', 'sketch', 'visualize',
                        'state machine', 'entity relationship', 'er diagram']
    
    # Essay/text topics
    text_keywords = ['explain', 'describe', 'discuss', 'compare', 'analyze',
                     'essay', 'paragraph', 'writing', 'argument', 'thesis']
    
    # Check question prompt first
    if any(kw in prompt_lower for kw in diagram_keywords):
        return 'diagram'
    if any(kw in prompt_lower for kw in ['write code', 'implement', 'function', 'program']):
        return 'code'
    if any(kw in prompt_lower for kw in ['explain in detail', 'write an essay', 'discuss']):
        return 'text'
    
    # Check if question has MCQ options
    if question.get("options") and len(question.get("options", [])) >= 2:
        # MCQ but could also benefit from explanation
        if any(kw in topic_lower for kw in code_keywords):
            return 'mcq_with_code'  # MCQ + optional code
        return 'mcq'
    
    # Fallback based on topic
    if any(kw in topic_lower for kw in code_keywords):
        return 'code'
    if any(kw in topic_lower for kw in diagram_keywords):
        return 'diagram'
    
    return 'mcq'  # Default


# ============================================================================
# MULTIMODAL AI FUNCTIONS
# ============================================================================

def ai_analyze_multimodal(question: Dict, response_data: Dict) -> Dict:
    """
    Analyze a student's multimodal response.
    
    response_data can contain:
    - answer: MCQ selection (A, B, C, D)
    - code: Code submission
    - text: Written explanation
    - image: Image/diagram (base64 or file path)
    - reasoning: General reasoning text
    """
    if not GEMINI_AVAILABLE:
        return {
            "is_correct": False,
            "score": 50,
            "feedback": "Answer recorded. AI analysis unavailable.",
            "code_feedback": None,
            "diagram_feedback": None
        }
    
    # Build prompt based on what was submitted
    prompt_parts = [f"""You are an expert tutor analyzing a student's response.

QUESTION: {question.get('prompt', '')}
"""]
    
    if question.get('options'):
        prompt_parts.append(f"OPTIONS: {question.get('options', [])}")
        prompt_parts.append(f"CORRECT ANSWER: {question.get('correct_answer', '')}")
    
    prompt_parts.append("\nSTUDENT'S SUBMISSION:")
    
    # Add MCQ answer if provided
    if response_data.get('answer'):
        prompt_parts.append(f"- Selected Answer: {response_data['answer']}")
    
    # Add code if provided
    if response_data.get('code'):
        prompt_parts.append(f"""
- Code Submission:
```
{response_data['code']}
```
""")
    
    # Add text explanation if provided
    if response_data.get('text') or response_data.get('reasoning'):
        text = response_data.get('text') or response_data.get('reasoning')
        prompt_parts.append(f"- Written Explanation: \"{text}\"")
    
    prompt_parts.append("""
Analyze their response holistically:
1. Is their answer/approach correct?
2. For code: Does it work? Is it efficient? Any bugs?
3. For explanations: Is their understanding accurate?
4. What misconceptions do they have?
5. What specific feedback would help them?

Return JSON:
{
    "is_correct": true/false,
    "score": 0-100,
    "feedback": "Main feedback (2-3 sentences)",
    "code_feedback": "Code-specific feedback if applicable, or null",
    "diagram_feedback": "Diagram-specific feedback if applicable, or null",
    "misconception": "Specific misconception or null",
    "strength": "What they did well",
    "next_step": "Actionable improvement"
}""")
    
    full_prompt = "\n".join(prompt_parts)
    
    # Handle image if provided
    content = [full_prompt]
    if response_data.get('image'):
        try:
            img_data = response_data['image']
            if isinstance(img_data, str) and os.path.exists(img_data):
                # It's a file path
                with open(img_data, 'rb') as f:
                    img_bytes = f.read()
                    content.append({
                        "mime_type": "image/png",
                        "data": base64.b64encode(img_bytes).decode()
                    })
        except Exception as e:
            print(f"Image processing error: {e}")
    
    try:
        response = MODEL.generate_content(
            content,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"AI analysis error: {e}")
        return {
            "is_correct": False,
            "score": 50,
            "feedback": "Analysis error. Please try again.",
            "code_feedback": None,
            "diagram_feedback": None
        }


def ai_generate_code_question(topic: str, concept: str) -> Dict:
    """Generate a question that requires code submission."""
    if not GEMINI_AVAILABLE:
        return {
            "prompt": f"Write a function that demonstrates {concept}.",
            "input_type": "code",
            "starter_code": f"def {concept.replace(' ', '_').lower()}():\n    # Your code here\n    pass",
            "test_cases": []
        }
    
    prompt = f"""Create a coding question for: {topic} - {concept}

The question should:
1. Require students to write actual code
2. Have clear requirements
3. Include starter code
4. Include test cases to verify

Return JSON:
{{
    "prompt": "The coding problem description",
    "input_type": "code",
    "language": "python",
    "starter_code": "def function_name(params):\\n    # Your code here\\n    pass",
    "test_cases": [
        {{"input": "example input", "expected": "expected output"}}
    ],
    "hints": ["hint 1", "hint 2"]
}}"""
    
    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except:
        return {
            "prompt": f"Write code to implement {concept}",
            "input_type": "code",
            "starter_code": "# Your code here\n",
            "test_cases": []
        }


def ai_peer_multimodal(question: Dict, student_response: Dict, history: List) -> Dict:
    """AI peer responds to multimodal student submission."""
    if not GEMINI_AVAILABLE:
        return {
            "name": "Alex",
            "message": "Interesting approach! I'd love to see how you arrived at that.",
            "question": "Can you walk me through your thinking?"
        }
    
    history_text = "\n".join([f"{m['name']}: {m['message']}" for m in history]) if history else "No prior discussion"
    
    response_summary = []
    if student_response.get('code'):
        response_summary.append(f"They submitted code:\n```\n{student_response['code'][:500]}...\n```")
    if student_response.get('text'):
        response_summary.append(f"They wrote: \"{student_response['text'][:300]}...\"")
    if student_response.get('answer'):
        response_summary.append(f"They selected: {student_response['answer']}")
    
    prompt = f"""You are Alex, a fellow student discussing a problem.

QUESTION: {question.get('prompt', '')}

STUDENT SUBMITTED:
{chr(10).join(response_summary)}

DISCUSSION HISTORY:
{history_text}

Respond as a helpful peer:
- If they submitted code, discuss the approach
- If they wrote text, engage with their ideas
- Ask thoughtful follow-up questions

Return JSON:
{{
    "name": "Alex",
    "message": "Your response (2-3 sentences)",
    "question": "A follow-up question"
}}"""
    
    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except:
        return {"name": "Alex", "message": "Nice work!", "question": "How did you approach this?"}


# ============================================================================
# SESSION MANAGER
# ============================================================================

class MultimodalSession:
    """Student session with multimodal input support."""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.student_name = ""
        self.topic = ""
        self.questions = []
        self.responses = []
        self.current_idx = 0
        self.active = False
        self.teacher_connected = False
        self.discussion_history = []
        self.current_input_type = "mcq"
    
    def check_teacher_session(self) -> Dict:
        """Check if teacher has an active session."""
        if not SHARED_SESSION_AVAILABLE or not ss:
            return {"available": False, "reason": "Shared session module not available"}
        
        session_info = ss.get_session_info()
        
        if not session_info.get("active"):
            return {"available": False, "reason": "No active session. Wait for teacher to start."}
        
        if session_info.get("num_questions", 0) == 0:
            return {"available": False, "reason": "Session has no questions yet."}
        
        return {
            "available": True,
            "topic": session_info.get("topic", "Unknown"),
            "num_questions": session_info.get("num_questions", 0)
        }
    
    def join_session(self, name: str) -> Tuple[str, bool, str]:
        """Join teacher's session. Returns (content, success, input_type)."""
        check = self.check_teacher_session()
        if not check["available"]:
            return f"❌ {check['reason']}", False, "mcq"
        
        # Load session data from shared storage
        session_data = ss.load_session()
        if not session_data:
            return "❌ Could not load session data", False, "mcq"
        
        self.student_name = name or "Student"
        self.topic = session_data.get("topic", "Unknown Topic")
        self.questions = session_data.get("approved_questions", [])
        self.responses = []
        self.current_idx = 0
        self.active = True
        self.teacher_connected = True
        self.discussion_history = []
        
        if not self.questions:
            return "❌ No questions in session", False, "mcq"
        
        # Detect input type for first question
        self.current_input_type = detect_input_type(self.topic, self.questions[0])
        
        welcome = f"""# 🎓 Welcome, {self.student_name}!

**📡 Connected to Teacher Session**
**Topic:** {self.topic}
**Questions:** {len(self.questions)}

---

"""
        return welcome + self._format_question(), True, self.current_input_type
    
    def _format_question(self) -> str:
        """Format current question with input type hints."""
        if self.current_idx >= len(self.questions):
            return "Session complete!"
        
        q = self.questions[self.current_idx]
        input_type = detect_input_type(self.topic, q)
        self.current_input_type = input_type
        
        md = f"## Question {self.current_idx + 1} of {len(self.questions)}\n\n"
        md += f"**{q.get('prompt', 'Question')}**\n\n"
        
        # Show options for MCQ
        if q.get("options"):
            for opt in q.get("options", []):
                md += f"- {opt}\n"
            md += "\n"
        
        # Show input type hint
        if 'code' in input_type:
            md += "\n💻 *You can submit code for this question*\n"
        if 'diagram' in input_type:
            md += "\n📊 *You can upload a diagram for this question*\n"
        if input_type == 'text':
            md += "\n✍️ *Write your explanation below*\n"
        
        return md
    
    def submit_multimodal(self, mcq_answer: str, code: str, text: str, 
                          image_path: str, reasoning: str, confidence: int) -> Tuple[str, str, str]:
        """Submit multimodal response."""
        if not self.active or self.current_idx >= len(self.questions):
            return "Session ended.", "", ""
        
        q = self.questions[self.current_idx]
        
        # Build response data
        response_data = {
            "answer": mcq_answer,
            "code": code if code else None,
            "text": text if text else None,
            "image": image_path if image_path else None,
            "reasoning": reasoning,
            "confidence": confidence
        }
        
        # AI analysis
        analysis = ai_analyze_multimodal(q, response_data)
        
        # Store response
        self.responses.append({
            **response_data,
            "is_correct": analysis.get("is_correct", False),
            "analysis": analysis
        })
        
        # Report to teacher via shared session
        if self.teacher_connected and SHARED_SESSION_AVAILABLE and ss:
            ss.submit_response(
                self.student_name,
                f"q_{self.current_idx}",
                {
                    "answer": mcq_answer.split('.')[0] if mcq_answer else "",
                    "has_code": bool(code),
                    "has_image": bool(image_path),
                    "reasoning": reasoning[:200] if reasoning else "",
                    "confidence": confidence,
                    "is_correct": analysis.get("is_correct", False)
                }
            )
        
        # Start peer discussion
        self.discussion_history = []
        peer = ai_peer_multimodal(q, response_data, self.discussion_history)
        self.discussion_history.append({"name": peer["name"], "message": peer["message"], "role": "peer"})
        
        # Format feedback
        is_correct = analysis.get("is_correct", False)
        feedback_md = f"""## {'✅ Correct!' if is_correct else '❌ Not quite...'}

{analysis.get('feedback', 'Response recorded.')}

**Score:** {analysis.get('score', 50)}/100
"""
        
        if analysis.get('code_feedback'):
            feedback_md += f"\n### 💻 Code Feedback\n{analysis['code_feedback']}\n"
        
        if analysis.get('diagram_feedback'):
            feedback_md += f"\n### 📊 Diagram Feedback\n{analysis['diagram_feedback']}\n"
        
        if analysis.get('misconception'):
            feedback_md += f"\n**Misconception:** {analysis['misconception']}\n"
        
        if analysis.get('strength'):
            feedback_md += f"\n**Strength:** {analysis['strength']}\n"
        
        if analysis.get('next_step'):
            feedback_md += f"\n💡 **Next Step:** {analysis['next_step']}\n"
        
        # Peer discussion
        peer_md = f"""---

## 💬 Peer Discussion

**{peer['name']}**:

> "{peer['message']}"

**{peer['name']} asks:** {peer.get('question', 'What do you think?')}

---
"""
        
        # Explanation
        explanation_md = f"""## 📚 Correct Answer: {q.get('correct_answer', 'See explanation')}

{q.get('explanation', 'Review the concept for details.')}
"""
        
        return feedback_md, peer_md, explanation_md
    
    def reply_to_peer(self, reply_text: str) -> str:
        """Continue peer discussion."""
        if not self.active:
            return ""
        
        q = self.questions[self.current_idx] if self.current_idx < len(self.questions) else {}
        last_response = self.responses[-1] if self.responses else {}
        
        self.discussion_history.append({
            "name": self.student_name,
            "message": reply_text,
            "role": "student"
        })
        
        peer = ai_peer_multimodal(q, last_response, self.discussion_history)
        self.discussion_history.append({"name": peer["name"], "message": peer["message"], "role": "peer"})
        
        return f"""**You:** {reply_text}

**{peer['name']}:** {peer['message']}

**{peer['name']} asks:** {peer.get('question', '')}
"""
    
    def next_question(self) -> Tuple[str, bool, str]:
        """Move to next question. Returns (content, is_done, input_type)."""
        self.current_idx += 1
        self.discussion_history = []
        
        if self.current_idx >= len(self.questions):
            self.active = False
            correct = sum(1 for r in self.responses if r.get("is_correct"))
            total = len(self.responses)
            
            exit_ticket = f"""# 🎉 Session Complete, {self.student_name}!

**Score:** {correct}/{total} ({correct/total*100:.0f}% correct)

Great work completing this session! Review any concepts you missed.
"""
            return exit_ticket, True, "mcq"
        
        input_type = detect_input_type(self.topic, self.questions[self.current_idx])
        return self._format_question(), False, input_type


# Global session
session = MultimodalSession()


# ============================================================================
# GRADIO APP
# ============================================================================

def check_session():
    """Check for teacher session."""
    check = session.check_teacher_session()
    if check["available"]:
        return f"✅ **Session Available!**\n\n**Topic:** {check['topic']}\n**Questions:** {check['num_questions']}\n\nEnter your name and click Join!"
    return f"⏳ **Waiting for Teacher...**\n\n{check['reason']}\n\nClick 'Refresh' to check again."


def join_session(name):
    """Join the teacher session."""
    # Outputs: question_display, status, join_section, session_status, 
    #          answer_section, feedback_section, next_btn, feedback, peer, explanation
    if not name:
        return ("Please enter your name.", "Enter your name", gr.update(), gr.update(visible=True), 
                gr.update(visible=False), gr.update(visible=False),
                gr.update(visible=False), "", "", "")
    
    content, success, input_type = session.join_session(name)
    
    if success:
        return (
            content,
            f"Question 1 of {len(session.questions)}",
            gr.update(visible=False),  # Hide join section
            gr.update(visible=False),  # Hide status
            gr.update(visible=True),   # Show answer section
            gr.update(visible=False),  # Feedback
            gr.update(visible=False),  # Next btn
            "", "", ""
        )
    else:
        return (content, "Not connected", gr.update(), gr.update(visible=True), 
                gr.update(visible=False), gr.update(visible=False),
                gr.update(visible=False), "", "", "")


def submit_answer(mcq, code, additional_text, diagram, reasoning, confidence):
    """Submit multimodal answer."""
    feedback, peer, explanation = session.submit_multimodal(
        mcq_answer=mcq or "",
        code=code or "",
        text=additional_text or "",
        image_path=diagram,
        reasoning=reasoning or "",
        confidence=int(confidence or 50)
    )
    return (
        feedback, peer, explanation,
        gr.update(visible=False),  # Hide answer section
        gr.update(visible=True),   # Show feedback
        gr.update(visible=True),   # Show next btn
    )


def reply_to_peer(reply_text):
    """Reply in discussion."""
    if not reply_text:
        return gr.update()
    return session.reply_to_peer(reply_text)


def next_question():
    """Next question."""
    content, is_done, input_type = session.next_question()
    
    if is_done:
        return (
            content,
            "🎉 Session Complete!",
            gr.update(visible=False),  # Answer section
            gr.update(visible=False),  # Feedback
            gr.update(visible=False),  # Next btn
            "", "", "",
            gr.update(visible=False)   # Reply section
        )
    
    return (
        content,
        f"Question {session.current_idx + 1} of {len(session.questions)}",
        gr.update(visible=True),   # Answer section
        gr.update(visible=False),  # Feedback
        gr.update(visible=False),  # Next btn
        "", "", "",
        gr.update(visible=False)   # Reply section
    )


def create_app():
    with gr.Blocks(
        title="Quizly - Multimodal Student Experience",
        theme=gr.themes.Soft(primary_hue="indigo"),
        css="""
        .gradio-container { max-width: 1100px !important; margin: auto; }
        .code-editor textarea { font-family: monospace !important; }
        """
    ) as app:
        
        gr.Markdown("""
        # 🎓 Quizly Multimodal Student Experience
        
        **Submit your answers in multiple formats:**
        - 📝 Multiple choice answers
        - 💻 Code submissions with syntax highlighting
        - 📊 Diagram/image uploads
        - ✍️ Written explanations
        
        *The AI adapts its analysis based on your submission type!*
        """)
        
        # Join Section
        with gr.Group() as join_section:
            session_status = gr.Markdown(check_session())
            with gr.Row():
                name_input = gr.Textbox(label="Your Name", placeholder="Enter your name")
                refresh_btn = gr.Button("🔄 Refresh", scale=0)
            join_btn = gr.Button("🚀 Join Session", variant="primary", size="lg")
        
        status = gr.Markdown("Ready to begin...")
        question_display = gr.Markdown()
        
        # Answer Section (Multimodal)
        with gr.Group(visible=False) as answer_section:
            gr.Markdown("### ✍️ Your Response")
            gr.Markdown("*Use any combination of inputs below:*")
            
            # MCQ Answer
            mcq_answer = gr.Radio(
                ["A", "B", "C", "D"], 
                label="📝 Select Answer (for multiple choice)",
                interactive=True
            )
            
            # Code Input
            with gr.Accordion("💻 Code Submission", open=False) as code_section:
                code_input = gr.Code(
                    label="Write your code here",
                    language="python",
                    lines=10
                )
            
            # Diagram Upload
            with gr.Accordion("📊 Diagram/Image Upload", open=False) as diagram_section:
                diagram_input = gr.Image(
                    label="Upload your diagram, sketch, or image",
                    type="filepath"
                )
            
            # Text Explanation
            with gr.Group():
                reasoning_input = gr.Textbox(
                    label="📝 Explain Your Reasoning",
                    placeholder="Why did you choose this approach? Walk through your thinking...",
                    lines=3
                )
                additional_text = gr.Textbox(
                    label="✍️ Additional Written Response (optional)",
                    placeholder="Any additional explanation, essay response, or notes...",
                    lines=4,
                    visible=False  # Show for text-heavy questions
                )
            
            confidence = gr.Slider(0, 100, 50, step=5, label="Confidence (%)")
            submit_btn = gr.Button("📤 Submit Response", variant="primary", size="lg")
        
        # Feedback Section
        with gr.Group(visible=False) as feedback_section:
            feedback = gr.Markdown()
            peer = gr.Markdown()
            
            with gr.Group() as reply_section:
                gr.Markdown("### 💬 Reply to Your Peer")
                reply_input = gr.Textbox(label="Your Reply", lines=2)
                reply_btn = gr.Button("Send Reply", variant="secondary")
                discussion_display = gr.Markdown()
            
            explanation = gr.Markdown()
        
        next_btn = gr.Button("➡️ Next Question", variant="secondary", size="lg", visible=False)
        
        # Events
        refresh_btn.click(check_session, [], [session_status])
        
        join_btn.click(
            join_session,
            [name_input],
            [question_display, status, join_section, session_status, 
             answer_section, feedback_section, next_btn, feedback, peer, explanation]
        )
        
        submit_btn.click(
            submit_answer,
            [mcq_answer, code_input, additional_text, diagram_input, reasoning_input, confidence],
            [feedback, peer, explanation, answer_section, feedback_section, next_btn]
        )
        
        reply_btn.click(reply_to_peer, [reply_input], [discussion_display])
        
        next_btn.click(
            next_question,
            [],
            [question_display, status, answer_section, feedback_section, next_btn,
             feedback, peer, explanation, reply_section]
        )
    
    return app


if __name__ == "__main__":
    print("🎓 Starting Multimodal Student Experience...")
    print("📝 MCQ | 💻 Code | 📊 Diagrams | ✍️ Text")
    app = create_app()
    app.launch(server_name="0.0.0.0", server_port=7871, share=False, show_error=True)

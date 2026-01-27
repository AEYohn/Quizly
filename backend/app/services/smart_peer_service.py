"""
Smart AI Peer Service
Context-aware AI peer that discusses concepts meaningfully.

Key improvements over basic AI peer:
- Shows actual option text, not just "A" or "C"
- Asks about reasoning and concepts, not letter choices
- Helps students discover the concept through guided discussion
- Remembers conversation history for multi-turn discussions
- Supports multimodal input (images, PDFs) for students to share their work
"""

import os
import json
import base64
from typing import Dict, Any, Optional, List

try:
    import google.generativeai as genai
    from google.generativeai.types import content_types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import fitz  # PyMuPDF for PDF handling
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    MODEL = genai.GenerativeModel("gemini-2.0-flash")
else:
    MODEL = None

# Peer names for variety
PEER_NAMES = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn"]

def get_peer_name(player_id: str) -> str:
    """Get a consistent peer name based on player ID."""
    # Use absolute value to ensure positive index
    return PEER_NAMES[abs(hash(player_id)) % len(PEER_NAMES)]


def process_attachment(attachment: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Process an attachment (image or PDF) for Gemini multimodal input.

    Returns a dict with type and data ready for Gemini, or None if invalid.
    """
    if not attachment:
        return None

    attachment_type = attachment.get("type")
    data = attachment.get("data", "")

    # Handle base64 data URL format
    if data.startswith("data:"):
        # Extract the base64 part after the comma
        try:
            header, base64_data = data.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]
        except (ValueError, IndexError):
            return None
    else:
        base64_data = data
        mime_type = "image/png" if attachment_type == "image" else "application/pdf"

    # For PDFs, try to extract images from pages
    if attachment_type == "pdf" and PDF_AVAILABLE:
        try:
            pdf_bytes = base64.b64decode(base64_data)
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            images = []
            for page_num in range(min(3, len(doc))):  # First 3 pages max
                page = doc.load_page(page_num)
                pix = page.get_pixmap(dpi=150)
                img_data = pix.tobytes("png")
                images.append({
                    "mime_type": "image/png",
                    "data": base64.b64encode(img_data).decode()
                })
            doc.close()
            if images:
                return {"type": "pdf_images", "images": images}
        except Exception as e:
            print(f"PDF processing error: {e}")
            return None

    # For images, return directly
    if attachment_type == "image":
        return {
            "type": "image",
            "mime_type": mime_type,
            "data": base64_data
        }

    return None


async def generate_smart_peer_response(
    question: Dict[str, Any],
    student_answer: str,
    student_reasoning: Optional[str],
    correct_answer: str,
    is_correct: bool,
    chat_history: List[Dict[str, str]],
    player_id: str,
    confidence: Optional[int] = None,
    attachment: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate a context-aware AI peer response.

    Unlike simple AI peers, this:
    - References actual option text, not letter choices
    - Asks about the concept/reasoning, not "why did you pick A?"
    - Guides the student to discover the answer themselves
    - Maintains meaningful multi-turn conversations
    - Supports multimodal input (images, PDFs) for students to share their work

    Args:
        question: Question dict with question_text, options, explanation
        student_answer: The student's answer letter (e.g., "A")
        student_reasoning: What the student said about their choice
        correct_answer: The correct answer letter
        is_correct: Whether the student got it right
        chat_history: List of previous messages [{role, content, name}]
        player_id: Player ID for consistent peer naming
        confidence: Student's confidence level (0-100)
        attachment: Optional attachment dict with type, name, data (base64)

    Returns:
        Dict with:
        - name: Peer name (e.g., "Alex")
        - message: The peer's response
        - follow_up_question: Optional follow-up to continue discussion
    """
    peer_name = get_peer_name(player_id)
    options = question.get("options", {})

    # Get the actual text of the options
    student_answer_text = options.get(student_answer, student_answer)
    correct_answer_text = options.get(correct_answer, correct_answer)

    # Format chat history
    history_text = ""
    if chat_history:
        history_lines = []
        for msg in chat_history[-6:]:  # Keep last 6 messages for context
            name = msg.get("name", msg.get("sender_name", "Unknown"))
            content = msg.get("content", msg.get("message", ""))
            history_lines.append(f"{name}: {content}")
        history_text = "\n".join(history_lines)

    if not MODEL:
        return _fallback_response(
            peer_name, is_correct, student_answer_text, correct_answer_text,
            len(chat_history)
        )

    # Process attachment if present
    processed_attachment = process_attachment(attachment)
    attachment_context = ""
    if processed_attachment:
        attachment_context = "\n\nThe student has shared an image/document of their work. Please analyze it and incorporate it into your response."

    # Build contextual prompt
    is_first_message = len(chat_history) == 0
    # Count student messages to track exchange progress
    # Chat history uses "role": "student" for student messages
    student_message_count = sum(1 for msg in chat_history if msg.get("role") == "student")

    if is_first_message:
        prompt = _build_opening_prompt(
            peer_name, question, options, student_answer, student_answer_text,
            student_reasoning, correct_answer, correct_answer_text, is_correct,
            confidence
        )
    else:
        prompt = _build_continuation_prompt(
            peer_name, question, options, student_answer_text, correct_answer_text,
            is_correct, history_text, chat_history[-1].get("content", ""),
            exchange_count=student_message_count
        )

    # Add attachment context to prompt
    if attachment_context:
        prompt += attachment_context

    try:
        # Build content parts for multimodal input
        content_parts = []

        # Add images if attachment is present
        if processed_attachment:
            if processed_attachment["type"] == "image":
                content_parts.append({
                    "inline_data": {
                        "mime_type": processed_attachment["mime_type"],
                        "data": processed_attachment["data"]
                    }
                })
            elif processed_attachment["type"] == "pdf_images":
                for img in processed_attachment["images"]:
                    content_parts.append({
                        "inline_data": {
                            "mime_type": img["mime_type"],
                            "data": img["data"]
                        }
                    })

        # Add text prompt
        content_parts.append(prompt)

        response = MODEL.generate_content(
            content_parts,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)

        # Socratic flow: ready_for_check after student has engaged with teaching
        # After 1 student response, show the mastery check
        force_check = not is_correct and student_message_count >= 1

        print(f"[smart_peer] student_message_count={student_message_count}, is_correct={is_correct}, force_check={force_check}")

        return {
            "name": peer_name,
            "message": result.get("message", "That's interesting! Tell me more."),
            "follow_up_question": result.get("follow_up_question") if not force_check else None,
            "ready_for_check": force_check or result.get("ready_for_check", False)
        }
    except Exception as e:
        print(f"Smart peer response error: {e}")
        return _fallback_response(
            peer_name, is_correct, student_answer_text, correct_answer_text,
            len(chat_history)
        )


def _build_opening_prompt(
    peer_name: str,
    question: Dict[str, Any],
    options: Dict[str, str],
    student_answer: str,
    student_answer_text: str,
    student_reasoning: Optional[str],
    correct_answer: str,
    correct_answer_text: str,
    is_correct: bool,
    confidence: Optional[int]
) -> str:
    """Build the prompt for the first message in a peer discussion.

    Uses Socratic method - ask questions first, don't explain.
    """

    # Format all options for context
    options_formatted = "\n".join([f"  {k}: {v}" for k, v in options.items()])

    confidence_context = ""
    if confidence is not None:
        if confidence >= 80:
            confidence_context = "They seem very confident in their answer."
        elif confidence >= 50:
            confidence_context = "They seem somewhat confident."
        else:
            confidence_context = "They seem uncertain about their answer."

    return f"""You are {peer_name}, a friendly fellow student in an online class discussion.

QUESTION:
{question.get('question_text', question.get('prompt', 'Unknown question'))}

OPTIONS:
{options_formatted}

CORRECT ANSWER: {correct_answer} - {correct_answer_text}

STUDENT'S ANSWER: {student_answer} - {student_answer_text}
{"STUDENT'S REASONING: " + student_reasoning if student_reasoning else "No reasoning provided."}
{confidence_context}
RESULT: {"CORRECT" if is_correct else "INCORRECT"}

Your job: Ask ONE thought-provoking question to help them discover the concept themselves.

IMPORTANT - SOCRATIC METHOD:
- Do NOT explain or teach yet - just ask a question
- Your question should make them think about WHY their answer might be wrong
- Lead them toward the key insight through questioning

EXAMPLE for "Which is NOT a proposition?" where they chose "√5 is irrational" (wrong):
"Hey! So you think '√5 is irrational' isn't a proposition... Can you tell me what makes something a proposition vs not? Like, what's the key requirement?"

EXAMPLE 2:
"Interesting choice! Quick question - can we determine if '√5 is irrational' is true or false? What about 'x² + 3x = 5'?"

RULES:
- NEVER reference letter choices (A, B, C, D) - discuss concepts only
- Keep it SHORT (1-2 sentences max)
- Ask a QUESTION that leads them to think, don't explain
- Be curious and friendly, not corrective

Return JSON:
{{
    "message": "Brief greeting + ONE probing question (no explanation!)"
}}"""


def _build_continuation_prompt(
    peer_name: str,
    question: Dict[str, Any],
    options: Dict[str, str],
    student_answer_text: str,
    correct_answer_text: str,
    is_correct: bool,
    history_text: str,
    last_student_message: str,
    exchange_count: int = 0
) -> str:
    """Build the prompt for continuing an existing discussion.

    Uses Socratic method:
    - Exchange 1: Ask another probing question based on their response
    - Exchange 2+: Give the lesson and let them try the question
    """

    options_formatted = "\n".join([f"  {k}: {v}" for k, v in options.items()])

    # First response: Ask another question, don't explain yet
    if exchange_count < 2:
        return f"""You are {peer_name}. The student just responded to your question.

ORIGINAL QUESTION: {question.get('question_text', question.get('prompt', 'Unknown question'))}
OPTIONS:
{options_formatted}
CORRECT ANSWER: {correct_answer_text}

CONVERSATION SO FAR:
{history_text}

STUDENT'S LATEST RESPONSE: "{last_student_message}"

Your job: Ask ONE follow-up question. NO EXPLANATION - just a question.

CRITICAL: Do NOT explain anything. Do NOT teach. ONLY ask a question.

GOOD EXAMPLES (just questions, no teaching):
- "Hmm, can you tell me - is '√5 is irrational' something we can determine is true or false?"
- "What about 'x² + 3x = 5' - can we say if that's true or false without knowing x?"
- "Interesting! What do you think is different between '1+1=2' and 'x+1=2'?"

BAD EXAMPLES (these explain - DON'T do this):
- "A proposition needs to be true or false. So what about..." ❌
- "The key difference is that..." ❌
- "Think about it this way..." ❌

RULES:
- ONE question only (1 sentence)
- NO explaining, NO teaching, NO hints
- Just ask and let them think
- NEVER reference letter choices

Return JSON:
{{
    "message": "Just a question, nothing else"
}}"""

    # Second+ response: Now give the lesson
    return f"""You are {peer_name}. The student has been thinking through this with you.

ORIGINAL QUESTION: {question.get('question_text', question.get('prompt', 'Unknown question'))}
CORRECT ANSWER: {correct_answer_text}
EXPLANATION: {question.get('explanation', 'Not available')}

CONVERSATION SO FAR:
{history_text}

STUDENT'S LATEST RESPONSE: "{last_student_message}"

Your job: Now give them the key lesson and let them try the original question.

STRUCTURE:
1. Brief acknowledgment of their thinking (1 sentence)
2. The key lesson/insight they need (1-2 sentences)
3. Encourage them to try the question again

EXAMPLE:
"You're getting it! The key thing is: a proposition must be definitively true or false WITHOUT depending on unknown values. 'x² + 3x = 5' has a variable, so we can't say it's true or false until we know x. Ready to try the question again?"

RULES:
- Keep it SHORT (2-3 sentences total)
- NOW you can explain the concept briefly
- End by letting them try the question
- NEVER reference letter choices

Return JSON:
{{
    "message": "Brief lesson + encouragement to try again",
    "ready_for_check": true
}}"""


def _fallback_response(
    peer_name: str,
    is_correct: bool,
    student_answer_text: str,
    correct_answer_text: str,
    message_count: int
) -> Dict[str, Any]:
    """Fallback responses when LLM is unavailable.

    Uses Socratic pattern:
    - First message: Ask a probing question
    - Second message: Ask another question
    - Third+ message: Give brief lesson + let them try
    """
    # Count student messages (every other message after the first is from student)
    student_responses = (message_count + 1) // 2

    if message_count == 0:
        # First message: Ask a probing question (no explanation)
        if is_correct:
            return {
                "name": peer_name,
                "message": f"Hey! Nice work. Quick question - what made you confident that was the answer?",
                "ready_for_check": False
            }
        else:
            return {
                "name": peer_name,
                "message": f"Hey! Interesting choice. What do you think makes something fit this definition vs not?",
                "ready_for_check": False
            }
    elif student_responses < 2:
        # Second message: Ask another probing question
        if is_correct:
            return {
                "name": peer_name,
                "message": "That makes sense! Can you think of an example that wouldn't fit?",
                "ready_for_check": False
            }
        else:
            return {
                "name": peer_name,
                "message": "Okay, that's interesting! What if we compare your answer to one of the other options - what's the key difference?",
                "ready_for_check": False
            }
    else:
        # Third+ message: Give lesson and let them try
        if is_correct:
            return {
                "name": peer_name,
                "message": "Great explanation! You clearly understand this concept.",
                "ready_for_check": False
            }
        else:
            return {
                "name": peer_name,
                "message": "Good thinking! The key insight here is about what makes something fit the definition. Ready to try the question again?",
                "ready_for_check": True
            }


async def generate_opening_message(
    question: Dict[str, Any],
    student_answer: str,
    is_correct: bool,
    player_id: str
) -> Dict[str, Any]:
    """
    Generate just the opening message for a peer discussion.
    Useful for starting discussions without full context.
    """
    return await generate_smart_peer_response(
        question=question,
        student_answer=student_answer,
        student_reasoning=None,
        correct_answer=question.get("correct_answer", "A"),
        is_correct=is_correct,
        chat_history=[],
        player_id=player_id
    )

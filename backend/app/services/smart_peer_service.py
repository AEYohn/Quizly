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
    return PEER_NAMES[hash(player_id) % len(PEER_NAMES)]


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

    if is_first_message:
        prompt = _build_opening_prompt(
            peer_name, question, options, student_answer, student_answer_text,
            student_reasoning, correct_answer, correct_answer_text, is_correct,
            confidence
        )
    else:
        prompt = _build_continuation_prompt(
            peer_name, question, options, student_answer_text, correct_answer_text,
            is_correct, history_text, chat_history[-1].get("content", "")
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
        return {
            "name": peer_name,
            "message": result.get("message", "That's interesting! Tell me more."),
            "follow_up_question": result.get("follow_up_question"),
            "ready_for_check": result.get("ready_for_check", False)
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
    """Build the prompt for the first message in a peer discussion."""

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

Your job as {peer_name} is to start a helpful peer discussion.

CRITICAL RULES:
1. NEVER say "Why did you pick A?" or reference letter choices - discuss the ACTUAL CONCEPTS
2. Reference the actual option TEXT when discussing answers
3. If they got it wrong, START HELPING immediately - don't just ask vague questions
4. If they got it right, ask them to explain their reasoning to deepen understanding
5. Be conversational and friendly, like a real student who actually understands the topic
6. Use the actual content of the options in your discussion

{"Since they got it WRONG:" if not is_correct else "Since they got it RIGHT, congratulate them and ask them to explain their thinking. This helps solidify their understanding."}
{"- Don't just say 'interesting choice, why?' - that's empty" if not is_correct else ""}
{"- Immediately offer something useful: an analogy, example, hint, or scenario" if not is_correct else ""}
{"- Point toward the KEY CONCEPT they need to understand" if not is_correct else ""}
{"- Your opening should already start teaching, not just fishing for info" if not is_correct else ""}

EXAMPLE OF BAD OPENING (vague, no value):
"Hey! I see you picked X. That's an interesting choice! What made you think that?"

EXAMPLE OF GOOD OPENING (immediately helpful):
"Hey! I picked the same thing at first. But then I thought about a specific case - [concrete scenario]. That made me reconsider. What do you think happens in that situation?"

Return JSON:
{{
    "message": "Your opening message as {peer_name} (2-3 sentences - if they're WRONG, immediately offer a helpful hint or example)",
    "follow_up_question": "A SPECIFIC question about a scenario or edge case, not 'what was your reasoning?'"
}}"""


def _build_continuation_prompt(
    peer_name: str,
    question: Dict[str, Any],
    options: Dict[str, str],
    student_answer_text: str,
    correct_answer_text: str,
    is_correct: bool,
    history_text: str,
    last_student_message: str
) -> str:
    """Build the prompt for continuing an existing discussion."""

    options_formatted = "\n".join([f"  {k}: {v}" for k, v in options.items()])

    # Count exchanges to gauge conversation progress
    exchange_count = history_text.count("\n") // 2 if history_text else 0

    return f"""You are {peer_name}, continuing a peer discussion about a question.

QUESTION:
{question.get('question_text', question.get('prompt', 'Unknown question'))}

OPTIONS:
{options_formatted}

CORRECT ANSWER: {correct_answer_text}
STUDENT'S ORIGINAL ANSWER: {student_answer_text}
STUDENT WAS: {"CORRECT" if is_correct else "INCORRECT"}

EXPLANATION:
{question.get('explanation', 'Not available')}

CONVERSATION SO FAR:
{history_text}

STUDENT'S LATEST MESSAGE: "{last_student_message}"

Continue the discussion as {peer_name}:

CRITICAL - ADD EDUCATIONAL VALUE, DON'T JUST PARAPHRASE:
1. DO NOT just mirror back what the student said ("So you're saying X, right?") - that's empty
2. ACTUALLY HELP THEM LEARN by doing ONE of these:
   - Give a concrete example or analogy that illustrates the concept
   - Point out a specific edge case or scenario they haven't considered
   - Explain a key distinction they might be missing
   - Share a "trick" or mental model for remembering the concept
   - Ask a SPECIFIC question that forces them to confront their misconception
3. Be like a helpful tutor who ADDS information, not a therapist who just reflects
4. Keep it conversational but substantive - every message should teach something
5. NEVER reference letter choices - only discuss concepts
6. DO NOT reveal the correct answer directly - but DO give meaningful hints

EXAMPLE OF BAD RESPONSE (empty paraphrase):
"So you're focusing on the idea that X leads to Y, right?"

EXAMPLE OF GOOD RESPONSE (adds value):
"Here's something to think about - what if someone promises 'If it rains, I'll bring an umbrella' but it's sunny? Did they break their promise? That's the key to this question."

IMPORTANT: The student got this question WRONG. Your goal is to help them understand through discussion.
- Keep asking questions and providing hints until they demonstrate understanding
- After {max(2, 4 - exchange_count)} more exchanges, if they seem to understand the concept, set ready_for_check to true
- ready_for_check means: "I think they understand now and should try answering again"
- If they're still struggling, keep ready_for_check false and continue helping

Return JSON:
{{
    "message": "Your response as {peer_name} (2-3 sentences that TEACH something, not just reflect)",
    "follow_up_question": "A SPECIFIC question about a scenario or edge case they should consider",
    "ready_for_check": true/false (true if student seems ready to demonstrate understanding)
}}"""


def _fallback_response(
    peer_name: str,
    is_correct: bool,
    student_answer_text: str,
    correct_answer_text: str,
    message_count: int
) -> Dict[str, Any]:
    """Fallback responses when LLM is unavailable."""

    if message_count == 0:
        if is_correct:
            return {
                "name": peer_name,
                "message": f"Hey! Nice work on this one. I see you chose \"{student_answer_text[:50]}...\" - that's exactly right! What made you confident that was the answer?",
                "follow_up_question": "Can you walk me through your reasoning?",
                "ready_for_check": False
            }
        else:
            return {
                "name": peer_name,
                "message": f"Hey! This one's tricky. I see you went with \"{student_answer_text[:50]}...\" - I can see why that's tempting. What made you think that was the best choice?",
                "follow_up_question": "What was the key factor in your decision?",
                "ready_for_check": False
            }
    elif message_count < 4:
        if is_correct:
            return {
                "name": peer_name,
                "message": "That makes sense! Teaching others really helps cement your own understanding.",
                "follow_up_question": None,
                "ready_for_check": False
            }
        else:
            return {
                "name": peer_name,
                "message": f"I hear you. Let me give you a hint - think about how the correct answer relates to the core concept being asked.",
                "follow_up_question": "What do you notice when you compare the options more carefully?",
                "ready_for_check": False
            }
    else:
        if is_correct:
            return {
                "name": peer_name,
                "message": "Great discussion! I think we both learned something here.",
                "follow_up_question": None,
                "ready_for_check": False
            }
        else:
            return {
                "name": peer_name,
                "message": "I think you're getting closer to understanding this. Want to try selecting what you think the correct answer is now?",
                "follow_up_question": "Give it a shot!",
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

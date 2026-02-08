"""
Smart AI Peer Service
Context-aware AI peer that discusses concepts meaningfully.

Key improvements over basic AI peer:
- Shows actual option text, not just "A" or "C"
- Asks about reasoning and concepts, not letter choices
- Helps students discover the concept through guided discussion
- Remembers conversation history for multi-turn discussions
- Supports multimodal input (images, PDFs) for students to share their work

Adaptive Socratic System:
- Initial assessment based on confidence + error type
- Adaptive probing depth (2-4 questions)
- Stuck detection and graduated hints
- Misconception-targeted correction
- Personalized explanations referencing student's words
"""

import os
import json
import base64
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, Optional, List

try:
    import google.generativeai as genai
    from google.generativeai.types import content_types  # noqa: F401
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from ..utils.llm_utils import call_gemini_with_timeout

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


@dataclass
class DiscussionState:
    """
    Tracks the adaptive state of a peer discussion session.

    This enables:
    - Adaptive probing depth based on initial assessment
    - Stuck detection when student circles the same wrong idea
    - Graduated hint progression
    - Misconception tracking for targeted correction
    - Personalized explanation referencing student's journey
    """
    phase: str = "probing"  # "probing" | "hinting" | "targeted" | "explaining"
    probing_depth: int = 3  # 2-4 based on initial assessment
    current_probing_count: int = 0
    stuck_count: int = 0  # Times student repeated same wrong reasoning
    hints_given: int = 0  # Track hint progression (0-3)
    hints_requested: int = 0  # How many hints student asked for
    detected_misconceptions: List[Dict] = field(default_factory=list)
    confusion_areas: List[str] = field(default_factory=list)
    student_reasoning_points: List[str] = field(default_factory=list)
    last_reasoning_theme: str = ""  # For stuck detection
    error_type: str = ""  # "conceptual" | "procedural" | "careless" | "overconfident"
    initial_confidence: int = 50
    making_progress: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DiscussionState":
        """Create from dictionary."""
        if data is None:
            return cls()
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

def get_peer_name(player_id: str) -> str:
    """Get a consistent peer name based on player ID."""
    # Use absolute value to ensure positive index
    return PEER_NAMES[abs(hash(player_id)) % len(PEER_NAMES)]


def _build_initial_assessment_prompt(
    question: Dict[str, Any],
    options: Dict[str, str],
    student_answer: str,
    student_answer_text: str,
    student_reasoning: Optional[str],
    correct_answer: str,
    correct_answer_text: str,
    confidence: Optional[int],
    peer_name: str
) -> str:
    """Build prompt for initial assessment of student's error and confidence."""
    options_formatted = "\n".join([f"  {k}: {v}" for k, v in options.items()])

    confidence_val = confidence or 50
    if confidence_val >= 70:
        confidence_desc = "HIGH confidence - student believes they are correct"
    elif confidence_val >= 40:
        confidence_desc = "MEDIUM confidence - somewhat uncertain"
    else:
        confidence_desc = "LOW confidence - student is unsure"

    return f"""You are {peer_name}, a friendly AI study buddy. Analyze this wrong answer to determine the best teaching approach.

QUESTION:
{question.get('question_text', 'Unknown question')}

OPTIONS:
{options_formatted}

CORRECT ANSWER: {correct_answer} - {correct_answer_text}
STUDENT'S ANSWER: {student_answer} - {student_answer_text}
STUDENT'S REASONING: {student_reasoning or "Not provided"}
CONFIDENCE: {confidence_val}% ({confidence_desc})

Analyze the student's error and determine:
1. Error type: Is this conceptual (fundamental misunderstanding), procedural (wrong process), careless (oversight), or overconfident (thinks they know but doesn't)?
2. Probing depth: How many probing questions needed before giving hints?
   - HIGH confidence + wrong = needs MORE probing (4) to expose overconfidence
   - LOW confidence + wrong = needs LESS probing (2), more scaffolding
   - MEDIUM = standard (3)
3. Likely misconception: What specific misunderstanding might they have?
4. First Socratic question: Ask ONE thought-provoking question to start

Return JSON:
{{
    "error_type": "conceptual|procedural|careless|overconfident",
    "probing_depth": 2-4,
    "likely_misconception": "brief description of likely misunderstanding",
    "message": "Brief friendly greeting + ONE probing question (no teaching yet!)"
}}"""


def _build_misconception_detection_prompt(
    question: Dict[str, Any],
    correct_answer_text: str,
    history_text: str,
    last_student_message: str,
    state: DiscussionState
) -> str:
    """Build prompt to analyze student's latest response for misconceptions and progress."""
    prev_misconceptions = ", ".join([m.get("type", "unknown") for m in state.detected_misconceptions]) if state.detected_misconceptions else "None detected yet"

    return f"""Analyze the student's latest response in our discussion.

QUESTION CONTEXT:
{question.get('question_text', 'Unknown')}
CORRECT ANSWER: {correct_answer_text}

CONVERSATION SO FAR:
{history_text}

STUDENT'S LATEST MESSAGE: "{last_student_message}"

Previously detected misconceptions: {prev_misconceptions}
Previous reasoning theme: {state.last_reasoning_theme or "None"}
Times stuck on same idea: {state.stuck_count}
Current probing count: {state.current_probing_count} / {state.probing_depth}

Analyze for:
1. Is there a specific misconception? (definition confusion, scope error, etc.)
2. Is the student making progress toward understanding?
3. Are they stuck (repeating the EXACT same wrong reasoning as before)?
4. What should we do next?

IMPORTANT for recommended_action:
- "continue": Default. Keep asking probing questions. Use this MOST of the time.
- "hint": Only if student seems genuinely frustrated or lost (not just wrong).
- "address": If a clear misconception is detected, address it with a targeted question.
- "explain": ONLY use this if the student has clearly understood and is ready, OR if we've exhausted probing ({state.current_probing_count} >= {state.probing_depth}).

DO NOT recommend "explain" just because the student is wrong. That's what Socratic method is for!

Return JSON:
{{
    "misconception_detected": true/false,
    "misconception_type": "type if detected, else null",
    "misconception_description": "brief description if detected",
    "evidence_quote": "quote from student showing misconception",
    "making_progress": true/false,
    "stuck_indicator": true/false,
    "reasoning_theme": "brief 3-5 word summary of their reasoning angle",
    "confusion_area": "what specifically confuses them, if apparent",
    "recommended_action": "continue|hint|address|explain"
}}"""


def _build_hint_prompt(
    question: Dict[str, Any],
    correct_answer_text: str,
    state: DiscussionState,
    hint_level: int,
    peer_name: str
) -> str:
    """Build prompt for graduated hints (levels 1-3)."""
    misconceptions_desc = "; ".join([m.get("description", "") for m in state.detected_misconceptions]) if state.detected_misconceptions else "No specific misconception identified"
    confusion_desc = ", ".join(state.confusion_areas) if state.confusion_areas else "General concept"

    if hint_level == 1:
        hint_instruction = """HINT LEVEL 1 - Direction Hint:
Give a gentle nudge toward the right thinking WITHOUT revealing the answer.
- Suggest a concept to think about
- Point to what makes this question tricky
- Keep it vague but helpful
Example: "What if you think about what makes something [key concept]?" """
    elif hint_level == 2:
        hint_instruction = """HINT LEVEL 2 - Contrast Hint:
Provide a key distinction or comparison that illuminates the concept.
- Highlight the difference between two similar concepts
- Use a contrasting example
- More direct but still doesn't give the answer
Example: "Here's a key difference: X can be determined true/false, but Y cannot because..." """
    else:
        hint_instruction = """HINT LEVEL 3 - Strong Scaffolding:
Provide most of the reasoning, let the student conclude.
- Walk through the logic step by step
- Leave only the final conclusion for them
- Almost teaching but they make the last connection
Example: "So if [concept] means X, and we look at your answer which has [property], that means..." """

    return f"""You are {peer_name}. The student needs a hint (level {hint_level} of 3).

QUESTION: {question.get('question_text', 'Unknown')}
CORRECT ANSWER: {correct_answer_text}
EXPLANATION: {question.get('explanation', 'Not available')}

Student's confusion areas: {confusion_desc}
Detected misconceptions: {misconceptions_desc}

{hint_instruction}

RULES:
- Be warm and encouraging
- Don't reveal the answer directly (except level 3 gets very close)
- Reference what they've been thinking about
- Keep it concise (2-3 sentences max)

Return JSON:
{{
    "message": "Your hint message"
}}"""


def _build_adaptive_explanation_prompt(
    question: Dict[str, Any],
    correct_answer_text: str,
    state: DiscussionState,
    history_text: str,
    peer_name: str
) -> str:
    """Build prompt for personalized explanation referencing student's journey."""
    # Gather student's key reasoning points
    reasoning_points = "; ".join(state.student_reasoning_points[-3:]) if state.student_reasoning_points else "No specific reasoning captured"
    confusion_areas = ", ".join(state.confusion_areas) if state.confusion_areas else "General understanding"
    misconceptions = "; ".join([f"{m.get('type', 'unknown')}: {m.get('description', '')}" for m in state.detected_misconceptions]) if state.detected_misconceptions else "None identified"

    return f"""You are {peer_name}. Time to give a personalized explanation.

QUESTION: {question.get('question_text', 'Unknown')}
CORRECT ANSWER: {correct_answer_text}
STANDARD EXPLANATION: {question.get('explanation', 'Not available')}

STUDENT'S JOURNEY:
- Their reasoning points: {reasoning_points}
- Areas of confusion: {confusion_areas}
- Misconceptions addressed: {misconceptions}
- Hints given: {state.hints_given}

CONVERSATION:
{history_text}

Create a PERSONALIZED explanation that:
1. Acknowledges what they DID understand correctly
2. Addresses their SPECIFIC misconception using their own words where possible
3. References their journey: "Remember when you said..." or "Earlier you mentioned..."
4. Explains why the correct answer is right
5. Ends with "Ready to try the question again?"

RULES:
- Keep it conversational and warm
- 3-4 sentences max
- Use their words/concepts when possible
- Don't be condescending

Return JSON:
{{
    "message": "Your personalized explanation ending with 'Ready to try the question again?'"
}}"""


def _build_stuck_recovery_prompt(
    question: Dict[str, Any],
    correct_answer_text: str,
    state: DiscussionState,
    last_student_message: str,
    peer_name: str
) -> str:
    """Build prompt when student is stuck - try a different angle."""
    return f"""You are {peer_name}. The student seems stuck on the same wrong idea.

QUESTION: {question.get('question_text', 'Unknown')}
CORRECT ANSWER: {correct_answer_text}

Student has repeated similar reasoning {state.stuck_count} times.
Their latest message: "{last_student_message}"
Their reasoning theme: {state.last_reasoning_theme}

Try a DIFFERENT APPROACH:
- Use a contrasting example
- Ask about an edge case
- Flip the question around
- Use an analogy

Don't repeat what you've already asked. Give them a fresh angle to think about.

Return JSON:
{{
    "message": "A fresh question from a different angle (1-2 sentences)"
}}"""


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
    attachment: Optional[Dict[str, Any]] = None,
    discussion_state: Optional[DiscussionState] = None,
    hint_requested: bool = False
) -> Dict[str, Any]:
    """
    Generate a context-aware AI peer response with adaptive Socratic method.

    Unlike simple AI peers, this:
    - References actual option text, not letter choices
    - Asks about the concept/reasoning, not "why did you pick A?"
    - Guides the student to discover the answer themselves
    - Maintains meaningful multi-turn conversations
    - Supports multimodal input (images, PDFs) for students to share their work
    - ADAPTIVE: Adjusts probing depth based on confidence/error type
    - ADAPTIVE: Detects when student is stuck and changes approach
    - ADAPTIVE: Provides graduated hints (3 levels)
    - ADAPTIVE: Personalizes final explanation to student's journey

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
        discussion_state: Current adaptive discussion state
        hint_requested: True if student explicitly requested a hint

    Returns:
        Dict with:
        - name: Peer name (e.g., "Alex")
        - message: The peer's response
        - follow_up_question: Optional follow-up to continue discussion
        - discussion_state: Updated state dict for storage
        - phase: Current phase for UI display
        - hints_given: Number of hints provided
        - can_request_hint: Whether student can request another hint
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

    # Initialize or restore discussion state
    state = discussion_state if discussion_state else DiscussionState()
    state.initial_confidence = confidence or 50

    if not MODEL:
        fallback = _fallback_response(
            peer_name, is_correct, student_answer_text, correct_answer_text,
            len(chat_history)
        )
        fallback["discussion_state"] = state.to_dict()
        fallback["phase"] = state.phase
        fallback["hints_given"] = state.hints_given
        fallback["can_request_hint"] = state.hints_given < 3 and not is_correct
        return fallback

    # Process attachment if present
    processed_attachment = process_attachment(attachment)
    attachment_context = ""
    if processed_attachment:
        attachment_context = "\n\nThe student has shared an image/document of their work. Please analyze it and incorporate it into your response."

    # Build contextual prompt
    is_first_message = len(chat_history) == 0
    # Count student messages to track exchange progress
    student_message_count = sum(1 for msg in chat_history if msg.get("role") == "student")
    last_student_message = ""
    if chat_history:
        for msg in reversed(chat_history):
            if msg.get("role") == "student":
                last_student_message = msg.get("content", "")
                break

    # ==================================================================
    # ADAPTIVE LOGIC: Determine which prompt to use based on state
    # ==================================================================

    prompt = None
    gave_lesson = False
    was_stuck = False  # Track if we detected stuck state before resetting

    # CASE 1: First message - do initial assessment
    if is_first_message and not is_correct:
        prompt = _build_initial_assessment_prompt(
            question, options, student_answer, student_answer_text,
            student_reasoning, correct_answer, correct_answer_text,
            confidence, peer_name
        )
        state.phase = "probing"

    # CASE 2: Hint requested by student
    elif hint_requested and not is_correct and state.hints_given < 3:
        state.hints_given += 1
        state.hints_requested += 1
        state.phase = "hinting"
        hint_level_desc = ["Direction", "Contrast", "Strong Scaffolding"][state.hints_given - 1]
        print(f"[smart_peer] HINT REQUESTED: Giving hint level {state.hints_given}/3 ({hint_level_desc})")
        prompt = _build_hint_prompt(
            question, correct_answer_text, state,
            state.hints_given, peer_name
        )

    # CASE 3: Continue adaptive discussion for wrong answers
    elif not is_correct and last_student_message:
        # First, analyze the student's response for misconceptions/progress
        analysis_prompt = _build_misconception_detection_prompt(
            question, correct_answer_text, history_text,
            last_student_message, state
        )

        try:
            analysis_response = await call_gemini_with_timeout(
                MODEL, [analysis_prompt],
                generation_config={"response_mime_type": "application/json"},
                context={"agent": "smart_peer", "operation": "misconception_detection"},
            )
            if analysis_response is None:
                raise RuntimeError("Gemini call returned None")
            analysis = json.loads(analysis_response.text)

            # Update state based on analysis
            if analysis.get("misconception_detected"):
                misconception_type = analysis.get("misconception_type", "unknown")
                misconception_desc = analysis.get("misconception_description", "")
                print(f"[smart_peer] MISCONCEPTION DETECTED: {misconception_type} - {misconception_desc[:50]}...")
                state.detected_misconceptions.append({
                    "type": misconception_type,
                    "description": misconception_desc,
                    "evidence": analysis.get("evidence_quote")
                })

            if analysis.get("confusion_area"):
                if analysis["confusion_area"] not in state.confusion_areas:
                    state.confusion_areas.append(analysis["confusion_area"])

            # Track reasoning for stuck detection
            new_theme = analysis.get("reasoning_theme", "")
            if new_theme and new_theme == state.last_reasoning_theme:
                state.stuck_count += 1
            else:
                state.stuck_count = 0
                state.last_reasoning_theme = new_theme

            # Store student's reasoning point
            if last_student_message and len(last_student_message) > 10:
                state.student_reasoning_points.append(last_student_message[:100])

            state.making_progress = analysis.get("making_progress", True)
            recommended_action = analysis.get("recommended_action", "continue")

            print(f"[smart_peer] Analysis: action={recommended_action}, stuck={state.stuck_count}, progress={state.making_progress}, probing={state.current_probing_count}/{state.probing_depth}")

            # Decide next action based on analysis
            state.current_probing_count += 1

            # Check if stuck (repeated same wrong idea 2+ times)
            was_stuck = state.stuck_count >= 2
            if was_stuck:
                print(f"[smart_peer] STUCK DETECTED: Student repeated same reasoning {state.stuck_count} times. Trying different angle.")
                prompt = _build_stuck_recovery_prompt(
                    question, correct_answer_text, state,
                    last_student_message, peer_name
                )
                state.stuck_count = 0  # Reset after trying different angle

            # Ready to explain? (reached probing depth OR recommended)
            elif state.current_probing_count >= state.probing_depth or recommended_action == "explain":
                state.phase = "explaining"
                prompt = _build_adaptive_explanation_prompt(
                    question, correct_answer_text, state,
                    history_text, peer_name
                )
                gave_lesson = True

            # Should give a hint? (recommended and haven't given 3 yet)
            elif recommended_action == "hint" and state.hints_given < 3:
                state.hints_given += 1
                state.phase = "hinting"
                prompt = _build_hint_prompt(
                    question, correct_answer_text, state,
                    state.hints_given, peer_name
                )

            # Address specific misconception
            elif recommended_action == "address" and state.detected_misconceptions:
                state.phase = "targeted"
                # Use a targeted question about the misconception
                prompt = _build_continuation_prompt(
                    peer_name, question, options, student_answer_text, correct_answer_text,
                    is_correct, history_text, last_student_message,
                    exchange_count=student_message_count
                )

            # Continue probing
            else:
                prompt = _build_continuation_prompt(
                    peer_name, question, options, student_answer_text, correct_answer_text,
                    is_correct, history_text, last_student_message,
                    exchange_count=student_message_count
                )

        except Exception as analysis_error:
            print(f"[smart_peer] Analysis failed: {analysis_error}")
            # Fallback to simple continuation
            prompt = _build_continuation_prompt(
                peer_name, question, options, student_answer_text, correct_answer_text,
                is_correct, history_text, last_student_message,
                exchange_count=student_message_count
            )

    # CASE 4: Correct answer or first message for correct
    else:
        if is_first_message:
            prompt = _build_opening_prompt(
                peer_name, question, options, student_answer, student_answer_text,
                student_reasoning, correct_answer, correct_answer_text, is_correct,
                confidence
            )
        else:
            prompt = _build_continuation_prompt(
                peer_name, question, options, student_answer_text, correct_answer_text,
                is_correct, history_text, last_student_message,
                exchange_count=student_message_count
            )

    # Add attachment context to prompt
    if attachment_context and prompt:
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

        response = await call_gemini_with_timeout(
            MODEL, content_parts,
            generation_config={"response_mime_type": "application/json"},
            context={"agent": "smart_peer", "operation": "generate_response"},
        )
        if response is None:
            raise RuntimeError("Gemini call returned None")
        result = json.loads(response.text)

        # Handle initial assessment response (sets probing_depth)
        if is_first_message and not is_correct and "probing_depth" in result:
            state.probing_depth = result.get("probing_depth", 3)
            state.error_type = result.get("error_type", "conceptual")
            likely_misconception = result.get("likely_misconception", "unknown")

            # Log detailed initial assessment
            confidence_level = "HIGH" if (confidence or 50) >= 70 else "LOW" if (confidence or 50) < 40 else "MEDIUM"
            print("[smart_peer] === INITIAL ASSESSMENT ===")
            print(f"[smart_peer]   Confidence: {confidence or 50}% ({confidence_level})")
            print(f"[smart_peer]   Error type: {state.error_type}")
            print(f"[smart_peer]   Probing depth: {state.probing_depth} (2=scaffolding, 3=standard, 4=challenge overconfidence)")
            print(f"[smart_peer]   Likely misconception: {likely_misconception}")
            print("[smart_peer] ==========================")

        print(f"[smart_peer] student_count={student_message_count}, phase={state.phase}, gave_lesson={gave_lesson}")

        return {
            "name": peer_name,
            "message": result.get("message", "That's interesting! Tell me more."),
            "follow_up_question": result.get("follow_up_question") if not gave_lesson else None,
            "ask_if_ready": gave_lesson,  # Frontend shows Yes/No buttons
            "ready_for_check": False,  # Only true when user confirms
            # New adaptive fields
            "discussion_state": state.to_dict(),
            "phase": state.phase,
            "hints_given": state.hints_given,
            "can_request_hint": state.hints_given < 3 and not is_correct,
            "stuck_detected": was_stuck or state.stuck_count >= 2,
            "misconceptions_count": len(state.detected_misconceptions)
        }
    except Exception as e:
        print(f"Smart peer response error: {e}")
        fallback = _fallback_response(
            peer_name, is_correct, student_answer_text, correct_answer_text,
            len(chat_history)
        )
        fallback["discussion_state"] = state.to_dict()
        fallback["phase"] = state.phase
        fallback["hints_given"] = state.hints_given
        fallback["can_request_hint"] = state.hints_given < 3 and not is_correct
        return fallback


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

CORRECT ANSWER: {correct_answer_text}
EXPLANATION: {question.get('explanation', 'Not available')}

CONVERSATION SO FAR:
{history_text}

STUDENT'S LATEST RESPONSE: "{last_student_message}"

Your job: Give a brief lesson, then ask if they're ready to try again.

STRUCTURE:
1. Brief acknowledgment (1 sentence)
2. Key lesson/insight (1-2 sentences)
3. End with EXACTLY: "Ready to try the question again?"

EXAMPLE:
"You've got it! The key insight is: in a balanced BST, each comparison eliminates half the remaining nodes, giving O(log n) time. Ready to try the question again?"

CRITICAL RULES:
- Keep it SHORT (2-3 sentences)
- DO NOT re-ask or repeat the original question
- DO NOT ask them to type the answer
- Just end with "Ready to try the question again?" - the UI will show the actual question
- NEVER reference letter choices (A, B, C, D)

Return JSON:
{{
    "message": "Brief lesson ending with 'Ready to try the question again?'"
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
                "message": "Hey! Nice work. Quick question - what made you confident that was the answer?",
                "ready_for_check": False
            }
        else:
            return {
                "name": peer_name,
                "message": "Hey! Interesting choice. What do you think makes something fit this definition vs not?",
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

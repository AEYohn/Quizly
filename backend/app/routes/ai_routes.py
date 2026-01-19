"""
AI Routes
API endpoints for AI-powered features: question generation, response analysis,
peer discussion, and exit tickets.
"""

import os
import json
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Import schemas
from ..schemas import (
    QuestionGenerateRequest,
    QuestionGenerateResponse,
    QuestionResponse,
    AnalyzeResponseRequest,
    AnalyzeResponseResponse,
    PeerDiscussionRequest,
    PeerDiscussionResponse,
    ExitTicketRequest,
    ExitTicketResponse,
    ConceptInput,
)

# Try to import AI agents
try:
    from ..ai_agents import QuestionBankGenerator
    AI_AGENTS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: AI agents not available: {e}")
    AI_AGENTS_AVAILABLE = False

# Try to configure Gemini
try:
    import google.generativeai as genai
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        MODEL = genai.GenerativeModel("gemini-2.0-flash")
        GEMINI_AVAILABLE = True
    else:
        MODEL = None
        GEMINI_AVAILABLE = False
except ImportError:
    MODEL = None
    GEMINI_AVAILABLE = False


router = APIRouter()


# ==============================================================================
# Question Generation
# ==============================================================================

@router.post("/generate-questions", response_model=QuestionGenerateResponse)
async def generate_questions(request: QuestionGenerateRequest):
    """
    Generate AI-powered questions for a topic.
    
    POST /ai/generate-questions
    
    Uses Gemini LLM to create educational multiple-choice questions
    with real content, plausible distractors, and detailed explanations.
    """
    if not AI_AGENTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI agents not available")
    
    # Convert concepts or auto-generate from topic
    concepts = []
    if request.concepts:
        concepts = [c.model_dump() for c in request.concepts]
    else:
        # Auto-generate concepts from topic using LLM
        concepts = await _generate_concepts_for_topic(request.topic, request.num_questions)
    
    if not concepts:
        raise HTTPException(status_code=400, detail="No concepts available for question generation")
    
    # Generate questions
    generator = QuestionBankGenerator()
    questions = []
    
    for i, concept in enumerate(concepts[:request.num_questions]):
        try:
            difficulty = 0.4 + (i * 0.15)  # Progressive difficulty
            q = generator.generate_question(concept, difficulty=min(difficulty, 0.85))
            questions.append(QuestionResponse(**q))
        except Exception as e:
            print(f"Failed to generate question for concept {concept.get('name', 'unknown')}: {e}")
    
    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate any questions")
    
    return QuestionGenerateResponse(
        topic=request.topic,
        questions=questions,
        generated_at=datetime.utcnow()
    )


async def _generate_concepts_for_topic(topic: str, num_concepts: int = 4) -> List[Dict]:
    """Generate concepts from a topic using LLM."""
    if not GEMINI_AVAILABLE:
        # Return minimal concepts
        return [{"id": f"concept_{i}", "name": f"{topic} Concept {i+1}", "topics": [], "misconceptions": []}
                for i in range(num_concepts)]
    
    prompt = f"""Generate {num_concepts} educational concepts for the topic: {topic}

For each concept, provide:
- id: snake_case identifier
- name: Human readable name
- topics: 2-3 related subtopics
- misconceptions: 2-3 common student misconceptions

Return ONLY valid JSON array:
[
  {{"id": "example_id", "name": "Example Concept", "topics": ["t1", "t2"], "misconceptions": ["m1", "m2"]}},
  ...
]"""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Failed to generate concepts: {e}")
        return [{"id": f"concept_{i}", "name": f"{topic} Concept {i+1}", "topics": [], "misconceptions": []}
                for i in range(num_concepts)]


# ==============================================================================
# Response Analysis
# ==============================================================================

@router.post("/analyze-response", response_model=AnalyzeResponseResponse)
async def analyze_response(request: AnalyzeResponseRequest):
    """
    Analyze a student's response with AI.
    
    POST /ai/analyze-response
    
    Provides feedback on correctness, reasoning quality, misconceptions,
    and tips for improvement.
    """
    if not GEMINI_AVAILABLE:
        # Basic analysis without LLM
        correct_answer = request.question.get("correct_answer", "A")
        is_correct = request.answer.upper() == correct_answer.upper()
        
        return AnalyzeResponseResponse(
            is_correct=is_correct,
            reasoning_score=50 if request.reasoning else 10,
            strengths=["Submitted an answer"] if is_correct else [],
            misconceptions=[],
            tips=["Review the explanation for this question"],
            feedback_message="Correct!" if is_correct else "Not quite. Review the explanation."
        )
    
    prompt = f"""Analyze this student's response to a multiple choice question.

QUESTION: {request.question.get('prompt', '')}
OPTIONS: {request.question.get('options', [])}
CORRECT ANSWER: {request.question.get('correct_answer', '')}

STUDENT'S ANSWER: {request.answer}
STUDENT'S REASONING: {request.reasoning or 'No reasoning provided'}
CONFIDENCE: {request.confidence}%

Analyze:
1. Is the answer correct?
2. Rate reasoning quality (0-100)
3. Identify strengths in their thinking
4. Identify any misconceptions
5. Provide tips for improvement
6. Write a brief feedback message

Return ONLY valid JSON:
{{
    "is_correct": true/false,
    "reasoning_score": 0-100,
    "strengths": ["strength1", "strength2"],
    "misconceptions": ["misconception1"],
    "tips": ["tip1", "tip2"],
    "feedback_message": "Brief encouraging message"
}}"""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)
        return AnalyzeResponseResponse(**result)
    except Exception as e:
        print(f"Analysis failed: {e}")
        correct_answer = request.question.get("correct_answer", "A")
        is_correct = request.answer.upper() == correct_answer.upper()
        return AnalyzeResponseResponse(
            is_correct=is_correct,
            reasoning_score=50,
            strengths=[],
            misconceptions=[],
            tips=["Review the material and try again"],
            feedback_message="Answer recorded."
        )


# ==============================================================================
# Peer Discussion
# ==============================================================================

@router.post("/peer-discussion", response_model=PeerDiscussionResponse)
async def generate_peer_discussion(request: PeerDiscussionRequest):
    """
    Generate an AI peer's perspective for discussion.
    
    POST /ai/peer-discussion
    
    Creates a simulated peer who may agree or disagree with the student,
    providing reasoning that promotes deeper thinking.
    """
    if not GEMINI_AVAILABLE:
        return PeerDiscussionResponse(
            peer_name="Alex",
            peer_answer="A",
            peer_reasoning="I think this is the correct approach based on the key concepts.",
            discussion_prompt="What made you choose your answer?",
            insight="Consider the underlying principles when evaluating options."
        )
    
    prompt = f"""You are a fellow student named Alex discussing a question with a classmate.

QUESTION: {request.question.get('prompt', '')}
OPTIONS: {request.question.get('options', [])}
CORRECT ANSWER: {request.question.get('correct_answer', '')}

YOUR CLASSMATE chose: {request.student_answer}
Their reasoning: {request.student_reasoning or 'Not provided'}

As Alex, provide your perspective. You should:
1. Sometimes agree, sometimes disagree (be pedagogically helpful)
2. Explain your reasoning in a student-like way
3. Ask a probing question to make them think
4. Share an insight that could help

Return ONLY valid JSON:
{{
    "peer_name": "Alex",
    "peer_answer": "A/B/C/D",
    "peer_reasoning": "Your reasoning as a student",
    "discussion_prompt": "A question for your classmate",
    "insight": "A helpful insight"
}}"""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)
        return PeerDiscussionResponse(**result)
    except Exception as e:
        print(f"Peer discussion generation failed: {e}")
        return PeerDiscussionResponse(
            peer_name="Alex",
            peer_answer=request.student_answer,
            peer_reasoning="I had a similar thought process.",
            discussion_prompt="What was the key factor in your decision?",
            insight="It's important to consider all the options carefully."
        )


# ==============================================================================
# Conversational Discussion (Student & Teacher Replies)
# ==============================================================================

# Import the new schemas
from ..schemas import (
    DiscussionMessage,
    StudentReplyRequest, 
    TeacherInterventionRequest,
    DiscussionContinueResponse,
)


@router.post("/discussion/student-reply", response_model=DiscussionContinueResponse)
async def student_reply_to_discussion(request: StudentReplyRequest):
    """
    Student replies to the peer discussion.
    
    POST /ai/discussion/student-reply
    
    The AI peer will respond to the student's reply, continuing the
    educational conversation. The discussion can go back-and-forth
    multiple times until the concept is understood.
    """
    # Format discussion history
    history_text = "\n".join([
        f"{msg.name} ({msg.role}): {msg.content}"
        for msg in request.discussion_history
    ]) if request.discussion_history else "No previous messages"
    
    answer_change_context = ""
    if request.wants_to_change_answer and request.new_answer:
        answer_change_context = f"\n\nThe student wants to CHANGE their answer to {request.new_answer}."
    
    if not GEMINI_AVAILABLE:
        return DiscussionContinueResponse(
            speaker_name="Alex",
            speaker_role="peer",
            message="That's a great point! I hadn't thought about it that way.",
            follow_up_question="Can you explain what made you think of that?",
            discussion_status="ongoing",
            learning_moment=None
        )
    
    prompt = f"""You are Alex, a fellow student continuing a peer discussion.

QUESTION: {request.question.get('prompt', '')}
OPTIONS: {request.question.get('options', [])}
CORRECT ANSWER: {request.question.get('correct_answer', '')}

DISCUSSION SO FAR:
{history_text}

STUDENT'S NEW REPLY: "{request.student_reply}"
{answer_change_context}

As Alex, respond naturally to continue the discussion:
1. Acknowledge their point
2. If they're getting closer to understanding, encourage them
3. If they're still confused, gently guide them
4. If they've got it right, celebrate the "aha moment"
5. Ask a follow-up question if the discussion should continue

Determine if:
- "ongoing" - more discussion needed
- "resolved" - student understands now
- "needs_teacher" - student is very confused, need instructor help

Return ONLY valid JSON:
{{
    "speaker_name": "Alex",
    "speaker_role": "peer",
    "message": "Your response to the student",
    "follow_up_question": "A follow-up question if ongoing, or null",
    "discussion_status": "ongoing/resolved/needs_teacher",
    "learning_moment": "Key insight if resolved, null otherwise"
}}"""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)
        return DiscussionContinueResponse(**result)
    except Exception as e:
        print(f"Student reply processing failed: {e}")
        return DiscussionContinueResponse(
            speaker_name="Alex",
            speaker_role="peer",
            message="Hmm, that's interesting! Let me think about that.",
            follow_up_question="What made you think of it that way?",
            discussion_status="ongoing",
            learning_moment=None
        )


@router.post("/discussion/teacher-intervene", response_model=DiscussionContinueResponse)
async def teacher_intervene_in_discussion(request: TeacherInterventionRequest):
    """
    Teacher intervenes in a peer discussion.
    
    POST /ai/discussion/teacher-intervene
    
    The teacher can provide hints, clarifications, redirect the discussion,
    or summarize key points. If no custom message is provided, AI generates
    an appropriate intervention based on the discussion history.
    """
    # Format discussion history
    history_text = "\n".join([
        f"{msg.name} ({msg.role}): {msg.content}"
        for msg in request.discussion_history
    ]) if request.discussion_history else "No previous messages"
    
    # If teacher provided a custom message, just use that
    if request.teacher_message:
        return DiscussionContinueResponse(
            speaker_name=request.teacher_name,
            speaker_role="teacher",
            message=request.teacher_message,
            follow_up_question=None,
            discussion_status="ongoing",
            learning_moment=None
        )
    
    if not GEMINI_AVAILABLE:
        return DiscussionContinueResponse(
            speaker_name=request.teacher_name,
            speaker_role="teacher",
            message="Great discussion! Let me add some context to help clarify.",
            follow_up_question=None,
            discussion_status="ongoing",
            learning_moment=None
        )
    
    intervention_prompts = {
        "hint": "Provide a subtle hint without giving away the answer",
        "clarification": "Clarify a concept that seems to be confusing the students",
        "redirect": "Redirect the discussion back on track",
        "summary": "Summarize the key learning points from this discussion"
    }
    
    instruction = intervention_prompts.get(
        request.intervention_type, 
        "Provide helpful guidance"
    )
    
    prompt = f"""You are {request.teacher_name}, the instructor.

QUESTION: {request.question.get('prompt', '')}
CORRECT ANSWER: {request.question.get('correct_answer', '')}
EXPLANATION: {request.question.get('explanation', '')}

STUDENT DISCUSSION SO FAR:
{history_text}

INTERVENTION TYPE: {request.intervention_type}
INSTRUCTION: {instruction}

As the instructor, provide an intervention that:
1. Is encouraging and supportive
2. Guides without giving away the answer (unless summarizing)
3. Helps students discover the concept themselves
4. Is concise (1-3 sentences for hints, longer for summaries)

Return ONLY valid JSON:
{{
    "speaker_name": "{request.teacher_name}",
    "speaker_role": "teacher",
    "message": "Your intervention message",
    "follow_up_question": "Optional question for students to consider",
    "discussion_status": "ongoing/resolved",
    "learning_moment": "Key concept if summarizing, null otherwise"
}}"""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)
        return DiscussionContinueResponse(**result)
    except Exception as e:
        print(f"Teacher intervention failed: {e}")
        return DiscussionContinueResponse(
            speaker_name=request.teacher_name,
            speaker_role="teacher",
            message="Let's think about this step by step. What's the key concept here?",
            follow_up_question=None,
            discussion_status="ongoing",
            learning_moment=None
        )
# ==============================================================================

@router.post("/exit-ticket", response_model=ExitTicketResponse)
async def generate_exit_ticket(request: ExitTicketRequest):
    """
    Generate a personalized exit ticket for a student.
    
    POST /ai/exit-ticket
    
    Creates a summary of the student's session with strengths,
    areas to improve, and a micro-lesson for their weakest area.
    """
    # Calculate basic stats
    total = len(request.responses)
    correct = sum(1 for r in request.responses if r.was_correct)
    score = int((correct / total * 100)) if total > 0 else 0
    
    # Find weak concepts
    weak_concepts = [r.concept for r in request.responses if not r.was_correct]
    strong_concepts = [r.concept for r in request.responses if r.was_correct]
    
    if not GEMINI_AVAILABLE:
        return ExitTicketResponse(
            student_name=request.student_name,
            overall_score=score,
            strengths=strong_concepts[:2] if strong_concepts else ["Completed all questions"],
            areas_to_improve=weak_concepts[:2] if weak_concepts else [],
            micro_lesson=f"Review {weak_concepts[0] if weak_concepts else request.topic} for better understanding.",
            follow_up_question=None
        )
    
    responses_summary = "\n".join([
        f"- Q: {r.question_prompt[:50]}... | Answer: {r.student_answer} | {'✓' if r.was_correct else '✗'} | Concept: {r.concept}"
        for r in request.responses
    ])
    
    prompt = f"""Create a personalized exit ticket for student: {request.student_name}
Topic: {request.topic}
Score: {score}% ({correct}/{total} correct)

Responses:
{responses_summary}

Create:
1. 2-3 specific strengths
2. 1-2 areas to improve
3. A short micro-lesson (2-3 sentences) for their weakest area
4. Optionally, a follow-up practice question (JSON format with prompt, options, correct_answer)

Return ONLY valid JSON:
{{
    "student_name": "{request.student_name}",
    "overall_score": {score},
    "strengths": ["strength1", "strength2"],
    "areas_to_improve": ["area1"],
    "micro_lesson": "Short lesson text",
    "follow_up_question": {{"prompt": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct_answer": "A"}} or null
}}"""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)
        return ExitTicketResponse(**result)
    except Exception as e:
        print(f"Exit ticket generation failed: {e}")
        return ExitTicketResponse(
            student_name=request.student_name,
            overall_score=score,
            strengths=strong_concepts[:2] if strong_concepts else ["Completed the session"],
            areas_to_improve=weak_concepts[:2] if weak_concepts else [],
            micro_lesson=f"Great effort! Focus on reviewing {weak_concepts[0] if weak_concepts else 'the material'}.",
            follow_up_question=None
        )


# ==============================================================================
# Health Check
# ==============================================================================

@router.get("/status")
async def ai_status():
    """Check AI service availability."""
    return {
        "ai_agents_available": AI_AGENTS_AVAILABLE,
        "gemini_available": GEMINI_AVAILABLE,
        "gemini_api_key_set": bool(os.getenv("GEMINI_API_KEY"))
    }

"""
AI Routes
API endpoints for AI-powered features: question generation, response analysis,
peer discussion, and exit tickets.
"""

import os
import asyncio
import json
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..rate_limiter import limiter, AI_RATE_LIMIT


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


def extract_question_count(message: str) -> int:
    """Extract number of questions from user message.

    Matches patterns like "50 questions", "40 Qns", "generate 20", etc.
    Returns default of 5 if no number is found.
    """
    patterns = [
        r'(\d+)\s*(?:questions?|qns?|mcqs?)',  # "50 questions", "40 Qns"
        r'generate\s*(\d+)',                     # "generate 50"
        r'create\s*(\d+)',                       # "create 50"
        r'make\s*(\d+)',                         # "make 50"
    ]

    message_lower = message.lower()
    for pattern in patterns:
        match = re.search(pattern, message_lower)
        if match:
            count = int(match.group(1))
            # Cap at reasonable max (100) and minimum of 1
            return max(1, min(count, 100))

    return 5  # Default: 5 questions if no number specified


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
@limiter.limit(AI_RATE_LIMIT)
async def generate_questions(request: Request, data: QuestionGenerateRequest):
    """
    Generate AI-powered questions for a topic.
    
    POST /ai/generate-questions
    
    Uses Gemini LLM to create educational questions (MCQ or code)
    with real content, plausible distractors, and detailed explanations.
    """
    if not AI_AGENTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI agents not available")
    
    # Convert concepts or auto-generate from topic
    concepts = []
    if data.concepts:
        concepts = [c.model_dump() for c in data.concepts]
    else:
        # Auto-generate concepts from topic using LLM
        concepts = await _generate_concepts_for_topic(data.topic, data.num_questions)
    
    if not concepts:
        raise HTTPException(status_code=400, detail="No concepts available for question generation")
    
    # Generate questions
    generator = QuestionBankGenerator()
    questions = []
    
    # Get question parameters
    question_type = getattr(data, 'question_type', 'conceptual')
    target_misconception = getattr(data, 'target_misconception', None)
    question_format = getattr(data, 'format', 'mcq')
    code_language = getattr(data, 'language', 'python')
    
    for i, concept in enumerate(concepts[:data.num_questions]):
        if i > 0 and GEMINI_AVAILABLE:
            await asyncio.sleep(1.5)
        try:
            difficulty = 0.4 + (i * 0.15)  # Progressive difficulty
            
            # Determine format for this question
            if question_format == 'mixed':
                # Alternate between MCQ and code
                current_format = 'code' if i % 2 == 1 else 'mcq'
            else:
                current_format = question_format
            
            if current_format == 'code':
                # Generate code question
                q = await _generate_code_question(
                    concept, 
                    difficulty=min(difficulty, 0.85),
                    language=code_language
                )
            else:
                # Generate MCQ question
                q = generator.generate_question(
                    concept, 
                    difficulty=min(difficulty, 0.85),
                    question_type=question_type,
                    target_misconception=target_misconception
                )
            
            questions.append(QuestionResponse(**q))
        except Exception as e:
            print(f"Failed to generate question for concept {concept.get('name', 'unknown')}: {e}")
    
    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate any questions")
    
    return QuestionGenerateResponse(
        topic=data.topic,
        questions=questions,
        generated_at=utc_now()
    )


class RemediationQuestionRequest(BaseModel):
    """Request for generating a remediation question."""
    concept: ConceptInput
    misconception: str
    student_name: Optional[str] = None
    difficulty: float = 0.5


class CodingProblemRequest(BaseModel):
    """Request for generating a coding problem."""
    concept: str  # e.g., "binary search", "two pointers", "hash tables"
    difficulty: str = "medium"  # easy, medium, hard
    problem_type: str = "algorithm"  # algorithm, data_structure, string, math
    course_context: Optional[str] = None
    save_to_db: bool = False  # Whether to save the generated problem to database


class CodingProblemBatchRequest(BaseModel):
    """Request for generating multiple coding problems."""
    topic: str
    concepts: List[str]
    difficulty_distribution: Optional[Dict[str, int]] = None  # {"easy": 2, "medium": 3, "hard": 1}
    course_context: Optional[str] = None
    save_to_db: bool = False


@router.post("/generate-coding-problem")
@limiter.limit(AI_RATE_LIMIT)
async def generate_coding_problem(request: Request, data: CodingProblemRequest):
    """
    Generate a LeetCode-style coding problem using AI.
    
    POST /ai/generate-coding-problem
    
    Creates a complete coding problem with:
    - Problem description with examples
    - Starter code for Python, C++, JavaScript
    - Driver code for test execution
    - Test cases with expected outputs
    """
    try:
        from ..ai_agents.coding_problem_generator import CodingProblemGenerator
    except ImportError:
        raise HTTPException(status_code=503, detail="Coding problem generator not available")
    
    generator = CodingProblemGenerator()
    
    try:
        problem = generator.generate_problem(
            concept=data.concept,
            difficulty=data.difficulty,
            problem_type=data.problem_type,
            course_context=data.course_context
        )
        
        if problem.get("llm_required"):
            raise HTTPException(status_code=503, detail="LLM not available for problem generation")
        
        # Optionally save to database
        if data.save_to_db:
            # Import here to avoid circular imports
            from ..database import get_db
            from ..db_models import CodingProblem, TestCase
            from sqlalchemy.ext.asyncio import AsyncSession
            import uuid
            
            # This would need to be done with proper DB session
            # For now, just return the problem
            pass
        
        return {
            "problem": problem,
            "generated_at": utc_now(),
            "message": "Problem generated successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate coding problem: {e}")


@router.post("/generate-coding-problems-batch")
@limiter.limit("5/minute")  # Stricter limit for batch operations
async def generate_coding_problems_batch(request: Request, data: CodingProblemBatchRequest):
    """
    Generate multiple LeetCode-style coding problems for a topic.
    
    POST /ai/generate-coding-problems-batch
    
    Creates multiple problems for different concepts with varied difficulty.
    """
    try:
        from ..ai_agents.coding_problem_generator import CodingProblemGenerator
    except ImportError:
        raise HTTPException(status_code=503, detail="Coding problem generator not available")
    
    generator = CodingProblemGenerator()
    
    try:
        problems = generator.generate_problems_for_topic(
            topic=data.topic,
            concepts=data.concepts,
            difficulty_distribution=data.difficulty_distribution,
            course_context=data.course_context
        )
        
        # Filter out any LLM-required fallbacks
        valid_problems = [p for p in problems if not p.get("llm_required")]
        
        return {
            "topic": data.topic,
            "problems": valid_problems,
            "total_generated": len(valid_problems),
            "generated_at": utc_now(),
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate coding problems: {e}")


@router.post("/generate-remediation-question")
@limiter.limit(AI_RATE_LIMIT)
async def generate_remediation_question(request: Request, data: RemediationQuestionRequest):
    """
    Generate a question specifically targeting a misconception for remediation.
    
    POST /ai/generate-remediation-question
    
    Creates a question designed to expose and address a specific student misconception.
    """
    if not AI_AGENTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI agents not available")
    
    generator = QuestionBankGenerator()
    concept_dict = data.concept.model_dump()
    
    try:
        q = generator.generate_question(
            concept_dict,
            difficulty=data.difficulty,
            target_misconception=data.misconception,
            question_type="conceptual"  # Best for addressing misconceptions
        )
        
        return {
            "question": QuestionResponse(**q),
            "target_misconception": data.misconception,
            "student_name": data.student_name,
            "purpose": f"Remediation question targeting: {data.misconception}",
            "generated_at": utc_now()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate remediation question: {e}")


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


async def _generate_code_question(concept: Dict, difficulty: float = 0.5, language: str = "python") -> Dict:
    """Generate a code question using Gemini LLM."""
    import uuid
    
    concept_name = concept.get("name", "Programming")
    topics = concept.get("topics", [])
    
    # Language-specific starter code examples that match the actual code runner wrapper
    if language == "cpp":
        default_starter = '''class Solution {
public:
    int solution(int n, vector<int>& arr) {
        // Your code here
        
        return 0;
    }
};'''
        language_note = """
For C++: Use class Solution with a public method. The code runner expects this format.
Available includes: iostream, vector, string, algorithm, map, set, queue, stack, cmath
Example:
class Solution {
public:
    int myFunction(vector<int>& nums) {
        // Your code here
        return 0;
    }
};"""
    elif language == "javascript":
        default_starter = '''function solution(nums) {
    // Your code here
    
}'''
        language_note = "For JavaScript: Input is parsed from JSON and passed as arguments to solution()."
    else:  # python
        default_starter = '''def solution(nums):
    # Your code here
    pass'''
        language_note = "For Python: Input is parsed from JSON and passed as kwargs (dict) or args (list/value)."
    
    if not GEMINI_AVAILABLE:
        # Return a basic code question template
        return {
            "id": str(uuid.uuid4()),
            "concept": concept_name,
            "difficulty": difficulty,
            "question_type": "code",
            "prompt": f"Write a {language} function that demonstrates {concept_name}.",
            "options": [],
            "correct_answer": "",
            "explanation": f"This question tests your understanding of {concept_name}.",
            "common_traps": [],
            "starter_code": default_starter,
            "test_cases": [
                {"input": "[1, 2, 3]", "expected_output": "6", "is_hidden": False}
            ],
            "language": language,
            "expected_output": None
        }
    
    # Difficulty description
    difficulty_label = "easy" if difficulty < 0.4 else "medium" if difficulty < 0.7 else "hard"
    
    prompt = f"""Generate a {difficulty_label} coding question about {concept_name} in {language}.
Related topics: {', '.join(topics) if topics else concept_name}

{language_note}

Requirements:
1. A clear problem statement asking to write a function
2. SKELETON starter code with function signature (NOT the solution - students implement the logic)
3. 3-4 test cases with VALID JSON input format (at least 1 hidden)
4. Example input/output in the prompt
5. A detailed explanation of the solution approach

CRITICAL - TEST CASE INPUT FORMAT:
- Must be valid JSON that can be parsed
- Arrays: "[1, 2, 3]"  
- Numbers: "5" or "3.14"
- Strings: "\\"hello\\""
- Multiple params: "{{\\"n\\": 5, \\"arr\\": [1, 2, 3]}}"
- DO NOT use formats like "n = 5, arr = {{1,2,3}}" - that's not valid JSON!

CRITICAL - STARTER CODE:
- Provide SKELETON code with function signature only
- Use comments like "# Your code here" or "// TODO: implement"
- DO NOT include the solution logic
- The function should be named "solution" for consistency

Example starter code for {language}:
```
{default_starter}
```

Return ONLY valid JSON:
{{
    "prompt": "Problem description with example input/output",
    "starter_code": "<skeleton code matching the language>",
    "test_cases": [
        {{"input": "[1, 2, 3]", "expected_output": "6", "is_hidden": false}},
        {{"input": "[10, 20, 30]", "expected_output": "60", "is_hidden": true}}
    ],
    "explanation": "Solution approach and key concepts"
}}"""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)
        
        return {
            "id": str(uuid.uuid4()),
            "concept": concept_name,
            "difficulty": difficulty,
            "question_type": "code",
            "prompt": result.get("prompt", f"Code question about {concept_name}"),
            "options": [],
            "correct_answer": "",
            "explanation": result.get("explanation", ""),
            "common_traps": [],
            "starter_code": result.get("starter_code", default_starter),
            "test_cases": result.get("test_cases", []),
            "language": language,
            "expected_output": None
        }
    except Exception as e:
        print(f"Failed to generate code question: {e}")
        return {
            "id": str(uuid.uuid4()),
            "concept": concept_name,
            "difficulty": difficulty,
            "question_type": "code",
            "prompt": f"Write a {language} function that demonstrates {concept_name}.",
            "options": [],
            "correct_answer": "",
            "explanation": f"This question tests your understanding of {concept_name}.",
            "common_traps": [],
            "starter_code": default_starter,
            "test_cases": [
                {"input": "[1, 2, 3]", "expected_output": "6", "is_hidden": False}
            ],
            "language": language,
            "expected_output": None
        }


# ==============================================================================
# Response Analysis
# ==============================================================================

class AnalyzeCodeRequest(BaseModel):
    """Request to analyze student's code submission."""
    problem_description: str
    student_code: str
    language: str = "python"
    test_results: list = []
    error_message: str = None

class AnalyzeCodeResponse(BaseModel):
    """AI analysis of student's code."""
    summary: str
    issues: list[str]
    suggestions: list[str]
    hints: list[str]
    correct_approach: str
    complexity_analysis: str = None

@router.post("/analyze-code")
@limiter.limit(AI_RATE_LIMIT)
async def analyze_code(request: Request, data: AnalyzeCodeRequest):
    """
    Analyze a student's code submission with AI.
    Provides detailed feedback on what's wrong and how to fix it.
    
    POST /ai/analyze-code
    """
    if not GEMINI_AVAILABLE:
        return AnalyzeCodeResponse(
            summary="AI analysis not available",
            issues=["Could not analyze code - AI service unavailable"],
            suggestions=["Check your logic and try again"],
            hints=["Review the problem requirements"],
            correct_approach="Implement the algorithm step by step"
        )
    
    # Build test results summary
    test_summary = ""
    if data.test_results:
        passed = sum(1 for t in data.test_results if t.get("status") == "passed")
        total = len(data.test_results)
        test_summary = f"\n\nTest Results: {passed}/{total} passed"
        for i, t in enumerate(data.test_results[:3]):  # Show first 3
            if t.get("status") != "passed":
                test_summary += f"\n- Test {i+1}: Input={t.get('input')}, Expected={t.get('expected_output')}, Got={t.get('actual_output', 'error')}"
    
    error_info = f"\n\nError: {data.error_message}" if data.error_message else ""
    
    prompt = f"""Analyze this student's {data.language} code submission and provide helpful feedback.

PROBLEM:
{data.problem_description}

STUDENT'S CODE:
```{data.language}
{data.student_code}
```
{test_summary}{error_info}

Provide a JSON response with:
1. "summary": Brief 1-2 sentence summary of what's wrong (be encouraging but honest)
2. "issues": List of specific bugs or logic errors found (max 3)
3. "suggestions": Concrete code fixes they should make (max 3)
4. "hints": Conceptual hints without giving away the answer (max 2)
5. "correct_approach": High-level description of the correct algorithm/approach
6. "complexity_analysis": Expected time/space complexity for optimal solution

Be educational and encouraging. Don't give the complete solution, but guide them.

Return ONLY valid JSON."""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)
        return AnalyzeCodeResponse(**result)
    except Exception as e:
        print(f"Code analysis failed: {e}")
        return AnalyzeCodeResponse(
            summary="Your code has some issues. Let's work through them!",
            issues=["Check your implementation against the requirements"],
            suggestions=["Try tracing through your code with the example inputs"],
            hints=["Think about edge cases", "Consider the base case"],
            correct_approach="Break down the problem into smaller steps"
        )


@router.post("/analyze-response", response_model=AnalyzeResponseResponse)
@limiter.limit(AI_RATE_LIMIT)
async def analyze_response(request: Request, data: AnalyzeResponseRequest):
    """
    Analyze a student's response with AI.
    
    POST /ai/analyze-response
    
    Provides feedback on correctness, reasoning quality, misconceptions,
    and tips for improvement.
    """
    if not GEMINI_AVAILABLE:
        # Basic analysis without LLM
        correct_answer = data.question.get("correct_answer", "A")
        is_correct = data.answer.upper() == correct_answer.upper()
        
        return AnalyzeResponseResponse(
            is_correct=is_correct,
            reasoning_score=50 if data.reasoning else 10,
            strengths=["Submitted an answer"] if is_correct else [],
            misconceptions=[],
            tips=["Review the explanation for this question"],
            feedback_message="Correct!" if is_correct else "Not quite. Review the explanation."
        )
    
    prompt = f"""Analyze this student's response to a multiple choice question.

QUESTION: {data.question.get('prompt', '')}
OPTIONS: {data.question.get('options', [])}
CORRECT ANSWER: {data.question.get('correct_answer', '')}

STUDENT'S ANSWER: {data.answer}
STUDENT'S REASONING: {data.reasoning or 'No reasoning provided'}
CONFIDENCE: {data.confidence}%

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
        correct_answer = data.question.get("correct_answer", "A")
        is_correct = data.answer.upper() == correct_answer.upper()
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

# Configurable peer name
PEER_NAME = os.getenv("AI_PEER_NAME", "Alex")

@router.post("/peer-discussion", response_model=PeerDiscussionResponse)
@limiter.limit(AI_RATE_LIMIT)
async def generate_peer_discussion(request: Request, data: PeerDiscussionRequest):
    """
    Generate an AI peer's perspective for discussion.
    
    POST /ai/peer-discussion
    
    Creates a simulated peer who may agree or disagree with the student,
    providing reasoning that promotes deeper thinking.
    """
    if not GEMINI_AVAILABLE:
        return PeerDiscussionResponse(
            peer_name=PEER_NAME,
            peer_answer="A",
            peer_reasoning="I think this is the correct approach based on the key concepts.",
            discussion_prompt="What made you choose your answer?",
            insight="Consider the underlying principles when evaluating options."
        )
    
    prompt = f"""You are a fellow student named {PEER_NAME} discussing a question with a classmate.

QUESTION: {data.question.get('prompt', '')}
OPTIONS: {data.question.get('options', [])}
CORRECT ANSWER: {data.question.get('correct_answer', '')}

YOUR CLASSMATE chose: {data.student_answer}
Their reasoning: {data.student_reasoning or 'Not provided'}

As {PEER_NAME}, provide your perspective. You should:
1. Sometimes agree, sometimes disagree (be pedagogically helpful)
2. Explain your reasoning in a student-like way
3. Ask a probing question to make them think
4. Share an insight that could help

Return ONLY valid JSON:
{{
    "peer_name": "{PEER_NAME}",
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
        # Handle case where AI returns a list instead of an object
        if isinstance(result, list):
            result = result[0] if result else {}
        return PeerDiscussionResponse(**result)
    except Exception as e:
        print(f"Peer discussion generation failed: {e}")
        return PeerDiscussionResponse(
            peer_name=PEER_NAME,
            peer_answer=data.student_answer,
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
@limiter.limit(AI_RATE_LIMIT)
async def student_reply_to_discussion(request: Request, data: StudentReplyRequest):
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
        for msg in data.discussion_history
    ]) if data.discussion_history else "No previous messages"
    
    answer_change_context = ""
    if data.wants_to_change_answer and data.new_answer:
        answer_change_context = f"\n\nThe student wants to CHANGE their answer to {data.new_answer}."
    
    if not GEMINI_AVAILABLE:
        return DiscussionContinueResponse(
            speaker_name=PEER_NAME,
            speaker_role="peer",
            message="That's a great point! I hadn't thought about it that way.",
            follow_up_question="Can you explain what made you think of that?",
            discussion_status="ongoing",
            learning_moment=None
        )
    
    prompt = f"""You are {PEER_NAME}, a fellow student continuing a peer discussion.

QUESTION: {data.question.get('prompt', '')}
OPTIONS: {data.question.get('options', [])}
CORRECT ANSWER: {data.question.get('correct_answer', '')}

DISCUSSION SO FAR:
{history_text}

STUDENT'S NEW REPLY: "{data.student_reply}"
{answer_change_context}

As {PEER_NAME}, respond naturally to continue the discussion:
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
    "speaker_name": "{PEER_NAME}",
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
            speaker_name=PEER_NAME,
            speaker_role="peer",
            message="Hmm, that's interesting! Let me think about that.",
            follow_up_question="What made you think of it that way?",
            discussion_status="ongoing",
            learning_moment=None
        )


@router.post("/discussion/teacher-intervene", response_model=DiscussionContinueResponse)
@limiter.limit(AI_RATE_LIMIT)
async def teacher_intervene_in_discussion(request: Request, data: TeacherInterventionRequest):
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
        for msg in data.discussion_history
    ]) if data.discussion_history else "No previous messages"
    
    # If teacher provided a custom message, just use that
    if data.teacher_message:
        return DiscussionContinueResponse(
            speaker_name=data.teacher_name,
            speaker_role="teacher",
            message=data.teacher_message,
            follow_up_question=None,
            discussion_status="ongoing",
            learning_moment=None
        )
    
    if not GEMINI_AVAILABLE:
        return DiscussionContinueResponse(
            speaker_name=data.teacher_name,
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
        data.intervention_type, 
        "Provide helpful guidance"
    )
    
    prompt = f"""You are {data.teacher_name}, the instructor.

QUESTION: {data.question.get('prompt', '')}
CORRECT ANSWER: {data.question.get('correct_answer', '')}
EXPLANATION: {data.question.get('explanation', '')}

STUDENT DISCUSSION SO FAR:
{history_text}

INTERVENTION TYPE: {data.intervention_type}
INSTRUCTION: {instruction}

As the instructor, provide an intervention that:
1. Is encouraging and supportive
2. Guides without giving away the answer (unless summarizing)
3. Helps students discover the concept themselves
4. Is concise (1-3 sentences for hints, longer for summaries)

Return ONLY valid JSON:
{{
    "speaker_name": "{data.teacher_name}",
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
            speaker_name=data.teacher_name,
            speaker_role="teacher",
            message="Let's think about this step by step. What's the key concept here?",
            follow_up_question=None,
            discussion_status="ongoing",
            learning_moment=None
        )


# ==============================================================================
# Exit Ticket
# ==============================================================================

@router.post("/exit-ticket", response_model=ExitTicketResponse)
@limiter.limit(AI_RATE_LIMIT)
async def generate_exit_ticket(request: Request, data: ExitTicketRequest):
    """
    Generate a personalized exit ticket for a student.
    
    POST /ai/exit-ticket
    
    Creates a summary of the student's session with strengths,
    areas to improve, and a micro-lesson for their weakest area.
    """
    # Calculate basic stats
    total = len(data.responses)
    correct = sum(1 for r in data.responses if r.was_correct)
    score = int((correct / total * 100)) if total > 0 else 0
    
    # Find weak concepts
    weak_concepts = [r.concept for r in data.responses if not r.was_correct]
    strong_concepts = [r.concept for r in data.responses if r.was_correct]
    
    if not GEMINI_AVAILABLE:
        return ExitTicketResponse(
            student_name=data.student_name,
            overall_score=score,
            strengths=strong_concepts[:2] if strong_concepts else ["Completed all questions"],
            areas_to_improve=weak_concepts[:2] if weak_concepts else [],
            micro_lesson=f"Review {weak_concepts[0] if weak_concepts else data.topic} for better understanding.",
            follow_up_question=None
        )
    
    responses_summary = "\n".join([
        f"- Q: {r.question_prompt[:50]}... | Answer: {r.student_answer} | {'✓' if r.was_correct else '✗'} | Concept: {r.concept}"
        for r in data.responses
    ])
    
    prompt = f"""Create a personalized exit ticket for student: {data.student_name}
Topic: {data.topic}
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
    "student_name": "{data.student_name}",
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
            student_name=data.student_name,
            overall_score=score,
            strengths=strong_concepts[:2] if strong_concepts else ["Completed the session"],
            areas_to_improve=weak_concepts[:2] if weak_concepts else [],
            micro_lesson=f"Great effort! Focus on reviewing {weak_concepts[0] if weak_concepts else 'the material'}.",
            follow_up_question=None
        )


# ==============================================================================
# AI Chat Interface for Question Generation
# ==============================================================================

class ChatAttachment(BaseModel):
    """Attachment in chat message (image, file, or text)."""
    type: str  # "image", "file", "text"
    name: str
    content: str  # base64 for images, text content for files
    mime_type: Optional[str] = None


class ChatGenerateRequest(BaseModel):
    """Request for AI chat-based question generation."""
    message: str
    question_type: str = "mcq"  # "mcq" or "coding"
    attachments: Optional[List[ChatAttachment]] = None


class ChatGenerateResponse(BaseModel):
    """Response from AI chat generation."""
    message: str
    questions: Optional[List[Dict[str, Any]]] = None
    coding_problem: Optional[Dict[str, Any]] = None


@router.post("/chat-generate", response_model=ChatGenerateResponse)
@limiter.limit("10/minute")
async def chat_generate(request: Request, data: ChatGenerateRequest):
    """
    AI chat interface for generating questions from text, images, or files.
    
    POST /ai/chat-generate
    
    Accepts multimodal input (text + images + files) and generates
    questions based on the content.
    """
    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini AI not available. Please set GEMINI_API_KEY.")
    
    # Build the prompt parts
    prompt_parts = []
    
    # Add attachments to prompt
    if data.attachments:
        import base64
        for att in data.attachments:
            # Handle base64 content (extract after data: prefix)
            content = att.content
            if content.startswith("data:"):
                content = content.split(",")[1] if "," in content else content

            if att.type == "image":
                # Create image part for Gemini
                image_part = {
                    "mime_type": att.mime_type or "image/jpeg",
                    "data": content
                }
                prompt_parts.append(image_part)
                prompt_parts.append(f"\n[Image uploaded]\n")
            elif att.type == "pdf":
                # Create PDF part for Gemini (Gemini 2.0 supports PDFs directly)
                pdf_part = {
                    "mime_type": "application/pdf",
                    "data": content
                }
                prompt_parts.append(pdf_part)
                prompt_parts.append(f"\n[PDF document: {att.name}]\n")
            elif att.type == "file":
                prompt_parts.append(f"\n--- File: {att.name} ---\n{att.content}\n--- End File ---\n")
            elif att.type == "text":
                prompt_parts.append(f"\n--- Text Content ---\n{att.content}\n--- End Text ---\n")
    
    # Build the generation prompt based on question type
    # Extract the number of questions from the user's message
    question_count = extract_question_count(data.message)

    if data.question_type == "mcq":
        system_prompt = f"""You are an expert educator creating multiple choice questions.

Based on the user's request and any provided content (images, files, text), generate educational multiple choice questions.

IMPORTANT: Generate EXACTLY {question_count} questions. This number was extracted from the user's request.

For each question, provide:
1. A clear question
2. 4 answer options (A, B, C, D)
3. The index of the correct answer (0-3)
4. A brief explanation
5. Difficulty level (easy, medium, hard)
6. The concept being tested

Return ONLY valid JSON in this exact format:
{{
    "message": "Brief response to the user about what you generated",
    "questions": [
        {{
            "question": "Question text here",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": 0,
            "explanation": "Why this is correct",
            "difficulty": "medium",
            "concept": "Topic/concept tested"
        }}
    ]
}}

You MUST generate exactly {question_count} questions.
Make questions educational and test real understanding, not just memorization.
If the user requested increasing difficulty, vary the difficulty from easy to hard across the questions."""

    else:  # coding
        system_prompt = """You are an expert educator creating coding problems.

Based on the user's request and any provided content, generate a coding problem.

The problem should include:
1. A clear title
2. A problem description with examples
3. Function signature
4. Test cases

Return ONLY valid JSON in this exact format:
{
    "message": "Brief response about the problem you created",
    "coding_problem": {
        "title": "Problem Title",
        "description": "Full problem description with examples",
        "difficulty": "medium",
        "function_name": "solveProblem",
        "parameters": [
            {"name": "nums", "type": "list[int]", "description": "Array of integers"}
        ],
        "return_type": "int",
        "starter_code": {
            "python": "class Solution:\\n    def solveProblem(self, nums: list[int]) -> int:\\n        pass"
        },
        "test_cases": [
            {"input": "nums = [1, 2, 3]", "expected": "6"}
        ]
    }
}"""

    # Add user message
    full_prompt = f"{system_prompt}\n\nUser request: {data.message}"
    prompt_parts.append(full_prompt)
    
    try:
        # Generate with Gemini
        response = MODEL.generate_content(prompt_parts)
        
        # Parse the response
        response_text = response.text.strip()
        
        # Extract JSON from response
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        result = json.loads(response_text)
        
        return ChatGenerateResponse(
            message=result.get("message", "Questions generated successfully!"),
            questions=result.get("questions"),
            coding_problem=result.get("coding_problem"),
        )
        
    except json.JSONDecodeError as e:
        # If JSON parsing fails, return the raw text as message
        return ChatGenerateResponse(
            message=f"I generated some content but couldn't format it properly. Here's what I created:\n\n{response.text[:1000]}",
            questions=None,
            coding_problem=None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation error: {str(e)}")


# ==============================================================================
# Health Check
# ==============================================================================

@router.get("/status")
async def ai_status():
    """Check AI service availability."""
    return {
        "ai_agents_available": AI_AGENTS_AVAILABLE,
        "gemini_available": GEMINI_AVAILABLE,
        "gemini_api_key_set": bool(os.getenv("GEMINI_API_KEY")),
        "rate_limit": AI_RATE_LIMIT,
        "peer_name": PEER_NAME
    }

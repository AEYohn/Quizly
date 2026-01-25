"""
Coding Problems Routes
LeetCode-style coding problems for competitions.
"""

from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from ..database import get_db
from ..db_models import CodingProblem, TestCase, CodeSubmission, Session, User
from ..auth import get_current_user_optional, get_current_user


router = APIRouter()


# Pydantic schemas
class TestCaseCreate(BaseModel):
    input_data: str
    expected_output: str
    explanation: Optional[str] = None
    is_hidden: bool = False
    is_example: bool = False
    points: int = 10


class TestCaseResponse(BaseModel):
    id: str
    input_data: str
    expected_output: str
    explanation: Optional[str]
    is_hidden: bool
    is_example: bool
    order_index: int
    points: int

    class Config:
        from_attributes = True


class CodingProblemCreate(BaseModel):
    title: str
    description: str
    difficulty: str = "medium"
    subject: str = "programming"
    tags: List[str] = []
    hints: List[str] = []
    constraints: Optional[str] = None
    starter_code: dict = {}
    solution_code: dict = {}
    time_limit_seconds: int = 300
    points: int = 100
    session_id: Optional[str] = None
    test_cases: List[TestCaseCreate] = []


class CodingProblemResponse(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    subject: str
    tags: List[str]
    hints: List[str]
    constraints: Optional[str]
    starter_code: dict
    time_limit_seconds: int
    points: int
    solve_count: int
    attempt_count: int
    test_cases: List[TestCaseResponse]

    class Config:
        from_attributes = True


class CodeSubmissionCreate(BaseModel):
    code: str
    language: str
    student_name: Optional[str] = "Anonymous"


class CodeSubmissionResponse(BaseModel):
    id: str
    problem_id: str
    student_name: str
    language: str
    status: str
    tests_passed: int
    tests_total: int
    score: int
    execution_time_ms: Optional[int]
    error_message: Optional[str]
    test_results: List[dict]
    submitted_at: str

    class Config:
        from_attributes = True


# Routes
@router.get("")
async def list_coding_problems(
    subject: Optional[str] = None,
    difficulty: Optional[str] = None,
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List coding problems with optional filters."""
    query = select(CodingProblem).options(selectinload(CodingProblem.test_cases))
    
    if subject:
        query = query.where(CodingProblem.subject == subject)
    if difficulty:
        query = query.where(CodingProblem.difficulty == difficulty)
    if session_id:
        query = query.where(CodingProblem.session_id == UUID(session_id))
    
    query = query.order_by(CodingProblem.order_index, CodingProblem.created_at.desc())
    result = await db.execute(query)
    problems = result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "description": p.description[:200] + "..." if len(p.description) > 200 else p.description,
            "difficulty": p.difficulty,
            "subject": p.subject,
            "tags": p.tags if isinstance(p.tags, list) else [],
            "points": p.points,
            "solve_count": p.solve_count,
            "attempt_count": p.attempt_count,
            "test_case_count": len(p.test_cases) if p.test_cases else 0,
        }
        for p in problems
    ]


@router.get("/my")
async def list_my_coding_problems(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List coding problems created by the current user."""
    query = select(CodingProblem).options(
        selectinload(CodingProblem.test_cases)
    ).where(CodingProblem.creator_id == current_user.id)

    query = query.order_by(CodingProblem.created_at.desc())
    result = await db.execute(query)
    problems = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "title": p.title,
            "description": p.description[:200] + "..." if len(p.description) > 200 else p.description,
            "difficulty": p.difficulty,
            "subject": p.subject,
            "tags": p.tags if isinstance(p.tags, list) else [],
            "points": p.points,
            "solve_count": p.solve_count,
            "attempt_count": p.attempt_count,
            "test_case_count": len(p.test_cases) if p.test_cases else 0,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in problems
    ]


@router.get("/public")
async def list_public_coding_problems(
    subject: Optional[str] = None,
    difficulty: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List public coding problems (for the explore page)."""
    query = select(CodingProblem).options(
        selectinload(CodingProblem.test_cases)
    ).where(CodingProblem.is_public == True)
    
    if subject:
        query = query.where(CodingProblem.subject == subject)
    if difficulty:
        query = query.where(CodingProblem.difficulty == difficulty)
    
    query = query.order_by(CodingProblem.order_index, CodingProblem.created_at.desc())
    result = await db.execute(query)
    problems = result.scalars().all()
    
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "description": p.description[:200] + "..." if len(p.description) > 200 else p.description,
            "difficulty": p.difficulty,
            "subject": p.subject,
            "tags": p.tags if isinstance(p.tags, list) else [],
            "points": p.points,
            "solve_count": p.solve_count,
            "attempt_count": p.attempt_count,
            "test_case_count": len(p.test_cases) if p.test_cases else 0,
        }
        for p in problems
    ]


# ==============================================================================
# AI-Powered Problem Generation
# ==============================================================================

class Attachment(BaseModel):
    """Image or file attachment for multimodal input."""
    type: str = "image"
    content: str  # base64 encoded
    mime_type: Optional[str] = "image/jpeg"


class GenerateProblemRequest(BaseModel):
    """Request to generate a coding problem using AI."""
    topic: Optional[str] = None  # Topic/description of the problem
    concept: Optional[str] = None  # e.g., "binary search", "two pointers" (alias for topic)
    difficulty: str = "medium"
    language: str = "python"
    problem_type: str = "algorithm"
    course_context: Optional[str] = None
    is_public: bool = True
    session_id: Optional[str] = None
    num_test_cases: int = 5
    attachments: Optional[List[Attachment]] = None  # Images for multimodal input
    validate_solution: bool = True  # Run solution against test cases to verify


@router.post("/generate")
async def generate_coding_problem(
    data: GenerateProblemRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """
    Generate a new coding problem using AI and save to database.

    POST /coding/generate

    Supports multimodal input (text + images) using Gemini.
    Creates a LeetCode-style problem with:
    - Problem description with examples
    - Starter code for specified language
    - Test cases with inputs/outputs
    """
    import google.generativeai as genai
    import os
    import json
    import base64

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    # Build the prompt
    topic = data.topic or data.concept or "a coding problem"

    prompt = f"""Generate a {data.difficulty} difficulty coding problem about: {topic}

Language: {data.language}

Return a JSON object with this exact structure:
{{
    "title": "Problem Title",
    "description": "Full problem description with examples in markdown",
    "constraints": "Constraints like 1 <= n <= 10^5",
    "hints": ["hint 1", "hint 2"],
    "tags": ["array", "algorithm"],
    "starter_code": {{
        "{data.language}": "def solution(...):\\n    # Your code here\\n    pass"
    }},
    "solution_code": {{
        "{data.language}": "def solution(...):\\n    # Complete solution"
    }},
    "test_cases": [
        {{"input": "input value", "expected_output": "output value", "explanation": "why"}}
    ]
}}

Generate {data.num_test_cases} test cases. Make test inputs and outputs be simple strings that can be parsed.
Return ONLY valid JSON, no markdown code blocks."""

    # Build content parts for multimodal
    content_parts = []

    # Add files (images/PDFs) if present
    if data.attachments:
        file_types = []
        for att in data.attachments:
            if att.content:
                # Handle base64 content
                base64_data = att.content.split(",")[1] if "," in att.content else att.content
                mime = att.mime_type or ("application/pdf" if att.type == "pdf" else "image/jpeg")
                content_parts.append({
                    "mime_type": mime,
                    "data": base64_data
                })
                file_types.append("PDF" if att.type == "pdf" else "image")
        if content_parts:
            types_str = "/".join(set(file_types))
            prompt = f"Based on the uploaded {types_str}(s), {prompt}"

    content_parts.append(prompt)

    try:
        response = model.generate_content(content_parts)
        text = response.text.strip()

        # Clean up response
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        generated = json.loads(text.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate problem: {str(e)}")

    # Extract generated data
    result = {
        "title": generated.get("title", "Untitled Problem"),
        "description": generated.get("description", ""),
        "constraints": generated.get("constraints", ""),
        "hints": generated.get("hints", []),
        "tags": generated.get("tags", []),
        "starter_code": generated.get("starter_code", {}),
        "solution_code": generated.get("solution_code", {}),
        "test_cases": generated.get("test_cases", []),
        "difficulty": data.difficulty,
        "validated": False,
        "validation_results": [],
    }

    # Generate correct test case outputs by running the AI solution
    # This ensures test cases are always correct by using actual execution results
    if data.validate_solution and result["solution_code"].get(data.language) and result["test_cases"]:
        try:
            from app.services.code_runner import code_runner

            solution_code = result["solution_code"][data.language]

            # Prepare test cases - we only need inputs, we'll generate outputs
            test_cases_for_runner = [
                {
                    "input": tc.get("input", ""),
                    "expected_output": "",  # We'll get this from execution
                    "is_hidden": False,
                }
                for tc in result["test_cases"]
            ]

            # Run the AI solution to get correct outputs
            execution_result = await code_runner.run_code(
                code=solution_code,
                language=data.language,
                test_cases=test_cases_for_runner,
            )

            # Update test cases with actual outputs from the solution
            validated_test_cases = []
            validation_results = []
            all_valid = True

            for i, tc in enumerate(result["test_cases"]):
                if i < len(execution_result.test_results):
                    tr = execution_result.test_results[i]

                    if tr.actual_output and not tr.error_message:
                        # Success - use the actual output as the expected output
                        validated_tc = tc.copy()
                        validated_tc["expected_output"] = tr.actual_output.strip()
                        validated_tc["validated"] = True
                        validated_test_cases.append(validated_tc)

                        validation_results.append({
                            "test_case": i + 1,
                            "status": "success",
                            "input": tc.get("input", ""),
                            "output": tr.actual_output.strip(),
                            "time_ms": tr.execution_time_ms,
                        })
                    else:
                        # Execution failed - keep original but flag it
                        all_valid = False
                        validated_test_cases.append(tc)

                        validation_results.append({
                            "test_case": i + 1,
                            "status": "error",
                            "input": tc.get("input", ""),
                            "error": tr.error_message or "Execution failed",
                        })
                else:
                    validated_test_cases.append(tc)

            result["test_cases"] = validated_test_cases
            result["validated"] = all_valid
            result["validation_results"] = validation_results

            if all_valid:
                result["validation_message"] = f"All {len(validated_test_cases)} test cases validated by running solution"
            else:
                result["validation_message"] = "Some test cases failed validation - solution may have errors"

        except Exception as e:
            result["validation_error"] = str(e)
            result["validation_message"] = f"Validation failed: {str(e)}"

    return result


class GenerateBatchRequest(BaseModel):
    """Request to generate multiple problems."""
    topic: str
    concepts: List[str]
    difficulty_distribution: Optional[dict] = None  # {"easy": 2, "medium": 3}
    course_context: Optional[str] = None
    is_public: bool = True
    session_id: Optional[str] = None


@router.post("/generate-batch")
async def generate_coding_problems_batch(
    data: GenerateBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """
    Generate multiple coding problems using AI and save to database.
    
    POST /coding/generate-batch
    
    Generates problems for multiple concepts with varied difficulty.
    """
    try:
        from app.ai_agents.coding_problem_generator import CodingProblemGenerator
    except ImportError:
        raise HTTPException(status_code=503, detail="AI problem generator not available")
    
    generator = CodingProblemGenerator()
    
    # Generate problems
    generated_problems = generator.generate_problems_for_topic(
        topic=data.topic,
        concepts=data.concepts,
        difficulty_distribution=data.difficulty_distribution,
        course_context=data.course_context
    )
    
    # Filter out failures
    valid_problems = [p for p in generated_problems if not p.get("llm_required")]
    
    created_ids = []
    
    for generated in valid_problems:
        problem = CodingProblem(
            creator_id=current_user.id if current_user else None,
            session_id=UUID(data.session_id) if data.session_id else None,
            title=generated["title"],
            description=generated["description"],
            difficulty=generated["difficulty"],
            subject=generated.get("subject", data.topic),
            tags=generated.get("tags", []),
            hints=generated.get("hints", []),
            function_name=generated["function_name"],
            starter_code=generated["starter_code"],
            driver_code=generated["driver_code"],
            points=generated["points"],
            is_public=data.is_public,
            solve_count=0,
            attempt_count=0,
        )
        db.add(problem)
        await db.flush()
        
        # Add test cases
        for i, tc in enumerate(generated.get("formatted_test_cases", [])):
            test_case = TestCase(
                problem_id=problem.id,
                input_data=tc["input"],
                expected_output=tc["expected"],
                explanation=tc.get("explanation"),
                is_example=True,
                order_index=i,
                points=10,
            )
            db.add(test_case)
        
        created_ids.append(str(problem.id))
    
    await db.commit()
    
    return {
        "topic": data.topic,
        "problems_created": len(created_ids),
        "problem_ids": created_ids,
        "message": f"Successfully generated {len(created_ids)} problems"
    }


@router.post("")
async def create_coding_problem(
    data: CodingProblemCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """Create a new coding problem."""
    problem = CodingProblem(
        title=data.title,
        description=data.description,
        difficulty=data.difficulty,
        subject=data.subject,
        tags=data.tags,
        hints=data.hints,
        constraints=data.constraints,
        starter_code=data.starter_code,
        solution_code=data.solution_code,
        time_limit_seconds=data.time_limit_seconds,
        points=data.points,
        session_id=UUID(data.session_id) if data.session_id else None,
        creator_id=current_user.id if current_user else None,
    )
    db.add(problem)
    await db.flush()
    
    # Add test cases
    for i, tc in enumerate(data.test_cases):
        test_case = TestCase(
            problem_id=problem.id,
            input_data=tc.input_data,
            expected_output=tc.expected_output,
            explanation=tc.explanation,
            is_hidden=tc.is_hidden,
            is_example=tc.is_example,
            order_index=i,
            points=tc.points,
        )
        db.add(test_case)
    
    await db.commit()
    await db.refresh(problem)
    
    return {"id": str(problem.id), "message": "Problem created"}


@router.get("/{problem_id}")
async def get_coding_problem(
    problem_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a coding problem by ID."""
    query = select(CodingProblem).options(
        selectinload(CodingProblem.test_cases)
    ).where(CodingProblem.id == UUID(problem_id))
    
    result = await db.execute(query)
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    # Only show non-hidden test cases to students
    visible_test_cases = [
        {
            "id": str(tc.id),
            "input_data": tc.input_data,
            "expected_output": tc.expected_output,
            "explanation": tc.explanation,
            "is_example": tc.is_example,
            "order_index": tc.order_index,
            "points": tc.points,
        }
        for tc in problem.test_cases
        if not tc.is_hidden
    ]
    
    hidden_count = sum(1 for tc in problem.test_cases if tc.is_hidden)
    
    return {
        "id": str(problem.id),
        "title": problem.title,
        "description": problem.description,
        "difficulty": problem.difficulty,
        "subject": problem.subject,
        "tags": problem.tags if isinstance(problem.tags, list) else [],
        "hints": problem.hints if isinstance(problem.hints, list) else [],
        "constraints": problem.constraints,
        "starter_code": problem.starter_code if isinstance(problem.starter_code, dict) else {},
        "driver_code": problem.driver_code if isinstance(problem.driver_code, dict) else {},
        "function_name": problem.function_name if problem.function_name else "solution",
        "time_limit_seconds": problem.time_limit_seconds,
        "points": problem.points,
        "solve_count": problem.solve_count,
        "attempt_count": problem.attempt_count,
        "test_cases": visible_test_cases,
        "hidden_test_count": hidden_count,
    }


@router.delete("/{problem_id}")
async def delete_coding_problem(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a coding problem."""
    result = await db.execute(
        select(CodingProblem).where(CodingProblem.id == UUID(problem_id))
    )
    problem = result.scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    if problem.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this problem")

    # Delete related test cases and submissions first
    await db.execute(delete(TestCase).where(TestCase.problem_id == problem.id))
    await db.execute(delete(CodeSubmission).where(CodeSubmission.problem_id == problem.id))

    await db.delete(problem)
    await db.commit()

    return {"message": "Problem deleted"}


@router.post("/{problem_id}/test-cases")
async def add_test_case(
    problem_id: str,
    data: TestCaseCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a test case to a problem."""
    # Get problem
    result = await db.execute(
        select(CodingProblem).where(CodingProblem.id == UUID(problem_id))
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    # Get max order index
    max_result = await db.execute(
        select(func.max(TestCase.order_index)).where(TestCase.problem_id == problem.id)
    )
    max_index = max_result.scalar() or -1
    
    test_case = TestCase(
        problem_id=problem.id,
        input_data=data.input_data,
        expected_output=data.expected_output,
        explanation=data.explanation,
        is_hidden=data.is_hidden,
        is_example=data.is_example,
        order_index=max_index + 1,
        points=data.points,
    )
    db.add(test_case)
    await db.commit()
    
    return {"id": str(test_case.id), "message": "Test case added"}


@router.post("/{problem_id}/submit")
async def submit_code(
    problem_id: str,
    data: CodeSubmissionCreate,
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """Submit code for a problem and run against test cases."""
    from app.services.code_runner import code_runner, validate_language
    
    # Validate language
    if not validate_language(data.language):
        raise HTTPException(status_code=400, detail=f"Unsupported language: {data.language}")
    
    # Get problem with test cases
    query = select(CodingProblem).options(
        selectinload(CodingProblem.test_cases)
    ).where(CodingProblem.id == UUID(problem_id))
    
    result = await db.execute(query)
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    # Create submission record
    submission = CodeSubmission(
        problem_id=problem.id,
        student_id=current_user.id if current_user else None,
        student_name=data.student_name or "Anonymous",
        session_id=UUID(session_id) if session_id else None,
        code=data.code,
        language=data.language,
        status="pending",
        tests_total=len(problem.test_cases),
    )
    db.add(submission)
    
    # Update attempt count
    problem.attempt_count += 1
    
    await db.commit()
    await db.refresh(submission)
    
    # Prepare test cases for code runner
    test_cases_for_runner = [
        {
            "input": tc.input_data,
            "expected_output": tc.expected_output,
            "is_hidden": tc.is_hidden,
        }
        for tc in problem.test_cases
    ]
    
    # Get driver code for this language (if available)
    driver_code = None
    if problem.driver_code and isinstance(problem.driver_code, dict):
        driver_code = problem.driver_code.get(data.language)
    
    # Execute code against test cases
    try:
        execution_result = await code_runner.run_code(
            code=data.code,
            language=data.language,
            test_cases=test_cases_for_runner,
            function_name=problem.function_name or "solution",
            driver_code=driver_code
        )
    except Exception as e:
        submission.status = "error"
        submission.test_results = []
        submission.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Code execution error: {str(e)}")
    
    # Process results
    test_results = []
    tests_passed = 0
    total_score = 0
    
    for i, tc in enumerate(problem.test_cases):
        if i < len(execution_result.test_results):
            tr = execution_result.test_results[i]
            passed = tr.status.value == "passed"
            time_ms = tr.execution_time_ms
            error_msg = tr.error_message
            actual_output = tr.actual_output
            expected_output = tr.expected_output
        else:
            passed = False
            time_ms = 0
            error_msg = "Test not executed"
            actual_output = None
            expected_output = tc.expected_output
        
        test_results.append({
            "test_case_id": str(tc.id),
            "passed": passed,
            "time_ms": time_ms,
            "is_hidden": tc.is_hidden,
            "error": error_msg,
            "actual_output": actual_output if not tc.is_hidden else None,
            "expected_output": expected_output if not tc.is_hidden else None,
            "input": tc.input_data if not tc.is_hidden else None,
        })
        
        if passed:
            tests_passed += 1
            total_score += tc.points
    
    # Update submission with results
    submission.status = "accepted" if tests_passed == len(problem.test_cases) else "wrong_answer"
    submission.test_results = test_results
    submission.tests_passed = tests_passed
    submission.score = total_score
    submission.execution_time_ms = execution_result.overall_time_ms
    
    if tests_passed == len(problem.test_cases):
        problem.solve_count += 1
    
    await db.commit()
    
    return {
        "id": str(submission.id),
        "status": submission.status,
        "tests_passed": tests_passed,
        "tests_total": len(problem.test_cases),
        "score": total_score,
        "max_score": problem.points,
        "execution_time_ms": submission.execution_time_ms,
        "test_results": [
            {
                "passed": r["passed"],
                "time_ms": r["time_ms"],
                "is_hidden": r["is_hidden"],
                "actual_output": r.get("actual_output"),
                "expected_output": r.get("expected_output"),
                "input": r.get("input"),
                "error": r.get("error"),
            }
            for r in test_results
        ]
    }


@router.get("/{problem_id}/submissions")
async def get_submissions(
    problem_id: str,
    student_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get submissions for a problem."""
    query = select(CodeSubmission).where(
        CodeSubmission.problem_id == UUID(problem_id)
    )
    
    if student_name:
        query = query.where(CodeSubmission.student_name == student_name)
    
    query = query.order_by(CodeSubmission.submitted_at.desc()).limit(50)
    
    result = await db.execute(query)
    submissions = result.scalars().all()
    
    return [
        {
            "id": str(s.id),
            "student_name": s.student_name,
            "language": s.language,
            "status": s.status,
            "tests_passed": s.tests_passed,
            "tests_total": s.tests_total,
            "score": s.score,
            "execution_time_ms": s.execution_time_ms,
            "submitted_at": s.submitted_at.isoformat(),
        }
        for s in submissions
    ]


@router.get("/{problem_id}/leaderboard")
async def get_leaderboard(
    problem_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get leaderboard for a problem."""
    # Get best submission per student
    query = """
        SELECT DISTINCT ON (student_name)
            student_name,
            score,
            execution_time_ms,
            submitted_at
        FROM code_submissions
        WHERE problem_id = :problem_id AND status = 'accepted'
        ORDER BY student_name, score DESC, execution_time_ms ASC
    """
    
    # For now, simple query
    result = await db.execute(
        select(CodeSubmission)
        .where(CodeSubmission.problem_id == UUID(problem_id))
        .where(CodeSubmission.status == "accepted")
        .order_by(CodeSubmission.score.desc(), CodeSubmission.execution_time_ms.asc())
        .limit(50)
    )
    submissions = result.scalars().all()
    
    # Deduplicate by student
    seen = set()
    leaderboard = []
    for s in submissions:
        if s.student_name not in seen:
            seen.add(s.student_name)
            leaderboard.append({
                "rank": len(leaderboard) + 1,
                "student_name": s.student_name,
                "score": s.score,
                "execution_time_ms": s.execution_time_ms,
                "submitted_at": s.submitted_at.isoformat(),
            })
    
    return leaderboard

"""
Code Execution Routes - LeetCode-style code submission and testing

Supports multiple code execution backends:
- Piston (default): Free, no API key required, 70+ languages
- Judge0: Commercial, requires API key, 60+ languages
- Local: Development only, not sandboxed

Set CODE_RUNNER environment variable to "piston", "judge0", or "local"
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import os

from ..utils.llm_utils import call_gemini_with_timeout, GEMINI_AVAILABLE

# Code execution engine: "piston" (default/free), "judge0", or "local"
CODE_RUNNER = os.getenv("CODE_RUNNER", "piston").lower().strip()

# Backwards compatibility
if os.getenv("USE_JUDGE0", "").lower() == "true":
    CODE_RUNNER = "judge0"

if CODE_RUNNER == "judge0":
    from ..services.judge0_runner import (
        judge0_runner as code_runner,
        validate_language,
        get_supported_languages,
        LANGUAGE_IDS
    )
elif CODE_RUNNER == "piston":
    from ..services.piston_runner import (
        piston_runner as code_runner,
        validate_language,
        get_supported_languages
    )
    LANGUAGE_IDS = None
else:
    from ..services.code_runner import (
        code_runner,
        validate_language,
        get_supported_languages
    )
    LANGUAGE_IDS = None

router = APIRouter(prefix="/code", tags=["code"])


# ==============================================================================
# Schemas
# ==============================================================================

class TestCase(BaseModel):
    """A single test case."""
    input: str = Field(..., description="Input to the function (JSON format)")
    expected_output: str = Field(..., description="Expected output")
    is_hidden: bool = Field(default=False, description="Whether to hide this test case from student")


class CodeSubmission(BaseModel):
    """Code submission for execution."""
    code: str = Field(..., description="Student's solution code")
    language: str = Field(default="python", description="Programming language")
    test_cases: List[TestCase] = Field(..., description="Test cases to run")
    function_name: str = Field(default="solution", description="Name of the solution function")
    driver_code: Optional[str] = Field(default=None, description="Custom test driver code (for C++)")


class QuestionCodeSubmission(BaseModel):
    """Submit code for a specific question."""
    question_id: str = Field(..., description="Question ID")
    code: str = Field(..., description="Student's solution code")
    language: str = Field(default="python")


class TestCaseResultResponse(BaseModel):
    """Response for a single test case."""
    test_case_index: int
    input: str
    expected_output: str
    actual_output: str
    status: str
    execution_time_ms: float
    error_message: Optional[str] = None
    is_hidden: bool = False


class CodeExecutionResponse(BaseModel):
    """Response for code execution."""
    status: str
    passed_count: int
    total_count: int
    test_results: List[TestCaseResultResponse]
    overall_time_ms: float
    error_message: Optional[str] = None
    
    # Summary fields
    all_passed: bool = False
    score_percent: float = 0.0


# ==============================================================================
# Routes
# ==============================================================================

@router.post("/run", response_model=CodeExecutionResponse)
async def run_code(submission: CodeSubmission):
    """
    Execute code against test cases.
    
    POST /code/run
    
    This is the main endpoint for running student code.
    Returns detailed results for each test case.
    """
    # SECURITY: Validate language before any execution
    language = submission.language.lower().strip()
    if not validate_language(language):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported language: '{submission.language}'. Allowed: {', '.join(get_supported_languages())}"
        )
    
    try:
        # Convert test cases to dict format
        test_cases = [
            {
                "input": tc.input,
                "expected_output": tc.expected_output,
                "is_hidden": tc.is_hidden
            }
            for tc in submission.test_cases
        ]
        
        # Run the code
        result = await code_runner.run_code(
            code=submission.code,
            language=submission.language,
            test_cases=test_cases,
            function_name=submission.function_name,
            driver_code=submission.driver_code
        )
        
        # Convert to response
        test_results = [
            TestCaseResultResponse(
                test_case_index=tr.test_case_index,
                input=tr.input,
                expected_output=tr.expected_output,
                actual_output=tr.actual_output,
                status=tr.status.value,
                execution_time_ms=tr.execution_time_ms,
                error_message=tr.error_message,
                is_hidden=tr.is_hidden
            )
            for tr in result.test_results
        ]
        
        return CodeExecutionResponse(
            status=result.status.value,
            passed_count=result.passed_count,
            total_count=result.total_count,
            test_results=test_results,
            overall_time_ms=result.overall_time_ms,
            error_message=result.error_message,
            all_passed=result.passed_count == result.total_count,
            score_percent=(result.passed_count / result.total_count * 100) if result.total_count > 0 else 0
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code execution failed: {str(e)}")


@router.post("/validate")
async def validate_code(submission: CodeSubmission):
    """
    Quick syntax check without running tests.
    
    POST /code/validate
    
    Useful for real-time feedback while typing.
    """
    # Validate language first
    language = submission.language.lower().strip()
    if not validate_language(language):
        return {
            "valid": False, 
            "error": f"Unsupported language: '{submission.language}'. Allowed: {', '.join(get_supported_languages())}"
        }
    
    try:
        if language == "python":
            import ast
            try:
                ast.parse(submission.code)
                return {"valid": True, "error": None}
            except SyntaxError as e:
                return {
                    "valid": False,
                    "error": f"Line {e.lineno}: {e.msg}",
                    "line": e.lineno,
                    "column": e.offset
                }
        elif language == "javascript":
            # Basic JS validation (would need proper parser for production)
            return {"valid": True, "error": None}
        elif language == "cpp":
            # Basic C++ syntax checks
            code = submission.code
            # Check for common issues
            if code.count('{') != code.count('}'):
                return {"valid": False, "error": "Mismatched braces {}"}
            if code.count('(') != code.count(')'):
                return {"valid": False, "error": "Mismatched parentheses ()"}
            # Check for missing semicolons after statements (basic check)
            return {"valid": True, "error": None}
        else:
            return {"valid": True, "error": None}
            
    except Exception as e:
        return {"valid": False, "error": str(e)}


@router.get("/languages")
async def get_languages():
    """
    Get list of supported programming languages.

    GET /code/languages

    Returns the whitelist of allowed languages with their templates.
    Only languages in this list can be executed.
    """
    # Language configurations with templates
    language_configs = {
        "python": {
            "id": "python",
            "name": "Python 3",
            "extension": ".py",
            "judge0_id": 71,
            "default_template": "def solution(nums):\n    # Your code here\n    pass"
        },
        "javascript": {
            "id": "javascript",
            "name": "JavaScript (Node.js)",
            "extension": ".js",
            "judge0_id": 63,
            "default_template": "function solution(nums) {\n    // Your code here\n}"
        },
        "cpp": {
            "id": "cpp",
            "name": "C++ 17 (GCC)",
            "extension": ".cpp",
            "judge0_id": 54,
            "default_template": "class Solution {\npublic:\n    vector<int> solution(vector<int>& nums) {\n        // Your code here\n        return {};\n    }\n};"
        },
        "java": {
            "id": "java",
            "name": "Java (OpenJDK)",
            "extension": ".java",
            "judge0_id": 62,
            "default_template": "class Solution {\n    public int solution(int[] nums) {\n        // Your code here\n        return 0;\n    }\n}"
        },
        "typescript": {
            "id": "typescript",
            "name": "TypeScript",
            "extension": ".ts",
            "judge0_id": 74,
            "default_template": "function solution(nums: number[]): number {\n    // Your code here\n    return 0;\n}"
        },
        "go": {
            "id": "go",
            "name": "Go",
            "extension": ".go",
            "judge0_id": 60,
            "default_template": "func solution(nums []int) int {\n    // Your code here\n    return 0\n}"
        },
        "rust": {
            "id": "rust",
            "name": "Rust",
            "extension": ".rs",
            "judge0_id": 73,
            "default_template": "impl Solution {\n    pub fn solution(nums: Vec<i32>) -> i32 {\n        // Your code here\n        0\n    }\n}"
        },
        "ruby": {
            "id": "ruby",
            "name": "Ruby",
            "extension": ".rb",
            "judge0_id": 72,
            "default_template": "def solution(nums)\n    # Your code here\nend"
        }
    }

    # Get supported languages (differs based on Judge0 vs local)
    supported = get_supported_languages()

    # Filter to only include configured languages
    available_languages = []
    for lang_id in supported:
        if lang_id in language_configs:
            available_languages.append(language_configs[lang_id])
        elif LANGUAGE_IDS and lang_id in LANGUAGE_IDS:
            # Include Judge0 languages even if we don't have a template
            available_languages.append({
                "id": lang_id,
                "name": lang_id.title(),
                "extension": f".{lang_id[:3]}",
                "judge0_id": LANGUAGE_IDS[lang_id],
                "default_template": f"// {lang_id} code here"
            })

    return {
        "languages": available_languages,
        "allowed_languages": supported,
        "execution_engine": CODE_RUNNER,
        "total_supported": len(LANGUAGE_IDS) if LANGUAGE_IDS else len(supported)
    }


@router.get("/health")
async def health_check():
    """
    Check code execution service health.

    GET /code/health

    Returns the status of the code execution backend (Piston, Judge0, or local).
    """
    if CODE_RUNNER in ("piston", "judge0"):
        health = await code_runner.health_check()
        return {
            "status": health.get("status", "unknown"),
            "execution_engine": CODE_RUNNER,
            "api_url": code_runner.api_url,
            "details": health
        }
    else:
        return {
            "status": "healthy",
            "execution_engine": "local",
            "warning": "Local execution is less secure than sandboxed runners"
        }


@router.post("/run/batch", response_model=CodeExecutionResponse)
async def run_code_batch(submission: CodeSubmission):
    """
    Execute code against test cases using batch submission.

    POST /code/run/batch

    More efficient than /run when you have multiple test cases.
    Uses Judge0 batch API to submit all tests simultaneously.
    Falls back to sequential execution if batch is not available.
    """
    language = submission.language.lower().strip()
    if not validate_language(language):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: '{submission.language}'. Allowed: {', '.join(get_supported_languages())}"
        )

    try:
        test_cases = [
            {
                "input": tc.input,
                "expected_output": tc.expected_output,
                "is_hidden": tc.is_hidden
            }
            for tc in submission.test_cases
        ]

        # Use batch method if available (Judge0), otherwise fall back to sequential
        # Piston doesn't have batch API but run_code handles multiple test cases
        if CODE_RUNNER == "judge0" and hasattr(code_runner, 'run_code_batch'):
            result = await code_runner.run_code_batch(
                code=submission.code,
                language=submission.language,
                test_cases=test_cases,
                function_name=submission.function_name,
                driver_code=submission.driver_code
            )
        else:
            # Piston and local runners run tests sequentially in run_code
            result = await code_runner.run_code(
                code=submission.code,
                language=submission.language,
                test_cases=test_cases,
                function_name=submission.function_name,
                driver_code=submission.driver_code
            )

        test_results = [
            TestCaseResultResponse(
                test_case_index=tr.test_case_index,
                input=tr.input,
                expected_output=tr.expected_output,
                actual_output=tr.actual_output,
                status=tr.status.value,
                execution_time_ms=tr.execution_time_ms,
                error_message=tr.error_message,
                is_hidden=tr.is_hidden
            )
            for tr in result.test_results
        ]

        return CodeExecutionResponse(
            status=result.status.value,
            passed_count=result.passed_count,
            total_count=result.total_count,
            test_results=test_results,
            overall_time_ms=result.overall_time_ms,
            error_message=result.error_message,
            all_passed=result.passed_count == result.total_count,
            score_percent=(result.passed_count / result.total_count * 100) if result.total_count > 0 else 0
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch execution failed: {str(e)}")


@router.post("/generate-test-cases")
async def generate_test_cases(data: dict):
    """
    Generate test cases for a coding problem using AI.
    
    POST /code/generate-test-cases
    
    Takes a problem description and generates appropriate test cases.
    """
    import json

    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API not available")

    try:
        problem = data.get("problem", "")
        function_signature = data.get("function_signature", "def solution()")
        num_cases = data.get("num_cases", 5)

        prompt = f"""Generate test cases for this coding problem:

PROBLEM:
{problem}

FUNCTION SIGNATURE:
{function_signature}

Generate {num_cases} test cases. Include:
- 2-3 basic/example cases
- 1-2 edge cases (empty input, single element, etc.)
- 1-2 larger cases for performance

Return JSON array:
[
    {{
        "input": "[1, 2, 3]",  // JSON-formatted input arguments as array
        "expected_output": "6",  // Expected return value
        "is_hidden": false,  // true for hidden test cases
        "description": "Basic case: sum of 1+2+3"  // Brief description
    }}
]

IMPORTANT:
- Input should be valid JSON that can be parsed
- For multiple arguments, use array: "[arg1, arg2]"
- Output should be the exact expected return value
- Make test cases progressively harder"""

        response = await call_gemini_with_timeout(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            context={"agent": "code_routes", "operation": "generate_test_cases"},
        )
        if response is None:
            raise HTTPException(status_code=503, detail="Gemini did not return a response")

        test_cases = json.loads(response.text)

        return {"test_cases": test_cases}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate test cases: {str(e)}")

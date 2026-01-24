"""
Code Execution Routes - LeetCode-style code submission and testing
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import asyncio

from app.services.code_runner import (
    code_runner, 
    ExecutionStatus, 
    validate_language, 
    get_supported_languages,
    ALLOWED_LANGUAGES
)

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
            "default_template": "def solution(nums):\n    # Your code here\n    pass"
        },
        "javascript": {
            "id": "javascript",
            "name": "JavaScript",
            "extension": ".js",
            "default_template": "function solution(nums) {\n    // Your code here\n}"
        },
        "cpp": {
            "id": "cpp",
            "name": "C++ 17",
            "extension": ".cpp",
            "default_template": "#include <string>\nusing namespace std;\n\nstring solution(string input) {\n    // Your code here\n    return \"\";\n}"
        },
        "java": {
            "id": "java",
            "name": "Java",
            "extension": ".java",
            "default_template": "class Solution {\n    public int solution(int[] nums) {\n        // Your code here\n        return 0;\n    }\n}"
        }
    }
    
    # Return only languages that are in the whitelist
    return {
        "languages": [
            language_configs[lang] 
            for lang in get_supported_languages() 
            if lang in language_configs
        ],
        "allowed_languages": get_supported_languages()
    }


@router.post("/generate-test-cases")
async def generate_test_cases(data: dict):
    """
    Generate test cases for a coding problem using AI.
    
    POST /code/generate-test-cases
    
    Takes a problem description and generates appropriate test cases.
    """
    try:
        import google.generativeai as genai
        import os
        import json
        
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        
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

        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        test_cases = json.loads(response.text)
        
        return {"test_cases": test_cases}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate test cases: {str(e)}")

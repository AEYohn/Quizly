"""
Piston Code Runner Service - Free code execution without API keys

Piston is a high-performance code execution engine that supports 70+ languages.
It's completely free to use with the public API or self-hosted.

Public API: https://emkc.org/api/v2/piston
Self-hosted: docker run --privileged -p 2000:2000 ghcr.io/engineer-man/piston

Docs: https://github.com/engineer-man/piston
"""

import httpx
import json
import os
from typing import List, Dict, Optional
from dataclasses import dataclass
from enum import Enum


class ExecutionStatus(str, Enum):
    """Status of code execution."""
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"
    TIMEOUT = "timeout"
    RUNTIME_ERROR = "runtime_error"
    COMPILATION_ERROR = "compilation_error"
    PENDING = "pending"
    PROCESSING = "processing"


@dataclass
class TestCaseResult:
    """Result of running a single test case."""
    test_case_index: int
    input: str
    expected_output: str
    actual_output: str
    status: ExecutionStatus
    execution_time_ms: float
    memory_kb: float = 0
    error_message: Optional[str] = None
    is_hidden: bool = False


@dataclass
class CodeExecutionResult:
    """Result of running all test cases."""
    status: ExecutionStatus
    passed_count: int
    total_count: int
    test_results: List[TestCaseResult]
    overall_time_ms: float
    error_message: Optional[str] = None


# Piston language mappings (language -> [piston_name, version])
# Get latest versions from: https://emkc.org/api/v2/piston/runtimes
LANGUAGE_MAP = {
    "python": ["python", "3.10.0"],
    "python3": ["python", "3.10.0"],
    "javascript": ["javascript", "18.15.0"],
    "js": ["javascript", "18.15.0"],
    "typescript": ["typescript", "5.0.3"],
    "ts": ["typescript", "5.0.3"],
    "java": ["java", "15.0.2"],
    "c": ["c", "10.2.0"],
    "cpp": ["c++", "10.2.0"],
    "c++": ["c++", "10.2.0"],
    "csharp": ["csharp.net", "5.0.201"],
    "c#": ["csharp.net", "5.0.201"],
    "go": ["go", "1.16.2"],
    "golang": ["go", "1.16.2"],
    "rust": ["rust", "1.68.2"],
    "ruby": ["ruby", "3.0.1"],
    "php": ["php", "8.2.3"],
    "swift": ["swift", "5.3.3"],
    "kotlin": ["kotlin", "1.8.20"],
    "scala": ["scala", "3.2.2"],
    "r": ["rscript", "4.1.1"],
    "perl": ["perl", "5.36.0"],
    "lua": ["lua", "5.4.4"],
    "bash": ["bash", "5.2.0"],
    "sql": ["sqlite3", "3.36.0"],
    "haskell": ["haskell", "9.0.1"],
}

# Code wrappers for stdin/stdout handling
LANGUAGE_WRAPPERS = {
    "python": '''
{user_code}

# Test runner
if __name__ == "__main__":
    import sys
    import json
    import inspect

    input_data = sys.stdin.read().strip()

    # Find the solution - check for Solution class first, then functions
    func = None
    solution_class = None

    for name, obj in list(globals().items()):
        if name == "Solution" and isinstance(obj, type):
            solution_class = obj
            break

    if solution_class:
        # Find the first method that's not __init__ or dunder
        instance = solution_class()
        for method_name in dir(instance):
            if not method_name.startswith("_"):
                method = getattr(instance, method_name)
                if callable(method):
                    func = method
                    break
    else:
        # Look for standalone function
        for name, obj in list(globals().items()):
            if callable(obj) and not name.startswith("_") and name not in ["print", "json", "sys", "inspect"]:
                if hasattr(obj, "__code__"):
                    func = obj
                    break

    if func is None:
        print("Error: No function found", file=sys.stderr)
        sys.exit(1)

    try:
        # Try to parse as JSON
        try:
            parsed = json.loads(input_data)
        except:
            parsed = input_data

        # Get function parameter count (exclude 'self' for methods)
        sig = inspect.signature(func)
        param_count = len([p for p in sig.parameters.values() if p.name != 'self'])

        # Call function with parsed input
        if isinstance(parsed, dict):
            result = func(**parsed)
        elif isinstance(parsed, list):
            # If function takes 1 param and input is a list, pass list as single arg
            # If function takes multiple params, unpack the list
            if param_count == 1:
                result = func(parsed)
            else:
                result = func(*parsed)
        else:
            result = func(parsed)

        # Output result
        if isinstance(result, str):
            print(result)
        else:
            print(json.dumps(result))
    except Exception as e:
        print(f"Error: {{e}}", file=sys.stderr)
        sys.exit(1)
''',
    "javascript": '''
{user_code}

// Test runner - use synchronous stdin reading
const fs = require('fs');
let inputData = '';

try {{
    inputData = fs.readFileSync(0, 'utf8').trim();
}} catch (e) {{
    // stdin might be empty
}}

try {{
    let args;
    try {{
        args = JSON.parse(inputData);
    }} catch {{
        args = inputData;
    }}

    // Find the solution function
    const funcName = typeof solution !== 'undefined' ? 'solution' :
                    typeof solve !== 'undefined' ? 'solve' :
                    typeof main !== 'undefined' ? 'main' : null;

    if (!funcName) {{
        console.error('Error: No function found');
        process.exit(1);
    }}

    const func = eval(funcName);

    // Get function parameter count
    const paramCount = func.length;
    let result;

    if (Array.isArray(args)) {{
        // If function takes 1 param, pass array as single arg
        if (paramCount === 1 || paramCount === 0) {{
            result = func(args);
        }} else {{
            result = func(...args);
        }}
    }} else if (typeof args === 'object' && args !== null) {{
        result = func(args);
    }} else {{
        result = func(args);
    }}

    console.log(typeof result === 'string' ? result : JSON.stringify(result));
}} catch (e) {{
    console.error('Error:', e.message);
    process.exit(1);
}}
''',
}


class PistonRunner:
    """
    Execute code using Piston API - free and no API key required.

    Supports both public API and self-hosted instances.
    """

    def __init__(self):
        # Configuration from environment
        # Default to public Piston API (no key needed!)
        self.api_url = os.getenv("PISTON_API_URL", "https://emkc.org/api/v2/piston")

        # Execution limits
        self.compile_timeout = int(os.getenv("PISTON_COMPILE_TIMEOUT", "10000"))  # ms
        self.run_timeout = int(os.getenv("PISTON_RUN_TIMEOUT", "5000"))  # ms (JS needs more)
        self.memory_limit = int(os.getenv("PISTON_MEMORY_LIMIT", "128000000"))  # bytes

        # API timeout
        self.api_timeout = 30.0

        # Cache for available runtimes
        self._runtimes_cache = None

    def _get_language_info(self, language: str) -> Optional[tuple]:
        """Get Piston language name and version."""
        lang = language.lower().strip()
        return LANGUAGE_MAP.get(lang)

    def _wrap_code(self, code: str, language: str, driver_code: Optional[str] = None) -> str:
        """Wrap user code with test runner if needed."""
        lang = language.lower().strip()

        # If custom driver code provided, use it
        if driver_code:
            return code + "\n\n" + driver_code

        # Check if code already has entry point
        if lang in ("python", "python3"):
            if 'if __name__' in code:
                return code
        elif lang in ("javascript", "js"):
            if 'readline' in code or 'process.stdin' in code:
                return code

        # Apply wrapper template
        wrapper = LANGUAGE_WRAPPERS.get(lang)
        if wrapper:
            return wrapper.format(user_code=code)

        return code

    def _compare_outputs(self, actual: str, expected: str) -> bool:
        """Compare outputs with normalization."""
        actual = actual.strip()
        expected = expected.strip()

        # Direct match
        if actual == expected:
            return True

        # JSON comparison
        try:
            actual_json = json.loads(actual)
            expected_json = json.loads(expected)
            return actual_json == expected_json
        except:  # noqa: E722
            pass

        # Numeric comparison
        try:
            actual_num = float(actual)
            expected_num = float(expected)
            return abs(actual_num - expected_num) < 1e-6
        except:  # noqa: E722
            pass

        # Case-insensitive
        return actual.lower() == expected.lower()

    async def _execute(
        self,
        code: str,
        language: str,
        version: str,
        stdin: str = ""
    ) -> Dict:
        """Execute code using Piston API."""
        payload = {
            "language": language,
            "version": version,
            "files": [
                {
                    "name": f"main.{self._get_extension(language)}",
                    "content": code
                }
            ],
            "stdin": stdin,
            "compile_timeout": self.compile_timeout,
            "run_timeout": self.run_timeout,
            # Note: Memory limits cause SIGKILL on public API, only use for self-hosted
            # "compile_memory_limit": self.memory_limit,
            # "run_memory_limit": self.memory_limit
        }

        async with httpx.AsyncClient(timeout=self.api_timeout) as client:
            response = await client.post(
                f"{self.api_url}/execute",
                json=payload
            )

            if response.status_code != 200:
                return {
                    "error": f"Piston API error: {response.status_code} - {response.text}",
                    "run": {"code": 1}
                }

            return response.json()

    def _get_extension(self, language: str) -> str:
        """Get file extension for language."""
        extensions = {
            "python": "py",
            "javascript": "js",
            "typescript": "ts",
            "java": "java",
            "c": "c",
            "c++": "cpp",
            "csharp.net": "cs",
            "go": "go",
            "rust": "rs",
            "ruby": "rb",
            "php": "php",
            "swift": "swift",
            "kotlin": "kt",
            "scala": "scala",
            "rscript": "r",
            "perl": "pl",
            "lua": "lua",
            "bash": "sh",
            "sqlite3": "sql",
            "haskell": "hs",
        }
        return extensions.get(language, "txt")

    async def run_code(
        self,
        code: str,
        language: str,
        test_cases: List[Dict],
        function_name: str = "solution",
        driver_code: str = None
    ) -> CodeExecutionResult:
        """
        Run code against all test cases using Piston.

        Args:
            code: User's solution code
            language: Programming language
            test_cases: List of {input, expected_output, is_hidden}
            function_name: Name of the function to call
            driver_code: Optional custom test driver

        Returns:
            CodeExecutionResult with all test results
        """
        # Get language info
        lang_info = self._get_language_info(language)
        if lang_info is None:
            supported = list(LANGUAGE_MAP.keys())
            return CodeExecutionResult(
                status=ExecutionStatus.ERROR,
                passed_count=0,
                total_count=len(test_cases),
                test_results=[],
                overall_time_ms=0,
                error_message=f"Unsupported language: '{language}'. Supported: {', '.join(sorted(set(supported)))}"
            )

        piston_lang, version = lang_info

        # Wrap code with test runner
        wrapped_code = self._wrap_code(code, language, driver_code)

        test_results = []
        passed_count = 0
        total_time = 0

        # Run each test case
        for i, test_case in enumerate(test_cases):
            input_data = test_case.get("input", "")
            expected_output = str(test_case.get("expected_output", "")).strip()
            is_hidden = test_case.get("is_hidden", False)

            # Prepare stdin
            if isinstance(input_data, str):
                try:
                    json.loads(input_data)
                    stdin_data = input_data
                except:  # noqa: E722
                    stdin_data = json.dumps(input_data)
            else:
                stdin_data = json.dumps(input_data)

            try:
                # Execute with Piston
                import time
                start_time = time.time()
                result = await self._execute(
                    code=wrapped_code,
                    language=piston_lang,
                    version=version,
                    stdin=stdin_data
                )
                execution_time = (time.time() - start_time) * 1000
                total_time += execution_time

                # Parse result
                run_result = result.get("run", {})
                compile_result = result.get("compile", {})

                stdout = run_result.get("stdout", "").strip()
                stderr = run_result.get("stderr", "")
                compile_error = compile_result.get("stderr", "") if compile_result else ""
                exit_code = run_result.get("code", 0)

                # Determine status
                if compile_error:
                    status = ExecutionStatus.COMPILATION_ERROR
                    error_message = compile_error
                    actual_output = ""
                elif result.get("error"):
                    status = ExecutionStatus.ERROR
                    error_message = result.get("error")
                    actual_output = ""
                elif "timed out" in stderr.lower() or run_result.get("signal") == "SIGKILL":
                    status = ExecutionStatus.TIMEOUT
                    error_message = "Time limit exceeded"
                    actual_output = stdout
                elif exit_code != 0 or stderr:
                    status = ExecutionStatus.RUNTIME_ERROR
                    error_message = stderr or f"Exit code: {exit_code}"
                    actual_output = stdout
                elif self._compare_outputs(stdout, expected_output):
                    status = ExecutionStatus.PASSED
                    error_message = None
                    actual_output = stdout
                    passed_count += 1
                else:
                    status = ExecutionStatus.FAILED
                    error_message = None
                    actual_output = stdout

                test_results.append(TestCaseResult(
                    test_case_index=i,
                    input=input_data if not is_hidden else "[hidden]",
                    expected_output=expected_output if not is_hidden else "[hidden]",
                    actual_output=actual_output if not is_hidden else ("[hidden]" if status == ExecutionStatus.PASSED else "Wrong Answer"),
                    status=status,
                    execution_time_ms=execution_time,
                    error_message=error_message,
                    is_hidden=is_hidden
                ))

            except httpx.TimeoutException:
                test_results.append(TestCaseResult(
                    test_case_index=i,
                    input=input_data if not is_hidden else "[hidden]",
                    expected_output=expected_output if not is_hidden else "[hidden]",
                    actual_output="",
                    status=ExecutionStatus.TIMEOUT,
                    execution_time_ms=self.api_timeout * 1000,
                    error_message="API request timed out",
                    is_hidden=is_hidden
                ))
            except Exception as e:
                test_results.append(TestCaseResult(
                    test_case_index=i,
                    input=input_data if not is_hidden else "[hidden]",
                    expected_output=expected_output if not is_hidden else "[hidden]",
                    actual_output="",
                    status=ExecutionStatus.ERROR,
                    execution_time_ms=0,
                    error_message=str(e),
                    is_hidden=is_hidden
                ))

        # Determine overall status
        if passed_count == len(test_cases):
            overall_status = ExecutionStatus.PASSED
        elif any(r.status == ExecutionStatus.TIMEOUT for r in test_results):
            overall_status = ExecutionStatus.TIMEOUT
        elif any(r.status == ExecutionStatus.COMPILATION_ERROR for r in test_results):
            overall_status = ExecutionStatus.COMPILATION_ERROR
        elif any(r.status == ExecutionStatus.RUNTIME_ERROR for r in test_results):
            overall_status = ExecutionStatus.RUNTIME_ERROR
        else:
            overall_status = ExecutionStatus.FAILED

        return CodeExecutionResult(
            status=overall_status,
            passed_count=passed_count,
            total_count=len(test_cases),
            test_results=test_results,
            overall_time_ms=total_time
        )

    async def get_runtimes(self) -> List[Dict]:
        """Get list of available runtimes from Piston."""
        if self._runtimes_cache:
            return self._runtimes_cache

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/runtimes")
                if response.status_code == 200:
                    self._runtimes_cache = response.json()
                    return self._runtimes_cache
        except:  # noqa: E722
            pass

        # Return our supported languages if API call fails
        return [{"language": k, "version": v[1]} for k, v in LANGUAGE_MAP.items()]

    async def health_check(self) -> Dict:
        """Check if Piston API is accessible."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.api_url}/runtimes")
                if response.status_code == 200:
                    runtimes = response.json()
                    return {
                        "status": "healthy",
                        "piston": {
                            "url": self.api_url,
                            "languages_available": len(runtimes)
                        }
                    }
                return {"status": "unhealthy", "error": f"Status {response.status_code}"}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}


# Singleton instance
piston_runner = PistonRunner()


# Export for compatibility with code_runner interface
def get_supported_languages() -> List[str]:
    """Return list of supported languages."""
    return sorted(list(set(LANGUAGE_MAP.keys())))


def validate_language(language: str) -> bool:
    """Validate that the language is supported."""
    return language.lower().strip() in LANGUAGE_MAP


ALLOWED_LANGUAGES = frozenset(LANGUAGE_MAP.keys())

"""
Judge0 Code Runner Service - Secure sandboxed code execution
Uses Judge0 API for LeetCode-style code execution with proper isolation.

Judge0 provides:
- Docker container isolation
- Memory/CPU limits
- Timeout enforcement
- 60+ language support
- No local code execution security risks

Setup options:
1. Judge0 Cloud (RapidAPI): Free tier = 50 submissions/day
2. Self-hosted: Deploy via Railway or Docker
3. Judge0 CE: Free open-source version

Docs: https://github.com/judge0/judge0
"""

import httpx
import asyncio
import json
import os
import base64
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


# Judge0 language IDs
# Full list: https://ce.judge0.com/languages
LANGUAGE_IDS = {
    "python": 71,      # Python 3.8.1
    "python3": 71,
    "javascript": 63,  # Node.js 12.14.0
    "js": 63,
    "cpp": 54,         # C++ (GCC 9.2.0)
    "c++": 54,
    "c": 50,           # C (GCC 9.2.0)
    "java": 62,        # Java (OpenJDK 13.0.1)
    "typescript": 74,  # TypeScript 3.7.4
    "ts": 74,
    "go": 60,          # Go 1.13.5
    "rust": 73,        # Rust 1.40.0
    "ruby": 72,        # Ruby 2.7.0
    "php": 68,         # PHP 7.4.1
    "swift": 83,       # Swift 5.2.3
    "kotlin": 78,      # Kotlin 1.3.70
    "scala": 81,       # Scala 2.13.2
    "r": 80,           # R 4.0.0
    "perl": 85,        # Perl 5.28.1
    "haskell": 61,     # Haskell (GHC 8.8.1)
    "bash": 46,        # Bash 5.0.0
    "sql": 82,         # SQL (SQLite 3.27.2)
}

# Language-specific code wrappers for stdin/stdout handling
LANGUAGE_WRAPPERS = {
    "python": '''
{user_code}

# Test runner
if __name__ == "__main__":
    import sys
    import json
    import inspect

    input_data = sys.stdin.read().strip()

    # Find the solution function
    func = None
    for name, obj in list(globals().items()):
        if callable(obj) and not name.startswith("_") and name not in ["print", "json", "sys", "inspect"]:
            if hasattr(obj, "__code__"):
                func = obj
                break

    if func is None:
        print("Error: No function found", file=sys.stderr)
        sys.exit(1)

    try:
        parsed = json.loads(input_data)

        if isinstance(parsed, dict):
            result = func(**parsed)
        elif isinstance(parsed, (list, tuple)):
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            if len(params) == 1:
                result = func(parsed)
            else:
                result = func(*parsed)
        else:
            result = func(parsed)

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

// Test runner
const readline = require('readline');
const rl = readline.createInterface({{
    input: process.stdin,
    output: process.stdout,
    terminal: false
}});

let inputData = '';
rl.on('line', (line) => {{ inputData += line; }});
rl.on('close', () => {{
    try {{
        let args = JSON.parse(inputData.trim());
        if (!Array.isArray(args)) args = [args];
        const result = solution(...args);
        console.log(typeof result === 'string' ? result : JSON.stringify(result));
    }} catch (e) {{
        console.error('Error:', e.message);
        process.exit(1);
    }}
}});
''',
    "cpp": '''
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <unordered_map>
#include <set>
#include <unordered_set>
#include <queue>
#include <stack>
#include <sstream>
#include <cmath>
#include <climits>
using namespace std;

// JSON parsing utilities
string trim(const string& s) {{
    size_t start = s.find_first_not_of(" \\t\\n\\r");
    if (start == string::npos) return "";
    size_t end = s.find_last_not_of(" \\t\\n\\r");
    return s.substr(start, end - start + 1);
}}

int parseInt(const string& s) {{ return stoi(trim(s)); }}

vector<int> parseIntArray(const string& s) {{
    vector<int> result;
    string t = trim(s);
    if (t.size() < 2 || t[0] != '[' || t.back() != ']') return result;
    t = t.substr(1, t.size() - 2);
    if (t.empty()) return result;
    stringstream ss(t);
    string item;
    while (getline(ss, item, ',')) {{ result.push_back(parseInt(item)); }}
    return result;
}}

string getJsonValue(const string& json, const string& key) {{
    string searchKey = "\\"" + key + "\\"";
    size_t pos = json.find(searchKey);
    if (pos == string::npos) return "";
    pos = json.find(':', pos);
    if (pos == string::npos) return "";
    pos++;
    while (pos < json.size() && isspace(json[pos])) pos++;
    if (pos >= json.size()) return "";
    if (json[pos] == '[') {{
        int depth = 1;
        size_t end = pos + 1;
        while (end < json.size() && depth > 0) {{
            if (json[end] == '[') depth++;
            else if (json[end] == ']') depth--;
            end++;
        }}
        return json.substr(pos, end - pos);
    }} else {{
        size_t end = json.find_first_of(",}}", pos);
        return trim(json.substr(pos, end - pos));
    }}
}}

template<typename T> string toJson(const T& val);
template<> string toJson(const int& val) {{ return to_string(val); }}
template<> string toJson(const vector<int>& val) {{
    string s = "[";
    for (size_t i = 0; i < val.size(); i++) {{ if (i > 0) s += ","; s += to_string(val[i]); }}
    return s + "]";
}}

{user_code}

int main() {{
    string line;
    getline(cin, line);

    Solution sol;

    string numsStr = getJsonValue(line, "nums");
    string targetStr = getJsonValue(line, "target");

    if (!numsStr.empty()) {{
        vector<int> nums = parseIntArray(numsStr);
        if (!targetStr.empty()) {{
            int target = parseInt(targetStr);
            auto result = sol.twoSum(nums, target);
            cout << toJson(result) << endl;
        }}
    }}

    return 0;
}}
''',
    "java": '''
import java.util.*;
import java.io.*;

{user_code}

class Main {{
    public static void main(String[] args) throws Exception {{
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String input = br.readLine();
        Solution sol = new Solution();
        System.out.println(input);
    }}
}}
'''
}


class Judge0Runner:
    """
    Execute code using Judge0 API for secure sandboxed execution.

    Supports multiple Judge0 backends:
    - RapidAPI hosted (default, free tier)
    - Self-hosted instance
    - Railway deployed instance
    """

    def __init__(self):
        # Configuration from environment
        self.api_url = os.getenv("JUDGE0_API_URL", "https://judge0-ce.p.rapidapi.com")
        self.api_key = os.getenv("JUDGE0_API_KEY", "")
        self.api_host = os.getenv("JUDGE0_API_HOST", "judge0-ce.p.rapidapi.com")
        self.use_rapidapi = "rapidapi" in self.api_url.lower()

        # Execution limits
        self.cpu_time_limit = float(os.getenv("JUDGE0_CPU_TIME_LIMIT", "2"))  # seconds
        self.memory_limit = int(os.getenv("JUDGE0_MEMORY_LIMIT", "128000"))   # KB
        self.max_output_size = int(os.getenv("JUDGE0_MAX_OUTPUT", "10000"))   # characters

        # Timeout for API calls
        self.api_timeout = 30.0  # seconds

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Judge0 API requests."""
        if self.use_rapidapi:
            return {
                "Content-Type": "application/json",
                "X-RapidAPI-Key": self.api_key,
                "X-RapidAPI-Host": self.api_host
            }
        else:
            # Self-hosted Judge0
            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["X-Auth-Token"] = self.api_key
            return headers

    def _get_language_id(self, language: str) -> Optional[int]:
        """Get Judge0 language ID from language name."""
        lang = language.lower().strip()
        return LANGUAGE_IDS.get(lang)

    def _wrap_code(self, code: str, language: str, driver_code: Optional[str] = None) -> str:
        """Wrap user code with test runner if needed."""
        lang = language.lower().strip()

        # If custom driver code is provided, use it
        if driver_code:
            return code + "\n\n" + driver_code

        # Check if code already has a main function/entry point
        if lang == "python":
            if 'if __name__' in code:
                return code
        elif lang in ("javascript", "js"):
            # JS code runs as-is if it handles stdin
            if 'readline' in code or 'process.stdin' in code:
                return code
        elif lang in ("cpp", "c++"):
            if 'int main' in code or 'void main' in code:
                return code
        elif lang == "java":
            if 'public static void main' in code:
                return code

        # Apply wrapper template
        wrapper = LANGUAGE_WRAPPERS.get(lang)
        if wrapper:
            return wrapper.format(user_code=code)

        return code

    def _encode_base64(self, text: str) -> str:
        """Encode text to base64 for Judge0."""
        return base64.b64encode(text.encode()).decode()

    def _decode_base64(self, text: Optional[str]) -> str:
        """Decode base64 from Judge0."""
        if not text:
            return ""
        try:
            return base64.b64decode(text).decode()
        except:
            return text

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
        except:
            pass

        # Numeric comparison
        try:
            actual_num = float(actual)
            expected_num = float(expected)
            return abs(actual_num - expected_num) < 1e-6
        except:
            pass

        # Case-insensitive
        return actual.lower() == expected.lower()

    def _status_id_to_enum(self, status_id: int) -> ExecutionStatus:
        """Convert Judge0 status ID to our ExecutionStatus enum."""
        # Judge0 status IDs:
        # 1: In Queue, 2: Processing, 3: Accepted
        # 4: Wrong Answer, 5: Time Limit Exceeded, 6: Compilation Error
        # 7-12: Various runtime errors, 13: Internal Error, 14: Exec Format Error
        status_map = {
            1: ExecutionStatus.PENDING,
            2: ExecutionStatus.PROCESSING,
            3: ExecutionStatus.PASSED,  # Accepted (ran successfully)
            4: ExecutionStatus.FAILED,  # Wrong Answer
            5: ExecutionStatus.TIMEOUT,
            6: ExecutionStatus.COMPILATION_ERROR,
            7: ExecutionStatus.RUNTIME_ERROR,  # Runtime Error (SIGSEGV)
            8: ExecutionStatus.RUNTIME_ERROR,  # Runtime Error (SIGXFSZ)
            9: ExecutionStatus.RUNTIME_ERROR,  # Runtime Error (SIGFPE)
            10: ExecutionStatus.RUNTIME_ERROR, # Runtime Error (SIGABRT)
            11: ExecutionStatus.RUNTIME_ERROR, # Runtime Error (NZEC)
            12: ExecutionStatus.RUNTIME_ERROR, # Runtime Error (Other)
            13: ExecutionStatus.ERROR,         # Internal Error
            14: ExecutionStatus.ERROR,         # Exec Format Error
        }
        return status_map.get(status_id, ExecutionStatus.ERROR)

    async def _submit_code(
        self,
        source_code: str,
        language_id: int,
        stdin: str = "",
        expected_output: str = None
    ) -> Dict:
        """Submit code to Judge0 and wait for result."""

        # Prepare submission
        payload = {
            "source_code": self._encode_base64(source_code),
            "language_id": language_id,
            "stdin": self._encode_base64(stdin) if stdin else "",
            "cpu_time_limit": self.cpu_time_limit,
            "memory_limit": self.memory_limit,
            "base64_encoded": True
        }

        if expected_output:
            payload["expected_output"] = self._encode_base64(expected_output)

        async with httpx.AsyncClient(timeout=self.api_timeout) as client:
            # Submit and wait for result
            response = await client.post(
                f"{self.api_url}/submissions?base64_encoded=true&wait=true",
                headers=self._get_headers(),
                json=payload
            )

            if response.status_code != 200 and response.status_code != 201:
                return {
                    "error": f"Judge0 API error: {response.status_code} - {response.text}",
                    "status_id": 13
                }

            result = response.json()

            # If still processing, poll for result
            if result.get("status", {}).get("id") in (1, 2):
                token = result.get("token")
                if token:
                    for _ in range(30):  # Max 30 attempts
                        await asyncio.sleep(1)
                        poll_response = await client.get(
                            f"{self.api_url}/submissions/{token}?base64_encoded=true",
                            headers=self._get_headers()
                        )
                        if poll_response.status_code == 200:
                            result = poll_response.json()
                            if result.get("status", {}).get("id") not in (1, 2):
                                break

            return result

    async def _submit_batch(
        self,
        submissions: List[Dict]
    ) -> List[Dict]:
        """
        Submit multiple code executions as a batch for better performance.

        Judge0 batch endpoint allows up to 20 submissions at once.
        This reduces API calls and improves latency for multiple test cases.
        """
        if not submissions:
            return []

        # Judge0 batch limit
        MAX_BATCH_SIZE = 20

        all_results = []

        # Process in batches
        for i in range(0, len(submissions), MAX_BATCH_SIZE):
            batch = submissions[i:i + MAX_BATCH_SIZE]

            payload = {"submissions": batch}

            async with httpx.AsyncClient(timeout=self.api_timeout * 2) as client:
                # Submit batch
                response = await client.post(
                    f"{self.api_url}/submissions/batch?base64_encoded=true",
                    headers=self._get_headers(),
                    json=payload
                )

                if response.status_code not in (200, 201):
                    # Return errors for all submissions in this batch
                    for _ in batch:
                        all_results.append({
                            "error": f"Batch submission failed: {response.status_code}",
                            "status": {"id": 13}
                        })
                    continue

                tokens_response = response.json()
                tokens = [t.get("token") for t in tokens_response if t.get("token")]

                if not tokens:
                    for _ in batch:
                        all_results.append({
                            "error": "No tokens received",
                            "status": {"id": 13}
                        })
                    continue

                # Poll for results
                for attempt in range(30):
                    await asyncio.sleep(1)

                    # Get all results at once
                    tokens_str = ",".join(tokens)
                    poll_response = await client.get(
                        f"{self.api_url}/submissions/batch?tokens={tokens_str}&base64_encoded=true",
                        headers=self._get_headers()
                    )

                    if poll_response.status_code != 200:
                        continue

                    results = poll_response.json().get("submissions", [])

                    # Check if all are done
                    all_done = all(
                        r.get("status", {}).get("id", 0) not in (1, 2)
                        for r in results
                    )

                    if all_done:
                        all_results.extend(results)
                        break
                else:
                    # Timeout - return partial results
                    all_results.extend(results if 'results' in dir() else [
                        {"error": "Timeout", "status": {"id": 5}} for _ in batch
                    ])

        return all_results

    async def run_code_batch(
        self,
        code: str,
        language: str,
        test_cases: List[Dict],
        function_name: str = "solution",
        driver_code: str = None
    ) -> CodeExecutionResult:
        """
        Run code against all test cases using batch submission.

        More efficient than individual submissions for multiple test cases.
        Uses Judge0 batch API to submit all tests at once.
        """
        # Validate language
        language_id = self._get_language_id(language)
        if language_id is None:
            supported = list(LANGUAGE_IDS.keys())
            return CodeExecutionResult(
                status=ExecutionStatus.ERROR,
                passed_count=0,
                total_count=len(test_cases),
                test_results=[],
                overall_time_ms=0,
                error_message=f"Unsupported language: '{language}'. Supported: {', '.join(sorted(set(supported)))}"
            )

        # Check API key
        if self.use_rapidapi and not self.api_key:
            return CodeExecutionResult(
                status=ExecutionStatus.ERROR,
                passed_count=0,
                total_count=len(test_cases),
                test_results=[],
                overall_time_ms=0,
                error_message="Judge0 API key not configured."
            )

        # Wrap code
        wrapped_code = self._wrap_code(code, language, driver_code)
        encoded_code = self._encode_base64(wrapped_code)

        # Prepare batch submissions
        submissions = []
        for test_case in test_cases:
            input_data = test_case.get("input", "")
            if isinstance(input_data, str):
                try:
                    json.loads(input_data)
                    stdin_data = input_data
                except:
                    stdin_data = json.dumps(input_data)
            else:
                stdin_data = json.dumps(input_data)

            submissions.append({
                "source_code": encoded_code,
                "language_id": language_id,
                "stdin": self._encode_base64(stdin_data),
                "cpu_time_limit": self.cpu_time_limit,
                "memory_limit": self.memory_limit
            })

        # Submit batch
        try:
            results = await self._submit_batch(submissions)
        except Exception as e:
            return CodeExecutionResult(
                status=ExecutionStatus.ERROR,
                passed_count=0,
                total_count=len(test_cases),
                test_results=[],
                overall_time_ms=0,
                error_message=f"Batch submission failed: {str(e)}"
            )

        # Process results
        test_results = []
        passed_count = 0
        total_time = 0

        for i, (test_case, result) in enumerate(zip(test_cases, results)):
            expected_output = str(test_case.get("expected_output", "")).strip()
            is_hidden = test_case.get("is_hidden", False)
            input_data = test_case.get("input", "")

            status_id = result.get("status", {}).get("id", 13)
            status = self._status_id_to_enum(status_id)

            stdout = self._decode_base64(result.get("stdout", ""))
            stderr = self._decode_base64(result.get("stderr", ""))
            compile_output = self._decode_base64(result.get("compile_output", ""))

            time_ms = float(result.get("time", 0) or 0) * 1000
            memory_kb = float(result.get("memory", 0) or 0)
            total_time += time_ms

            actual_output = stdout.strip()
            error_message = stderr or compile_output or result.get("error", "")

            if status == ExecutionStatus.PASSED:
                if self._compare_outputs(actual_output, expected_output):
                    passed_count += 1
                else:
                    status = ExecutionStatus.FAILED

            test_results.append(TestCaseResult(
                test_case_index=i,
                input=input_data if not is_hidden else "[hidden]",
                expected_output=expected_output if not is_hidden else "[hidden]",
                actual_output=actual_output if not is_hidden else ("[hidden]" if status == ExecutionStatus.PASSED else "Wrong Answer"),
                status=status,
                execution_time_ms=time_ms,
                memory_kb=memory_kb,
                error_message=error_message if error_message else None,
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

    async def run_code(
        self,
        code: str,
        language: str,
        test_cases: List[Dict],
        function_name: str = "solution",
        driver_code: str = None
    ) -> CodeExecutionResult:
        """
        Run code against all test cases using Judge0.

        Args:
            code: User's solution code
            language: Programming language
            test_cases: List of {input, expected_output, is_hidden}
            function_name: Name of the function to call
            driver_code: Optional custom test driver

        Returns:
            CodeExecutionResult with all test results
        """
        # Validate language
        language_id = self._get_language_id(language)
        if language_id is None:
            supported = list(LANGUAGE_IDS.keys())
            return CodeExecutionResult(
                status=ExecutionStatus.ERROR,
                passed_count=0,
                total_count=len(test_cases),
                test_results=[],
                overall_time_ms=0,
                error_message=f"Unsupported language: '{language}'. Supported: {', '.join(sorted(set(supported)))}"
            )

        # Check if Judge0 API is configured
        if self.use_rapidapi and not self.api_key:
            return CodeExecutionResult(
                status=ExecutionStatus.ERROR,
                passed_count=0,
                total_count=len(test_cases),
                test_results=[],
                overall_time_ms=0,
                error_message="Judge0 API key not configured. Set JUDGE0_API_KEY environment variable."
            )

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
                except:
                    stdin_data = json.dumps(input_data)
            else:
                stdin_data = json.dumps(input_data)

            try:
                # Submit to Judge0
                result = await self._submit_code(
                    source_code=wrapped_code,
                    language_id=language_id,
                    stdin=stdin_data
                )

                # Parse result
                status_id = result.get("status", {}).get("id", 13)
                status = self._status_id_to_enum(status_id)

                stdout = self._decode_base64(result.get("stdout", ""))
                stderr = self._decode_base64(result.get("stderr", ""))
                compile_output = self._decode_base64(result.get("compile_output", ""))

                time_ms = float(result.get("time", 0) or 0) * 1000
                memory_kb = float(result.get("memory", 0) or 0)

                total_time += time_ms

                # Determine actual output and error
                actual_output = stdout.strip()
                error_message = stderr or compile_output or result.get("message", "")

                # Check if output matches expected (only if execution was successful)
                if status == ExecutionStatus.PASSED:
                    # Status 3 (Accepted) just means it ran - we need to check output
                    if self._compare_outputs(actual_output, expected_output):
                        status = ExecutionStatus.PASSED
                        passed_count += 1
                    else:
                        status = ExecutionStatus.FAILED

                test_results.append(TestCaseResult(
                    test_case_index=i,
                    input=input_data if not is_hidden else "[hidden]",
                    expected_output=expected_output if not is_hidden else "[hidden]",
                    actual_output=actual_output if not is_hidden else ("[hidden]" if status == ExecutionStatus.PASSED else "Wrong Answer"),
                    status=status,
                    execution_time_ms=time_ms,
                    memory_kb=memory_kb,
                    error_message=error_message if error_message else None,
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

    async def get_languages(self) -> List[Dict]:
        """Get list of supported languages from Judge0."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.api_url}/languages",
                    headers=self._get_headers()
                )
                if response.status_code == 200:
                    return response.json()
        except:
            pass

        # Return our supported languages if API call fails
        return [{"id": v, "name": k} for k, v in LANGUAGE_IDS.items()]

    async def health_check(self) -> Dict:
        """Check if Judge0 API is accessible."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.api_url}/about",
                    headers=self._get_headers()
                )
                if response.status_code == 200:
                    return {"status": "healthy", "judge0": response.json()}
                return {"status": "unhealthy", "error": f"Status {response.status_code}"}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}


# Singleton instance
judge0_runner = Judge0Runner()


# Export for backward compatibility with code_runner interface
def get_supported_languages() -> List[str]:
    """Return list of supported languages."""
    return sorted(list(set(LANGUAGE_IDS.keys())))


def validate_language(language: str) -> bool:
    """Validate that the language is supported."""
    return language.lower().strip() in LANGUAGE_IDS


ALLOWED_LANGUAGES = frozenset(LANGUAGE_IDS.keys())

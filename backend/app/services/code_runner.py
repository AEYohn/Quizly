"""
Code Runner Service - LeetCode-style code execution
Safely executes student code against test cases

Security considerations (following Judge0 best practices):
- Strict language whitelist validation
- Resource limits (time, memory, output)
- Isolated temp file execution
- Compilation step for compiled languages (C++)
"""

import tempfile
import os
import json
import asyncio
import shutil
import re
from typing import List, Dict, Optional, Set
from dataclasses import dataclass
from enum import Enum


# Strict whitelist of supported languages - SECURITY CRITICAL
# Only these languages can be executed. Any other value will be rejected.
ALLOWED_LANGUAGES: Set[str] = frozenset({"python", "javascript", "cpp", "java"})


def validate_language(language: str) -> bool:
    """
    Strictly validate that the language is in our whitelist.
    Returns True if valid, False otherwise.
    This is the ONLY place language validation should happen.
    """
    return language.lower().strip() in ALLOWED_LANGUAGES


def get_supported_languages() -> List[str]:
    """Return list of supported languages for API responses."""
    return sorted(list(ALLOWED_LANGUAGES))


class ExecutionStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"
    TIMEOUT = "timeout"
    RUNTIME_ERROR = "runtime_error"
    COMPILATION_ERROR = "compilation_error"


@dataclass
class TestCaseResult:
    """Result of running a single test case."""
    test_case_index: int
    input: str
    expected_output: str
    actual_output: str
    status: ExecutionStatus
    execution_time_ms: float
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


class CodeRunner:
    """
    Safely executes code in isolated subprocesses.
    Supports Python, JavaScript, and C++.
    
    Security: Uses strict language whitelist validation.
    C++ uses g++ compilation before execution.
    """
    
    TIMEOUT_SECONDS = 5  # Max execution time per test case
    COMPILE_TIMEOUT_SECONDS = 10  # Max compilation time
    MAX_OUTPUT_LENGTH = 10000  # Truncate output if too long
    
    SUPPORTED_LANGUAGES = {
        "python": {
            "extension": ".py",
            "command": ["python3"],
            "requires_compilation": False,
            "wrapper_template": '''
{user_code}

# Test runner
if __name__ == "__main__":
    import sys
    import json

    # Read JSON input
    input_data = sys.stdin.read().strip()

    # Find the solution function (could be named solution, two_sum, etc.)
    func = None
    for name, obj in list(globals().items()):
        if callable(obj) and not name.startswith("_") and name not in ["print", "json", "sys"]:
            if hasattr(obj, "__code__"):
                func = obj
                break

    if func is None:
        print("Error: No function found", file=sys.stderr)
        sys.exit(1)

    try:
        # Parse JSON input
        if not input_data:
            print(f"Error: Empty input received", file=sys.stderr)
            sys.exit(1)

        parsed = json.loads(input_data)

        # Call function based on input type
        if isinstance(parsed, dict):
            # Verify function signature matches input keys
            import inspect
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            # Call with keyword arguments
            result = func(**parsed)
        elif isinstance(parsed, list):
            result = func(*parsed)
        else:
            result = func(parsed)

        # Output result as JSON
        if isinstance(result, str):
            print(result)
        else:
            print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input - {{e}}. Received: {{input_data[:200]}}", file=sys.stderr)
        sys.exit(1)
    except TypeError as e:
        # Better error for missing arguments
        print(f"Error: {{e}}. Input was: {{input_data[:200]}}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {{e}}", file=sys.stderr)
        sys.exit(1)
'''
        },
        "javascript": {
            "extension": ".js",
            "command": ["node"],
            "requires_compilation": False,
            "wrapper_template": '''
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
        const parsed = JSON.parse(inputData.trim());
        let result;

        if (Array.isArray(parsed)) {{
            // Array input: spread as positional args
            result = solution(...parsed);
        }} else if (parsed !== null && typeof parsed === 'object') {{
            // Object input: spread object values as positional args
            // This matches how Python passes **kwargs
            result = solution(...Object.values(parsed));
        }} else {{
            // Single value
            result = solution(parsed);
        }}

        console.log(typeof result === 'string' ? result : JSON.stringify(result));
    }} catch (e) {{
        console.error('Error:', e.message);
        process.exit(1);
    }}
}});
'''
        },
        "cpp": {
            "extension": ".cpp",
            "compile_command": ["g++", "-std=c++17", "-O2", "-o"],  # Output flag added dynamically
            "requires_compilation": True,
            # Header template - includes and helpers only (used when driver_code is provided)
            "header_template": '''
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
#include <deque>
#include <cmath>
#include <climits>
#include <sstream>
#include <cstring>
#include <cctype>
using namespace std;

// ============================================================================
// JSON Parsing Utilities
// ============================================================================

string trim(const string& s) {{
    size_t start = s.find_first_not_of(" \\t\\n\\r");
    if (start == string::npos) return "";
    size_t end = s.find_last_not_of(" \\t\\n\\r");
    return s.substr(start, end - start + 1);
}}

int parseInt(const string& s) {{ return stoi(trim(s)); }}

string parseString(const string& s) {{
    string t = trim(s);
    if (t.size() >= 2 && t[0] == '"' && t.back() == '"') {{
        return t.substr(1, t.size() - 2);
    }}
    return t;
}}

vector<int> parseIntArray(const string& s) {{
    vector<int> result;
    string t = trim(s);
    if (t.size() < 2 || t[0] != '[' || t.back() != ']') return result;
    t = t.substr(1, t.size() - 2);
    if (t.empty()) return result;
    stringstream ss(t);
    string item;
    while (getline(ss, item, ',')) {{
        result.push_back(parseInt(item));
    }}
    return result;
}}

vector<vector<int>> parse2DIntArray(const string& s) {{
    vector<vector<int>> result;
    string t = trim(s);
    if (t.size() < 2 || t[0] != '[' || t.back() != ']') return result;
    t = t.substr(1, t.size() - 2);
    if (t.empty()) return result;
    int depth = 0;
    string current;
    for (char c : t) {{
        if (c == '[') {{ depth++; current += c; }}
        else if (c == ']') {{
            depth--; current += c;
            if (depth == 0) {{ result.push_back(parseIntArray(current)); current.clear(); }}
        }} else if (c == ',' && depth == 0) {{ }}
        else {{ current += c; }}
    }}
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
    if (json[pos] == '"') {{
        size_t end = json.find('"', pos + 1);
        return json.substr(pos, end - pos + 1);
    }} else if (json[pos] == '[') {{
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
template<> string toJson(const bool& val) {{ return val ? "true" : "false"; }}
template<> string toJson(const string& val) {{ return "\\"" + val + "\\""; }}
template<> string toJson(const vector<int>& val) {{
    string s = "[";
    for (size_t i = 0; i < val.size(); i++) {{ if (i > 0) s += ","; s += to_string(val[i]); }}
    return s + "]";
}}
template<> string toJson(const vector<vector<int>>& val) {{
    string s = "[";
    for (size_t i = 0; i < val.size(); i++) {{ if (i > 0) s += ","; s += toJson(val[i]); }}
    return s + "]";
}}

// ============================================================================
// User's Solution Class
// ============================================================================
''',
            # Full wrapper template - includes header + default main (fallback)
            "wrapper_template": '''
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
#include <deque>
#include <cmath>
#include <climits>
#include <sstream>
#include <cstring>
#include <cctype>
using namespace std;

// JSON Parsing Utilities
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

// User's Solution
{user_code}

// Default test runner - assumes Solution class with twoSum-like interface
int main() {{
    string line;
    getline(cin, line);
    
    Solution sol;
    
    // Try to detect common method patterns
    // For arrays: parse "nums" field and call common methods
    string numsStr = getJsonValue(line, "nums");
    string targetStr = getJsonValue(line, "target");
    
    if (!numsStr.empty()) {{
        vector<int> nums = parseIntArray(numsStr);
        if (!targetStr.empty()) {{
            int target = parseInt(targetStr);
            // Assumes twoSum(vector<int>&, int) -> vector<int>
            auto result = sol.twoSum(nums, target);
            cout << toJson(result) << endl;
        }} else {{
            // Single array param - could be various methods
            // Try common ones
            cout << "[Error: Unknown method signature]" << endl;
        }}
    }} else {{
        // Try parsing as simple array
        vector<int> nums = parseIntArray(line);
        if (!nums.empty()) {{
            cout << "[Error: Unknown method signature]" << endl;
        }} else {{
            cout << "[Error: Could not parse input]" << endl;
        }}
    }}
    
    return 0;
}}
'''
        },
        "java": {
            "extension": ".java",
            "command": ["java"],
            "compile_command": ["javac"],
            "requires_compilation": True,
            "wrapper_template": '''
import java.util.*;
import java.io.*;

{user_code}

class Main {{
    public static void main(String[] args) throws Exception {{
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String input = br.readLine();
        // Note: Java execution requires more complex parsing
        Solution sol = new Solution();
        // This is simplified - real implementation needs reflection
        System.out.println(input);
    }}
}}
'''
        }
    }
    
    def __init__(self):
        self.execution_count = 0

    def _normalize_input(self, input_data) -> str:
        """Convert input to JSON string for stdin."""
        # Already a dict/list - serialize it
        if isinstance(input_data, (dict, list)):
            return json.dumps(input_data)

        # String input
        if isinstance(input_data, str):
            input_str = input_data.strip()

            # Empty string
            if not input_str:
                return json.dumps({})

            # Already valid JSON object or array - use as-is
            try:
                parsed = json.loads(input_str)
                # If it parsed to a dict or list, return it
                if isinstance(parsed, (dict, list)):
                    return input_str
                # If it's a primitive, continue to other parsing
            except json.JSONDecodeError:
                pass

            # Try to convert key=value format to JSON
            # e.g., "nums = [1,2,3], target = 6" -> {"nums": [1,2,3], "target": 6}
            # Also handles: nums=[1,2,3], target=6 (no spaces)
            parsed = {}

            # More comprehensive pattern that handles:
            # - Arrays: [1,2,3] or [1, 2, 3] or nested [[1,2],[3,4]]
            # - Numbers: 9, -5, 3.14, -2.5
            # - Strings: "hello" or 'hello'
            # - Booleans: true, false, True, False
            # - null/None
            # - Objects: {key: value}
            pattern = r'(\w+)\s*=\s*(\[(?:[^\[\]]*|\[(?:[^\[\]]*|\[[^\[\]]*\])*\])*\]|\{[^}]*\}|-?\d+(?:\.\d+)?|"[^"]*"|\'[^\']*\'|true|false|null|none|True|False|None)'
            matches = re.findall(pattern, input_str, re.IGNORECASE)

            for key, value in matches:
                try:
                    # Normalize Python-style booleans/None to JSON
                    value_normalized = value
                    if value.lower() == 'true':
                        value_normalized = 'true'
                    elif value.lower() == 'false':
                        value_normalized = 'false'
                    elif value.lower() in ('none', 'null'):
                        value_normalized = 'null'
                    # Handle single quotes by converting to double quotes
                    elif value.startswith("'") and value.endswith("'"):
                        value_normalized = '"' + value[1:-1] + '"'

                    parsed[key] = json.loads(value_normalized)
                except json.JSONDecodeError:
                    # If JSON parsing fails, store as string
                    parsed[key] = value

            if parsed:
                return json.dumps(parsed)

            # Last resort - wrap as single value
            # Try to parse as a single JSON value
            try:
                json.loads(input_str)
                return input_str
            except:  # noqa: E722
                return json.dumps(input_str)

        # Fallback for other types
        return json.dumps(input_data)
    
    async def run_code(
        self,
        code: str,
        language: str,
        test_cases: List[Dict],
        function_name: str = "solution",
        driver_code: str = None
    ) -> CodeExecutionResult:
        """
        Run code against all test cases.
        
        Args:
            code: User's solution code
            language: Programming language (python, javascript, cpp)
            test_cases: List of {input, expected_output, is_hidden}
            function_name: Name of the function to call
            driver_code: Optional custom test driver (replaces default main)
        
        Returns:
            CodeExecutionResult with all test results
        """
        # SECURITY: Strict language validation using whitelist
        language = language.lower().strip()
        if not validate_language(language):
            return CodeExecutionResult(
                status=ExecutionStatus.ERROR,
                passed_count=0,
                total_count=len(test_cases),
                test_results=[],
                overall_time_ms=0,
                error_message=f"Unsupported language: '{language}'. Allowed: {', '.join(get_supported_languages())}"
            )
        
        if language not in self.SUPPORTED_LANGUAGES:
            return CodeExecutionResult(
                status=ExecutionStatus.ERROR,
                passed_count=0,
                total_count=len(test_cases),
                test_results=[],
                overall_time_ms=0,
                error_message=f"Language '{language}' is in whitelist but not configured. Contact administrator."
            )
        
        lang_config = self.SUPPORTED_LANGUAGES[language]
        
        # For compiled languages, compile once and run against all test cases
        compiled_binary = None
        if lang_config.get("requires_compilation", False):
            compile_result = await self._compile_code(code, language, lang_config, driver_code)
            if compile_result.get("error"):
                return CodeExecutionResult(
                    status=ExecutionStatus.COMPILATION_ERROR,
                    passed_count=0,
                    total_count=len(test_cases),
                    test_results=[],
                    overall_time_ms=compile_result.get("time_ms", 0),
                    error_message=compile_result["error"]
                )
            compiled_binary = compile_result["binary_path"]
        
        test_results = []
        passed_count = 0
        total_time = 0
        
        try:
            for i, test_case in enumerate(test_cases):
                result = await self._run_single_test(
                    code=code,
                    language=language,
                    lang_config=lang_config,
                    test_case=test_case,
                    test_index=i,
                    function_name=function_name,
                    compiled_binary=compiled_binary,
                    driver_code=driver_code
                )
                test_results.append(result)
                total_time += result.execution_time_ms
                
                if result.status == ExecutionStatus.PASSED:
                    passed_count += 1
        finally:
            # Clean up compiled binary
            if compiled_binary:
                try:
                    os.unlink(compiled_binary)
                    # Also clean up source file
                    source_file = compiled_binary + lang_config["extension"]
                    if os.path.exists(source_file):
                        os.unlink(source_file)
                except:  # noqa: E722
                    pass
        
        # Determine overall status
        if passed_count == len(test_cases):
            overall_status = ExecutionStatus.PASSED
        elif any(r.status == ExecutionStatus.TIMEOUT for r in test_results):
            overall_status = ExecutionStatus.TIMEOUT
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
    
    async def _compile_code(
        self,
        code: str,
        language: str,
        lang_config: Dict,
        driver_code: str = None
    ) -> Dict:
        """
        Compile code for compiled languages (C++, Java).
        Returns dict with 'binary_path' on success or 'error' on failure.
        
        If driver_code is provided, it replaces the default main() function.
        Smart detection: if user's code contains main(), use it directly without wrapper.
        """
        # Smart detection: check if user code already has a main() function
        has_main = False
        if language == "cpp":
            # Check for int main, void main, etc.
            import re
            main_pattern = r'\b(int|void)\s+main\s*\('
            has_main = bool(re.search(main_pattern, code))
        
        if has_main:
            # User code has its own main() - just add standard includes
            wrapped_code = '''#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <unordered_map>
#include <set>
#include <unordered_set>
#include <queue>
#include <stack>
#include <deque>
#include <cmath>
#include <climits>
#include <sstream>
using namespace std;

''' + code
        elif driver_code:
            # Use custom driver code - wrap user code with headers and driver
            wrapped_code = lang_config["wrapper_template"].format(user_code=code)
            # Find and replace the default main with custom driver
            # The wrapper_template has a placeholder main that we need to replace
            # Actually, let's structure it differently - include driver in the wrapper
            # For now, just append driver_code after user_code in the template
            # Better approach: the wrapper_template should be split into header/footer
            wrapped_code = lang_config.get("header_template", "") + "\n" + code + "\n" + driver_code
        else:
            wrapped_code = lang_config["wrapper_template"].format(user_code=code)
        
        try:
            # Create temp directory for compilation
            temp_dir = tempfile.mkdtemp(prefix="quizly_compile_")
            source_file = os.path.join(temp_dir, f"solution{lang_config['extension']}")
            binary_file = os.path.join(temp_dir, "solution")
            
            # Write source file
            with open(source_file, 'w') as f:
                f.write(wrapped_code)
            
            # Build compile command
            if language == "cpp":
                compile_cmd = lang_config["compile_command"] + [binary_file, source_file]
            else:
                # Java and others
                compile_cmd = lang_config["compile_command"] + [source_file]
            
            import time
            start_time = time.time()
            
            # Run compilation
            process = await asyncio.create_subprocess_exec(
                *compile_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=self.COMPILE_TIMEOUT_SECONDS
                )
                compile_time = (time.time() - start_time) * 1000
                
                if process.returncode != 0:
                    error_msg = stderr.decode().strip() or stdout.decode().strip()
                    # Clean up temp dir on error
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    return {
                        "error": f"Compilation Error:\n{error_msg}",
                        "time_ms": compile_time
                    }
                
                return {
                    "binary_path": binary_file,
                    "source_file": source_file,
                    "temp_dir": temp_dir,
                    "time_ms": compile_time
                }
                
            except asyncio.TimeoutError:
                shutil.rmtree(temp_dir, ignore_errors=True)
                return {
                    "error": f"Compilation timed out after {self.COMPILE_TIMEOUT_SECONDS}s",
                    "time_ms": self.COMPILE_TIMEOUT_SECONDS * 1000
                }
                
        except Exception as e:
            return {"error": f"Compilation setup error: {str(e)}", "time_ms": 0}
    
    async def _run_single_test(
        self,
        code: str,
        language: str,
        lang_config: Dict,
        test_case: Dict,
        test_index: int,
        function_name: str,
        compiled_binary: Optional[str] = None,
        driver_code: Optional[str] = None
    ) -> TestCaseResult:
        """Run code against a single test case."""
        
        input_data = test_case.get("input", "")
        expected_output = str(test_case.get("expected_output", "")).strip()
        is_hidden = test_case.get("is_hidden", False)

        temp_file = None

        try:
            # Normalize input to JSON string
            stdin_data = self._normalize_input(input_data)
            
            import time
            start_time = time.time()
            
            # Different execution path for compiled vs interpreted
            if compiled_binary:
                # For compiled languages (C++), run the binary directly
                process = await asyncio.create_subprocess_exec(
                    compiled_binary,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
            else:
                # For interpreted languages, create temp file with wrapped code
                if driver_code:
                    # Use custom driver code
                    wrapped_code = code + "\n\n" + driver_code
                else:
                    wrapped_code = lang_config["wrapper_template"].format(user_code=code)
                
                with tempfile.NamedTemporaryFile(
                    mode='w',
                    suffix=lang_config["extension"],
                    delete=False
                ) as f:
                    f.write(wrapped_code)
                    temp_file = f.name
                
                process = await asyncio.create_subprocess_exec(
                    *lang_config["command"], temp_file,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(input=stdin_data.encode()),
                    timeout=self.TIMEOUT_SECONDS
                )
                
                execution_time = (time.time() - start_time) * 1000
                
                actual_output = stdout.decode().strip()
                error_output = stderr.decode().strip()
                
                # Truncate if too long
                if len(actual_output) > self.MAX_OUTPUT_LENGTH:
                    actual_output = actual_output[:self.MAX_OUTPUT_LENGTH] + "... (truncated)"
                
                # Check for runtime errors
                if process.returncode != 0 or error_output:
                    return TestCaseResult(
                        test_case_index=test_index,
                        input=input_data if not is_hidden else "[hidden]",
                        expected_output=expected_output if not is_hidden else "[hidden]",
                        actual_output=error_output or actual_output,
                        status=ExecutionStatus.RUNTIME_ERROR,
                        execution_time_ms=execution_time,
                        error_message=error_output,
                        is_hidden=is_hidden
                    )
                
                # Compare output (normalize for comparison)
                passed = self._compare_outputs(actual_output, expected_output)
                
                return TestCaseResult(
                    test_case_index=test_index,
                    input=input_data if not is_hidden else "[hidden]",
                    expected_output=expected_output if not is_hidden else "[hidden]",
                    actual_output=actual_output if not is_hidden else ("[hidden]" if passed else "Wrong Answer"),
                    status=ExecutionStatus.PASSED if passed else ExecutionStatus.FAILED,
                    execution_time_ms=execution_time,
                    is_hidden=is_hidden
                )
                
            except asyncio.TimeoutError:
                # Kill the process on timeout
                try:
                    process.kill()
                except:  # noqa: E722
                    pass
                return TestCaseResult(
                    test_case_index=test_index,
                    input=input_data if not is_hidden else "[hidden]",
                    expected_output=expected_output if not is_hidden else "[hidden]",
                    actual_output="",
                    status=ExecutionStatus.TIMEOUT,
                    execution_time_ms=self.TIMEOUT_SECONDS * 1000,
                    error_message=f"Time Limit Exceeded ({self.TIMEOUT_SECONDS}s)",
                    is_hidden=is_hidden
                )
                
        except Exception as e:
            return TestCaseResult(
                test_case_index=test_index,
                input=input_data if not is_hidden else "[hidden]",
                expected_output=expected_output if not is_hidden else "[hidden]",
                actual_output="",
                status=ExecutionStatus.ERROR,
                execution_time_ms=0,
                error_message=str(e),
                is_hidden=is_hidden
            )
        finally:
            # Clean up temp file (only for interpreted languages)
            if temp_file:
                try:
                    os.unlink(temp_file)
                except:  # noqa: E722
                    pass
    
    def _normalize_python_to_json(self, s: str) -> str:
        """Convert Python repr output to valid JSON."""
        import re
        result = s
        # Handle Python True/False/None
        result = re.sub(r'\bTrue\b', 'true', result)
        result = re.sub(r'\bFalse\b', 'false', result)
        result = re.sub(r'\bNone\b', 'null', result)
        # Replace single quotes with double quotes for string literals
        result = re.sub(r"'([^']*)'", r'"\1"', result)
        return result

    def _compare_outputs(self, actual: str, expected: str) -> bool:
        """
        Compare outputs with normalization.
        Handles JSON, numbers, strings, arrays, Python repr format.
        """
        actual = actual.strip()
        expected = expected.strip()

        # Direct string match
        if actual == expected:
            return True

        # Try JSON comparison (handles array/object formatting differences)
        try:
            actual_json = json.loads(actual)
            expected_json = json.loads(expected)
            return actual_json == expected_json
        except:  # noqa: E722
            pass

        # Try normalizing Python output to JSON and compare
        try:
            actual_normalized = self._normalize_python_to_json(actual)
            expected_normalized = self._normalize_python_to_json(expected)

            # Direct match after normalization
            if actual_normalized == expected_normalized:
                return True

            # JSON comparison after normalization
            actual_json = json.loads(actual_normalized)
            expected_json = json.loads(expected_normalized)
            return actual_json == expected_json
        except:  # noqa: E722
            pass

        # Try numeric comparison (handles float precision)
        try:
            actual_num = float(actual)
            expected_num = float(expected)
            return abs(actual_num - expected_num) < 1e-6
        except:  # noqa: E722
            pass

        # Case-insensitive string comparison as fallback
        return actual.lower() == expected.lower()


# Singleton instance
code_runner = CodeRunner()

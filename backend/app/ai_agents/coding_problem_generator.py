"""
Coding Problem Generator - LLM-Powered LeetCode-Style Problem Creation

Generates coding problems dynamically with:
- Problem description with examples
- Starter code for multiple languages (Python, C++, JavaScript)
- Driver code for test execution
- Test cases with expected outputs
"""

import os
import json
import time
import uuid
from typing import Dict, Any, Optional, List

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..utils.llm_utils import call_gemini_with_timeout

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = get_logger(__name__)


# Type mappings for different languages
TYPE_MAPPINGS = {
    "python": {
        "int": "int",
        "float": "float",
        "string": "str",
        "bool": "bool",
        "list[int]": "list[int]",
        "list[str]": "list[str]",
        "list[list[int]]": "list[list[int]]",
        "list[float]": "list[float]",
    },
    "cpp": {
        "int": "int",
        "float": "double",
        "string": "string",
        "bool": "bool",
        "list[int]": "vector<int>",
        "list[str]": "vector<string>",
        "list[list[int]]": "vector<vector<int>>",
        "list[float]": "vector<double>",
    },
    "javascript": {
        "int": "number",
        "float": "number",
        "string": "string",
        "bool": "boolean",
        "list[int]": "number[]",
        "list[str]": "string[]",
        "list[list[int]]": "number[][]",
        "list[float]": "number[]",
    }
}


class CodingProblemGenerator:
    """
    Generates LeetCode-style coding problems using Gemini LLM.
    
    Features:
    - Dynamic problem generation from concepts/topics
    - Multi-language starter code (Python, C++, JavaScript)
    - Auto-generated driver code for test execution
    - Test case generation with edge cases
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.model = None
        
        if GEMINI_AVAILABLE:
            api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel("gemini-2.0-flash")
    
    async def generate_problem(
        self,
        concept: str,
        difficulty: str = "medium",
        problem_type: str = "algorithm",
        course_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a complete coding problem from a concept.
        
        Args:
            concept: The programming concept (e.g., "binary search", "two pointers", "hash tables")
            difficulty: "easy", "medium", or "hard"
            problem_type: "algorithm", "data_structure", "string", "math", etc.
            course_context: Optional course context for better problem generation
            
        Returns:
            Complete problem dict with description, starter_code, driver_code, test_cases
        """
        if not self.model:
            return self._fallback_problem(concept, difficulty)
        
        context_instruction = ""
        if course_context:
            context_instruction = f"\nCOURSE CONTEXT: {course_context}\nMake the problem relevant to this course."
        
        prompt = f"""You are an expert educator creating a LeetCode-style coding problem.

CONCEPT: {concept}
DIFFICULTY: {difficulty}
PROBLEM TYPE: {problem_type}{context_instruction}

Create a complete coding problem with the following requirements:

1. PROBLEM DESCRIPTION: Clear problem statement with:
   - Concrete examples with input/output
   - Constraints on input size and values
   - Edge cases to consider

2. FUNCTION SIGNATURE: Define a clear function with:
   - Descriptive function name (camelCase)
   - Typed parameters
   - Return type

3. TEST CASES: At least 3-5 test cases including:
   - Basic cases from examples
   - Edge cases (empty input, single element, large values)
   - Corner cases specific to the algorithm

Return ONLY valid JSON in this exact format:
{{
    "title": "Problem Title",
    "description": "Full problem description with examples in markdown format",
    "function_name": "functionName",
    "parameters": [
        {{"name": "param1", "type": "list[int]", "description": "Description of param1"}},
        {{"name": "param2", "type": "int", "description": "Description of param2"}}
    ],
    "return_type": "list[int]",
    "return_description": "Description of what to return",
    "hints": ["Hint 1", "Hint 2"],
    "test_cases": [
        {{"inputs": {{"param1": [1, 2, 3], "param2": 5}}, "expected": [0, 1], "explanation": "Why this is the answer"}},
        {{"inputs": {{"param1": [3, 3], "param2": 6}}, "expected": [0, 1], "explanation": "Edge case explanation"}}
    ],
    "time_complexity": "O(n)",
    "space_complexity": "O(1)",
    "tags": ["array", "hash table"]
}}

IMPORTANT:
- Use generic types like "list[int]", "string", "int", "bool", "list[list[int]]"
- Test case inputs must be JSON-serializable
- Expected outputs must be exact values (for comparison)
- Make test cases realistic and educational"""

        try:
            response = await call_gemini_with_timeout(
                self.model, prompt,
                generation_config={"response_mime_type": "application/json"},
                context={"agent": "coding_problem_generator", "operation": "generate_problem"},
            )
            if response is not None:
                result = json.loads(response.text)

                # Validate required fields
                required = ["title", "description", "function_name", "parameters", "return_type", "test_cases"]
                if all(k in result for k in required):
                    # Generate starter code and driver code for each language
                    result["starter_code"] = self._generate_starter_code(result)
                    result["driver_code"] = self._generate_driver_code(result)
                    result["id"] = str(uuid.uuid4())
                    result["difficulty"] = difficulty
                    result["subject"] = problem_type
                    result["points"] = {"easy": 50, "medium": 75, "hard": 100}.get(difficulty, 75)

                    # Format test cases for storage
                    result["formatted_test_cases"] = [
                        {
                            "input": json.dumps(tc["inputs"]),
                            "expected": json.dumps(tc["expected"]) if not isinstance(tc["expected"], str) else tc["expected"],
                            "explanation": tc.get("explanation", "")
                        }
                        for tc in result["test_cases"]
                    ]

                    return result
        except Exception as e:
            capture_exception(e, context={"service": "coding_problem_generator", "operation": "generate_problem"})
            log_error(logger, "generate_problem failed", error=str(e))
        
        return self._fallback_problem(concept, difficulty)
    
    def _generate_starter_code(self, problem: Dict) -> Dict[str, str]:
        """Generate starter code for all supported languages."""
        func_name = problem["function_name"]
        params = problem["parameters"]
        return_type = problem["return_type"]
        
        return {
            "python": self._python_starter(func_name, params, return_type),
            "cpp": self._cpp_starter(func_name, params, return_type),
            "javascript": self._js_starter(func_name, params, return_type),
        }
    
    def _generate_driver_code(self, problem: Dict) -> Dict[str, str]:
        """Generate driver code for all supported languages."""
        func_name = problem["function_name"]
        params = problem["parameters"]
        return_type = problem["return_type"]
        
        return {
            "python": self._python_driver(func_name, params, return_type),
            "cpp": self._cpp_driver(func_name, params, return_type),
            "javascript": self._js_driver(func_name, params, return_type),
        }
    
    def _python_starter(self, func_name: str, params: List[Dict], return_type: str) -> str:
        """Generate Python starter code."""
        py_return = TYPE_MAPPINGS["python"].get(return_type, return_type)
        param_str = ", ".join(
            f"{p['name']}: {TYPE_MAPPINGS['python'].get(p['type'], p['type'])}"
            for p in params
        )
        
        return f'''class Solution:
    def {func_name}(self, {param_str}) -> {py_return}:
        # Your code here
        pass'''
    
    def _cpp_starter(self, func_name: str, params: List[Dict], return_type: str) -> str:
        """Generate C++ starter code."""
        cpp_return = TYPE_MAPPINGS["cpp"].get(return_type, return_type)
        param_list = []
        for p in params:
            cpp_type = TYPE_MAPPINGS["cpp"].get(p["type"], p["type"])
            # Use reference for vectors
            if "vector" in cpp_type:
                param_list.append(f"{cpp_type}& {p['name']}")
            else:
                param_list.append(f"{cpp_type} {p['name']}")
        param_str = ", ".join(param_list)
        
        return f'''class Solution {{
public:
    {cpp_return} {func_name}({param_str}) {{
        // Your code here
        
    }}
}};'''
    
    def _js_starter(self, func_name: str, params: List[Dict], return_type: str) -> str:
        """Generate JavaScript starter code."""
        js_return = TYPE_MAPPINGS["javascript"].get(return_type, return_type)
        param_names = ", ".join(p["name"] for p in params)
        
        # JSDoc type annotations
        jsdoc_params = "\n".join(
            f" * @param {{{TYPE_MAPPINGS['javascript'].get(p['type'], p['type'])}}} {p['name']}"
            for p in params
        )
        
        return f'''/**
{jsdoc_params}
 * @return {{{js_return}}}
 */
var {func_name} = function({param_names}) {{
    // Your code here
    
}};'''
    
    def _python_driver(self, func_name: str, params: List[Dict], return_type: str) -> str:
        """Generate Python driver code."""
        parse_lines = []
        call_args = []
        
        for p in params:
            parse_lines.append(f"    {p['name']} = parsed[\"{p['name']}\"]")
            call_args.append(p['name'])
        
        call_str = ", ".join(call_args)
        
        # Determine output formatting
        if return_type == "bool":
            output_format = 'print("true" if result else "false")'
        elif return_type in ("int", "float", "string"):
            output_format = "print(result)"
        else:
            output_format = "print(json.dumps(result))"
        
        return f'''
import sys
import json

if __name__ == "__main__":
    input_data = sys.stdin.read().strip()
    parsed = json.loads(input_data)
    
{chr(10).join(parse_lines)}
    
    sol = Solution()
    result = sol.{func_name}({call_str})
    {output_format}
'''
    
    def _cpp_driver(self, func_name: str, params: List[Dict], return_type: str) -> str:
        """Generate C++ driver code."""
        parse_lines = []
        call_args = []
        
        for p in params:
            TYPE_MAPPINGS["cpp"].get(p["type"], p["type"])
            
            if p["type"] == "list[int]":
                parse_lines.append(f'    vector<int> {p["name"]} = parseIntArray(getJsonValue(line, "{p["name"]}"));')
            elif p["type"] == "list[list[int]]":
                parse_lines.append(f'    vector<vector<int>> {p["name"]} = parse2DIntArray(getJsonValue(line, "{p["name"]}"));')
            elif p["type"] == "list[str]":
                parse_lines.append(f'    vector<string> {p["name"]} = parseStringArray(getJsonValue(line, "{p["name"]}"));')
            elif p["type"] == "int":
                parse_lines.append(f'    int {p["name"]} = parseInt(getJsonValue(line, "{p["name"]}"));')
            elif p["type"] == "string":
                parse_lines.append(f'    string {p["name"]} = parseString(getJsonValue(line, "{p["name"]}"));')
            elif p["type"] == "bool":
                parse_lines.append(f'    bool {p["name"]} = parseBool(getJsonValue(line, "{p["name"]}"));')
            elif p["type"] == "float":
                parse_lines.append(f'    double {p["name"]} = parseDouble(getJsonValue(line, "{p["name"]}"));')
            else:
                parse_lines.append(f'    // TODO: parse {p["name"]} of type {p["type"]}')
            
            call_args.append(p["name"])
        
        call_str = ", ".join(call_args)
        
        # Determine output formatting
        cpp_return = TYPE_MAPPINGS["cpp"].get(return_type, return_type)
        if return_type == "bool":
            output_line = 'cout << (result ? "true" : "false") << endl;'
        elif return_type in ("int", "float", "string"):
            output_line = "cout << result << endl;"
        elif "vector" in cpp_return:
            output_line = "cout << toJson(result) << endl;"
        else:
            output_line = "cout << result << endl;"
        
        return f'''
int main() {{
    string line;
    getline(cin, line);
    
{chr(10).join(parse_lines)}
    
    Solution sol;
    {cpp_return} result = sol.{func_name}({call_str});
    {output_line}
    
    return 0;
}}'''
    
    def _js_driver(self, func_name: str, params: List[Dict], return_type: str) -> str:
        """Generate JavaScript driver code."""
        parse_lines = []
        call_args = []
        
        for p in params:
            parse_lines.append(f"    const {p['name']} = parsed.{p['name']};")
            call_args.append(p['name'])
        
        call_str = ", ".join(call_args)
        
        # Determine output formatting
        if return_type == "bool":
            output_line = 'console.log(result ? "true" : "false");'
        elif return_type in ("int", "float"):
            output_line = "console.log(result);"
        elif return_type == "string":
            output_line = "console.log(result);"
        else:
            output_line = "console.log(JSON.stringify(result));"
        
        return f'''
const readline = require('readline');
const rl = readline.createInterface({{
    input: process.stdin,
    output: process.stdout,
    terminal: false
}});

let inputData = '';
rl.on('line', (line) => {{ inputData += line; }});
rl.on('close', () => {{
    const parsed = JSON.parse(inputData.trim());
    
{chr(10).join(parse_lines)}
    
    const result = {func_name}({call_str});
    {output_line}
}});
'''
    
    def _fallback_problem(self, concept: str, difficulty: str) -> Dict[str, Any]:
        """Fallback problem when LLM is unavailable."""
        return {
            "id": str(uuid.uuid4()),
            "title": f"[LLM Required] {concept.title()} Problem",
            "description": f"LLM is required to generate a proper coding problem for {concept}.",
            "function_name": "solution",
            "parameters": [{"name": "input", "type": "string", "description": "Input data"}],
            "return_type": "string",
            "difficulty": difficulty,
            "subject": "algorithm",
            "points": 50,
            "hints": ["LLM required for hints"],
            "tags": [concept],
            "starter_code": {
                "python": "class Solution:\n    def solution(self, input: str) -> str:\n        pass",
                "cpp": "class Solution {\npublic:\n    string solution(string input) {\n        \n    }\n};",
                "javascript": "var solution = function(input) {\n    \n};",
            },
            "driver_code": {},
            "test_cases": [],
            "formatted_test_cases": [],
            "llm_required": True,
        }
    
    async def generate_problems_for_topic(
        self,
        topic: str,
        concepts: List[str],
        difficulty_distribution: Dict[str, int] = None,
        course_context: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple coding problems for a topic.

        Args:
            topic: Main topic (e.g., "Arrays and Hashing")
            concepts: List of concepts to generate problems for
            difficulty_distribution: Dict like {"easy": 2, "medium": 3, "hard": 1}
            course_context: Optional course context

        Returns:
            List of generated problems
        """
        if difficulty_distribution is None:
            difficulty_distribution = {"easy": 1, "medium": 1, "hard": 0}

        problems = []

        for concept in concepts:
            for difficulty, count in difficulty_distribution.items():
                for _ in range(count):
                    problem = await self.generate_problem(
                        concept=concept,
                        difficulty=difficulty,
                        problem_type=topic,
                        course_context=course_context
                    )
                    problems.append(problem)

        return problems


# Convenience function
async def generate_coding_problem(
    concept: str,
    difficulty: str = "medium",
    course_context: Optional[str] = None
) -> Dict[str, Any]:
    """Quick function to generate a single coding problem."""
    generator = CodingProblemGenerator()
    return await generator.generate_problem(concept, difficulty, course_context=course_context)


if __name__ == "__main__":
    # Test problem generation
    generator = CodingProblemGenerator()
    
    print("Generating a Two Sum style problem...")
    problem = generator.generate_problem(
        concept="two sum with hash table",
        difficulty="easy",
        problem_type="arrays"
    )
    
    print(f"\nTitle: {problem['title']}")
    print(f"Function: {problem['function_name']}")
    print("\nPython Starter Code:")
    print(problem['starter_code']['python'])
    print("\nC++ Starter Code:")
    print(problem['starter_code']['cpp'])
    print(f"\nTest Cases: {len(problem.get('test_cases', []))}")

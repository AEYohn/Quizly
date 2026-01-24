"""
Database Seeder
Seeds the database with sample data for demo purposes.
Run with: python -m app.seed_db
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta

from .database import engine, async_session, Base
from .db_models import User, Session, Question, Response, Misconception, Course, CourseModule, ModuleItem, CodingProblem, TestCase


async def seed_database():
    """Seed the database with demo data."""
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with async_session() as db:
        # Check if already seeded
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "demo@quizly.ai"))
        if result.scalar_one_or_none():
            print("Database already seeded. Skipping...")
            return
        
        print("Seeding database...")
        
        # Create demo teacher
        teacher = User(
            id=uuid.uuid4(),
            email="demo@quizly.ai",
            name="Dr. Demo Teacher",
            role="teacher",
        )
        db.add(teacher)
        await db.flush()
        
        # Create completed sessions with realistic data (Math + CS topics)
        sessions_data = [
            {
                "topic": "Recursion Fundamentals",
                "status": "completed",
                "mode": "live",
                "subject": "computer-science",
                "questions": [
                    {
                        "prompt": "What is the base case for calculating factorial(n)?",
                        "options": ["A. n == 0 or n == 1", "B. n < 0", "C. n > 100", "D. n == n-1"],
                        "correct_answer": "A",
                        "concept": "Recursion",
                    },
                    {
                        "prompt": "What happens when a recursive function has no base case?",
                        "options": ["A. It returns 0", "B. Stack overflow", "C. It runs once", "D. Syntax error"],
                        "correct_answer": "B",
                        "concept": "Recursion",
                    },
                ],
                "responses": 28,
                "accuracy": 0.64,
            },
            {
                "topic": "Proof by Induction",
                "status": "completed",
                "mode": "async",
                "allow_async": True,
                "subject": "mathematics",
                "questions": [
                    {
                        "prompt": "In a proof by induction, what must you prove in the base case?",
                        "options": ["A. P(k) → P(k+1)", "B. P(1) or P(0) is true", "C. P(n) for all n", "D. The formula works for large n"],
                        "correct_answer": "B",
                        "concept": "Induction",
                    },
                    {
                        "prompt": "In the inductive step, what do you assume?",
                        "options": ["A. P(k+1) is true", "B. P(k) is true (inductive hypothesis)", "C. P(1) is true", "D. P(n) is false"],
                        "correct_answer": "B",
                        "concept": "Induction",
                    },
                ],
                "responses": 35,
                "accuracy": 0.71,
            },
            {
                "topic": "Big-O Notation",
                "status": "completed",
                "mode": "live",
                "subject": "computer-science",
                "questions": [
                    {
                        "prompt": "What is the time complexity of searching in a sorted array using binary search?",
                        "options": ["A. O(n)", "B. O(log n)", "C. O(n²)", "D. O(1)"],
                        "correct_answer": "B",
                        "concept": "Big-O",
                    },
                ],
                "responses": 32,
                "accuracy": 0.68,
            },
            {
                "topic": "Limits and Continuity",
                "status": "completed",
                "mode": "live",
                "subject": "mathematics",
                "questions": [
                    {
                        "prompt": "What is lim(x→0) sin(x)/x?",
                        "options": ["A. 0", "B. 1", "C. ∞", "D. Does not exist"],
                        "correct_answer": "B",
                        "concept": "Limits",
                    },
                    {
                        "prompt": "A function is continuous at x=a if:",
                        "options": ["A. f(a) exists only", "B. lim f(x) exists only", "C. f(a) = lim(x→a) f(x)", "D. f is differentiable"],
                        "correct_answer": "C",
                        "concept": "Continuity",
                    },
                ],
                "responses": 41,
                "accuracy": 0.55,
            },
            {
                "topic": "Graph Theory Basics",
                "status": "completed",
                "mode": "async",
                "allow_async": True,
                "subject": "mathematics",
                "questions": [
                    {
                        "prompt": "In a complete graph K_n, how many edges are there?",
                        "options": ["A. n", "B. n²", "C. n(n-1)/2", "D. 2n"],
                        "correct_answer": "C",
                        "concept": "Graph Theory",
                    },
                ],
                "responses": 29,
                "accuracy": 0.62,
            },
        ]
        
        created_sessions = []
        for i, sdata in enumerate(sessions_data):
            session = Session(
                id=uuid.uuid4(),
                creator_id=teacher.id,
                topic=sdata["topic"],
                status=sdata["status"],
                mode=sdata.get("mode", "live"),
                allow_async=sdata.get("allow_async", False),
                play_count=sdata["responses"],
                created_at=datetime.now(timezone.utc) - timedelta(days=7-i),
                started_at=datetime.now(timezone.utc) - timedelta(days=7-i),
                ended_at=datetime.now(timezone.utc) - timedelta(days=7-i, hours=-1),
            )
            db.add(session)
            await db.flush()
            created_sessions.append(session)
            
            # Add questions
            session_questions = []
            for j, qdata in enumerate(sdata["questions"]):
                question = Question(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    prompt=qdata["prompt"],
                    options=qdata["options"],
                    correct_answer=qdata["correct_answer"],
                    concept=qdata.get("concept"),
                    order_index=j,
                )
                db.add(question)
                session_questions.append(question)
            
            await db.flush()  # Flush to get question IDs
            
            # Add sample responses for first question
            if session_questions:
                first_q = session_questions[0]
                student_names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry"]
                for name in student_names[:min(8, sdata["responses"])]:
                    response = Response(
                        id=uuid.uuid4(),
                        session_id=session.id,
                        question_id=first_q.id,  # Link to first question
                        student_name=name,
                        answer="A" if name in ["Alice", "Bob", "Charlie"] else "B",
                        confidence=70 + (hash(name) % 20),
                        is_correct=name in ["Alice", "Bob", "Charlie", "Diana"],
                    )
                    db.add(response)
        
        # Add real misconceptions detected from sessions (Math + CS)
        misconceptions_data = [
            {
                "topic": "Recursion",
                "misconception": "Confuse stack overflow with infinite loop",
                "description": "Students think stack overflow and infinite loops are the same error, not understanding the call stack.",
                "affected_count": 38,
                "total_count": 100,
                "severity": "high",
                "common_wrong_answer": "C",
                "suggested_intervention": "Use visual debugger to show call stack growing, then crashing vs a loop that just runs forever.",
            },
            {
                "topic": "Induction",
                "misconception": "Skip the base case verification",
                "description": "Students go straight to inductive step, forgetting that induction requires proving P(1) first.",
                "affected_count": 31,
                "total_count": 100,
                "severity": "high",
                "common_wrong_answer": "A",
                "suggested_intervention": "Show false 'proofs' that work inductively but fail at base case (e.g., all horses are the same color).",
            },
            {
                "topic": "Limits",
                "misconception": "Plug in the value directly for indeterminate forms",
                "description": "Students substitute x=a directly even for 0/0 forms, not recognizing the need for L'Hopital's or algebraic manipulation.",
                "affected_count": 27,
                "total_count": 100,
                "severity": "high",
                "common_wrong_answer": "A",
                "suggested_intervention": "Practice identifying indeterminate forms (0/0, ∞/∞) and when special techniques are needed.",
            },
            {
                "topic": "Big-O",
                "misconception": "Believe O(n) always means exactly n iterations",
                "description": "Students take Big-O literally, not understanding it describes growth rate, not exact count.",
                "affected_count": 19,
                "total_count": 100,
                "severity": "medium",
                "common_wrong_answer": "A",
                "suggested_intervention": "Show examples where O(n) code runs 2n or 0.5n times - still O(n).",
            },
            {
                "topic": "Graph Theory",
                "misconception": "Confuse edges with vertices in counting formulas",
                "description": "Students mix up |V| and |E| when applying formulas like Euler's or handshaking lemma.",
                "affected_count": 22,
                "total_count": 100,
                "severity": "medium",
                "common_wrong_answer": "B",
                "suggested_intervention": "Always label diagrams with V={...} and E={...} before applying any formula.",
            },
        ]
        
        for mdata in misconceptions_data:
            misconception = Misconception(
                id=uuid.uuid4(),
                creator_id=teacher.id,
                session_id=created_sessions[0].id if created_sessions else None,
                topic=mdata["topic"],
                misconception=mdata["misconception"],
                description=mdata["description"],
                affected_count=mdata["affected_count"],
                total_count=mdata["total_count"],
                severity=mdata["severity"],
                common_wrong_answer=mdata["common_wrong_answer"],
                suggested_intervention=mdata["suggested_intervention"],
            )
            db.add(misconception)
        
        # Create public courses for browsing
        courses_data = [
            {
                "name": "Discrete Mathematics",
                "description": "Master the mathematical foundations of computer science including logic, sets, relations, and graph theory.",
                "difficulty_level": "intermediate",
                "tags": ["math", "discrete", "logic", "proofs"],
                "estimated_hours": 30,
                "modules": [
                    {"title": "Propositional Logic", "items": ["Truth Tables", "Logical Equivalences", "Proof Techniques"]},
                    {"title": "Sets and Functions", "items": ["Set Operations", "Functions", "Cardinality"]},
                    {"title": "Graph Theory", "items": ["Graph Basics", "Trees", "Euler & Hamilton"]},
                ]
            },
            {
                "name": "Calculus I: Limits & Derivatives",
                "description": "Build a strong foundation in single-variable calculus with interactive visualizations and practice problems.",
                "difficulty_level": "intermediate",
                "tags": ["math", "calculus", "limits", "derivatives"],
                "estimated_hours": 25,
                "modules": [
                    {"title": "Limits", "items": ["Intuitive Limits", "Epsilon-Delta", "Limit Laws"]},
                    {"title": "Derivatives", "items": ["Definition", "Rules", "Chain Rule"]},
                    {"title": "Applications", "items": ["Optimization", "Related Rates", "L'Hopital"]},
                ]
            },
            {
                "name": "Data Structures & Algorithms",
                "description": "Master essential CS concepts including arrays, trees, graphs, and sorting algorithms with hands-on coding.",
                "difficulty_level": "intermediate",
                "tags": ["cs", "algorithms", "data structures", "coding"],
                "estimated_hours": 40,
                "modules": [
                    {"title": "Arrays & Lists", "items": ["Dynamic Arrays", "Linked Lists", "Stacks & Queues"]},
                    {"title": "Trees", "items": ["Binary Trees", "BST", "Heaps"]},
                    {"title": "Graphs", "items": ["Representations", "BFS/DFS", "Shortest Paths"]},
                ]
            },
            {
                "name": "Linear Algebra Essentials",
                "description": "Learn vectors, matrices, linear transformations, and eigenvalues with applications to ML and graphics.",
                "difficulty_level": "intermediate",
                "tags": ["math", "linear algebra", "matrices", "vectors"],
                "estimated_hours": 35,
                "modules": [
                    {"title": "Vectors & Matrices", "items": ["Operations", "Matrix Multiplication", "Transpose"]},
                    {"title": "Linear Systems", "items": ["Gaussian Elimination", "Inverses", "Determinants"]},
                    {"title": "Eigenvalues", "items": ["Definition", "Diagonalization", "Applications"]},
                ]
            },
        ]
        
        for cdata in courses_data:
            course = Course(
                id=uuid.uuid4(),
                teacher_id=teacher.id,
                name=cdata["name"],
                description=cdata["description"],
                difficulty_level=cdata["difficulty_level"],
                tags=cdata["tags"],
                estimated_hours=cdata["estimated_hours"],
                is_published=True,
                is_public=True,
                enrollment_count=100 + hash(cdata["name"]) % 500,  # Random enrollment
            )
            db.add(course)
            await db.flush()
            
            # Add modules and items
            for i, mdata in enumerate(cdata["modules"]):
                module = CourseModule(
                    id=uuid.uuid4(),
                    course_id=course.id,
                    title=mdata["title"],
                    order_index=i,
                    is_published=True,
                )
                db.add(module)
                await db.flush()
                
                for j, item_title in enumerate(mdata["items"]):
                    item = ModuleItem(
                        id=uuid.uuid4(),
                        module_id=module.id,
                        title=item_title,
                        item_type="lesson",
                        order_index=j,
                        content=f"# {item_title}\n\nLesson content for {item_title} will appear here.",
                        points=10,
                        is_published=True,
                    )
                    db.add(item)
        
        # Create coding problems for featured challenges (LeetCode-style)
        coding_problems_data = [
            {
                "title": "Two Sum",
                "description": """Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

**Example 1:**
```
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
```

**Example 2:**
```
Input: nums = [3,2,4], target = 6
Output: [1,2]
```

**Constraints:**
- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists.""",
                "difficulty": "easy",
                "subject": "arrays",
                "tags": ["array", "hash table"],
                "hints": ["Consider using a hash map to store values you've seen", "What complement are you looking for at each step?"],
                "points": 50,
                "function_name": "twoSum",
                "starter_code": {
                    "python": """class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Your code here
        pass""",
                    "cpp": """class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Your code here
        
    }
};""",
                    "javascript": """/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    // Your code here
    
};"""
                },
                "driver_code": {
                    "python": """
import sys
import json

if __name__ == "__main__":
    input_data = sys.stdin.read().strip()
    parsed = json.loads(input_data)
    
    sol = Solution()
    result = sol.twoSum(parsed["nums"], parsed["target"])
    print(json.dumps(result))
""",
                    "cpp": """
int main() {
    string line;
    getline(cin, line);
    
    vector<int> nums = parseIntArray(getJsonValue(line, "nums"));
    int target = parseInt(getJsonValue(line, "target"));
    
    Solution sol;
    vector<int> result = sol.twoSum(nums, target);
    cout << toJson(result) << endl;
    
    return 0;
}""",
                    "javascript": """
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let inputData = '';
rl.on('line', (line) => { inputData += line; });
rl.on('close', () => {
    const parsed = JSON.parse(inputData.trim());
    const result = twoSum(parsed.nums, parsed.target);
    console.log(JSON.stringify(result));
});
"""
                },
                "test_cases": [
                    {"input": '{"nums": [2, 7, 11, 15], "target": 9}', "expected": "[0,1]"},
                    {"input": '{"nums": [3, 2, 4], "target": 6}', "expected": "[1,2]"},
                    {"input": '{"nums": [3, 3], "target": 6}', "expected": "[0,1]"},
                ]
            },
            {
                "title": "Binary Search",
                "description": """Given a **sorted** array of distinct integers `nums` and a target value `target`, return the index if the target is found. If not, return `-1`.

You must write an algorithm with O(log n) runtime complexity.

**Example 1:**
```
Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4
Explanation: 9 exists in nums and its index is 4
```

**Example 2:**
```
Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1
Explanation: 2 does not exist in nums so return -1
```

**Constraints:**
- 1 <= nums.length <= 10^4
- -10^4 < nums[i], target < 10^4
- All integers in nums are unique
- nums is sorted in ascending order""",
                "difficulty": "easy",
                "subject": "algorithms",
                "tags": ["binary search", "array"],
                "hints": ["Use two pointers for left and right bounds", "Calculate mid without integer overflow"],
                "points": 50,
                "function_name": "search",
                "starter_code": {
                    "python": """class Solution:
    def search(self, nums: list[int], target: int) -> int:
        # Your code here
        pass""",
                    "cpp": """class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Your code here
        
    }
};""",
                    "javascript": """/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var search = function(nums, target) {
    // Your code here
    
};"""
                },
                "driver_code": {
                    "python": """
import sys
import json

if __name__ == "__main__":
    input_data = sys.stdin.read().strip()
    parsed = json.loads(input_data)
    
    sol = Solution()
    result = sol.search(parsed["nums"], parsed["target"])
    print(result)
""",
                    "cpp": """
int main() {
    string line;
    getline(cin, line);
    
    vector<int> nums = parseIntArray(getJsonValue(line, "nums"));
    int target = parseInt(getJsonValue(line, "target"));
    
    Solution sol;
    int result = sol.search(nums, target);
    cout << result << endl;
    
    return 0;
}""",
                    "javascript": """
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let inputData = '';
rl.on('line', (line) => { inputData += line; });
rl.on('close', () => {
    const parsed = JSON.parse(inputData.trim());
    const result = search(parsed.nums, parsed.target);
    console.log(result);
});
"""
                },
                "test_cases": [
                    {"input": '{"nums": [-1, 0, 3, 5, 9, 12], "target": 9}', "expected": "4"},
                    {"input": '{"nums": [-1, 0, 3, 5, 9, 12], "target": 2}', "expected": "-1"},
                    {"input": '{"nums": [5], "target": 5}', "expected": "0"},
                ]
            },
            {
                "title": "Valid Parentheses",
                "description": """Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

**Example 1:**
```
Input: s = "()"
Output: true
```

**Example 2:**
```
Input: s = "()[]{}"
Output: true
```

**Example 3:**
```
Input: s = "(]"
Output: false
```

**Constraints:**
- 1 <= s.length <= 10^4
- s consists of parentheses only '()[]{}'""",
                "difficulty": "easy",
                "subject": "stacks",
                "tags": ["stack", "string"],
                "hints": ["Use a stack to keep track of opening brackets", "When you see a closing bracket, check if it matches the top of the stack"],
                "points": 50,
                "function_name": "isValid",
                "starter_code": {
                    "python": """class Solution:
    def isValid(self, s: str) -> bool:
        # Your code here
        pass""",
                    "cpp": """class Solution {
public:
    bool isValid(string s) {
        // Your code here
        
    }
};""",
                    "javascript": """/**
 * @param {string} s
 * @return {boolean}
 */
var isValid = function(s) {
    // Your code here
    
};"""
                },
                "driver_code": {
                    "python": """
import sys
import json

if __name__ == "__main__":
    input_data = sys.stdin.read().strip()
    # Input is a quoted string like '"()"'
    s = json.loads(input_data)
    
    sol = Solution()
    result = sol.isValid(s)
    print("true" if result else "false")
""",
                    "cpp": """
int main() {
    string line;
    getline(cin, line);
    
    // Parse the string from JSON
    string s = line;
    if (s.size() >= 2 && s[0] == '"' && s.back() == '"') {
        s = s.substr(1, s.size() - 2);
    }
    
    Solution sol;
    bool result = sol.isValid(s);
    cout << (result ? "true" : "false") << endl;
    
    return 0;
}""",
                    "javascript": """
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let inputData = '';
rl.on('line', (line) => { inputData += line; });
rl.on('close', () => {
    const s = JSON.parse(inputData.trim());
    const result = isValid(s);
    console.log(result ? "true" : "false");
});
"""
                },
                "test_cases": [
                    {"input": '"()"', "expected": "true"},
                    {"input": '"()[]{}"', "expected": "true"},
                    {"input": '"(]"', "expected": "false"},
                    {"input": '"([)]"', "expected": "false"},
                    {"input": '"{[]}"', "expected": "true"},
                ]
            },
            {
                "title": "Maximum Subarray",
                "description": """Given an integer array `nums`, find the subarray with the largest sum, and return its sum.

**Example 1:**
```
Input: nums = [-2,1,-3,4,-1,2,1,-5,4]
Output: 6
Explanation: The subarray [4,-1,2,1] has the largest sum 6.
```

**Example 2:**
```
Input: nums = [1]
Output: 1
```

**Example 3:**
```
Input: nums = [5,4,-1,7,8]
Output: 23
Explanation: The subarray [5,4,-1,7,8] has the largest sum 23.
```

**Constraints:**
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4""",
                "difficulty": "medium",
                "subject": "dynamic programming",
                "tags": ["array", "dynamic programming", "divide and conquer"],
                "hints": ["Think about Kadane's algorithm", "At each position, decide whether to extend the previous subarray or start fresh"],
                "points": 75,
                "function_name": "maxSubArray",
                "starter_code": {
                    "python": """class Solution:
    def maxSubArray(self, nums: list[int]) -> int:
        # Your code here
        pass""",
                    "cpp": """class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Your code here
        
    }
};""",
                    "javascript": """/**
 * @param {number[]} nums
 * @return {number}
 */
var maxSubArray = function(nums) {
    // Your code here
    
};"""
                },
                "driver_code": {
                    "python": """
import sys
import json

if __name__ == "__main__":
    input_data = sys.stdin.read().strip()
    nums = json.loads(input_data)
    
    sol = Solution()
    result = sol.maxSubArray(nums)
    print(result)
""",
                    "cpp": """
int main() {
    string line;
    getline(cin, line);
    
    vector<int> nums = parseIntArray(line);
    
    Solution sol;
    int result = sol.maxSubArray(nums);
    cout << result << endl;
    
    return 0;
}""",
                    "javascript": """
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let inputData = '';
rl.on('line', (line) => { inputData += line; });
rl.on('close', () => {
    const nums = JSON.parse(inputData.trim());
    const result = maxSubArray(nums);
    console.log(result);
});
"""
                },
                "test_cases": [
                    {"input": "[-2,1,-3,4,-1,2,1,-5,4]", "expected": "6"},
                    {"input": "[1]", "expected": "1"},
                    {"input": "[5,4,-1,7,8]", "expected": "23"},
                ]
            },
        ]
        
        for i, pdata in enumerate(coding_problems_data):
            problem = CodingProblem(
                id=uuid.uuid4(),
                creator_id=teacher.id,
                title=pdata["title"],
                description=pdata["description"],
                difficulty=pdata["difficulty"],
                subject=pdata["subject"],
                tags=pdata["tags"],
                hints=pdata["hints"],
                points=pdata["points"],
                function_name=pdata.get("function_name", "solution"),
                starter_code=pdata.get("starter_code", {}),
                driver_code=pdata.get("driver_code", {}),
                order_index=i,
                solve_count=0,
                attempt_count=0,
                is_public=True,  # Make visible on explore page
            )
            db.add(problem)
            await db.flush()
            
            for j, tc in enumerate(pdata["test_cases"]):
                test_case = TestCase(
                    id=uuid.uuid4(),
                    problem_id=problem.id,
                    input_data=tc["input"],
                    expected_output=tc["expected"],
                    order_index=j,
                    is_example=True,
                    points=10,
                )
                db.add(test_case)
        
        await db.commit()
        print(f"✅ Seeded {len(sessions_data)} sessions with questions and responses")
        print(f"✅ Seeded {len(misconceptions_data)} misconceptions")
        print(f"✅ Seeded {len(courses_data)} public courses")
        print(f"✅ Seeded {len(coding_problems_data)} coding problems")
        print("✅ Database seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_database())

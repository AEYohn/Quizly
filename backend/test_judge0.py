#!/usr/bin/env python3
"""
Test script for Judge0 integration.

Run this script to verify your Judge0 API key is working:
    python test_judge0.py

Or test with a specific API key:
    JUDGE0_API_KEY=your_key python test_judge0.py
"""

import asyncio
import os
import sys

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.services.judge0_runner import judge0_runner, ExecutionStatus


async def test_health():
    """Test Judge0 API health check."""
    print("=" * 60)
    print("Testing Judge0 Health Check")
    print("=" * 60)

    health = await judge0_runner.health_check()
    print(f"Status: {health.get('status')}")

    if health.get('status') == 'healthy':
        print("✅ Judge0 API is accessible!")
        if 'judge0' in health:
            info = health['judge0']
            print(f"   Version: {info.get('version', 'unknown')}")
            print(f"   Homepage: {info.get('homepage', 'unknown')}")
    else:
        print("❌ Judge0 API is not accessible")
        print(f"   Error: {health.get('error', 'Unknown error')}")
        return False

    return True


async def test_python_execution():
    """Test Python code execution."""
    print("\n" + "=" * 60)
    print("Testing Python Code Execution")
    print("=" * 60)

    code = """
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
"""

    test_cases = [
        {
            "input": '{"nums": [2, 7, 11, 15], "target": 9}',
            "expected_output": "[0, 1]",
            "is_hidden": False
        },
        {
            "input": '{"nums": [3, 2, 4], "target": 6}',
            "expected_output": "[1, 2]",
            "is_hidden": False
        },
        {
            "input": '{"nums": [3, 3], "target": 6}',
            "expected_output": "[0, 1]",
            "is_hidden": False
        }
    ]

    print(f"Running Python two_sum with {len(test_cases)} test cases...")

    result = await judge0_runner.run_code(
        code=code,
        language="python",
        test_cases=test_cases,
        function_name="two_sum"
    )

    print(f"\nOverall Status: {result.status.value}")
    print(f"Passed: {result.passed_count}/{result.total_count}")
    print(f"Total Time: {result.overall_time_ms:.2f}ms")

    for tr in result.test_results:
        status_icon = "✅" if tr.status == ExecutionStatus.PASSED else "❌"
        print(f"\n  Test {tr.test_case_index + 1}: {status_icon} {tr.status.value}")
        print(f"    Input: {tr.input}")
        print(f"    Expected: {tr.expected_output}")
        print(f"    Actual: {tr.actual_output}")
        print(f"    Time: {tr.execution_time_ms:.2f}ms")
        if tr.error_message:
            print(f"    Error: {tr.error_message}")

    return result.status == ExecutionStatus.PASSED


async def test_javascript_execution():
    """Test JavaScript code execution."""
    print("\n" + "=" * 60)
    print("Testing JavaScript Code Execution")
    print("=" * 60)

    code = """
function solution(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (seen.has(complement)) {
            return [seen.get(complement), i];
        }
        seen.set(nums[i], i);
    }
    return [];
}
"""

    test_cases = [
        {
            "input": "[[2, 7, 11, 15], 9]",
            "expected_output": "[0,1]",
            "is_hidden": False
        }
    ]

    print(f"Running JavaScript solution with {len(test_cases)} test case...")

    result = await judge0_runner.run_code(
        code=code,
        language="javascript",
        test_cases=test_cases
    )

    print(f"\nOverall Status: {result.status.value}")
    print(f"Passed: {result.passed_count}/{result.total_count}")

    for tr in result.test_results:
        status_icon = "✅" if tr.status == ExecutionStatus.PASSED else "❌"
        print(f"  Test 1: {status_icon} {tr.status.value}")
        print(f"    Actual: {tr.actual_output}")
        if tr.error_message:
            print(f"    Error: {tr.error_message}")

    return result.passed_count > 0


async def test_error_handling():
    """Test error handling for bad code."""
    print("\n" + "=" * 60)
    print("Testing Error Handling")
    print("=" * 60)

    # Code with syntax error
    code = """
def broken_function(
    return "missing parenthesis"
"""

    test_cases = [{"input": "[]", "expected_output": "test", "is_hidden": False}]

    result = await judge0_runner.run_code(
        code=code,
        language="python",
        test_cases=test_cases
    )

    print(f"Status (should show error): {result.status.value}")
    if result.status in [ExecutionStatus.COMPILATION_ERROR, ExecutionStatus.ERROR, ExecutionStatus.RUNTIME_ERROR]:
        print("✅ Error handling works correctly!")
        return True
    else:
        print("❌ Expected an error status")
        return False


async def main():
    print("\n🚀 Judge0 Integration Test Suite")
    print("=" * 60)

    # Check configuration
    api_key = os.getenv("JUDGE0_API_KEY", "")
    api_url = os.getenv("JUDGE0_API_URL", "https://judge0-ce.p.rapidapi.com")

    print(f"API URL: {api_url}")
    print(f"API Key: {'✅ Configured' if api_key else '❌ Not set!'}")

    if not api_key and "rapidapi" in api_url.lower():
        print("\n⚠️  Warning: JUDGE0_API_KEY is not set!")
        print("   Get a free API key at: https://rapidapi.com/judge0-official/api/judge0-ce")
        print("   Then add it to your .env file: JUDGE0_API_KEY=your_key_here")
        print("\n   For self-hosted Judge0, you can skip the API key.")
        return

    results = []

    # Run tests
    results.append(("Health Check", await test_health()))

    if results[-1][1]:  # Only continue if health check passed
        results.append(("Python Execution", await test_python_execution()))
        results.append(("JavaScript Execution", await test_javascript_execution()))
        results.append(("Error Handling", await test_error_handling()))

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        icon = "✅" if result else "❌"
        print(f"  {icon} {name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed! Judge0 integration is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")


if __name__ == "__main__":
    asyncio.run(main())

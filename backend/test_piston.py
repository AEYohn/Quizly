#!/usr/bin/env python3
"""
Test Piston Code Runner

Verify that Piston is working correctly with the free public API.
No API key required!
"""

import asyncio
import sys
sys.path.insert(0, '.')

from app.services.piston_runner import piston_runner, get_supported_languages


async def test_health():
    """Check if Piston API is accessible."""
    print("=" * 60)
    print("Testing Piston Health Check")
    print("=" * 60)

    result = await piston_runner.health_check()
    print(f"Status: {result.get('status')}")
    if result.get('piston'):
        print(f"API URL: {result['piston'].get('url')}")
        print(f"Languages available: {result['piston'].get('languages_available')}")

    return result.get('status') == 'healthy'


async def test_python_execution():
    """Test Python code execution."""
    print("\n" + "=" * 60)
    print("Testing Python Execution")
    print("=" * 60)

    code = """
def solution(nums):
    return sum(nums)
"""

    test_cases = [
        {"input": "[1, 2, 3]", "expected_output": "6", "is_hidden": False},
        {"input": "[10, 20, 30]", "expected_output": "60", "is_hidden": False},
        {"input": "[]", "expected_output": "0", "is_hidden": False},
    ]

    result = await piston_runner.run_code(
        code=code,
        language="python",
        test_cases=test_cases
    )

    print(f"Overall Status: {result.status.value}")
    print(f"Passed: {result.passed_count}/{result.total_count}")
    print(f"Time: {result.overall_time_ms:.2f}ms")

    for tr in result.test_results:
        status_icon = "✅" if tr.status.value == "passed" else "❌"
        print(f"  {status_icon} Test {tr.test_case_index + 1}: {tr.status.value}")
        if tr.error_message:
            print(f"      Error: {tr.error_message}")

    return result.passed_count == result.total_count


async def test_javascript_execution():
    """Test JavaScript code execution."""
    print("\n" + "=" * 60)
    print("Testing JavaScript Execution")
    print("=" * 60)

    code = """
function solution(nums) {
    return nums.reduce((a, b) => a + b, 0);
}
"""

    test_cases = [
        {"input": "[1, 2, 3, 4]", "expected_output": "10", "is_hidden": False},
        {"input": "[5, 5, 5, 5]", "expected_output": "20", "is_hidden": False},
    ]

    result = await piston_runner.run_code(
        code=code,
        language="javascript",
        test_cases=test_cases
    )

    print(f"Overall Status: {result.status.value}")
    print(f"Passed: {result.passed_count}/{result.total_count}")
    print(f"Time: {result.overall_time_ms:.2f}ms")

    for tr in result.test_results:
        status_icon = "✅" if tr.status.value == "passed" else "❌"
        print(f"  {status_icon} Test {tr.test_case_index + 1}: {tr.status.value}")
        if tr.error_message:
            print(f"      Error: {tr.error_message}")

    return result.passed_count == result.total_count


async def test_error_handling():
    """Test error handling for invalid code."""
    print("\n" + "=" * 60)
    print("Testing Error Handling")
    print("=" * 60)

    # Syntax error
    code = """
def solution(nums):
    return nums[
"""

    result = await piston_runner.run_code(
        code=code,
        language="python",
        test_cases=[{"input": "[1]", "expected_output": "1", "is_hidden": False}]
    )

    print(f"Syntax Error Test: {result.status.value}")
    is_error = result.status.value in ("compilation_error", "error", "runtime_error")
    print(f"  Correctly detected error: {'✅' if is_error else '❌'}")

    return is_error


async def list_runtimes():
    """List available runtimes from Piston."""
    print("\n" + "=" * 60)
    print("Available Runtimes")
    print("=" * 60)

    runtimes = await piston_runner.get_runtimes()

    # Group by language
    languages = {}
    for rt in runtimes:
        lang = rt.get('language', 'unknown')
        version = rt.get('version', 'unknown')
        if lang not in languages:
            languages[lang] = []
        languages[lang].append(version)

    print(f"Total languages: {len(languages)}")
    print("\nSupported by Quizly:")
    for lang in get_supported_languages()[:15]:
        if lang in languages:
            print(f"  ✅ {lang}: {', '.join(languages.get(lang, ['?']))}")


async def main():
    print("\n🚀 PISTON CODE RUNNER TEST")
    print("Free code execution - no API key needed!\n")

    tests = [
        ("Health Check", test_health),
        ("Python Execution", test_python_execution),
        ("JavaScript Execution", test_javascript_execution),
        ("Error Handling", test_error_handling),
    ]

    results = []
    for name, test_fn in tests:
        try:
            passed = await test_fn()
            results.append((name, passed))
        except Exception as e:
            print(f"\n❌ {name} failed with exception: {e}")
            results.append((name, False))

    await list_runtimes()

    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for name, passed in results:
        icon = "✅" if passed else "❌"
        print(f"  {icon} {name}")

    all_passed = all(p for _, p in results)
    print(f"\n{'✅ All tests passed!' if all_passed else '❌ Some tests failed'}")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)

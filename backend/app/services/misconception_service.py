"""
Misconception Service
Async service wrapper for analyzing student misconceptions using AI.
"""

import os
import json
from typing import Dict, Any, Optional, List

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    MODEL = genai.GenerativeModel("gemini-2.0-flash")
else:
    MODEL = None


async def analyze_wrong_answer(
    question: Dict[str, Any],
    student_answer: str,
    student_reasoning: Optional[str],
    correct_answer: str,
    options: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Analyze a wrong answer to identify the specific misconception.

    Args:
        question: Question dict with question_text, options, etc.
        student_answer: The student's wrong answer (e.g., "A")
        student_reasoning: The student's explanation for their choice
        correct_answer: The correct answer
        options: Dict mapping letters to option text (e.g., {"A": "...", "B": "..."})

    Returns:
        Dict with misconception analysis:
        - misconception_type: Specific name (e.g., "definition_confusion")
        - category: conceptual|procedural|careless|incomplete|overconfident|unknown
        - severity: minor|moderate|severe
        - root_cause: Why the student made this error
        - evidence: Quotes from reasoning showing misconception
        - remediation: How to help
        - confidence: 0-1 confidence score
    """
    if not MODEL:
        return _fallback_analysis(student_answer, correct_answer)

    # Get the actual text of options for better analysis
    options = options or question.get("options", {})
    student_answer_text = options.get(student_answer, student_answer)
    correct_answer_text = options.get(correct_answer, correct_answer)

    # Format options for the prompt
    options_text = "\n".join([f"{k}: {v}" for k, v in options.items()]) if options else "Options not available"

    prompt = f"""You are an expert at identifying student misconceptions across any academic subject.

## Question
{question.get('question_text', question.get('prompt', 'N/A'))}

## Options
{options_text}

## Student's Wrong Answer
{student_answer}: {student_answer_text}

## Student's Reasoning
{student_reasoning or 'No reasoning provided'}

## Correct Answer
{correct_answer}: {correct_answer_text}

## Correct Explanation
{question.get('explanation', 'Not provided')}

---

Analyze this wrong answer. Identify the specific misconception the student has.

IMPORTANT:
- Be specific about the misconception type (e.g., "quantifier_flip", "negation_scope_error", "definition_confusion")
- Consider both what the student said AND what answer they chose
- The evidence should be direct quotes from their reasoning

Return JSON:
{{
    "misconception_type": "A specific, descriptive name for this misconception",
    "category": "conceptual|procedural|careless|incomplete|overconfident|unknown",
    "severity": "minor|moderate|severe",
    "description": "One sentence description of the misconception",
    "root_cause": "Why the student likely made this error",
    "evidence": ["quote from reasoning showing misconception"],
    "remediation": "Specific suggestion for how to help this student understand",
    "related_concepts": ["concept1", "concept2"],
    "confidence": 0.0-1.0
}}"""

    try:
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        text = response.text.strip()

        # Parse JSON from response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            return {
                "misconception_type": result.get("misconception_type", "unknown"),
                "category": result.get("category", "unknown"),
                "severity": result.get("severity", "moderate"),
                "description": result.get("description", ""),
                "root_cause": result.get("root_cause", ""),
                "evidence": result.get("evidence", []),
                "remediation": result.get("remediation", ""),
                "related_concepts": result.get("related_concepts", []),
                "confidence": result.get("confidence", 0.5)
            }
    except Exception as e:
        print(f"Misconception analysis error: {e}")

    return _fallback_analysis(student_answer, correct_answer)


def _fallback_analysis(student_answer: str, correct_answer: str) -> Dict[str, Any]:
    """Fallback when LLM is unavailable."""
    return {
        "misconception_type": "analysis_unavailable",
        "category": "unknown",
        "severity": "moderate",
        "description": f"Student answered {student_answer}, correct was {correct_answer}",
        "root_cause": "LLM analysis unavailable",
        "evidence": [],
        "remediation": "Review the question explanation",
        "related_concepts": [],
        "confidence": 0.0
    }


async def get_class_misconception_summary(
    misconceptions: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Aggregate misconceptions across a class to find patterns.

    Args:
        misconceptions: List of misconception analysis results

    Returns:
        Dict with summary:
        - top_misconception_types: Most common misconception types
        - category_distribution: Count by category
        - severity_distribution: Count by severity
        - remediation_suggestions: Top remediation approaches
    """
    if not misconceptions:
        return {
            "total_misconceptions": 0,
            "top_misconception_types": [],
            "category_distribution": {},
            "severity_distribution": {},
            "remediation_suggestions": []
        }

    type_counts: Dict[str, int] = {}
    category_counts: Dict[str, int] = {}
    severity_counts: Dict[str, int] = {}
    remediations: List[str] = []

    for m in misconceptions:
        # Type counts
        mtype = m.get("misconception_type", "unknown")
        type_counts[mtype] = type_counts.get(mtype, 0) + 1

        # Category counts
        cat = m.get("category", "unknown")
        category_counts[cat] = category_counts.get(cat, 0) + 1

        # Severity counts
        sev = m.get("severity", "moderate")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

        # Collect remediations
        if m.get("remediation"):
            remediations.append(m["remediation"])

    # Sort by frequency
    top_types = sorted(type_counts.items(), key=lambda x: -x[1])[:10]

    # Deduplicate remediations
    unique_remediations = list(dict.fromkeys(remediations))[:5]

    return {
        "total_misconceptions": len(misconceptions),
        "top_misconception_types": [{"type": t, "count": c} for t, c in top_types],
        "category_distribution": category_counts,
        "severity_distribution": severity_counts,
        "remediation_suggestions": unique_remediations
    }

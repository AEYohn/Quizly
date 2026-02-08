"""
Discussion Service
Generates AI-powered summaries for peer discussion sessions.
"""

import json
import os
from typing import Any, Dict

from ..db_models_learning import PeerDiscussionSession
from ..utils.llm_utils import GEMINI_MODEL_NAME


async def generate_discussion_summary(
    session: PeerDiscussionSession,
) -> Dict[str, Any]:
    """
    Generate an AI summary of a peer discussion using Gemini.

    Analyzes the discussion transcript and returns structured insights
    including a summary, key insights, misconceptions, learning moments,
    understanding improvement flag, and quality rating.

    Falls back to a heuristic-based summary if Gemini is unavailable.
    """
    try:
        import google.generativeai as genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return fallback_summary(session)

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)

        # Build transcript text
        transcript_text = "\n".join([
            f"{msg.get('sender', 'Unknown')}: {msg.get('content', '')}"
            for msg in (session.transcript or [])
        ])

        prompt = f"""Analyze this peer discussion about a quiz question and provide a detailed summary.

Question: {session.question_text}
Options: {session.question_options}
Correct Answer: {session.correct_answer}
Student's Answer: {session.student_answer} ({"Correct" if session.was_correct else "Incorrect"})
Student's Confidence: {session.student_confidence}%

Discussion Transcript:
{transcript_text}

Provide a JSON response with:
1. "summary": A 2-3 sentence summary of what was discussed and learned
2. "key_insights": Array of 2-3 specific learning insights from the discussion
3. "misconceptions": Array of any misconceptions revealed (empty if none)
4. "learning_moments": Array of moments where understanding improved
5. "understanding_improved": true/false - did the student's understanding improve?
6. "quality": "excellent", "good", "fair", or "poor" - quality of the discussion

Return ONLY valid JSON, no markdown."""

        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Parse JSON response
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        return json.loads(response_text)

    except Exception as e:
        print(f"Gemini summary generation error: {e}")
        return fallback_summary(session)


def fallback_summary(session: PeerDiscussionSession) -> Dict[str, Any]:
    """
    Heuristic-based fallback summary when Gemini AI is not available.

    Uses message counts and participant engagement to estimate
    discussion quality and generate a basic summary.
    """
    message_count = len(session.transcript or [])
    student_messages = [
        m for m in (session.transcript or []) if m.get("sender") == "student"
    ]

    quality = "fair"
    if message_count >= 6 and len(student_messages) >= 3:
        quality = "good"
    if message_count >= 8 and len(student_messages) >= 4:
        quality = "excellent"

    return {
        "summary": (
            f"Student discussed the question with {session.peer_name}. "
            f"The conversation had {message_count} messages exploring the concept."
        ),
        "key_insights": (
            [
                f"Discussed why '{session.student_answer}' was chosen",
                f"The correct answer is '{session.correct_answer}'",
            ]
            if not session.was_correct
            else [
                "Reinforced understanding of the correct answer",
                "Explored reasoning behind the solution",
            ]
        ),
        "misconceptions": (
            [f"Chose '{session.student_answer}' instead of '{session.correct_answer}'"]
            if not session.was_correct
            else []
        ),
        "learning_moments": ["Engaged in peer discussion about the concept"],
        "understanding_improved": message_count >= 4,
        "quality": quality,
    }

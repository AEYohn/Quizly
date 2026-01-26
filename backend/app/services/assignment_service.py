"""
Assignment Service
==================
Generates personalized practice questions for student assignments.
"""

import os
import json
from typing import Dict, List, Any, Optional

import google.generativeai as genai

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class AssignmentService:
    """Generate practice assignments based on student misconceptions."""

    def __init__(self):
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    async def generate_practice_questions(
        self,
        student_name: str,
        misconceptions: List[Dict[str, Any]],
        num_questions: int = 4
    ) -> Dict[str, Any]:
        """
        Generate practice questions based on what the student got wrong.

        Args:
            student_name: Student's name for personalization
            misconceptions: List of {question, wrong_answer, correct_answer, count}
            num_questions: Number of questions to generate

        Returns:
            Dict with title and list of practice questions
        """
        if not misconceptions:
            return {
                "title": "Practice Questions",
                "questions": []
            }

        # Build context from misconceptions
        mistakes_text = "\n".join([
            f"- Question: {m.get('question', '')}\n  Wrong answer: {m.get('wrong_answer')}, Correct: {m.get('correct_answer')}"
            for m in misconceptions[:5]
        ])

        # Identify the main topic from the questions
        topics = [m.get('question', '')[:50] for m in misconceptions[:3]]

        prompt = f"""Generate {num_questions} practice questions for a student who made these mistakes:

{mistakes_text}

The questions should:
1. Target the same concepts the student struggled with
2. Be similar difficulty level
3. Help reinforce the correct understanding
4. Include clear explanations

Return JSON:
{{
    "title": "Practice: [Topic Name]",
    "questions": [
        {{
            "prompt": "Question text",
            "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
            "correct_answer": "A",
            "explanation": "Why this is correct and what the student should understand"
        }}
    ]
}}"""

        try:
            response = await self.model.generate_content_async(
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 1500,
                    "response_mime_type": "application/json"
                }
            )
            result = json.loads(response.text)
            if isinstance(result, list):
                result = result[0] if result else {}
            return result
        except Exception as e:
            print(f"Question generation error: {e}")
            # Fallback: return questions based on the mistakes
            return {
                "title": "Practice Questions",
                "questions": self._generate_fallback_questions(misconceptions)
            }

    def _generate_fallback_questions(
        self,
        misconceptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate simple review questions from the original mistakes."""
        questions = []
        for m in misconceptions[:4]:
            if m.get("question"):
                questions.append({
                    "prompt": f"Review: {m.get('question')}",
                    "options": {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"},
                    "correct_answer": m.get("correct_answer", "A"),
                    "explanation": f"The correct answer is {m.get('correct_answer')}."
                })
        return questions

    async def generate_feedback(
        self,
        questions: List[Dict[str, Any]],
        answers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate feedback after student completes an assignment.

        Args:
            questions: The practice questions
            answers: Student's answers [{question_index, answer}]

        Returns:
            Dict with score, feedback, and per-question results
        """
        correct = 0
        results = []

        for i, q in enumerate(questions):
            student_answer = next(
                (a.get("answer") for a in answers if a.get("question_index") == i),
                None
            )
            is_correct = student_answer == q.get("correct_answer")
            if is_correct:
                correct += 1

            results.append({
                "question_index": i,
                "student_answer": student_answer,
                "correct_answer": q.get("correct_answer"),
                "is_correct": is_correct,
                "explanation": q.get("explanation", "")
            })

        total = len(questions)
        score_percent = (correct / total * 100) if total > 0 else 0

        # Generate overall feedback
        if score_percent >= 80:
            feedback = "Excellent work! You've shown great improvement on these concepts."
        elif score_percent >= 60:
            feedback = "Good progress! Review the explanations for the ones you missed."
        else:
            feedback = "Keep practicing! Review the explanations carefully and try again."

        return {
            "score": correct,
            "total": total,
            "score_percent": round(score_percent, 1),
            "feedback": feedback,
            "results": results
        }


# Singleton instance
assignment_service = AssignmentService()

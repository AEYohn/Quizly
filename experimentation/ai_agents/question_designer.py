"""
Question Designer Agent
Creates individual questions with distractors and explanations.
"""

import os
from typing import Dict, Any, Optional, List

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class QuestionDesigner:
    """
    AI agent that designs individual questions.
    
    Uses Gemini API when available, falls back to mock data for testing.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-1.5-flash")
            except Exception:
                pass
    
    def design_question(
        self,
        concept: str,
        difficulty: float = 0.5,
        question_type: str = "mcq",
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Design a single question.
        
        Args:
            concept: Concept to test
            difficulty: 0.0 (easy) to 1.0 (hard)
            question_type: "mcq" or "short_answer"
            context: Optional context from previous questions
            
        Returns:
            Question dict with prompt, options, correct answer, explanation
        """
        if self.model:
            return self._design_with_gemini(concept, difficulty, question_type, context)
        else:
            return self._design_mock(concept, difficulty, question_type)
    
    def _design_with_gemini(
        self,
        concept: str,
        difficulty: float,
        question_type: str,
        context: Optional[str]
    ) -> Dict[str, Any]:
        """Design question using Gemini API."""
        difficulty_desc = "easy" if difficulty < 0.3 else "medium" if difficulty < 0.7 else "hard"
        
        prompt = f"""You are an expert at creating conceptual questions for peer instruction.

Create a {difficulty_desc} {question_type} question about: {concept}

Requirements:
1. Target common misconceptions students have about this concept
2. Make distractors plausible (based on real student errors)
3. Include a clear explanation of why the correct answer is right
4. Difficulty level: {difficulty:.1f}/1.0

{f'Context from session: {context}' if context else ''}

Respond in JSON format:
{{
    "prompt": "the question text",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct_answer": "A",
    "explanation": "why A is correct and others are wrong",
    "misconceptions_targeted": ["list of misconceptions this tests"]
}}
"""
        try:
            response = self.model.generate_content(prompt)
            import json
            text = response.text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except Exception:
            pass
        
        return self._design_mock(concept, difficulty, question_type)
    
    def _design_mock(
        self,
        concept: str,
        difficulty: float,
        question_type: str
    ) -> Dict[str, Any]:
        """Generate mock question for testing."""
        difficulty_label = "Basic" if difficulty < 0.3 else "Intermediate" if difficulty < 0.7 else "Advanced"
        
        if question_type == "mcq":
            return {
                "prompt": f"[{difficulty_label}] Which of the following best describes {concept}?",
                "options": [
                    f"The correct understanding of {concept}",
                    f"A common misconception about {concept}",
                    f"An overgeneralization of {concept}",
                    f"A confusion with a related concept"
                ],
                "correct_answer": "A",
                "explanation": f"Option A correctly describes {concept}. "
                              f"Option B represents a common misconception where students... "
                              f"Option C overgeneralizes by... "
                              f"Option D confuses this with...",
                "misconceptions_targeted": [
                    f"Misconception 1 about {concept}",
                    f"Misconception 2 about {concept}"
                ]
            }
        else:  # short_answer
            return {
                "prompt": f"[{difficulty_label}] Explain in your own words: {concept}",
                "options": [],
                "correct_answer": f"A complete explanation of {concept} would include...",
                "explanation": f"Key points for {concept}: 1) ... 2) ... 3) ...",
                "misconceptions_targeted": [
                    f"Students often omit the relationship between...",
                    f"Students may conflate {concept} with..."
                ]
            }
    
    def generate_distractors(
        self,
        concept: str,
        correct_answer: str,
        num_distractors: int = 3
    ) -> List[str]:
        """Generate plausible distractors for a correct answer."""
        # Placeholder - would use Gemini to generate realistic wrong answers
        return [
            f"Distractor {i+1}: plausible but incorrect for {concept}"
            for i in range(num_distractors)
        ]

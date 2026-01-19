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
                self.model = genai.GenerativeModel("gemini-2.0-flash")
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
        
        prompt = f"""You are an expert educator creating a peer instruction question.

CONCEPT: {concept}
DIFFICULTY: {difficulty_desc} ({difficulty:.1f}/1.0)
{f'Context from session: {context}' if context else ''}

Create a SPECIFIC, EDUCATIONAL multiple choice question for this concept.

CRITICAL REQUIREMENTS:
1. Questions must have SPECIFIC content - actual details, real scenarios, concrete examples
2. Options must be REAL answers (specific values, TRUE/FALSE about specific claims, concrete choices)
3. At least one distractor should exploit a common misconception about this topic
4. Include detailed explanation for each option

Return ONLY valid JSON:
{{
    "prompt": "A specific, educational question with real content",
    "options": ["A. Specific real option", "B. Specific real option", "C. Specific real option", "D. Specific real option"],
    "correct_answer": "A",
    "explanation": "Detailed explanation of why A is correct and why each wrong option is wrong",
    "misconceptions_targeted": ["misconception1", "misconception2"]
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
        """Fallback when LLM unavailable - returns minimal placeholder."""
        # LLM is required for proper question generation
        # This returns a minimal result indicating the limitation
        difficulty_label = "Basic" if difficulty < 0.3 else "Intermediate" if difficulty < 0.7 else "Advanced"
        
        return {
            "prompt": f"[LLM Required] [{difficulty_label}] Question about {concept}",
            "options": [
                "A. [LLM required for option generation]",
                "B. [LLM required for option generation]", 
                "C. [LLM required for option generation]",
                "D. [LLM required for option generation]"
            ],
            "correct_answer": "A",
            "explanation": f"LLM is required to generate educational content for {concept}.",
            "misconceptions_targeted": [],
            "llm_required": True
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

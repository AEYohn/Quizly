"""
Session Planner Agent
Generates question sequences from topic and concepts.
"""

import os
from typing import List, Dict, Any, Optional

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class SessionPlanner:
    """
    AI agent that generates session plans from topic/concepts.
    
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
    
    def generate_plan(
        self,
        topic: str,
        concepts: List[str],
        time_budget_minutes: int = 30,
        difficulty_curve: str = "gradual"
    ) -> Dict[str, Any]:
        """
        Generate a session plan with question specs.
        
        Args:
            topic: Main topic (e.g., "Newton's Laws")
            concepts: List of concepts to cover
            time_budget_minutes: Total session time
            difficulty_curve: "gradual", "flat", or "challenging"
            
        Returns:
            Session plan dict with questions list
        """
        if self.model:
            return self._generate_with_gemini(
                topic, concepts, time_budget_minutes, difficulty_curve
            )
        else:
            return self._generate_mock(
                topic, concepts, time_budget_minutes, difficulty_curve
            )
    
    def _generate_with_gemini(
        self,
        topic: str,
        concepts: List[str],
        time_budget_minutes: int,
        difficulty_curve: str
    ) -> Dict[str, Any]:
        """Generate plan using Gemini API."""
        prompt = f"""You are an expert educator designing a peer-instruction session.

Topic: {topic}
Concepts to cover: {', '.join(concepts)}
Time budget: {time_budget_minutes} minutes
Difficulty curve: {difficulty_curve}

Generate a session plan with 5-8 conceptual questions. For each question, provide:
1. concept: which concept it tests
2. difficulty: 0.0 (easy) to 1.0 (hard)
3. type: "mcq" or "short_answer"
4. target_time_seconds: time to allocate
5. question_prompt: the actual question
6. options: 4 answer choices (for MCQ)
7. correct_answer: the correct option
8. explanation: why the correct answer is right

Respond in valid JSON format with a "questions" array.
"""
        try:
            response = self.model.generate_content(prompt)
            # Parse JSON response (simplified - real implementation would be more robust)
            import json
            text = response.text
            # Extract JSON from response
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except Exception:
            pass
        
        # Fall back to mock on error
        return self._generate_mock(topic, concepts, time_budget_minutes, difficulty_curve)
    
    def _generate_mock(
        self,
        topic: str,
        concepts: List[str],
        time_budget_minutes: int,
        difficulty_curve: str
    ) -> Dict[str, Any]:
        """Fallback when LLM unavailable - returns minimal placeholder."""
        # LLM is required for proper session planning
        # This returns a minimal result indicating the limitation
        questions = []
        
        for i, concept in enumerate(concepts):
            questions.append({
                "concept": concept,
                "difficulty": 0.5,
                "type": "mcq",
                "target_time_seconds": (time_budget_minutes * 60) // max(len(concepts), 1),
                "question_prompt": f"[LLM Required] Question about {concept}",
                "options": [
                    "[LLM required for option generation]",
                    "[LLM required for option generation]",
                    "[LLM required for option generation]", 
                    "[LLM required for option generation]"
                ],
                "correct_answer": "A",
                "explanation": f"LLM is required to generate educational content for {concept}.",
                "llm_required": True
            })
        
        return {
            "topic": topic,
            "concepts": concepts,
            "time_budget_minutes": time_budget_minutes,
            "questions": questions,
            "llm_required": True
        }

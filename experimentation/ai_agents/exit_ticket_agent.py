"""
Exit Ticket Agent
Generates personalized end-of-session micro-lessons and questions.
"""

import os
from typing import Dict, Any, Optional, List

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class ExitTicketAgent:
    """
    AI agent that generates personalized exit tickets.
    
    Analyzes student performance to create targeted micro-lessons
    focusing on each student's weakest concepts.
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
    
    def generate_exit_ticket(
        self,
        student_id: int,
        session_responses: List[Dict[str, Any]],
        concepts: List[str]
    ) -> Dict[str, Any]:
        """
        Generate a personalized exit ticket for a student.
        
        Args:
            student_id: Student identifier
            session_responses: List of student's responses from the session
            concepts: List of concepts covered
            
        Returns:
            Exit ticket with micro-lesson and follow-up question
        """
        # Analyze weakest concept
        weakest = self._find_weakest_concept(session_responses, concepts)
        
        if self.model:
            return self._generate_with_gemini(student_id, weakest, session_responses)
        else:
            return self._generate_mock(student_id, weakest)
    
    def _find_weakest_concept(
        self,
        responses: List[Dict[str, Any]],
        concepts: List[str]
    ) -> Dict[str, Any]:
        """Identify the student's weakest concept from session responses."""
        concept_performance = {c: {"correct": 0, "total": 0} for c in concepts}
        
        for resp in responses:
            concept = resp.get("concept", "")
            if concept in concept_performance:
                concept_performance[concept]["total"] += 1
                if resp.get("is_correct", False):
                    concept_performance[concept]["correct"] += 1
        
        # Find concept with lowest accuracy
        weakest_concept = None
        lowest_accuracy = 1.0
        
        for concept, stats in concept_performance.items():
            if stats["total"] > 0:
                accuracy = stats["correct"] / stats["total"]
                if accuracy < lowest_accuracy:
                    lowest_accuracy = accuracy
                    weakest_concept = concept
        
        return {
            "concept": weakest_concept or (concepts[0] if concepts else "general"),
            "accuracy": lowest_accuracy,
            "attempts": concept_performance.get(weakest_concept, {}).get("total", 0)
        }
    
    def _generate_with_gemini(
        self,
        student_id: int,
        weakest: Dict[str, Any],
        responses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate exit ticket using Gemini API."""
        concept = weakest["concept"]
        accuracy = weakest["accuracy"]
        
        prompt = f"""Create a personalized exit ticket for a student who struggled with: {concept}
        
Their accuracy on this concept was {accuracy:.0%}.

Create:
1. A brief, encouraging micro-lesson (2-3 sentences) that addresses common misconceptions
2. One follow-up question to check understanding
3. A hint to help if they get stuck

Respond in JSON format:
{{
    "micro_lesson": "brief explanation...",
    "question": {{
        "prompt": "...",
        "options": ["A...", "B...", "C...", "D..."],
        "correct_answer": "B",
        "hint": "Think about..."
    }},
    "encouragement": "You're making progress on..."
}}
"""
        try:
            response = self.model.generate_content(prompt)
            import json
            text = response.text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                result["student_id"] = student_id
                result["target_concept"] = concept
                return result
        except Exception:
            pass
        
        return self._generate_mock(student_id, weakest)
    
    def _generate_mock(
        self,
        student_id: int,
        weakest: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate mock exit ticket for testing."""
        concept = weakest["concept"]
        accuracy = weakest["accuracy"]
        
        encouragement = (
            "Great job today!" if accuracy > 0.5 
            else "Keep practicing - you're getting there!" if accuracy > 0.25
            else "Don't worry, this concept takes time to master."
        )
        
        return {
            "student_id": student_id,
            "target_concept": concept,
            "micro_lesson": f"Let's review {concept}. The key idea is that... "
                           f"A common mistake is thinking that..., but actually...",
            "question": {
                "prompt": f"Based on what you just learned about {concept}, which statement is true?",
                "options": [
                    f"Correct understanding of {concept}",
                    f"Common misconception about {concept}",
                    f"Another misconception",
                    f"Unrelated concept"
                ],
                "correct_answer": "A",
                "hint": f"Remember the key principle of {concept} we just reviewed."
            },
            "encouragement": encouragement,
            "performance_summary": {
                "concept": concept,
                "session_accuracy": accuracy,
                "recommendation": "Review this concept before next class"
            }
        }
    
    def batch_generate(
        self,
        student_responses: Dict[int, List[Dict[str, Any]]],
        concepts: List[str]
    ) -> List[Dict[str, Any]]:
        """Generate exit tickets for multiple students."""
        tickets = []
        for student_id, responses in student_responses.items():
            ticket = self.generate_exit_ticket(student_id, responses, concepts)
            tickets.append(ticket)
        return tickets

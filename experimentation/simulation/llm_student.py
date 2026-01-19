"""
LLM-Powered Student Model
Uses Gemini API to generate realistic student responses and rationales.
"""

import os
import json
import random
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class LLMStudent:
    """
    AI-powered student that uses Gemini to generate realistic responses.
    
    Models student behavior including:
    - Concept-specific mastery levels
    - Common misconceptions
    - Realistic rationales for answers
    - Learning from peer discussion
    """
    
    id: int
    name: str
    mastery: Dict[str, float] = field(default_factory=dict)  # concept -> mastery (0-1)
    misconceptions: List[str] = field(default_factory=list)  # Active misconceptions
    personality: str = "average"  # "struggling", "average", "advanced", "overconfident"
    
    _model: Any = field(default=None, repr=False)
    _api_key: Optional[str] = field(default=None, repr=False)
    
    def __post_init__(self):
        self._api_key = os.getenv("GEMINI_API_KEY")
        if GEMINI_AVAILABLE and self._api_key:
            try:
                genai.configure(api_key=self._api_key)
                self._model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception:
                self._model = None
    
    def answer_question(
        self,
        question: Dict[str, Any],
        use_llm: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a response to a question.
        
        Args:
            question: Dict with prompt, options, concept, difficulty
            use_llm: Whether to use LLM for response generation
            
        Returns:
            Response dict with answer, confidence, rationale, is_correct
        """
        concept = question.get("concept", "unknown")
        difficulty = question.get("difficulty", 0.5)
        options = question.get("options", ["A", "B", "C", "D"])
        correct_answer = question.get("correct_answer", "A")
        
        # Get mastery for this concept
        concept_mastery = self.mastery.get(concept, 0.5)
        
        # Calculate probability of correct answer
        p_correct = self._calculate_p_correct(concept_mastery, difficulty)
        is_correct = random.random() < p_correct
        
        # Select answer
        if is_correct:
            answer = correct_answer
        else:
            wrong_options = [o for o in options if o != correct_answer]
            answer = random.choice(wrong_options) if wrong_options else options[0]
        
        # Generate confidence
        confidence = self._generate_confidence(concept_mastery, is_correct)
        
        # Generate rationale using LLM or fallback
        if use_llm and self._model:
            rationale = self._generate_llm_rationale(question, answer, is_correct)
        else:
            rationale = self._generate_simple_rationale(concept, answer, is_correct)
        
        return {
            "student_id": self.id,
            "student_name": self.name,
            "answer": answer,
            "confidence": round(confidence, 2),
            "is_correct": is_correct,
            "rationale": rationale,
            "concept_mastery": round(concept_mastery, 2)
        }
    
    def _calculate_p_correct(self, mastery: float, difficulty: float) -> float:
        """Calculate probability of correct answer."""
        # Base probability from mastery vs difficulty
        base_p = mastery - (difficulty - 0.5) * 0.5
        
        # Personality adjustments
        if self.personality == "struggling":
            base_p -= 0.1
        elif self.personality == "advanced":
            base_p += 0.15
        elif self.personality == "overconfident":
            base_p -= 0.05  # Slightly worse due to rushing
        
        return max(0.05, min(0.95, base_p))
    
    def _generate_confidence(self, mastery: float, is_correct: bool) -> float:
        """Generate self-reported confidence."""
        base_conf = mastery + random.gauss(0, 0.1)
        
        if self.personality == "overconfident":
            base_conf += 0.2
        elif self.personality == "struggling":
            base_conf -= 0.1
        
        # Slight correlation with correctness
        if is_correct:
            base_conf += 0.05
        
        return max(0.1, min(1.0, base_conf))
    
    def _generate_llm_rationale(
        self,
        question: Dict[str, Any],
        answer: str,
        is_correct: bool
    ) -> str:
        """Generate realistic rationale using Gemini."""
        concept = question.get("concept", "unknown")
        prompt_text = question.get("prompt", question.get("question_prompt", ""))
        
        persona_desc = {
            "struggling": "You struggle with this topic and often get confused",
            "average": "You have moderate understanding of this topic",
            "advanced": "You have strong understanding of this topic",
            "overconfident": "You think you understand well but sometimes miss nuances"
        }
        
        if is_correct:
            outcome = "Your answer is correct."
        else:
            outcome = f"Your answer is INCORRECT. You have a misconception about {concept}."
        
        prompt = f"""You are a college student in a CS 70 (Discrete Math) class.
        
Personality: {persona_desc.get(self.personality, 'average student')}
Your current mastery of {concept}: {self.mastery.get(concept, 0.5):.0%}

Question: {prompt_text}
Your answer: {answer}
{outcome}

Write a 1-2 sentence rationale explaining your thinking. If incorrect, show the misconception naturally (don't say "I have a misconception"). Be authentic to a student's voice.
"""
        try:
            response = self._model.generate_content(prompt)
            return response.text.strip()[:200]  # Limit length
        except Exception:
            return self._generate_simple_rationale(concept, answer, is_correct)
    
    def _generate_simple_rationale(
        self,
        concept: str,
        answer: str,
        is_correct: bool
    ) -> str:
        """Fallback simple rationale generation."""
        if is_correct:
            return f"I applied my understanding of {concept} to arrive at {answer}."
        else:
            return f"I think it's {answer} based on what I remember about {concept}."
    
    def learn_from_discussion(
        self,
        concept: str,
        correct_explanation: str,
        peer_rationales: List[str]
    ) -> float:
        """
        Update mastery after peer discussion.
        
        Returns the mastery delta.
        """
        current_mastery = self.mastery.get(concept, 0.5)
        
        # Learning rate based on personality
        learning_rates = {
            "struggling": 0.08,
            "average": 0.12,
            "advanced": 0.05,  # Already knows most
            "overconfident": 0.10
        }
        lr = learning_rates.get(self.personality, 0.1)
        
        # Simulate learning from discussion
        # More peers with correct understanding = more learning
        learning_signal = 0.15 + random.gauss(0, 0.05)
        
        delta = lr * learning_signal * (1 - current_mastery)  # Diminishing returns
        new_mastery = min(1.0, current_mastery + delta)
        
        self.mastery[concept] = new_mastery
        return delta
    
    def update_mastery(self, concept: str, delta: float):
        """Direct mastery update."""
        current = self.mastery.get(concept, 0.5)
        self.mastery[concept] = max(0.0, min(1.0, current + delta))


def generate_llm_students(
    n: int,
    concepts: List[str],
    distribution: str = "realistic"
) -> List[LLMStudent]:
    """
    Generate a cohort of LLM-powered students.
    
    Args:
        n: Number of students
        concepts: List of concepts to assign mastery
        distribution: "realistic", "bimodal", "uniform", "struggling"
        
    Returns:
        List of LLMStudent instances
    """
    students = []
    
    # Personality distribution based on class type
    if distribution == "struggling":
        personalities = ["struggling"] * 6 + ["average"] * 3 + ["overconfident"] * 1
    elif distribution == "bimodal":
        personalities = ["struggling"] * 4 + ["advanced"] * 4 + ["average"] * 2
    else:  # realistic
        personalities = ["struggling"] * 2 + ["average"] * 5 + ["advanced"] * 2 + ["overconfident"] * 1
    
    for i in range(n):
        personality = random.choice(personalities)
        
        # Base mastery by personality
        if personality == "struggling":
            base = random.gauss(0.35, 0.1)
        elif personality == "advanced":
            base = random.gauss(0.75, 0.1)
        elif personality == "overconfident":
            base = random.gauss(0.5, 0.15)
        else:  # average
            base = random.gauss(0.55, 0.12)
        
        base = max(0.1, min(0.9, base))
        
        # Per-concept variation
        mastery = {}
        for concept in concepts:
            variation = random.gauss(0, 0.1)
            mastery[concept] = max(0.1, min(0.9, base + variation))
        
        student = LLMStudent(
            id=i + 1,
            name=f"Student_{i + 1}",
            mastery=mastery,
            misconceptions=[],
            personality=personality
        )
        students.append(student)
    
    return students

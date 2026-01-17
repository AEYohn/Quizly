"""
Simulated Student Model
Models student behavior for testing adaptive algorithms.
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class SimulatedStudent:
    """A simulated student with concept mastery levels."""
    
    id: int
    name: str
    mastery: Dict[str, float] = field(default_factory=dict)  # concept -> mastery (0-1)
    response_variance: float = 0.1  # noise in responses
    confidence_bias: float = 0.0  # positive = overconfident
    
    def answer_question(
        self, 
        concept: str, 
        difficulty: float,
        options: Optional[List[str]] = None
    ) -> Dict:
        """
        Simulate answering a question.
        
        Returns dict with:
        - answer: selected option or answer
        - confidence: self-reported confidence (0-1)
        - is_correct: whether answer is correct
        - rationale: optional reasoning
        """
        # Get mastery for this concept (default 0.5 if not seen)
        concept_mastery = self.mastery.get(concept, 0.5)
        
        # Probability of correct answer based on mastery and difficulty
        # Higher mastery + lower difficulty = higher P(correct)
        p_correct = np.clip(
            concept_mastery - (difficulty - 0.5) + np.random.normal(0, self.response_variance),
            0.05, 0.95
        )
        
        is_correct = np.random.random() < p_correct
        
        # Generate confidence (correlated with mastery but with bias)
        base_confidence = concept_mastery + self.confidence_bias
        confidence = np.clip(
            base_confidence + np.random.normal(0, 0.15),
            0.1, 1.0
        )
        
        # Select answer
        if options:
            if is_correct:
                answer = options[0]  # First option is correct by convention
            else:
                # Pick a random wrong answer
                wrong_options = options[1:] if len(options) > 1 else options
                answer = np.random.choice(wrong_options)
        else:
            answer = "correct" if is_correct else "incorrect"
        
        return {
            "student_id": self.id,
            "answer": answer,
            "confidence": round(confidence, 2),
            "is_correct": is_correct,
            "rationale": self._generate_rationale(concept, is_correct)
        }
    
    def _generate_rationale(self, concept: str, is_correct: bool) -> str:
        """Generate a simple rationale (placeholder)."""
        if is_correct:
            return f"Applied understanding of {concept}"
        else:
            return f"Confused about {concept}"
    
    def update_mastery(self, concept: str, delta: float):
        """Update mastery after learning."""
        current = self.mastery.get(concept, 0.5)
        self.mastery[concept] = np.clip(current + delta, 0.0, 1.0)


def generate_students(
    n: int,
    concepts: List[str],
    distribution: str = "normal"
) -> List[SimulatedStudent]:
    """
    Generate a cohort of simulated students.
    
    Args:
        n: Number of students
        concepts: List of concepts to assign mastery
        distribution: "normal", "bimodal", or "uniform"
    
    Returns:
        List of SimulatedStudent instances
    """
    students = []
    
    for i in range(n):
        # Generate mastery distribution
        if distribution == "normal":
            # Bell curve around 0.5
            base_mastery = np.clip(np.random.normal(0.5, 0.2), 0.1, 0.9)
        elif distribution == "bimodal":
            # Two clusters: struggling (0.3) and proficient (0.7)
            cluster = np.random.choice([0.3, 0.7], p=[0.4, 0.6])
            base_mastery = np.clip(np.random.normal(cluster, 0.1), 0.1, 0.9)
        else:  # uniform
            base_mastery = np.random.uniform(0.1, 0.9)
        
        # Add per-concept variation
        mastery = {}
        for concept in concepts:
            concept_offset = np.random.normal(0, 0.1)
            mastery[concept] = np.clip(base_mastery + concept_offset, 0.1, 0.9)
        
        student = SimulatedStudent(
            id=i + 1,
            name=f"Student_{i + 1}",
            mastery=mastery,
            response_variance=np.random.uniform(0.05, 0.15),
            confidence_bias=np.random.uniform(-0.1, 0.2)
        )
        students.append(student)
    
    return students

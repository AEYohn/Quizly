#!/usr/bin/env python3
"""
Adaptive Difficulty Engine
===========================
Dynamically adjusts question difficulty based on class performance.
Selects optimal next questions to maximize learning.
"""

import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import math


@dataclass
class DifficultyAdjustment:
    """Record of a difficulty adjustment."""
    timestamp: str
    current_difficulty: float
    class_accuracy: float
    adjustment: float
    new_difficulty: float
    reason: str


@dataclass
class QuestionSelection:
    """Result of question selection."""
    selected_question: Dict[str, Any]
    selection_reason: str
    target_difficulty: float
    actual_difficulty: float
    prioritized_concepts: List[str]


class AdaptiveDifficultyEngine:
    """
    Engine for adaptive question selection based on class performance.
    
    Key features:
    - Adjusts difficulty toward target accuracy (default 60%)
    - Prioritizes weak concepts
    - Avoids question repetition
    - Tracks difficulty history
    """
    
    def __init__(
        self,
        target_accuracy: float = 0.6,
        adjustment_rate: float = 0.15,
        min_difficulty: float = 0.1,
        max_difficulty: float = 0.95
    ):
        self.target_accuracy = target_accuracy
        self.adjustment_rate = adjustment_rate
        self.min_difficulty = min_difficulty
        self.max_difficulty = max_difficulty
        
        self.current_difficulty = 0.5
        self.adjustment_history: List[DifficultyAdjustment] = []
        self.asked_questions: set = set()  # Question IDs already asked
        self.concept_accuracy: Dict[str, List[float]] = {}  # Concept -> [accuracies]
    
    def update_after_question(
        self,
        question: Dict[str, Any],
        class_accuracy: float
    ) -> DifficultyAdjustment:
        """
        Update difficulty after a question based on class accuracy.
        
        Args:
            question: The question that was just asked
            class_accuracy: Proportion of students who got it correct (0-1)
            
        Returns:
            DifficultyAdjustment record
        """
        # Track this question
        q_id = question.get("id", str(hash(question.get("prompt", ""))))
        self.asked_questions.add(q_id)
        
        # Track concept accuracy
        concept = question.get("concept", "unknown")
        if concept not in self.concept_accuracy:
            self.concept_accuracy[concept] = []
        self.concept_accuracy[concept].append(class_accuracy)
        
        # Calculate adjustment
        old_difficulty = self.current_difficulty
        
        if class_accuracy > 0.8:
            # Too easy - increase difficulty
            adjustment = self.adjustment_rate * (class_accuracy - self.target_accuracy)
            reason = "Increasing difficulty: class accuracy too high"
        elif class_accuracy < 0.3:
            # Too hard - decrease difficulty
            adjustment = -self.adjustment_rate * (self.target_accuracy - class_accuracy)
            reason = "Decreasing difficulty: class accuracy too low"
        else:
            # Near target - small adjustment toward optimal
            gap = class_accuracy - self.target_accuracy
            adjustment = self.adjustment_rate * 0.5 * gap
            reason = "Fine-tuning difficulty toward target range"
        
        # Apply adjustment with bounds
        self.current_difficulty = max(
            self.min_difficulty,
            min(self.max_difficulty, self.current_difficulty + adjustment)
        )
        
        record = DifficultyAdjustment(
            timestamp=datetime.now().isoformat(),
            current_difficulty=old_difficulty,
            class_accuracy=class_accuracy,
            adjustment=adjustment,
            new_difficulty=self.current_difficulty,
            reason=reason
        )
        
        self.adjustment_history.append(record)
        return record
    
    def get_target_difficulty(self) -> float:
        """Get current target difficulty level."""
        return self.current_difficulty
    
    def get_weak_concepts(self, threshold: float = 0.5) -> List[Tuple[str, float]]:
        """
        Get concepts where students are struggling.
        
        Args:
            threshold: Accuracy below this is considered weak
            
        Returns:
            List of (concept, avg_accuracy) sorted by accuracy ascending
        """
        weak = []
        for concept, accuracies in self.concept_accuracy.items():
            avg = sum(accuracies) / len(accuracies)
            if avg < threshold:
                weak.append((concept, avg))
        
        return sorted(weak, key=lambda x: x[1])
    
    def select_next_question(
        self,
        available_questions: List[Dict[str, Any]],
        prioritize_weak_concepts: bool = True,
        difficulty_tolerance: float = 0.2
    ) -> Optional[QuestionSelection]:
        """
        Select the optimal next question.
        
        Selection criteria:
        1. Not already asked
        2. Difficulty close to target
        3. Prioritize weak concepts if enabled
        
        Args:
            available_questions: Pool of questions to choose from
            prioritize_weak_concepts: Whether to prioritize weak areas
            difficulty_tolerance: How far from target difficulty is acceptable
            
        Returns:
            QuestionSelection with chosen question and reasoning
        """
        if not available_questions:
            return None
        
        # Filter out already-asked questions
        candidates = []
        for q in available_questions:
            q_id = q.get("id", str(hash(q.get("prompt", ""))))
            if q_id not in self.asked_questions:
                candidates.append(q)
        
        if not candidates:
            # All questions asked - reset and allow repeats
            self.asked_questions.clear()
            candidates = available_questions
        
        # Get weak concepts
        weak_concepts = [c for c, _ in self.get_weak_concepts()]
        
        # Score each candidate
        scored = []
        for q in candidates:
            score = 0.0
            reasons = []
            
            q_difficulty = q.get("difficulty", 0.5)
            q_concept = q.get("concept", "unknown")
            
            # Difficulty match (0-40 points)
            diff_gap = abs(q_difficulty - self.current_difficulty)
            if diff_gap <= difficulty_tolerance:
                diff_score = 40 * (1 - diff_gap / difficulty_tolerance)
                score += diff_score
                reasons.append(f"Good difficulty match ({q_difficulty:.0%} vs target {self.current_difficulty:.0%})")
            
            # Weak concept priority (0-40 points)
            if prioritize_weak_concepts and q_concept in weak_concepts:
                concept_rank = weak_concepts.index(q_concept)
                concept_score = 40 * (1 - concept_rank / max(len(weak_concepts), 1))
                score += concept_score
                reasons.append(f"Targets weak concept: {q_concept}")
            
            # Variety bonus (0-20 points)
            variety_score = random.uniform(0, 20)
            score += variety_score
            
            scored.append((q, score, reasons))
        
        # Select best candidate
        scored.sort(key=lambda x: -x[1])
        best_question, best_score, best_reasons = scored[0]
        
        return QuestionSelection(
            selected_question=best_question,
            selection_reason="; ".join(best_reasons),
            target_difficulty=self.current_difficulty,
            actual_difficulty=best_question.get("difficulty", 0.5),
            prioritized_concepts=weak_concepts[:3]
        )
    
    def get_difficulty_trajectory(self) -> List[Dict[str, Any]]:
        """Get history of difficulty adjustments for visualization."""
        return [
            {
                "timestamp": adj.timestamp,
                "difficulty": adj.new_difficulty,
                "accuracy": adj.class_accuracy,
                "reason": adj.reason
            }
            for adj in self.adjustment_history
        ]
    
    def reset(self):
        """Reset engine state for a new session."""
        self.current_difficulty = 0.5
        self.adjustment_history.clear()
        self.asked_questions.clear()
        self.concept_accuracy.clear()
    
    def get_session_stats(self) -> Dict[str, Any]:
        """Get summary statistics for the session."""
        if not self.adjustment_history:
            return {"status": "No questions asked yet"}
        
        accuracies = [adj.class_accuracy for adj in self.adjustment_history]
        difficulties = [adj.new_difficulty for adj in self.adjustment_history]
        
        return {
            "questions_asked": len(self.adjustment_history),
            "avg_accuracy": sum(accuracies) / len(accuracies),
            "min_accuracy": min(accuracies),
            "max_accuracy": max(accuracies),
            "starting_difficulty": self.adjustment_history[0].current_difficulty,
            "current_difficulty": self.current_difficulty,
            "difficulty_range": (min(difficulties), max(difficulties)),
            "weak_concepts": self.get_weak_concepts(threshold=0.5)
        }


# Singleton instance
adaptive_engine = AdaptiveDifficultyEngine()

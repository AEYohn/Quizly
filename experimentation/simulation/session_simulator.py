"""
Session Simulator
Runs simulated classroom sessions with synthetic student responses.
"""

import numpy as np
from typing import List, Dict, Any
from dataclasses import dataclass

from .student_model import SimulatedStudent


@dataclass
class SessionSimulator:
    """Simulates a classroom session with synthetic responses."""
    
    students: List[SimulatedStudent]
    discussion_threshold: tuple = (0.3, 0.7)  # Trigger discussion if correctness in this range
    
    def run_session(self, session_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run a full session simulation.
        
        Args:
            session_plan: Dict with 'questions' list from SessionPlanner
            
        Returns:
            Results dict with per-question metrics
        """
        questions = session_plan.get("questions", [])
        results = {"questions": [], "summary": {}}
        
        total_correct = 0
        total_responses = 0
        
        for q in questions:
            q_result = self._simulate_question(q)
            results["questions"].append(q_result)
            
            total_correct += q_result["correctness_rate"] * len(self.students)
            total_responses += len(self.students)
        
        # Session summary
        results["summary"] = {
            "total_questions": len(questions),
            "total_students": len(self.students),
            "overall_correctness": total_correct / max(total_responses, 1),
            "discussions_triggered": sum(
                1 for q in results["questions"] 
                if q["action_taken"] == "discuss"
            )
        }
        
        return results
    
    def _simulate_question(self, question: Dict[str, Any]) -> Dict[str, Any]:
        """Simulate responses for a single question."""
        concept = question.get("concept", "unknown")
        difficulty = question.get("difficulty", 0.5)
        options = question.get("options", ["A", "B", "C", "D"])
        
        # Collect responses from all students
        responses = []
        for student in self.students:
            response = student.answer_question(concept, difficulty, options)
            responses.append(response)
        
        # Calculate metrics
        correctness_rate = sum(1 for r in responses if r["is_correct"]) / len(responses)
        avg_confidence = sum(r["confidence"] for r in responses) / len(responses)
        entropy = self._calculate_entropy(responses, options)
        
        # Determine recommended action
        recommended_action = self._get_recommended_action(correctness_rate)
        
        # Simulate what action was taken (may differ from recommended)
        action_taken = recommended_action  # For now, always follow recommendation
        
        return {
            "concept": concept,
            "difficulty": difficulty,
            "correctness_rate": round(correctness_rate, 3),
            "avg_confidence": round(avg_confidence, 3),
            "entropy": round(entropy, 3),
            "recommended_action": recommended_action,
            "action_taken": action_taken,
            "response_count": len(responses),
            "responses": responses  # Include raw responses for debugging
        }
    
    def _calculate_entropy(
        self, 
        responses: List[Dict], 
        options: List[str]
    ) -> float:
        """Calculate Shannon entropy of response distribution."""
        if not responses or not options:
            return 0.0
        
        # Count responses per option
        counts = {opt: 0 for opt in options}
        for r in responses:
            answer = r.get("answer", "")
            if answer in counts:
                counts[answer] += 1
        
        # Calculate entropy
        total = len(responses)
        entropy = 0.0
        for count in counts.values():
            if count > 0:
                p = count / total
                entropy -= p * np.log2(p)
        
        # Normalize by max entropy (uniform distribution)
        max_entropy = np.log2(len(options))
        return entropy / max_entropy if max_entropy > 0 else 0.0
    
    def _get_recommended_action(self, correctness_rate: float) -> str:
        """Determine recommended action based on correctness rate."""
        low, high = self.discussion_threshold
        
        if correctness_rate < low:
            return "remediate"  # Too hard, need simpler question
        elif correctness_rate > high:
            return "move_on"  # Too easy, proceed
        else:
            return "discuss"  # In the productive zone for peer discussion

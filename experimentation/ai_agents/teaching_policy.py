"""
Adaptive Teaching Policy Agent
AI-driven decision making for classroom instruction.
"""

import os
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class TeachingAction(Enum):
    """Possible teaching actions."""
    ASK_QUESTION = "ask_question"
    EXPLAIN_CONCEPT = "explain_concept"
    PEER_DISCUSSION = "peer_discussion"
    REMEDIATE = "remediate"
    MOVE_ON = "move_on"
    GIVE_HINT = "give_hint"
    SHOW_EXAMPLE = "show_example"


@dataclass
class TeachingPolicy:
    """
    AI teaching policy that decides optimal next actions.
    
    Adapts based on:
    - Real-time response distributions
    - Confidence levels
    - Historical performance on concepts
    """
    
    name: str = "adaptive"
    discussion_threshold: tuple = (0.30, 0.70)  # Correctness range for peer discussion
    confidence_threshold: float = 0.5
    
    _model: Any = field(default=None, repr=False)
    _history: List[Dict] = field(default_factory=list, repr=False)
    
    def __post_init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if GEMINI_AVAILABLE and api_key:
            try:
                genai.configure(api_key=api_key)
                self._model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception:
                self._model = None
    
    def decide_action(
        self,
        question_result: Dict[str, Any],
        session_context: Optional[Dict] = None,
        use_llm: bool = True
    ) -> Dict[str, Any]:
        """
        Decide the next teaching action based on response data.
        
        Args:
            question_result: Results from the current question
            session_context: Optional context about the session
            use_llm: Whether to use LLM for decision
            
        Returns:
            Action dict with action type and parameters
        """
        correctness = question_result.get("correctness_rate", 0.5)
        avg_confidence = question_result.get("avg_confidence", 0.5)
        concept = question_result.get("concept", "unknown")
        entropy = question_result.get("entropy", 0.5)
        
        # Record history
        self._history.append({
            "concept": concept,
            "correctness": correctness,
            "confidence": avg_confidence,
            "entropy": entropy
        })
        
        if use_llm and self._model:
            return self._decide_with_llm(question_result, session_context)
        else:
            return self._decide_rule_based(question_result)
    
    def _decide_rule_based(self, question_result: Dict) -> Dict[str, Any]:
        """Rule-based decision making."""
        correctness = question_result.get("correctness_rate", 0.5)
        avg_confidence = question_result.get("avg_confidence", 0.5)
        entropy = question_result.get("entropy", 0.5)
        concept = question_result.get("concept", "unknown")
        
        low_thresh, high_thresh = self.discussion_threshold
        
        # Low correctness -> remediate
        if correctness < low_thresh:
            return {
                "action": TeachingAction.REMEDIATE,
                "reason": f"Only {correctness:.0%} correct - need simpler explanation",
                "parameters": {
                    "concept": concept,
                    "approach": "simplify"
                }
            }
        
        # High correctness -> move on
        if correctness > high_thresh:
            return {
                "action": TeachingAction.MOVE_ON,
                "reason": f"{correctness:.0%} correct - class understands, proceed",
                "parameters": {
                    "concept": concept,
                    "next_difficulty": "increase"
                }
            }
        
        # In discussion zone - check entropy
        if entropy > 0.6:
            # High disagreement -> peer discussion valuable
            return {
                "action": TeachingAction.PEER_DISCUSSION,
                "reason": f"Split responses (entropy {entropy:.2f}) - peer discussion optimal",
                "parameters": {
                    "concept": concept,
                    "strategy": "pair_confident_with_uncertain"
                }
            }
        else:
            # Low entropy but moderate correctness -> give hint
            return {
                "action": TeachingAction.GIVE_HINT,
                "reason": f"Moderate correctness ({correctness:.0%}) with consensus - hint needed",
                "parameters": {
                    "concept": concept,
                    "hint_type": "address_misconception"
                }
            }
    
    def _decide_with_llm(
        self,
        question_result: Dict,
        session_context: Optional[Dict]
    ) -> Dict[str, Any]:
        """LLM-powered decision making."""
        correctness = question_result.get("correctness_rate", 0.5)
        avg_confidence = question_result.get("avg_confidence", 0.5)
        entropy = question_result.get("entropy", 0.5)
        concept = question_result.get("concept", "unknown")
        responses = question_result.get("responses", [])
        
        # Sample some rationales
        sample_rationales = [r.get("rationale", "") for r in responses[:5]]
        
        prompt = f"""You are an expert instructor using peer instruction methodology.

Current Question Results:
- Concept: {concept}
- Correctness rate: {correctness:.0%}
- Average confidence: {avg_confidence:.0%}
- Response entropy: {entropy:.2f} (0=consensus, 1=split)

Sample student rationales:
{chr(10).join(f'- {r}' for r in sample_rationales)}

Session history (last 3 questions):
{json.dumps(self._history[-3:], indent=2) if self._history else 'First question'}

Available actions:
1. PEER_DISCUSSION - Have students discuss in pairs (best when 30-70% correct, high entropy)
2. REMEDIATE - Provide simpler explanation (when <30% correct)
3. MOVE_ON - Proceed to next question (when >70% correct)
4. GIVE_HINT - Provide targeted hint (when moderate correctness, low entropy)
5. SHOW_EXAMPLE - Demonstrate with worked example

Decide the SINGLE BEST action. Respond in JSON:
{{"action": "ACTION_NAME", "reason": "brief explanation", "parameters": {{}}}}
"""
        try:
            response = self._model.generate_content(prompt)
            text = response.text
            
            # Parse JSON
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                
                # Map to enum
                action_map = {
                    "PEER_DISCUSSION": TeachingAction.PEER_DISCUSSION,
                    "REMEDIATE": TeachingAction.REMEDIATE,
                    "MOVE_ON": TeachingAction.MOVE_ON,
                    "GIVE_HINT": TeachingAction.GIVE_HINT,
                    "SHOW_EXAMPLE": TeachingAction.SHOW_EXAMPLE,
                    "ASK_QUESTION": TeachingAction.ASK_QUESTION,
                    "EXPLAIN_CONCEPT": TeachingAction.EXPLAIN_CONCEPT
                }
                result["action"] = action_map.get(
                    result.get("action", "MOVE_ON"),
                    TeachingAction.MOVE_ON
                )
                return result
        except Exception:
            pass
        
        return self._decide_rule_based(question_result)
    
    def get_intervention_stats(self) -> Dict[str, Any]:
        """Get statistics on teaching interventions."""
        if not self._history:
            return {"total_questions": 0}
        
        return {
            "total_questions": len(self._history),
            "avg_correctness": sum(h["correctness"] for h in self._history) / len(self._history),
            "avg_confidence": sum(h["confidence"] for h in self._history) / len(self._history),
            "concepts_covered": list(set(h["concept"] for h in self._history))
        }


class StaticPolicy(TeachingPolicy):
    """Static policy that always follows the same pattern."""
    
    def __init__(self):
        super().__init__(name="static")
    
    def decide_action(
        self,
        question_result: Dict[str, Any],
        session_context: Optional[Dict] = None,
        use_llm: bool = False
    ) -> Dict[str, Any]:
        """Always move on regardless of results."""
        self._history.append({
            "concept": question_result.get("concept", "unknown"),
            "correctness": question_result.get("correctness_rate", 0.5),
            "confidence": question_result.get("avg_confidence", 0.5),
            "entropy": question_result.get("entropy", 0.5)
        })
        
        return {
            "action": TeachingAction.MOVE_ON,
            "reason": "Static policy - always proceed",
            "parameters": {}
        }

"""
Learning Tracker - Rigorous Measurement of Learning Dynamics

Measures genuine learning vs. mere persuasion by analyzing
reasoning chain improvements and belief update quality.
"""

import json
import os
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from .reasoning_student import ReasoningChain


@dataclass
class LearningEvent:
    """A single learning event for a student."""
    student_id: int
    question_id: str
    concept: str
    initial_answer: str
    final_answer: str
    correct_answer: str
    initial_reasoning_quality: float  # 0-1 rating
    final_reasoning_quality: float    # 0-1 rating
    was_initially_correct: bool
    was_finally_correct: bool
    changed_mind: bool
    learning_type: str  # "genuine", "superficial", "negative", "none"
    misconceptions_corrected: List[str] = field(default_factory=list)


@dataclass
class ClassLearningMetrics:
    """Aggregated learning metrics for the class."""
    question_id: str
    concept: str
    initial_correct_rate: float
    final_correct_rate: float
    normalized_gain: float  # (post - pre) / (1 - pre)
    reasoning_quality_gain: float
    genuine_learning_count: int
    superficial_learning_count: int
    negative_learning_count: int  # Correct -> Wrong
    total_learners: int
    debate_effectiveness: float  # % of debates that improved correctness
    misconceptions_addressed: Dict[str, int]
    
    def to_dict(self) -> Dict:
        return {
            "question_id": self.question_id,
            "concept": self.concept,
            "initial_correct_rate": round(self.initial_correct_rate, 3),
            "final_correct_rate": round(self.final_correct_rate, 3),
            "normalized_gain": round(self.normalized_gain, 3),
            "reasoning_quality_gain": round(self.reasoning_quality_gain, 3),
            "genuine_learning_count": self.genuine_learning_count,
            "superficial_learning_count": self.superficial_learning_count,
            "negative_learning_count": self.negative_learning_count,
            "total_learners": self.total_learners,
            "debate_effectiveness": round(self.debate_effectiveness, 3),
            "misconceptions_addressed": self.misconceptions_addressed
        }


class LearningTracker:
    """
    Tracks and measures genuine learning in peer instruction.
    
    Distinguishes between:
    - Genuine learning: Improved reasoning AND correct answer
    - Superficial learning: Correct answer but reasoning didn't improve
    - Negative learning: Went from correct to incorrect
    """
    
    def __init__(self, use_llm_grading: bool = True):
        """
        Initialize learning tracker.
        
        Args:
            use_llm_grading: Whether to use LLM to grade reasoning quality
        """
        self.use_llm_grading = use_llm_grading
        self.learning_events: List[LearningEvent] = []
        
        self._api_key = os.getenv("GEMINI_API_KEY")
        self._model = None
        if GEMINI_AVAILABLE and self._api_key and use_llm_grading:
            try:
                genai.configure(api_key=self._api_key)
                self._model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception:
                pass
    
    def grade_reasoning_quality(
        self,
        reasoning_chain: ReasoningChain,
        question: Dict[str, Any],
        correct_answer: str
    ) -> float:
        """
        Grade the quality of a reasoning chain.
        
        Returns score 0-1 where:
        - 1.0 = Perfect reasoning leading to correct answer
        - 0.5 = Partially correct reasoning
        - 0.0 = Completely flawed reasoning
        """
        if self._model:
            return self._llm_grade_reasoning(reasoning_chain, question, correct_answer)
        else:
            return self._heuristic_grade_reasoning(reasoning_chain, question, correct_answer)
    
    def _llm_grade_reasoning(
        self,
        reasoning_chain: ReasoningChain,
        question: Dict[str, Any],
        correct_answer: str
    ) -> float:
        """Use LLM to grade reasoning quality."""
        prompt = f"""Grade this student's reasoning on a CS 70 question.

Question: {question.get('prompt', question.get('question_prompt', ''))}
Correct Answer: {correct_answer}

Student's Reasoning:
{reasoning_chain.to_string()}

Student's Answer: {reasoning_chain.conclusion}

Grade the REASONING QUALITY (not just if the answer is right) from 0.0 to 1.0:
- 1.0 = Sound logical steps, demonstrates understanding
- 0.7 = Mostly correct reasoning with minor gaps
- 0.5 = Partially correct but has conceptual errors
- 0.3 = Shows misconceptions but some correct intuition
- 0.0 = Completely wrong reasoning/random guessing

IMPORTANT: A student can have good reasoning even if their answer is wrong,
and can have poor reasoning even if they stumble on the right answer.

Respond with just a JSON object:
{{"quality": 0.0-1.0, "justification": "brief reason"}}
"""
        try:
            response = self._model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            result = json.loads(response.text)
            return min(1.0, max(0.0, result.get("quality", 0.5)))
        except Exception:
            return self._heuristic_grade_reasoning(reasoning_chain, question, correct_answer)
    
    def _heuristic_grade_reasoning(
        self,
        reasoning_chain: ReasoningChain,
        question: Dict[str, Any],
        correct_answer: str
    ) -> float:
        """Heuristic grading when LLM not available."""
        score = 0.3  # Base score
        
        # Points for having multiple reasoning steps
        if len(reasoning_chain.steps) >= 2:
            score += 0.1
        if len(reasoning_chain.steps) >= 3:
            score += 0.1
        
        # Points for confidence matching correctness
        is_correct = reasoning_chain.conclusion and correct_answer[0] in reasoning_chain.conclusion
        if is_correct and reasoning_chain.confidence > 0.6:
            score += 0.2
        elif not is_correct and reasoning_chain.confidence < 0.4:
            score += 0.1  # Aware of uncertainty
        
        # Penalty for misconceptions
        if reasoning_chain.misconceptions_used:
            score -= 0.15 * len(reasoning_chain.misconceptions_used)
        
        # Bonus for reaching correct answer
        if is_correct:
            score += 0.2
        
        return max(0.0, min(1.0, score))
    
    def classify_learning_type(
        self,
        was_initially_correct: bool,
        was_finally_correct: bool,
        initial_quality: float,
        final_quality: float,
        quality_threshold: float = 0.15
    ) -> str:
        """
        Classify the type of learning that occurred.
        
        Args:
            was_initially_correct: Initial answer correctness
            was_finally_correct: Final answer correctness
            initial_quality: Initial reasoning quality score
            final_quality: Final reasoning quality score
            quality_threshold: Minimum improvement to count as learning
            
        Returns:
            Learning type: "genuine", "superficial", "negative", "none"
        """
        reasoning_improved = (final_quality - initial_quality) >= quality_threshold
        
        if not was_initially_correct and was_finally_correct:
            if reasoning_improved:
                return "genuine"  # Best case: understood why
            else:
                return "superficial"  # Just copied answer
        
        if was_initially_correct and not was_finally_correct:
            return "negative"  # Got convinced of wrong answer
        
        if was_initially_correct and was_finally_correct:
            if reasoning_improved:
                return "genuine"  # Deepened understanding
            else:
                return "none"  # Already knew it
        
        # Wrong -> Wrong
        if reasoning_improved:
            return "superficial"  # Improved thinking but still wrong
        return "none"
    
    def track_learning(
        self,
        student_id: int,
        question: Dict[str, Any],
        initial_answer: str,
        final_answer: str,
        initial_reasoning: ReasoningChain,
        final_reasoning: ReasoningChain,
        misconceptions_corrected: List[str] = None
    ) -> LearningEvent:
        """
        Track a learning event for a student.
        
        Args:
            student_id: The student's ID
            question: The question dict
            initial_answer: Initial answer before debate
            final_answer: Final answer after debate
            initial_reasoning: Initial reasoning chain
            final_reasoning: Final reasoning chain
            misconceptions_corrected: List of misconceptions that were corrected
            
        Returns:
            LearningEvent with full analysis
        """
        correct_answer = question.get("correct_answer", "A")
        concept = question.get("concept", "unknown")
        
        # Grade reasoning quality
        initial_quality = self.grade_reasoning_quality(initial_reasoning, question, correct_answer)
        final_quality = self.grade_reasoning_quality(final_reasoning, question, correct_answer)
        
        # Check correctness
        was_initially_correct = initial_answer.startswith(correct_answer[0])
        was_finally_correct = final_answer.startswith(correct_answer[0])
        
        # Classify learning type
        learning_type = self.classify_learning_type(
            was_initially_correct,
            was_finally_correct,
            initial_quality,
            final_quality
        )
        
        event = LearningEvent(
            student_id=student_id,
            question_id=question.get("id", "q_unknown"),
            concept=concept,
            initial_answer=initial_answer,
            final_answer=final_answer,
            correct_answer=correct_answer,
            initial_reasoning_quality=initial_quality,
            final_reasoning_quality=final_quality,
            was_initially_correct=was_initially_correct,
            was_finally_correct=was_finally_correct,
            changed_mind=(initial_answer != final_answer),
            learning_type=learning_type,
            misconceptions_corrected=misconceptions_corrected or []
        )
        
        self.learning_events.append(event)
        return event
    
    def compute_class_metrics(
        self,
        question: Dict[str, Any],
        events: List[LearningEvent] = None
    ) -> ClassLearningMetrics:
        """
        Compute aggregated learning metrics for the class.
        
        Args:
            question: The question dict
            events: List of learning events (or use stored events)
            
        Returns:
            ClassLearningMetrics with comprehensive analysis
        """
        if events is None:
            question_id = question.get("id", "q_unknown")
            events = [e for e in self.learning_events if e.question_id == question_id]
        
        if not events:
            return ClassLearningMetrics(
                question_id=question.get("id", "q_unknown"),
                concept=question.get("concept", "unknown"),
                initial_correct_rate=0.0,
                final_correct_rate=0.0,
                normalized_gain=0.0,
                reasoning_quality_gain=0.0,
                genuine_learning_count=0,
                superficial_learning_count=0,
                negative_learning_count=0,
                total_learners=0,
                debate_effectiveness=0.0,
                misconceptions_addressed={}
            )
        
        n = len(events)
        
        # Correctness rates
        initial_correct = sum(1 for e in events if e.was_initially_correct)
        final_correct = sum(1 for e in events if e.was_finally_correct)
        initial_rate = initial_correct / n
        final_rate = final_correct / n
        
        # Normalized gain
        if initial_rate < 1.0:
            normalized_gain = (final_rate - initial_rate) / (1.0 - initial_rate)
        else:
            normalized_gain = 0.0
        
        # Reasoning quality gain
        quality_gains = [e.final_reasoning_quality - e.initial_reasoning_quality for e in events]
        avg_quality_gain = sum(quality_gains) / n
        
        # Learning type counts
        genuine = sum(1 for e in events if e.learning_type == "genuine")
        superficial = sum(1 for e in events if e.learning_type == "superficial")
        negative = sum(1 for e in events if e.learning_type == "negative")
        
        # Total learners (improved in some way)
        total_learners = genuine + superficial
        
        # Debate effectiveness
        debates_that_helped = sum(1 for e in events if e.changed_mind and e.was_finally_correct and not e.was_initially_correct)
        debates_that_hurt = sum(1 for e in events if e.changed_mind and not e.was_finally_correct and e.was_initially_correct)
        mind_changers = sum(1 for e in events if e.changed_mind)
        
        if mind_changers > 0:
            debate_effectiveness = (debates_that_helped - debates_that_hurt) / mind_changers
        else:
            debate_effectiveness = 0.0
        
        # Misconceptions addressed
        all_misconceptions = []
        for e in events:
            all_misconceptions.extend(e.misconceptions_corrected)
        
        misconception_counts: Dict[str, int] = {}
        for m in all_misconceptions:
            misconception_counts[m] = misconception_counts.get(m, 0) + 1
        
        return ClassLearningMetrics(
            question_id=question.get("id", "q_unknown"),
            concept=question.get("concept", "unknown"),
            initial_correct_rate=initial_rate,
            final_correct_rate=final_rate,
            normalized_gain=normalized_gain,
            reasoning_quality_gain=avg_quality_gain,
            genuine_learning_count=genuine,
            superficial_learning_count=superficial,
            negative_learning_count=negative,
            total_learners=total_learners,
            debate_effectiveness=debate_effectiveness,
            misconceptions_addressed=misconception_counts
        )
    
    def is_genuine_learning(self, event: LearningEvent) -> bool:
        """Quick check if a learning event represents genuine learning."""
        return event.learning_type == "genuine"
    
    def save_events(self, filepath: str):
        """Save all learning events to file."""
        data = [
            {
                "student_id": e.student_id,
                "question_id": e.question_id,
                "concept": e.concept,
                "initial_answer": e.initial_answer,
                "final_answer": e.final_answer,
                "correct_answer": e.correct_answer,
                "initial_quality": e.initial_reasoning_quality,
                "final_quality": e.final_reasoning_quality,
                "was_initially_correct": e.was_initially_correct,
                "was_finally_correct": e.was_finally_correct,
                "changed_mind": e.changed_mind,
                "learning_type": e.learning_type,
                "misconceptions_corrected": e.misconceptions_corrected
            }
            for e in self.learning_events
        ]
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    def summary_report(self) -> Dict[str, Any]:
        """Generate a summary report of all learning events."""
        if not self.learning_events:
            return {"error": "No learning events tracked"}
        
        # Group by question
        questions = {}
        for event in self.learning_events:
            qid = event.question_id
            if qid not in questions:
                questions[qid] = []
            questions[qid].append(event)
        
        # Overall stats
        total_events = len(self.learning_events)
        genuine_total = sum(1 for e in self.learning_events if e.learning_type == "genuine")
        superficial_total = sum(1 for e in self.learning_events if e.learning_type == "superficial")
        negative_total = sum(1 for e in self.learning_events if e.learning_type == "negative")
        
        return {
            "total_events": total_events,
            "questions_covered": len(questions),
            "genuine_learning_rate": genuine_total / total_events if total_events else 0,
            "superficial_learning_rate": superficial_total / total_events if total_events else 0,
            "negative_learning_rate": negative_total / total_events if total_events else 0,
            "average_quality_improvement": sum(
                e.final_reasoning_quality - e.initial_reasoning_quality 
                for e in self.learning_events
            ) / total_events if total_events else 0
        }

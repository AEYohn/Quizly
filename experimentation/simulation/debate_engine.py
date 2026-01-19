"""
Debate Engine - Multi-Turn Competitive Consensus for Peer Instruction

Orchestrates debates between students with opposing views using
Competitive Consensus Chain-of-Thought (CCoT) methodology.
"""

import os
import json
import random
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from .reasoning_student import ReasoningStudent, DebatePosition, ReasoningChain


@dataclass
class DebateTurn:
    """A single turn in a debate."""
    turn_number: int
    speaker_id: int
    speaker_name: str
    position: DebatePosition
    argument: str
    changed_mind: bool = False


@dataclass  
class DebateResult:
    """Result of a complete debate between two students."""
    debate_id: str
    question_id: str
    student_a_id: int
    student_b_id: int
    initial_positions: Dict[int, str]
    final_positions: Dict[int, str]
    turns: List[DebateTurn]
    winner_answer: str
    belief_changes: List[Dict]
    total_turns: int
    student_a_correct_initially: bool
    student_b_correct_initially: bool
    student_a_correct_finally: bool
    student_b_correct_finally: bool
    
    def to_dict(self) -> Dict:
        return {
            "debate_id": self.debate_id,
            "question_id": self.question_id,
            "student_a_id": self.student_a_id,
            "student_b_id": self.student_b_id,
            "initial_positions": self.initial_positions,
            "final_positions": self.final_positions,
            "turns": [
                {
                    "turn": t.turn_number,
                    "speaker": t.speaker_name,
                    "position": t.position.answer,
                    "argument": t.argument,
                    "changed_mind": t.changed_mind
                }
                for t in self.turns
            ],
            "winner_answer": self.winner_answer,
            "belief_changes": self.belief_changes,
            "outcome": self._compute_outcome()
        }
    
    def _compute_outcome(self) -> str:
        """Categorize the debate outcome."""
        a_init = self.student_a_correct_initially
        b_init = self.student_b_correct_initially
        a_final = self.student_a_correct_finally
        b_final = self.student_b_correct_finally
        
        if a_init and b_init:
            return "both_correct_initially"
        if not a_init and not b_init:
            if a_final or b_final:
                return "both_wrong_one_learned"
            return "both_wrong_stayed_wrong"
        
        # One was correct initially
        if (a_init and not b_init):
            if b_final:
                return "correct_convinced_wrong"
            if not a_final:
                return "wrong_convinced_correct"  # Bad outcome
            return "no_change"
        
        if (b_init and not a_init):
            if a_final:
                return "correct_convinced_wrong"
            if not b_final:
                return "wrong_convinced_correct"  # Bad outcome
            return "no_change"
        
        return "unknown"


@dataclass
class ConsensusResult:
    """Result of competitive consensus across all debates."""
    question_id: str
    total_debates: int
    correct_answer: str
    initial_correct_count: int
    final_correct_count: int
    learning_gain: float
    outcome_distribution: Dict[str, int]
    winning_arguments: List[str]
    
    def to_dict(self) -> Dict:
        return {
            "question_id": self.question_id,
            "total_debates": self.total_debates,
            "correct_answer": self.correct_answer,
            "initial_correct_count": self.initial_correct_count,
            "final_correct_count": self.final_correct_count,
            "learning_gain": self.learning_gain,
            "outcome_distribution": self.outcome_distribution,
            "winning_arguments": self.winning_arguments
        }


class DebateEngine:
    """
    Orchestrates peer debates using CCoT-style competitive consensus.
    
    Students are paired based on opposing answers, then engage in
    multi-turn debates where they try to convince each other.
    """
    
    def __init__(self, max_turns: int = 3, use_judge: bool = False):
        """
        Initialize debate engine.
        
        Args:
            max_turns: Maximum debate turns per student
            use_judge: Whether to use an LLM judge to evaluate arguments
        """
        self.max_turns = max_turns
        self.use_judge = use_judge
        self.debate_log: List[DebateResult] = []
        
        self._api_key = os.getenv("GEMINI_API_KEY")
        self._model = None
        if GEMINI_AVAILABLE and self._api_key:
            try:
                genai.configure(api_key=self._api_key)
                self._model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception:
                pass
    
    def pair_students(
        self,
        students: List[ReasoningStudent],
        responses: Dict[int, Tuple[str, ReasoningChain]]
    ) -> List[Tuple[ReasoningStudent, ReasoningStudent]]:
        """
        Pair students with opposing views for debate.
        
        Strategy: Match students who disagree to maximize productive debate.
        Secondary: Match low-confidence with high-confidence when possible.
        
        Args:
            students: List of all students
            responses: Dict mapping student_id -> (answer, reasoning_chain)
            
        Returns:
            List of (student_a, student_b) pairs for debates
        """
        # Group students by answer
        answer_groups: Dict[str, List[Tuple[ReasoningStudent, ReasoningChain]]] = {}
        for student in students:
            answer, chain = responses.get(student.id, ("", ReasoningChain([], "", 0.5)))
            if answer not in answer_groups:
                answer_groups[answer] = []
            answer_groups[answer].append((student, chain))
        
        pairs = []
        answers = list(answer_groups.keys())
        
        if len(answers) < 2:
            # Everyone agrees - no debate needed, but pair for discussion anyway
            all_students = [(s, c) for group in answer_groups.values() for s, c in group]
            random.shuffle(all_students)
            for i in range(0, len(all_students) - 1, 2):
                pairs.append((all_students[i][0], all_students[i+1][0]))
            return pairs
        
        # Pair students with different answers
        used_students = set()
        
        for i, ans1 in enumerate(answers):
            for ans2 in answers[i+1:]:
                group1 = [(s, c) for s, c in answer_groups[ans1] if s.id not in used_students]
                group2 = [(s, c) for s, c in answer_groups[ans2] if s.id not in used_students]
                
                # Sort by confidence to pair high-confidence with low-confidence
                group1.sort(key=lambda x: x[1].confidence, reverse=True)
                group2.sort(key=lambda x: x[1].confidence)
                
                # Create pairs
                while group1 and group2:
                    s1, _ = group1.pop(0)
                    s2, _ = group2.pop(0)
                    pairs.append((s1, s2))
                    used_students.add(s1.id)
                    used_students.add(s2.id)
        
        return pairs
    
    def run_debate(
        self,
        student_a: ReasoningStudent,
        student_b: ReasoningStudent,
        question: Dict[str, Any],
        initial_positions: Dict[int, Tuple[str, ReasoningChain]],
        max_turns: Optional[int] = None
    ) -> DebateResult:
        """
        Run a multi-turn debate between two students.
        
        Args:
            student_a: First debater
            student_b: Second debater
            question: The question being debated
            initial_positions: Dict of student_id -> (answer, reasoning)
            max_turns: Optional limit on turns (overrides instance default)
            
        Returns:
            DebateResult with full transcript and outcomes
        """
        correct_answer = question.get("correct_answer", "A")
        
        # Get initial positions
        ans_a, chain_a = initial_positions.get(student_a.id, ("A", ReasoningChain(["Unknown"], "Unknown", 0.5)))
        ans_b, chain_b = initial_positions.get(student_b.id, ("B", ReasoningChain(["Unknown"], "Unknown", 0.5)))
        
        pos_a = DebatePosition(answer=ans_a, reasoning_chain=chain_a, confidence=chain_a.confidence)
        pos_b = DebatePosition(answer=ans_b, reasoning_chain=chain_b, confidence=chain_b.confidence)
        
        turns: List[DebateTurn] = []
        belief_changes: List[Dict] = []
        
        # Track initial correctness
        a_correct_init = ans_a.startswith(correct_answer[0]) if correct_answer else False
        b_correct_init = ans_b.startswith(correct_answer[0]) if correct_answer else False
        
        # Determine actual max turns
        actual_max_turns = max_turns if max_turns is not None else self.max_turns
        
        # Multi-turn debate
        for turn_num in range(actual_max_turns):
            # Student A responds to B's position
            new_pos_a, changed_a = student_a.debate(pos_b, question, pos_a)
            argument_a = new_pos_a.reasoning_chain.conclusion
            
            turns.append(DebateTurn(
                turn_number=turn_num * 2,
                speaker_id=student_a.id,
                speaker_name=student_a.name,
                position=new_pos_a,
                argument=argument_a,
                changed_mind=changed_a
            ))
            
            if changed_a:
                belief_changes.append({
                    "turn": turn_num * 2,
                    "student_id": student_a.id,
                    "from_answer": pos_a.answer,
                    "to_answer": new_pos_a.answer,
                    "reason": argument_a
                })
            
            pos_a = new_pos_a
            
            # Student B responds to A's position
            new_pos_b, changed_b = student_b.debate(pos_a, question, pos_b)
            argument_b = new_pos_b.reasoning_chain.conclusion
            
            turns.append(DebateTurn(
                turn_number=turn_num * 2 + 1,
                speaker_id=student_b.id,
                speaker_name=student_b.name,
                position=new_pos_b,
                argument=argument_b,
                changed_mind=changed_b
            ))
            
            if changed_b:
                belief_changes.append({
                    "turn": turn_num * 2 + 1,
                    "student_id": student_b.id,
                    "from_answer": pos_b.answer,
                    "to_answer": new_pos_b.answer,
                    "reason": argument_b
                })
            
            pos_b = new_pos_b
            
            # Check for consensus (both agree)
            if pos_a.answer == pos_b.answer:
                break
        
        # Determine winner (most common final answer, or higher confidence if split)
        if pos_a.answer == pos_b.answer:
            winner_answer = pos_a.answer
        elif pos_a.confidence > pos_b.confidence:
            winner_answer = pos_a.answer
        else:
            winner_answer = pos_b.answer
        
        # Track final correctness
        a_correct_final = pos_a.answer.startswith(correct_answer[0]) if correct_answer else False
        b_correct_final = pos_b.answer.startswith(correct_answer[0]) if correct_answer else False
        
        debate_id = f"debate_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{student_a.id}v{student_b.id}"
        
        result = DebateResult(
            debate_id=debate_id,
            question_id=question.get("id", "q_unknown"),
            student_a_id=student_a.id,
            student_b_id=student_b.id,
            initial_positions={student_a.id: ans_a, student_b.id: ans_b},
            final_positions={student_a.id: pos_a.answer, student_b.id: pos_b.answer},
            turns=turns,
            winner_answer=winner_answer,
            belief_changes=belief_changes,
            total_turns=len(turns),
            student_a_correct_initially=a_correct_init,
            student_b_correct_initially=b_correct_init,
            student_a_correct_finally=a_correct_final,
            student_b_correct_finally=b_correct_final
        )
        
        self.debate_log.append(result)
        return result
    
    def competitive_consensus(
        self,
        debates: List[DebateResult],
        question: Dict[str, Any]
    ) -> ConsensusResult:
        """
        Aggregate debate outcomes using competitive consensus.
        
        Like CCoT: multiple reasoning paths compete, track which arguments win.
        
        Args:
            debates: List of completed debates
            question: The question for context
            
        Returns:
            ConsensusResult with aggregated metrics
        """
        correct_answer = question.get("correct_answer", "A")
        
        # Count outcomes
        initial_correct = 0
        final_correct = 0
        outcome_dist: Dict[str, int] = {}
        winning_arguments: List[str] = []
        
        for debate in debates:
            # Initial correct count
            if debate.student_a_correct_initially:
                initial_correct += 1
            if debate.student_b_correct_initially:
                initial_correct += 1
            
            # Final correct count
            if debate.student_a_correct_finally:
                final_correct += 1
            if debate.student_b_correct_finally:
                final_correct += 1
            
            # Track outcome
            outcome = debate._compute_outcome()
            outcome_dist[outcome] = outcome_dist.get(outcome, 0) + 1
            
            # Track winning arguments (from belief changes to correct answer)
            for change in debate.belief_changes:
                if change["to_answer"].startswith(correct_answer[0]):
                    winning_arguments.append(change["reason"])
        
        total_students = len(debates) * 2
        learning_gain = (final_correct - initial_correct) / max(1, total_students)
        
        return ConsensusResult(
            question_id=question.get("id", "q_unknown"),
            total_debates=len(debates),
            correct_answer=correct_answer,
            initial_correct_count=initial_correct,
            final_correct_count=final_correct,
            learning_gain=learning_gain,
            outcome_distribution=outcome_dist,
            winning_arguments=winning_arguments[:5]  # Top 5
        )
    
    def run_class_debates(
        self,
        students: List[ReasoningStudent],
        question: Dict[str, Any],
        initial_responses: Dict[int, Tuple[str, ReasoningChain]]
    ) -> Tuple[List[DebateResult], ConsensusResult]:
        """
        Run debates for an entire class on a question.
        
        Args:
            students: All students in the class
            question: The question to debate
            initial_responses: Each student's initial answer and reasoning
            
        Returns:
            Tuple of (all_debate_results, consensus_result)
        """
        # Pair students
        pairs = self.pair_students(students, initial_responses)
        
        # Run all debates
        debates = []
        for student_a, student_b in pairs:
            debate = self.run_debate(student_a, student_b, question, initial_responses)
            debates.append(debate)
        
        # Compute consensus
        consensus = self.competitive_consensus(debates, question)
        
        return debates, consensus
    
    def save_debates(self, filepath: str):
        """Save all debate logs to file."""
        data = [d.to_dict() for d in self.debate_log]
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

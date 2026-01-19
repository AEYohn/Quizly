"""
Rigorous Experiment Runner - Full Peer Instruction Simulation

Integrates ReasoningStudent, DebateEngine, and LearningTracker
for rigorous experiments with LLM-driven peer debates.

Now uses fully LLM-generated questions instead of hardcoded placeholders.
"""

import os
import json
import random
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .reasoning_student import (
    ReasoningStudent, 
    ReasoningChain, 
    DebatePosition,
    generate_reasoning_students
)
from .debate_engine import DebateEngine, DebateResult, ConsensusResult
from .learning_tracker import LearningTracker, LearningEvent, ClassLearningMetrics

# Import the new LLM-powered question generator
try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from ai_agents.question_generator import QuestionBankGenerator, CS70_CONCEPTS
    QUESTION_GENERATOR_AVAILABLE = True
except ImportError:
    QUESTION_GENERATOR_AVAILABLE = False
    CS70_CONCEPTS = []


# Fallback questions for when LLM is unavailable 
# These have REAL educational content, not placeholders
FALLBACK_CS70_QUESTIONS = [
    {
        "id": "q_bfs_data_structure",
        "concept": "bfs_traversal",
        "difficulty": 0.4,
        "prompt": "Which data structure is primarily used in Breadth-First Search (BFS)?",
        "options": ["A. Queue (FIFO)", "B. Stack (LIFO)", "C. Priority Queue", "D. Hash Set"],
        "correct_answer": "A",
        "common_traps": ["B is used for DFS", "C is used for Dijkstra's"]
    },
    {
        "id": "q_tree_property",
        "concept": "tree_properties",
        "difficulty": 0.4,
        "prompt": "A tree with n vertices has exactly how many edges?",
        "options": ["A. n - 1", "B. n", "C. n + 1", "D. 2n"],
        "correct_answer": "A",
        "common_traps": []
    },
    {
        "id": "q_dfs_marking",
        "concept": "dfs_traversal", 
        "difficulty": 0.55,
        "prompt": "In iterative DFS using a stack, when should a node be marked as visited to avoid duplicate processing?",
        "options": [
            "A. When it is first pushed onto the stack",
            "B. When it is popped from the stack",
            "C. When all its neighbors have been explored",
            "D. Before starting the algorithm"
        ],
        "correct_answer": "A",
        "common_traps": ["B causes duplicate visits when a node is reachable via multiple paths"]
    },
    {
        "id": "q_bipartite_check",
        "concept": "bipartite_graphs",
        "difficulty": 0.5,
        "prompt": "How can you check if a graph is bipartite?",
        "options": [
            "A. Use BFS/DFS with 2-coloring",
            "B. Check if all vertices have even degree",
            "C. Verify that the graph has no cycles",
            "D. Count the number of connected components"
        ],
        "correct_answer": "A",
        "common_traps": ["B is Eulerian condition", "C is wrong - bipartite graphs can have even cycles"]
    },
    {
        "id": "q_strongly_connected_tricky",
        "concept": "graph_connectivity",
        "difficulty": 0.65,
        "prompt": "A directed graph G has the property that for every pair of vertices u and v, either there is a path from u to v OR a path from v to u. Is G necessarily strongly connected?",
        "options": [
            "A. No, this only guarantees weak unilateral connectivity",
            "B. Yes, because all pairs are connected in some direction",
            "C. Only if G is also acyclic",
            "D. Only if G has an Eulerian path"
        ],
        "correct_answer": "A",
        "common_traps": ["B is the common wrong answer - strong connectivity requires BOTH directions for ALL pairs"]
    },
    {
        "id": "q_dijkstra_tricky",
        "concept": "shortest_paths",
        "difficulty": 0.7,
        "prompt": "Dijkstra's algorithm is run on a graph with all positive edge weights. The algorithm has just permanently labeled vertex v with distance d. Which statement is TRUE?",
        "options": [
            "A. The shortest path from source to v has distance exactly d",
            "B. All paths from source to v have distance at least d",
            "C. There exists a path from source to v with distance d",
            "D. Both A and C are true"
        ],
        "correct_answer": "D",
        "common_traps": ["A alone seems sufficient but C is also always true"]
    },
    {
        "id": "q_topological_tricky",
        "concept": "topological_sort",
        "difficulty": 0.65,
        "prompt": "If a DAG has a unique topological ordering, what must be true about the graph?",
        "options": [
            "A. It must be a Hamiltonian path (edge between consecutive vertices in ordering)",
            "B. It must have exactly n-1 edges",
            "C. It must be a tree",
            "D. It cannot have any vertices with in-degree 0"
        ],
        "correct_answer": "A",
        "common_traps": ["Unique topological order requires the DAG to be a chain"]
    },
    {
        "id": "q_mst_tricky",
        "concept": "minimum_spanning_tree",
        "difficulty": 0.7,
        "prompt": "Graph G has all distinct edge weights. Let e be the maximum weight edge in some cycle C. Which statement is TRUE?",
        "options": [
            "A. e cannot be in any MST of G",
            "B. e must be in every MST of G",
            "C. e may or may not be in an MST depending on other edges",
            "D. e is in the MST if and only if C is the unique cycle containing e"
        ],
        "correct_answer": "A",
        "common_traps": ["This is the cycle property of MSTs - max edge in any cycle is never in MST"]
    },
    {
        "id": "q_bfs_shortest_path_tricky",
        "concept": "bfs_traversal",
        "difficulty": 0.6,
        "prompt": "BFS finds shortest paths in unweighted graphs. In a weighted graph where all edges have weight 1 or 2, BFS will:",
        "options": [
            "A. Still find shortest paths since weights are small",
            "B. Never find shortest paths",
            "C. May fail to find shortest paths (gives correct answer on some graphs but not all)",
            "D. Find shortest paths only if all weights are 1"
        ],
        "correct_answer": "C",
        "common_traps": ["BFS doesn't respect edge weights at all - it counts edges not weight"]
    },
    {
        "id": "q_cycle_detection",
        "concept": "dfs_traversal",
        "difficulty": 0.6,
        "prompt": "To detect a cycle in a DIRECTED graph using DFS, which type of edge indicates a cycle?",
        "options": [
            "A. Back edge (edge to an ancestor in DFS tree)",
            "B. Forward edge (edge to a descendant)",
            "C. Cross edge (edge to a non-ancestor, non-descendant)",
            "D. Any non-tree edge"
        ],
        "correct_answer": "A",
        "common_traps": ["In undirected graphs any non-tree edge works, but directed needs back edges"]
    }
]


def get_questions(use_llm: bool = True, regenerate: bool = False, num_per_concept: int = 1) -> List[Dict]:
    """
    Get questions for the experiment.
    
    Now uses LLM-generated questions when available, with fallback to
    pre-defined educational questions.
    
    Args:
        use_llm: Whether to attempt LLM generation (default True)
        regenerate: Force regeneration even if cache exists
        num_per_concept: Number of questions per concept when generating
        
    Returns:
        List of question dicts with real educational content
    """
    if use_llm and QUESTION_GENERATOR_AVAILABLE:
        try:
            generator = QuestionBankGenerator()
            cache_path = Path(__file__).parent.parent / "experiments" / "question_bank.json"
            questions = generator.get_or_generate_questions(
                cache_path=str(cache_path),
                regenerate=regenerate,
                num_per_concept=num_per_concept
            )
            if questions and len(questions) > 0:
                print(f"Using {len(questions)} LLM-generated questions")
                return questions
        except Exception as e:
            print(f"LLM question generation failed: {e}")
    
    print(f"Using {len(FALLBACK_CS70_QUESTIONS)} fallback questions")
    return FALLBACK_CS70_QUESTIONS


# For backwards compatibility, CS70_QUESTIONS now uses get_questions()
# but can be overridden if needed
CS70_QUESTIONS = FALLBACK_CS70_QUESTIONS  # Default to fallback, will be replaced at init


@dataclass
class ExperimentResult:
    """Complete result of a rigorous experiment."""
    experiment_id: str
    policy_name: str
    num_students: int
    num_questions: int
    timestamp: str
    
    # Overall metrics
    avg_correctness: float
    avg_confidence: float
    discussion_rate: float
    genuine_learning_gain: float
    
    # Per-question results
    question_results: List[Dict]
    
    # Debate analysis
    total_debates: int
    positive_debate_outcomes: int
    negative_debate_outcomes: int
    
    # Learning analysis
    genuine_learning_events: int
    superficial_learning_events: int
    
    def to_dict(self) -> Dict:
        return {
            "experiment_id": self.experiment_id,
            "policy_name": self.policy_name,
            "num_students": self.num_students,
            "num_questions": self.num_questions,
            "timestamp": self.timestamp,
            "avg_correctness": round(self.avg_correctness, 3),
            "avg_confidence": round(self.avg_confidence, 3),
            "discussion_rate": round(self.discussion_rate, 3),
            "genuine_learning_gain": round(self.genuine_learning_gain, 4),
            "question_results": self.question_results,
            "total_debates": self.total_debates,
            "positive_debate_outcomes": self.positive_debate_outcomes,
            "negative_debate_outcomes": self.negative_debate_outcomes,
            "genuine_learning_events": self.genuine_learning_events,
            "superficial_learning_events": self.superficial_learning_events
        }


class RigorousExperiment:
    """
    Runs rigorous peer instruction experiments with LLM reasoning.
    
    Now supports LLM-generated questions for real educational content.
    """
    
    def __init__(
        self,
        num_students: int = 20,
        questions: List[Dict] = None,
        max_debate_turns: int = 3,
        distribution: str = "realistic",
        use_llm_questions: bool = True,
        regenerate_questions: bool = False
    ):
        """
        Initialize experiment.
        
        Args:
            num_students: Number of simulated students
            questions: List of questions (if None, uses LLM-generated or fallback)
            max_debate_turns: Max turns per debate
            distribution: Student distribution type
            use_llm_questions: If True, attempt to use LLM-generated questions
            regenerate_questions: If True, regenerate questions even if cached
        """
        self.num_students = num_students
        
        # Use provided questions, or get LLM-generated/fallback
        if questions is not None:
            self.questions = questions
        else:
            self.questions = get_questions(
                use_llm=use_llm_questions, 
                regenerate=regenerate_questions
            )
        
        self.max_debate_turns = max_debate_turns
        self.distribution = distribution
        
        # Get concepts from questions
        self.concepts = list(set(q["concept"] for q in self.questions))
        
        # Initialize components
        self.students = generate_reasoning_students(
            num_students, 
            self.concepts, 
            distribution
        )
        self.debate_engine = DebateEngine(max_turns=max_debate_turns)
        self.learning_tracker = LearningTracker(use_llm_grading=True)
    
    def should_trigger_discussion(
        self,
        responses: Dict[int, Tuple[str, ReasoningChain]],
        policy: str = "adaptive"
    ) -> Tuple[bool, str]:
        """
        Decide whether to trigger peer discussion.
        
        Args:
            responses: Dict of student_id -> (answer, reasoning)
            policy: "adaptive" or "static"
            
        Returns:
            Tuple of (should_discuss, reason)
        """
        if policy == "static":
            return False, "Static policy - no discussion"
        
        # Calculate metrics
        answers = [ans for ans, _ in responses.values()]
        total = len(answers)
        
        # Count answer distribution
        answer_counts = {}
        for ans in answers:
            key = ans[0] if ans else "?"  # First letter
            answer_counts[key] = answer_counts.get(key, 0) + 1
        
        # Calculate entropy
        import math
        entropy = 0
        for count in answer_counts.values():
            p = count / total
            if p > 0:
                entropy -= p * math.log2(p)
        
        # Calculate correctness (for internal tracking, not used in decision)
        correct_rate = max(answer_counts.values()) / total if answer_counts else 0
        
        # Decision logic - LOWERED THRESHOLD to trigger more discussions
        # Trigger discussion if correctness is between 15% and 85% (was 30-70%)
        if 0.15 <= 1 - correct_rate <= 0.85:
            return True, f"Split responses (entropy {entropy:.2f}) - peer discussion optimal"
        elif correct_rate < 0.15:
            return True, f"Very low correctness ({correct_rate:.0%}) - remediation + discussion"
        else:
            return False, f"Very high correctness ({correct_rate:.0%}) - move on"
    
    def run_question(
        self,
        question: Dict,
        policy: str = "adaptive"
    ) -> Dict:
        """
        Run a single question through the peer instruction cycle.
        
        Args:
            question: The question dict
            policy: "adaptive" or "static"
            
        Returns:
            Question result dict
        """
        correct_answer = question.get("correct_answer", "A")
        
        # Round 1: Initial answers
        initial_responses: Dict[int, Tuple[str, ReasoningChain]] = {}
        for student in self.students:
            answer, reasoning = student.reason_about_question(question)
            initial_responses[student.id] = (answer, reasoning)
        
        # Collect initial metrics
        initial_correct = sum(
            1 for ans, _ in initial_responses.values() 
            if ans.startswith(correct_answer[0])
        )
        initial_rate = initial_correct / len(self.students)
        
        avg_confidence = sum(
            chain.confidence for _, chain in initial_responses.values()
        ) / len(self.students)
        
        # Decide action
        should_discuss, reason = self.should_trigger_discussion(initial_responses, policy)
        
        final_responses: Dict[int, Tuple[str, ReasoningChain]] = {}
        debates: List[DebateResult] = []
        consensus: Optional[ConsensusResult] = None
        
        if should_discuss:
            # Run debates
            debates, consensus = self.debate_engine.run_class_debates(
                self.students,
                question,
                initial_responses
            )
            
            # Collect final responses from debates
            for debate in debates:
                for turn in debate.turns:
                    if turn.turn_number == debate.total_turns - 1 or turn.turn_number == debate.total_turns - 2:
                        final_responses[turn.speaker_id] = (
                            turn.position.answer,
                            turn.position.reasoning_chain
                        )
            
            # For students not in debates, keep initial
            for student in self.students:
                if student.id not in final_responses:
                    final_responses[student.id] = initial_responses[student.id]
        else:
            final_responses = initial_responses.copy()
        
        # Track learning for each student
        learning_events = []
        for student in self.students:
            init_ans, init_chain = initial_responses[student.id]
            final_ans, final_chain = final_responses.get(student.id, (init_ans, init_chain))
            
            # Check for misconception corrections
            misconceptions_corrected = []
            for m in student.active_misconceptions:
                if student._misconception_applies_to_concept(m, question["concept"]):
                    # Check if reasoning improved (simplified)
                    if init_chain.misconceptions_used and not final_chain.misconceptions_used:
                        misconceptions_corrected.append(m.value)
            
            event = self.learning_tracker.track_learning(
                student_id=student.id,
                question=question,
                initial_answer=init_ans,
                final_answer=final_ans,
                initial_reasoning=init_chain,
                final_reasoning=final_chain,
                misconceptions_corrected=misconceptions_corrected
            )
            learning_events.append(event)
            
            # Update student knowledge
            student.update_knowledge(
                question["concept"],
                f"Correct answer is {correct_answer}",
                final_ans.startswith(correct_answer[0])
            )
        
        # Compute class metrics
        class_metrics = self.learning_tracker.compute_class_metrics(question, learning_events)
        
        # Final correctness
        final_correct = sum(
            1 for ans, _ in final_responses.values()
            if ans.startswith(correct_answer[0])
        )
        final_rate = final_correct / len(self.students)
        
        return {
            "question_id": question["id"],
            "concept": question["concept"],
            "difficulty": question["difficulty"],
            "initial_correct_rate": initial_rate,
            "final_correct_rate": final_rate,
            "avg_confidence": avg_confidence,
            "action": "peer_discussion" if should_discuss else "move_on",
            "action_reason": reason,
            "num_debates": len(debates),
            "class_metrics": class_metrics.to_dict(),
            "consensus": consensus.to_dict() if consensus else None
        }
    
    def run_experiment(self, policy: str = "adaptive") -> ExperimentResult:
        """
        Run complete experiment with all questions.
        
        Args:
            policy: "adaptive" or "static"
            
        Returns:
            ExperimentResult with complete analysis
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        experiment_id = f"rigorous_{policy}_{timestamp}"
        
        question_results = []
        total_debates = 0
        discussions_triggered = 0
        
        for question in self.questions:
            result = self.run_question(question, policy)
            question_results.append(result)
            
            if result["action"] == "peer_discussion":
                discussions_triggered += 1
                total_debates += result["num_debates"]
        
        # Aggregate metrics
        avg_correctness = sum(q["final_correct_rate"] for q in question_results) / len(question_results)
        avg_confidence = sum(q["avg_confidence"] for q in question_results) / len(question_results)
        discussion_rate = discussions_triggered / len(self.questions)
        
        # Learning analysis
        summary = self.learning_tracker.summary_report()
        genuine_learning = sum(
            q["class_metrics"]["genuine_learning_count"] 
            for q in question_results
        )
        superficial_learning = sum(
            q["class_metrics"]["superficial_learning_count"]
            for q in question_results
        )
        
        # Calculate genuine learning gain
        initial_rates = [q["initial_correct_rate"] for q in question_results]
        final_rates = [q["final_correct_rate"] for q in question_results]
        genuine_gain = sum(f - i for i, f in zip(initial_rates, final_rates)) / len(self.questions)
        
        # Debate outcome analysis
        positive_outcomes = sum(
            1 for d in self.debate_engine.debate_log
            if d._compute_outcome() == "correct_convinced_wrong"
        )
        negative_outcomes = sum(
            1 for d in self.debate_engine.debate_log
            if d._compute_outcome() == "wrong_convinced_correct"
        )
        
        return ExperimentResult(
            experiment_id=experiment_id,
            policy_name=policy,
            num_students=self.num_students,
            num_questions=len(self.questions),
            timestamp=timestamp,
            avg_correctness=avg_correctness,
            avg_confidence=avg_confidence,
            discussion_rate=discussion_rate,
            genuine_learning_gain=genuine_gain,
            question_results=question_results,
            total_debates=total_debates,
            positive_debate_outcomes=positive_outcomes,
            negative_debate_outcomes=negative_outcomes,
            genuine_learning_events=genuine_learning,
            superficial_learning_events=superficial_learning
        )
    
    def save_results(self, result: ExperimentResult, output_dir: str):
        """Save experiment results to files."""
        os.makedirs(output_dir, exist_ok=True)
        
        # Main results
        result_path = os.path.join(output_dir, f"{result.experiment_id}.json")
        with open(result_path, 'w') as f:
            json.dump(result.to_dict(), f, indent=2)
        
        # Debate transcripts
        debate_path = os.path.join(output_dir, f"{result.experiment_id}_debates.json")
        self.debate_engine.save_debates(debate_path)
        
        # Learning events
        learning_path = os.path.join(output_dir, f"{result.experiment_id}_learning.json")
        self.learning_tracker.save_events(learning_path)
        
        return result_path


def run_comparison_experiment(
    num_students: int = 20,
    output_dir: str = None
) -> Tuple[ExperimentResult, ExperimentResult]:
    """
    Run comparison experiment between adaptive and static policies.
    
    Args:
        num_students: Number of students to simulate
        output_dir: Directory to save results
        
    Returns:
        Tuple of (adaptive_result, static_result)
    """
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), "..", "experiments", "results")
    
    # Run adaptive experiment
    print(f"Running rigorous adaptive experiment with {num_students} students...")
    exp_adaptive = RigorousExperiment(num_students=num_students)
    result_adaptive = exp_adaptive.run_experiment(policy="adaptive")
    exp_adaptive.save_results(result_adaptive, output_dir)
    
    # Run static experiment (fresh students)
    print(f"Running rigorous static experiment with {num_students} students...")
    exp_static = RigorousExperiment(num_students=num_students)
    result_static = exp_static.run_experiment(policy="static")
    exp_static.save_results(result_static, output_dir)
    
    # Print comparison
    print("\n" + "="*60)
    print("RIGOROUS EXPERIMENT COMPARISON")
    print("="*60)
    print(f"\n{'Metric':<30} {'Adaptive':>12} {'Static':>12}")
    print("-"*54)
    print(f"{'Avg Correctness':<30} {result_adaptive.avg_correctness:>11.1%} {result_static.avg_correctness:>11.1%}")
    print(f"{'Discussion Rate':<30} {result_adaptive.discussion_rate:>11.1%} {result_static.discussion_rate:>11.1%}")
    print(f"{'Genuine Learning Gain':<30} {result_adaptive.genuine_learning_gain:>11.3f} {result_static.genuine_learning_gain:>11.3f}")
    print(f"{'Genuine Learning Events':<30} {result_adaptive.genuine_learning_events:>12} {result_static.genuine_learning_events:>12}")
    print(f"{'Superficial Learning Events':<30} {result_adaptive.superficial_learning_events:>12} {result_static.superficial_learning_events:>12}")
    print(f"{'Positive Debate Outcomes':<30} {result_adaptive.positive_debate_outcomes:>12} {result_static.positive_debate_outcomes:>12}")
    print(f"{'Negative Debate Outcomes':<30} {result_adaptive.negative_debate_outcomes:>12} {result_static.negative_debate_outcomes:>12}")
    print("="*60)
    
    return result_adaptive, result_static


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run rigorous peer instruction experiment")
    parser.add_argument("--students", type=int, default=10, help="Number of students")
    parser.add_argument("--policy", type=str, default="adaptive", choices=["adaptive", "static", "compare"])
    parser.add_argument("--output", type=str, default=None, help="Output directory")
    
    args = parser.parse_args()
    
    if args.policy == "compare":
        run_comparison_experiment(args.students, args.output)
    else:
        exp = RigorousExperiment(num_students=args.students)
        result = exp.run_experiment(policy=args.policy)
        
        if args.output:
            exp.save_results(result, args.output)
        
        print(f"\nExperiment Complete: {result.experiment_id}")
        print(f"  Correctness: {result.avg_correctness:.1%}")
        print(f"  Genuine Learning: {result.genuine_learning_events} events")
        print(f"  Debates: {result.total_debates} total")

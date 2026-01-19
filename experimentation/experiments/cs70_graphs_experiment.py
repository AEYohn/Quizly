"""
CS 70 Graphs Experiment
AI-powered classroom simulation for CS 70 Discrete Math - Graph Theory.
"""

import os
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

# Add parent to path for imports
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulation.llm_student import LLMStudent, generate_llm_students
from simulation.session_simulator import SessionSimulator
from ai_agents.teaching_policy import TeachingPolicy, StaticPolicy, TeachingAction
from ai_agents.question_designer import QuestionDesigner


# CS 70 Graph Theory Concepts
CS70_GRAPHS_CONCEPTS = [
    "bfs_traversal",
    "dfs_traversal", 
    "graph_connectivity",
    "cycle_detection",
    "tree_properties",
    "bipartite_graphs"
]

CS70_GRAPHS_QUESTIONS = [
    {
        "concept": "bfs_traversal",
        "difficulty": 0.4,
        "type": "mcq",
        "prompt": "In BFS starting from vertex A, which data structure determines the order vertices are visited?",
        "options": ["A. Queue (FIFO)", "B. Stack (LIFO)", "C. Priority Queue", "D. Hash Set"],
        "correct_answer": "A",
        "explanation": "BFS uses a queue (FIFO) to explore vertices level by level. DFS uses a stack."
    },
    {
        "concept": "dfs_traversal",
        "difficulty": 0.45,
        "type": "mcq",
        "prompt": "When performing DFS on a graph, a vertex is marked as visited:",
        "options": [
            "A. When it is first discovered and pushed to stack",
            "B. When all its neighbors have been explored",
            "C. When it is popped from the stack",
            "D. Only if it has no outgoing edges"
        ],
        "correct_answer": "A",
        "explanation": "A vertex is marked visited when first discovered to prevent revisiting."
    },
    {
        "concept": "graph_connectivity",
        "difficulty": 0.5,
        "type": "mcq",
        "prompt": "A directed graph with n vertices is strongly connected if:",
        "options": [
            "A. There is a path from every vertex to every other vertex",
            "B. The underlying undirected graph is connected",
            "C. It contains at least n-1 edges",
            "D. It has no cycles"
        ],
        "correct_answer": "A",
        "explanation": "Strongly connected means bidirectional reachability between all pairs."
    },
    {
        "concept": "cycle_detection",
        "difficulty": 0.55,
        "type": "mcq",
        "prompt": "To detect a cycle in an undirected graph using DFS, we check if:",
        "options": [
            "A. We visit a vertex already in the current DFS path (excluding parent)",
            "B. Any vertex has more than one neighbor",
            "C. The number of edges equals the number of vertices",
            "D. We can return to the starting vertex"
        ],
        "correct_answer": "A",
        "explanation": "A back edge to a non-parent visited vertex indicates a cycle."
    },
    {
        "concept": "tree_properties",
        "difficulty": 0.5,
        "type": "mcq",
        "prompt": "Which statement is TRUE about a tree with n vertices?",
        "options": [
            "A. It has exactly n-1 edges and is connected",
            "B. It has exactly n edges and no cycles",
            "C. It must have a root vertex",
            "D. Every vertex must have degree at least 2"
        ],
        "correct_answer": "A",
        "explanation": "A tree is a connected graph with exactly n-1 edges and no cycles."
    },
    {
        "concept": "bipartite_graphs",
        "difficulty": 0.6,
        "type": "mcq",
        "prompt": "A graph is bipartite if and only if:",
        "options": [
            "A. It contains no odd-length cycles",
            "B. It can be colored with exactly 2 colors",
            "C. Both A and B are correct",
            "D. It has an even number of vertices"
        ],
        "correct_answer": "C",
        "explanation": "Bipartite ⟺ 2-colorable ⟺ no odd cycles. All three are equivalent."
    },
    {
        "concept": "bfs_traversal",
        "difficulty": 0.6,
        "type": "mcq",
        "prompt": "BFS finds the shortest path in terms of number of edges when:",
        "options": [
            "A. All edges have equal weight (unweighted graph)",
            "B. The graph is a tree",
            "C. The graph is directed",
            "D. Always, regardless of edge weights"
        ],
        "correct_answer": "A",
        "explanation": "BFS gives shortest path only in unweighted graphs. For weighted, use Dijkstra's."
    },
    {
        "concept": "dfs_traversal",
        "difficulty": 0.65,
        "type": "mcq",
        "prompt": "In DFS on a directed graph, a 'back edge' indicates:",
        "options": [
            "A. The graph contains a cycle",
            "B. The graph is not connected",
            "C. A vertex was visited twice",
            "D. The algorithm needs to backtrack"
        ],
        "correct_answer": "A",
        "explanation": "A back edge from descendant to ancestor in DFS tree proves a cycle exists."
    }
]


@dataclass
class ExperimentResult:
    """Results from a single experiment run."""
    experiment_id: str
    policy_name: str
    num_students: int
    num_questions: int
    
    # Metrics
    avg_correctness: float
    avg_confidence: float
    discussion_rate: float  # % of questions triggering discussion
    learning_gain: float   # Post - Pre mastery
    
    # Timing
    duration_seconds: float
    timestamp: str
    
    # Detailed results
    question_results: List[Dict]
    final_mastery: Dict[str, float]  # concept -> avg mastery


class CS70GraphsExperiment:
    """
    Run AI-powered classroom simulation experiments.
    """
    
    def __init__(
        self,
        num_students: int = 30,
        student_distribution: str = "realistic",
        use_llm: bool = True
    ):
        self.num_students = num_students
        self.student_distribution = student_distribution
        self.use_llm = use_llm
        self.results_dir = os.path.join(
            os.path.dirname(__file__), "results"
        )
        os.makedirs(self.results_dir, exist_ok=True)
    
    def run_experiment(
        self,
        policy: TeachingPolicy,
        questions: Optional[List[Dict]] = None
    ) -> ExperimentResult:
        """
        Run a single experiment with the given policy.
        
        Args:
            policy: Teaching policy to use
            questions: Optional custom questions (default: CS70 graphs)
            
        Returns:
            ExperimentResult with metrics
        """
        start_time = time.time()
        questions = questions or CS70_GRAPHS_QUESTIONS
        
        # Generate student cohort
        students = generate_llm_students(
            n=self.num_students,
            concepts=CS70_GRAPHS_CONCEPTS,
            distribution=self.student_distribution
        )
        
        # Record pre-experiment mastery
        pre_mastery = self._calculate_avg_mastery(students)
        
        # Run session
        question_results = []
        actions_taken = []
        
        for q_idx, question in enumerate(questions):
            print(f"  Question {q_idx + 1}/{len(questions)}: {question['concept']}")
            
            # Collect responses from all students
            responses = []
            for student in students:
                response = student.answer_question(question, use_llm=self.use_llm)
                responses.append(response)
            
            # Calculate question metrics
            correctness_rate = sum(1 for r in responses if r["is_correct"]) / len(responses)
            avg_confidence = sum(r["confidence"] for r in responses) / len(responses)
            entropy = self._calculate_entropy(responses, question.get("options", []))
            
            q_result = {
                "question_idx": q_idx,
                "concept": question["concept"],
                "difficulty": question["difficulty"],
                "correctness_rate": round(correctness_rate, 3),
                "avg_confidence": round(avg_confidence, 3),
                "entropy": round(entropy, 3),
                "responses": responses
            }
            
            # Get policy decision
            action = policy.decide_action(q_result, use_llm=self.use_llm)
            q_result["action"] = action["action"].value
            q_result["action_reason"] = action.get("reason", "")
            
            question_results.append(q_result)
            actions_taken.append(action["action"])
            
            # Simulate learning based on action
            if action["action"] == TeachingAction.PEER_DISCUSSION:
                self._simulate_peer_discussion(students, question["concept"], responses)
            elif action["action"] == TeachingAction.REMEDIATE:
                self._simulate_remediation(students, question["concept"])
        
        # Calculate post-experiment mastery
        post_mastery = self._calculate_avg_mastery(students)
        learning_gain = {
            concept: post_mastery[concept] - pre_mastery[concept]
            for concept in CS70_GRAPHS_CONCEPTS
        }
        
        # Calculate summary metrics
        avg_correctness = sum(q["correctness_rate"] for q in question_results) / len(question_results)
        avg_confidence = sum(q["avg_confidence"] for q in question_results) / len(question_results)
        discussion_rate = sum(1 for a in actions_taken if a == TeachingAction.PEER_DISCUSSION) / len(actions_taken)
        total_learning_gain = sum(learning_gain.values()) / len(learning_gain)
        
        duration = time.time() - start_time
        
        result = ExperimentResult(
            experiment_id=f"{policy.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            policy_name=policy.name,
            num_students=self.num_students,
            num_questions=len(questions),
            avg_correctness=round(avg_correctness, 3),
            avg_confidence=round(avg_confidence, 3),
            discussion_rate=round(discussion_rate, 3),
            learning_gain=round(total_learning_gain, 4),
            duration_seconds=round(duration, 2),
            timestamp=datetime.now().isoformat(),
            question_results=question_results,
            final_mastery={c: round(post_mastery[c], 3) for c in CS70_GRAPHS_CONCEPTS}
        )
        
        # Save results
        self._save_result(result)
        
        return result
    
    def _calculate_avg_mastery(self, students: List[LLMStudent]) -> Dict[str, float]:
        """Calculate average mastery across all students per concept."""
        mastery = {c: 0.0 for c in CS70_GRAPHS_CONCEPTS}
        for student in students:
            for concept in CS70_GRAPHS_CONCEPTS:
                mastery[concept] += student.mastery.get(concept, 0.5)
        return {c: m / len(students) for c, m in mastery.items()}
    
    def _calculate_entropy(self, responses: List[Dict], options: List[str]) -> float:
        """Calculate Shannon entropy of response distribution."""
        import math
        if not responses or not options:
            return 0.0
        
        counts = {}
        for r in responses:
            ans = r.get("answer", "")
            counts[ans] = counts.get(ans, 0) + 1
        
        total = len(responses)
        entropy = 0.0
        for count in counts.values():
            if count > 0:
                p = count / total
                entropy -= p * math.log2(p)
        
        max_entropy = math.log2(len(options)) if len(options) > 1 else 1
        return entropy / max_entropy if max_entropy > 0 else 0.0
    
    def _simulate_peer_discussion(
        self,
        students: List[LLMStudent],
        concept: str,
        responses: List[Dict]
    ):
        """Simulate learning from peer discussion."""
        # Pair students with different answers
        correct_students = [r for r in responses if r["is_correct"]]
        incorrect_students = [r for r in responses if not r["is_correct"]]
        
        # Learning happens for incorrect students who discuss with correct ones
        for student in students:
            if any(r["student_id"] == student.id and not r["is_correct"] for r in responses):
                # This student got it wrong, simulate learning
                student.learn_from_discussion(
                    concept,
                    "Correct explanation from peer",
                    [r["rationale"] for r in correct_students[:3]]
                )
    
    def _simulate_remediation(self, students: List[LLMStudent], concept: str):
        """Simulate learning from teacher remediation."""
        for student in students:
            # Everyone gets a small boost from clear explanation
            delta = 0.05 + (0.1 * (1 - student.mastery.get(concept, 0.5)))
            student.update_mastery(concept, delta)
    
    def _save_result(self, result: ExperimentResult):
        """Save experiment result to JSON file."""
        filepath = os.path.join(
            self.results_dir,
            f"{result.experiment_id}.json"
        )
        
        # Convert to dict, handling enums
        result_dict = asdict(result)
        
        with open(filepath, "w") as f:
            json.dump(result_dict, f, indent=2, default=str)
        
        print(f"  Results saved to: {filepath}")


def run_comparison_experiment():
    """Run comparison between static and adaptive policies."""
    print("=" * 60)
    print("CS 70 Graphs - AI Classroom Simulation Experiment")
    print("=" * 60)
    
    experiment = CS70GraphsExperiment(
        num_students=30,
        student_distribution="realistic",
        use_llm=True
    )
    
    # Run static policy
    print("\n[1/2] Running STATIC policy...")
    static_policy = StaticPolicy()
    static_result = experiment.run_experiment(static_policy)
    
    # Run adaptive policy
    print("\n[2/2] Running ADAPTIVE policy...")
    adaptive_policy = TeachingPolicy(name="adaptive")
    adaptive_result = experiment.run_experiment(adaptive_policy)
    
    # Print comparison
    print("\n" + "=" * 60)
    print("COMPARISON RESULTS")
    print("=" * 60)
    print(f"\n{'Metric':<25} {'Static':>12} {'Adaptive':>12} {'Δ':>10}")
    print("-" * 60)
    print(f"{'Avg Correctness':<25} {static_result.avg_correctness:>11.1%} {adaptive_result.avg_correctness:>11.1%} {adaptive_result.avg_correctness - static_result.avg_correctness:>+9.1%}")
    print(f"{'Avg Confidence':<25} {static_result.avg_confidence:>11.1%} {adaptive_result.avg_confidence:>11.1%} {adaptive_result.avg_confidence - static_result.avg_confidence:>+9.1%}")
    print(f"{'Discussion Rate':<25} {static_result.discussion_rate:>11.1%} {adaptive_result.discussion_rate:>11.1%} {adaptive_result.discussion_rate - static_result.discussion_rate:>+9.1%}")
    print(f"{'Learning Gain':<25} {static_result.learning_gain:>11.4f} {adaptive_result.learning_gain:>11.4f} {adaptive_result.learning_gain - static_result.learning_gain:>+9.4f}")
    print(f"{'Duration (sec)':<25} {static_result.duration_seconds:>11.1f} {adaptive_result.duration_seconds:>11.1f}")
    
    print("\n✅ Experiment complete!")
    return static_result, adaptive_result


if __name__ == "__main__":
    run_comparison_experiment()

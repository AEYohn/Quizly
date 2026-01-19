#!/usr/bin/env python3
"""
Full CS70 Graphs Lesson Simulation
==================================
Complete end-to-end peer instruction simulation showing:
1. Class roster with student personas
2. Each question with AI-generated student responses
3. Peer discussion decisions
4. Multi-turn debates with full transcripts
5. Learning outcomes and visualizations

Run with: python run_full_lesson.py
"""

import os
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Tuple

# Set API key before imports
os.environ['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY', '')

from simulation.reasoning_student import (
    ReasoningStudent, 
    ReasoningChain,
    DebatePosition,
    generate_reasoning_students,
    Misconception,
    PERSONA_TEMPLATES
)
from simulation.debate_engine import DebateEngine, DebateResult
from simulation.learning_tracker import LearningTracker, ClassLearningMetrics
from simulation.rigorous_experiment import CS70_QUESTIONS

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np


# ============================================================================
# LESSON CONFIGURATION
# ============================================================================

LESSON_CONFIG = {
    "course": "CS 70 - Discrete Mathematics and Probability Theory",
    "topic": "Graph Algorithms",
    "instructor": "Prof. Rao (AI Simulation)",
    "num_students": 12,
    "questions_to_use": 6,  # Use first N questions
    "max_debate_turns": 2,
    "output_dir": "lesson_simulation_output",
    "distribution": "struggling"  # More novice students = more debates
}


# ============================================================================
# PRETTY PRINTING UTILITIES
# ============================================================================

def print_header(text: str, char: str = "="):
    """Print a formatted header."""
    width = 80
    print("\n" + char * width)
    print(f" {text}")
    print(char * width)


def print_subheader(text: str):
    """Print a formatted subheader."""
    print(f"\n{'─' * 60}")
    print(f"  {text}")
    print(f"{'─' * 60}")


def print_student_response(student: ReasoningStudent, answer: str, 
                          reasoning: ReasoningChain, correct_answer: str):
    """Pretty print a student's response."""
    is_correct = answer.startswith(correct_answer[0])
    status = "✓" if is_correct else "✗"
    
    print(f"\n  [{student.name}] ({student.persona_type})")
    print(f"  Answer: {answer} {status}")
    print(f"  Confidence: {reasoning.confidence:.0%}")
    print(f"  Reasoning:")
    for i, step in enumerate(reasoning.steps[:3], 1):
        print(f"    {i}. {step[:100]}{'...' if len(step) > 100 else ''}")
    if reasoning.misconceptions_used:
        print(f"  ⚠ Used misconception: {reasoning.misconceptions_used[0][:60]}...")


def print_debate_turn(turn_num: int, speaker: str, argument: str, changed: bool):
    """Pretty print a debate turn."""
    change_icon = "💡 CHANGED MIND" if changed else ""
    print(f"\n    Turn {turn_num} - {speaker}: {change_icon}")
    print(f"    \"{argument[:150]}{'...' if len(argument) > 150 else ''}\"")


# ============================================================================
# MAIN SIMULATION
# ============================================================================

class FullLessonSimulation:
    """Run a complete peer instruction lesson simulation."""
    
    def __init__(self, config: Dict):
        self.config = config
        self.output_dir = config["output_dir"]
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Initialize components
        self.questions = CS70_QUESTIONS[:config["questions_to_use"]]
        self.concepts = list(set(q["concept"] for q in self.questions))
        
        self.students = generate_reasoning_students(
            config["num_students"],
            self.concepts,
            distribution=config.get("distribution", "realistic")
        )
        
        self.debate_engine = DebateEngine(max_turns=config["max_debate_turns"])
        self.learning_tracker = LearningTracker(use_llm_grading=True)
        
        # Results storage
        self.lesson_transcript = []
        self.question_results = []
        self.all_debates = []
        
    def print_class_roster(self):
        """Display the simulated class roster."""
        print_header("CLASS ROSTER", "═")
        print(f"\n  Course: {self.config['course']}")
        print(f"  Topic: {self.config['topic']}")
        print(f"  Instructor: {self.config['instructor']}")
        print(f"  Students: {len(self.students)}")
        print(f"  Questions: {len(self.questions)}")
        
        print("\n  Student Profiles:")
        print("  " + "-" * 70)
        
        persona_counts = {}
        for student in self.students:
            persona_counts[student.persona_type] = persona_counts.get(student.persona_type, 0) + 1
            misconceptions = [m.name for m in student.active_misconceptions]
            misc_str = ", ".join(misconceptions[:2]) if misconceptions else "None"
            print(f"  {student.name:15} | {student.persona_type:12} | Misconceptions: {misc_str}")
        
        print("\n  Persona Distribution:")
        for persona, count in sorted(persona_counts.items()):
            bar = "█" * count
            print(f"    {persona:15}: {bar} ({count})")
    
    def run_question(self, q_num: int, question: Dict) -> Dict:
        """Run a single question through the peer instruction cycle."""
        correct_answer = question["correct_answer"]
        
        print_header(f"QUESTION {q_num}: {question['concept'].upper()}", "═")
        print(f"\n  📝 {question['prompt']}")
        print("\n  Options:")
        for opt in question['options']:
            marker = "→" if opt.startswith(correct_answer) else " "
            print(f"    {marker} {opt}")
        print(f"\n  (Correct: {correct_answer})")
        
        # PHASE 1: Initial Responses
        print_subheader("PHASE 1: Individual Responses")
        
        initial_responses: Dict[int, Tuple[str, ReasoningChain]] = {}
        correct_count = 0
        
        for student in self.students:
            answer, reasoning = student.reason_about_question(question)
            initial_responses[student.id] = (answer, reasoning)
            
            if answer.startswith(correct_answer[0]):
                correct_count += 1
            
            print_student_response(student, answer, reasoning, correct_answer)
            time.sleep(0.1)  # Small delay for API rate limiting
        
        initial_rate = correct_count / len(self.students)
        print(f"\n  📊 Initial Results: {correct_count}/{len(self.students)} correct ({initial_rate:.0%})")
        
        # PHASE 2: Decision
        print_subheader("PHASE 2: Instructor Decision")
        
        # Calculate answer distribution
        answer_dist = {}
        for ans, _ in initial_responses.values():
            key = ans[0] if ans else "?"
            answer_dist[key] = answer_dist.get(key, 0) + 1
        
        print(f"\n  Answer Distribution: {answer_dist}")
        
        # Decision logic
        if 0.15 <= (1 - initial_rate) <= 0.85:
            action = "PEER_DISCUSSION"
            reason = f"Split responses detected - ideal for peer instruction"
        elif initial_rate < 0.15:
            action = "PEER_DISCUSSION"
            reason = f"Very low correctness ({initial_rate:.0%}) - discussion may help"
        else:
            action = "MOVE_ON"
            reason = f"High correctness ({initial_rate:.0%}) - class understands"
        
        print(f"\n  🎯 Decision: {action}")
        print(f"     Reason: {reason}")
        
        final_responses = initial_responses.copy()
        debates = []
        
        # PHASE 3: Peer Discussion (if triggered)
        if action == "PEER_DISCUSSION":
            print_subheader("PHASE 3: Peer Discussion & Debate")
            
            # Pair students
            pairs = self.debate_engine.pair_students(self.students, initial_responses)
            print(f"\n  Formed {len(pairs)} debate pairs")
            
            for pair_num, (student_a, student_b) in enumerate(pairs, 1):
                ans_a, chain_a = initial_responses[student_a.id]
                ans_b, chain_b = initial_responses[student_b.id]
                
                print(f"\n  ╔══ DEBATE {pair_num}: {student_a.name} vs {student_b.name} ══╗")
                print(f"  │ {student_a.name}: {ans_a} (conf: {chain_a.confidence:.0%})")
                print(f"  │ {student_b.name}: {ans_b} (conf: {chain_b.confidence:.0%})")
                
                # Run debate
                debate = self.debate_engine.run_debate(
                    student_a, student_b, question, initial_responses
                )
                debates.append(debate)
                
                # Print debate turns
                for turn in debate.turns:
                    print_debate_turn(
                        turn.turn_number,
                        turn.speaker_name,
                        turn.argument if hasattr(turn, 'argument') else turn.position.reasoning_chain.conclusion,
                        turn.changed_mind
                    )
                
                # Update final responses
                final_responses[student_a.id] = (
                    debate.final_positions[student_a.id],
                    chain_a  # Keep original chain for now
                )
                final_responses[student_b.id] = (
                    debate.final_positions[student_b.id],
                    chain_b
                )
                
                outcome = debate._compute_outcome()
                outcome_icons = {
                    "correct_convinced_wrong": "✓ Correct convinced wrong!",
                    "wrong_convinced_correct": "✗ Wrong convinced correct!",
                    "both_correct_initially": "= Both already correct",
                    "both_wrong_stayed_wrong": "✗ Both still wrong",
                    "no_change": "- No minds changed"
                }
                print(f"  ╚══ Outcome: {outcome_icons.get(outcome, outcome)} ══╝")
        
        # PHASE 4: Final Results
        print_subheader("PHASE 4: Final Results")
        
        final_correct = sum(
            1 for ans, _ in final_responses.values()
            if ans.startswith(correct_answer[0])
        )
        final_rate = final_correct / len(self.students)
        
        print(f"\n  Initial: {correct_count}/{len(self.students)} ({initial_rate:.0%})")
        print(f"  Final:   {final_correct}/{len(self.students)} ({final_rate:.0%})")
        
        gain = final_rate - initial_rate
        if gain > 0:
            print(f"  📈 Learning Gain: +{gain:.1%}")
        elif gain < 0:
            print(f"  📉 Learning Loss: {gain:.1%}")
        else:
            print(f"  ➡️  No Change")
        
        # Store results
        result = {
            "question_id": question["id"],
            "concept": question["concept"],
            "initial_rate": initial_rate,
            "final_rate": final_rate,
            "learning_gain": gain,
            "action": action,
            "num_debates": len(debates),
            "debates": debates
        }
        
        self.question_results.append(result)
        self.all_debates.extend(debates)
        
        return result
    
    def run_full_lesson(self):
        """Run the complete lesson."""
        start_time = datetime.now()
        
        print("\n" + "█" * 80)
        print("█" + " " * 78 + "█")
        print("█" + "  QUIZLY - PEER INSTRUCTION SIMULATION  ".center(78) + "█")
        print("█" + f"  {self.config['topic']} Lesson  ".center(78) + "█")
        print("█" + " " * 78 + "█")
        print("█" * 80)
        
        # Show class roster
        self.print_class_roster()
        
        # Run each question
        for i, question in enumerate(self.questions, 1):
            print(f"\n\n{'▼' * 80}")
            self.run_question(i, question)
            print(f"{'▲' * 80}")
        
        # Final Summary
        self.print_lesson_summary()
        
        # Generate visualizations
        self.generate_visualizations()
        
        # Save transcript
        self.save_results()
        
        elapsed = (datetime.now() - start_time).total_seconds()
        print(f"\n⏱️  Total simulation time: {elapsed:.1f} seconds")
    
    def print_lesson_summary(self):
        """Print lesson summary statistics."""
        print_header("LESSON SUMMARY", "═")
        
        total_initial = sum(r["initial_rate"] for r in self.question_results)
        total_final = sum(r["final_rate"] for r in self.question_results)
        n = len(self.question_results)
        
        avg_initial = total_initial / n
        avg_final = total_final / n
        avg_gain = avg_final - avg_initial
        
        print(f"\n  📊 Overall Performance:")
        print(f"     Average Initial Correctness: {avg_initial:.1%}")
        print(f"     Average Final Correctness:   {avg_final:.1%}")
        print(f"     Average Learning Gain:       {avg_gain:+.1%}")
        
        print(f"\n  🗣️  Discussion Statistics:")
        discussions = sum(1 for r in self.question_results if r["action"] == "PEER_DISCUSSION")
        print(f"     Questions with Discussion: {discussions}/{n}")
        print(f"     Total Debates Conducted:   {len(self.all_debates)}")
        
        # Debate outcomes
        outcomes = {}
        for debate in self.all_debates:
            outcome = debate._compute_outcome()
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
        
        if outcomes:
            print(f"\n  🎯 Debate Outcomes:")
            for outcome, count in sorted(outcomes.items(), key=lambda x: -x[1]):
                print(f"     {outcome}: {count}")
        
        # Per-question breakdown
        print(f"\n  📋 Per-Question Results:")
        print(f"     {'Question':<30} {'Initial':>10} {'Final':>10} {'Gain':>10}")
        print(f"     {'-'*60}")
        for r in self.question_results:
            q_name = r["concept"][:28]
            print(f"     {q_name:<30} {r['initial_rate']:>9.0%} {r['final_rate']:>9.0%} {r['learning_gain']:>+9.1%}")
    
    def generate_visualizations(self):
        """Generate all lesson visualizations."""
        print_header("GENERATING VISUALIZATIONS", "═")
        
        viz_dir = os.path.join(self.output_dir, "visualizations")
        os.makedirs(viz_dir, exist_ok=True)
        
        # 1. Learning Gain Bar Chart
        self._plot_learning_gains(viz_dir)
        
        # 2. Class Performance Over Time
        self._plot_performance_timeline(viz_dir)
        
        # 3. Debate Outcomes Pie Chart
        self._plot_debate_outcomes(viz_dir)
        
        # 4. Student Performance Heatmap
        self._plot_student_heatmap(viz_dir)
        
        print(f"\n  📁 Visualizations saved to: {viz_dir}")
    
    def _plot_learning_gains(self, viz_dir: str):
        """Plot learning gains per question."""
        fig, ax = plt.subplots(figsize=(12, 6))
        
        questions = [r["concept"].replace("_", "\n") for r in self.question_results]
        initial = [r["initial_rate"] * 100 for r in self.question_results]
        final = [r["final_rate"] * 100 for r in self.question_results]
        
        x = np.arange(len(questions))
        width = 0.35
        
        bars1 = ax.bar(x - width/2, initial, width, label='Before Discussion', color='#3498db', alpha=0.8)
        bars2 = ax.bar(x + width/2, final, width, label='After Discussion', color='#2ecc71', alpha=0.8)
        
        ax.set_ylabel('Correctness (%)', fontsize=12)
        ax.set_title('Learning Gains Per Question', fontsize=14, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(questions, fontsize=9)
        ax.legend()
        ax.set_ylim(0, 110)
        
        # Add value labels
        for bar in bars1 + bars2:
            height = bar.get_height()
            ax.annotate(f'{height:.0f}%',
                       xy=(bar.get_x() + bar.get_width() / 2, height),
                       xytext=(0, 3),
                       textcoords="offset points",
                       ha='center', va='bottom', fontsize=8)
        
        plt.tight_layout()
        path = os.path.join(viz_dir, "learning_gains.png")
        plt.savefig(path, dpi=150)
        plt.close()
        print(f"  ✓ Saved: learning_gains.png")
    
    def _plot_performance_timeline(self, viz_dir: str):
        """Plot class performance over the lesson."""
        fig, ax = plt.subplots(figsize=(12, 6))
        
        questions = list(range(1, len(self.question_results) + 1))
        initial = [r["initial_rate"] * 100 for r in self.question_results]
        final = [r["final_rate"] * 100 for r in self.question_results]
        
        ax.plot(questions, initial, 'o-', color='#3498db', linewidth=2, 
                markersize=10, label='Before Discussion')
        ax.plot(questions, final, 's-', color='#2ecc71', linewidth=2, 
                markersize=10, label='After Discussion')
        
        # Fill between
        ax.fill_between(questions, initial, final, alpha=0.3, color='#2ecc71',
                       where=[f > i for i, f in zip(initial, final)])
        ax.fill_between(questions, initial, final, alpha=0.3, color='#e74c3c',
                       where=[f < i for i, f in zip(initial, final)])
        
        ax.set_xlabel('Question Number', fontsize=12)
        ax.set_ylabel('Correctness (%)', fontsize=12)
        ax.set_title('Class Performance Throughout Lesson', fontsize=14, fontweight='bold')
        ax.legend()
        ax.set_ylim(0, 105)
        ax.set_xticks(questions)
        
        plt.tight_layout()
        path = os.path.join(viz_dir, "performance_timeline.png")
        plt.savefig(path, dpi=150)
        plt.close()
        print(f"  ✓ Saved: performance_timeline.png")
    
    def _plot_debate_outcomes(self, viz_dir: str):
        """Plot debate outcomes distribution."""
        fig, ax = plt.subplots(figsize=(10, 8))
        
        outcomes = {}
        for debate in self.all_debates:
            outcome = debate._compute_outcome()
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
        
        if outcomes:
            labels = [o.replace("_", "\n") for o in outcomes.keys()]
            values = list(outcomes.values())
            
            colors = {
                "correct_convinced_wrong": "#27ae60",
                "wrong_convinced_correct": "#c0392b",
                "both_correct_initially": "#3498db",
                "both_wrong_stayed_wrong": "#e74c3c",
                "no_change": "#95a5a6"
            }
            pie_colors = [colors.get(o, "#9b59b6") for o in outcomes.keys()]
            
            wedges, texts, autotexts = ax.pie(values, labels=labels, autopct='%1.0f%%',
                                              colors=pie_colors, startangle=90,
                                              textprops={'fontsize': 10})
            ax.set_title('Debate Outcomes Distribution', fontsize=14, fontweight='bold')
        else:
            ax.text(0.5, 0.5, 'No debates conducted', ha='center', va='center', fontsize=14)
        
        plt.tight_layout()
        path = os.path.join(viz_dir, "debate_outcomes.png")
        plt.savefig(path, dpi=150)
        plt.close()
        print(f"  ✓ Saved: debate_outcomes.png")
    
    def _plot_student_heatmap(self, viz_dir: str):
        """Plot student performance heatmap."""
        fig, ax = plt.subplots(figsize=(14, 8))
        
        # For simplicity, show persona distribution and average performance
        personas = {}
        for student in self.students:
            if student.persona_type not in personas:
                personas[student.persona_type] = {"count": 0, "misconceptions": 0}
            personas[student.persona_type]["count"] += 1
            personas[student.persona_type]["misconceptions"] += len(student.active_misconceptions)
        
        persona_names = list(personas.keys())
        counts = [personas[p]["count"] for p in persona_names]
        avg_misconceptions = [personas[p]["misconceptions"] / personas[p]["count"] for p in persona_names]
        
        x = np.arange(len(persona_names))
        width = 0.35
        
        ax2 = ax.twinx()
        bars1 = ax.bar(x - width/2, counts, width, label='Student Count', color='#3498db', alpha=0.8)
        bars2 = ax2.bar(x + width/2, avg_misconceptions, width, label='Avg Misconceptions', color='#e74c3c', alpha=0.8)
        
        ax.set_ylabel('Number of Students', fontsize=12, color='#3498db')
        ax2.set_ylabel('Average Misconceptions', fontsize=12, color='#e74c3c')
        ax.set_title('Student Persona Distribution', fontsize=14, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(persona_names, fontsize=11)
        
        lines1, labels1 = ax.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax.legend(lines1 + lines2, labels1 + labels2, loc='upper right')
        
        plt.tight_layout()
        path = os.path.join(viz_dir, "student_distribution.png")
        plt.savefig(path, dpi=150)
        plt.close()
        print(f"  ✓ Saved: student_distribution.png")
    
    def save_results(self):
        """Save all results to files."""
        # Save transcript
        transcript_path = os.path.join(self.output_dir, "lesson_transcript.json")
        transcript_data = {
            "config": self.config,
            "timestamp": datetime.now().isoformat(),
            "num_students": len(self.students),
            "num_questions": len(self.questions),
            "question_results": [
                {
                    "question_id": r["question_id"],
                    "concept": r["concept"],
                    "initial_rate": r["initial_rate"],
                    "final_rate": r["final_rate"],
                    "learning_gain": r["learning_gain"],
                    "action": r["action"],
                    "num_debates": r["num_debates"]
                }
                for r in self.question_results
            ],
            "summary": {
                "avg_learning_gain": sum(r["learning_gain"] for r in self.question_results) / len(self.question_results),
                "total_debates": len(self.all_debates),
                "discussion_rate": sum(1 for r in self.question_results if r["action"] == "PEER_DISCUSSION") / len(self.question_results)
            }
        }
        
        with open(transcript_path, 'w') as f:
            json.dump(transcript_data, f, indent=2)
        
        print(f"\n  📄 Saved transcript: {transcript_path}")


def main():
    """Run the full lesson simulation."""
    print("\n🚀 Starting Full Lesson Simulation...")
    print("   This will take a few minutes with LLM reasoning.\n")
    
    simulation = FullLessonSimulation(LESSON_CONFIG)
    simulation.run_full_lesson()
    
    print("\n" + "█" * 80)
    print("  SIMULATION COMPLETE!")
    print("█" * 80)


if __name__ == "__main__":
    main()

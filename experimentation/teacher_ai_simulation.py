#!/usr/bin/env python3
"""
Teacher Dashboard AI Student Simulation
========================================
Runs the teacher dashboard with AI bot students to test the full
peer instruction experience from the teacher's perspective.

Topic: Predicates, Sets, and Proofs (CS70 Discrete Math)
"""

import os
import sys
import json
import time
import random
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

# Add parent path for imports
sys.path.insert(0, str(Path(__file__).parent))

import google.generativeai as genai

# Configure Gemini - REQUIRED (no fallback)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if not GEMINI_API_KEY:
    raise RuntimeError("❌ GEMINI_API_KEY environment variable is required! Set it before running.")

genai.configure(api_key=GEMINI_API_KEY)
MODEL = genai.GenerativeModel('gemini-2.0-flash')
print(f"✅ Gemini API configured (model: gemini-2.0-flash)")

# Import shared session from teacher dashboard
from gradio_teacher_dashboard import shared_session, ai_generate_session_plan


# ============================================================================
# AI STUDENT AGENT
# ============================================================================

class AIStudentBot:
    """An AI-powered student that answers questions using LLM reasoning."""
    
    def __init__(self, student_id: str, persona: str, skill_level: float):
        self.student_id = student_id
        self.persona = persona
        self.skill_level = skill_level  # 0.0 (struggling) to 1.0 (expert)
        
    def answer_question(self, question: Dict) -> Dict:
        """Generate an answer using LLM reasoning - with retries, NO FALLBACK."""
        
        prompt_text = question.get('prompt', '')
        options = question.get('options', [])
        correct_answer = question.get('correct_answer', 'A')
        
        # Build persona-aware prompt
        prompt = f"""You are a student named {self.student_id} with the following characteristics:
- Persona: {self.persona}
- Skill level: {self.skill_level:.0%} (0% = beginner, 100% = expert)

You are answering this question:
{prompt_text}

Options:
{chr(10).join(options)}

Based on your skill level:
- If skill < 40%: You often make common mistakes and may have misconceptions
- If skill 40-70%: You understand the basics but sometimes struggle with tricky questions
- If skill > 70%: You usually get it right but may overthink edge cases

Think through the problem step by step, then provide your answer.
BE REALISTIC - lower skill students should make plausible mistakes!

Return ONLY valid JSON (no markdown, no explanation before/after):
{{
    "selected_answer": "A",
    "reasoning": "Your step-by-step reasoning (2-3 sentences)",
    "confidence": 75
}}"""

        # Retry up to 3 times - AI is mandatory
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = MODEL.generate_content(prompt)
                text = response.text.strip()
                
                # Try to extract JSON
                start = text.find("{")
                end = text.rfind("}") + 1
                
                if start >= 0 and end > start:
                    json_str = text[start:end]
                    result = json.loads(json_str)
                    selected = result.get("selected_answer", "A")[0].upper()
                    
                    return {
                        "student_id": self.student_id,
                        "answer": selected,
                        "reasoning": result.get("reasoning", ""),
                        "confidence": result.get("confidence", 50),
                        "is_correct": selected == correct_answer[0].upper(),
                        "timestamp": datetime.now().isoformat()
                    }
            except json.JSONDecodeError as e:
                if attempt < max_retries - 1:
                    print(f"  [{self.student_id}] Retry {attempt + 1}/{max_retries} - JSON parse error")
                    time.sleep(0.5)
                    continue
                else:
                    print(f"  [{self.student_id}] Failed after {max_retries} attempts")
            except Exception as e:
                print(f"  [{self.student_id}] LLM error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(0.5)
                    continue
        
        # If all retries failed, raise an error (no silent fallback)
        raise RuntimeError(f"AI failed for {self.student_id} after {max_retries} attempts")


def generate_student_cohort(n: int = 15) -> List[AIStudentBot]:
    """Generate a diverse cohort of AI students."""
    
    personas = [
        ("Careful Casey", 0.75, "Methodical thinker, rarely rushes"),
        ("Quick Quinn", 0.55, "Fast but sometimes careless"),
        ("Struggling Sam", 0.35, "Still learning fundamentals"),
        ("Confident Chris", 0.80, "Usually right, sometimes overconfident"),
        ("Anxious Alex", 0.60, "Knows material but second-guesses"),
        ("Beginner Blake", 0.25, "Just started, many misconceptions"),
        ("Advanced Ava", 0.90, "Top of class, catches edge cases"),
        ("Visual Val", 0.70, "Needs to visualize concepts"),
        ("Abstract Andy", 0.85, "Loves formal definitions"),
        ("Practical Pat", 0.65, "Prefers concrete examples"),
        ("Questioning Quinn", 0.50, "Always asks 'why?'"),
        ("Memorizer Morgan", 0.45, "Memorizes but doesn't understand deeply"),
        ("Intuitive Ivy", 0.72, "Good intuition, weak on proofs"),
        ("Rigorous Riley", 0.88, "Precise but slow"),
        ("Creative Cam", 0.62, "Unconventional approaches"),
    ]
    
    students = []
    for i in range(min(n, len(personas))):
        name, skill, persona = personas[i]
        # Add some randomness to skill
        skill = max(0.1, min(0.95, skill + random.uniform(-0.1, 0.1)))
        students.append(AIStudentBot(name, persona, skill))
    
    return students


# ============================================================================
# SIMULATION RUNNER
# ============================================================================

class TeacherSimulation:
    """Runs a full teacher-side simulation with AI students."""
    
    def __init__(self, topic: str, concepts: List[str], num_students: int = 15, num_questions: int = 4):
        self.topic = topic
        self.concepts = concepts
        self.num_students = num_students
        self.num_questions = num_questions
        self.students = generate_student_cohort(num_students)
        self.results = []
        
    def run(self):
        """Run the full simulation."""
        print("\n" + "="*70)
        print("🎓 TEACHER DASHBOARD AI SIMULATION")
        print("="*70)
        print(f"\n📚 Topic: {self.topic}")
        print(f"📝 Concepts: {', '.join(self.concepts)}")
        print(f"👥 AI Students: {len(self.students)}")
        print("-"*70)
        
        # Step 1: Generate session plan
        print("\n📋 Step 1: Generating Session Plan with AI...")
        plan = ai_generate_session_plan(self.topic, self.concepts, self.num_questions)
        
        questions = plan.get('questions', [])
        if not questions:
            print("❌ Failed to generate questions!")
            return
        
        print(f"✅ Generated {len(questions)} questions:")
        for i, q in enumerate(questions):
            print(f"   Q{i+1}: {q.get('concept', '?')} (Difficulty: {q.get('difficulty', 0.5):.0%})")
        
        # Start shared session
        shared_session.start_session(self.topic, self.concepts, questions)
        print(f"\n📡 Session started: {shared_session.session_id}")
        
        # Step 2: Run through each question
        for q_idx, question in enumerate(questions):
            print(f"\n{'='*60}")
            print(f"📝 QUESTION {q_idx + 1}/{len(questions)}: {question.get('concept', '').replace('_', ' ').title()}")
            print(f"{'='*60}")
            print(f"\n{question.get('prompt', 'No prompt')}")
            print(f"\nCorrect Answer: {question.get('correct_answer', '?')}")
            print("-"*40)
            
            # Step 3: AI students answer
            print(f"\n🤖 AI Students answering...")
            responses = []
            for student in self.students:
                response = student.answer_question(question)
                responses.append(response)
                
                # Report to shared session
                shared_session.add_student_response(
                    student_id=response['student_id'],
                    question_idx=q_idx,
                    response=response
                )
                
                status = "✅" if response['is_correct'] else "❌"
                print(f"  {status} {response['student_id']}: {response['answer']} (conf: {response['confidence']}%)")
                
                # Small delay to avoid rate limiting
                time.sleep(0.2)
            
            # Step 4: Analyze responses
            correct_count = sum(1 for r in responses if r['is_correct'])
            correctness_rate = correct_count / len(responses)
            avg_confidence = sum(r['confidence'] for r in responses) / len(responses)
            
            # Calculate answer distribution
            answer_dist = {}
            for r in responses:
                ans = r['answer']
                answer_dist[ans] = answer_dist.get(ans, 0) + 1
            
            print(f"\n📊 Response Analysis:")
            print(f"   • Correct: {correct_count}/{len(responses)} ({correctness_rate:.0%})")
            print(f"   • Avg Confidence: {avg_confidence:.0f}%")
            print(f"   • Distribution: {answer_dist}")
            
            # Step 5: AI Recommendation
            if correctness_rate >= 0.8:
                recommendation = "MOVE_ON"
                reason = "High correctness - students understand this concept"
            elif correctness_rate <= 0.3:
                recommendation = "REMEDIATE"
                reason = "Low correctness - teacher explanation needed"
            else:
                recommendation = "PEER_DISCUSSION"
                reason = f"Split responses ({correctness_rate:.0%} correct) - perfect for peer learning"
            
            print(f"\n🤖 AI Recommendation: {recommendation}")
            print(f"   Reason: {reason}")
            
            # Store result
            self.results.append({
                "question_idx": q_idx,
                "concept": question.get('concept', ''),
                "correct_rate": correctness_rate,
                "avg_confidence": avg_confidence,
                "answer_distribution": answer_dist,
                "recommendation": recommendation,
                "responses": responses
            })
            
            # Update shared session
            shared_session.set_teacher_decision(q_idx, recommendation.lower(), reason)
            shared_session.current_question_idx = q_idx + 1
            
            print("-"*40)
            time.sleep(0.5)
        
        # Final Summary
        self._print_summary()
        
        return self.results
    
    def _print_summary(self):
        """Print final simulation summary."""
        print("\n" + "="*70)
        print("📈 SIMULATION SUMMARY")
        print("="*70)
        
        avg_correctness = sum(r['correct_rate'] for r in self.results) / len(self.results)
        avg_confidence = sum(r['avg_confidence'] for r in self.results) / len(self.results)
        
        recommendations = {}
        for r in self.results:
            rec = r['recommendation']
            recommendations[rec] = recommendations.get(rec, 0) + 1
        
        print(f"\n📊 Overall Metrics:")
        print(f"   • Average Correctness: {avg_correctness:.0%}")
        print(f"   • Average Confidence: {avg_confidence:.0f}%")
        print(f"   • Questions: {len(self.results)}")
        
        print(f"\n🎯 AI Recommendations:")
        for rec, count in recommendations.items():
            print(f"   • {rec}: {count}")
        
        print(f"\n👥 Student Performance:")
        student_scores = {}
        for r in self.results:
            for resp in r['responses']:
                sid = resp['student_id']
                if sid not in student_scores:
                    student_scores[sid] = {'correct': 0, 'total': 0}
                student_scores[sid]['total'] += 1
                if resp['is_correct']:
                    student_scores[sid]['correct'] += 1
        
        sorted_students = sorted(
            student_scores.items(),
            key=lambda x: x[1]['correct'] / x[1]['total'],
            reverse=True
        )
        
        for sid, scores in sorted_students[:5]:
            rate = scores['correct'] / scores['total']
            print(f"   • {sid}: {scores['correct']}/{scores['total']} ({rate:.0%})")
        
        print(f"\n   ... and {len(sorted_students) - 5} more students")
        print("="*70)


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Run the teacher simulation on Predicates, Sets, and Proofs."""
    
    # Topic configuration
    topic = "Predicates, Sets, and Proofs"
    concepts = [
        "predicate_logic",
        "set_operations", 
        "proof_techniques",
        "quantifiers"
    ]
    
    print("\n🚀 Starting Teacher Dashboard AI Simulation...")
    print(f"   Topic: {topic}")
    print(f"   Concepts: {concepts}")
    
    # Create and run simulation
    sim = TeacherSimulation(
        topic=topic,
        concepts=concepts,
        num_students=12,
        num_questions=4
    )
    
    results = sim.run()
    
    # Save results
    output_dir = Path(__file__).parent / "experiments" / "teacher_simulations"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = output_dir / f"predicates_proofs_{timestamp}.json"
    
    with open(output_file, 'w') as f:
        json.dump({
            "topic": topic,
            "concepts": concepts,
            "timestamp": timestamp,
            "results": results
        }, f, indent=2, default=str)
    
    print(f"\n💾 Results saved to: {output_file}")
    print("\n✅ Simulation complete! Open the Teacher Dashboard at http://localhost:7872 to explore.")


if __name__ == "__main__":
    main()

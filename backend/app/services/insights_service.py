"""
Comprehensive Game Insights Service
====================================
Generates deep AI-powered insights for teachers using:
- Misconception clustering and tagging
- Confidence calibration analysis
- Peer discussion analysis
- Learning progression tracking
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import Counter

from ..utils.llm_utils import GEMINI_AVAILABLE, call_gemini_with_timeout

# Add experimentation folder to path
EXPERIMENTATION_PATH = Path(__file__).parent.parent.parent.parent / "experimentation"
if str(EXPERIMENTATION_PATH) not in sys.path:
    sys.path.insert(0, str(EXPERIMENTATION_PATH))

# Import experimentation tools
try:
    from analytics.confidence_analyzer import ConfidenceAnalyzer, StudentResponse, create_response_from_dict  # noqa: F401
    from analytics.misconception_clusters import MisconceptionClusterer, ErrorInstance, create_error_from_response  # noqa: F401
    from ai_agents.misconception_tagger import MisconceptionTagger
    ANALYTICS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Analytics tools not available: {e}")
    ANALYTICS_AVAILABLE = False


class InsightsService:
    """Generate comprehensive game insights using AI and analytics."""

    def __init__(self):
        if ANALYTICS_AVAILABLE:
            self.confidence_analyzer = ConfidenceAnalyzer()
            self.misconception_clusterer = MisconceptionClusterer()
            self.misconception_tagger = MisconceptionTagger()

    async def generate_comprehensive_insights(
        self,
        game_data: Dict[str, Any],
        peer_discussions: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive insights from game data.

        Args:
            game_data: Full game data including players, answers, questions
            peer_discussions: Optional list of peer discussion sessions

        Returns:
            Comprehensive insights dictionary
        """
        # Extract data
        quiz_title = game_data.get("quiz_title", "Quiz")
        questions = game_data.get("questions", [])
        players = game_data.get("players", [])

        # Build detailed response list
        all_responses = []
        for player in players:
            for answer in player.get("answers", []):
                all_responses.append({
                    "student_id": hash(player.get("nickname", "")) % 100000,
                    "student_name": player.get("nickname", "Unknown"),
                    "question_id": str(answer.get("question_id", "")),
                    "question_text": answer.get("question_text", ""),
                    "answer": answer.get("answer", ""),
                    "is_correct": answer.get("is_correct", False),
                    "confidence": answer.get("confidence", 50) / 100,  # Convert to 0-1
                    "reasoning": answer.get("reasoning", ""),
                    "correct_answer": answer.get("correct_answer", ""),
                    "time_taken": answer.get("time_taken", 0),
                })

        # Generate insights in parallel
        insights = {
            "quiz_title": quiz_title,
            "total_players": len(players),
            "total_questions": len(questions),
            "total_responses": len(all_responses),
        }

        # 1. Overall Performance Analysis
        performance = self._analyze_performance(all_responses, questions)
        insights["performance"] = performance

        # 2. Confidence Calibration Analysis
        if ANALYTICS_AVAILABLE and all_responses:
            calibration = self._analyze_calibration(all_responses)
            insights["calibration"] = calibration

        # 3. Misconception Analysis
        if ANALYTICS_AVAILABLE:
            wrong_responses = [r for r in all_responses if not r.get("is_correct")]
            if wrong_responses:
                misconceptions = await self._analyze_misconceptions(wrong_responses, questions)
                insights["misconceptions"] = misconceptions

        # 4. Per-Question Analysis
        question_insights = self._analyze_questions(questions, all_responses)
        insights["question_analysis"] = question_insights

        # 5. Per-Student Analysis
        student_insights = self._analyze_students(players, all_responses)
        insights["student_analysis"] = student_insights

        # 6. Peer Discussion Insights
        if peer_discussions:
            discussion_insights = self._analyze_peer_discussions(peer_discussions)
            insights["peer_discussions"] = discussion_insights

        # 7. AI-Generated Recommendations
        ai_insights = await self._generate_ai_recommendations(insights)
        insights["ai_recommendations"] = ai_insights

        return insights

    def _analyze_performance(
        self,
        responses: List[Dict],
        questions: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze overall class performance."""
        if not responses:
            return {
                "overall_accuracy": 0,
                "avg_confidence": 50,
                "avg_time_per_question": 0,
                "completion_rate": 0,
            }

        correct = sum(1 for r in responses if r.get("is_correct"))
        total = len(responses)
        accuracy = correct / total if total > 0 else 0

        avg_confidence = sum(r.get("confidence", 0.5) for r in responses) / total * 100
        avg_time = sum(r.get("time_taken", 0) for r in responses) / total

        # Score distribution
        scores_by_student = {}
        for r in responses:
            student = r.get("student_name")
            if student not in scores_by_student:
                scores_by_student[student] = {"correct": 0, "total": 0}
            scores_by_student[student]["total"] += 1
            if r.get("is_correct"):
                scores_by_student[student]["correct"] += 1

        student_accuracies = [
            s["correct"] / s["total"] * 100
            for s in scores_by_student.values()
            if s["total"] > 0
        ]

        return {
            "overall_accuracy": round(accuracy * 100, 1),
            "avg_confidence": round(avg_confidence, 1),
            "avg_time_per_question": round(avg_time, 1),
            "total_correct": correct,
            "total_wrong": total - correct,
            "score_distribution": {
                "highest": max(student_accuracies) if student_accuracies else 0,
                "lowest": min(student_accuracies) if student_accuracies else 0,
                "median": sorted(student_accuracies)[len(student_accuracies)//2] if student_accuracies else 0,
            }
        }

    def _analyze_calibration(self, responses: List[Dict]) -> Dict[str, Any]:
        """Analyze confidence calibration across the class."""
        # Convert to StudentResponse objects
        student_responses = []
        for r in responses:
            student_responses.append(StudentResponse(
                student_id=r.get("student_id", 0),
                student_name=r.get("student_name", "Unknown"),
                question_id=r.get("question_id", ""),
                answer=r.get("answer", ""),
                is_correct=r.get("is_correct", False),
                confidence=r.get("confidence", 0.5),
                reasoning=r.get("reasoning"),
            ))

        # Run calibration analysis
        self.confidence_analyzer.add_responses(student_responses)
        report = self.confidence_analyzer.analyze(student_responses)

        # Summarize results
        overconfident = report.overconfident_wrong
        underconfident = report.underconfident_right

        # Find students with calibration issues
        problem_students = []
        for resp in overconfident[:5]:  # Top 5 overconfident responses
            problem_students.append({
                "student": resp.student_name,
                "issue": "overconfident",
                "confidence": round(resp.confidence * 100),
                "answer": resp.answer,
            })

        for resp in underconfident[:5]:  # Top 5 underconfident responses
            problem_students.append({
                "student": resp.student_name,
                "issue": "underconfident",
                "confidence": round(resp.confidence * 100),
                "answer": resp.answer,
            })

        return {
            "brier_score": round(report.brier_score, 3),
            "calibration_error": round(report.calibration_error, 3),
            "overconfident_wrong_count": len(overconfident),
            "underconfident_right_count": len(underconfident),
            "well_calibrated_count": len(report.well_calibrated),
            "calibration_status": self._get_calibration_status(report),
            "flagged_responses": problem_students,
            "calibration_curve": [
                {
                    "confidence_range": f"{int(b.confidence_range[0]*100)}-{int(b.confidence_range[1]*100)}%",
                    "count": b.count,
                    "accuracy": round(b.accuracy * 100, 1),
                }
                for b in report.buckets if b.count > 0
            ]
        }

    def _get_calibration_status(self, report) -> str:
        """Get overall calibration status description."""
        if report.calibration_error < 0.1:
            return "excellent"
        elif report.calibration_error < 0.2:
            return "good"
        elif report.calibration_error < 0.3:
            return "moderate"
        else:
            return "needs_improvement"

    async def _analyze_misconceptions(
        self,
        wrong_responses: List[Dict],
        questions: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze misconceptions across wrong answers."""
        # Build question lookup
        question_map = {str(q.get("id")): q for q in questions}

        # Create error instances for clustering
        errors = []
        for r in wrong_responses:
            q = question_map.get(r.get("question_id"), {})
            errors.append(ErrorInstance(
                student_id=r.get("student_id", 0),
                question_id=r.get("question_id", ""),
                concept=q.get("concept", "unknown"),
                wrong_answer=r.get("answer", ""),
                correct_answer=r.get("correct_answer", ""),
                reasoning=r.get("reasoning", ""),
                confidence=r.get("confidence", 0.5),
            ))

        # Cluster by answer pattern
        self.misconception_clusterer.add_errors(errors)
        clusters = self.misconception_clusterer.cluster_by_answer_pattern()

        # Label top clusters with LLM - but with actual question context
        labeled_clusters = []
        for cluster in clusters[:5]:  # Top 5 clusters
            if cluster.size >= 2:
                # Get actual question text for this cluster
                cluster_dict = cluster.to_dict()
                q_id = cluster.instances[0].question_id if cluster.instances else None
                q = question_map.get(q_id, {})

                # Generate better label using actual question
                if q and GEMINI_AVAILABLE:
                    try:
                        label_result = await self._label_misconception_with_context(
                            question_text=q.get("question_text", ""),
                            correct_answer=q.get("correct_answer", ""),
                            wrong_answer=cluster.instances[0].wrong_answer if cluster.instances else "",
                            student_count=cluster.size,
                            student_reasoning=[i.reasoning for i in cluster.instances[:3] if i.reasoning]
                        )
                        cluster_dict["label"] = label_result.get("label", cluster_dict["label"])
                        cluster_dict["description"] = label_result.get("description", cluster_dict["description"])
                        cluster_dict["suggested_intervention"] = label_result.get("intervention", "")
                    except Exception as e:
                        print(f"Label error: {e}")

                labeled_clusters.append(cluster_dict)

        # Find most common wrong answers per question
        wrong_by_question = {}
        for r in wrong_responses:
            q_id = r.get("question_id")
            if q_id not in wrong_by_question:
                wrong_by_question[q_id] = []
            wrong_by_question[q_id].append(r.get("answer"))

        common_mistakes = []
        for q_id, answers in wrong_by_question.items():
            q = question_map.get(q_id, {})
            answer_counts = Counter(answers)
            most_common = answer_counts.most_common(1)
            if most_common:
                common_mistakes.append({
                    "question": q.get("question_text", "")[:100],
                    "wrong_answer": most_common[0][0],
                    "count": most_common[0][1],
                    "correct_answer": q.get("correct_answer", ""),
                })

        return {
            "total_wrong_answers": len(wrong_responses),
            "unique_questions_missed": len(wrong_by_question),
            "misconception_clusters": labeled_clusters,
            "most_common_mistakes": sorted(common_mistakes, key=lambda x: -x["count"])[:5],
        }

    def _analyze_questions(
        self,
        questions: List[Dict],
        responses: List[Dict]
    ) -> List[Dict]:
        """Analyze performance per question."""
        question_stats = {}

        for r in responses:
            q_id = r.get("question_id")
            if q_id not in question_stats:
                question_stats[q_id] = {
                    "correct": 0,
                    "total": 0,
                    "confidences": [],
                    "times": [],
                    "wrong_answers": [],
                }
            question_stats[q_id]["total"] += 1
            if r.get("is_correct"):
                question_stats[q_id]["correct"] += 1
            else:
                question_stats[q_id]["wrong_answers"].append(r.get("answer"))
            question_stats[q_id]["confidences"].append(r.get("confidence", 0.5))
            question_stats[q_id]["times"].append(r.get("time_taken", 0))

        # Build question map
        question_map = {str(q.get("id")): q for q in questions}

        results = []
        for q_id, stats in question_stats.items():
            q = question_map.get(q_id, {})
            accuracy = stats["correct"] / stats["total"] * 100 if stats["total"] > 0 else 0
            avg_conf = sum(stats["confidences"]) / len(stats["confidences"]) * 100 if stats["confidences"] else 0
            avg_time = sum(stats["times"]) / len(stats["times"]) if stats["times"] else 0

            # Find most common wrong answer
            wrong_counts = Counter(stats["wrong_answers"])
            most_common_wrong = wrong_counts.most_common(1)

            difficulty = "easy" if accuracy >= 80 else "medium" if accuracy >= 50 else "hard"

            results.append({
                "question_id": q_id,
                "question_text": q.get("question_text", "")[:100],
                "accuracy": round(accuracy, 1),
                "avg_confidence": round(avg_conf, 1),
                "avg_time": round(avg_time, 1),
                "difficulty": difficulty,
                "most_common_wrong_answer": most_common_wrong[0][0] if most_common_wrong else None,
                "wrong_answer_count": most_common_wrong[0][1] if most_common_wrong else 0,
                "needs_review": accuracy < 60,
            })

        # Sort by accuracy (hardest first)
        return sorted(results, key=lambda x: x["accuracy"])

    def _analyze_students(
        self,
        players: List[Dict],
        responses: List[Dict]
    ) -> List[Dict]:
        """Analyze individual student performance."""
        student_stats = {}

        for r in responses:
            student = r.get("student_name")
            if student not in student_stats:
                student_stats[student] = {
                    "correct": 0,
                    "total": 0,
                    "confidences": [],
                    "times": [],
                    "correct_confidences": [],
                    "wrong_confidences": [],
                }
            stats = student_stats[student]
            stats["total"] += 1
            stats["confidences"].append(r.get("confidence", 0.5))
            stats["times"].append(r.get("time_taken", 0))

            if r.get("is_correct"):
                stats["correct"] += 1
                stats["correct_confidences"].append(r.get("confidence", 0.5))
            else:
                stats["wrong_confidences"].append(r.get("confidence", 0.5))

        results = []
        for student, stats in student_stats.items():
            accuracy = stats["correct"] / stats["total"] * 100 if stats["total"] > 0 else 0
            avg_conf = sum(stats["confidences"]) / len(stats["confidences"]) * 100 if stats["confidences"] else 50
            avg_time = sum(stats["times"]) / len(stats["times"]) if stats["times"] else 0

            # Calibration check
            calibration_gap = avg_conf - accuracy
            if calibration_gap > 20:
                calibration_status = "overconfident"
            elif calibration_gap < -20:
                calibration_status = "underconfident"
            else:
                calibration_status = "well_calibrated"

            # Check for high-confidence wrong answers
            high_conf_wrong = len([c for c in stats["wrong_confidences"] if c > 0.7])

            results.append({
                "student_name": student,
                "accuracy": round(accuracy, 1),
                "avg_confidence": round(avg_conf, 1),
                "avg_time": round(avg_time, 1),
                "questions_answered": stats["total"],
                "calibration_status": calibration_status,
                "high_confidence_errors": high_conf_wrong,
                "needs_attention": high_conf_wrong >= 2 or accuracy < 40,
            })

        # Sort by accuracy
        return sorted(results, key=lambda x: x["accuracy"])

    def _analyze_peer_discussions(
        self,
        discussions: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze peer discussion sessions for insights."""
        if not discussions:
            return {"total_discussions": 0}

        total = len(discussions)
        completed = sum(1 for d in discussions if d.get("status") == "completed")

        # Aggregate misconceptions from discussions
        all_misconceptions = []
        all_insights = []
        quality_counts = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}

        for d in discussions:
            if d.get("misconceptions_identified"):
                all_misconceptions.extend(d["misconceptions_identified"])
            if d.get("key_insights"):
                all_insights.extend(d["key_insights"])
            quality = d.get("discussion_quality", "fair")
            if quality in quality_counts:
                quality_counts[quality] += 1

        # Count common misconceptions
        misconception_counts = Counter(all_misconceptions)

        # Find students who benefited most
        improved_students = [
            d.get("student_name")
            for d in discussions
            if d.get("understanding_improved")
        ]

        return {
            "total_discussions": total,
            "completed_discussions": completed,
            "quality_distribution": quality_counts,
            "common_misconceptions_from_discussions": [
                {"misconception": m, "count": c}
                for m, c in misconception_counts.most_common(5)
            ],
            "key_insights": list(set(all_insights))[:10],
            "students_who_improved": list(set(improved_students)),
            "avg_message_count": sum(d.get("message_count", 0) for d in discussions) / total if total > 0 else 0,
        }

    async def _label_misconception_with_context(
        self,
        question_text: str,
        correct_answer: str,
        wrong_answer: str,
        student_count: int,
        student_reasoning: List[str]
    ) -> Dict[str, str]:
        """Generate a grounded misconception label based on actual question context."""
        reasoning_text = "\n".join(f"- {r}" for r in student_reasoning) if student_reasoning else "No reasoning provided"

        prompt = f"""Analyze why students chose the wrong answer for this specific question.

QUESTION: {question_text}
CORRECT ANSWER: {correct_answer}
WRONG ANSWER CHOSEN: {wrong_answer} (by {student_count} students)

STUDENT REASONING (if any):
{reasoning_text}

Based ONLY on this specific question, identify the misconception. Do NOT make up unrelated topics.

Return JSON:
{{
    "label": "Short label (3-5 words) describing the specific error",
    "description": "One sentence explaining what students misunderstood about THIS question",
    "intervention": "How to help students understand this specific concept"
}}"""

        try:
            response = await call_gemini_with_timeout(
                prompt,
                generation_config={
                    "temperature": 0.3,
                    "max_output_tokens": 200,
                    "response_mime_type": "application/json",
                },
            )
            if not response:
                return {
                    "label": f"Wrong answer: {wrong_answer}",
                    "description": f"{student_count} students chose {wrong_answer} instead of {correct_answer}",
                    "intervention": "Review this question with the class",
                }
            result = json.loads(response.text)
            if isinstance(result, list):
                result = result[0] if result else {}
            return result
        except Exception as e:
            print(f"Label generation error: {e}")
            return {
                "label": f"Wrong answer: {wrong_answer}",
                "description": f"{student_count} students chose {wrong_answer} instead of {correct_answer}",
                "intervention": "Review this question with the class",
            }

    async def _generate_ai_recommendations(
        self,
        insights: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate AI-powered recommendations based on all insights."""
        prompt = f"""Based on this quiz game analysis, provide actionable recommendations for the teacher.

Quiz: {insights.get('quiz_title', 'Quiz')}
Total Students: {insights.get('total_players', 0)}
Overall Accuracy: {insights.get('performance', {}).get('overall_accuracy', 0)}%

Calibration Status: {insights.get('calibration', {}).get('calibration_status', 'unknown')}
Overconfident Wrong Answers: {insights.get('calibration', {}).get('overconfident_wrong_count', 0)}

Top Misconceptions: {json.dumps(insights.get('misconceptions', {}).get('most_common_mistakes', [])[:3], default=str)}

Questions Needing Review: {[q.get('question_text')[:50] for q in insights.get('question_analysis', []) if q.get('needs_review')][:3]}

Students Needing Attention: {[s.get('student_name') for s in insights.get('student_analysis', []) if s.get('needs_attention')][:5]}

Provide a JSON response with:
{{
    "overall_summary": "2-3 sentence summary of class performance",
    "class_strengths": ["List 2-3 specific strengths observed"],
    "areas_for_improvement": ["List 2-3 specific areas to work on"],
    "immediate_actions": ["List 2-3 actions to take in the next class"],
    "individual_interventions": [
        {{"student": "name", "recommendation": "specific action"}}
    ],
    "follow_up_topics": ["Topics to revisit or reinforce"],
    "misconception_corrections": [
        {{"misconception": "what students believe", "correction": "what to teach", "activity": "suggested activity"}}
    ]
}}"""

        try:
            response = await call_gemini_with_timeout(
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 800,
                    "response_mime_type": "application/json",
                },
            )
            if not response:
                return {
                    "overall_summary": "Game completed. Review the detailed analytics for insights.",
                    "class_strengths": [],
                    "areas_for_improvement": [],
                    "immediate_actions": ["Review questions with low accuracy with the class"],
                    "individual_interventions": [],
                    "follow_up_topics": [],
                    "misconception_corrections": [],
                }
            result = json.loads(response.text)
            # Ensure we return a dict, not a list
            if isinstance(result, list):
                return result[0] if result else {}
            return result
        except Exception as e:
            print(f"AI recommendations error: {e}")
            return {
                "overall_summary": "Game completed. Review the detailed analytics for insights.",
                "class_strengths": [],
                "areas_for_improvement": [],
                "immediate_actions": ["Review questions with low accuracy with the class"],
                "individual_interventions": [],
                "follow_up_topics": [],
                "misconception_corrections": []
            }


# Singleton instance
insights_service = InsightsService()

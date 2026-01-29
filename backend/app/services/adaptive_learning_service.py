"""
Adaptive Learning Service
Smart algorithms for dynamic thresholds, peer matching, and intervention suggestions.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from ..db_models import (
    ConceptMastery, 
    StudentMisconception, SpacedRepetitionItem
)


def utc_now() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


class AdaptiveLearningService:
    """
    Implements smart adaptive learning algorithms:
    - Dynamic discussion thresholds
    - Confidence-correctness correlation
    - Smart peer matching
    - Intervention detection
    - Spaced repetition scheduling
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    # =========================================================================
    # DYNAMIC THRESHOLDS
    # =========================================================================
    
    def calculate_dynamic_thresholds(
        self,
        topic_difficulty: float = 0.5,
        time_elapsed_ratio: float = 0.0,  # 0 = start, 1 = end of session
        historical_discussion_success: float = 0.5,
        class_size: int = 20
    ) -> Dict[str, Any]:
        """
        Calculate dynamic thresholds for triggering peer discussion.
        
        Returns thresholds that adapt to:
        - Topic difficulty (harder topics → easier to trigger discussion)
        - Time in session (later → higher threshold, students tired)
        - Historical success of discussions
        - Class size (larger classes → slightly higher thresholds)
        """
        # Base thresholds (classic Mazur)
        base_low = 30
        base_high = 70
        
        # Adjust for difficulty (harder topics need more discussion)
        difficulty_adjustment = (topic_difficulty - 0.5) * 20
        adjusted_low = base_low - difficulty_adjustment
        adjusted_high = base_high - difficulty_adjustment * 0.5
        
        # Adjust for time (later in session, be more lenient)
        time_adjustment = time_elapsed_ratio * 10
        adjusted_low += time_adjustment
        adjusted_high += time_adjustment * 0.5
        
        # Adjust for historical success
        if historical_discussion_success > 0.7:
            # Discussions work well, trigger more often
            adjusted_low -= 5
        elif historical_discussion_success < 0.3:
            # Discussions not helping, be more selective
            adjusted_low += 10
        
        # Adjust for class size
        if class_size > 50:
            adjusted_high += 5  # Large classes need clearer consensus
        elif class_size < 10:
            adjusted_low -= 5  # Small classes can discuss more
        
        # Clamp values
        adjusted_low = max(15, min(45, adjusted_low))
        adjusted_high = max(55, min(85, adjusted_high))
        
        return {
            "low_threshold": round(adjusted_low),
            "high_threshold": round(adjusted_high),
            "factors": {
                "topic_difficulty": topic_difficulty,
                "time_elapsed_ratio": time_elapsed_ratio,
                "historical_success": historical_discussion_success,
                "class_size": class_size
            }
        }
    
    # =========================================================================
    # CONFIDENCE-CORRECTNESS ANALYSIS
    # =========================================================================
    
    def analyze_confidence_correctness(
        self,
        responses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze the relationship between confidence and correctness.
        
        Key insights:
        - High confidence + wrong = MISCONCEPTION (dangerous!)
        - Low confidence + right = Lucky guess or emerging understanding
        - High confidence + right = Solid understanding
        - Low confidence + wrong = Knowledge gap (normal)
        """
        if not responses:
            return {"status": "no_data"}
        
        categories = {
            "confident_correct": [],      # Good
            "confident_incorrect": [],    # Misconception!
            "uncertain_correct": [],      # Lucky or emerging
            "uncertain_incorrect": []     # Knowledge gap
        }
        
        confidence_threshold = 60
        
        for r in responses:
            confidence = r.get("confidence", 50)
            is_correct = r.get("is_correct", False)
            student = r.get("student_name", "unknown")
            
            if confidence >= confidence_threshold:
                if is_correct:
                    categories["confident_correct"].append(student)
                else:
                    categories["confident_incorrect"].append(student)
            else:
                if is_correct:
                    categories["uncertain_correct"].append(student)
                else:
                    categories["uncertain_incorrect"].append(student)
        
        total = len(responses)
        misconception_rate = len(categories["confident_incorrect"]) / total * 100
        solid_understanding_rate = len(categories["confident_correct"]) / total * 100
        
        # Determine alert level
        alert_level = "normal"
        recommendation = "proceed_normally"
        
        if misconception_rate > 25:
            alert_level = "critical"
            recommendation = "immediate_discussion"
            message = f"⚠️ MISCONCEPTION ALERT: {len(categories['confident_incorrect'])} students are confidently wrong!"
        elif misconception_rate > 15:
            alert_level = "warning"
            recommendation = "targeted_discussion"
            message = f"🟡 Some students ({len(categories['confident_incorrect'])}) have confident misconceptions"
        elif solid_understanding_rate > 70:
            alert_level = "good"
            recommendation = "can_move_on"
            message = "✅ Strong understanding with appropriate confidence"
        else:
            message = "Normal distribution of understanding"
        
        return {
            "categories": {k: len(v) for k, v in categories.items()},
            "students_by_category": categories,
            "misconception_rate": round(misconception_rate, 1),
            "solid_understanding_rate": round(solid_understanding_rate, 1),
            "alert_level": alert_level,
            "recommendation": recommendation,
            "message": message,
            "avg_confidence_correct": self._avg([r["confidence"] for r in responses if r.get("is_correct")]),
            "avg_confidence_incorrect": self._avg([r["confidence"] for r in responses if not r.get("is_correct")])
        }
    
    def _avg(self, values: List[float]) -> float:
        return round(sum(values) / len(values), 1) if values else 0
    
    # =========================================================================
    # SMART PEER MATCHING
    # =========================================================================
    
    def suggest_peer_pairs(
        self,
        responses: List[Dict[str, Any]],
        question: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Suggest optimal peer pairs for discussion.
        
        Strategy:
        - Pair students with different answers
        - Prioritize pairing confident-correct with confident-incorrect
        - Create groups of 2-3 for productive discussion
        """
        correct_answer = question.get("correct_answer", "").upper()
        
        # Categorize students
        correct_confident = []
        correct_uncertain = []
        incorrect_confident = []
        incorrect_uncertain = []
        
        for r in responses:
            student = r.get("student_name", "unknown")
            is_correct = r.get("answer", "").upper() == correct_answer
            confidence = r.get("confidence", 50)
            reasoning = r.get("reasoning", "")
            
            entry = {
                "student": student,
                "answer": r.get("answer"),
                "confidence": confidence,
                "reasoning": reasoning,
                "has_reasoning": bool(reasoning and len(reasoning) > 10)
            }
            
            if is_correct:
                if confidence >= 60:
                    correct_confident.append(entry)
                else:
                    correct_uncertain.append(entry)
            else:
                if confidence >= 60:
                    incorrect_confident.append(entry)
                else:
                    incorrect_uncertain.append(entry)
        
        pairs = []
        
        # Priority 1: Pair confident-correct (with reasoning) with confident-incorrect
        for wrong in incorrect_confident:
            mentor = next(
                (c for c in correct_confident if c["has_reasoning"] and c not in [p.get("mentor") for p in pairs]),
                None
            )
            if mentor:
                pairs.append({
                    "type": "misconception_correction",
                    "priority": "high",
                    "mentor": mentor["student"],
                    "learner": wrong["student"],
                    "reason": f"{mentor['student']} can explain why {wrong['answer']} is incorrect",
                    "mentor_answer": mentor["answer"],
                    "learner_answer": wrong["answer"],
                    "discussion_prompt": f"Can you explain to {wrong['student']} why you chose {mentor['answer']}?"
                })
        
        # Priority 2: Pair uncertain-correct with incorrect (peer teaching builds confidence)
        for wrong in incorrect_uncertain:
            if wrong["student"] in [p.get("learner") for p in pairs]:
                continue
            mentor = next(
                (c for c in correct_uncertain if c["student"] not in [p.get("mentor") for p in pairs]),
                None
            )
            if mentor:
                pairs.append({
                    "type": "confidence_building",
                    "priority": "medium",
                    "mentor": mentor["student"],
                    "learner": wrong["student"],
                    "reason": "Both uncertain - discussing can build understanding together",
                    "mentor_answer": mentor["answer"],
                    "learner_answer": wrong["answer"],
                    "discussion_prompt": "Compare your reasoning - what factors did you each consider?"
                })
        
        # Add unpaired students to discussion groups
        paired_students = set()
        for p in pairs:
            paired_students.add(p.get("mentor"))
            paired_students.add(p.get("learner"))
        
        unpaired = [r["student_name"] for r in responses if r.get("student_name") not in paired_students]
        
        return {
            "pairs": pairs,
            "unpaired_students": unpaired,
            "total_pairs": len(pairs),
            "pairing_stats": {
                "correct_confident": len(correct_confident),
                "correct_uncertain": len(correct_uncertain),
                "incorrect_confident": len(incorrect_confident),
                "incorrect_uncertain": len(incorrect_uncertain)
            }
        }
    
    # =========================================================================
    # INTERVENTION DETECTION
    # =========================================================================
    
    def detect_intervention_needed(
        self,
        responses: List[Dict[str, Any]],
        discussion_duration_seconds: int = 0,
        previous_discussion_outcomes: List[str] = None
    ) -> Dict[str, Any]:
        """
        Detect when instructor intervention is needed.
        
        Triggers:
        - Discussion going in circles (no progress)
        - Confusion spreading (confidence dropping)
        - Majority stuck on same misconception
        - Time limit exceeded without resolution
        """
        triggers = []
        severity = "none"
        
        # Check for confidence drop
        confidences = [r.get("confidence", 50) for r in responses]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 50
        
        if avg_confidence < 35:
            triggers.append({
                "type": "confidence_drop",
                "severity": "high",
                "message": f"Average confidence is very low ({avg_confidence:.0f}%) - students are confused"
            })
            severity = "high"
        
        # Check for time limit
        if discussion_duration_seconds > 300:  # 5 minutes
            triggers.append({
                "type": "time_exceeded",
                "severity": "medium",
                "message": "Discussion has been running for over 5 minutes"
            })
            if severity != "high":
                severity = "medium"
        
        # Check for circular discussions
        if previous_discussion_outcomes:
            stuck_count = sum(1 for o in previous_discussion_outcomes[-3:] if o == "ongoing")
            if stuck_count >= 3:
                triggers.append({
                    "type": "circular_discussion",
                    "severity": "high",
                    "message": "Discussion appears to be going in circles"
                })
                severity = "high"
        
        # Check for clustered wrong answers
        wrong_answers = [r.get("answer") for r in responses if not r.get("is_correct")]
        if wrong_answers:
            from collections import Counter
            answer_counts = Counter(wrong_answers)
            most_common_wrong, count = answer_counts.most_common(1)[0]
            if count >= len(responses) * 0.4:  # 40%+ on same wrong answer
                triggers.append({
                    "type": "misconception_cluster",
                    "severity": "high",
                    "message": f"{count} students ({count/len(responses)*100:.0f}%) stuck on the same wrong answer ({most_common_wrong})"
                })
                severity = "high"
        
        # Generate intervention suggestions
        suggestions = []
        if severity != "none":
            if any(t["type"] == "misconception_cluster" for t in triggers):
                suggestions.append("Provide a targeted hint about why the common wrong answer is tempting but incorrect")
            if any(t["type"] == "confidence_drop" for t in triggers):
                suggestions.append("Ask a simpler scaffolding question to rebuild understanding")
            if any(t["type"] == "circular_discussion" for t in triggers):
                suggestions.append("Summarize the key insight and give a concrete example")
            if any(t["type"] == "time_exceeded" for t in triggers):
                suggestions.append("Consider wrapping up discussion and showing the explanation")
        
        return {
            "intervention_needed": severity != "none",
            "severity": severity,
            "triggers": triggers,
            "suggestions": suggestions,
            "stats": {
                "avg_confidence": round(avg_confidence, 1),
                "discussion_duration": discussion_duration_seconds,
                "response_count": len(responses)
            }
        }
    
    # =========================================================================
    # DISCUSSION QUALITY ANALYSIS
    # =========================================================================
    
    def analyze_discussion_quality(
        self,
        messages: List[Dict[str, Any]],
        concept_vocabulary: List[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze the quality of a peer discussion.
        
        Evaluates:
        - Reasoning depth
        - Use of concept vocabulary
        - Learning signals (questions, examples, self-correction)
        - Engagement level
        """
        if not messages:
            return {"status": "no_messages"}
        
        concept_vocabulary = concept_vocabulary or []
        
        # Extract student messages
        student_messages = [m for m in messages if m.get("role") == "student"]
        total_student_words = sum(len(m.get("content", "").split()) for m in student_messages)
        
        # Learning signals to detect
        learning_signals = {
            "asked_why": 0,
            "gave_example": 0,
            "self_corrected": 0,
            "built_on_peer": 0,
            "expressed_confusion": 0,
            "expressed_insight": 0
        }
        
        # Patterns to detect
        why_patterns = ["why", "how come", "what if", "but what about"]
        example_patterns = ["for example", "like when", "such as", "imagine"]
        correction_patterns = ["wait, i think", "oh i see", "actually", "i was wrong"]
        building_patterns = ["you're right", "i agree because", "adding to that"]
        confusion_patterns = ["i'm confused", "i don't get", "not sure"]
        insight_patterns = ["aha", "oh!", "that makes sense", "now i understand"]
        
        vocabulary_used = set()
        
        for msg in student_messages:
            content = msg.get("content", "").lower()
            
            for pattern in why_patterns:
                if pattern in content:
                    learning_signals["asked_why"] += 1
            for pattern in example_patterns:
                if pattern in content:
                    learning_signals["gave_example"] += 1
            for pattern in correction_patterns:
                if pattern in content:
                    learning_signals["self_corrected"] += 1
            for pattern in building_patterns:
                if pattern in content:
                    learning_signals["built_on_peer"] += 1
            for pattern in confusion_patterns:
                if pattern in content:
                    learning_signals["expressed_confusion"] += 1
            for pattern in insight_patterns:
                if pattern in content:
                    learning_signals["expressed_insight"] += 1
            
            # Check vocabulary usage
            for term in concept_vocabulary:
                if term.lower() in content:
                    vocabulary_used.add(term)
        
        # Calculate scores
        sum(learning_signals.values())
        reasoning_depth = min(1.0, total_student_words / 100)  # More words = more depth (capped)
        vocabulary_score = len(vocabulary_used) / len(concept_vocabulary) if concept_vocabulary else 0
        
        # Positive signals weighted more
        positive_signals = (
            learning_signals["asked_why"] * 2 +
            learning_signals["gave_example"] * 2 +
            learning_signals["self_corrected"] * 3 +
            learning_signals["built_on_peer"] * 2 +
            learning_signals["expressed_insight"] * 3
        )
        
        engagement_score = min(1.0, positive_signals / 10)
        
        # Overall quality
        quality_score = (reasoning_depth * 0.3 + vocabulary_score * 0.3 + engagement_score * 0.4)
        
        quality_level = "low"
        if quality_score >= 0.7:
            quality_level = "high"
        elif quality_score >= 0.4:
            quality_level = "medium"
        
        return {
            "quality_score": round(quality_score, 2),
            "quality_level": quality_level,
            "reasoning_depth_score": round(reasoning_depth, 2),
            "vocabulary_score": round(vocabulary_score, 2),
            "engagement_score": round(engagement_score, 2),
            "learning_signals": learning_signals,
            "vocabulary_used": list(vocabulary_used),
            "total_student_words": total_student_words,
            "message_count": len(student_messages),
            "insights": self._generate_discussion_insights(learning_signals, quality_level)
        }
    
    def _generate_discussion_insights(
        self,
        signals: Dict[str, int],
        quality_level: str
    ) -> List[str]:
        """Generate actionable insights from discussion analysis."""
        insights = []
        
        if signals["self_corrected"] > 0:
            insights.append("🎉 Student showed self-correction - key learning moment!")
        if signals["expressed_insight"] > 0:
            insights.append("💡 'Aha moment' detected - understanding achieved")
        if signals["asked_why"] == 0 and quality_level != "high":
            insights.append("💭 Student didn't ask questions - consider prompting curiosity")
        if signals["gave_example"] > 0:
            insights.append("✅ Student used examples - shows applied understanding")
        if signals["expressed_confusion"] > 1 and signals["expressed_insight"] == 0:
            insights.append("⚠️ Persistent confusion - may need instructor help")
        
        return insights
    
    # =========================================================================
    # SPACED REPETITION (SM-2 Algorithm)
    # =========================================================================
    
    def calculate_next_review(
        self,
        quality: int,  # 0-5 rating (0 = complete blackout, 5 = perfect)
        repetition_count: int,
        ease_factor: float,
        interval: int  # current interval in days
    ) -> Dict[str, Any]:
        """
        Calculate next review date using SM-2 algorithm.
        
        quality:
        0 - Complete blackout
        1 - Incorrect, but recognized correct answer
        2 - Incorrect, but remembered with serious difficulty
        3 - Correct with significant difficulty
        4 - Correct with some hesitation
        5 - Perfect response
        """
        # If quality < 3, restart learning
        if quality < 3:
            new_interval = 1
            new_repetition = 0
        else:
            if repetition_count == 0:
                new_interval = 1
            elif repetition_count == 1:
                new_interval = 6
            else:
                new_interval = round(interval * ease_factor)
            new_repetition = repetition_count + 1
        
        # Update ease factor
        new_ease = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ease = max(1.3, new_ease)  # Minimum ease factor
        
        next_review = utc_now() + timedelta(days=new_interval)
        
        return {
            "next_review_at": next_review,
            "interval_days": new_interval,
            "repetition_count": new_repetition,
            "ease_factor": round(new_ease, 2),
            "quality_rating": quality
        }
    
    async def schedule_review(
        self,
        student_name: str,
        concept: str,
        question_template: Dict[str, Any],
        quality: int
    ) -> SpacedRepetitionItem:
        """Create or update a spaced repetition item."""
        # Check if item exists
        query = select(SpacedRepetitionItem).where(
            and_(
                SpacedRepetitionItem.student_name == student_name,
                SpacedRepetitionItem.concept == concept
            )
        )
        result = await self.db.execute(query)
        existing = result.scalars().first()
        
        if existing:
            # Update existing
            review_data = self.calculate_next_review(
                quality,
                existing.repetition_count,
                existing.ease_factor,
                existing.interval_days
            )
            existing.next_review_at = review_data["next_review_at"]
            existing.interval_days = review_data["interval_days"]
            existing.repetition_count = review_data["repetition_count"]
            existing.ease_factor = review_data["ease_factor"]
            existing.last_reviewed_at = utc_now()
            existing.last_quality = quality
            await self.db.commit()
            return existing
        else:
            # Create new
            review_data = self.calculate_next_review(quality, 0, 2.5, 1)
            item = SpacedRepetitionItem(
                student_name=student_name,
                concept=concept,
                question_template=question_template,
                ease_factor=review_data["ease_factor"],
                interval_days=review_data["interval_days"],
                repetition_count=review_data["repetition_count"],
                next_review_at=review_data["next_review_at"],
                last_quality=quality
            )
            self.db.add(item)
            await self.db.commit()
            return item
    
    async def get_due_reviews(self, student_name: str) -> List[SpacedRepetitionItem]:
        """Get all items due for review for a student."""
        query = select(SpacedRepetitionItem).where(
            and_(
                SpacedRepetitionItem.student_name == student_name,
                SpacedRepetitionItem.next_review_at <= utc_now()
            )
        ).order_by(SpacedRepetitionItem.next_review_at)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    # =========================================================================
    # MASTERY TRACKING
    # =========================================================================
    
    async def update_mastery(
        self,
        student_name: str,
        concept: str,
        is_correct: bool,
        confidence: int = 50
    ) -> ConceptMastery:
        """Update student's concept mastery based on a response."""
        query = select(ConceptMastery).where(
            and_(
                ConceptMastery.student_name == student_name,
                ConceptMastery.concept == concept
            )
        )
        result = await self.db.execute(query)
        mastery = result.scalars().first()
        
        if mastery:
            mastery.total_attempts += 1
            if is_correct:
                mastery.correct_attempts += 1
            # Weighted average with confidence
            weight = confidence / 100
            raw_score = mastery.correct_attempts / mastery.total_attempts * 100
            mastery.mastery_score = raw_score * (0.7 + weight * 0.3)
            mastery.last_seen_at = utc_now()
        else:
            mastery = ConceptMastery(
                student_name=student_name,
                concept=concept,
                total_attempts=1,
                correct_attempts=1 if is_correct else 0,
                mastery_score=100.0 if is_correct else 0.0,
                last_seen_at=utc_now()
            )
            self.db.add(mastery)
        
        await self.db.commit()
        return mastery
    
    async def track_misconception(
        self,
        student_name: str,
        concept: str,
        misconception: str
    ) -> StudentMisconception:
        """Track a student's misconception."""
        query = select(StudentMisconception).where(
            and_(
                StudentMisconception.student_name == student_name,
                StudentMisconception.concept == concept,
                StudentMisconception.misconception == misconception,
                StudentMisconception.is_resolved is False
            )
        )
        result = await self.db.execute(query)
        existing = result.scalars().first()
        
        if existing:
            existing.occurrence_count += 1
            existing.last_seen_at = utc_now()
        else:
            existing = StudentMisconception(
                student_name=student_name,
                concept=concept,
                misconception=misconception,
                occurrence_count=1
            )
            self.db.add(existing)
        
        await self.db.commit()
        return existing
    
    async def resolve_misconception(
        self,
        student_name: str,
        concept: str,
        misconception: str
    ) -> Optional[StudentMisconception]:
        """Mark a misconception as resolved."""
        query = select(StudentMisconception).where(
            and_(
                StudentMisconception.student_name == student_name,
                StudentMisconception.concept == concept,
                StudentMisconception.misconception == misconception,
                StudentMisconception.is_resolved is False
            )
        )
        result = await self.db.execute(query)
        item = result.scalars().first()
        
        if item:
            item.is_resolved = True
            item.resolved_at = utc_now()
            await self.db.commit()
        
        return item

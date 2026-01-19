#!/usr/bin/env python3
"""
Long-term Retention Tracker
============================
Track if peer learning sticks over time.
Models forgetting curves and predicts retention.
"""

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from collections import defaultdict


@dataclass
class MasteryRecord:
    """A snapshot of student mastery at a point in time."""
    student_id: int
    concept: str
    accuracy: float
    confidence: float
    timestamp: str
    
    # Context
    session_id: Optional[str] = None
    learning_method: Optional[str] = None  # "peer_discussion", "teacher_lecture", etc.
    was_post_discussion: bool = False


@dataclass
class RetentionRecord:
    """A follow-up measurement for retention analysis."""
    student_id: int
    concept: str
    initial_accuracy: float
    followup_accuracy: float
    days_since_learning: int
    
    # Calculated
    retention_rate: float = 0.0  # followup / initial
    absolute_drop: float = 0.0  # initial - followup
    
    # Context
    learning_method: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def __post_init__(self):
        if self.initial_accuracy > 0:
            self.retention_rate = self.followup_accuracy / self.initial_accuracy
        self.absolute_drop = self.initial_accuracy - self.followup_accuracy


@dataclass
class ForgettingCurve:
    """Modeled forgetting curve for a concept."""
    concept: str
    
    # Ebbinghaus parameters: R = e^(-t/S) where S is stability
    stability: float  # Half-life in days
    initial_retention: float  # R at t=0
    
    # Data points
    data_points: List[Tuple[int, float]] = field(default_factory=list)  # (days, retention)
    
    # Quality
    r_squared: float = 0.0
    sample_size: int = 0
    
    def predict_retention(self, days: int) -> float:
        """Predict retention after given number of days."""
        if self.stability == 0:
            return self.initial_retention
        return self.initial_retention * math.exp(-days / self.stability)
    
    def days_to_review(self, target_retention: float = 0.8) -> int:
        """Calculate optimal days until review needed."""
        if self.initial_retention <= target_retention:
            return 0
        if self.stability == 0:
            return 0
        
        # Solve: target = initial * e^(-t/S)
        # t = -S * ln(target / initial)
        ratio = target_retention / self.initial_retention
        if ratio <= 0:
            return 0
        
        days = -self.stability * math.log(ratio)
        return max(0, int(days))


class RetentionTracker:
    """
    Tracks student knowledge retention over time.
    
    Features:
    - Record initial learning events
    - Record follow-up measurements
    - Model forgetting curves per concept
    - Predict optimal review timing
    - Compare retention by learning method
    """
    
    def __init__(self):
        self.mastery_records: List[MasteryRecord] = []
        self.retention_records: List[RetentionRecord] = []
        
        # Index for quick lookup
        self.student_concept_history: Dict[Tuple[int, str], List[MasteryRecord]] = defaultdict(list)
    
    def record_initial_mastery(
        self,
        student_id: int,
        concept: str,
        accuracy: float,
        confidence: float = 0.5,
        session_id: Optional[str] = None,
        learning_method: Optional[str] = None,
        was_post_discussion: bool = False
    ) -> MasteryRecord:
        """
        Record initial mastery after learning a concept.
        
        This is the baseline for measuring retention.
        """
        record = MasteryRecord(
            student_id=student_id,
            concept=concept,
            accuracy=accuracy,
            confidence=confidence,
            timestamp=datetime.now().isoformat(),
            session_id=session_id,
            learning_method=learning_method,
            was_post_discussion=was_post_discussion
        )
        
        self.mastery_records.append(record)
        self.student_concept_history[(student_id, concept)].append(record)
        
        return record
    
    def record_followup(
        self,
        student_id: int,
        concept: str,
        accuracy: float,
        confidence: float = 0.5
    ) -> Optional[RetentionRecord]:
        """
        Record a follow-up measurement and compare to initial.
        
        Returns:
            RetentionRecord if initial mastery exists, None otherwise
        """
        # Get initial mastery
        history = self.student_concept_history.get((student_id, concept), [])
        
        if not history:
            # Record this as initial
            self.record_initial_mastery(student_id, concept, accuracy, confidence)
            return None
        
        initial = history[0]
        
        # Calculate days since learning
        initial_time = datetime.fromisoformat(initial.timestamp)
        days_since = (datetime.now() - initial_time).days
        
        record = RetentionRecord(
            student_id=student_id,
            concept=concept,
            initial_accuracy=initial.accuracy,
            followup_accuracy=accuracy,
            days_since_learning=days_since,
            learning_method=initial.learning_method
        )
        
        self.retention_records.append(record)
        
        # Also add to history
        followup_mastery = MasteryRecord(
            student_id=student_id,
            concept=concept,
            accuracy=accuracy,
            confidence=confidence,
            timestamp=datetime.now().isoformat(),
            learning_method=initial.learning_method
        )
        self.student_concept_history[(student_id, concept)].append(followup_mastery)
        
        return record
    
    def get_forgetting_curve(
        self,
        concept: str,
        learning_method: Optional[str] = None
    ) -> ForgettingCurve:
        """
        Fit a forgetting curve for a concept.
        
        Args:
            concept: The concept to analyze
            learning_method: Optional filter by learning method
            
        Returns:
            ForgettingCurve with modeled parameters
        """
        # Filter relevant records
        records = [
            r for r in self.retention_records
            if r.concept == concept
            and (learning_method is None or r.learning_method == learning_method)
        ]
        
        if len(records) < 3:
            # Not enough data - return default curve
            return ForgettingCurve(
                concept=concept,
                stability=7.0,  # Default 7-day half-life
                initial_retention=1.0,
                sample_size=len(records)
            )
        
        # Extract data points
        data_points = [(r.days_since_learning, r.retention_rate) for r in records]
        
        # Fit exponential decay: R = R0 * e^(-t/S)
        # Using log-linear regression: ln(R) = ln(R0) - t/S
        
        # Filter valid points (retention > 0)
        valid_points = [(t, r) for t, r in data_points if r > 0]
        
        if len(valid_points) < 2:
            return ForgettingCurve(
                concept=concept,
                stability=7.0,
                initial_retention=1.0,
                data_points=data_points,
                sample_size=len(records)
            )
        
        # Log transform
        log_points = [(t, math.log(r)) for t, r in valid_points]
        
        # Linear regression
        n = len(log_points)
        sum_t = sum(t for t, _ in log_points)
        sum_log_r = sum(log_r for _, log_r in log_points)
        sum_t2 = sum(t ** 2 for t, _ in log_points)
        sum_t_log_r = sum(t * log_r for t, log_r in log_points)
        
        # Slope and intercept
        denom = n * sum_t2 - sum_t ** 2
        if denom == 0:
            slope = 0
            intercept = sum_log_r / n if n > 0 else 0
        else:
            slope = (n * sum_t_log_r - sum_t * sum_log_r) / denom
            intercept = (sum_log_r - slope * sum_t) / n
        
        # Convert back: S = -1/slope, R0 = e^intercept
        stability = -1 / slope if slope < 0 else 30.0  # Cap at 30 days
        initial_retention = min(1.0, math.exp(intercept))
        
        # Calculate R-squared
        mean_log_r = sum_log_r / n
        ss_tot = sum((log_r - mean_log_r) ** 2 for _, log_r in log_points)
        ss_res = sum((log_r - (intercept + slope * t)) ** 2 for t, log_r in log_points)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        return ForgettingCurve(
            concept=concept,
            stability=stability,
            initial_retention=initial_retention,
            data_points=data_points,
            r_squared=r_squared,
            sample_size=len(records)
        )
    
    def predict_retention(
        self,
        student_id: int,
        concept: str,
        days_ahead: int
    ) -> float:
        """Predict a student's retention of a concept after given days."""
        curve = self.get_forgetting_curve(concept)
        
        # Get student's current mastery
        history = self.student_concept_history.get((student_id, concept), [])
        if not history:
            return 0.5  # Unknown
        
        latest = history[-1]
        days_since_latest = (datetime.now() - datetime.fromisoformat(latest.timestamp)).days
        
        # Predict from latest measurement
        total_days = days_since_latest + days_ahead
        predicted = curve.predict_retention(total_days)
        
        # Scale by current accuracy
        return predicted * latest.accuracy
    
    def compare_learning_methods(
        self,
        concept: str,
        method_a: str,
        method_b: str
    ) -> Dict[str, Any]:
        """
        Compare retention between two learning methods.
        
        Returns:
            Comparison statistics
        """
        curve_a = self.get_forgetting_curve(concept, method_a)
        curve_b = self.get_forgetting_curve(concept, method_b)
        
        # Compare at various time points
        time_points = [1, 7, 14, 30]
        comparison = {}
        
        for days in time_points:
            retention_a = curve_a.predict_retention(days)
            retention_b = curve_b.predict_retention(days)
            comparison[f"day_{days}"] = {
                method_a: retention_a,
                method_b: retention_b,
                "difference": retention_b - retention_a,
                "better": method_b if retention_b > retention_a else method_a
            }
        
        return {
            "concept": concept,
            "method_a": {
                "name": method_a,
                "stability": curve_a.stability,
                "initial_retention": curve_a.initial_retention,
                "sample_size": curve_a.sample_size
            },
            "method_b": {
                "name": method_b,
                "stability": curve_b.stability,
                "initial_retention": curve_b.initial_retention,
                "sample_size": curve_b.sample_size
            },
            "comparison_at_days": comparison,
            "overall_winner": method_b if curve_b.stability > curve_a.stability else method_a
        }
    
    def get_review_schedule(
        self,
        student_id: int,
        target_retention: float = 0.8
    ) -> List[Dict[str, Any]]:
        """
        Get recommended review schedule for a student.
        
        Returns:
            List of concepts with recommended review dates
        """
        schedule = []
        
        # Get all concepts this student has learned
        student_concepts = set(
            concept for (s_id, concept) in self.student_concept_history.keys()
            if s_id == student_id
        )
        
        for concept in student_concepts:
            curve = self.get_forgetting_curve(concept)
            history = self.student_concept_history.get((student_id, concept), [])
            
            if not history:
                continue
            
            latest = history[-1]
            days_since = (datetime.now() - datetime.fromisoformat(latest.timestamp)).days
            
            # Current predicted retention
            current_retention = curve.predict_retention(days_since)
            
            # Days until review needed
            days_to_review = curve.days_to_review(target_retention)
            days_remaining = days_to_review - days_since
            
            schedule.append({
                "concept": concept,
                "last_practiced": latest.timestamp,
                "days_since": days_since,
                "current_retention": current_retention,
                "days_until_review": max(0, days_remaining),
                "urgency": "high" if days_remaining <= 0 else "medium" if days_remaining <= 3 else "low",
                "recommended_date": (datetime.now() + timedelta(days=max(0, days_remaining))).isoformat()
            })
        
        # Sort by urgency
        urgency_order = {"high": 0, "medium": 1, "low": 2}
        schedule.sort(key=lambda x: (urgency_order[x["urgency"]], x["days_until_review"]))
        
        return schedule
    
    def get_summary_stats(self) -> Dict[str, Any]:
        """Get overall retention statistics."""
        if not self.retention_records:
            return {"status": "No retention data yet"}
        
        # Average retention by days
        by_day_bucket = defaultdict(list)
        for r in self.retention_records:
            bucket = r.days_since_learning // 7  # Weekly buckets
            by_day_bucket[bucket].append(r.retention_rate)
        
        avg_by_week = {
            f"week_{k}": sum(v) / len(v)
            for k, v in sorted(by_day_bucket.items())
        }
        
        # By learning method
        by_method = defaultdict(list)
        for r in self.retention_records:
            if r.learning_method:
                by_method[r.learning_method].append(r.retention_rate)
        
        avg_by_method = {
            method: sum(rates) / len(rates)
            for method, rates in by_method.items()
        }
        
        return {
            "total_records": len(self.retention_records),
            "unique_students": len(set(r.student_id for r in self.retention_records)),
            "unique_concepts": len(set(r.concept for r in self.retention_records)),
            "average_retention": sum(r.retention_rate for r in self.retention_records) / len(self.retention_records),
            "retention_by_week": avg_by_week,
            "retention_by_method": avg_by_method
        }


# Singleton instance
retention_tracker = RetentionTracker()

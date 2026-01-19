#!/usr/bin/env python3
"""
Confidence Calibration Analyzer
================================
Analyzes how well student confidence predicts actual correctness.
Identifies overconfident-wrong and underconfident-right patterns.
"""

import math
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime


@dataclass
class StudentResponse:
    """A single student response with confidence."""
    student_id: int
    student_name: str
    question_id: str
    answer: str
    is_correct: bool
    confidence: float  # 0-1
    reasoning: Optional[str] = None


@dataclass
class CalibrationBucket:
    """A bucket for calibration analysis."""
    confidence_range: Tuple[float, float]
    responses: List[StudentResponse]
    
    @property
    def count(self) -> int:
        return len(self.responses)
    
    @property
    def accuracy(self) -> float:
        if not self.responses:
            return 0.0
        return sum(1 for r in self.responses if r.is_correct) / len(self.responses)
    
    @property
    def mean_confidence(self) -> float:
        if not self.responses:
            return 0.0
        return sum(r.confidence for r in self.responses) / len(self.responses)


@dataclass
class CalibrationReport:
    """Complete calibration analysis report."""
    total_responses: int
    overall_accuracy: float
    overall_mean_confidence: float
    
    # Key categories
    overconfident_wrong: List[StudentResponse]  # High conf (>70%), wrong
    underconfident_right: List[StudentResponse]  # Low conf (<40%), correct
    well_calibrated: List[StudentResponse]  # Confidence matches accuracy
    
    # Calibration metrics
    brier_score: float  # Lower is better (0 = perfect)
    calibration_error: float  # Expected Calibration Error
    
    # Per-bucket breakdown
    buckets: List[CalibrationBucket]
    
    # Student-level analysis
    student_calibration_scores: Dict[int, float]
    
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict:
        return {
            "total_responses": self.total_responses,
            "overall_accuracy": self.overall_accuracy,
            "overall_mean_confidence": self.overall_mean_confidence,
            "brier_score": self.brier_score,
            "calibration_error": self.calibration_error,
            "overconfident_wrong_count": len(self.overconfident_wrong),
            "underconfident_right_count": len(self.underconfident_right),
            "buckets": [
                {
                    "range": b.confidence_range,
                    "count": b.count,
                    "accuracy": b.accuracy,
                    "mean_confidence": b.mean_confidence
                }
                for b in self.buckets
            ],
            "timestamp": self.timestamp
        }


class ConfidenceAnalyzer:
    """
    Analyzes confidence calibration across student responses.
    
    Key metrics:
    - Brier Score: Mean squared error of probabilistic predictions
    - Expected Calibration Error (ECE): Weighted average of bucket differences
    - Overconfidence detection: High confidence + wrong answer
    """
    
    def __init__(self, n_buckets: int = 10):
        self.n_buckets = n_buckets
        self.response_history: List[StudentResponse] = []
    
    def add_response(self, response: StudentResponse):
        """Add a response to the analysis."""
        self.response_history.append(response)
    
    def add_responses(self, responses: List[StudentResponse]):
        """Add multiple responses."""
        self.response_history.extend(responses)
    
    def analyze(
        self,
        responses: Optional[List[StudentResponse]] = None
    ) -> CalibrationReport:
        """
        Perform full calibration analysis.
        
        Args:
            responses: Responses to analyze (or use history if None)
            
        Returns:
            CalibrationReport with all metrics and flagged responses
        """
        if responses is None:
            responses = self.response_history
        
        if not responses:
            return CalibrationReport(
                total_responses=0,
                overall_accuracy=0,
                overall_mean_confidence=0,
                overconfident_wrong=[],
                underconfident_right=[],
                well_calibrated=[],
                brier_score=1.0,
                calibration_error=1.0,
                buckets=[],
                student_calibration_scores={}
            )
        
        # Basic metrics
        total = len(responses)
        correct = sum(1 for r in responses if r.is_correct)
        overall_accuracy = correct / total
        overall_confidence = sum(r.confidence for r in responses) / total
        
        # Brier score
        brier = self._compute_brier_score(responses)
        
        # Create buckets
        buckets = self._create_buckets(responses)
        
        # Expected Calibration Error
        ece = self._compute_ece(buckets, total)
        
        # Flag problematic responses
        overconfident_wrong = [
            r for r in responses
            if not r.is_correct and r.confidence > 0.7
        ]
        
        underconfident_right = [
            r for r in responses
            if r.is_correct and r.confidence < 0.4
        ]
        
        well_calibrated = [
            r for r in responses
            if abs(r.confidence - (1.0 if r.is_correct else 0.0)) < 0.3
        ]
        
        # Per-student calibration
        student_scores = self._compute_student_calibration(responses)
        
        return CalibrationReport(
            total_responses=total,
            overall_accuracy=overall_accuracy,
            overall_mean_confidence=overall_confidence,
            overconfident_wrong=overconfident_wrong,
            underconfident_right=underconfident_right,
            well_calibrated=well_calibrated,
            brier_score=brier,
            calibration_error=ece,
            buckets=buckets,
            student_calibration_scores=student_scores
        )
    
    def _compute_brier_score(self, responses: List[StudentResponse]) -> float:
        """
        Compute Brier score (mean squared error).
        
        Brier = (1/N) * Σ(confidence - outcome)²
        where outcome = 1 if correct, 0 if wrong
        """
        if not responses:
            return 1.0
        
        total_sq_error = 0.0
        for r in responses:
            outcome = 1.0 if r.is_correct else 0.0
            total_sq_error += (r.confidence - outcome) ** 2
        
        return total_sq_error / len(responses)
    
    def _create_buckets(
        self,
        responses: List[StudentResponse]
    ) -> List[CalibrationBucket]:
        """Create confidence buckets for calibration curve."""
        buckets = []
        bucket_size = 1.0 / self.n_buckets
        
        for i in range(self.n_buckets):
            low = i * bucket_size
            high = (i + 1) * bucket_size
            
            bucket_responses = [
                r for r in responses
                if low <= r.confidence < high or (i == self.n_buckets - 1 and r.confidence == 1.0)
            ]
            
            buckets.append(CalibrationBucket(
                confidence_range=(low, high),
                responses=bucket_responses
            ))
        
        return buckets
    
    def _compute_ece(
        self,
        buckets: List[CalibrationBucket],
        total: int
    ) -> float:
        """
        Compute Expected Calibration Error.
        
        ECE = Σ (|bucket| / total) * |accuracy - mean_confidence|
        """
        if total == 0:
            return 1.0
        
        ece = 0.0
        for bucket in buckets:
            if bucket.count > 0:
                weight = bucket.count / total
                gap = abs(bucket.accuracy - bucket.mean_confidence)
                ece += weight * gap
        
        return ece
    
    def _compute_student_calibration(
        self,
        responses: List[StudentResponse]
    ) -> Dict[int, float]:
        """Compute per-student calibration scores."""
        student_responses: Dict[int, List[StudentResponse]] = {}
        
        for r in responses:
            if r.student_id not in student_responses:
                student_responses[r.student_id] = []
            student_responses[r.student_id].append(r)
        
        scores = {}
        for student_id, resps in student_responses.items():
            if len(resps) >= 2:  # Need at least 2 responses
                brier = self._compute_brier_score(resps)
                # Convert to 0-1 scale where 1 is well-calibrated
                scores[student_id] = 1.0 - min(brier, 1.0)
            else:
                scores[student_id] = 0.5  # Insufficient data
        
        return scores
    
    def get_calibration_curve_data(
        self,
        responses: Optional[List[StudentResponse]] = None
    ) -> Dict[str, List[float]]:
        """
        Get data for plotting calibration curve.
        
        Returns:
            Dict with 'confidence' and 'accuracy' lists for plotting
        """
        if responses is None:
            responses = self.response_history
        
        buckets = self._create_buckets(responses)
        
        confidence_points = []
        accuracy_points = []
        
        for bucket in buckets:
            if bucket.count > 0:
                confidence_points.append(bucket.mean_confidence)
                accuracy_points.append(bucket.accuracy)
        
        return {
            "confidence": confidence_points,
            "accuracy": accuracy_points,
            "perfect_calibration": [0.0, 0.5, 1.0],  # Reference line
            "perfect_line": [0.0, 0.5, 1.0]
        }
    
    def flag_for_intervention(
        self,
        responses: Optional[List[StudentResponse]] = None,
        overconfidence_threshold: float = 0.75,
        underconfidence_threshold: float = 0.35
    ) -> Dict[str, List[StudentResponse]]:
        """
        Identify students needing intervention.
        
        Returns:
            Dict with 'overconfident', 'underconfident', 'needs_encouragement'
        """
        if responses is None:
            responses = self.response_history
        
        return {
            "overconfident": [
                r for r in responses
                if not r.is_correct and r.confidence > overconfidence_threshold
            ],
            "underconfident": [
                r for r in responses
                if r.is_correct and r.confidence < underconfidence_threshold
            ],
            "needs_encouragement": [
                r for r in responses
                if r.is_correct and r.confidence < 0.5
            ]
        }


def create_response_from_dict(data: Dict[str, Any]) -> StudentResponse:
    """Helper to create StudentResponse from dict."""
    return StudentResponse(
        student_id=data.get("student_id", 0),
        student_name=data.get("student_name", "Unknown"),
        question_id=data.get("question_id", ""),
        answer=data.get("answer", ""),
        is_correct=data.get("is_correct", False),
        confidence=data.get("confidence", 0.5),
        reasoning=data.get("reasoning")
    )


# Singleton instance
confidence_analyzer = ConfidenceAnalyzer()

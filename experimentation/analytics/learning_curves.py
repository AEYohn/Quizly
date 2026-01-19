#!/usr/bin/env python3
"""
Learning Curve Visualization
==============================
Visualize per-student and class-wide learning progress over sessions.
Generates Gradio-compatible plots.
"""

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from collections import defaultdict


@dataclass
class LearningDataPoint:
    """A single point on a learning curve."""
    timestamp: str
    session_id: Optional[str]
    question_index: int
    accuracy: float
    confidence: float
    concept: str
    
    # Context
    was_correct: bool = False
    post_discussion: bool = False


@dataclass
class LearningCurve:
    """A complete learning curve for a student/concept."""
    student_id: Optional[int]  # None for class-wide
    concept: Optional[str]  # None for all concepts
    
    data_points: List[LearningDataPoint] = field(default_factory=list)
    
    # Computed metrics
    initial_accuracy: float = 0.0
    final_accuracy: float = 0.0
    learning_gain: float = 0.0
    
    def compute_metrics(self):
        """Compute learning metrics from data points."""
        if not self.data_points:
            return
        
        # Get first and last 20% for comparison
        n = len(self.data_points)
        segment_size = max(1, n // 5)
        
        first_segment = self.data_points[:segment_size]
        last_segment = self.data_points[-segment_size:]
        
        self.initial_accuracy = sum(1 for p in first_segment if p.was_correct) / len(first_segment)
        self.final_accuracy = sum(1 for p in last_segment if p.was_correct) / len(last_segment)
        
        # Normalized learning gain
        max_possible = 1.0 - self.initial_accuracy
        if max_possible > 0:
            self.learning_gain = (self.final_accuracy - self.initial_accuracy) / max_possible
        else:
            self.learning_gain = 0.0


class LearningCurveVisualizer:
    """
    Visualizes learning curves and progress.
    
    Generates data suitable for plotting with various libraries.
    """
    
    def __init__(self):
        self.data_points: List[LearningDataPoint] = []
        self.sessions: Dict[str, List[LearningDataPoint]] = defaultdict(list)
    
    def add_data_point(
        self,
        student_id: int,
        question_index: int,
        accuracy: float,
        confidence: float,
        concept: str,
        was_correct: bool,
        session_id: Optional[str] = None,
        post_discussion: bool = False
    ) -> LearningDataPoint:
        """Add a learning data point."""
        point = LearningDataPoint(
            timestamp=datetime.now().isoformat(),
            session_id=session_id,
            question_index=question_index,
            accuracy=accuracy,
            confidence=confidence,
            concept=concept,
            was_correct=was_correct,
            post_discussion=post_discussion
        )
        
        self.data_points.append(point)
        
        if session_id:
            self.sessions[session_id].append(point)
        
        return point
    
    def get_student_curve(
        self,
        student_id: int,
        concept: Optional[str] = None
    ) -> LearningCurve:
        """Get learning curve for a specific student."""
        # Filter data points (assuming student_id stored elsewhere)
        # For now, return all points
        points = self.data_points
        if concept:
            points = [p for p in points if p.concept == concept]
        
        curve = LearningCurve(
            student_id=student_id,
            concept=concept,
            data_points=sorted(points, key=lambda p: p.timestamp)
        )
        curve.compute_metrics()
        return curve
    
    def get_class_curve(
        self,
        session_ids: Optional[List[str]] = None
    ) -> LearningCurve:
        """Get class-wide learning curve."""
        if session_ids:
            points = []
            for sid in session_ids:
                points.extend(self.sessions.get(sid, []))
        else:
            points = self.data_points
        
        curve = LearningCurve(
            student_id=None,
            concept=None,
            data_points=sorted(points, key=lambda p: p.timestamp)
        )
        curve.compute_metrics()
        return curve
    
    def get_plot_data_accuracy_over_questions(
        self,
        session_id: Optional[str] = None,
        window_size: int = 3
    ) -> Dict[str, List]:
        """
        Get data for accuracy over questions plot.
        
        Returns smoothed accuracy using rolling average.
        """
        if session_id:
            points = self.sessions.get(session_id, [])
        else:
            points = self.data_points
        
        if not points:
            return {"x": [], "y": [], "y_raw": []}
        
        # Sort by question index
        points = sorted(points, key=lambda p: (p.question_index, p.timestamp))
        
        # Group by question index
        by_question: Dict[int, List[bool]] = defaultdict(list)
        for p in points:
            by_question[p.question_index].append(p.was_correct)
        
        # Calculate accuracy per question
        x = sorted(by_question.keys())
        y_raw = [sum(by_question[q]) / len(by_question[q]) for q in x]
        
        # Rolling average for smoothing
        y_smooth = []
        for i in range(len(y_raw)):
            start = max(0, i - window_size + 1)
            window = y_raw[start:i + 1]
            y_smooth.append(sum(window) / len(window))
        
        return {
            "x": x,
            "y": y_smooth,
            "y_raw": y_raw,
            "xlabel": "Question Number",
            "ylabel": "Accuracy",
            "title": "Learning Curve: Accuracy Over Questions"
        }
    
    def get_plot_data_confidence_vs_accuracy(
        self,
        session_id: Optional[str] = None
    ) -> Dict[str, List]:
        """
        Get data for confidence vs accuracy scatter plot.
        
        Shows calibration visually.
        """
        if session_id:
            points = self.sessions.get(session_id, [])
        else:
            points = self.data_points
        
        if not points:
            return {"x": [], "y": [], "colors": []}
        
        x = [p.confidence for p in points]
        y = [1.0 if p.was_correct else 0.0 for p in points]
        colors = ["green" if p.was_correct else "red" for p in points]
        
        return {
            "x": x,
            "y": y,
            "colors": colors,
            "xlabel": "Confidence",
            "ylabel": "Correct (1) / Wrong (0)",
            "title": "Confidence vs Accuracy"
        }
    
    def get_plot_data_learning_by_concept(
        self,
        session_id: Optional[str] = None
    ) -> Dict[str, Dict[str, float]]:
        """
        Get before/after accuracy by concept for bar chart.
        """
        if session_id:
            points = self.sessions.get(session_id, [])
        else:
            points = self.data_points
        
        if not points:
            return {}
        
        # Group by concept
        by_concept: Dict[str, List[LearningDataPoint]] = defaultdict(list)
        for p in points:
            by_concept[p.concept].append(p)
        
        result = {}
        for concept, pts in by_concept.items():
            pts_sorted = sorted(pts, key=lambda p: p.timestamp)
            n = len(pts_sorted)
            
            if n < 2:
                continue
            
            # First half vs second half
            half = n // 2
            first_half = pts_sorted[:half]
            second_half = pts_sorted[half:]
            
            before = sum(1 for p in first_half if p.was_correct) / len(first_half)
            after = sum(1 for p in second_half if p.was_correct) / len(second_half)
            
            result[concept] = {
                "before": before,
                "after": after,
                "gain": after - before
            }
        
        return result
    
    def get_plot_data_discussion_impact(
        self,
        session_id: Optional[str] = None
    ) -> Dict[str, float]:
        """
        Compare accuracy before vs after peer discussion.
        """
        if session_id:
            points = self.sessions.get(session_id, [])
        else:
            points = self.data_points
        
        pre_discussion = [p for p in points if not p.post_discussion]
        post_discussion = [p for p in points if p.post_discussion]
        
        pre_accuracy = sum(1 for p in pre_discussion if p.was_correct) / len(pre_discussion) if pre_discussion else 0
        post_accuracy = sum(1 for p in post_discussion if p.was_correct) / len(post_discussion) if post_discussion else 0
        
        return {
            "pre_discussion_accuracy": pre_accuracy,
            "post_discussion_accuracy": post_accuracy,
            "improvement": post_accuracy - pre_accuracy,
            "pre_count": len(pre_discussion),
            "post_count": len(post_discussion)
        }
    
    def generate_summary_markdown(
        self,
        session_id: Optional[str] = None
    ) -> str:
        """Generate a markdown summary of learning progress."""
        curve = self.get_class_curve([session_id] if session_id else None)
        concept_data = self.get_plot_data_learning_by_concept(session_id)
        discussion_data = self.get_plot_data_discussion_impact(session_id)
        
        md = ["# Learning Progress Summary\n"]
        
        md.append(f"**Total Data Points:** {len(curve.data_points)}\n")
        md.append(f"**Initial Accuracy:** {curve.initial_accuracy:.1%}\n")
        md.append(f"**Final Accuracy:** {curve.final_accuracy:.1%}\n")
        md.append(f"**Normalized Learning Gain:** {curve.learning_gain:.1%}\n")
        
        if concept_data:
            md.append("\n## By Concept\n")
            md.append("| Concept | Before | After | Gain |\n")
            md.append("|---------|--------|-------|------|\n")
            for concept, data in concept_data.items():
                md.append(f"| {concept} | {data['before']:.1%} | {data['after']:.1%} | {data['gain']:+.1%} |\n")
        
        if discussion_data["post_count"] > 0:
            md.append("\n## Peer Discussion Impact\n")
            md.append(f"- Pre-discussion: {discussion_data['pre_discussion_accuracy']:.1%}\n")
            md.append(f"- Post-discussion: {discussion_data['post_discussion_accuracy']:.1%}\n")
            md.append(f"- **Improvement: {discussion_data['improvement']:+.1%}**\n")
        
        return "".join(md)
    
    def export_for_gradio(self) -> Dict[str, Any]:
        """Export all data in a format suitable for Gradio plots."""
        return {
            "accuracy_curve": self.get_plot_data_accuracy_over_questions(),
            "calibration": self.get_plot_data_confidence_vs_accuracy(),
            "by_concept": self.get_plot_data_learning_by_concept(),
            "discussion_impact": self.get_plot_data_discussion_impact(),
            "summary_markdown": self.generate_summary_markdown()
        }


# Singleton instance
learning_visualizer = LearningCurveVisualizer()

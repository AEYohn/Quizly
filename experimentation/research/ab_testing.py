#!/usr/bin/env python3
"""
A/B Testing Framework
======================
Compare different teaching strategies (peer discussion vs teacher explanation).
Tracks outcomes with statistical analysis.
"""

import random
import math
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from collections import defaultdict


@dataclass
class Experiment:
    """An A/B testing experiment."""
    id: str
    name: str
    description: str
    variants: List[str]
    allocation: Dict[str, float]  # variant -> proportion
    
    # State
    is_active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    # Assignments
    student_assignments: Dict[int, str] = field(default_factory=dict)
    
    # Outcomes
    outcomes: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    
    def __post_init__(self):
        # Initialize outcome lists for each variant
        for variant in self.variants:
            if variant not in self.outcomes:
                self.outcomes[variant] = []


@dataclass
class ABResult:
    """Results of an A/B test analysis."""
    experiment_id: str
    experiment_name: str
    
    # Per-variant stats
    variant_stats: Dict[str, Dict[str, float]]
    
    # Comparison
    control_variant: str
    treatment_variant: str
    
    # Statistical measures
    effect_size: float
    p_value: float
    confidence_interval: Tuple[float, float]
    is_significant: bool
    
    # Recommendation
    winner: Optional[str]
    recommendation: str
    
    sample_sizes: Dict[str, int] = field(default_factory=dict)


class ABTestFramework:
    """
    Framework for running A/B tests on teaching strategies.
    
    Example: Compare peer discussion (50/50 split) vs teacher lecture.
    """
    
    def __init__(self):
        self.experiments: Dict[str, Experiment] = {}
    
    def create_experiment(
        self,
        name: str,
        description: str,
        variants: List[str],
        allocation: Optional[Dict[str, float]] = None
    ) -> Experiment:
        """
        Create a new A/B experiment.
        
        Args:
            name: Experiment name
            description: What we're testing
            variants: List of variant names (e.g., ["peer_discussion", "teacher_lecture"])
            allocation: Optional custom allocation (default: equal split)
            
        Returns:
            The created Experiment
        """
        exp_id = f"exp_{name.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d%H%M')}"
        
        if allocation is None:
            # Equal allocation
            allocation = {v: 1.0 / len(variants) for v in variants}
        
        experiment = Experiment(
            id=exp_id,
            name=name,
            description=description,
            variants=variants,
            allocation=allocation
        )
        
        self.experiments[exp_id] = experiment
        return experiment
    
    def assign_student(
        self,
        experiment_id: str,
        student_id: int,
        force_variant: Optional[str] = None
    ) -> str:
        """
        Assign a student to a variant.
        
        Uses consistent hashing so same student always gets same variant.
        
        Args:
            experiment_id: The experiment ID
            student_id: The student ID
            force_variant: Optional override for testing
            
        Returns:
            The assigned variant name
        """
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        exp = self.experiments[experiment_id]
        
        # Check if already assigned
        if student_id in exp.student_assignments:
            return exp.student_assignments[student_id]
        
        # Force variant if specified
        if force_variant and force_variant in exp.variants:
            exp.student_assignments[student_id] = force_variant
            return force_variant
        
        # Use consistent hashing for assignment
        hash_val = hash((experiment_id, student_id)) % 10000 / 10000.0
        
        cumulative = 0.0
        for variant, proportion in exp.allocation.items():
            cumulative += proportion
            if hash_val < cumulative:
                exp.student_assignments[student_id] = variant
                return variant
        
        # Fallback to last variant
        variant = exp.variants[-1]
        exp.student_assignments[student_id] = variant
        return variant
    
    def record_outcome(
        self,
        experiment_id: str,
        student_id: int,
        metric: str,
        value: float,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Record an outcome for an assigned student.
        
        Args:
            experiment_id: The experiment ID
            student_id: The student ID
            metric: Name of the metric (e.g., "accuracy", "learning_gain")
            value: The metric value
            metadata: Optional additional data
        """
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        exp = self.experiments[experiment_id]
        
        # Get student's variant
        if student_id not in exp.student_assignments:
            self.assign_student(experiment_id, student_id)
        
        variant = exp.student_assignments[student_id]
        
        outcome = {
            "student_id": student_id,
            "metric": metric,
            "value": value,
            "timestamp": datetime.now().isoformat(),
            **(metadata or {})
        }
        
        exp.outcomes[variant].append(outcome)
    
    def analyze_results(
        self,
        experiment_id: str,
        metric: str = "accuracy",
        significance_level: float = 0.05
    ) -> ABResult:
        """
        Analyze experiment results with statistical tests.
        
        Args:
            experiment_id: The experiment ID
            metric: Which metric to analyze
            significance_level: Alpha for significance (default 0.05)
            
        Returns:
            ABResult with statistical analysis
        """
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        exp = self.experiments[experiment_id]
        
        # Collect values per variant
        variant_values: Dict[str, List[float]] = {}
        for variant in exp.variants:
            values = [
                o["value"] for o in exp.outcomes[variant]
                if o["metric"] == metric
            ]
            variant_values[variant] = values
        
        # Calculate stats per variant
        variant_stats = {}
        for variant, values in variant_values.items():
            if values:
                mean = sum(values) / len(values)
                variance = sum((v - mean) ** 2 for v in values) / max(len(values) - 1, 1)
                std = math.sqrt(variance)
            else:
                mean, std = 0.0, 0.0
            
            variant_stats[variant] = {
                "mean": mean,
                "std": std,
                "count": len(values),
                "min": min(values) if values else 0,
                "max": max(values) if values else 0
            }
        
        # Pairwise comparison (first variant is control)
        control = exp.variants[0]
        treatment = exp.variants[1] if len(exp.variants) > 1 else exp.variants[0]
        
        control_vals = variant_values.get(control, [])
        treatment_vals = variant_values.get(treatment, [])
        
        # Effect size (Cohen's d)
        effect_size = self._cohens_d(control_vals, treatment_vals)
        
        # Two-sample t-test (Welch's)
        p_value = self._welch_ttest(control_vals, treatment_vals)
        
        # Confidence interval for difference
        ci = self._confidence_interval(control_vals, treatment_vals)
        
        # Determine winner
        is_significant = p_value < significance_level
        
        if is_significant:
            control_mean = variant_stats.get(control, {}).get("mean", 0)
            treatment_mean = variant_stats.get(treatment, {}).get("mean", 0)
            winner = treatment if treatment_mean > control_mean else control
            recommendation = f"{winner} shows significantly better {metric}"
        else:
            winner = None
            recommendation = f"No significant difference detected (p={p_value:.3f})"
        
        return ABResult(
            experiment_id=experiment_id,
            experiment_name=exp.name,
            variant_stats=variant_stats,
            control_variant=control,
            treatment_variant=treatment,
            effect_size=effect_size,
            p_value=p_value,
            confidence_interval=ci,
            is_significant=is_significant,
            winner=winner,
            recommendation=recommendation,
            sample_sizes={v: len(vals) for v, vals in variant_values.items()}
        )
    
    def _cohens_d(self, group1: List[float], group2: List[float]) -> float:
        """Calculate Cohen's d effect size."""
        if not group1 or not group2:
            return 0.0
        
        n1, n2 = len(group1), len(group2)
        mean1 = sum(group1) / n1
        mean2 = sum(group2) / n2
        
        var1 = sum((x - mean1) ** 2 for x in group1) / max(n1 - 1, 1)
        var2 = sum((x - mean2) ** 2 for x in group2) / max(n2 - 1, 1)
        
        # Pooled standard deviation
        pooled_std = math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / max(n1 + n2 - 2, 1))
        
        if pooled_std == 0:
            return 0.0
        
        return (mean2 - mean1) / pooled_std
    
    def _welch_ttest(self, group1: List[float], group2: List[float]) -> float:
        """Calculate p-value using Welch's t-test (approximation)."""
        if len(group1) < 2 or len(group2) < 2:
            return 1.0
        
        n1, n2 = len(group1), len(group2)
        mean1 = sum(group1) / n1
        mean2 = sum(group2) / n2
        
        var1 = sum((x - mean1) ** 2 for x in group1) / (n1 - 1)
        var2 = sum((x - mean2) ** 2 for x in group2) / (n2 - 1)
        
        se1 = var1 / n1
        se2 = var2 / n2
        
        if se1 + se2 == 0:
            return 1.0
        
        t_stat = (mean1 - mean2) / math.sqrt(se1 + se2)
        
        # Approximate degrees of freedom (Welch-Satterthwaite)
        df = ((se1 + se2) ** 2) / (se1 ** 2 / (n1 - 1) + se2 ** 2 / (n2 - 1))
        
        # Approximate p-value using normal distribution for large df
        # (simplified - in production use scipy.stats)
        p_value = 2 * (1 - self._normal_cdf(abs(t_stat)))
        
        return p_value
    
    def _normal_cdf(self, x: float) -> float:
        """Approximate normal CDF using error function approximation."""
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))
    
    def _confidence_interval(
        self,
        group1: List[float],
        group2: List[float],
        confidence: float = 0.95
    ) -> Tuple[float, float]:
        """Calculate confidence interval for difference in means."""
        if len(group1) < 2 or len(group2) < 2:
            return (0.0, 0.0)
        
        n1, n2 = len(group1), len(group2)
        mean1 = sum(group1) / n1
        mean2 = sum(group2) / n2
        
        var1 = sum((x - mean1) ** 2 for x in group1) / (n1 - 1)
        var2 = sum((x - mean2) ** 2 for x in group2) / (n2 - 1)
        
        se = math.sqrt(var1 / n1 + var2 / n2)
        
        # Z-score for 95% CI
        z = 1.96 if confidence == 0.95 else 2.576  # 99%
        
        diff = mean2 - mean1
        margin = z * se
        
        return (diff - margin, diff + margin)
    
    def get_experiment_summary(self, experiment_id: str) -> Dict[str, Any]:
        """Get a summary of an experiment."""
        if experiment_id not in self.experiments:
            return {"error": f"Experiment {experiment_id} not found"}
        
        exp = self.experiments[experiment_id]
        
        return {
            "id": exp.id,
            "name": exp.name,
            "description": exp.description,
            "is_active": exp.is_active,
            "variants": exp.variants,
            "allocation": exp.allocation,
            "total_students": len(exp.student_assignments),
            "outcomes_per_variant": {
                v: len(outcomes) for v, outcomes in exp.outcomes.items()
            }
        }


# Singleton instance
ab_testing = ABTestFramework()

# Pre-create common experiment
ab_testing.create_experiment(
    name="Peer vs Teacher",
    description="Compare peer discussion with teacher explanation for misconception correction",
    variants=["peer_discussion", "teacher_explanation"],
    allocation={"peer_discussion": 0.5, "teacher_explanation": 0.5}
)

#!/usr/bin/env python3
"""
Misconception Clustering
=========================
Auto-discover common error patterns using embeddings and clustering.
Uses LLM to generate human-readable labels for clusters.
"""

import os
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from collections import defaultdict
import random

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class ErrorInstance:
    """A single wrong answer instance."""
    student_id: int
    question_id: str
    concept: str
    wrong_answer: str
    correct_answer: str
    reasoning: str
    confidence: float


@dataclass
class MisconceptionCluster:
    """A cluster of similar misconceptions."""
    cluster_id: int
    label: str  # Human-readable label
    description: str
    
    # Cluster members
    instances: List[ErrorInstance] = field(default_factory=list)
    
    # Characteristics
    common_patterns: List[str] = field(default_factory=list)
    affected_concepts: List[str] = field(default_factory=list)
    
    # Remediation
    suggested_intervention: str = ""
    
    @property
    def size(self) -> int:
        return len(self.instances)
    
    @property
    def unique_students(self) -> int:
        return len(set(i.student_id for i in self.instances))
    
    def to_dict(self) -> Dict:
        return {
            "cluster_id": self.cluster_id,
            "label": self.label,
            "description": self.description,
            "size": self.size,
            "unique_students": self.unique_students,
            "common_patterns": self.common_patterns,
            "affected_concepts": self.affected_concepts,
            "suggested_intervention": self.suggested_intervention,
            "sample_reasoning": [i.reasoning[:100] for i in self.instances[:3]]
        }


class MisconceptionClusterer:
    """
    Clusters wrong answers to discover common misconception patterns.
    
    Uses:
    - Text similarity for initial grouping
    - LLM for generating cluster labels
    - Pattern extraction for insights
    """
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.0-flash")
        
        self.all_errors: List[ErrorInstance] = []
        self.clusters: List[MisconceptionCluster] = []
    
    def add_error(self, error: ErrorInstance):
        """Add an error instance for clustering."""
        self.all_errors.append(error)
    
    def add_errors(self, errors: List[ErrorInstance]):
        """Add multiple error instances."""
        self.all_errors.extend(errors)
    
    def cluster_by_answer_pattern(
        self,
        concept: Optional[str] = None
    ) -> List[MisconceptionCluster]:
        """
        Simple clustering by wrong answer choice per question.
        
        Groups students who gave the same wrong answer.
        """
        # Filter by concept if specified
        errors = self.all_errors
        if concept:
            errors = [e for e in errors if e.concept == concept]
        
        # Group by (question_id, wrong_answer)
        groups: Dict[Tuple[str, str], List[ErrorInstance]] = defaultdict(list)
        for error in errors:
            key = (error.question_id, error.wrong_answer)
            groups[key].append(error)
        
        # Convert to clusters
        clusters = []
        for idx, ((q_id, answer), instances) in enumerate(groups.items()):
            if len(instances) >= 2:  # At least 2 students with same error
                cluster = MisconceptionCluster(
                    cluster_id=idx,
                    label=f"Common wrong answer: {answer}",
                    description=f"{len(instances)} students chose {answer} for question {q_id}",
                    instances=instances,
                    affected_concepts=list(set(i.concept for i in instances))
                )
                clusters.append(cluster)
        
        # Sort by size
        clusters.sort(key=lambda c: -c.size)
        return clusters
    
    def cluster_by_reasoning(
        self,
        n_clusters: int = 5,
        min_cluster_size: int = 2
    ) -> List[MisconceptionCluster]:
        """
        Cluster by reasoning similarity using keyword matching.
        
        A more sophisticated version would use embeddings.
        """
        if len(self.all_errors) < n_clusters:
            # Not enough data
            return self.cluster_by_answer_pattern()
        
        # Extract keywords from reasoning
        def extract_keywords(text: str) -> set:
            words = text.lower().split()
            # Filter short words and common words
            stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'it', 'to', 'of', 'and', 'or', 'so', 'if', 'then'}
            return {w for w in words if len(w) > 3 and w not in stopwords}
        
        error_keywords = [(e, extract_keywords(e.reasoning)) for e in self.all_errors]
        
        # Simple greedy clustering by keyword overlap
        clusters = []
        used = set()
        
        for i, (error1, kw1) in enumerate(error_keywords):
            if i in used:
                continue
            
            # Find similar errors
            similar = [error1]
            used.add(i)
            
            for j, (error2, kw2) in enumerate(error_keywords):
                if j in used:
                    continue
                
                # Jaccard similarity
                if kw1 and kw2:
                    overlap = len(kw1 & kw2) / len(kw1 | kw2)
                    if overlap > 0.3:  # Threshold
                        similar.append(error2)
                        used.add(j)
            
            if len(similar) >= min_cluster_size:
                # Create cluster
                common_kw = set.intersection(*[extract_keywords(e.reasoning) for e in similar])
                
                cluster = MisconceptionCluster(
                    cluster_id=len(clusters),
                    label=f"Similar reasoning pattern",
                    description=f"Students with similar explanations",
                    instances=similar,
                    common_patterns=list(common_kw)[:5],
                    affected_concepts=list(set(e.concept for e in similar))
                )
                clusters.append(cluster)
            
            if len(clusters) >= n_clusters:
                break
        
        # Sort by size
        clusters.sort(key=lambda c: -c.size)
        self.clusters = clusters
        return clusters
    
    def label_cluster_with_llm(
        self,
        cluster: MisconceptionCluster
    ) -> MisconceptionCluster:
        """
        Use LLM to generate a human-readable label for a cluster.
        """
        if not self.model or not cluster.instances:
            return cluster
        
        # Sample reasoning from cluster
        sample_reasoning = [i.reasoning for i in cluster.instances[:5]]
        sample_concepts = list(set(i.concept for i in cluster.instances))
        
        prompt = f"""Analyze these wrong answers from students and identify the common misconception.

Concepts involved: {', '.join(sample_concepts)}

Sample student reasoning:
{chr(10).join(f'- "{r}"' for r in sample_reasoning)}

Provide a concise analysis:
{{
    "label": "Short name for this misconception (max 5 words)",
    "description": "One sentence explanation of what students are getting wrong",
    "root_cause": "Why students might have this misconception",
    "common_patterns": ["pattern1", "pattern2"],
    "suggested_intervention": "How to help students overcome this"
}}"""

        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                
                cluster.label = result.get("label", cluster.label)
                cluster.description = result.get("description", cluster.description)
                cluster.common_patterns = result.get("common_patterns", cluster.common_patterns)
                cluster.suggested_intervention = result.get("suggested_intervention", "")
                
        except Exception as e:
            print(f"LLM labeling error: {e}")
        
        return cluster
    
    def label_all_clusters(self) -> List[MisconceptionCluster]:
        """Label all current clusters with LLM."""
        for cluster in self.clusters:
            self.label_cluster_with_llm(cluster)
        return self.clusters
    
    def get_top_misconceptions(
        self,
        n: int = 5
    ) -> List[MisconceptionCluster]:
        """Get the most common misconceptions."""
        if not self.clusters:
            self.cluster_by_reasoning()
        
        return self.clusters[:n]
    
    def get_misconceptions_by_concept(
        self,
        concept: str
    ) -> List[MisconceptionCluster]:
        """Get misconceptions affecting a specific concept."""
        return [c for c in self.clusters if concept in c.affected_concepts]
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all misconceptions."""
        if not self.clusters:
            self.cluster_by_reasoning()
        
        return {
            "total_errors": len(self.all_errors),
            "total_clusters": len(self.clusters),
            "students_affected": len(set(e.student_id for e in self.all_errors)),
            "concepts_affected": list(set(e.concept for e in self.all_errors)),
            "top_misconceptions": [c.to_dict() for c in self.clusters[:5]],
            "largest_cluster_size": self.clusters[0].size if self.clusters else 0
        }


def create_error_from_response(response: Dict[str, Any]) -> ErrorInstance:
    """Helper to create ErrorInstance from a response dict."""
    return ErrorInstance(
        student_id=response.get("student_id", 0),
        question_id=response.get("question_id", ""),
        concept=response.get("concept", "unknown"),
        wrong_answer=response.get("answer", ""),
        correct_answer=response.get("correct_answer", ""),
        reasoning=response.get("reasoning", ""),
        confidence=response.get("confidence", 0.5)
    )


# Singleton instance
misconception_clusterer = MisconceptionClusterer()

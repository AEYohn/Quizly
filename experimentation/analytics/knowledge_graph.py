#!/usr/bin/env python3
"""
Knowledge Graph
================
Tracks concept dependencies and student mastery progression.
Enables prerequisite-aware question selection.
"""

import json
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Any, Tuple, Union
from datetime import datetime
from collections import defaultdict


@dataclass
class ConceptNode:
    """A concept in the knowledge graph."""
    name: str
    display_name: str
    description: str
    prerequisites: List[str] = field(default_factory=list)
    difficulty_weight: float = 0.5  # How hard is this concept
    
    # Mastery tracking (per-student)
    student_mastery: Dict[int, float] = field(default_factory=dict)
    
    # Aggregate stats
    total_questions_asked: int = 0
    total_correct: int = 0
    
    @property
    def overall_mastery(self) -> float:
        """Average mastery across all students."""
        if not self.student_mastery:
            return 0.0
        return sum(self.student_mastery.values()) / len(self.student_mastery)
    
    @property
    def overall_accuracy(self) -> float:
        """Overall accuracy on this concept."""
        if self.total_questions_asked == 0:
            return 0.0
        return self.total_correct / self.total_questions_asked


@dataclass
class LearningEvent:
    """Record of a student interaction with a concept."""
    student_id: int
    concept: str
    question_id: str
    was_correct: bool
    confidence: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    
    # Learning context
    had_prerequisite_mastery: bool = True
    post_discussion: bool = False
    changed_answer: bool = False


class KnowledgeGraph:
    """
    A graph tracking concept dependencies and student mastery.
    
    Features:
    - Define concept prerequisites
    - Track per-student mastery
    - Identify learning paths
    - Generate prerequisite-aware recommendations
    """
    
    def __init__(self):
        self.nodes: Dict[str, ConceptNode] = {}
        self.learning_events: List[LearningEvent] = []
    
    def add_concept(
        self,
        name: str,
        display_name: Optional[str] = None,
        description: str = "",
        prerequisites: Optional[List[str]] = None,
        difficulty_weight: float = 0.5
    ) -> ConceptNode:
        """
        Add a concept to the knowledge graph.
        
        Args:
            name: Unique concept identifier
            display_name: Human-readable name
            description: Concept description
            prerequisites: List of prerequisite concept names
            difficulty_weight: How hard is this concept (0-1)
            
        Returns:
            The created ConceptNode
        """
        node = ConceptNode(
            name=name,
            display_name=display_name or name.replace("_", " ").title(),
            description=description,
            prerequisites=prerequisites or [],
            difficulty_weight=difficulty_weight
        )
        self.nodes[name] = node
        return node
    
    def add_prerequisite(self, concept: str, prerequisite: str):
        """Add a prerequisite relationship."""
        if concept in self.nodes:
            if prerequisite not in self.nodes[concept].prerequisites:
                self.nodes[concept].prerequisites.append(prerequisite)
    
    def record_learning_event(
        self,
        student_id: int,
        concept: str,
        question_id: str,
        was_correct: bool,
        confidence: float = 0.5,
        post_discussion: bool = False,
        changed_answer: bool = False
    ) -> LearningEvent:
        """
        Record a student's interaction with a concept.
        
        Updates mastery scores based on performance.
        """
        # Ensure concept exists
        if concept not in self.nodes:
            self.add_concept(concept)
        
        node = self.nodes[concept]
        
        # Check prerequisite mastery
        had_prereq_mastery = self.has_prerequisite_mastery(student_id, concept)
        
        # Create event
        event = LearningEvent(
            student_id=student_id,
            concept=concept,
            question_id=question_id,
            was_correct=was_correct,
            confidence=confidence,
            had_prerequisite_mastery=had_prereq_mastery,
            post_discussion=post_discussion,
            changed_answer=changed_answer
        )
        self.learning_events.append(event)
        
        # Update stats
        node.total_questions_asked += 1
        if was_correct:
            node.total_correct += 1
        
        # Update student mastery
        self._update_student_mastery(student_id, concept, was_correct, confidence)
        
        return event
    
    def _update_student_mastery(
        self,
        student_id: int,
        concept: str,
        was_correct: bool,
        confidence: float
    ):
        """Update a student's mastery of a concept using ELO-like system."""
        node = self.nodes[concept]
        
        # Get current mastery (default 0.3)
        current = node.student_mastery.get(student_id, 0.3)
        
        # Learning rate based on confidence
        lr = 0.15 if confidence < 0.5 else 0.1  # Learn more when uncertain
        
        # Target based on correctness
        target = 1.0 if was_correct else max(0.0, current - 0.15)
        
        # Weighted update
        new_mastery = current + lr * (target - current)
        new_mastery = max(0.0, min(1.0, new_mastery))
        
        node.student_mastery[student_id] = new_mastery
    
    def get_student_mastery(
        self,
        student_id: int,
        concept: Optional[str] = None
    ) -> Union[float, Dict[str, float]]:
        """
        Get a student's mastery level.
        
        Args:
            student_id: The student ID
            concept: If None, returns all concept masteries
            
        Returns:
            Single mastery float or dict of all masteries
        """
        if concept:
            if concept in self.nodes:
                return self.nodes[concept].student_mastery.get(student_id, 0.0)
            return 0.0
        
        return {
            name: node.student_mastery.get(student_id, 0.0)
            for name, node in self.nodes.items()
        }
    
    def has_prerequisite_mastery(
        self,
        student_id: int,
        concept: str,
        threshold: float = 0.5
    ) -> bool:
        """
        Check if a student has mastered all prerequisites for a concept.
        
        Args:
            student_id: The student ID
            concept: The target concept
            threshold: Minimum mastery required for prerequisites
            
        Returns:
            True if all prerequisites are mastered
        """
        if concept not in self.nodes:
            return True
        
        node = self.nodes[concept]
        for prereq in node.prerequisites:
            if prereq in self.nodes:
                mastery = self.nodes[prereq].student_mastery.get(student_id, 0.0)
                if mastery < threshold:
                    return False
        
        return True
    
    def get_learning_path(
        self,
        student_id: int,
        target_concept: str,
        mastery_threshold: float = 0.6
    ) -> List[str]:
        """
        Get the optimal learning path to reach a target concept.
        
        Returns concepts in prerequisite order, filtering out already-mastered ones.
        """
        if target_concept not in self.nodes:
            return [target_concept]
        
        # Topological sort of prerequisites
        visited = set()
        path = []
        
        def dfs(concept: str):
            if concept in visited:
                return
            visited.add(concept)
            
            if concept in self.nodes:
                for prereq in self.nodes[concept].prerequisites:
                    dfs(prereq)
            
            # Only add if not mastered
            mastery = self.get_student_mastery(student_id, concept)
            if mastery < mastery_threshold:
                path.append(concept)
        
        dfs(target_concept)
        return path
    
    def get_weak_concepts(
        self,
        student_id: int,
        threshold: float = 0.5
    ) -> List[Tuple[str, float]]:
        """Get concepts where student mastery is below threshold."""
        weak = []
        for name, node in self.nodes.items():
            mastery = node.student_mastery.get(student_id, 0.0)
            if mastery < threshold:
                weak.append((name, mastery))
        
        return sorted(weak, key=lambda x: x[1])
    
    def get_ready_concepts(
        self,
        student_id: int,
        mastery_threshold: float = 0.5
    ) -> List[str]:
        """
        Get concepts the student is ready to learn.
        
        A concept is ready if:
        1. Student hasn't mastered it yet
        2. Student has mastered all prerequisites
        """
        ready = []
        for name, node in self.nodes.items():
            current_mastery = node.student_mastery.get(student_id, 0.0)
            
            if current_mastery < mastery_threshold:
                if self.has_prerequisite_mastery(student_id, name, mastery_threshold):
                    ready.append(name)
        
        return ready
    
    def to_mermaid(self, show_mastery: Optional[int] = None) -> str:
        """
        Generate Mermaid diagram of the knowledge graph.
        
        Args:
            show_mastery: If provided, color nodes by this student's mastery
        """
        lines = ["graph TD"]
        
        for name, node in self.nodes.items():
            # Node label
            label = node.display_name
            if show_mastery is not None:
                mastery = node.student_mastery.get(show_mastery, 0.0)
                label += f"<br/>{mastery:.0%}"
            
            lines.append(f"    {name}[{label}]")
            
            # Add edges for prerequisites
            for prereq in node.prerequisites:
                lines.append(f"    {prereq} --> {name}")
        
        return "\n".join(lines)
    
    def to_dict(self) -> Dict[str, Any]:
        """Export knowledge graph as dictionary."""
        return {
            "nodes": {
                name: {
                    "display_name": node.display_name,
                    "description": node.description,
                    "prerequisites": node.prerequisites,
                    "difficulty_weight": node.difficulty_weight,
                    "overall_mastery": node.overall_mastery,
                    "overall_accuracy": node.overall_accuracy,
                    "total_questions": node.total_questions_asked
                }
                for name, node in self.nodes.items()
            },
            "total_events": len(self.learning_events),
            "total_students": len(set(e.student_id for e in self.learning_events))
        }
    
    @classmethod
    def create_cs70_graph(cls) -> "KnowledgeGraph":
        """Create a pre-built knowledge graph for CS 70 concepts."""
        kg = cls()
        
        # Logic fundamentals
        kg.add_concept("propositions", "Propositions", "Basic true/false statements", [], 0.2)
        kg.add_concept("logical_operators", "Logical Operators", "AND, OR, NOT, IMPLIES", ["propositions"], 0.3)
        kg.add_concept("truth_tables", "Truth Tables", "Evaluating compound statements", ["logical_operators"], 0.3)
        
        # Predicates and quantifiers
        kg.add_concept("predicates", "Predicates", "Statements with variables", ["propositions"], 0.4)
        kg.add_concept("quantifiers", "Quantifiers", "For all and exists", ["predicates"], 0.5)
        kg.add_concept("quantifier_negation", "Quantifier Negation", "Negating quantified statements", ["quantifiers", "logical_operators"], 0.6)
        
        # Proofs
        kg.add_concept("direct_proof", "Direct Proof", "Proving P implies Q directly", ["logical_operators"], 0.4)
        kg.add_concept("contrapositive", "Contrapositive", "Proving not Q implies not P", ["direct_proof"], 0.5)
        kg.add_concept("contradiction", "Proof by Contradiction", "Assuming negation leads to contradiction", ["direct_proof"], 0.6)
        kg.add_concept("induction", "Mathematical Induction", "Base case and inductive step", ["direct_proof", "quantifiers"], 0.7)
        
        # Sets
        kg.add_concept("sets_basics", "Set Basics", "Set notation and membership", [], 0.2)
        kg.add_concept("set_operations", "Set Operations", "Union, intersection, complement", ["sets_basics"], 0.4)
        kg.add_concept("set_identities", "Set Identities", "De Morgan's laws for sets", ["set_operations", "logical_operators"], 0.5)
        
        # Graphs
        kg.add_concept("graph_basics", "Graph Basics", "Vertices and edges", [], 0.3)
        kg.add_concept("graph_traversal", "Graph Traversal", "BFS and DFS", ["graph_basics"], 0.5)
        kg.add_concept("connectivity", "Connectivity", "Connected components and paths", ["graph_traversal"], 0.6)
        kg.add_concept("trees", "Trees", "Tree properties and traversals", ["connectivity"], 0.6)
        
        return kg


# Singleton instance with CS70 concepts
knowledge_graph = KnowledgeGraph.create_cs70_graph()

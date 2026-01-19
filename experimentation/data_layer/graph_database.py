#!/usr/bin/env python3
"""
Graph Database Layer
=====================
NetworkX-based graph storage for knowledge relationships and learning paths.
Can be extended to use Neo4j for production.
"""

import json
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime
from pathlib import Path
import pickle

try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False
    print("Warning: networkx not installed. Install with: pip install networkx")


@dataclass
class ConceptNode:
    """A concept in the knowledge graph."""
    id: str
    name: str
    display_name: str
    description: str = ""
    difficulty: float = 0.5
    category: str = "general"
    prerequisites: List[str] = field(default_factory=list)
    
    # Aggregate stats
    total_attempts: int = 0
    total_correct: int = 0


@dataclass
class StudentNode:
    """A student in the learning graph."""
    id: int
    name: str
    persona: str = "average"
    
    # Mastery per concept
    mastery: Dict[str, float] = field(default_factory=dict)


@dataclass
class LearningEdge:
    """An edge representing a learning interaction."""
    student_id: int
    concept_id: str
    timestamp: str
    was_correct: bool
    confidence: float
    method: str = "individual"  # "individual", "peer_discussion", "teacher"


class GraphDatabase:
    """
    Graph-based storage for knowledge relationships.
    
    Graph Types:
    1. Knowledge Graph: Concept prerequisites and dependencies
    2. Learning Graph: Student-concept interactions
    3. Misconception Graph: Related misconceptions
    4. Social Graph: Student interaction patterns
    """
    
    def __init__(self, persist_path: Optional[str] = "graphs/"):
        if not NETWORKX_AVAILABLE:
            raise ImportError("networkx is required for GraphDatabase")
        
        self.persist_path = Path(persist_path) if persist_path else None
        if self.persist_path:
            self.persist_path.mkdir(parents=True, exist_ok=True)
        
        # Knowledge graph (concept dependencies)
        self.knowledge_graph = nx.DiGraph()
        
        # Learning graph (bipartite: students <-> concepts)
        self.learning_graph = nx.Graph()
        
        # Misconception graph (which misconceptions co-occur)
        self.misconception_graph = nx.Graph()
        
        # Social graph (student interactions from debates)
        self.social_graph = nx.Graph()
        
        # Load persisted graphs
        self._load_graphs()
    
    def _load_graphs(self):
        """Load graphs from disk if they exist."""
        if not self.persist_path:
            return
        
        for name in ['knowledge', 'learning', 'misconception', 'social']:
            path = self.persist_path / f"{name}_graph.pkl"
            if path.exists():
                try:
                    with open(path, 'rb') as f:
                        setattr(self, f"{name}_graph", pickle.load(f))
                except Exception as e:
                    print(f"Warning: Could not load {name} graph: {e}")
    
    def save_graphs(self):
        """Persist graphs to disk."""
        if not self.persist_path:
            return
        
        for name in ['knowledge', 'learning', 'misconception', 'social']:
            path = self.persist_path / f"{name}_graph.pkl"
            with open(path, 'wb') as f:
                pickle.dump(getattr(self, f"{name}_graph"), f)
    
    # ===== Knowledge Graph Operations =====
    
    def add_concept(
        self,
        concept_id: str,
        name: str,
        description: str = "",
        difficulty: float = 0.5,
        category: str = "general",
        prerequisites: Optional[List[str]] = None
    ):
        """Add a concept to the knowledge graph."""
        self.knowledge_graph.add_node(
            concept_id,
            name=name,
            display_name=name.replace("_", " ").title(),
            description=description,
            difficulty=difficulty,
            category=category,
            total_attempts=0,
            total_correct=0
        )
        
        # Add prerequisite edges
        if prerequisites:
            for prereq in prerequisites:
                if prereq in self.knowledge_graph:
                    self.knowledge_graph.add_edge(
                        prereq, concept_id,
                        relationship="prerequisite"
                    )
    
    def add_prerequisite(self, concept: str, prerequisite: str):
        """Add a prerequisite relationship."""
        if concept in self.knowledge_graph and prerequisite in self.knowledge_graph:
            self.knowledge_graph.add_edge(
                prerequisite, concept,
                relationship="prerequisite"
            )
    
    def get_prerequisites(self, concept: str) -> List[str]:
        """Get all prerequisites for a concept."""
        if concept not in self.knowledge_graph:
            return []
        return list(self.knowledge_graph.predecessors(concept))
    
    def get_dependent_concepts(self, concept: str) -> List[str]:
        """Get concepts that depend on this one."""
        if concept not in self.knowledge_graph:
            return []
        return list(self.knowledge_graph.successors(concept))
    
    def get_learning_path(
        self,
        start_concepts: List[str],
        target_concept: str
    ) -> List[str]:
        """
        Get optimal learning path from current knowledge to target.
        Returns topologically sorted list of concepts to learn.
        """
        if target_concept not in self.knowledge_graph:
            return [target_concept]
        
        # Find all ancestors of target
        ancestors = nx.ancestors(self.knowledge_graph, target_concept)
        
        # Remove already known concepts
        to_learn = ancestors - set(start_concepts)
        to_learn.add(target_concept)
        
        # Get subgraph and topological sort
        subgraph = self.knowledge_graph.subgraph(to_learn)
        
        try:
            return list(nx.topological_sort(subgraph))
        except nx.NetworkXUnfeasible:
            # Cycle detected
            return list(to_learn)
    
    def get_concept_clusters(self) -> List[Set[str]]:
        """Get clusters of related concepts."""
        # Use weakly connected components
        undirected = self.knowledge_graph.to_undirected()
        return [set(c) for c in nx.connected_components(undirected)]
    
    # ===== Learning Graph Operations =====
    
    def add_student(self, student_id: int, name: str, persona: str = "average"):
        """Add a student to the learning graph."""
        node_id = f"student_{student_id}"
        self.learning_graph.add_node(
            node_id,
            type="student",
            student_id=student_id,
            name=name,
            persona=persona
        )
    
    def record_learning_interaction(
        self,
        student_id: int,
        concept: str,
        was_correct: bool,
        confidence: float,
        method: str = "individual"
    ):
        """Record a learning interaction as an edge."""
        student_node = f"student_{student_id}"
        concept_node = f"concept_{concept}"
        
        # Ensure nodes exist
        if student_node not in self.learning_graph:
            self.add_student(student_id, f"Student {student_id}")
        
        if concept_node not in self.learning_graph:
            self.learning_graph.add_node(concept_node, type="concept", name=concept)
        
        # Add or update edge
        if self.learning_graph.has_edge(student_node, concept_node):
            # Update existing edge
            edge = self.learning_graph[student_node][concept_node]
            edge['interactions'] = edge.get('interactions', 0) + 1
            edge['correct'] = edge.get('correct', 0) + (1 if was_correct else 0)
            edge['last_interaction'] = datetime.now().isoformat()
            edge['last_method'] = method
        else:
            # Create new edge
            self.learning_graph.add_edge(
                student_node, concept_node,
                interactions=1,
                correct=1 if was_correct else 0,
                first_interaction=datetime.now().isoformat(),
                last_interaction=datetime.now().isoformat(),
                last_method=method
            )
    
    def get_student_concepts(self, student_id: int) -> List[Dict]:
        """Get all concepts a student has interacted with."""
        student_node = f"student_{student_id}"
        if student_node not in self.learning_graph:
            return []
        
        concepts = []
        for neighbor in self.learning_graph.neighbors(student_node):
            if neighbor.startswith("concept_"):
                edge = self.learning_graph[student_node][neighbor]
                concepts.append({
                    "concept": neighbor.replace("concept_", ""),
                    "interactions": edge.get('interactions', 0),
                    "accuracy": edge.get('correct', 0) / max(edge.get('interactions', 1), 1),
                    "last_method": edge.get('last_method', 'unknown')
                })
        
        return concepts
    
    def find_similar_students(
        self,
        student_id: int,
        top_k: int = 5
    ) -> List[Tuple[int, float]]:
        """
        Find students with similar learning patterns.
        Uses Jaccard similarity on concept sets.
        """
        student_node = f"student_{student_id}"
        if student_node not in self.learning_graph:
            return []
        
        my_concepts = set(self.learning_graph.neighbors(student_node))
        
        similarities = []
        for node in self.learning_graph.nodes():
            if node.startswith("student_") and node != student_node:
                their_concepts = set(self.learning_graph.neighbors(node))
                
                # Jaccard similarity
                intersection = len(my_concepts & their_concepts)
                union = len(my_concepts | their_concepts)
                sim = intersection / union if union > 0 else 0
                
                other_id = int(node.replace("student_", ""))
                similarities.append((other_id, sim))
        
        similarities.sort(key=lambda x: -x[1])
        return similarities[:top_k]
    
    # ===== Social Graph Operations =====
    
    def record_debate(
        self,
        student_a: int,
        student_b: int,
        outcome: str,
        mind_changed: bool = False
    ):
        """Record a debate interaction between students."""
        node_a = f"student_{student_a}"
        node_b = f"student_{student_b}"
        
        # Ensure nodes exist
        for node_id, student_id in [(node_a, student_a), (node_b, student_b)]:
            if node_id not in self.social_graph:
                self.social_graph.add_node(node_id, student_id=student_id)
        
        # Update edge
        if self.social_graph.has_edge(node_a, node_b):
            edge = self.social_graph[node_a][node_b]
            edge['debates'] = edge.get('debates', 0) + 1
            edge['mind_changes'] = edge.get('mind_changes', 0) + (1 if mind_changed else 0)
        else:
            self.social_graph.add_edge(
                node_a, node_b,
                debates=1,
                mind_changes=1 if mind_changed else 0
            )
    
    def get_influential_students(self, top_k: int = 5) -> List[Tuple[int, float]]:
        """Find students who most often convince others."""
        # Use PageRank on debate outcomes
        pagerank = nx.pagerank(self.social_graph) if self.social_graph.nodes() else {}
        
        results = [
            (int(node.replace("student_", "")), score)
            for node, score in pagerank.items()
            if node.startswith("student_")
        ]
        results.sort(key=lambda x: -x[1])
        return results[:top_k]
    
    # ===== Misconception Graph Operations =====
    
    def record_misconception_occurrence(
        self,
        misconception_type: str,
        concept: str,
        student_id: int
    ):
        """Track misconception co-occurrence."""
        misc_node = f"misc_{misconception_type}"
        concept_node = f"concept_{concept}"
        
        # Ensure nodes exist
        if misc_node not in self.misconception_graph:
            self.misconception_graph.add_node(misc_node, type="misconception", count=0)
        
        self.misconception_graph.nodes[misc_node]['count'] = \
            self.misconception_graph.nodes[misc_node].get('count', 0) + 1
        
        if concept_node not in self.misconception_graph:
            self.misconception_graph.add_node(concept_node, type="concept")
        
        # Connect misconception to concept
        if self.misconception_graph.has_edge(misc_node, concept_node):
            self.misconception_graph[misc_node][concept_node]['count'] += 1
        else:
            self.misconception_graph.add_edge(misc_node, concept_node, count=1)
    
    def get_related_misconceptions(
        self,
        misconception_type: str
    ) -> List[Tuple[str, int]]:
        """Find misconceptions that often co-occur."""
        misc_node = f"misc_{misconception_type}"
        if misc_node not in self.misconception_graph:
            return []
        
        # Find concepts this misconception relates to
        concepts = list(self.misconception_graph.neighbors(misc_node))
        
        # Find other misconceptions on same concepts
        related = {}
        for concept in concepts:
            for neighbor in self.misconception_graph.neighbors(concept):
                if neighbor.startswith("misc_") and neighbor != misc_node:
                    misc_type = neighbor.replace("misc_", "")
                    related[misc_type] = related.get(misc_type, 0) + 1
        
        result = sorted(related.items(), key=lambda x: -x[1])
        return result
    
    # ===== Export Operations =====
    
    def to_mermaid(self, graph_type: str = "knowledge") -> str:
        """Export graph to Mermaid format."""
        if graph_type == "knowledge":
            graph = self.knowledge_graph
            lines = ["graph TD"]
        else:
            lines = ["graph LR"]
            graph = self.learning_graph
        
        for node in graph.nodes():
            data = graph.nodes[node]
            label = data.get('display_name', data.get('name', node))
            lines.append(f"    {node}[{label}]")
        
        for u, v in graph.edges():
            lines.append(f"    {u} --> {v}")
        
        return "\n".join(lines)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about all graphs."""
        return {
            "knowledge_graph": {
                "nodes": self.knowledge_graph.number_of_nodes(),
                "edges": self.knowledge_graph.number_of_edges()
            },
            "learning_graph": {
                "nodes": self.learning_graph.number_of_nodes(),
                "edges": self.learning_graph.number_of_edges()
            },
            "social_graph": {
                "nodes": self.social_graph.number_of_nodes(),
                "edges": self.social_graph.number_of_edges()
            },
            "misconception_graph": {
                "nodes": self.misconception_graph.number_of_nodes(),
                "edges": self.misconception_graph.number_of_edges()
            }
        }


# Initialize with CS70 knowledge graph
def create_cs70_knowledge_graph() -> GraphDatabase:
    """Create a knowledge graph for CS70 concepts."""
    db = GraphDatabase()
    
    # Logic
    db.add_concept("propositions", "Propositions", "Basic true/false statements", 0.2, "logic")
    db.add_concept("logical_operators", "Logical Operators", "AND, OR, NOT, IMPLIES", 0.3, "logic", ["propositions"])
    db.add_concept("truth_tables", "Truth Tables", "Evaluating compound statements", 0.3, "logic", ["logical_operators"])
    db.add_concept("predicates", "Predicates", "Statements with variables", 0.4, "logic", ["propositions"])
    db.add_concept("quantifiers", "Quantifiers", "For all and exists", 0.5, "logic", ["predicates"])
    db.add_concept("quantifier_negation", "Quantifier Negation", "Negating quantified statements", 0.6, "logic", ["quantifiers", "logical_operators"])
    
    # Proofs
    db.add_concept("direct_proof", "Direct Proof", "Proving P implies Q directly", 0.4, "proofs", ["logical_operators"])
    db.add_concept("contrapositive", "Contrapositive", "Proving not Q implies not P", 0.5, "proofs", ["direct_proof"])
    db.add_concept("contradiction", "Proof by Contradiction", "Assuming negation leads to contradiction", 0.6, "proofs", ["direct_proof"])
    db.add_concept("induction", "Mathematical Induction", "Base case and inductive step", 0.7, "proofs", ["direct_proof", "quantifiers"])
    
    # Sets
    db.add_concept("sets_basics", "Set Basics", "Set notation and membership", 0.2, "sets")
    db.add_concept("set_operations", "Set Operations", "Union, intersection, complement", 0.4, "sets", ["sets_basics"])
    
    # Graphs
    db.add_concept("graph_basics", "Graph Basics", "Vertices and edges", 0.3, "graphs")
    db.add_concept("graph_traversal", "Graph Traversal", "BFS and DFS", 0.5, "graphs", ["graph_basics"])
    db.add_concept("trees", "Trees", "Tree properties and traversals", 0.6, "graphs", ["graph_traversal"])
    
    return db


# Singleton instance
graph_db = create_cs70_knowledge_graph()

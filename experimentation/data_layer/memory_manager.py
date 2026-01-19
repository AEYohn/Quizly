#!/usr/bin/env python3
"""
Agent Memory Manager
=====================
Unified memory layer combining SQL, Graph, and Vector databases.
Provides a single interface for agent memory operations.
"""

from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

from .sql_database import SQLDatabase, sql_db
from .graph_database import GraphDatabase, graph_db
from .vector_database import VectorDatabase, vector_db


class AgentMemory:
    """
    Unified memory manager for AI agents.
    
    Combines:
    - SQL: Structured data (students, questions, responses)
    - Graph: Relationships (knowledge graph, social graph)
    - Vector: Semantic search (similarity)
    
    Usage:
        memory = AgentMemory()
        
        # Record a learning interaction
        memory.record_interaction(
            student_id=1,
            question=question_dict,
            answer="B",
            reasoning="I think...",
            is_correct=True,
            confidence=0.8
        )
        
        # Query
        similar_questions = memory.find_similar_questions("logic question")
        learning_path = memory.get_learning_path(student_id=1, target="induction")
    """
    
    def __init__(
        self,
        sql_path: str = "quizly_data.db",
        graph_path: str = "graphs/",
        vector_path: str = "vectors/"
    ):
        self.sql = SQLDatabase(sql_path)
        self.graph = GraphDatabase(graph_path)
        self.vector = VectorDatabase(vector_path)
    
    # ===== High-Level Recording =====
    
    def record_interaction(
        self,
        student_id: int,
        question: Dict[str, Any],
        answer: str,
        reasoning: str,
        is_correct: bool,
        confidence: float,
        session_id: Optional[int] = None,
        is_post_discussion: bool = False
    ) -> Dict[str, Any]:
        """
        Record a complete learning interaction across all databases.
        
        Returns:
            Dict with IDs from each database
        """
        question_id = question.get("id")
        concept = question.get("concept", "unknown")
        
        # SQL: Record response
        response_id = self.sql.record_response(
            student_id=student_id,
            question_id=question_id,
            answer=answer,
            is_correct=is_correct,
            confidence=confidence,
            reasoning=reasoning,
            session_id=session_id,
            is_post_discussion=is_post_discussion
        )
        
        # SQL: Update mastery
        current_mastery = self.sql.get_student_mastery(student_id).get(concept, 0.3)
        new_mastery = current_mastery + (0.1 if is_correct else -0.05)
        new_mastery = max(0, min(1, new_mastery))
        self.sql.update_student_mastery(student_id, concept, new_mastery, is_correct)
        
        # Graph: Record learning interaction
        self.graph.record_learning_interaction(
            student_id=student_id,
            concept=concept,
            was_correct=is_correct,
            confidence=confidence,
            method="peer_discussion" if is_post_discussion else "individual"
        )
        
        # Vector: Store reasoning for similarity search
        vector_id = self.vector.add_reasoning(
            student_id=student_id,
            question_id=str(question_id),
            reasoning=reasoning,
            was_correct=is_correct,
            concept=concept
        )
        
        return {
            "response_id": response_id,
            "vector_id": vector_id,
            "new_mastery": new_mastery
        }
    
    def record_question(
        self,
        prompt: str,
        options: List[str],
        correct_answer: str,
        concept: str,
        difficulty: float = 0.5,
        explanation: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record a question across all databases."""
        # SQL
        sql_id = self.sql.add_question(
            prompt=prompt,
            options=options,
            correct_answer=correct_answer,
            concept=concept,
            difficulty=difficulty,
            explanation=explanation
        )
        
        # Vector
        vector_id = self.vector.add_question(
            question_id=str(sql_id),
            prompt=prompt,
            concept=concept,
            difficulty=difficulty,
            options=options
        )
        
        return {
            "sql_id": sql_id,
            "vector_id": vector_id
        }
    
    def record_misconception(
        self,
        student_id: int,
        misconception_type: str,
        category: str,
        severity: str,
        description: str,
        concept: str,
        question_id: Optional[int] = None,
        evidence: Optional[List[str]] = None,
        remediation: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record a misconception across all databases."""
        # SQL
        sql_id = self.sql.record_misconception(
            student_id=student_id,
            misconception_type=misconception_type,
            category=category,
            severity=severity,
            description=description,
            question_id=question_id,
            evidence=evidence,
            remediation=remediation
        )
        
        # Graph: Track misconception relationships
        self.graph.record_misconception_occurrence(
            misconception_type=misconception_type,
            concept=concept,
            student_id=student_id
        )
        
        # Vector: Store for similarity
        vector_id = self.vector.add_misconception(
            misconception_type=misconception_type,
            description=description,
            concept=concept,
            examples=evidence
        )
        
        return {
            "sql_id": sql_id,
            "vector_id": vector_id
        }
    
    def record_debate(
        self,
        student_a: int,
        student_b: int,
        question_id: int,
        outcome: str,
        mind_changed: bool = False,
        winner_id: Optional[int] = None,
        transcript: Optional[List[Dict]] = None
    ):
        """Record a debate interaction."""
        # Graph: Social interaction
        self.graph.record_debate(
            student_a=student_a,
            student_b=student_b,
            outcome=outcome,
            mind_changed=mind_changed
        )
        
        # Could also store in SQL debates table
    
    # ===== Query Operations =====
    
    def get_student_profile(self, student_id: int) -> Dict[str, Any]:
        """Get complete student profile from all databases."""
        # SQL data
        student = self.sql.get_student(student_id)
        mastery = self.sql.get_student_mastery(student_id)
        misconceptions = self.sql.get_student_misconceptions(student_id)
        recent_responses = self.sql.get_student_responses(student_id, limit=10)
        
        # Graph data
        concepts_practiced = self.graph.get_student_concepts(student_id)
        similar_students = self.graph.find_similar_students(student_id, top_k=3)
        
        return {
            "profile": student,
            "mastery": mastery,
            "misconceptions": misconceptions,
            "recent_responses": recent_responses,
            "concepts_practiced": concepts_practiced,
            "similar_students": similar_students
        }
    
    def get_learning_path(
        self,
        student_id: int,
        target_concept: str
    ) -> List[str]:
        """Get optimal learning path for a student."""
        # Get student's current mastered concepts
        mastery = self.sql.get_student_mastery(student_id)
        mastered = [c for c, m in mastery.items() if m >= 0.6]
        
        # Get path from graph
        return self.graph.get_learning_path(mastered, target_concept)
    
    def find_similar_questions(
        self,
        query: str,
        concept: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict]:
        """Find questions similar to query text."""
        results = self.vector.find_similar_questions(query, concept, top_k)
        return [
            {
                "id": r.document.id,
                "content": r.document.content,
                "similarity": r.similarity,
                "metadata": r.document.metadata
            }
            for r in results
        ]
    
    def find_similar_reasoning(
        self,
        reasoning: str,
        correct_only: Optional[bool] = None,
        top_k: int = 5
    ) -> List[Dict]:
        """Find students with similar reasoning."""
        results = self.vector.find_similar_reasoning(reasoning, correct_only, top_k)
        return [
            {
                "student_id": r.document.metadata.get("student_id"),
                "reasoning": r.document.content,
                "similarity": r.similarity,
                "was_correct": r.document.metadata.get("was_correct")
            }
            for r in results
        ]
    
    def get_concept_prerequisites(self, concept: str) -> List[str]:
        """Get prerequisites for a concept."""
        return self.graph.get_prerequisites(concept)
    
    def get_weak_concepts(self, student_id: int) -> List[Tuple[str, float]]:
        """Get concepts where student is struggling."""
        mastery = self.sql.get_student_mastery(student_id)
        weak = [(c, m) for c, m in mastery.items() if m < 0.5]
        return sorted(weak, key=lambda x: x[1])
    
    def get_ready_to_learn(self, student_id: int) -> List[str]:
        """Get concepts the student is ready to learn."""
        mastery = self.sql.get_student_mastery(student_id)
        mastered = set(c for c, m in mastery.items() if m >= 0.6)
        
        ready = []
        for concept in self.graph.knowledge_graph.nodes():
            if concept in mastered:
                continue
            
            prereqs = self.graph.get_prerequisites(concept)
            if all(p in mastered for p in prereqs):
                ready.append(concept)
        
        return ready
    
    # ===== Analytics =====
    
    def get_class_analytics(self) -> Dict[str, Any]:
        """Get class-wide analytics."""
        return {
            "concept_stats": self.sql.get_concept_difficulty_stats(),
            "discussion_impact": self.sql.get_discussion_impact(),
            "common_misconceptions": self.sql.get_common_misconceptions(),
            "influential_students": self.graph.get_influential_students(),
            "graph_stats": self.graph.get_stats(),
            "vector_stats": self.vector.get_stats()
        }
    
    def get_misconception_insights(self) -> Dict[str, Any]:
        """Get insights about misconceptions."""
        common = self.sql.get_common_misconceptions()
        
        # For each common misconception, find related ones
        insights = []
        for misc in common[:5]:
            related = self.graph.get_related_misconceptions(misc['misconception_type'])
            similar = self.vector.find_related_misconceptions(misc['misconception_type'])
            
            insights.append({
                "type": misc['misconception_type'],
                "count": misc['count'],
                "related_misconceptions": related[:3],
                "semantically_similar": [
                    {"type": r.document.id, "similarity": r.similarity}
                    for r in similar[:3]
                ]
            })
        
        return {"insights": insights}
    
    # ===== Persistence =====
    
    def save(self):
        """Save all databases to disk."""
        self.graph.save_graphs()
        self.vector.save_collections()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics from all databases."""
        return {
            "sql": {
                "db_path": str(self.sql.db_path),
                "exists": self.sql.db_path.exists()
            },
            "graph": self.graph.get_stats(),
            "vector": self.vector.get_stats()
        }


# Singleton instance
agent_memory = AgentMemory()

#!/usr/bin/env python3
"""
SQL Database Layer
===================
SQLite-based persistent storage for structured educational data.
Handles students, questions, responses, sessions, and learning events.
"""

import sqlite3
import json
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from pathlib import Path
from contextlib import contextmanager
import threading


# Thread-local storage for connections
_local = threading.local()


class SQLDatabase:
    """
    SQLite database for structured educational data.
    
    Tables:
    - students: Student profiles and metadata
    - questions: Question bank with content and metadata
    - responses: Student responses with reasoning
    - sessions: Teaching sessions
    - learning_events: Track learning interactions
    - misconceptions: Tagged misconceptions
    - mastery: Per-student concept mastery
    """
    
    def __init__(self, db_path: str = "quizly_data.db"):
        self.db_path = Path(db_path)
        self._init_database()
    
    @contextmanager
    def get_connection(self):
        """Get a thread-local database connection."""
        if not hasattr(_local, 'connection') or _local.connection is None:
            _local.connection = sqlite3.connect(
                str(self.db_path),
                check_same_thread=False
            )
            _local.connection.row_factory = sqlite3.Row
        
        try:
            yield _local.connection
        except Exception as e:
            _local.connection.rollback()
            raise e
    
    def _init_database(self):
        """Initialize database schema."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Students table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS students (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE,
                    persona_type TEXT DEFAULT 'average',
                    knowledge_level REAL DEFAULT 0.5,
                    confidence_bias REAL DEFAULT 0.0,
                    susceptibility REAL DEFAULT 0.5,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata JSON
                )
            """)
            
            # Questions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS questions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prompt TEXT NOT NULL,
                    options JSON NOT NULL,
                    correct_answer TEXT NOT NULL,
                    concept TEXT NOT NULL,
                    difficulty REAL DEFAULT 0.5,
                    question_type TEXT DEFAULT 'mcq',
                    media_content JSON,
                    explanation TEXT,
                    common_misconceptions JSON,
                    times_asked INTEGER DEFAULT 0,
                    times_correct INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_code TEXT UNIQUE,
                    topic TEXT NOT NULL,
                    concepts JSON,
                    status TEXT DEFAULT 'draft',
                    instructor_id INTEGER,
                    started_at TIMESTAMP,
                    ended_at TIMESTAMP,
                    config JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Responses table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS responses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    question_id INTEGER NOT NULL,
                    session_id INTEGER,
                    answer TEXT NOT NULL,
                    is_correct BOOLEAN,
                    confidence REAL,
                    reasoning TEXT,
                    reasoning_steps JSON,
                    time_taken_seconds REAL,
                    is_post_discussion BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(id),
                    FOREIGN KEY (question_id) REFERENCES questions(id),
                    FOREIGN KEY (session_id) REFERENCES sessions(id)
                )
            """)
            
            # Learning Events table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS learning_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    concept TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    question_id INTEGER,
                    was_correct BOOLEAN,
                    confidence REAL,
                    pre_mastery REAL,
                    post_mastery REAL,
                    learning_method TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(id)
                )
            """)
            
            # Misconceptions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS misconceptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    question_id INTEGER,
                    response_id INTEGER,
                    misconception_type TEXT NOT NULL,
                    category TEXT,
                    severity TEXT,
                    description TEXT,
                    evidence JSON,
                    remediation TEXT,
                    is_resolved BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(id)
                )
            """)
            
            # Mastery table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS mastery (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    concept TEXT NOT NULL,
                    mastery_level REAL DEFAULT 0.0,
                    questions_attempted INTEGER DEFAULT 0,
                    questions_correct INTEGER DEFAULT 0,
                    last_practiced TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(student_id, concept),
                    FOREIGN KEY (student_id) REFERENCES students(id)
                )
            """)
            
            # Debates table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS debates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    question_id INTEGER NOT NULL,
                    student_a_id INTEGER NOT NULL,
                    student_b_id INTEGER NOT NULL,
                    transcript JSON,
                    winner_id INTEGER,
                    outcome TEXT,
                    judgment JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_id) REFERENCES questions(id)
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_responses_student ON responses(student_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_learning_student ON learning_events(student_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_mastery_student ON mastery(student_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_misconceptions_student ON misconceptions(student_id)")
            
            conn.commit()
    
    # ===== Student Operations =====
    
    def create_student(
        self,
        name: str,
        email: Optional[str] = None,
        persona_type: str = "average",
        knowledge_level: float = 0.5,
        metadata: Optional[Dict] = None
    ) -> int:
        """Create a new student and return ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO students (name, email, persona_type, knowledge_level, metadata)
                VALUES (?, ?, ?, ?, ?)
            """, (name, email, persona_type, knowledge_level, json.dumps(metadata or {})))
            conn.commit()
            return cursor.lastrowid
    
    def get_student(self, student_id: int) -> Optional[Dict]:
        """Get student by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM students WHERE id = ?", (student_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def update_student_mastery(
        self,
        student_id: int,
        concept: str,
        mastery_level: float,
        was_correct: bool
    ):
        """Update student's mastery for a concept."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO mastery (student_id, concept, mastery_level, questions_attempted, 
                                    questions_correct, last_practiced)
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(student_id, concept) DO UPDATE SET
                    mastery_level = ?,
                    questions_attempted = questions_attempted + 1,
                    questions_correct = questions_correct + ?,
                    last_practiced = CURRENT_TIMESTAMP
            """, (
                student_id, concept, mastery_level, 
                1 if was_correct else 0,
                mastery_level,
                1 if was_correct else 0
            ))
            conn.commit()
    
    def get_student_mastery(self, student_id: int) -> Dict[str, float]:
        """Get all mastery levels for a student."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT concept, mastery_level FROM mastery WHERE student_id = ?
            """, (student_id,))
            return {row['concept']: row['mastery_level'] for row in cursor.fetchall()}
    
    # ===== Question Operations =====
    
    def add_question(
        self,
        prompt: str,
        options: List[str],
        correct_answer: str,
        concept: str,
        difficulty: float = 0.5,
        explanation: Optional[str] = None,
        media_content: Optional[Dict] = None
    ) -> int:
        """Add a question to the bank."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO questions (prompt, options, correct_answer, concept, 
                                      difficulty, explanation, media_content)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                prompt, json.dumps(options), correct_answer, concept,
                difficulty, explanation, json.dumps(media_content) if media_content else None
            ))
            conn.commit()
            return cursor.lastrowid
    
    def get_questions_by_concept(
        self,
        concept: str,
        difficulty_range: Optional[Tuple[float, float]] = None,
        limit: int = 10
    ) -> List[Dict]:
        """Get questions for a concept."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            if difficulty_range:
                cursor.execute("""
                    SELECT * FROM questions 
                    WHERE concept = ? AND difficulty BETWEEN ? AND ?
                    LIMIT ?
                """, (concept, difficulty_range[0], difficulty_range[1], limit))
            else:
                cursor.execute("""
                    SELECT * FROM questions WHERE concept = ? LIMIT ?
                """, (concept, limit))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def update_question_stats(self, question_id: int, was_correct: bool):
        """Update question attempt statistics."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE questions SET
                    times_asked = times_asked + 1,
                    times_correct = times_correct + ?
                WHERE id = ?
            """, (1 if was_correct else 0, question_id))
            conn.commit()
    
    # ===== Response Operations =====
    
    def record_response(
        self,
        student_id: int,
        question_id: int,
        answer: str,
        is_correct: bool,
        confidence: float,
        reasoning: Optional[str] = None,
        reasoning_steps: Optional[List[str]] = None,
        session_id: Optional[int] = None,
        is_post_discussion: bool = False
    ) -> int:
        """Record a student response."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO responses (student_id, question_id, session_id, answer,
                                      is_correct, confidence, reasoning, reasoning_steps,
                                      is_post_discussion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                student_id, question_id, session_id, answer,
                is_correct, confidence, reasoning,
                json.dumps(reasoning_steps) if reasoning_steps else None,
                is_post_discussion
            ))
            conn.commit()
            
            # Update question stats
            self.update_question_stats(question_id, is_correct)
            
            return cursor.lastrowid
    
    def get_student_responses(
        self,
        student_id: int,
        limit: int = 100
    ) -> List[Dict]:
        """Get recent responses for a student."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT r.*, q.prompt, q.concept, q.correct_answer
                FROM responses r
                JOIN questions q ON r.question_id = q.id
                WHERE r.student_id = ?
                ORDER BY r.created_at DESC
                LIMIT ?
            """, (student_id, limit))
            return [dict(row) for row in cursor.fetchall()]
    
    # ===== Misconception Operations =====
    
    def record_misconception(
        self,
        student_id: int,
        misconception_type: str,
        category: str,
        severity: str,
        description: str,
        question_id: Optional[int] = None,
        response_id: Optional[int] = None,
        evidence: Optional[List[str]] = None,
        remediation: Optional[str] = None
    ) -> int:
        """Record a misconception."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO misconceptions (student_id, question_id, response_id,
                                           misconception_type, category, severity,
                                           description, evidence, remediation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                student_id, question_id, response_id,
                misconception_type, category, severity,
                description, json.dumps(evidence) if evidence else None, remediation
            ))
            conn.commit()
            return cursor.lastrowid
    
    def get_student_misconceptions(
        self,
        student_id: int,
        unresolved_only: bool = True
    ) -> List[Dict]:
        """Get misconceptions for a student."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM misconceptions WHERE student_id = ?"
            if unresolved_only:
                query += " AND is_resolved = FALSE"
            cursor.execute(query, (student_id,))
            return [dict(row) for row in cursor.fetchall()]
    
    # ===== Analytics Queries =====
    
    def get_concept_difficulty_stats(self) -> List[Dict]:
        """Get accuracy statistics by concept."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT q.concept,
                       COUNT(*) as attempts,
                       SUM(CASE WHEN r.is_correct THEN 1 ELSE 0 END) as correct,
                       AVG(r.confidence) as avg_confidence,
                       CAST(SUM(CASE WHEN r.is_correct THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as accuracy
                FROM responses r
                JOIN questions q ON r.question_id = q.id
                GROUP BY q.concept
                ORDER BY accuracy ASC
            """)
            return [dict(row) for row in cursor.fetchall()]
    
    def get_discussion_impact(self) -> Dict[str, float]:
        """Compare pre vs post-discussion accuracy."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT is_post_discussion,
                       COUNT(*) as count,
                       AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) as accuracy
                FROM responses
                GROUP BY is_post_discussion
            """)
            results = {row['is_post_discussion']: row['accuracy'] for row in cursor.fetchall()}
            return {
                "pre_discussion": results.get(0, 0),
                "post_discussion": results.get(1, 0),
                "improvement": results.get(1, 0) - results.get(0, 0)
            }
    
    def get_common_misconceptions(self, limit: int = 10) -> List[Dict]:
        """Get most common misconceptions."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT misconception_type, category, COUNT(*) as count,
                       COUNT(DISTINCT student_id) as unique_students
                FROM misconceptions
                GROUP BY misconception_type
                ORDER BY count DESC
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]


# Singleton instance
sql_db = SQLDatabase()

"""
Data Layer Module
==================
Database layers for agent memory and data management.

- SQL: Structured data (students, questions, responses)
- Graph: Relationships (knowledge graph, learning graph, social graph)
- Vector: Semantic search (questions, reasoning, misconceptions)
- Memory Manager: Unified interface for all databases
"""

from .sql_database import SQLDatabase, sql_db
from .graph_database import GraphDatabase, graph_db
from .vector_database import VectorDatabase, vector_db
from .memory_manager import AgentMemory, agent_memory

__all__ = [
    # SQL
    "SQLDatabase",
    "sql_db",
    
    # Graph
    "GraphDatabase",
    "graph_db",
    
    # Vector
    "VectorDatabase",
    "vector_db",
    
    # Unified Memory
    "AgentMemory",
    "agent_memory",
]

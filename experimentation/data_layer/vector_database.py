#!/usr/bin/env python3
"""
Vector Database Layer
======================
Semantic embedding storage for similarity search on:
- Questions (find similar questions)
- Student reasoning (find similar explanations)
- Misconceptions (cluster by semantic meaning)

Uses Gemini embeddings or falls back to local TF-IDF.
"""

import os
import json
import pickle
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from pathlib import Path
from collections import defaultdict
import hashlib

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class VectorDocument:
    """A document with its embedding."""
    id: str
    content: str
    embedding: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)
    doc_type: str = "general"  # "question", "reasoning", "misconception"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class SearchResult:
    """A search result with similarity score."""
    document: VectorDocument
    similarity: float
    rank: int


class VectorDatabase:
    """
    Vector database for semantic search.
    
    Collections:
    - questions: Question prompts and content
    - reasoning: Student reasoning/explanations
    - misconceptions: Misconception descriptions
    - concepts: Concept descriptions for similarity
    """
    
    def __init__(
        self,
        persist_path: str = "vectors/",
        use_gemini: bool = True
    ):
        self.persist_path = Path(persist_path)
        self.persist_path.mkdir(parents=True, exist_ok=True)
        
        self.use_gemini = use_gemini and GEMINI_AVAILABLE
        self.model = None
        
        if self.use_gemini:
            api_key = os.getenv("GEMINI_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                # Use embedding model
                self.model = "models/text-embedding-004"
        
        # Collections (in-memory)
        self.collections: Dict[str, List[VectorDocument]] = {
            "questions": [],
            "reasoning": [],
            "misconceptions": [],
            "concepts": []
        }
        
        # TF-IDF fallback data
        self.idf_cache: Dict[str, Dict[str, float]] = {}
        self.vocab: Dict[str, set] = defaultdict(set)
        
        # Load persisted data
        self._load_collections()
    
    def _load_collections(self):
        """Load collections from disk."""
        for name in self.collections.keys():
            path = self.persist_path / f"{name}_collection.pkl"
            if path.exists():
                try:
                    with open(path, 'rb') as f:
                        self.collections[name] = pickle.load(f)
                except Exception as e:
                    print(f"Warning: Could not load {name} collection: {e}")
    
    def save_collections(self):
        """Save collections to disk."""
        for name, docs in self.collections.items():
            path = self.persist_path / f"{name}_collection.pkl"
            with open(path, 'wb') as f:
                pickle.dump(docs, f)
    
    def _get_embedding_gemini(self, text: str) -> List[float]:
        """Get embedding using Gemini."""
        try:
            result = genai.embed_content(
                model=self.model,
                content=text,
                task_type="semantic_similarity"
            )
            return result['embedding']
        except Exception as e:
            print(f"Embedding error: {e}")
            return self._get_embedding_tfidf(text, "general")
    
    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization."""
        import re
        text = text.lower()
        tokens = re.findall(r'\b\w+\b', text)
        # Remove stopwords
        stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'to', 'of', 'and', 'or', 'it', 'this', 'that'}
        return [t for t in tokens if t not in stopwords and len(t) > 2]
    
    def _get_embedding_tfidf(
        self,
        text: str,
        collection: str,
        embedding_dim: int = 256
    ) -> List[float]:
        """
        Fallback: Create TF-IDF-like embedding.
        Uses hash-based feature projection for fixed dimensions.
        """
        tokens = self._tokenize(text)
        
        if not tokens:
            return [0.0] * embedding_dim
        
        # Term frequency
        tf = defaultdict(int)
        for token in tokens:
            tf[token] += 1
        
        # Normalize TF
        max_tf = max(tf.values())
        for token in tf:
            tf[token] = tf[token] / max_tf
        
        # Simple IDF from collection vocab
        total_docs = max(len(self.collections[collection]), 1)
        
        # Hash projection to fixed dimensions
        embedding = [0.0] * embedding_dim
        
        for token, freq in tf.items():
            # IDF weight
            doc_freq = len([d for d in self.collections[collection] 
                           if token in self._tokenize(d.content)])
            idf = math.log(total_docs / max(doc_freq, 1)) + 1
            
            # Hash to bucket
            bucket = hash(token) % embedding_dim
            embedding[bucket] += freq * idf
        
        # Normalize
        norm = math.sqrt(sum(x * x for x in embedding))
        if norm > 0:
            embedding = [x / norm for x in embedding]
        
        return embedding
    
    def _get_embedding(self, text: str, collection: str = "general") -> List[float]:
        """Get embedding for text."""
        if self.use_gemini and self.model:
            return self._get_embedding_gemini(text)
        return self._get_embedding_tfidf(text, collection)
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(a) != len(b):
            return 0.0
        
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot / (norm_a * norm_b)
    
    # ===== Document Operations =====
    
    def add_document(
        self,
        collection: str,
        content: str,
        doc_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        doc_type: str = "general"
    ) -> str:
        """Add a document to a collection."""
        if collection not in self.collections:
            self.collections[collection] = []
        
        # Generate ID if not provided
        if not doc_id:
            doc_id = hashlib.md5(content.encode()).hexdigest()[:12]
        
        # Check for duplicates
        existing = [d for d in self.collections[collection] if d.id == doc_id]
        if existing:
            return doc_id  # Already exists
        
        # Get embedding
        embedding = self._get_embedding(content, collection)
        
        doc = VectorDocument(
            id=doc_id,
            content=content,
            embedding=embedding,
            metadata=metadata or {},
            doc_type=doc_type
        )
        
        self.collections[collection].append(doc)
        
        # Update vocab for TF-IDF
        for token in self._tokenize(content):
            self.vocab[collection].add(token)
        
        return doc_id
    
    def search(
        self,
        collection: str,
        query: str,
        top_k: int = 5,
        filter_metadata: Optional[Dict] = None
    ) -> List[SearchResult]:
        """
        Search for similar documents in a collection.
        
        Args:
            collection: Collection to search
            query: Query text
            top_k: Number of results to return
            filter_metadata: Optional metadata filters
            
        Returns:
            List of SearchResults sorted by similarity
        """
        if collection not in self.collections or not self.collections[collection]:
            return []
        
        query_embedding = self._get_embedding(query, collection)
        
        results = []
        for doc in self.collections[collection]:
            # Apply metadata filter
            if filter_metadata:
                match = all(
                    doc.metadata.get(k) == v 
                    for k, v in filter_metadata.items()
                )
                if not match:
                    continue
            
            similarity = self._cosine_similarity(query_embedding, doc.embedding)
            results.append((doc, similarity))
        
        # Sort by similarity
        results.sort(key=lambda x: -x[1])
        
        return [
            SearchResult(document=doc, similarity=sim, rank=i + 1)
            for i, (doc, sim) in enumerate(results[:top_k])
        ]
    
    def find_similar(
        self,
        collection: str,
        doc_id: str,
        top_k: int = 5
    ) -> List[SearchResult]:
        """Find documents similar to a given document."""
        docs = [d for d in self.collections[collection] if d.id == doc_id]
        if not docs:
            return []
        
        target = docs[0]
        
        results = []
        for doc in self.collections[collection]:
            if doc.id == doc_id:
                continue
            
            similarity = self._cosine_similarity(target.embedding, doc.embedding)
            results.append((doc, similarity))
        
        results.sort(key=lambda x: -x[1])
        
        return [
            SearchResult(document=doc, similarity=sim, rank=i + 1)
            for i, (doc, sim) in enumerate(results[:top_k])
        ]
    
    # ===== Specialized Methods =====
    
    def add_question(
        self,
        question_id: str,
        prompt: str,
        concept: str,
        difficulty: float,
        options: Optional[List[str]] = None
    ) -> str:
        """Add a question to the questions collection."""
        content = f"{prompt}\n{' '.join(options or [])}"
        metadata = {
            "concept": concept,
            "difficulty": difficulty,
            "options": options
        }
        return self.add_document("questions", content, question_id, metadata, "question")
    
    def add_reasoning(
        self,
        student_id: int,
        question_id: str,
        reasoning: str,
        was_correct: bool,
        concept: str
    ) -> str:
        """Add student reasoning to the reasoning collection."""
        doc_id = f"{student_id}_{question_id}"
        metadata = {
            "student_id": student_id,
            "question_id": question_id,
            "was_correct": was_correct,
            "concept": concept
        }
        return self.add_document("reasoning", reasoning, doc_id, metadata, "reasoning")
    
    def add_misconception(
        self,
        misconception_type: str,
        description: str,
        concept: str,
        examples: Optional[List[str]] = None
    ) -> str:
        """Add a misconception to the misconceptions collection."""
        content = f"{misconception_type}: {description}"
        if examples:
            content += f"\nExamples: {' | '.join(examples)}"
        
        metadata = {
            "type": misconception_type,
            "concept": concept,
            "examples": examples
        }
        return self.add_document("misconceptions", content, misconception_type, metadata, "misconception")
    
    def find_similar_questions(
        self,
        query: str,
        concept: Optional[str] = None,
        top_k: int = 5
    ) -> List[SearchResult]:
        """Find questions similar to query."""
        filter_meta = {"concept": concept} if concept else None
        return self.search("questions", query, top_k, filter_meta)
    
    def find_similar_reasoning(
        self,
        reasoning: str,
        correct_only: Optional[bool] = None,
        top_k: int = 5
    ) -> List[SearchResult]:
        """Find similar student reasoning."""
        filter_meta = None
        if correct_only is not None:
            filter_meta = {"was_correct": correct_only}
        return self.search("reasoning", reasoning, top_k, filter_meta)
    
    def find_related_misconceptions(
        self,
        description: str,
        top_k: int = 5
    ) -> List[SearchResult]:
        """Find misconceptions related to a description."""
        return self.search("misconceptions", description, top_k)
    
    def cluster_reasoning(
        self,
        n_clusters: int = 5
    ) -> Dict[int, List[VectorDocument]]:
        """
        Cluster reasoning documents by similarity.
        Simple k-means-like clustering.
        """
        docs = self.collections.get("reasoning", [])
        if len(docs) < n_clusters:
            return {0: docs}
        
        # Simple clustering: pick random centroids and assign
        import random
        centroids = random.sample(docs, n_clusters)
        centroid_embeddings = [c.embedding for c in centroids]
        
        clusters = defaultdict(list)
        
        for doc in docs:
            # Find closest centroid
            sims = [self._cosine_similarity(doc.embedding, c) for c in centroid_embeddings]
            cluster_id = sims.index(max(sims))
            clusters[cluster_id].append(doc)
        
        return dict(clusters)
    
    # ===== Stats =====
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about vector collections."""
        stats = {}
        for name, docs in self.collections.items():
            if docs:
                embedding_dim = len(docs[0].embedding) if docs[0].embedding else 0
            else:
                embedding_dim = 0
            
            stats[name] = {
                "count": len(docs),
                "embedding_dim": embedding_dim
            }
        
        stats["using_gemini"] = self.use_gemini and self.model is not None
        return stats


# Singleton instance
vector_db = VectorDatabase()

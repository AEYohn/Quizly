#!/usr/bin/env python3
"""
Quizly RAG System - Retrieval Augmented Generation
===================================================
Handles document upload, chunking, embedding, and retrieval
for context-aware question generation.

Uses Gemini embeddings for vector representations.
"""

import os
import json
import hashlib
from typing import Dict, List, Tuple, Optional
from pathlib import Path
from dataclasses import dataclass, field
import numpy as np

# Optional PDF support
try:
    import fitz  # PyMuPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("⚠️ PyMuPDF not installed - PDF support disabled. Install with: pip install pymupdf")

# Gemini for embeddings
try:
    import google.generativeai as genai
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        EMBEDDING_MODEL = "models/text-embedding-004"
        GEMINI_AVAILABLE = True
    else:
        GEMINI_AVAILABLE = False
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class DocumentChunk:
    """A chunk of a document with metadata."""
    id: str
    content: str
    source: str  # Original document name
    page: int = 0
    chunk_idx: int = 0
    embedding: Optional[List[float]] = None
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "content": self.content,
            "source": self.source,
            "page": self.page,
            "chunk_idx": self.chunk_idx
        }


@dataclass  
class VectorStore:
    """Simple in-memory vector store."""
    chunks: List[DocumentChunk] = field(default_factory=list)
    
    def add_chunk(self, chunk: DocumentChunk):
        self.chunks.append(chunk)
    
    def search(self, query_embedding: List[float], top_k: int = 5) -> List[DocumentChunk]:
        """Find most similar chunks using cosine similarity."""
        if not self.chunks or not query_embedding:
            return []
        
        # Calculate similarities
        similarities = []
        query_np = np.array(query_embedding)
        
        for chunk in self.chunks:
            if chunk.embedding:
                chunk_np = np.array(chunk.embedding)
                # Cosine similarity
                sim = np.dot(query_np, chunk_np) / (
                    np.linalg.norm(query_np) * np.linalg.norm(chunk_np) + 1e-8
                )
                similarities.append((sim, chunk))
        
        # Sort by similarity
        similarities.sort(key=lambda x: x[0], reverse=True)
        return [chunk for _, chunk in similarities[:top_k]]
    
    def clear(self):
        self.chunks = []
    
    @property
    def size(self) -> int:
        return len(self.chunks)


class RAGSystem:
    """
    Retrieval Augmented Generation system for course materials.
    
    Usage:
        rag = RAGSystem()
        rag.add_document("lecture.pdf", pdf_bytes)
        rag.add_text("Additional notes...", source="notes.txt")
        
        # Retrieve relevant context for question generation
        context = rag.retrieve("sorting algorithms", top_k=3)
    """
    
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.vector_store = VectorStore()
        self.documents: Dict[str, str] = {}  # source -> full text
    
    def _chunk_text(self, text: str, source: str) -> List[DocumentChunk]:
        """Split text into overlapping chunks."""
        chunks = []
        words = text.split()
        
        if len(words) <= self.chunk_size:
            # Small document, single chunk
            chunk_id = hashlib.md5(text[:100].encode()).hexdigest()[:8]
            return [DocumentChunk(
                id=chunk_id,
                content=text,
                source=source,
                chunk_idx=0
            )]
        
        # Create overlapping chunks
        idx = 0
        chunk_num = 0
        while idx < len(words):
            end = min(idx + self.chunk_size, len(words))
            chunk_text = " ".join(words[idx:end])
            
            chunk_id = hashlib.md5(chunk_text[:50].encode()).hexdigest()[:8]
            chunks.append(DocumentChunk(
                id=f"{chunk_id}_{chunk_num}",
                content=chunk_text,
                source=source,
                chunk_idx=chunk_num
            ))
            
            idx += self.chunk_size - self.chunk_overlap
            chunk_num += 1
        
        return chunks
    
    def _get_embedding(self, text: str) -> Optional[List[float]]:
        """Get embedding for text using Gemini."""
        if not GEMINI_AVAILABLE:
            return None
        
        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            print(f"Embedding error: {e}")
            return None
    
    def _get_query_embedding(self, query: str) -> Optional[List[float]]:
        """Get embedding for a query."""
        if not GEMINI_AVAILABLE:
            return None
        
        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=query,
                task_type="retrieval_query"
            )
            return result['embedding']
        except Exception as e:
            print(f"Query embedding error: {e}")
            return None
    
    def add_text(self, text: str, source: str = "pasted_text") -> int:
        """Add plain text to the RAG system."""
        if not text or not text.strip():
            return 0
        
        self.documents[source] = text
        chunks = self._chunk_text(text.strip(), source)
        
        # Generate embeddings
        for chunk in chunks:
            chunk.embedding = self._get_embedding(chunk.content)
            self.vector_store.add_chunk(chunk)
        
        return len(chunks)
    
    def add_pdf(self, pdf_path: str) -> int:
        """Extract and add text from a PDF."""
        if not PDF_AVAILABLE:
            print("PDF support not available")
            return 0
        
        try:
            doc = fitz.open(pdf_path)
            full_text = []
            source = Path(pdf_path).name
            
            for page_num, page in enumerate(doc):
                page_text = page.get_text()
                if page_text.strip():
                    full_text.append(f"[Page {page_num + 1}]\n{page_text}")
            
            doc.close()
            
            combined_text = "\n\n".join(full_text)
            self.documents[source] = combined_text
            
            return self.add_text(combined_text, source)
            
        except Exception as e:
            print(f"PDF processing error: {e}")
            return 0
    
    def add_file(self, file_path: str) -> int:
        """Add a file (auto-detect type)."""
        path = Path(file_path)
        
        if path.suffix.lower() == '.pdf':
            return self.add_pdf(file_path)
        elif path.suffix.lower() in ['.txt', '.md', '.py', '.js', '.html']:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return self.add_text(f.read(), path.name)
            except Exception as e:
                print(f"File read error: {e}")
                return 0
        else:
            print(f"Unsupported file type: {path.suffix}")
            return 0
    
    def retrieve(self, query: str, top_k: int = 5) -> str:
        """
        Retrieve relevant context for a query.
        Returns concatenated relevant chunks.
        """
        if self.vector_store.size == 0:
            return ""
        
        query_embedding = self._get_query_embedding(query)
        if not query_embedding:
            # Fallback: return first few chunks
            chunks = self.vector_store.chunks[:top_k]
        else:
            chunks = self.vector_store.search(query_embedding, top_k)
        
        # Format context with sources
        context_parts = []
        for chunk in chunks:
            context_parts.append(f"[From: {chunk.source}]\n{chunk.content}")
        
        return "\n\n---\n\n".join(context_parts)
    
    def retrieve_for_concepts(self, concepts: List[str], top_k_per_concept: int = 2) -> str:
        """Retrieve context relevant to multiple concepts."""
        all_chunks = []
        seen_ids = set()
        
        for concept in concepts:
            query_embedding = self._get_query_embedding(concept)
            if query_embedding:
                chunks = self.vector_store.search(query_embedding, top_k_per_concept)
                for chunk in chunks:
                    if chunk.id not in seen_ids:
                        all_chunks.append(chunk)
                        seen_ids.add(chunk.id)
        
        # Format
        context_parts = []
        for chunk in all_chunks:
            context_parts.append(f"[From: {chunk.source}]\n{chunk.content}")
        
        return "\n\n---\n\n".join(context_parts)
    
    def get_summary(self) -> Dict:
        """Get summary of indexed documents."""
        return {
            "num_documents": len(self.documents),
            "num_chunks": self.vector_store.size,
            "documents": list(self.documents.keys()),
            "embeddings_available": GEMINI_AVAILABLE
        }
    
    def clear(self):
        """Clear all indexed documents."""
        self.vector_store.clear()
        self.documents.clear()


# Global RAG instance
rag_system = RAGSystem()


# ============================================================================
# INTEGRATION FUNCTIONS FOR GRADIO
# ============================================================================

def process_uploaded_materials(files, text_content: str, url_content: str) -> Tuple[str, RAGSystem]:
    """
    Process uploaded materials and add to RAG system.
    Returns status message and the RAG system.
    """
    global rag_system
    rag_system.clear()  # Fresh start for new session
    
    added = []
    
    # Process files
    if files:
        for f in files:
            try:
                num_chunks = rag_system.add_file(f.name)
                if num_chunks > 0:
                    added.append(f"📄 {Path(f.name).name} ({num_chunks} chunks)")
                else:
                    added.append(f"⚠️ {Path(f.name).name} (could not process)")
            except Exception as e:
                added.append(f"❌ {Path(f.name).name}: {e}")
    
    # Process pasted text
    if text_content and text_content.strip():
        num_chunks = rag_system.add_text(text_content, "pasted_content")
        added.append(f"📝 Pasted text ({num_chunks} chunks)")
    
    # Process URL (placeholder - would need web scraping)
    if url_content and url_content.strip():
        # In production, fetch URL content
        rag_system.add_text(f"[Content from URL: {url_content}]", url_content)
        added.append(f"🔗 {url_content}")
    
    if not added:
        return "No materials added. Upload files, paste text, or add a URL.", rag_system
    
    summary = rag_system.get_summary()
    status = f"""✅ **Materials Indexed for RAG**

**Documents:** {summary['num_documents']}
**Chunks:** {summary['num_chunks']}
**Embeddings:** {'Enabled' if summary['embeddings_available'] else 'Disabled'}

**Added:**
""" + "\n".join(f"- {a}" for a in added)
    
    return status, rag_system


def get_rag_context(topic: str, concepts: List[str], top_k: int = 5) -> str:
    """Get relevant context from RAG for question generation."""
    global rag_system
    
    if rag_system.vector_store.size == 0:
        return ""
    
    # Combine topic and concepts for retrieval
    combined_query = f"{topic}: {', '.join(concepts)}"
    return rag_system.retrieve(combined_query, top_k)


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    print("Testing RAG System...")
    
    rag = RAGSystem()
    
    # Add sample text
    sample = """
    Bubble Sort is a simple sorting algorithm that repeatedly steps through the list,
    compares adjacent elements and swaps them if they are in the wrong order.
    The pass through the list is repeated until the list is sorted.
    
    Time Complexity:
    - Best Case: O(n) when array is already sorted
    - Average Case: O(n²)
    - Worst Case: O(n²)
    
    Quick Sort is a divide-and-conquer algorithm. It works by selecting a 'pivot'
    element from the array and partitioning the other elements into two sub-arrays.
    
    Time Complexity:
    - Best Case: O(n log n)
    - Average Case: O(n log n)
    - Worst Case: O(n²) when pivot is always the smallest or largest element
    """
    
    num_chunks = rag.add_text(sample, "sorting_notes.txt")
    print(f"Added {num_chunks} chunks")
    
    # Retrieve
    context = rag.retrieve("time complexity of sorting algorithms")
    print(f"\nRetrieved context:\n{context[:500]}...")
    
    print(f"\nSummary: {rag.get_summary()}")

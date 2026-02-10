#!/usr/bin/env python3
"""
Quizly Document Processor - Efficient PDF/Document Handling
============================================================
Uses Gemini's native multimodal PDF understanding instead of text extraction.

Key insight: Gemini 2.0 can directly process PDFs as multimodal input,
understanding text, images, tables, and structure - no OCR needed!

For documents under 20MB: Inline base64 encoding
For larger documents: Use Gemini File API (up to 2GB, stored 48h)
"""

import os
import json
import base64
from typing import Dict, List, Tuple
from pathlib import Path
from dataclasses import dataclass

from .utils.llm_utils import call_gemini_with_timeout, GEMINI_AVAILABLE, gemini_client


@dataclass
class ProcessedDocument:
    """Result of processing a document."""
    source: str
    file_type: str
    concepts: List[str]
    summary: str
    topic: str = ""  # Suggested topic/title
    objectives: List[str] = None  # Suggested learning objectives
    extracted_questions: List[Dict] = None  # Questions found in the material
    num_pages: int = 0
    chunks: List[str] = None
    full_text: str = ""  # Complete extracted text in markdown format
    
    def __post_init__(self):
        if self.objectives is None:
            self.objectives = []
        if self.extracted_questions is None:
            self.extracted_questions = []
    
    def to_dict(self) -> Dict:
        return {
            "source": self.source,
            "file_type": self.file_type,
            "topic": self.topic,
            "concepts": self.concepts,
            "objectives": self.objectives,
            "extracted_questions": self.extracted_questions,
            "summary": self.summary,
            "num_pages": self.num_pages
        }


class DocumentProcessor:
    """
    Efficient document processor using Gemini's native capabilities.
    
    Instead of extracting text and creating embeddings, we leverage
    Gemini's ability to directly understand PDF structure, images,
    and content.
    """
    
    def __init__(self):
        self.processed_docs: List[ProcessedDocument] = []
        self.uploaded_files: Dict[str, any] = {}  # For File API references
    
    async def process_pdf_native(self, pdf_path: str) -> ProcessedDocument:
        """
        Process PDF using Gemini's native multimodal understanding (Async).
        """
        if not GEMINI_AVAILABLE:
            return ProcessedDocument(
                source=Path(pdf_path).name,
                file_type="pdf",
                concepts=[],
                summary="Gemini not available"
            )
        
        file_size = os.path.getsize(pdf_path)
        file_name = Path(pdf_path).name
        
        # Read PDF as bytes
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
        
        if file_size > 20 * 1024 * 1024:  # > 20MB: Use File API
            return await self._process_large_pdf(pdf_path, file_name)
        else:
            return await self._process_inline_pdf(pdf_bytes, file_name)
    
    async def _process_inline_pdf(self, pdf_bytes: bytes, file_name: str) -> ProcessedDocument:
        """Process PDF inline (< 20MB) - single API call (Async)."""
        
        # Encode as base64 for Gemini
        pdf_b64 = base64.standard_b64encode(pdf_bytes).decode('utf-8')
        
        prompt = """Analyze this PDF document and extract educational content for CONCEPTUAL QUIZ generation (ConcepTest/peer instruction style).

Return a JSON object with:
{
    "topic": "Main topic/title of this document (e.g., 'Propositional Logic', 'Graph Algorithms')",
    "summary": "2-3 sentence summary of what this document covers",
    "concepts": ["concept1", "concept2", ...],  // 8-12 key concepts for quiz questions
    "objectives": ["Students will be able to...", ...],  // 4-6 learning objectives
    "extracted_questions": [  // ONLY extract SHORT conceptual multiple-choice questions
        {
            "prompt": "The question text (should be SHORT and conceptual)",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "correct_answer": "A/B/C/D",
            "source": "extracted"
        }
    ],
    "difficulty_level": "beginner/intermediate/advanced"
}

CRITICAL RULES for extracted_questions:
1. ONLY extract questions that are ALREADY multiple-choice with 4 options
2. SKIP long homework problems, proofs, or programming assignments
3. SKIP problems that require lengthy calculations or written explanations
4. PREFER short conceptual questions that test understanding ("What happens when...", "Which is true about...")
5. MAX 10 questions - pick the BEST conceptual ones
6. Each question prompt should be under 300 characters
7. If the document has no good MCQ questions, return an EMPTY array []

For topic: Give the main subject area this document covers.
For concepts: Be specific - not just "algorithms" but "time complexity of merge sort".
For objectives: Use action verbs like "explain", "implement", "compare", "analyze"."""

        try:
            from google.genai import types as genai_types

            pdf_part = genai_types.Part.from_bytes(
                data=base64.b64decode(pdf_b64),
                mime_type="application/pdf",
            )
            response = await call_gemini_with_timeout(
                [pdf_part, prompt],
                context={"agent": "document_processor", "operation": "process_inline_pdf"},
            )
            if response is None:
                raise RuntimeError("Gemini call returned None")

            result = self._parse_json_response(response.text)

            # Second call: extract complete text content for storage
            full_text = ""
            try:
                extract_prompt = """Extract the COMPLETE text content of this PDF document in clean markdown format.

Preserve:
- All headers (use # ## ### markdown headings)
- All paragraphs (full text, not summaries)
- All formulas (use LaTeX: $$...$$ for display, $...$ for inline)
- All lists and bullet points
- Table content (use markdown tables)
- Code blocks if any

Do NOT summarize or shorten — output the full content as-is in markdown.
Start directly with the content, no preamble."""

                extract_response = await call_gemini_with_timeout(
                    [pdf_part, extract_prompt],
                    context={"agent": "document_processor", "operation": "extract_full_text"},
                    generation_config={"max_output_tokens": 65536},
                )
                if extract_response is not None:
                    full_text = extract_response.text.strip()
            except Exception:
                # Non-critical — we still have the analysis result
                pass

            return ProcessedDocument(
                source=file_name,
                file_type="pdf",
                topic=result.get("topic", ""),
                concepts=result.get("concepts", []),
                objectives=result.get("objectives", []),
                extracted_questions=result.get("extracted_questions", []),
                summary=result.get("summary", ""),
                num_pages=0,
                full_text=full_text,
            )

        except Exception as e:
            from .sentry_config import capture_exception as _cap
            from .logging_config import get_logger as _gl, log_error as _le
            _cap(e, context={"service": "document_processor", "operation": "process_inline_pdf"})
            _le(_gl(__name__), "PDF processing error", error=str(e), file=file_name)
            # Re-raise so callers can handle gracefully (e.g. show user-friendly error)
            raise
    
    async def _process_large_pdf(self, pdf_path: str, file_name: str) -> ProcessedDocument:
        """Process large PDF using File API (> 20MB) (Async)."""
        
        try:
            # Upload to Gemini File API
            uploaded_file = gemini_client.files.upload(file=pdf_path)
            self.uploaded_files[file_name] = uploaded_file

            prompt = """Analyze this PDF document and extract educational content.

Return JSON:
{
    "summary": "2-3 sentence summary",
    "concepts": ["concept1", "concept2", ...],  // 8-12 key concepts
    "key_definitions": {"term": "definition"},
    "difficulty_level": "beginner/intermediate/advanced"
}

Focus on concepts that would make good quiz questions."""

            response = await call_gemini_with_timeout(
                [uploaded_file, prompt],
                context={"agent": "document_processor", "operation": "process_large_pdf"},
            )
            if response is None:
                raise RuntimeError("Gemini call returned None")
            result = self._parse_json_response(response.text)
            
            return ProcessedDocument(
                source=file_name,
                file_type="pdf",
                concepts=result.get("concepts", []),
                summary=result.get("summary", "")
            )
            
        except Exception as e:
            from .sentry_config import capture_exception as _cap
            from .logging_config import get_logger as _gl, log_error as _le
            _cap(e, context={"service": "document_processor", "operation": "process_large_pdf"})
            _le(_gl(__name__), "Large PDF processing error", error=str(e), file=file_name)
            raise
    
    async def process_text(self, text: str, source: str = "pasted") -> ProcessedDocument:
        """Process text content with Gemini (Async)."""
        
        if not GEMINI_AVAILABLE:
            return ProcessedDocument(
                source=source,
                file_type="text",
                concepts=[],
                summary="Gemini not available"
            )
        
        prompt = f"""Analyze this educational content and extract key information for CONCEPTUAL QUIZ generation.

CONTENT:
{text[:8000]}

Return JSON:
{{
    "topic": "Main topic/subject of this content (e.g., 'Propositional Logic', 'Data Structures')",
    "summary": "Brief summary of the content",
    "concepts": ["concept1", "concept2", ...],  // 6-10 specific concepts
    "objectives": ["Students will be able to...", ...],  // 3-5 learning objectives
    "extracted_questions": [  // ONLY short conceptual MCQ questions
        {{
            "prompt": "Short question (under 300 chars)",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "correct_answer": "A/B/C/D",
            "source": "extracted"
        }}
    ]
}}

CRITICAL RULES:
- ONLY extract questions that are ALREADY multiple-choice with 4 options
- SKIP homework problems, proofs, or lengthy calculations  
- MAX 10 questions - pick the BEST conceptual ones
- If no good MCQ questions exist, return empty array []"""

        try:
            response = await call_gemini_with_timeout(
                prompt,
                context={"agent": "document_processor", "operation": "process_text"},
            )
            if response is None:
                raise RuntimeError("Gemini call returned None")
            result = self._parse_json_response(response.text)
            
            return ProcessedDocument(
                source=source,
                file_type="text",
                topic=result.get("topic", ""),
                concepts=result.get("concepts", []),
                objectives=result.get("objectives", []),
                extracted_questions=result.get("extracted_questions", []),
                summary=result.get("summary", ""),
                full_text=text,  # Store raw text directly
            )
            
        except Exception as e:
            from .sentry_config import capture_exception as _cap
            from .logging_config import get_logger as _gl, log_error as _le
            _cap(e, context={"service": "document_processor", "operation": "process_text"})
            _le(_gl(__name__), "Text processing error", error=str(e), source=source)
            raise
    
    async def process_image(self, image_path: str) -> ProcessedDocument:
        """Process image (diagram, chart, etc.) with Gemini vision (Async)."""
        
        if not GEMINI_AVAILABLE:
            return ProcessedDocument(
                source=Path(image_path).name,
                file_type="image",
                concepts=[],
                summary="Gemini not available"
            )
        
        with open(image_path, 'rb') as f:
            image_bytes = f.read()
        
        # Detect MIME type
        if image_path.lower().endswith('.png'):
            mime = "image/png"
        elif image_path.lower().endswith(('.jpg', '.jpeg')):
            mime = "image/jpeg"
        else:
            mime = "image/png"
        
        image_b64 = base64.standard_b64encode(image_bytes).decode('utf-8')
        
        prompt = """Analyze this educational diagram/image and extract concepts.

Return JSON:
{
    "description": "What this image shows",
    "concepts": ["concept1", "concept2"],  // Key concepts illustrated
    "labels": ["label1", "label2"]  // Any text labels visible
}"""

        try:
            from google.genai import types as genai_types

            image_part = genai_types.Part.from_bytes(
                data=base64.b64decode(image_b64),
                mime_type=mime,
            )
            response = await call_gemini_with_timeout(
                [image_part, prompt],
                context={"agent": "document_processor", "operation": "process_image"},
            )
            if response is None:
                raise RuntimeError("Gemini call returned None")

            result = self._parse_json_response(response.text)
            
            return ProcessedDocument(
                source=Path(image_path).name,
                file_type="image",
                concepts=result.get("concepts", []),
                summary=result.get("description", "")
            )
            
        except Exception as e:
            print(f"Image processing error: {e}")
            return ProcessedDocument(
                source=Path(image_path).name,
                file_type="image",
                concepts=[],
                summary=f"Error: {str(e)}"
            )
    
    def _parse_json_response(self, text: str) -> Dict:
        """Parse JSON from LLM response."""
        text = text.strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        return {}
    
    async def process_file(self, file_path: str) -> ProcessedDocument:
        """Auto-detect file type and process (Async)."""
        path = Path(file_path)
        suffix = path.suffix.lower()
        
        if suffix == '.pdf':
            return await self.process_pdf_native(file_path)
        elif suffix in ['.png', '.jpg', '.jpeg', '.webp']:
            return await self.process_image(file_path)
        elif suffix in ['.txt', '.md', '.py', '.js']:
            with open(file_path, 'r') as f:
                return await self.process_text(f.read(), path.name)
        else:
            return ProcessedDocument(
                source=path.name,
                file_type="unknown",
                concepts=[],
                summary=f"Unsupported file type: {suffix}"
            )
    
    def get_all_concepts(self) -> List[str]:
        """Get all unique concepts from processed documents."""
        concepts = []
        seen = set()
        for doc in self.processed_docs:
            for c in doc.concepts:
                if c.lower() not in seen:
                    concepts.append(c)
                    seen.add(c.lower())
        return concepts
    
    def get_context_for_generation(self, topic: str, concepts: List[str]) -> str:
        """Get relevant context for question generation."""
        # If we have uploaded files, we can reference them directly
        context_parts = []
        
        for doc in self.processed_docs:
            if doc.summary:
                context_parts.append(f"From {doc.source}: {doc.summary}")
        
        return "\n\n".join(context_parts)
    
    def clear(self):
        """Clear all processed documents."""
        self.processed_docs = []
        # Note: Files uploaded to Gemini expire after 48h automatically


# Global processor instance
doc_processor = DocumentProcessor()


# ============================================================================
# INTEGRATION FUNCTIONS
# ============================================================================

async def process_materials_efficient(files, text_content: str, url_content: str) -> Tuple[str, str, str, str]:
    """
    Process materials using Gemini's native capabilities (Async).
    Returns (status_message, suggested_topic, extracted_concepts_csv, extracted_objectives_newline).
    """
    global doc_processor
    doc_processor.clear()
    
    results = []
    topics = []
    all_concepts = []
    all_objectives = []
    
    # Process files
    if files:
        for f in files:
            try:
                doc = await doc_processor.process_file(f.name)
                doc_processor.processed_docs.append(doc)
                results.append(f"📄 {doc.source}: {len(doc.concepts)} concepts, {len(doc.objectives)} objectives")
                if doc.topic:
                    topics.append(doc.topic)
                all_concepts.extend(doc.concepts)
                all_objectives.extend(doc.objectives)
            except Exception as e:
                results.append(f"❌ {Path(f.name).name}: {e}")
    
    # Process pasted text
    if text_content and text_content.strip():
        doc = await doc_processor.process_text(text_content, "pasted_content")
        doc_processor.processed_docs.append(doc)
        results.append(f"📝 Pasted text: {len(doc.concepts)} concepts, {len(doc.objectives)} objectives")
        if doc.topic:
            topics.append(doc.topic)
        all_concepts.extend(doc.concepts)
        all_objectives.extend(doc.objectives)
    
    if not results:
        return "No materials processed.", "", "", ""
    
    # Deduplicate concepts
    unique_concepts = []
    seen = set()
    for c in all_concepts:
        if c.lower() not in seen:
            unique_concepts.append(c)
            seen.add(c.lower())
    
    # Deduplicate objectives
    unique_objectives = []
    seen_obj = set()
    for o in all_objectives:
        if o.lower() not in seen_obj:
            unique_objectives.append(o)
            seen_obj.add(o.lower())
    
    # Pick first topic as suggested
    suggested_topic = topics[0] if topics else ""
    
    status = f"""✅ **Documents Processed with Gemini Native**

**Topic:** {suggested_topic or 'Not detected'}
**Documents:** {len(doc_processor.processed_docs)}
**Concepts:** {len(unique_concepts)}
**Objectives:** {len(unique_objectives)}

**Results:**
""" + "\n".join(f"- {r}" for r in results)
    
    concepts_str = ", ".join(unique_concepts)
    objectives_str = "\n".join(unique_objectives)
    
    return status, suggested_topic, concepts_str, objectives_str


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    print("Testing Document Processor...")
    
    processor = DocumentProcessor()
    
    # Test text
    result = processor.process_text("""
    Binary Search Trees maintain sorted order with O(log n) operations.
    AVL trees are self-balancing BSTs using rotation operations.
    Red-Black trees use color properties to maintain balance.
    """, "data_structures_notes")
    
    print(f"Concepts: {result.concepts}")
    print(f"Summary: {result.summary}")

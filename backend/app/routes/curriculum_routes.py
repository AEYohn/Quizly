"""
Curriculum Routes
API endpoints for curriculum setup: material processing, concept extraction,
and question generation from uploaded documents.
"""

import os
import json
import tempfile
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pathlib import Path

from ..schemas import (
    MaterialProcessRequest,
    MaterialProcessResponse,
    ExtractedQuestion,
    CurriculumSetupRequest,
    GenerateFromCurriculumRequest,
    QuestionResponse,
    QuestionGenerateResponse,
)

# Import document processor
try:
    from ..document_processor import DocumentProcessor, ProcessedDocument
    DOC_PROCESSOR_AVAILABLE = True
    doc_processor = DocumentProcessor()
except ImportError as e:
    print(f"Document processor import error: {e}")
    DOC_PROCESSOR_AVAILABLE = False
    doc_processor = None

# Gemini for question generation
try:
    import google.generativeai as genai
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        MODEL = genai.GenerativeModel('gemini-2.0-flash')
        GEMINI_AVAILABLE = True
    else:
        MODEL = None
        GEMINI_AVAILABLE = False
except ImportError:
    MODEL = None
    GEMINI_AVAILABLE = False


router = APIRouter()


# ==============================================================================
# Material Processing
# ==============================================================================

@router.post("/process-materials", response_model=MaterialProcessResponse)
async def process_materials(
    files: List[UploadFile] = File(default=[]),
    text_content: Optional[str] = Form(default=None),
    url: Optional[str] = Form(default=None)
):
    """
    Process uploaded course materials.
    
    POST /curriculum/process-materials
    
    Accepts PDFs, text files, images, or pasted content.
    Returns extracted topic, concepts, objectives, and existing questions.
    """
    if not DOC_PROCESSOR_AVAILABLE:
        raise HTTPException(status_code=500, detail="Document processor not available")
    
    doc_processor.clear()
    
    all_topics = []
    all_concepts = []
    all_objectives = []
    all_questions = []
    summaries = []
    
    # Process uploaded files
    for upload_file in files:
        try:
            # Save to temp file
            suffix = Path(upload_file.filename).suffix
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await upload_file.read()
                tmp.write(content)
                tmp_path = tmp.name
            
            # Process with document processor
            doc = doc_processor.process_file(tmp_path)
            doc_processor.processed_docs.append(doc)
            
            if doc.topic:
                all_topics.append(doc.topic)
            all_concepts.extend(doc.concepts)
            all_objectives.extend(doc.objectives)
            all_questions.extend(doc.extracted_questions)
            if doc.summary:
                summaries.append(f"{upload_file.filename}: {doc.summary}")
            
            # Clean up temp file
            os.unlink(tmp_path)
            
        except Exception as e:
            print(f"Error processing {upload_file.filename}: {e}")
    
    # Process pasted text
    if text_content and text_content.strip():
        doc = doc_processor.process_text(text_content, "pasted_content")
        doc_processor.processed_docs.append(doc)
        
        if doc.topic:
            all_topics.append(doc.topic)
        all_concepts.extend(doc.concepts)
        all_objectives.extend(doc.objectives)
        all_questions.extend(doc.extracted_questions)
        if doc.summary:
            summaries.append(doc.summary)
    
    # Deduplicate
    unique_concepts = list(dict.fromkeys(all_concepts))
    unique_objectives = list(dict.fromkeys(all_objectives))
    
    # Pick first topic
    topic = all_topics[0] if all_topics else ""
    
    # Convert extracted questions to schema
    extracted_qs = [
        ExtractedQuestion(
            prompt=q.get("prompt", ""),
            options=q.get("options", []),
            correct_answer=q.get("correct_answer"),
            source=q.get("source"),
            concept=q.get("concept")
        )
        for q in all_questions if isinstance(q, dict)
    ]
    
    return MaterialProcessResponse(
        status="success",
        topic=topic,
        concepts=unique_concepts,
        objectives=unique_objectives,
        extracted_questions=extracted_qs,
        summary=" | ".join(summaries),
        documents_processed=len(doc_processor.processed_docs)
    )


# ==============================================================================
# Question Generation from Curriculum
# ==============================================================================

@router.post("/generate-questions")
async def generate_questions_from_curriculum(request: GenerateFromCurriculumRequest):
    """
    Generate questions from curriculum setup.
    
    POST /curriculum/generate-questions
    
    Takes topic, concepts, objectives, and optionally materials context.
    Returns generated questions plus any extracted questions from materials.
    """
    if not GEMINI_AVAILABLE or not MODEL:
        raise HTTPException(status_code=500, detail="Gemini API not available")
    
    # Build prompt
    objectives_str = "\n".join(f"- {obj}" for obj in request.objectives) if request.objectives else ""
    materials_str = request.materials_context or ""
    
    prompt = f"""You are an expert professor creating peer instruction questions.

TOPIC: {request.topic}
CONCEPTS: {', '.join(request.concepts)}

{f'LEARNING OBJECTIVES:{chr(10)}{objectives_str}' if objectives_str else ''}

{f'MATERIALS CONTEXT:{chr(10)}{materials_str}' if materials_str else ''}

Generate {request.num_questions} high-quality multiple choice questions.

For EACH question:
1. Make it SPECIFIC with real content
2. Include 4 options with ONE correct answer
3. Vary the correct answer position (A, B, C, or D)
4. Include a detailed explanation

Return JSON array:
[
    {{
        "concept": "concept_name",
        "prompt": "Specific question text",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "correct_answer": "A/B/C/D",
        "explanation": "Why correct is right and others are wrong",
        "difficulty": 0.0-1.0,
        "source": "generated"
    }}
]"""

    try:
        response = MODEL.generate_content(prompt)
        text = response.text.strip()
        
        # Parse JSON
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            generated = json.loads(text[start:end])
        else:
            generated = []
        
        # Add IDs
        import random
        for q in generated:
            q["id"] = f"gen_{random.randint(1000, 9999)}"
            q["status"] = "pending"
        
        # Include extracted questions if requested
        all_questions = generated
        
        if request.include_extracted and doc_processor and doc_processor.processed_docs:
            for doc in doc_processor.processed_docs:
                for eq in doc.extracted_questions:
                    if isinstance(eq, dict):
                        all_questions.append({
                            "id": f"ext_{random.randint(1000, 9999)}",
                            "concept": eq.get("concept", request.topic),
                            "prompt": eq.get("prompt", ""),
                            "options": eq.get("options", []),
                            "correct_answer": eq.get("correct_answer", ""),
                            "explanation": "Extracted from course materials",
                            "difficulty": 0.5,
                            "source": eq.get("source", "extracted"),
                            "status": "pending"
                        })
        
        return {
            "topic": request.topic,
            "questions": all_questions,
            "generated_count": len(generated),
            "extracted_count": len(all_questions) - len(generated)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")


# ==============================================================================
# Curriculum Status
# ==============================================================================

@router.get("/status")
async def curriculum_status():
    """Check curriculum processing status."""
    return {
        "doc_processor_available": DOC_PROCESSOR_AVAILABLE,
        "gemini_available": GEMINI_AVAILABLE,
        "documents_loaded": len(doc_processor.processed_docs) if doc_processor else 0
    }

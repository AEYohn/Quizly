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
            doc = await doc_processor.process_file(tmp_path)
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
        doc = await doc_processor.process_text(text_content, "pasted_content")
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
    
    # Build prompt based on format
    objectives_str = "\n".join(f"- {obj}" for obj in request.objectives) if request.objectives else ""
    materials_str = request.materials_context or ""
    question_format = getattr(request, 'format', 'mcq') or 'mcq'
    code_language = getattr(request, 'language', 'python') or 'python'
    
    if question_format == 'code':
        # Generate code questions
        # Build language-specific examples that MATCH the actual code runner wrapper
        if code_language == 'cpp':
            # C++ wrapper expects: solution(string input) -> returns auto (typically string)
            # Input is passed as raw JSON string via stdin
            starter_example = '''// Problem: Given an array of integers, find the sum
// Input: JSON string like "[1, 2, 3, 4, 5]"
// Output: Print the result

#include <sstream>  // for string parsing

// This function receives the raw JSON input as a string
// Parse it and return the result as a string
string solution(string input) {
    // Parse the input (it's a JSON array like "[1, 2, 3]")
    // The parseIntArray helper is available to convert to vector<int>
    
    // Your code here
    
    return "";  // Return result as string
}'''
            test_case_example = '''IMPORTANT: Input is passed as a raw JSON string to solution(string input)
The wrapper provides these helpers:
- parseIntArray(input) -> vector<int> for arrays like "[1, 2, 3]"  
- parseJsonString(input) -> string for strings like "\\"hello\\""

Example test cases:
  input: "[1, 2, 3]"
  expected_output: "6"'''
        elif code_language == 'javascript':
            # JavaScript wrapper calls: solution(...args) where args is parsed JSON
            starter_example = '''// Problem: Given an array of integers, find the sum
// Input will be passed as function arguments

function solution(nums) {
    // Your code here
    
}'''
            test_case_example = '''Input is automatically parsed from JSON and passed to solution().
For arrays: input "[1, 2, 3]" calls solution([1, 2, 3])
For objects: input {"n": 5, "arr": [1,2]} calls solution(n=5, arr=[1,2])

Example test cases:
  input: "[1, 2, 3]"
  expected_output: "6"'''
        else:  # python
            # Python wrapper auto-detects function and passes kwargs/args
            starter_example = '''# Problem: Given an array of integers, find the sum
# Input will be passed as function parameters

def solution(nums):
    # Your code here
    pass'''
            test_case_example = '''Input is automatically parsed from JSON and passed to your function.
For arrays: input "[1, 2, 3]" calls solution([1, 2, 3]) OR solution(nums=[1,2,3])
For objects: input {"n": 5, "arr": [1,2]} calls solution(n=5, arr=[1,2])

Example test cases:
  input: "[1, 2, 3]"
  expected_output: "6"

Example with multiple params:
  input: "{{\\"nums\\": [1, 2, 3], \\"target\\": 3}}"
  expected_output: "[0, 1]"'''
        
        prompt = f"""You are an expert professor creating coding problems for students.

TOPIC: {request.topic}
CONCEPTS: {', '.join(request.concepts)}
PROGRAMMING LANGUAGE: {code_language}

{f'LEARNING OBJECTIVES:{chr(10)}{objectives_str}' if objectives_str else ''}

{f'MATERIALS CONTEXT:{chr(10)}{materials_str}' if materials_str else ''}

Generate {request.num_questions} coding problems in {code_language}.

CRITICAL - STARTER CODE RULES:
- Starter code must be a SKELETON/TEMPLATE only, NOT a complete solution
- Include function signature and any necessary imports/includes
- Use comments like "// Your code here" or "# TODO: implement" to mark where students write code
- DO NOT include the algorithm logic - students must write that themselves

CRITICAL - TEST CASE FORMAT RULES:
- Input must be valid JSON that can be parsed
- For single values: use JSON primitives like "5" or "\\"hello\\""
- For arrays: use JSON array format like "[1, 2, 3]"
- For multiple parameters: use JSON object like "{{\\"n\\": 8, \\"prices\\": [1, 5, 8]}}"
- expected_output must be a STRING representing the expected return value
- DO NOT use formats like "n = 8, prices = {{1,2,3}}" - this is NOT valid JSON

{test_case_example}

For EACH problem:
1. Make it SPECIFIC and educational
2. Start with an easy problem and gradually increase difficulty
3. Include SKELETON starter code (NOT the solution!)
4. Include 2-3 test cases with VALID JSON input format
5. Include a detailed explanation of the approach

EXAMPLE of proper starter code:
```
{starter_example}
```

Return JSON array:
[
    {{
        "concept": "concept_name",
        "prompt": "Clear problem description explaining what to implement",
        "format": "code",
        "language": "{code_language}",
        "starter_code": "<SKELETON CODE with function signature and TODOs, NOT the solution>",
        "test_cases": [
            {{"input": "[1, 2, 3]", "expected_output": "6", "is_hidden": false}},
            {{"input": "[10, 20, 30]", "expected_output": "60", "is_hidden": true}}
        ],
        "explanation": "Approach explanation (shown after solving)",
        "difficulty": 0.0-1.0,
        "source": "generated",
        "options": [],
        "correct_answer": ""
    }}
]"""
    elif question_format == 'mixed':
        # Generate mix of MCQ and code
        prompt = f"""You are an expert professor creating educational questions.

TOPIC: {request.topic}
CONCEPTS: {', '.join(request.concepts)}
PROGRAMMING LANGUAGE: {code_language}

{f'LEARNING OBJECTIVES:{chr(10)}{objectives_str}' if objectives_str else ''}

{f'MATERIALS CONTEXT:{chr(10)}{materials_str}' if materials_str else ''}

Generate {request.num_questions} questions - ALTERNATE between MCQ and coding problems.

For MCQ questions, include:
- prompt, options (4 choices), correct_answer (A/B/C/D), explanation, format: "mcq"

For CODING problems:
- prompt: Clear problem description
- starter_code: SKELETON code only (function signature + "// Your code here"), NOT the solution!
- test_cases with VALID JSON input format (see below)
- explanation, language: "{code_language}", format: "code"

CRITICAL - TEST CASE FORMAT:
- Input must be valid JSON: "[1, 2, 3]" for arrays, "5" for numbers, "{{\\"key\\": value}}" for objects
- DO NOT use invalid formats like "n = 8, arr = {{1,2,3}}"
- expected_output is a string of the expected return value

Return JSON array:
[
    {{
        "concept": "concept_name",
        "prompt": "Question text",
        "format": "mcq" or "code",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],  // for MCQ
        "correct_answer": "A/B/C/D",  // for MCQ
        "language": "{code_language}",  // for code
        "starter_code": "def func(params):\\n    # Your code here\\n    pass",  // SKELETON only for code
        "test_cases": [{{"input": "[1, 2, 3]", "expected_output": "6", "is_hidden": false}}],  // valid JSON input
        "explanation": "Explanation",
        "difficulty": 0.0-1.0,
        "source": "generated"
    }}
]"""
    else:
        # Generate MCQ questions (default)
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
        response = MODEL.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        text = response.text.strip()
        
        # Parse JSON - handle potential issues
        try:
            # Try direct parse first
            if text.startswith("["):
                generated = json.loads(text)
            else:
                # Extract JSON array from response
                start = text.find("[")
                end = text.rfind("]") + 1
                if start >= 0 and end > start:
                    generated = json.loads(text[start:end])
                else:
                    generated = []
        except json.JSONDecodeError as je:
            print(f"JSON parse error: {je}, attempting cleanup...")
            # Clean up control characters and retry
            import re
            cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
            start = cleaned.find("[")
            end = cleaned.rfind("]") + 1
            if start >= 0 and end > start:
                generated = json.loads(cleaned[start:end])
            else:
                generated = []
        
        # Handle case where AI returns a single object instead of array
        if isinstance(generated, dict):
            generated = [generated]
        
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

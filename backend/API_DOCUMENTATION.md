# Quizly API Documentation

Complete API reference for frontend developers.

**Base URL:** `http://localhost:8000`

---

## Table of Contents

1. [Live Sessions (Teacher-Student)](#live-sessions)
2. [AI Features](#ai-features)
3. [Curriculum Management](#curriculum-management)
4. [TypeScript Interfaces](#typescript-interfaces)

---

## Live Sessions

Real-time teacher-student session management.

### Check Active Session

```
GET /live-sessions/active
```

**Response:**
```json
{
  "active": true,
  "session_id": "20260118_185200",
  "topic": "Propositional Logic",
  "num_questions": 4,
  "updated_at": "2026-01-18T18:52:00"
}
```

---

### Start Session (Teacher)

```
POST /live-sessions/start
Content-Type: application/json
```

**Request:**
```json
{
  "topic": "Propositional Logic",
  "questions": [
    {
      "id": "q_1",
      "concept": "AND Operator",
      "prompt": "What is true AND false?",
      "options": ["A. true", "B. false", "C. undefined", "D. null"],
      "correct_answer": "B",
      "difficulty": 0.3,
      "explanation": "AND requires both operands to be true."
    }
  ],
  "objectives": ["Understand boolean logic", "Apply truth tables"]
}
```

**Response:**
```json
{
  "session_id": "20260118_185200",
  "topic": "Propositional Logic",
  "status": "active",
  "questions": [...],
  "current_question_index": 0,
  "student_count": 0,
  "started_at": "2026-01-18T18:52:00",
  "updated_at": "2026-01-18T18:52:00"
}
```

---

### Join Session (Student)

```
POST /live-sessions/join
Content-Type: application/json
```

**Request:**
```json
{
  "student_name": "Alice"
}
```

**Response:**
```json
{
  "session_id": "20260118_185200",
  "topic": "Propositional Logic",
  "student_name": "Alice",
  "num_questions": 4,
  "current_question_index": 0,
  "current_question": {
    "id": "q_1",
    "concept": "AND Operator",
    "prompt": "What is true AND false?",
    "options": ["A. true", "B. false", "C. undefined", "D. null"]
  }
}
```

---

### Submit Response (Student)

```
POST /live-sessions/submit
Content-Type: application/json
```

**Request:**
```json
{
  "student_name": "Alice",
  "question_id": "q_1",
  "answer": "B",
  "reasoning": "AND returns true only when both are true",
  "confidence": 85,
  "response_type": "mcq"
}
```

Supported `response_type` values:
- `mcq` - Multiple choice answer
- `code` - Code submission (include `code_submission` field)
- `image` - Diagram/image upload (include `image_description`)
- `text` - Free text explanation

**Response:**
```json
{
  "success": true,
  "message": "Response recorded",
  "submitted_at": "2026-01-18T18:53:00"
}
```

---

### Get Session Status (Teacher Dashboard)

```
GET /live-sessions/status
```

**Response:**
```json
{
  "session_id": "20260118_185200",
  "topic": "Propositional Logic",
  "status": "active",
  "current_question_index": 0,
  "total_questions": 4,
  "students_joined": ["Alice", "Bob", "Charlie"],
  "responses_count": 5,
  "last_updated": "2026-01-18T18:55:00"
}
```

---

### Get Specific Question

```
GET /live-sessions/question/{question_index}
```

**Response:**
```json
{
  "question_index": 0,
  "question": {
    "id": "q_1",
    "concept": "AND Operator",
    "prompt": "What is true AND false?",
    "options": ["A. true", "B. false", "C. undefined", "D. null"],
    "correct_answer": "B",
    "explanation": "AND requires both operands to be true."
  }
}
```

---

### Advance to Next Question (Teacher)

```
POST /live-sessions/next-question
```

**Response:**
```json
{
  "message": "Advanced to next question",
  "current_index": 1,
  "question": { ... }
}
```

---

### Get Question Responses (Teacher)

```
GET /live-sessions/responses/{question_id}
```

**Response:**
```json
{
  "question_id": "q_1",
  "responses": {
    "Alice": {
      "answer": "B",
      "reasoning": "AND requires both to be true",
      "confidence": 85,
      "response_type": "mcq",
      "submitted_at": "2026-01-18T18:53:00"
    },
    "Bob": {
      "answer": "A",
      "reasoning": "I thought true always wins",
      "confidence": 40,
      "response_type": "mcq",
      "submitted_at": "2026-01-18T18:53:30"
    }
  },
  "count": 2
}
```

---

### End Session (Teacher)

```
POST /live-sessions/end
```

**Response:**
```json
{
  "message": "Session ended",
  "session_id": "20260118_185200",
  "students_participated": 3,
  "total_responses": 12
}
```

---

## AI Features

AI-powered educational features.

### Generate Questions

```
POST /ai/generate-questions
Content-Type: application/json
```

**Request:**
```json
{
  "topic": "Graph Algorithms",
  "concepts": [
    {"id": "bfs", "name": "Breadth-First Search", "topics": [], "misconceptions": []}
  ],
  "num_questions": 4,
  "course_context": "Undergraduate CS algorithms course"
}
```

---

### Analyze Student Response

```
POST /ai/analyze-response
Content-Type: application/json
```

**Request:**
```json
{
  "question": { "prompt": "...", "options": [...], "correct_answer": "B" },
  "answer": "A",
  "reasoning": "I thought the complexity was O(n)",
  "confidence": 60
}
```

**Response:**
```json
{
  "is_correct": false,
  "reasoning_score": 45,
  "strengths": ["Good attempt at analyzing complexity"],
  "misconceptions": ["Confused O(n) with O(log n)"],
  "tips": ["Review Big-O notation rules"],
  "feedback_message": "Close! Remember that..."
}
```

---

### Generate Peer Discussion

```
POST /ai/peer-discussion
Content-Type: application/json
```

**Request:**
```json
{
  "question": { "prompt": "...", "options": [...] },
  "student_answer": "A",
  "student_reasoning": "I believe..."
}
```

**Response:**
```json
{
  "peer_name": "Alex",
  "peer_answer": "B",
  "peer_reasoning": "I initially thought A too, but...",
  "discussion_prompt": "What made you choose A over B?",
  "insight": "The key difference is..."
}
```

---

### Generate Exit Ticket

```
POST /ai/exit-ticket
Content-Type: application/json
```

**Request:**
```json
{
  "student_name": "Alice",
  "topic": "Boolean Logic",
  "responses": [
    {"question_prompt": "...", "student_answer": "B", "was_correct": true, "concept": "AND"}
  ]
}
```

---

## Curriculum Management

Material processing and question generation.

### Process Materials

```
POST /curriculum/process-materials
Content-Type: multipart/form-data
```

**Form Fields:**
- `files[]` - PDF or text files (optional)
- `text_content` - Pasted text content (optional)
- `url` - URL to fetch content from (optional)

**Response:**
```json
{
  "status": "success",
  "topic": "Binary Search Trees",
  "concepts": ["insertion", "deletion", "traversal"],
  "objectives": ["Implement BST operations", "Analyze BST complexity"],
  "extracted_questions": [...],
  "summary": "Document covers BST fundamentals...",
  "documents_processed": 2
}
```

---

### Generate Questions from Curriculum

```
POST /curriculum/generate-questions
Content-Type: application/json
```

**Request:**
```json
{
  "topic": "Binary Search Trees",
  "concepts": ["insertion", "deletion", "traversal"],
  "objectives": ["Implement BST operations"],
  "num_questions": 4,
  "include_extracted": true,
  "materials_context": "Summary of uploaded materials..."
}
```

---

## TypeScript Interfaces

Copy these to your frontend project:

```typescript
// ============================================
// Live Sessions
// ============================================

interface ActiveSessionInfo {
  active: boolean;
  session_id?: string;
  topic?: string;
  num_questions: number;
  updated_at?: string;
}

interface LiveSessionStartRequest {
  topic: string;
  questions: Question[];
  objectives: string[];
}

interface Question {
  id: string;
  concept: string;
  prompt: string;
  options: string[];
  correct_answer: string;
  difficulty: number;
  explanation: string;
}

interface StudentJoinRequest {
  student_name: string;
}

interface StudentJoinResponse {
  session_id: string;
  topic: string;
  student_name: string;
  num_questions: number;
  current_question_index: number;
  current_question: Question | null;
}

interface StudentSubmissionRequest {
  student_name: string;
  question_id: string;
  answer: string;
  reasoning?: string;
  confidence: number;
  response_type: 'mcq' | 'code' | 'image' | 'text';
  code_submission?: string;
  image_description?: string;
}

interface SessionStatus {
  session_id: string;
  topic: string;
  status: 'active' | 'paused' | 'completed';
  current_question_index: number;
  total_questions: number;
  students_joined: string[];
  responses_count: number;
  last_updated: string;
}

// ============================================
// AI Features  
// ============================================

interface AnalyzeResponseRequest {
  question: Question;
  answer: string;
  reasoning?: string;
  confidence: number;
}

interface AnalyzeResponseResult {
  is_correct: boolean;
  reasoning_score: number;
  strengths: string[];
  misconceptions: string[];
  tips: string[];
  feedback_message: string;
}

interface PeerDiscussion {
  peer_name: string;
  peer_answer: string;
  peer_reasoning: string;
  discussion_prompt: string;
  insight: string;
}

// ============================================
// API Client Example
// ============================================

const API_BASE = 'http://localhost:8000';

export const quizlyApi = {
  // Live Sessions
  checkActiveSession: () => 
    fetch(`${API_BASE}/live-sessions/active`).then(r => r.json()),
  
  startSession: (data: LiveSessionStartRequest) =>
    fetch(`${API_BASE}/live-sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  
  joinSession: (name: string) =>
    fetch(`${API_BASE}/live-sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: name })
    }).then(r => r.json()),
  
  submitResponse: (data: StudentSubmissionRequest) =>
    fetch(`${API_BASE}/live-sessions/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  
  getSessionStatus: () =>
    fetch(`${API_BASE}/live-sessions/status`).then(r => r.json()),
  
  // AI Features
  analyzeResponse: (data: AnalyzeResponseRequest) =>
    fetch(`${API_BASE}/ai/analyze-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  
  getPeerDiscussion: (question: Question, answer: string, reasoning?: string) =>
    fetch(`${API_BASE}/ai/peer-discussion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, student_answer: answer, student_reasoning: reasoning })
    }).then(r => r.json()),
};
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "detail": "Error message here"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (validation error)
- `404` - Not found (no active session, question not found)
- `500` - Server error

---

## WebSocket (Real-time Updates)

For real-time response streaming:

```
WS /responses/ws/{session_id}
```

**Send:**
```json
{
  "type": "submit_answer",
  "question_id": 1,
  "user_id": 123,
  "answer": "B",
  "confidence": 80,
  "rationale": "Because..."
}
```

**Receive:**
```json
{
  "type": "new_response",
  "response": { ... }
}
```

# 🔧 Technical Specifications

## Overall Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend (Classroom App)"]
        IU[Instructor UI]
        SU[Student UI]
    end
    
    subgraph Backend["Backend API"]
        API[FastAPI REST]
        WS[WebSocket Server]
        DB[(PostgreSQL)]
        Cache[(Redis)]
    end
    
    subgraph AI["AI Orchestration"]
        SP[Session Planner]
        QD[Question Designer]
        PA[Pulse Analyzer]
        DF[Discussion Facilitator]
        ET[Exit-Ticket Agent]
    end
    
    Frontend <-->|HTTPS| API
    Frontend <-->|WSS| WS
    API <--> DB
    API <--> Cache
    API <--> AI
    AI <-->|Gemini API| GM[Google Gemini]
```

---

## Frontend (Classroom App)

### Instructor UI

| View | Components |
|------|------------|
| **Session Creator** | JSON editor / form for topic, concepts, constraints; Preview of generated questions with approve/edit |
| **Live Control Panel** | Current question display, timer controls, next question queue; Real-time answer distribution visualization; Controls: trigger discussion, skip, extend time, request simplified follow-up |
| **Analytics Dashboard** | Per-concept heatmap, trends over sessions, export reports |

### Student UI

| View | Components |
|------|------------|
| **Join Screen** | Session code + name input |
| **Question Screen** | MCQ / short-answer input, confidence slider, optional rationale textbox |
| **Post-Question** | Peer discussion prompt, explanation reveal |
| **Post-Class** | Exit ticket (1-2 personalized questions), strengths/weaknesses summary |

### Real-Time Layer (WebSocket)

| Channel | Purpose |
|---------|---------|
| `session:<id>:question` | Broadcast questions and timers to all participants |
| `session:<id>:responses` | Push aggregate stats to instructor; acknowledge individual responses to students |

---

## Backend (Core API & Logic)

### API Endpoints

#### Session Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create session from JSON syllabus |
| `GET` | `/sessions/{id}` | Fetch session + question list |
| `POST` | `/sessions/{id}/start` | Start live session |
| `POST` | `/sessions/{id}/next` | Advance to next question |

#### Response Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| `WS` | `/ws/submit_answer` | WebSocket endpoint for answer submission |
| `GET` | `/sessions/{id}/responses` | Get all responses for a session |

#### Analytics Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sessions/{id}/analytics` | Per-question metrics |
| `GET` | `/users/{id}/mastery` | Per-student concept mastery |

## AI Orchestration Service

### Agent Overview

| Agent | Input | Output |
|-------|-------|--------|
| **Session Planner** | Topic, concepts, time budget | List of question specs (concept, difficulty, type, target time) |
| **Question Designer** | Question spec | Prompt, options, correct answer, explanation with plausible distractors |
| **Pulse Analyzer** | Responses + concept | Consensus summary, misconception descriptions, adaptation recommendation |
| **Discussion Facilitator** | Question + misconception summary | 1-3 short peer-discussion prompts |
| **Exit-Ticket Agent** | Per-student weakest concepts + history | Micro-lesson + one personalized question |

---

## Detailed Agent Architecture (Implementation)

### Agent Pipeline Flow

```mermaid
flowchart TB
    subgraph TEACHER["🎓 Teacher Layer"]
        QG[Question Generator<br>ai_generate_session_plan]
        RA[Response Analyzer<br>ai_analyze_responses]
        RC[Recommendation Engine]
    end
    
    subgraph STUDENTS["👥 Student Agent Layer"]
        S1[ReasoningStudent<br>persona: novice]
        S2[ReasoningStudent<br>persona: average]
        S3[ReasoningStudent<br>persona: competent]
        S4[ReasoningStudent<br>persona: overconfident]
    end
    
    subgraph DEBATE["🗣️ Peer Discussion Layer"]
        DE[DebateEngine<br>Pairs opposing students]
        CC[Competitive Consensus<br>Aggregates outcomes]
    end
    
    subgraph STATE["📊 Shared State"]
        SS[SharedSession<br>Cross-process sync]
        EX[Export Module<br>JSON/Analytics]
    end
    
    QG -->|questions| SS
    SS -->|distribute| S1 & S2 & S3 & S4
    S1 & S2 & S3 & S4 -->|responses + reasoning| SS
    SS -->|analyze| RA
    RA --> RC
    RC -->|PEER_DISCUSSION| DE
    DE -->|pairs| S1 <-.debate.-> S2
    DE -->|pairs| S3 <-.debate.-> S4
    CC -->|learning metrics| EX
```

### ReasoningStudent Agent

**File:** `experimentation/simulation/reasoning_student.py`

```python
@dataclass
class ReasoningStudent:
    id: int
    name: str
    persona_type: str  # novice | average | competent | overconfident
    knowledge_level: float  # 0.0 - 1.0
    active_misconceptions: List[Misconception]
    susceptibility_to_persuasion: float
    confidence_bias: float
```

**Persona Templates:**

| Persona | Knowledge | Confidence Bias | Susceptibility | Common Misconceptions |
|---------|-----------|-----------------|----------------|----------------------|
| `novice` | 25% | +10% | 80% | BFS/DFS confusion, basic errors |
| `average` | 45% | +5% | 55% | Dijkstra negative edges |
| `competent` | 65% | +10% | 35% | MST shortest path |
| `overconfident` | 40% | +40% | 15% | Multiple misconceptions |

**Key Methods:**

```python
def reason_about_question(question: Dict) -> Tuple[str, ReasoningChain]:
    """
    LLM-powered chain-of-thought reasoning.
    
    Returns:
        answer: Selected answer (A/B/C/D)
        reasoning_chain: Steps, conclusion, confidence, misconceptions_used
    """

def debate(opponent_position, question, my_position) -> Tuple[DebatePosition, bool]:
    """
    Engage in one turn of peer debate.
    
    Returns:
        new_position: Updated answer and reasoning
        changed_mind: Whether belief was changed
    """

def update_knowledge(concept, correct_explanation, was_correct) -> float:
    """Update knowledge state, potentially correct misconceptions."""
```

### DebateEngine Agent

**File:** `experimentation/simulation/debate_engine.py`

```python
class DebateEngine:
    def __init__(self, max_turns: int = 3, use_judge: bool = False):
        self.max_turns = max_turns
        self.use_judge = use_judge
        self.debate_log = []
```

**Debate Flow:**

```mermaid
sequenceDiagram
    participant DE as DebateEngine
    participant A as Student A (Answer X)
    participant B as Student B (Answer Y)
    
    DE->>DE: pair_students() - match opposing answers
    
    loop Max 3 turns each
        DE->>A: Present B's argument
        A->>A: reason + decide: maintain or change?
        A-->>DE: Updated position + changed_mind flag
        
        DE->>B: Present A's argument
        B->>B: reason + decide: maintain or change?
        B-->>DE: Updated position + changed_mind flag
    end
    
    DE->>DE: competitive_consensus()
    DE-->>DE: Return DebateResult with learning metrics
```

**Debate Outcomes:**

| Outcome | Description | Impact |
|---------|-------------|--------|
| `correct_convinced_wrong` | Correct student convinced wrong student | ✅ Positive learning |
| `wrong_convinced_correct` | Wrong student convinced correct student | ❌ Negative outcome |
| `both_stayed` | No mind changes | Neutral |
| `both_changed` | Both switched (rare) | Confusion case |

### Response Analyzer Agent

**File:** `experimentation/gradio_teacher_dashboard.py`

```python
def ai_analyze_responses(question: Dict, responses: List[Dict]) -> Dict:
    """
    Analyze class responses using LLM.
    
    Calculates:
        - Correctness rate
        - Confidence distribution
        - Answer clustering
        - Misconception correlation
    
    Returns:
        recommendation: 'move_on' | 'discuss' | 'remediate'
        analysis: Detailed breakdown
    """
```

**Recommendation Thresholds:**

| Correctness Rate | Recommendation | Action |
|------------------|----------------|--------|
| ≥80% | 🟢 MOVE_ON | Proceed to next question |
| 30-80% | 🟡 PEER_DISCUSSION | Trigger DebateEngine |
| ≤30% | 🔴 REMEDIATE | Teacher explanation needed |

### SharedSession (Cross-Process State)

**File:** `experimentation/gradio_teacher_dashboard.py`

```python
class SharedSession:
    STATE_FILE = ".shared_session_state.json"
    
    session_id: str
    topic: str
    questions: List[Dict]
    student_responses: Dict[str, Dict[int, Dict]]
    teacher_decisions: Dict[int, Dict]
    is_active: bool
```

**Synchronization:** File-based JSON for cross-process communication between Teacher Dashboard and Student Experience.

---

## Agent Data Structures

### ReasoningChain

```python
@dataclass
class ReasoningChain:
    steps: List[str]           # ["Step 1...", "Step 2..."]
    conclusion: str            # Final reasoning
    confidence: float          # 0.0 - 1.0
    misconceptions_used: List[str]  # Which misconceptions influenced answer
```

### DebateResult

```python
@dataclass
class DebateResult:
    debate_id: str
    student_a_id: int
    student_b_id: int
    initial_positions: Dict[int, str]  # {student_id: answer}
    final_positions: Dict[int, str]
    turns: List[DebateTurn]
    outcome: str  # computed from positions
```

### ConsensusResult

```python
@dataclass
class ConsensusResult:
    question_id: str
    initial_correct_count: int
    final_correct_count: int
    learning_gain: float  # (final - initial) / total
    winning_arguments: List[str]
```

---

## Agent Files Reference

| File | Agent | Purpose |
|------|-------|---------|
| `simulation/reasoning_student.py` | ReasoningStudent | Individual LLM-powered student with personas |
| `simulation/debate_engine.py` | DebateEngine | Orchestrates peer debates and consensus |
| `gradio_teacher_dashboard.py` | Question Generator, Analyzer | Teacher-side AI functions |
| `enhanced_classroom_simulation.py` | Full Integration | Visual simulation with all agents |
| `ai_agents/question_designer.py` | Question Designer | LLM-powered question generation |

---

## Data Models

```python
# Core Models (SQLAlchemy)

class User(Base):
    id: int
    role: str  # "instructor" | "student"
    name: str
    email: str
    created_at: datetime

class Course(Base):
    id: int
    instructor_id: int  # FK -> User
    title: str
    metadata: JSON

class Session(Base):
    id: int
    course_id: int  # FK -> Course
    topic: str
    syllabus_json: JSON
    status: str  # "draft" | "active" | "completed"
    start_time: datetime
    end_time: datetime

class Question(Base):
    id: int
    session_id: int  # FK -> Session
    index: int
    concept: str
    difficulty: float
    type: str  # "mcq" | "short_answer"
    prompt: str
    options: JSON
    correct_answer: str
    explanation: str

class Response(Base):
    id: int
    question_id: int  # FK -> Question
    user_id: int  # FK -> User
    answer: str
    confidence: float
    rationale: str
    is_correct: bool
    created_at: datetime

class Mastery(Base):
    id: int
    user_id: int  # FK -> User
    concept: str
    score: float
    last_updated: datetime

class PulseSnapshot(Base):
    id: int
    session_id: int  # FK -> Session
    question_id: int  # FK -> Question
    correctness_rate: float
    entropy: float
    avg_confidence: float
    misconception_summary: str
    recommended_action: str  # "discuss" | "move_on" | "remediate"
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React/Next.js | SPA with SSR support |
| Backend | FastAPI | Async REST + WebSocket |
| Database | PostgreSQL | Relational data storage |
| Cache | Redis | Session state, real-time metrics |
| AI | Google Gemini API | All agent intelligence |
| Real-time | Socket.io / WebSockets | Live classroom interaction |

---

## Environment Variables

```bash
# .env
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://user:pass@localhost:5432/peerpulse
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=http://localhost:3000
```

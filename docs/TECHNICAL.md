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

---

## AI Orchestration Service

### Agents

| Agent | Input | Output |
|-------|-------|--------|
| **Session Planner** | Topic, concepts, time budget | List of question specs (concept, difficulty, type, target time) |
| **Question Designer** | Question spec | Prompt, options, correct answer, explanation with plausible distractors |
| **Pulse Analyzer** | Responses + concept | Consensus summary, misconception descriptions, adaptation recommendation |
| **Discussion Facilitator** | Question + misconception summary | 1-3 short peer-discussion prompts |
| **Exit-Ticket Agent** | Per-student weakest concepts + history | Micro-lesson + one personalized question |

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

# Adaptive Learning API Endpoints

This document describes the new adaptive learning endpoints added to enhance the Mazur/MIT peer instruction methodology.

## New Endpoints

### Dynamic Thresholds

#### `POST /adaptive/thresholds/dynamic`
Calculate context-aware discussion thresholds that adapt the classic 30-70% rule based on:
- Topic difficulty
- Time elapsed in session  
- Historical discussion success
- Class size

```json
// Request
{
  "topic_difficulty": 0.5,
  "time_elapsed_ratio": 0.3,
  "historical_discussion_success": 0.6,
  "class_size": 25
}

// Response
{
  "low_threshold": 28,
  "high_threshold": 68,
  "factors": {...}
}
```

#### `GET /adaptive/session/{session_id}/thresholds`
Get recommended thresholds for a specific session.

---

### Confidence-Correctness Analysis

#### `POST /adaptive/analyze/confidence-correctness`
Analyze the dangerous correlation between confidence and correctness.

**Key insight**: High confidence + wrong answer = MISCONCEPTION (dangerous!)

```json
// Response
{
  "categories": {
    "confident_correct": 12,
    "confident_incorrect": 5,  // ⚠️ Misconception alert!
    "uncertain_correct": 3,
    "uncertain_incorrect": 4
  },
  "misconception_rate": 20.8,
  "alert_level": "warning",
  "recommendation": "targeted_discussion",
  "message": "🟡 Some students (5) have confident misconceptions"
}
```

#### `GET /adaptive/session/{session_id}/question/{index}/confidence-analysis`
Get confidence analysis for a specific question.

---

### Smart Peer Matching

#### `POST /adaptive/peer-matching`
Get optimal peer pairs for discussion based on answers and confidence.

**Strategy**:
1. Pair confident-correct students with confident-incorrect (misconception correction)
2. Pair uncertain students together (confidence building)

```json
// Response
{
  "pairs": [
    {
      "type": "misconception_correction",
      "priority": "high",
      "mentor": "Alice",
      "learner": "Bob",
      "reason": "Alice can explain why B is incorrect",
      "discussion_prompt": "Can you explain to Bob why you chose A?"
    }
  ],
  "unpaired_students": ["Charlie"],
  "pairing_stats": {...}
}
```

#### `GET /adaptive/session/{session_id}/question/{index}/peer-pairs`
Get suggested peer pairs for a specific question.

---

### Intervention Detection

#### `POST /adaptive/intervention/check`
Detect when instructor intervention is needed during discussions.

**Triggers**:
- Confidence drop (students becoming confused)
- Time exceeded (>5 minutes)
- Circular discussion (no progress)
- Misconception cluster (40%+ on same wrong answer)

```json
// Response
{
  "intervention_needed": true,
  "severity": "high",
  "triggers": [
    {
      "type": "misconception_cluster",
      "severity": "high",
      "message": "15 students (60%) stuck on the same wrong answer (B)"
    }
  ],
  "suggestions": [
    "Provide a targeted hint about why the common wrong answer is tempting but incorrect"
  ]
}
```

---

### Discussion Quality Analysis

#### `POST /adaptive/discussion/quality`
Analyze the quality of a peer discussion.

**Evaluates**:
- Reasoning depth
- Use of concept vocabulary
- Learning signals (questions, examples, self-correction)

```json
// Response
{
  "quality_score": 0.72,
  "quality_level": "high",
  "learning_signals": {
    "asked_why": 2,
    "gave_example": 1,
    "self_corrected": 1,
    "expressed_insight": 1
  },
  "insights": [
    "🎉 Student showed self-correction - key learning moment!",
    "💡 'Aha moment' detected - understanding achieved"
  ]
}
```

---

### Spaced Repetition (SM-2 Algorithm)

#### `POST /adaptive/spaced-repetition/review`
Update spaced repetition schedule after a review.

Quality rating: 0=blackout, 5=perfect

```json
// Request
{
  "student_name": "alice",
  "concept": "recursion",
  "quality": 4,
  "question_template": {...}
}

// Response
{
  "next_review_at": "2024-01-20T10:00:00Z",
  "interval_days": 6,
  "ease_factor": 2.6,
  "repetition_count": 2
}
```

#### `GET /adaptive/spaced-repetition/{student_name}/due`
Get all items due for review for a student.

---

### Mastery Tracking

#### `POST /adaptive/mastery/update`
Update student's concept mastery after a response.

#### `POST /adaptive/misconception/track`
Track a student's misconception for future remediation.

#### `POST /adaptive/misconception/resolve`
Mark a misconception as resolved.

---

### Remediation Question Generation

#### `POST /ai/generate-remediation-question`
Generate a question specifically targeting a misconception.

```json
// Request
{
  "concept": {
    "id": "recursion",
    "name": "Recursion",
    "topics": ["base case", "recursive case"],
    "misconceptions": ["infinite loops"]
  },
  "misconception": "Students confuse recursion with iteration",
  "difficulty": 0.6
}
```

---

## Enhanced Analytics

The `/analytics/session/{id}/pulse` endpoint now includes:

```json
{
  "correctness_rate": 45.5,
  "entropy": 1.8,
  "avg_confidence": 62.3,
  "recommended_action": "peer_discuss",
  "confidence_correctness": {
    "confident_correct": 8,
    "confident_incorrect": 4,
    "uncertain_correct": 3,
    "uncertain_incorrect": 5
  },
  "misconception_alert": {
    "level": "warning",
    "message": "🟡 4 students have confident misconceptions",
    "count": 4
  }
}
```

---

## Database Models Added

- **ConceptMastery**: Tracks student mastery across sessions
- **StudentMisconception**: Tracks persistent misconceptions
- **DiscussionLog**: Records discussion quality metrics
- **SpacedRepetitionItem**: SM-2 algorithm state for review scheduling

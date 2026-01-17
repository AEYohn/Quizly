# 🧪 Experimentation & Simulation Plan

Before deploying to real classrooms, prototype and evaluate AI behavior and adaptive logic offline using Python simulations and Gradio UIs.

---

## Goals of Experimentation

| Goal | Description |
|------|-------------|
| **Validate Questions** | Ensure AI-generated questions are conceptually sound and appropriately difficult |
| **Test Adaptive Policies** | Evaluate policies on simulated classrooms with different ability distributions |
| **Match Best Practices** | Verify system decisions match clicker research heuristics |

---

## Simulation Setup

### Student Models

Simulate N students, each with:

```python
class SimulatedStudent:
    latent_mastery: dict[str, float]  # concept -> mastery score
    
    def respond(self, question: Question) -> Response:
        # P(correct) = sigmoid(mastery - difficulty) + noise
        p_correct = logistic(self.latent_mastery[question.concept] - question.difficulty)
        
        # Confidence model: higher for high-mastery
        # But allow over-confident low-mastery students
        confidence = self.latent_mastery[question.concept] + random_noise()
        
        return Response(
            answer=sample_answer(p_correct),
            confidence=clamp(confidence, 0, 1),
            rationale=generate_rationale()
        )
```

### Session Logic

```python
def adaptive_session(questions: list[Question], students: list[SimulatedStudent]):
    for question in questions:
        # Round 1: First vote
        responses_r1 = [s.respond(question) for s in students]
        metrics = compute_metrics(responses_r1)
        
        # Decision logic
        if 0.30 <= metrics.correctness <= 0.70:
            action = "discuss"
            # Trigger peer discussion
            # Round 2: Revote after discussion
            responses_r2 = [s.respond_post_discussion(question) for s in students]
        elif metrics.correctness < 0.30:
            action = "remediate"
            # Back up with simpler question
        else:
            action = "move_on"
        
        # Track learning gain
        update_mastery_estimates(students, question, responses)
```

### AI Components (in Simulation)

Use Gemini API calls for:
- Question generation from concept descriptors
- Misconception summaries given simulated rationales
- Discussion prompts and debrief explanations

---

## Gradio Interfaces

### 1. Instructor-View Sandbox

**File:** `gradio_apps/instructor_sandbox.py`

| Control | Options |
|---------|---------|
| Topic | Text input |
| Number of Students | Slider (10-100) |
| Mastery Distribution | Dropdown: Normal, Bimodal, Uniform |
| Session Length | Slider (15-60 min) |

| Visualization | Description |
|---------------|-------------|
| Response Distributions | Per-question bar charts |
| Entropy Time Series | Class "pulse" over time |
| Action Log | Suggested vs actual policy actions |

### 2. Policy Comparison Dashboard

**File:** `gradio_apps/policy_comparison.py`

| Policy | Description |
|--------|-------------|
| Basic Threshold | `<70% correct → discuss` |
| Entropy-Based | Trigger discussion when entropy exceeds threshold |
| Confidence-Weighted | Weight correctness by confidence levels |

| Chart | Metric |
|-------|--------|
| Learning Gains | Pre vs post mastery per concept |
| Time Allocation | % time per concept |
| Coverage | % students reaching target mastery |

### 3. Question Quality Inspector

**File:** `gradio_apps/question_inspector.py`

| Input | Output |
|-------|--------|
| Concept + Difficulty | AI-generated question |

| Rating Criteria | Scale |
|-----------------|-------|
| Clarity | 1-5 |
| Conceptual Depth | 1-5 |
| Distractor Quality | 1-5 |

### 4. Exit-Ticket Evaluator

**File:** `gradio_apps/exit_ticket_evaluator.py`

| Input | Output |
|-------|--------|
| Student history (simulated or real) | Personalized exit ticket |

| Evaluation | Description |
|------------|-------------|
| Weakness Targeting | Does it address actual weak concepts? |
| Difficulty Match | Appropriate for student level? |

---

## Experimental Metrics

### Per-Student Metrics

| Metric | Description |
|--------|-------------|
| **Pre/Post Mastery** | Mastery estimate per concept before and after session |
| **Coverage Rate** | Fraction of students reaching minimum mastery threshold |
| **"No One Left Behind"** | % students with at least one growth point |

### Class-Level Metrics

| Metric | Description |
|--------|-------------|
| **Normalized Gain** | `(post - pre) / (1 - pre)` — standard in TEAL research |
| **Time Allocation Efficiency** | Time spent on weak concepts vs already strong |
| **Discussion Trigger Accuracy** | % of triggers matching expert decisions |

### AI Component Quality

| Component | Rubric |
|-----------|--------|
| **Questions** | Correctness, alignment with learning goals, Bloom's taxonomy level |
| **Explanations** | Clarity, conciseness, accuracy |
| **Discussion Prompts** | Effectiveness at promoting peer dialogue |

---

## Running Experiments

```bash
# Start all Gradio apps
cd experimentation

# Individual apps
python gradio_apps/instructor_sandbox.py      # Port 7860
python gradio_apps/policy_comparison.py       # Port 7861
python gradio_apps/question_inspector.py      # Port 7862
python gradio_apps/exit_ticket_evaluator.py   # Port 7863
```

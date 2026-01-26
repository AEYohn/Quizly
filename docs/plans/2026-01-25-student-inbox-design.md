# Student Inbox Feature Design

## Overview
Teachers can send targeted practice assignments to students directly from the insights page. Students see assignments in their inbox on the Student Hub.

## Data Model

```python
class StudentAssignment(Base):
    __tablename__ = "student_assignments"

    id: UUID (primary key)
    student_name: str              # Who it's for (e.g., "jj")
    teacher_id: UUID (FK users.id) # Who sent it

    # Content
    title: str                     # "Practice: Logical Implications"
    note: Optional[str]            # Teacher's personal note
    practice_questions: JSON       # [{prompt, options, correct_answer, explanation}]

    # Source context
    source_game_id: UUID           # Which game triggered this
    source_misconceptions: JSON    # What the student got wrong

    # Status
    status: str                    # "pending", "in_progress", "completed"
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    # Results (when completed)
    score: Optional[int]
    answers: Optional[JSON]        # Student's responses
```

## API Endpoints

### Teacher-side

**POST /assignments/generate-preview**
- Input: `{ student_name, game_id, misconceptions[] }`
- Output: `{ title, suggested_questions[], source_context }`
- AI generates practice questions based on what student got wrong

**POST /assignments/send**
- Input: `{ student_name, title, note?, questions[], game_id }`
- Output: `{ assignment_id }`
- Creates assignment in student's inbox

### Student-side

**GET /assignments/inbox/{student_name}**
- Output: `{ pending[], completed[], unread_count }`
- List all assignments for this student

**GET /assignments/{id}**
- Output: `{ full assignment details with questions }`
- Get specific assignment to work on

**POST /assignments/{id}/submit**
- Input: `{ answers[] }`
- Output: `{ score, feedback }`
- Submit completed assignment

## UI Flow

### Teacher Side (Insights Page)
1. "Students Needing Support" section shows "Send Practice" button per student
2. Click opens preview modal:
   - AI-generated questions (3-5 based on mistakes)
   - Checkboxes to include/exclude questions
   - Text field for optional personal note
   - "Send to [student]" button

### Student Side (Student Hub)
1. Inbox badge in header showing unread count
2. "Your Assignments" section:
   - Pending assignments with "Start Practice" button
   - Completed assignments with score
3. Practice interface reuses existing quiz UI

## Implementation Phases

### Phase 1: Backend
1. `db_models_learning.py` - Add StudentAssignment model
2. `routes/assignment_routes.py` - Create 5 endpoints
3. `services/assignment_service.py` - AI question generation
4. Database migration for new table

### Phase 2: Teacher UI
1. Results page - Add "Send Practice" button to insights
2. `SendPracticeModal.tsx` - Preview/edit modal component

### Phase 3: Student UI
1. `student/page.tsx` - Add assignments section + badge
2. `student/assignment/[id]/page.tsx` - Practice quiz page

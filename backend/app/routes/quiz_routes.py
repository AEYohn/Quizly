"""
Quiz Management Routes
CRUD operations for quizzes and questions.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth import get_current_user
from ..db_models import User
from ..models.game import Quiz, QuizQuestion

router = APIRouter()


# ==============================================================================
# Schemas
# ==============================================================================

class QuestionCreate(BaseModel):
    question_text: str
    question_type: str = "multiple_choice"
    options: dict  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_answer: str
    explanation: Optional[str] = None
    time_limit: int = 20
    points: int = 1000
    image_url: Optional[str] = None


class QuestionResponse(BaseModel):
    id: str
    order: int
    question_text: str
    question_type: str
    options: dict
    correct_answer: str
    explanation: Optional[str]
    time_limit: int
    points: int
    image_url: Optional[str]

    class Config:
        from_attributes = True


class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    is_public: bool = False
    questions: List[QuestionCreate] = []


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    is_public: Optional[bool] = None


class QuizResponse(BaseModel):
    id: str
    teacher_id: str
    title: str
    description: Optional[str]
    subject: Optional[str]
    is_public: bool
    question_count: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class QuizDetailResponse(QuizResponse):
    questions: List[QuestionResponse]


# ==============================================================================
# Quiz CRUD
# ==============================================================================

@router.post("", response_model=QuizResponse)
async def create_quiz(
    quiz_data: QuizCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new quiz with questions."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create quizzes")
    
    # Create quiz
    quiz = Quiz(
        teacher_id=current_user.id,
        title=quiz_data.title,
        description=quiz_data.description,
        subject=quiz_data.subject,
        is_public=quiz_data.is_public
    )
    db.add(quiz)
    
    # Add questions
    for i, q in enumerate(quiz_data.questions):
        question = QuizQuestion(
            quiz=quiz,
            order=i,
            question_text=q.question_text,
            question_type=q.question_type,
            options=q.options,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            time_limit=q.time_limit,
            points=q.points,
            image_url=q.image_url
        )
        db.add(question)
    
    await db.commit()
    await db.refresh(quiz)
    
    return QuizResponse(
        id=str(quiz.id),
        teacher_id=str(quiz.teacher_id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        is_public=quiz.is_public,
        question_count=len(quiz_data.questions),
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat()
    )


@router.get("", response_model=List[QuizResponse])
async def list_quizzes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List quizzes - teachers see their own, can also see public ones."""
    # Get user's quizzes
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.teacher_id == current_user.id)
        .order_by(Quiz.updated_at.desc())
    )
    quizzes = result.scalars().all()
    
    return [
        QuizResponse(
            id=str(q.id),
            teacher_id=str(q.teacher_id),
            title=q.title,
            description=q.description,
            subject=q.subject,
            is_public=q.is_public,
            question_count=len(q.questions),
            created_at=q.created_at.isoformat(),
            updated_at=q.updated_at.isoformat()
        )
        for q in quizzes
    ]


@router.get("/public", response_model=List[QuizResponse])
async def list_public_quizzes(
    db: AsyncSession = Depends(get_db)
):
    """List all public quizzes."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.is_public == True)
        .order_by(Quiz.updated_at.desc())
        .limit(50)
    )
    quizzes = result.scalars().all()
    
    return [
        QuizResponse(
            id=str(q.id),
            teacher_id=str(q.teacher_id),
            title=q.title,
            description=q.description,
            subject=q.subject,
            is_public=q.is_public,
            question_count=len(q.questions),
            created_at=q.created_at.isoformat(),
            updated_at=q.updated_at.isoformat()
        )
        for q in quizzes
    ]


@router.get("/{quiz_id}", response_model=QuizDetailResponse)
async def get_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get quiz details with all questions."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Check access
    if quiz.teacher_id != current_user.id and not quiz.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return QuizDetailResponse(
        id=str(quiz.id),
        teacher_id=str(quiz.teacher_id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        is_public=quiz.is_public,
        question_count=len(quiz.questions),
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat(),
        questions=[
            QuestionResponse(
                id=str(q.id),
                order=q.order,
                question_text=q.question_text,
                question_type=q.question_type,
                options=q.options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                time_limit=q.time_limit,
                points=q.points,
                image_url=q.image_url
            )
            for q in sorted(quiz.questions, key=lambda x: x.order)
        ]
    )


@router.put("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: UUID,
    quiz_data: QuizUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update quiz metadata."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can update it")
    
    # Update fields
    if quiz_data.title is not None:
        quiz.title = quiz_data.title
    if quiz_data.description is not None:
        quiz.description = quiz_data.description
    if quiz_data.subject is not None:
        quiz.subject = quiz_data.subject
    if quiz_data.is_public is not None:
        quiz.is_public = quiz_data.is_public
    
    await db.commit()
    await db.refresh(quiz)
    
    return QuizResponse(
        id=str(quiz.id),
        teacher_id=str(quiz.teacher_id),
        title=quiz.title,
        description=quiz.description,
        subject=quiz.subject,
        is_public=quiz.is_public,
        question_count=len(quiz.questions),
        created_at=quiz.created_at.isoformat(),
        updated_at=quiz.updated_at.isoformat()
    )


@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a quiz."""
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can delete it")
    
    await db.delete(quiz)
    await db.commit()
    
    return {"message": "Quiz deleted"}


# ==============================================================================
# Question Management
# ==============================================================================

@router.post("/{quiz_id}/questions", response_model=QuestionResponse)
async def add_question(
    quiz_id: UUID,
    question_data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a question to a quiz."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can add questions")
    
    # Get next order
    next_order = len(quiz.questions)
    
    question = QuizQuestion(
        quiz_id=quiz_id,
        order=next_order,
        question_text=question_data.question_text,
        question_type=question_data.question_type,
        options=question_data.options,
        correct_answer=question_data.correct_answer,
        explanation=question_data.explanation,
        time_limit=question_data.time_limit,
        points=question_data.points,
        image_url=question_data.image_url
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    
    return QuestionResponse(
        id=str(question.id),
        order=question.order,
        question_text=question.question_text,
        question_type=question.question_type,
        options=question.options,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
        time_limit=question.time_limit,
        points=question.points,
        image_url=question.image_url
    )


@router.put("/{quiz_id}/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    quiz_id: UUID,
    question_id: UUID,
    question_data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a question."""
    # Verify quiz ownership
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can update questions")
    
    # Get question
    result = await db.execute(
        select(QuizQuestion).where(
            QuizQuestion.id == question_id,
            QuizQuestion.quiz_id == quiz_id
        )
    )
    question = result.scalars().first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Update
    question.question_text = question_data.question_text
    question.question_type = question_data.question_type
    question.options = question_data.options
    question.correct_answer = question_data.correct_answer
    question.explanation = question_data.explanation
    question.time_limit = question_data.time_limit
    question.points = question_data.points
    question.image_url = question_data.image_url
    
    await db.commit()
    await db.refresh(question)
    
    return QuestionResponse(
        id=str(question.id),
        order=question.order,
        question_text=question.question_text,
        question_type=question.question_type,
        options=question.options,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
        time_limit=question.time_limit,
        points=question.points,
        image_url=question.image_url
    )


@router.delete("/{quiz_id}/questions/{question_id}")
async def delete_question(
    quiz_id: UUID,
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a question from a quiz."""
    # Verify quiz ownership
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the quiz owner can delete questions")
    
    # Get question
    result = await db.execute(
        select(QuizQuestion).where(
            QuizQuestion.id == question_id,
            QuizQuestion.quiz_id == quiz_id
        )
    )
    question = result.scalars().first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    await db.delete(question)
    await db.commit()
    
    return {"message": "Question deleted"}


# ==============================================================================
# Export Functions
# ==============================================================================

def generate_quiz_markdown(quiz: Quiz, include_answers: bool = True) -> str:
    """Generate a markdown study guide from a quiz."""
    lines = [
        f"# {quiz.title}",
        "",
    ]
    
    if quiz.description:
        lines.extend([quiz.description, ""])
    
    if quiz.subject:
        lines.extend([f"**Subject:** {quiz.subject}", ""])
    
    lines.extend([
        f"**Total Questions:** {len(quiz.questions)}",
        f"**Created:** {quiz.created_at.strftime('%Y-%m-%d')}",
        "",
        "---",
        ""
    ])
    
    questions = sorted(quiz.questions, key=lambda q: q.order)
    
    for i, q in enumerate(questions, 1):
        lines.extend([
            f"## Question {i}",
            "",
            q.question_text,
            ""
        ])
        
        # Options
        if q.options:
            lines.append("**Options:**")
            for key in sorted(q.options.keys()):
                lines.append(f"- **{key})** {q.options[key]}")
            lines.append("")
        
        if include_answers:
            lines.extend([
                f"**Correct Answer:** {q.correct_answer}",
                ""
            ])
            if q.explanation:
                lines.extend([
                    "**Explanation:**",
                    f"> {q.explanation}",
                    ""
                ])
        
        lines.extend(["---", ""])
    
    return "\n".join(lines)


def generate_quiz_json_export(quiz: Quiz, include_answers: bool = True) -> dict:
    """Generate JSON export of a quiz."""
    questions = sorted(quiz.questions, key=lambda q: q.order)
    
    export_data = {
        "title": quiz.title,
        "description": quiz.description,
        "subject": quiz.subject,
        "created_at": quiz.created_at.isoformat(),
        "question_count": len(questions),
        "questions": []
    }
    
    for i, q in enumerate(questions, 1):
        q_data = {
            "number": i,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "time_limit": q.time_limit,
            "points": q.points,
        }
        if include_answers:
            q_data["correct_answer"] = q.correct_answer
            q_data["explanation"] = q.explanation
        export_data["questions"].append(q_data)
    
    return export_data


@router.get("/{quiz_id}/export")
async def export_quiz(
    quiz_id: UUID,
    format: str = Query("md", description="Export format: md (markdown), json, or study (student-friendly, no answers)"),
    include_answers: bool = Query(True, description="Include correct answers and explanations"),
    db: AsyncSession = Depends(get_db)
):
    """
    Export a quiz in various formats.
    
    **Formats:**
    - `md` - Markdown study guide (default)
    - `json` - JSON data for reimporting or processing
    - `study` - Student study guide (markdown, no answers shown during first pass)
    
    **Query Parameters:**
    - `include_answers` - Include answers and explanations (default: true, set false for blank quiz)
    
    No authentication required for public quizzes.
    """
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if format == "study":
        # Student study mode: questions only, answers at the end
        content = generate_study_guide(quiz)
        return PlainTextResponse(
            content=content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="{quiz.title}_study_guide.md"'
            }
        )
    elif format == "json":
        export_data = generate_quiz_json_export(quiz, include_answers)
        return JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f'attachment; filename="{quiz.title}_export.json"'
            }
        )
    else:  # md (default)
        content = generate_quiz_markdown(quiz, include_answers)
        return PlainTextResponse(
            content=content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="{quiz.title}.md"'
            }
        )


def generate_study_guide(quiz: Quiz) -> str:
    """
    Generate a student-friendly study guide.
    Questions first, answers section at the end.
    """
    lines = [
        f"# 📚 Study Guide: {quiz.title}",
        "",
    ]
    
    if quiz.description:
        lines.extend([f"*{quiz.description}*", ""])
    
    if quiz.subject:
        lines.extend([f"**Subject:** {quiz.subject}", ""])
    
    questions = sorted(quiz.questions, key=lambda q: q.order)
    
    lines.extend([
        f"**Total Questions:** {len(questions)}",
        "",
        "---",
        "",
        "# Part 1: Questions",
        "",
        "*Try to answer these questions before checking the answer key below!*",
        ""
    ])
    
    # Questions section (no answers)
    for i, q in enumerate(questions, 1):
        lines.extend([
            f"### Question {i}",
            "",
            q.question_text,
            ""
        ])
        
        if q.options:
            for key in sorted(q.options.keys()):
                lines.append(f"- [ ] **{key})** {q.options[key]}")
            lines.append("")
        
        lines.append("")
    
    # Answer key section
    lines.extend([
        "---",
        "",
        "# Part 2: Answer Key",
        "",
        "*Scroll down only after attempting all questions!*",
        "",
        "<br><br><br><br><br>",  # Space to prevent accidental spoilers
        ""
    ])
    
    for i, q in enumerate(questions, 1):
        lines.extend([
            f"### Question {i} - Answer",
            "",
            f"**Correct Answer:** {q.correct_answer}",
            ""
        ])
        
        if q.options and q.correct_answer in q.options:
            lines.append(f"**{q.correct_answer})** {q.options[q.correct_answer]}")
            lines.append("")
        
        if q.explanation:
            lines.extend([
                "**Explanation:**",
                f"> {q.explanation}",
                ""
            ])
        
        lines.append("")
    
    lines.extend([
        "---",
        "",
        f"*Generated by Quizly on {datetime.utcnow().strftime('%Y-%m-%d')}*"
    ])
    
    return "\n".join(lines)

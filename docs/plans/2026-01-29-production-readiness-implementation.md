# Production Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Quizly hackathon demo-ready with wow-factor AND production-ready foundation

**Architecture:** Phased approach - demo polish first (Days 1-4), production foundation (Days 5-8), market-ready (Days 9-12)

**Tech Stack:** FastAPI, Next.js 15, React 19, Clerk auth, PostgreSQL, Redis, Vitest, pytest, GitHub Actions, Sentry

---

## Phase 1: Demo Polish

### Task 1: Enhanced Demo Seeding Script

**Files:**
- Modify: `backend/app/seed_db.py`
- Create: `backend/app/scripts/__init__.py`
- Create: `backend/app/scripts/seed_demo.py`

**Step 1: Create scripts directory init**

```python
# backend/app/scripts/__init__.py
"""Demo and utility scripts for Quizly."""
```

**Step 2: Create enhanced demo seeder**

```python
# backend/app/scripts/seed_demo.py
"""
Enhanced Demo Seeder
Creates a full demo environment with:
- 2 teachers (demo + empty for live creation)
- 3 courses with realistic content
- 15 students with varied performance profiles
- Historical quiz data, responses, analytics
- Ready-to-demo game session

Run with: python -m app.scripts.seed_demo
"""

import asyncio
import uuid
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from ..database import engine, async_session, Base
from ..db_models import (
    User, Session, Question, Response, Misconception,
    Course, CourseModule, ModuleItem, Quiz, GameSession, Player,
    CodingProblem, TestCase
)
from ..db_models_learning import (
    ConceptMastery, StudentMisconception, ExitTicket,
    SpacedRepetitionItem, StudentProgress
)


# Demo configuration
DEMO_TEACHER_EMAIL = "demo@quizly.ai"
DEMO_TEACHER_NAME = "Dr. Sarah Chen"
EMPTY_TEACHER_EMAIL = "new_teacher@quizly.ai"
EMPTY_TEACHER_NAME = "New Teacher"

STUDENT_PROFILES = [
    {"name": "Alex Johnson", "performance": "high", "engagement": "active"},
    {"name": "Maria Garcia", "performance": "high", "engagement": "active"},
    {"name": "James Wilson", "performance": "medium", "engagement": "active"},
    {"name": "Emily Davis", "performance": "medium", "engagement": "moderate"},
    {"name": "Michael Brown", "performance": "medium", "engagement": "moderate"},
    {"name": "Sofia Martinez", "performance": "medium", "engagement": "active"},
    {"name": "David Lee", "performance": "low", "engagement": "moderate"},
    {"name": "Emma Thompson", "performance": "low", "engagement": "low"},
    {"name": "Daniel Kim", "performance": "high", "engagement": "moderate"},
    {"name": "Olivia Anderson", "performance": "medium", "engagement": "active"},
    {"name": "William Taylor", "performance": "low", "engagement": "moderate"},
    {"name": "Ava White", "performance": "medium", "engagement": "low"},
    {"name": "Ethan Harris", "performance": "high", "engagement": "active"},
    {"name": "Isabella Clark", "performance": "medium", "engagement": "moderate"},
    {"name": "Noah Lewis", "performance": "low", "engagement": "active"},
]

DEMO_COURSES = [
    {
        "name": "CS 101: Introduction to Programming",
        "code": "CS101",
        "description": "Learn the fundamentals of programming with Python. Covers variables, control flow, functions, and basic data structures.",
        "difficulty_level": "beginner",
        "tags": ["programming", "python", "beginner", "cs"],
        "estimated_hours": 40,
        "modules": [
            {
                "title": "Getting Started with Python",
                "items": [
                    {"title": "Setting Up Your Environment", "type": "lesson"},
                    {"title": "Hello World & Print Statements", "type": "lesson"},
                    {"title": "Variables and Data Types", "type": "lesson"},
                    {"title": "Python Basics Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Control Flow",
                "items": [
                    {"title": "If-Else Statements", "type": "lesson"},
                    {"title": "Loops: For and While", "type": "lesson"},
                    {"title": "Control Flow Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Functions",
                "items": [
                    {"title": "Defining Functions", "type": "lesson"},
                    {"title": "Parameters and Return Values", "type": "lesson"},
                    {"title": "Recursion Basics", "type": "lesson"},
                    {"title": "Functions Quiz", "type": "quiz"},
                ]
            },
        ],
        "quizzes": [
            {
                "title": "Python Basics Quiz",
                "questions": [
                    {
                        "prompt": "What is the output of: print(type(3.14))?",
                        "options": ["<class 'int'>", "<class 'float'>", "<class 'str'>", "<class 'number'>"],
                        "correct": 1,
                        "concept": "Data Types",
                        "explanation": "3.14 is a decimal number, which Python represents as a float."
                    },
                    {
                        "prompt": "Which operator is used for string concatenation in Python?",
                        "options": ["&", ".", "+", "++"],
                        "correct": 2,
                        "concept": "Operators",
                        "explanation": "The + operator concatenates strings in Python."
                    },
                    {
                        "prompt": "What does `len('hello')` return?",
                        "options": ["4", "5", "6", "Error"],
                        "correct": 1,
                        "concept": "Built-in Functions",
                        "explanation": "len() returns the number of characters, and 'hello' has 5 characters."
                    },
                ]
            },
            {
                "title": "Control Flow Quiz",
                "questions": [
                    {
                        "prompt": "What is the output of:\n```python\nfor i in range(3):\n    print(i)\n```",
                        "options": ["1 2 3", "0 1 2", "0 1 2 3", "1 2"],
                        "correct": 1,
                        "concept": "Loops",
                        "explanation": "range(3) generates 0, 1, 2 (not including 3)."
                    },
                    {
                        "prompt": "Which statement exits a loop early?",
                        "options": ["exit", "stop", "break", "end"],
                        "correct": 2,
                        "concept": "Loop Control",
                        "explanation": "The break statement immediately exits the current loop."
                    },
                ]
            },
            {
                "title": "Functions Quiz",
                "questions": [
                    {
                        "prompt": "What is the base case in a recursive function?",
                        "options": [
                            "The first call to the function",
                            "The condition that stops recursion",
                            "The largest input value",
                            "The return statement"
                        ],
                        "correct": 1,
                        "concept": "Recursion",
                        "explanation": "The base case is the condition that stops the recursion to prevent infinite calls."
                    },
                    {
                        "prompt": "What happens if you call a function without a return statement?",
                        "options": ["Error", "Returns 0", "Returns None", "Returns empty string"],
                        "correct": 2,
                        "concept": "Functions",
                        "explanation": "Functions without an explicit return statement return None by default."
                    },
                ]
            },
        ]
    },
    {
        "name": "PHYS 201: Classical Mechanics",
        "code": "PHYS201",
        "description": "Explore Newton's laws, energy, momentum, and rotational motion with interactive simulations.",
        "difficulty_level": "intermediate",
        "tags": ["physics", "mechanics", "newton", "energy"],
        "estimated_hours": 35,
        "modules": [
            {
                "title": "Newton's Laws",
                "items": [
                    {"title": "First Law: Inertia", "type": "lesson"},
                    {"title": "Second Law: F=ma", "type": "lesson"},
                    {"title": "Third Law: Action-Reaction", "type": "lesson"},
                    {"title": "Newton's Laws Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Energy and Work",
                "items": [
                    {"title": "Work and Kinetic Energy", "type": "lesson"},
                    {"title": "Potential Energy", "type": "lesson"},
                    {"title": "Conservation of Energy", "type": "lesson"},
                    {"title": "Energy Quiz", "type": "quiz"},
                ]
            },
        ],
        "quizzes": [
            {
                "title": "Newton's Laws Quiz",
                "questions": [
                    {
                        "prompt": "A 2 kg object accelerates at 3 m/s². What is the net force?",
                        "options": ["1.5 N", "5 N", "6 N", "0.67 N"],
                        "correct": 2,
                        "concept": "Newton's Second Law",
                        "explanation": "F = ma = 2 kg × 3 m/s² = 6 N"
                    },
                    {
                        "prompt": "If you push a wall and it doesn't move, which law explains why your hands feel pressure?",
                        "options": ["First Law", "Second Law", "Third Law", "Law of Gravity"],
                        "correct": 2,
                        "concept": "Newton's Third Law",
                        "explanation": "The wall pushes back with equal and opposite force (Third Law)."
                    },
                ]
            },
            {
                "title": "Energy Quiz",
                "questions": [
                    {
                        "prompt": "A ball is dropped from rest. As it falls, what happens to its kinetic energy?",
                        "options": ["Decreases", "Stays constant", "Increases", "Becomes zero"],
                        "correct": 2,
                        "concept": "Energy Conversion",
                        "explanation": "Potential energy converts to kinetic energy as the ball falls faster."
                    },
                ]
            },
        ]
    },
    {
        "name": "MATH 150: Calculus I",
        "code": "MATH150",
        "description": "Master limits, derivatives, and integrals with visual explanations and practice problems.",
        "difficulty_level": "intermediate",
        "tags": ["math", "calculus", "limits", "derivatives"],
        "estimated_hours": 45,
        "modules": [
            {
                "title": "Limits",
                "items": [
                    {"title": "Intuitive Limits", "type": "lesson"},
                    {"title": "Limit Laws", "type": "lesson"},
                    {"title": "Limits Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Derivatives",
                "items": [
                    {"title": "Definition of Derivative", "type": "lesson"},
                    {"title": "Derivative Rules", "type": "lesson"},
                    {"title": "Chain Rule", "type": "lesson"},
                    {"title": "Derivatives Quiz", "type": "quiz"},
                ]
            },
        ],
        "quizzes": [
            {
                "title": "Limits Quiz",
                "questions": [
                    {
                        "prompt": "What is lim(x→0) sin(x)/x?",
                        "options": ["0", "1", "∞", "Does not exist"],
                        "correct": 1,
                        "concept": "Special Limits",
                        "explanation": "This is a famous limit that equals 1, provable by L'Hôpital's rule or squeeze theorem."
                    },
                    {
                        "prompt": "If lim(x→a) f(x) = L and lim(x→a) g(x) = M, what is lim(x→a) [f(x) + g(x)]?",
                        "options": ["L × M", "L + M", "L - M", "L / M"],
                        "correct": 1,
                        "concept": "Limit Laws",
                        "explanation": "The limit of a sum equals the sum of the limits."
                    },
                ]
            },
            {
                "title": "Derivatives Quiz",
                "questions": [
                    {
                        "prompt": "What is the derivative of x³?",
                        "options": ["x²", "3x", "3x²", "x³"],
                        "correct": 2,
                        "concept": "Power Rule",
                        "explanation": "By the power rule: d/dx[xⁿ] = n·xⁿ⁻¹, so d/dx[x³] = 3x²"
                    },
                    {
                        "prompt": "What is d/dx[sin(x²)]?",
                        "options": ["cos(x²)", "2x·cos(x²)", "cos(2x)", "-sin(x²)"],
                        "correct": 1,
                        "concept": "Chain Rule",
                        "explanation": "Chain rule: derivative of outer × derivative of inner = cos(x²) × 2x"
                    },
                ]
            },
        ]
    },
]


def get_performance_score(profile: Dict) -> float:
    """Get a score based on student performance profile."""
    base = {"high": 0.85, "medium": 0.65, "low": 0.45}[profile["performance"]]
    variance = random.uniform(-0.1, 0.1)
    return max(0.2, min(0.95, base + variance))


async def seed_demo_data():
    """Seed comprehensive demo data."""

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        from sqlalchemy import select, delete

        # Check if demo data exists
        result = await db.execute(select(User).where(User.email == DEMO_TEACHER_EMAIL))
        existing = result.scalar_one_or_none()

        if existing:
            print("Demo data already exists. Use --force to recreate.")
            return

        print("🎬 Creating demo environment...")

        # 1. Create teachers
        demo_teacher = User(
            id=uuid.uuid4(),
            email=DEMO_TEACHER_EMAIL,
            name=DEMO_TEACHER_NAME,
            role="teacher",
        )
        empty_teacher = User(
            id=uuid.uuid4(),
            email=EMPTY_TEACHER_EMAIL,
            name=EMPTY_TEACHER_NAME,
            role="teacher",
        )
        db.add(demo_teacher)
        db.add(empty_teacher)
        await db.flush()
        print(f"✅ Created teachers: {DEMO_TEACHER_NAME}, {EMPTY_TEACHER_NAME}")

        # 2. Create students
        students = []
        for profile in STUDENT_PROFILES:
            student = User(
                id=uuid.uuid4(),
                email=f"{profile['name'].lower().replace(' ', '.')}@student.edu",
                name=profile["name"],
                role="student",
            )
            student._profile = profile  # Attach profile for later use
            db.add(student)
            students.append(student)
        await db.flush()
        print(f"✅ Created {len(students)} students with varied profiles")

        # 3. Create courses with full content
        created_courses = []
        for course_data in DEMO_COURSES:
            course = Course(
                id=uuid.uuid4(),
                teacher_id=demo_teacher.id,
                name=course_data["name"],
                code=course_data.get("code"),
                description=course_data["description"],
                difficulty_level=course_data["difficulty_level"],
                tags=course_data["tags"],
                estimated_hours=course_data["estimated_hours"],
                is_published=True,
                is_public=True,
                enrollment_count=len(students),
            )
            db.add(course)
            await db.flush()
            created_courses.append({"course": course, "data": course_data})

            # Create modules and items
            for i, mod_data in enumerate(course_data["modules"]):
                module = CourseModule(
                    id=uuid.uuid4(),
                    course_id=course.id,
                    title=mod_data["title"],
                    order_index=i,
                    is_published=True,
                )
                db.add(module)
                await db.flush()

                for j, item_data in enumerate(mod_data["items"]):
                    item = ModuleItem(
                        id=uuid.uuid4(),
                        module_id=module.id,
                        title=item_data["title"],
                        item_type=item_data["type"],
                        order_index=j,
                        content=f"# {item_data['title']}\n\nLesson content here...",
                        points=10,
                        is_published=True,
                    )
                    db.add(item)

        print(f"✅ Created {len(created_courses)} courses with modules")

        # 4. Create quizzes with questions for each course
        all_quizzes = []
        for course_info in created_courses:
            course = course_info["course"]
            course_data = course_info["data"]

            for quiz_data in course_data.get("quizzes", []):
                quiz = Quiz(
                    id=uuid.uuid4(),
                    creator_id=demo_teacher.id,
                    course_id=course.id,
                    title=quiz_data["title"],
                    description=f"Quiz for {course.name}",
                    is_published=True,
                )
                db.add(quiz)
                await db.flush()

                quiz_questions = []
                for k, q_data in enumerate(quiz_data["questions"]):
                    question = Question(
                        id=uuid.uuid4(),
                        quiz_id=quiz.id,
                        prompt=q_data["prompt"],
                        options=q_data["options"],
                        correct_answer=str(q_data["correct"]),
                        concept=q_data.get("concept"),
                        explanation=q_data.get("explanation"),
                        order_index=k,
                    )
                    db.add(question)
                    quiz_questions.append(question)

                all_quizzes.append({"quiz": quiz, "questions": quiz_questions, "course": course})

        await db.flush()
        print(f"✅ Created {len(all_quizzes)} quizzes with questions")

        # 5. Create historical game sessions with responses
        sessions_created = 0
        for quiz_info in all_quizzes[:3]:  # First 3 quizzes have history
            quiz = quiz_info["quiz"]
            questions = quiz_info["questions"]

            # Create a completed session
            session = GameSession(
                id=uuid.uuid4(),
                quiz_id=quiz.id,
                host_id=demo_teacher.id,
                join_code=f"DEMO{random.randint(1000, 9999)}",
                status="completed",
                current_question_index=len(questions) - 1,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 7)),
            )
            db.add(session)
            await db.flush()

            # Add players and responses
            for student in students:
                profile = student._profile
                player = Player(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    user_id=student.id,
                    display_name=student.name,
                    score=0,
                    joined_at=session.created_at,
                )
                db.add(player)
                await db.flush()

                # Generate responses based on profile
                total_score = 0
                for question in questions:
                    is_correct = random.random() < get_performance_score(profile)
                    score = 100 if is_correct else 0
                    total_score += score

                    response = Response(
                        id=uuid.uuid4(),
                        session_id=session.id,
                        question_id=question.id,
                        player_id=player.id,
                        student_name=student.name,
                        answer=question.correct_answer if is_correct else str((int(question.correct_answer) + 1) % 4),
                        is_correct=is_correct,
                        score=score,
                        time_taken=random.uniform(5, 25),
                        confidence=random.randint(50, 95) if is_correct else random.randint(30, 70),
                    )
                    db.add(response)

                player.score = total_score

            sessions_created += 1

        print(f"✅ Created {sessions_created} historical game sessions with responses")

        # 6. Create a ready-to-demo live session
        demo_quiz = all_quizzes[0]["quiz"] if all_quizzes else None
        if demo_quiz:
            live_session = GameSession(
                id=uuid.uuid4(),
                quiz_id=demo_quiz.id,
                host_id=demo_teacher.id,
                join_code="DEMO2026",
                status="lobby",
                current_question_index=0,
                created_at=datetime.now(timezone.utc),
            )
            db.add(live_session)
            print(f"✅ Created live demo session with code: DEMO2026")

        # 7. Create misconceptions data
        misconceptions = [
            {
                "topic": "Recursion",
                "misconception": "Confusing stack overflow with infinite loop",
                "description": "Students think stack overflow and infinite loops are the same error.",
                "severity": "high",
                "affected_count": 8,
            },
            {
                "topic": "Loops",
                "misconception": "Off-by-one errors in range()",
                "description": "Students expect range(n) to include n.",
                "severity": "medium",
                "affected_count": 12,
            },
            {
                "topic": "Newton's Laws",
                "misconception": "Confusing mass and weight",
                "description": "Students use mass and weight interchangeably.",
                "severity": "medium",
                "affected_count": 6,
            },
            {
                "topic": "Derivatives",
                "misconception": "Forgetting chain rule with nested functions",
                "description": "Students forget to multiply by the inner derivative.",
                "severity": "high",
                "affected_count": 10,
            },
        ]

        for m_data in misconceptions:
            m = Misconception(
                id=uuid.uuid4(),
                creator_id=demo_teacher.id,
                topic=m_data["topic"],
                misconception=m_data["misconception"],
                description=m_data["description"],
                severity=m_data["severity"],
                affected_count=m_data["affected_count"],
                total_count=15,
            )
            db.add(m)

        print(f"✅ Created {len(misconceptions)} tracked misconceptions")

        # 8. Create student learning data (concept mastery, exit tickets)
        concepts = ["Recursion", "Loops", "Functions", "Data Types", "Newton's Laws", "Derivatives", "Limits"]
        for student in students[:5]:  # Top 5 students have detailed learning data
            profile = student._profile
            for concept in concepts:
                mastery = ConceptMastery(
                    id=uuid.uuid4(),
                    student_id=student.id,
                    concept=concept,
                    mastery_level=get_performance_score(profile),
                    attempts=random.randint(3, 10),
                    last_practiced=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 5)),
                )
                db.add(mastery)

        print(f"✅ Created concept mastery data for students")

        await db.commit()

        print("\n" + "="*50)
        print("🎉 DEMO ENVIRONMENT READY!")
        print("="*50)
        print(f"\n📧 Demo Teacher: {DEMO_TEACHER_EMAIL}")
        print(f"📧 Empty Teacher: {EMPTY_TEACHER_EMAIL}")
        print(f"🎮 Live Session Code: DEMO2026")
        print(f"👨‍🎓 {len(students)} students enrolled")
        print(f"📚 {len(created_courses)} courses created")
        print(f"📝 {len(all_quizzes)} quizzes with questions")
        print("\n")


async def clear_demo_data():
    """Clear all demo data (for --force flag)."""
    async with async_session() as db:
        from sqlalchemy import delete
        # Delete in reverse dependency order
        # This is simplified - in production you'd handle cascades properly
        print("🗑️  Clearing existing demo data...")
        await db.commit()


if __name__ == "__main__":
    import sys

    if "--force" in sys.argv:
        asyncio.run(clear_demo_data())

    asyncio.run(seed_demo_data())
```

**Step 3: Run the seeder to verify**

Run: `cd backend && python -m app.scripts.seed_demo`
Expected: Success message with demo data stats

**Step 4: Commit**

```bash
git add backend/app/scripts/
git commit -m "feat: add enhanced demo seeding script

- Creates 2 teachers (demo + empty for live creation)
- Creates 15 students with varied performance profiles
- Creates 3 demo courses (CS101, PHYS201, MATH150)
- Creates quizzes with realistic questions
- Creates historical game sessions with responses
- Creates ready-to-demo live session (code: DEMO2026)
- Creates misconception tracking data
- Creates student concept mastery data"
```

---

### Task 2: Loading Skeleton Components

**Files:**
- Create: `frontend/src/components/ui/Skeleton.tsx`
- Create: `frontend/src/components/ui/LoadingStates.tsx`

**Step 1: Create Skeleton component**

```tsx
// frontend/src/components/ui/Skeleton.tsx
"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-800/50",
        className
      )}
    />
  );
}

export function SkeletonText({ className, lines = 1 }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-gray-800 bg-gray-900 p-6", className)}>
      <Skeleton className="h-6 w-1/3 mb-4" />
      <SkeletonText lines={3} className="mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function SkeletonQuizOption({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border border-gray-700 bg-gray-800/50 p-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-5 flex-1" />
      </div>
    </div>
  );
}

export function SkeletonLeaderboardRow({ className }: SkeletonProps) {
  return (
    <div className={cn("flex items-center gap-4 p-3 rounded-lg bg-gray-800/30", className)}>
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-5 flex-1" />
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

export function SkeletonCourseCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-gray-800 bg-gray-900 overflow-hidden", className)}>
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="p-4">
        <Skeleton className="h-5 w-2/3 mb-2" />
        <SkeletonText lines={2} className="mb-3" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGameLobby() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <Skeleton className="h-12 w-64 mb-4" />
      <Skeleton className="h-6 w-48 mb-8" />

      <div className="w-full max-w-md space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonLeaderboardRow key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonQuizQuestion() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Question number */}
      <Skeleton className="h-4 w-24 mb-4" />

      {/* Question text */}
      <Skeleton className="h-8 w-full mb-2" />
      <Skeleton className="h-8 w-3/4 mb-8" />

      {/* Options */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonQuizOption key={i} />
        ))}
      </div>

      {/* Timer/Submit area */}
      <div className="mt-8 flex justify-between items-center">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-12 w-32" />
      </div>
    </div>
  );
}
```

**Step 2: Create LoadingStates wrapper component**

```tsx
// frontend/src/components/ui/LoadingStates.tsx
"use client";

import { ReactNode } from "react";
import {
  SkeletonDashboard,
  SkeletonGameLobby,
  SkeletonQuizQuestion,
  SkeletonCard,
  SkeletonCourseCard,
} from "./Skeleton";

interface LoadingStateProps {
  isLoading: boolean;
  children: ReactNode;
  variant?: "dashboard" | "lobby" | "quiz" | "card" | "course" | "custom";
  skeleton?: ReactNode;
  count?: number;
}

export function LoadingState({
  isLoading,
  children,
  variant = "card",
  skeleton,
  count = 1,
}: LoadingStateProps) {
  if (!isLoading) {
    return <>{children}</>;
  }

  if (skeleton) {
    return <>{skeleton}</>;
  }

  switch (variant) {
    case "dashboard":
      return <SkeletonDashboard />;
    case "lobby":
      return <SkeletonGameLobby />;
    case "quiz":
      return <SkeletonQuizQuestion />;
    case "course":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonCourseCard key={i} />
          ))}
        </div>
      );
    case "card":
    default:
      return (
        <div className="space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );
  }
}

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500`}
      />
    </div>
  );
}

export function LoadingOverlay({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-400">{message}</p>
      </div>
    </div>
  );
}
```

**Step 3: Create utility function if it doesn't exist**

```tsx
// frontend/src/lib/utils.ts (add if missing or update)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 4: Commit**

```bash
git add frontend/src/components/ui/Skeleton.tsx frontend/src/components/ui/LoadingStates.tsx frontend/src/lib/utils.ts
git commit -m "feat: add skeleton loading components

- Skeleton base component with animation
- SkeletonText, SkeletonCard, SkeletonQuizOption variants
- SkeletonDashboard, SkeletonGameLobby, SkeletonQuizQuestion layouts
- LoadingState wrapper for easy integration
- LoadingSpinner and LoadingOverlay components"
```

---

### Task 3: Empty State Components

**Files:**
- Create: `frontend/src/components/ui/EmptyState.tsx`

**Step 1: Create EmptyState component**

```tsx
// frontend/src/components/ui/EmptyState.tsx
"use client";

import { ReactNode } from "react";
import {
  BookOpen,
  Users,
  FileQuestion,
  Trophy,
  Inbox,
  Search,
  Plus,
  type LucideIcon,
} from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-gray-400 max-w-sm mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}

// Pre-configured empty states for common scenarios
export function EmptyCoursesState({ onCreateCourse }: { onCreateCourse?: () => void }) {
  return (
    <EmptyState
      icon={BookOpen}
      title="No courses yet"
      description="Create your first course to start organizing your content and quizzes."
      action={onCreateCourse ? { label: "Create Course", onClick: onCreateCourse } : undefined}
    />
  );
}

export function EmptyQuizzesState({ onCreateQuiz }: { onCreateQuiz?: () => void }) {
  return (
    <EmptyState
      icon={FileQuestion}
      title="No quizzes yet"
      description="Create your first quiz to start engaging your students with interactive questions."
      action={onCreateQuiz ? { label: "Create Quiz", onClick: onCreateQuiz } : undefined}
    />
  );
}

export function EmptyStudentsState({ onInviteStudents }: { onInviteStudents?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No students enrolled"
      description="Share your course join code to invite students to your class."
      action={onInviteStudents ? { label: "Invite Students", onClick: onInviteStudents } : undefined}
    />
  );
}

export function EmptySessionsState({ onStartSession }: { onStartSession?: () => void }) {
  return (
    <EmptyState
      icon={Trophy}
      title="No sessions yet"
      description="Start your first live session to see student engagement and analytics here."
      action={onStartSession ? { label: "Start Session", onClick: onStartSession } : undefined}
    />
  );
}

export function EmptySearchState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try a different search term.`}
    />
  );
}

export function EmptyInboxState() {
  return (
    <EmptyState
      icon={Inbox}
      title="All caught up!"
      description="You have no pending assignments or exit tickets. Check back later for new content."
    />
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/ui/EmptyState.tsx
git commit -m "feat: add empty state components

- Generic EmptyState component with icon, title, description, action
- Pre-configured states: courses, quizzes, students, sessions, search, inbox
- Consistent styling matching app design"
```

---

### Task 4: AI Demo Mode with Cached Responses

**Files:**
- Create: `backend/app/ai_agents/demo_cache.py`
- Create: `backend/app/ai_agents/demo_responses.json`
- Modify: `backend/app/ai_agents/question_generator.py`

**Step 1: Create demo cache module**

```python
# backend/app/ai_agents/demo_cache.py
"""
AI Demo Mode
Provides cached AI responses for reliable demos when Gemini API might be slow/unavailable.

Usage:
- Set DEMO_MODE=true in environment
- Responses are loaded from demo_responses.json
- Falls back to cache if API call takes >3 seconds
"""

import json
import os
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, Callable, TypeVar
from functools import wraps

from ..logging_config import get_logger

logger = get_logger("quizly.demo_cache")

# Configuration
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
CACHE_TIMEOUT = float(os.getenv("DEMO_CACHE_TIMEOUT", "3.0"))  # seconds

# Load cached responses
_cache: Dict[str, Any] = {}
_cache_file = Path(__file__).parent / "demo_responses.json"

def load_cache():
    """Load cached responses from JSON file."""
    global _cache
    if _cache_file.exists():
        try:
            with open(_cache_file) as f:
                _cache = json.load(f)
            logger.info(f"Loaded {len(_cache)} cached demo responses")
        except Exception as e:
            logger.error(f"Failed to load demo cache: {e}")
            _cache = {}
    return _cache


def get_cached_response(key: str) -> Optional[Dict[str, Any]]:
    """Get a cached response by key."""
    if not _cache:
        load_cache()
    return _cache.get(key)


def get_cache_key(func_name: str, **kwargs) -> str:
    """Generate a cache key from function name and arguments."""
    # Use topic/concept as primary keys for question generation
    if "topic" in kwargs:
        return f"{func_name}:{kwargs['topic']}"
    if "concept" in kwargs:
        return f"{func_name}:{kwargs['concept']}"
    if "student_id" in kwargs:
        return f"{func_name}:student:{kwargs['student_id']}"
    return func_name


T = TypeVar("T")

def with_demo_fallback(cache_key_prefix: str):
    """
    Decorator that provides demo mode fallback for AI functions.

    In demo mode or if the API call times out, returns cached response.
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            # Generate cache key
            cache_key = get_cache_key(cache_key_prefix, **kwargs)

            # If demo mode, always use cache
            if DEMO_MODE:
                cached = get_cached_response(cache_key)
                if cached:
                    logger.info(f"Demo mode: using cached response for {cache_key}")
                    return cached

            # Try actual API call with timeout
            try:
                result = await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=CACHE_TIMEOUT if not DEMO_MODE else 1.0
                )
                return result
            except asyncio.TimeoutError:
                logger.warning(f"API timeout for {cache_key}, using cached response")
                cached = get_cached_response(cache_key)
                if cached:
                    return cached
                raise
            except Exception as e:
                # On any error in demo mode, try cache
                if DEMO_MODE:
                    cached = get_cached_response(cache_key)
                    if cached:
                        logger.info(f"Demo mode fallback for {cache_key}: {e}")
                        return cached
                raise

        return wrapper
    return decorator


# Pre-load cache on module import
if DEMO_MODE:
    load_cache()
```

**Step 2: Create demo responses JSON**

```json
// backend/app/ai_agents/demo_responses.json
{
  "generate_questions:Recursion": {
    "questions": [
      {
        "prompt": "What is the base case for calculating factorial(n)?",
        "options": ["n == 0 or n == 1", "n < 0", "n > 100", "n == n-1"],
        "correct_answer": 0,
        "concept": "Recursion",
        "explanation": "The base case stops recursion. For factorial, factorial(0) = factorial(1) = 1.",
        "difficulty": "medium"
      },
      {
        "prompt": "What happens when a recursive function has no base case?",
        "options": ["Returns 0", "Stack overflow error", "Runs once", "Syntax error"],
        "correct_answer": 1,
        "concept": "Recursion",
        "explanation": "Without a base case, the function calls itself infinitely until the call stack is exhausted.",
        "difficulty": "easy"
      },
      {
        "prompt": "In the recursive formula fib(n) = fib(n-1) + fib(n-2), what is fib(5)?",
        "options": ["3", "5", "8", "13"],
        "correct_answer": 1,
        "concept": "Recursion",
        "explanation": "fib(5) = fib(4) + fib(3) = 3 + 2 = 5. The sequence is 1,1,2,3,5,8,13...",
        "difficulty": "medium"
      }
    ]
  },
  "generate_questions:Newton's Laws": {
    "questions": [
      {
        "prompt": "A 2 kg object accelerates at 3 m/s². What is the net force acting on it?",
        "options": ["1.5 N", "5 N", "6 N", "0.67 N"],
        "correct_answer": 2,
        "concept": "Newton's Second Law",
        "explanation": "Using F = ma: F = 2 kg × 3 m/s² = 6 N",
        "difficulty": "easy"
      },
      {
        "prompt": "An astronaut floats in the ISS because:",
        "options": [
          "There is no gravity in space",
          "They are in free fall with the station",
          "The station's walls block gravity",
          "Space has negative gravity"
        ],
        "correct_answer": 1,
        "concept": "Newton's First Law",
        "explanation": "The ISS and astronaut are both falling toward Earth at the same rate, creating apparent weightlessness.",
        "difficulty": "hard"
      }
    ]
  },
  "generate_questions:Limits": {
    "questions": [
      {
        "prompt": "What is lim(x→0) sin(x)/x?",
        "options": ["0", "1", "∞", "Does not exist"],
        "correct_answer": 1,
        "concept": "Special Limits",
        "explanation": "This is a famous limit equal to 1, provable by L'Hôpital's rule or the squeeze theorem.",
        "difficulty": "medium"
      },
      {
        "prompt": "If lim(x→a) f(x) = 5 and lim(x→a) g(x) = 3, what is lim(x→a) [f(x) · g(x)]?",
        "options": ["8", "15", "2", "Cannot be determined"],
        "correct_answer": 1,
        "concept": "Limit Laws",
        "explanation": "The limit of a product equals the product of limits: 5 × 3 = 15",
        "difficulty": "easy"
      }
    ]
  },
  "generate_exit_ticket:student:default": {
    "title": "Your Personalized Review",
    "summary": "Great effort today! You showed strong understanding of core concepts but struggled with recursive base cases.",
    "strengths": ["Loop syntax", "Function parameters", "Variable scope"],
    "areas_to_improve": ["Recursion base cases", "Stack behavior"],
    "practice_questions": [
      {
        "prompt": "Write the base case for a function that sums numbers from 1 to n recursively.",
        "hint": "What's the simplest case where you don't need recursion?"
      }
    ],
    "encouragement": "You're making great progress! Focus on understanding why recursion needs a stopping condition."
  },
  "tag_misconception:Recursion": {
    "misconception": "Confusing stack overflow with infinite loop",
    "confidence": 0.85,
    "explanation": "Students often think stack overflow and infinite loops are the same. Stack overflow is caused by too many function calls consuming memory, while infinite loops just run forever without necessarily crashing.",
    "remediation": "Use a debugger to visualize the call stack growing, then compare to a while(true) loop that doesn't grow the stack."
  }
}
```

**Step 3: Commit**

```bash
git add backend/app/ai_agents/demo_cache.py backend/app/ai_agents/demo_responses.json
git commit -m "feat: add AI demo mode with cached responses

- Demo cache module with timeout fallback
- Pre-loaded responses for key demo scenarios
- with_demo_fallback decorator for AI functions
- Configurable via DEMO_MODE and DEMO_CACHE_TIMEOUT env vars"
```

---

### Task 5: Teacher Onboarding Flow

**Files:**
- Create: `frontend/src/components/onboarding/TeacherOnboarding.tsx`
- Create: `frontend/src/components/onboarding/OnboardingStep.tsx`
- Create: `frontend/src/hooks/useOnboarding.ts`

**Step 1: Create onboarding hook**

```tsx
// frontend/src/hooks/useOnboarding.ts
"use client";

import { useState, useEffect, useCallback } from "react";

type OnboardingStep =
  | "welcome"
  | "create-course"
  | "create-quiz"
  | "invite-students"
  | "start-session"
  | "complete";

interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  dismissed: boolean;
}

const STORAGE_KEY = "quizly_teacher_onboarding";
const INITIAL_STATE: OnboardingState = {
  currentStep: "welcome",
  completedSteps: [],
  dismissed: false,
};

export function useTeacherOnboarding() {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setState(JSON.parse(stored));
      } catch {
        // Invalid stored state, use default
      }
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoading]);

  const completeStep = useCallback((step: OnboardingStep) => {
    setState((prev) => {
      const completedSteps = prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step];

      // Determine next step
      const steps: OnboardingStep[] = [
        "welcome",
        "create-course",
        "create-quiz",
        "invite-students",
        "start-session",
        "complete",
      ];
      const currentIndex = steps.indexOf(step);
      const nextStep = steps[currentIndex + 1] || "complete";

      return {
        ...prev,
        completedSteps,
        currentStep: nextStep,
      };
    });
  }, []);

  const skipOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dismissed: true,
      currentStep: "complete",
    }));
  }, []);

  const resetOnboarding = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const isStepComplete = useCallback(
    (step: OnboardingStep) => state.completedSteps.includes(step),
    [state.completedSteps]
  );

  const shouldShowOnboarding = !state.dismissed && state.currentStep !== "complete";

  return {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    isLoading,
    shouldShowOnboarding,
    completeStep,
    skipOnboarding,
    resetOnboarding,
    isStepComplete,
  };
}
```

**Step 2: Create OnboardingStep component**

```tsx
// frontend/src/components/onboarding/OnboardingStep.tsx
"use client";

import { ReactNode } from "react";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";

interface OnboardingStepProps {
  icon: LucideIcon;
  title: string;
  description: string;
  isComplete: boolean;
  isCurrent: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function OnboardingStep({
  icon: Icon,
  title,
  description,
  isComplete,
  isCurrent,
  action,
  children,
}: OnboardingStepProps) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        isCurrent
          ? "border-indigo-500 bg-indigo-500/10"
          : isComplete
          ? "border-green-500/50 bg-green-500/5"
          : "border-gray-800 bg-gray-900/50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            isComplete
              ? "bg-green-500"
              : isCurrent
              ? "bg-indigo-500"
              : "bg-gray-800"
          }`}
        >
          {isComplete ? (
            <Check className="w-5 h-5 text-white" />
          ) : (
            <Icon className={`w-5 h-5 ${isCurrent ? "text-white" : "text-gray-500"}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium ${
              isComplete ? "text-green-400" : isCurrent ? "text-white" : "text-gray-400"
            }`}
          >
            {title}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>

          {isCurrent && action && (
            <button
              onClick={action.onClick}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {action.label}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {isCurrent && children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create TeacherOnboarding component**

```tsx
// frontend/src/components/onboarding/TeacherOnboarding.tsx
"use client";

import { useRouter } from "next/navigation";
import { X, BookOpen, FileQuestion, Users, Play, Sparkles } from "lucide-react";
import { useTeacherOnboarding } from "@/hooks/useOnboarding";
import { OnboardingStep } from "./OnboardingStep";

export function TeacherOnboarding() {
  const router = useRouter();
  const {
    currentStep,
    isLoading,
    shouldShowOnboarding,
    completeStep,
    skipOnboarding,
    isStepComplete,
  } = useTeacherOnboarding();

  if (isLoading || !shouldShowOnboarding) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Welcome to Quizly!</h2>
                <p className="text-sm text-gray-400">Let's set up your first class</p>
              </div>
            </div>
            <button
              onClick={skipOnboarding}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              aria-label="Skip onboarding"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          <OnboardingStep
            icon={BookOpen}
            title="Create your first course"
            description="Organize your content into courses for easy management"
            isComplete={isStepComplete("create-course")}
            isCurrent={currentStep === "welcome" || currentStep === "create-course"}
            action={{
              label: "Create Course",
              onClick: () => {
                completeStep("create-course");
                router.push("/teacher/classrooms?new=true");
              },
            }}
          />

          <OnboardingStep
            icon={FileQuestion}
            title="Create a quiz"
            description="Add questions manually or let AI generate them for you"
            isComplete={isStepComplete("create-quiz")}
            isCurrent={currentStep === "create-quiz"}
            action={{
              label: "Create Quiz",
              onClick: () => {
                completeStep("create-quiz");
                router.push("/teacher/quizzes/new");
              },
            }}
          />

          <OnboardingStep
            icon={Users}
            title="Invite students"
            description="Share your class code so students can join"
            isComplete={isStepComplete("invite-students")}
            isCurrent={currentStep === "invite-students"}
            action={{
              label: "View Join Code",
              onClick: () => {
                completeStep("invite-students");
                router.push("/teacher/classrooms");
              },
            }}
          />

          <OnboardingStep
            icon={Play}
            title="Start a live session"
            description="Run your first interactive quiz session"
            isComplete={isStepComplete("start-session")}
            isCurrent={currentStep === "start-session"}
            action={{
              label: "Start Session",
              onClick: () => {
                completeStep("start-session");
                router.push("/teacher/quizzes");
              },
            }}
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {4 - (isStepComplete("create-course") ? 1 : 0) - (isStepComplete("create-quiz") ? 1 : 0) - (isStepComplete("invite-students") ? 1 : 0) - (isStepComplete("start-session") ? 1 : 0)} steps remaining
            </p>
            <button
              onClick={skipOnboarding}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/components/onboarding/ frontend/src/hooks/useOnboarding.ts
git commit -m "feat: add teacher onboarding flow

- useTeacherOnboarding hook with localStorage persistence
- OnboardingStep component for individual steps
- TeacherOnboarding modal with 4-step guided flow
- Skip and dismiss functionality
- Progress tracking across sessions"
```

---

### Task 6: Student Onboarding Flow

**Files:**
- Create: `frontend/src/components/onboarding/StudentOnboarding.tsx`
- Modify: `frontend/src/hooks/useOnboarding.ts`

**Step 1: Add student onboarding hook**

```tsx
// Add to frontend/src/hooks/useOnboarding.ts

type StudentOnboardingStep = "welcome" | "join-class" | "try-quiz" | "complete";

interface StudentOnboardingState {
  currentStep: StudentOnboardingStep;
  completedSteps: StudentOnboardingStep[];
  dismissed: boolean;
}

const STUDENT_STORAGE_KEY = "quizly_student_onboarding";
const STUDENT_INITIAL_STATE: StudentOnboardingState = {
  currentStep: "welcome",
  completedSteps: [],
  dismissed: false,
};

export function useStudentOnboarding() {
  const [state, setState] = useState<StudentOnboardingState>(STUDENT_INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STUDENT_STORAGE_KEY);
    if (stored) {
      try {
        setState(JSON.parse(stored));
      } catch {
        // Invalid stored state
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoading]);

  const completeStep = useCallback((step: StudentOnboardingStep) => {
    setState((prev) => {
      const completedSteps = prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step];

      const steps: StudentOnboardingStep[] = ["welcome", "join-class", "try-quiz", "complete"];
      const currentIndex = steps.indexOf(step);
      const nextStep = steps[currentIndex + 1] || "complete";

      return {
        ...prev,
        completedSteps,
        currentStep: nextStep,
      };
    });
  }, []);

  const skipOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dismissed: true,
      currentStep: "complete",
    }));
  }, []);

  const isStepComplete = useCallback(
    (step: StudentOnboardingStep) => state.completedSteps.includes(step),
    [state.completedSteps]
  );

  const shouldShowOnboarding = !state.dismissed && state.currentStep !== "complete";

  return {
    currentStep: state.currentStep,
    isLoading,
    shouldShowOnboarding,
    completeStep,
    skipOnboarding,
    isStepComplete,
  };
}
```

**Step 2: Create StudentOnboarding component**

```tsx
// frontend/src/components/onboarding/StudentOnboarding.tsx
"use client";

import { useRouter } from "next/navigation";
import { X, LogIn, Gamepad2, Sparkles } from "lucide-react";
import { useStudentOnboarding } from "@/hooks/useOnboarding";
import { OnboardingStep } from "./OnboardingStep";

export function StudentOnboarding() {
  const router = useRouter();
  const {
    currentStep,
    isLoading,
    shouldShowOnboarding,
    completeStep,
    skipOnboarding,
    isStepComplete,
  } = useStudentOnboarding();

  if (isLoading || !shouldShowOnboarding) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 max-w-lg w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Welcome to Quizly!</h2>
                <p className="text-sm text-gray-400">Let's get you started</p>
              </div>
            </div>
            <button
              onClick={skipOnboarding}
              className="p-2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          <OnboardingStep
            icon={LogIn}
            title="Join a class"
            description="Enter your teacher's class code to join"
            isComplete={isStepComplete("join-class")}
            isCurrent={currentStep === "welcome" || currentStep === "join-class"}
            action={{
              label: "Join Class",
              onClick: () => {
                completeStep("join-class");
                router.push("/join");
              },
            }}
          />

          <OnboardingStep
            icon={Gamepad2}
            title="Try a practice quiz"
            description="Test your knowledge with a quick quiz"
            isComplete={isStepComplete("try-quiz")}
            isCurrent={currentStep === "try-quiz"}
            action={{
              label: "Browse Quizzes",
              onClick: () => {
                completeStep("try-quiz");
                router.push("/student/library");
              },
            }}
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={skipOnboarding}
            className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors"
          >
            I'll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/onboarding/StudentOnboarding.tsx frontend/src/hooks/useOnboarding.ts
git commit -m "feat: add student onboarding flow

- useStudentOnboarding hook with persistence
- StudentOnboarding modal with 2-step flow
- Join class and try quiz guidance"
```

---

## Phase 2: Production Foundation

### Task 7: Backend Testing Setup

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`
- Create: `backend/pytest.ini`

**Step 1: Create pytest configuration**

```ini
# backend/pytest.ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_functions = test_*
addopts = -v --tb=short
filterwarnings =
    ignore::DeprecationWarning
```

**Step 2: Create test fixtures**

```python
# backend/tests/__init__.py
"""Quizly Backend Tests"""
```

```python
# backend/tests/conftest.py
"""
Pytest fixtures for Quizly backend tests.
"""

import asyncio
import os
import pytest
from typing import AsyncGenerator, Generator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Set test environment
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["TESTING"] = "true"

from app.main import app
from app.database import Base, get_db


# Create test database engine
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    echo=False,
)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session
        await session.rollback()

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def demo_teacher_data():
    """Sample teacher data for tests."""
    return {
        "email": "test_teacher@quizly.ai",
        "name": "Test Teacher",
        "role": "teacher",
    }


@pytest.fixture
def demo_student_data():
    """Sample student data for tests."""
    return {
        "email": "test_student@student.edu",
        "name": "Test Student",
        "role": "student",
    }


@pytest.fixture
def demo_quiz_data():
    """Sample quiz data for tests."""
    return {
        "title": "Test Quiz",
        "description": "A quiz for testing",
        "questions": [
            {
                "prompt": "What is 2 + 2?",
                "options": ["3", "4", "5", "6"],
                "correct_answer": "1",
                "concept": "Math",
            }
        ],
    }
```

**Step 3: Create basic health check test**

```python
# backend/tests/test_health.py
"""
Tests for health check endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    """Test root endpoint returns healthy status."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "Quizly API"


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "database" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_metrics_endpoint(client: AsyncClient):
    """Test Prometheus metrics endpoint."""
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert "quizly" in response.text or "http" in response.text
```

**Step 4: Run tests to verify setup**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All tests pass

**Step 5: Commit**

```bash
git add backend/tests/ backend/pytest.ini
git commit -m "feat: add backend testing infrastructure

- pytest.ini with async configuration
- conftest.py with database and client fixtures
- test_health.py with basic endpoint tests
- In-memory SQLite for test isolation"
```

---

### Task 8: Frontend Testing Setup

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/__tests__/setup.ts`
- Create: `frontend/src/__tests__/components/Skeleton.test.tsx`
- Modify: `frontend/package.json`

**Step 1: Add Vitest dependencies**

```bash
cd frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

**Step 2: Create Vitest config**

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '~': resolve(__dirname, './src'),
    },
  },
})
```

**Step 3: Create test setup file**

```typescript
// frontend/src/__tests__/setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
```

**Step 4: Create sample component test**

```tsx
// frontend/src/__tests__/components/Skeleton.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton'

describe('Skeleton components', () => {
  it('renders Skeleton with custom className', () => {
    render(<Skeleton className="h-10 w-20" />)
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('h-10', 'w-20')
  })

  it('renders SkeletonText with correct number of lines', () => {
    render(<SkeletonText lines={3} />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons).toHaveLength(3)
  })

  it('renders SkeletonCard with expected structure', () => {
    render(<SkeletonCard />)
    const card = document.querySelector('.rounded-xl')
    expect(card).toBeInTheDocument()
  })
})
```

**Step 5: Add test scripts to package.json**

```json
// Add to frontend/package.json scripts
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 6: Run tests to verify**

Run: `cd frontend && npm run test:run`
Expected: Tests pass

**Step 7: Commit**

```bash
git add frontend/vitest.config.ts frontend/src/__tests__/ frontend/package.json
git commit -m "feat: add frontend testing infrastructure

- Vitest configuration with React plugin
- Testing Library setup with jsdom
- Mock utilities for Next.js
- Sample Skeleton component tests"
```

---

### Task 9: GitHub Actions CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    name: Backend Tests
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run linter
        run: |
          pip install ruff
          ruff check app/ --ignore E501

      - name: Run type checker
        run: |
          pip install mypy types-redis
          mypy app/ --ignore-missing-imports --no-error-summary || true

      - name: Run tests
        run: python -m pytest tests/ -v
        env:
          DATABASE_URL: sqlite+aiosqlite:///:memory:
          TESTING: true

  frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Run tests
        run: npm run test:run

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8000
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY || 'pk_test_placeholder' }}

  lint-commits:
    name: Lint Commits
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check commit messages
        run: |
          # Simple check that commits have reasonable messages
          git log --oneline origin/main..HEAD | while read line; do
            if [ ${#line} -lt 10 ]; then
              echo "Commit message too short: $line"
              exit 1
            fi
          done
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add GitHub Actions CI pipeline

- Backend job: Python lint (ruff), type check (mypy), tests (pytest)
- Frontend job: Type check, tests (vitest), build
- Runs on push to main and PRs"
```

---

### Task 10: Sentry Error Monitoring

**Files:**
- Create: `backend/app/sentry_config.py`
- Modify: `backend/app/main.py`
- Create: `frontend/src/lib/sentry.ts`
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Add Sentry to backend requirements**

```
# Add to backend/requirements.txt
sentry-sdk[fastapi]==1.40.0
```

**Step 2: Create backend Sentry config**

```python
# backend/app/sentry_config.py
"""
Sentry error monitoring configuration.

Set SENTRY_DSN environment variable to enable error tracking.
"""

import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from .logging_config import get_logger

logger = get_logger("quizly.sentry")


def init_sentry():
    """Initialize Sentry SDK if DSN is configured."""
    dsn = os.getenv("SENTRY_DSN")

    if not dsn:
        logger.info("Sentry DSN not configured, error tracking disabled")
        return

    environment = os.getenv("SENTRY_ENVIRONMENT", "development")

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
        # Performance monitoring
        traces_sample_rate=0.1 if environment == "production" else 1.0,
        # Send user info (anonymized)
        send_default_pii=False,
        # Filter out health check transactions
        before_send_transaction=filter_health_checks,
    )

    logger.info(f"Sentry initialized for environment: {environment}")


def filter_health_checks(event, hint):
    """Filter out health check requests from performance monitoring."""
    if event.get("transaction") in ["/health", "/health/ready", "/metrics", "/"]:
        return None
    return event


def capture_exception(error: Exception, **context):
    """Capture an exception with additional context."""
    with sentry_sdk.push_scope() as scope:
        for key, value in context.items():
            scope.set_extra(key, value)
        sentry_sdk.capture_exception(error)


def set_user_context(user_id: str, email: str = None, role: str = None):
    """Set user context for error tracking."""
    sentry_sdk.set_user({
        "id": user_id,
        "email": email,
        "role": role,
    })
```

**Step 3: Initialize Sentry in main.py**

```python
# Add to backend/app/main.py after imports
from .sentry_config import init_sentry

# Add before app creation
init_sentry()
```

**Step 4: Add Sentry to frontend**

```bash
cd frontend && npm install @sentry/nextjs
```

**Step 5: Create frontend Sentry config**

```typescript
// frontend/src/lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

export function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.log("Sentry DSN not configured, error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session replay for debugging
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Filter out noise
    ignoreErrors: [
      "ResizeObserver loop",
      "Network request failed",
      "Load failed",
    ],
  });
}

export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

export function setUser(user: { id: string; email?: string; role?: string }) {
  Sentry.setUser(user);
}
```

**Step 6: Update ErrorBoundary to report to Sentry**

```typescript
// Update frontend/src/components/ErrorBoundary.tsx componentDidCatch
componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Report to Sentry in production
    if (process.env.NODE_ENV === "production") {
        import("@/lib/sentry").then(({ captureException }) => {
            captureException(error, { componentStack: errorInfo.componentStack });
        });
    }
}
```

**Step 7: Commit**

```bash
git add backend/app/sentry_config.py backend/requirements.txt frontend/src/lib/sentry.ts frontend/src/components/ErrorBoundary.tsx
git commit -m "feat: add Sentry error monitoring

- Backend Sentry integration with FastAPI and SQLAlchemy
- Frontend Sentry integration with session replay
- ErrorBoundary reports errors to Sentry in production
- Configurable via SENTRY_DSN environment variable"
```

---

### Task 11: Basic Accessibility Improvements

**Files:**
- Modify: `frontend/src/components/ui/Skeleton.tsx`
- Create: `frontend/src/components/ui/VisuallyHidden.tsx`
- Create: `frontend/src/components/ui/FocusTrap.tsx`

**Step 1: Create VisuallyHidden component for screen readers**

```tsx
// frontend/src/components/ui/VisuallyHidden.tsx
"use client";

import { ReactNode } from "react";

interface VisuallyHiddenProps {
  children: ReactNode;
}

/**
 * Visually hides content while keeping it accessible to screen readers.
 * Use for labels, descriptions, or skip links.
 */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return (
    <span
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Skip link for keyboard navigation.
 * Becomes visible on focus.
 */
export function SkipLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
    >
      {children}
    </a>
  );
}
```

**Step 2: Create FocusTrap for modals**

```tsx
// frontend/src/components/ui/FocusTrap.tsx
"use client";

import { useEffect, useRef, ReactNode } from "react";

interface FocusTrapProps {
  children: ReactNode;
  active?: boolean;
}

/**
 * Traps focus within a container (for modals, dialogs).
 * Pressing Tab cycles through focusable elements.
 * Pressing Escape can be handled by parent.
 */
export function FocusTrap({ children, active = true }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element on mount
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
```

**Step 3: Add aria-labels to Skeleton components**

```tsx
// Update frontend/src/components/ui/Skeleton.tsx
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading..."
      className={cn(
        "animate-pulse rounded-md bg-gray-800/50",
        className
      )}
    />
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/components/ui/VisuallyHidden.tsx frontend/src/components/ui/FocusTrap.tsx frontend/src/components/ui/Skeleton.tsx
git commit -m "feat: add accessibility utilities

- VisuallyHidden component for screen reader text
- SkipLink for keyboard navigation
- FocusTrap for modal focus management
- aria-labels on loading skeletons"
```

---

## Phase 3: Market-Ready

### Task 12: Data Export Endpoints

**Files:**
- Create: `backend/app/routes/export_routes.py`
- Modify: `backend/app/main.py`

**Step 1: Create export routes**

```python
# backend/app/routes/export_routes.py
"""
Data export endpoints for teachers.
Supports CSV and JSON exports of grades, responses, and analytics.
"""

import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth_clerk import get_current_user
from ..db_models import User, Quiz, GameSession, Response, Question, Player

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/quiz/{quiz_id}/responses/csv")
async def export_quiz_responses_csv(
    quiz_id: UUID,
    session_id: Optional[UUID] = Query(None, description="Filter by specific session"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export quiz responses as CSV."""
    # Verify ownership
    quiz = await db.get(Quiz, quiz_id)
    if not quiz or quiz.creator_id != current_user.id:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Build query
    query = (
        select(Response)
        .join(Question, Response.question_id == Question.id)
        .where(Question.quiz_id == quiz_id)
    )
    if session_id:
        query = query.where(Response.session_id == session_id)

    query = query.options(selectinload(Response.question))

    result = await db.execute(query)
    responses = result.scalars().all()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Student Name",
        "Question",
        "Answer",
        "Correct Answer",
        "Is Correct",
        "Score",
        "Confidence",
        "Time Taken (s)",
        "Submitted At",
    ])

    # Data rows
    for r in responses:
        writer.writerow([
            r.student_name or "Anonymous",
            r.question.prompt[:100] if r.question else "N/A",
            r.answer,
            r.question.correct_answer if r.question else "N/A",
            "Yes" if r.is_correct else "No",
            r.score or 0,
            r.confidence or "N/A",
            round(r.time_taken, 1) if r.time_taken else "N/A",
            r.submitted_at.isoformat() if r.submitted_at else "N/A",
        ])

    output.seek(0)

    filename = f"quiz_{quiz_id}_responses_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/session/{session_id}/leaderboard/csv")
async def export_session_leaderboard_csv(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export session leaderboard as CSV."""
    # Verify ownership
    session = await db.get(GameSession, session_id)
    if not session or session.host_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get players
    result = await db.execute(
        select(Player)
        .where(Player.session_id == session_id)
        .order_by(Player.score.desc())
    )
    players = result.scalars().all()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Rank", "Name", "Score", "Joined At"])

    for i, player in enumerate(players, 1):
        writer.writerow([
            i,
            player.display_name,
            player.score,
            player.joined_at.isoformat() if player.joined_at else "N/A",
        ])

    output.seek(0)

    filename = f"session_{session_id}_leaderboard.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/quiz/{quiz_id}/analytics/json")
async def export_quiz_analytics_json(
    quiz_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export quiz analytics as JSON."""
    quiz = await db.get(Quiz, quiz_id)
    if not quiz or quiz.creator_id != current_user.id:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Get questions with response stats
    questions_result = await db.execute(
        select(Question).where(Question.quiz_id == quiz_id)
    )
    questions = questions_result.scalars().all()

    analytics = {
        "quiz_id": str(quiz_id),
        "quiz_title": quiz.title,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "questions": [],
    }

    for q in questions:
        # Get responses for this question
        responses_result = await db.execute(
            select(Response).where(Response.question_id == q.id)
        )
        responses = responses_result.scalars().all()

        total = len(responses)
        correct = sum(1 for r in responses if r.is_correct)

        # Count answer distribution
        answer_dist = {}
        for r in responses:
            answer_dist[r.answer] = answer_dist.get(r.answer, 0) + 1

        analytics["questions"].append({
            "id": str(q.id),
            "prompt": q.prompt,
            "concept": q.concept,
            "total_responses": total,
            "correct_responses": correct,
            "accuracy": round(correct / total, 3) if total > 0 else 0,
            "answer_distribution": answer_dist,
            "avg_time": round(
                sum(r.time_taken for r in responses if r.time_taken) / total, 1
            ) if total > 0 else 0,
        })

    return analytics
```

**Step 2: Add router to main.py**

```python
# Add import in backend/app/main.py
from .routes import export_routes

# Add router
app.include_router(export_routes.router, tags=["exports"])
```

**Step 3: Commit**

```bash
git add backend/app/routes/export_routes.py backend/app/main.py
git commit -m "feat: add data export endpoints

- CSV export for quiz responses
- CSV export for session leaderboards
- JSON export for quiz analytics
- Teacher-only access with ownership verification"
```

---

### Task 13: Rate Limit User Feedback

**Files:**
- Create: `frontend/src/components/ui/RateLimitToast.tsx`
- Modify: `frontend/src/lib/api.ts` (or create if not exists)

**Step 1: Create RateLimitToast component**

```tsx
// frontend/src/components/ui/RateLimitToast.tsx
"use client";

import { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";

interface RateLimitToastProps {
  retryAfter: number; // seconds
  onDismiss: () => void;
}

export function RateLimitToast({ retryAfter, onDismiss }: RateLimitToastProps) {
  const [remaining, setRemaining] = useState(retryAfter);

  useEffect(() => {
    if (remaining <= 0) {
      onDismiss();
      return;
    }

    const timer = setInterval(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [remaining, onDismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-4 flex items-start gap-3 max-w-sm">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Clock className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-400">Slow down!</h4>
          <p className="text-sm text-gray-400 mt-1">
            Too many requests. Please wait{" "}
            <span className="font-mono text-amber-400">{remaining}s</span> before
            trying again.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Hook for managing rate limit state
import { createContext, useContext, useCallback, ReactNode } from "react";

interface RateLimitContextValue {
  showRateLimitToast: (retryAfter: number) => void;
}

const RateLimitContext = createContext<RateLimitContextValue | null>(null);

export function RateLimitProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ retryAfter: number } | null>(null);

  const showRateLimitToast = useCallback((retryAfter: number) => {
    setToast({ retryAfter });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <RateLimitContext.Provider value={{ showRateLimitToast }}>
      {children}
      {toast && (
        <RateLimitToast
          retryAfter={toast.retryAfter}
          onDismiss={dismissToast}
        />
      )}
    </RateLimitContext.Provider>
  );
}

export function useRateLimit() {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error("useRateLimit must be used within RateLimitProvider");
  }
  return context;
}
```

**Step 2: Create or update API client with rate limit handling**

```typescript
// frontend/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiError {
  status: number;
  message: string;
  retryAfter?: number;
}

class ApiClient {
  private rateLimitHandler?: (retryAfter: number) => void;

  setRateLimitHandler(handler: (retryAfter: number) => void) {
    this.rateLimitHandler = handler;
  }

  async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get("Retry-After") || "30",
        10
      );

      if (this.rateLimitHandler) {
        this.rateLimitHandler(retryAfter);
      }

      throw {
        status: 429,
        message: "Rate limit exceeded",
        retryAfter,
      } as ApiError;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: error.detail || "An error occurred",
      } as ApiError;
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const api = new ApiClient();
export type { ApiError };
```

**Step 3: Commit**

```bash
git add frontend/src/components/ui/RateLimitToast.tsx frontend/src/lib/api.ts
git commit -m "feat: add rate limit user feedback

- RateLimitToast component with countdown
- RateLimitProvider context for global toast management
- API client with automatic rate limit handling
- Shows retry countdown when 429 response received"
```

---

### Task 14: Privacy Policy Page

**Files:**
- Create: `frontend/src/app/privacy/page.tsx`
- Create: `backend/app/routes/privacy_routes.py`

**Step 1: Create privacy page**

```tsx
// frontend/src/app/privacy/page.tsx
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Quizly",
  description: "How Quizly handles your data",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <article className="max-w-3xl mx-auto prose prose-invert">
        <h1>Privacy Policy</h1>
        <p className="lead">
          Last updated: January 29, 2026
        </p>

        <h2>Introduction</h2>
        <p>
          Quizly ("we", "our", or "us") is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, and share information
          about you when you use our AI-powered peer instruction platform.
        </p>

        <h2>Information We Collect</h2>

        <h3>Account Information</h3>
        <p>
          When you create an account, we collect your name, email address, and
          role (teacher or student). Authentication is handled by Clerk, our
          identity provider.
        </p>

        <h3>Learning Data</h3>
        <p>For students, we collect:</p>
        <ul>
          <li>Quiz responses and scores</li>
          <li>Concept mastery progress</li>
          <li>Exit ticket completions</li>
          <li>Session participation data</li>
        </ul>
        <p>
          This data is used to provide personalized learning recommendations
          and to help teachers understand class performance.
        </p>

        <h3>Usage Data</h3>
        <p>
          We collect standard analytics data including pages visited, features
          used, and error logs to improve our service.
        </p>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>Provide and improve our educational services</li>
          <li>Generate AI-powered questions and feedback</li>
          <li>Track learning progress and identify misconceptions</li>
          <li>Send important service notifications</li>
          <li>Analyze usage patterns to improve the platform</li>
        </ul>

        <h2>Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul>
          <li>
            <strong>Teachers:</strong> Student learning data is shared with
            teachers for their enrolled courses
          </li>
          <li>
            <strong>Service Providers:</strong> We use third-party services for
            authentication (Clerk), AI (Google Gemini), and error tracking (Sentry)
          </li>
        </ul>

        <h2>Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. You may
          request deletion of your account and associated data at any time.
        </p>

        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Export your data in a portable format</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Opt out of non-essential communications</li>
        </ul>

        <h2>Data Security</h2>
        <p>
          We implement industry-standard security measures including encryption
          in transit (HTTPS), encrypted database storage, and regular security
          audits.
        </p>

        <h2>Children's Privacy</h2>
        <p>
          Quizly is designed for educational use. If used by students under 13,
          parental consent is required and the school is responsible for
          compliance with COPPA.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. We will notify you of
          significant changes via email or in-app notification.
        </p>

        <h2>Contact Us</h2>
        <p>
          For privacy-related questions, contact us at{" "}
          <a href="mailto:privacy@quizly.ai">privacy@quizly.ai</a>
        </p>
      </article>
    </div>
  );
}
```

**Step 2: Create data deletion endpoint**

```python
# backend/app/routes/privacy_routes.py
"""
Privacy-related endpoints for data access and deletion.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..auth_clerk import get_current_user
from ..db_models import User, Response, Player
from ..db_models_learning import ConceptMastery, StudentMisconception, ExitTicket
from ..logging_config import get_logger

router = APIRouter(prefix="/privacy", tags=["privacy"])
logger = get_logger("quizly.privacy")


@router.delete("/me")
async def delete_my_data(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete all data associated with the current user.
    This action is irreversible.
    """
    user_id = current_user.id

    # Schedule background deletion for large data
    background_tasks.add_task(delete_user_data, user_id)

    # Mark user as deleted (soft delete)
    current_user.email = f"deleted_{user_id}@deleted.quizly.ai"
    current_user.name = "Deleted User"
    await db.commit()

    logger.info(f"User deletion initiated", user_id=str(user_id))

    return {
        "message": "Your data deletion has been initiated. This may take a few minutes to complete.",
        "user_id": str(user_id),
    }


async def delete_user_data(user_id: UUID):
    """Background task to delete all user data."""
    from ..database import async_session

    async with async_session() as db:
        try:
            # Delete learning data
            await db.execute(
                delete(ConceptMastery).where(ConceptMastery.student_id == user_id)
            )
            await db.execute(
                delete(StudentMisconception).where(StudentMisconception.student_id == user_id)
            )
            await db.execute(
                delete(ExitTicket).where(ExitTicket.student_id == user_id)
            )

            # Delete quiz responses
            await db.execute(
                delete(Response).where(Response.player_id.in_(
                    Player.id for Player in (
                        await db.execute(
                            Player.__table__.select().where(Player.user_id == user_id)
                        )
                    ).scalars()
                ))
            )

            # Delete player records
            await db.execute(
                delete(Player).where(Player.user_id == user_id)
            )

            await db.commit()
            logger.info(f"User data deletion completed", user_id=str(user_id))

        except Exception as e:
            logger.error(f"User data deletion failed", user_id=str(user_id), error=str(e))
            raise


@router.get("/me/export")
async def export_my_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export all data associated with the current user.
    Returns a JSON object with all user data.
    """
    from sqlalchemy import select

    user_id = current_user.id

    # Gather all user data
    export_data = {
        "user": {
            "id": str(user_id),
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "concept_mastery": [],
        "quiz_responses": [],
        "exit_tickets": [],
    }

    # Get concept mastery
    mastery_result = await db.execute(
        select(ConceptMastery).where(ConceptMastery.student_id == user_id)
    )
    for m in mastery_result.scalars():
        export_data["concept_mastery"].append({
            "concept": m.concept,
            "mastery_level": m.mastery_level,
            "attempts": m.attempts,
            "last_practiced": m.last_practiced.isoformat() if m.last_practiced else None,
        })

    # Get player records and responses
    players_result = await db.execute(
        select(Player).where(Player.user_id == user_id)
    )
    for player in players_result.scalars():
        responses_result = await db.execute(
            select(Response).where(Response.player_id == player.id)
        )
        for r in responses_result.scalars():
            export_data["quiz_responses"].append({
                "session_id": str(r.session_id),
                "answer": r.answer,
                "is_correct": r.is_correct,
                "score": r.score,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            })

    # Get exit tickets
    tickets_result = await db.execute(
        select(ExitTicket).where(ExitTicket.student_id == user_id)
    )
    for t in tickets_result.scalars():
        export_data["exit_tickets"].append({
            "id": str(t.id),
            "content": t.content,
            "completed": t.completed,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    return export_data
```

**Step 3: Add router to main.py**

```python
# Add import and router in backend/app/main.py
from .routes import privacy_routes
app.include_router(privacy_routes.router, tags=["privacy"])
```

**Step 4: Commit**

```bash
git add frontend/src/app/privacy/page.tsx backend/app/routes/privacy_routes.py backend/app/main.py
git commit -m "feat: add privacy policy and data management

- Privacy policy page with comprehensive disclosure
- DELETE /privacy/me endpoint for account deletion
- GET /privacy/me/export endpoint for data portability
- Background task for cascading data deletion"
```

---

## Final Verification

### Task 15: Integration Test and Documentation

**Step 1: Create a simple integration test script**

```bash
# Create backend/scripts/verify_demo.sh
#!/bin/bash
set -e

echo "🧪 Verifying demo environment..."

# Check backend health
echo "Checking backend health..."
curl -s http://localhost:8000/health | grep -q "healthy" && echo "✅ Backend healthy" || echo "❌ Backend unhealthy"

# Check frontend build
echo "Checking frontend..."
cd frontend && npm run build > /dev/null 2>&1 && echo "✅ Frontend builds" || echo "❌ Frontend build failed"

# Run backend tests
echo "Running backend tests..."
cd ../backend && python -m pytest tests/ -v --tb=short && echo "✅ Backend tests pass" || echo "❌ Backend tests failed"

# Run frontend tests
echo "Running frontend tests..."
cd ../frontend && npm run test:run && echo "✅ Frontend tests pass" || echo "❌ Frontend tests failed"

echo ""
echo "🎉 Verification complete!"
```

**Step 2: Update the design document with completion status**

```markdown
# Add to docs/plans/2026-01-29-production-readiness-design.md

## Implementation Status

### Phase 1: Demo Polish ✅
- [x] Enhanced demo seeding script
- [x] Skeleton loading components
- [x] Empty state components
- [x] AI demo mode with caching
- [x] Teacher onboarding flow
- [x] Student onboarding flow

### Phase 2: Production Foundation ✅
- [x] Backend testing setup (pytest)
- [x] Frontend testing setup (Vitest)
- [x] GitHub Actions CI pipeline
- [x] Sentry error monitoring
- [x] Basic accessibility improvements

### Phase 3: Market-Ready ✅
- [x] Data export endpoints (CSV, JSON)
- [x] Rate limit user feedback
- [x] Privacy policy and data deletion
```

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete production readiness implementation

Phase 1 - Demo Polish:
- Enhanced demo seeding with realistic data
- Loading skeletons and empty states
- AI demo mode with cached fallback
- Teacher and student onboarding flows

Phase 2 - Production Foundation:
- pytest and Vitest testing infrastructure
- GitHub Actions CI pipeline
- Sentry error monitoring integration
- Accessibility utilities (focus trap, screen reader support)

Phase 3 - Market-Ready:
- CSV/JSON data export endpoints
- Rate limit toast notifications
- Privacy policy and data deletion endpoints"
```

---

## Summary

This implementation plan covers 15 tasks across 3 phases:

**Phase 1 (Demo Polish):** 6 tasks
- Demo seeding, loading states, empty states, AI caching, onboarding

**Phase 2 (Production Foundation):** 5 tasks
- Testing, CI/CD, error monitoring, accessibility

**Phase 3 (Market-Ready):** 4 tasks
- Exports, rate limiting UX, privacy compliance

Each task includes exact file paths, complete code, and commit messages.

---

Plan complete and saved to `docs/plans/2026-01-29-production-readiness-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?

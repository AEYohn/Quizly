"""
Enhanced Demo Seeding Script for Quizly
========================================

Populates the database with comprehensive demo data for hackathon demonstrations.

Includes:
- 2 teachers (demo + empty for live creation)
- 3 courses with realistic content (CS101, PHYS201, MATH150)
- 15 students with varied performance profiles (high/medium/low performers)
- Historical quiz data with responses and analytics
- Ready-to-demo game session with join code "DEMO2026"
- Misconception tracking data
- Student concept mastery data

Run with: python -m app.scripts.seed_demo
"""

import asyncio
import uuid
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from sqlalchemy import select

from ..database import engine, async_session, Base
from ..db_models import (
    User, Course, CourseModule, ModuleItem, CourseEnrollment,
    Session, Question, Response, Misconception,
    ConceptMastery, StudentMisconception, SessionParticipant
)
from ..db_models_learning import (
    ExitTicket, DetailedMisconception, AdaptiveLearningState,
    PeerDiscussionSession
)
from ..models.game import Quiz, QuizQuestion, GameSession, Player, PlayerAnswer


# Demo identifiers for idempotency
DEMO_TEACHER_EMAIL = "demo@quizly.ai"
DEMO_TEACHER_2_EMAIL = "teacher@quizly.ai"
DEMO_GAME_CODE = "DEMO2026"


# Student profiles with performance characteristics
STUDENT_PROFILES = [
    # High performers (5 students)
    {"name": "Alice Chen", "level": "high", "accuracy_range": (0.85, 0.95), "confidence_range": (75, 95)},
    {"name": "Bob Martinez", "level": "high", "accuracy_range": (0.82, 0.92), "confidence_range": (70, 90)},
    {"name": "Carol Johnson", "level": "high", "accuracy_range": (0.80, 0.90), "confidence_range": (72, 88)},
    {"name": "David Kim", "level": "high", "accuracy_range": (0.78, 0.88), "confidence_range": (68, 85)},
    {"name": "Emma Williams", "level": "high", "accuracy_range": (0.75, 0.88), "confidence_range": (65, 82)},
    # Medium performers (6 students)
    {"name": "Frank Garcia", "level": "medium", "accuracy_range": (0.55, 0.75), "confidence_range": (50, 75)},
    {"name": "Grace Lee", "level": "medium", "accuracy_range": (0.52, 0.72), "confidence_range": (48, 72)},
    {"name": "Henry Brown", "level": "medium", "accuracy_range": (0.50, 0.70), "confidence_range": (45, 70)},
    {"name": "Ivy Taylor", "level": "medium", "accuracy_range": (0.48, 0.68), "confidence_range": (42, 68)},
    {"name": "Jack Wilson", "level": "medium", "accuracy_range": (0.45, 0.65), "confidence_range": (40, 65)},
    {"name": "Katie Anderson", "level": "medium", "accuracy_range": (0.42, 0.62), "confidence_range": (38, 62)},
    # Low performers (4 students)
    {"name": "Liam Thomas", "level": "low", "accuracy_range": (0.25, 0.45), "confidence_range": (55, 80)},  # Overconfident
    {"name": "Maya Jackson", "level": "low", "accuracy_range": (0.28, 0.48), "confidence_range": (30, 50)},
    {"name": "Noah White", "level": "low", "accuracy_range": (0.22, 0.42), "confidence_range": (25, 45)},
    {"name": "Olivia Harris", "level": "low", "accuracy_range": (0.20, 0.40), "confidence_range": (20, 40)},
]


# Course definitions with realistic academic content
COURSES_DATA = [
    {
        "code": "CS101",
        "name": "Introduction to Computer Science",
        "description": "Fundamental concepts of programming, algorithms, and computational thinking. Covers Python basics, data structures, and problem-solving strategies.",
        "difficulty_level": "beginner",
        "tags": ["programming", "python", "algorithms", "beginner"],
        "estimated_hours": 45,
        "modules": [
            {
                "title": "Getting Started with Python",
                "items": [
                    {"title": "Welcome to CS101", "type": "lesson", "content": "# Welcome to CS101\n\nIn this course, you'll learn the fundamentals of computer science and programming using Python."},
                    {"title": "Setting Up Your Environment", "type": "lesson", "content": "# Development Environment\n\nLearn how to set up Python and VS Code for this course."},
                    {"title": "Variables and Data Types", "type": "quiz"},
                    {"title": "Basic Input/Output", "type": "quiz"},
                ]
            },
            {
                "title": "Control Flow",
                "items": [
                    {"title": "Conditional Statements", "type": "lesson", "content": "# If Statements\n\nLearn how to make decisions in your code with if, elif, and else."},
                    {"title": "Loops and Iteration", "type": "lesson", "content": "# Loops\n\nfor loops and while loops let you repeat code."},
                    {"title": "Control Flow Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Functions and Recursion",
                "items": [
                    {"title": "Defining Functions", "type": "lesson", "content": "# Functions\n\nFunctions help you organize and reuse code."},
                    {"title": "Recursion Fundamentals", "type": "lesson", "content": "# Recursion\n\nA function that calls itself to solve smaller subproblems."},
                    {"title": "Recursion Quiz", "type": "quiz"},
                ]
            },
        ],
        "quizzes": [
            {
                "title": "Variables and Data Types Quiz",
                "subject": "python-basics",
                "questions": [
                    {
                        "text": "What is the output of: x = 5; x = x + 1; print(x)?",
                        "options": {"A": "5", "B": "6", "C": "Error", "D": "None"},
                        "correct": "B",
                        "explanation": "The variable x starts at 5, then x + 1 = 6 is assigned back to x.",
                        "concept": "Variables"
                    },
                    {
                        "text": "Which data type would you use to store someone's name?",
                        "options": {"A": "int", "B": "float", "C": "str", "D": "bool"},
                        "correct": "C",
                        "explanation": "str (string) is used to store text data like names.",
                        "concept": "Data Types"
                    },
                    {
                        "text": "What is the result of 7 // 2 in Python?",
                        "options": {"A": "3.5", "B": "3", "C": "4", "D": "Error"},
                        "correct": "B",
                        "explanation": "// is integer division, which discards the decimal part.",
                        "concept": "Operators"
                    },
                ]
            },
            {
                "title": "Recursion Fundamentals Quiz",
                "subject": "recursion",
                "questions": [
                    {
                        "text": "What is the base case for calculating factorial(n)?",
                        "options": {"A": "n == 0 or n == 1", "B": "n < 0", "C": "n > 100", "D": "n == n-1"},
                        "correct": "A",
                        "explanation": "factorial(0) = factorial(1) = 1, which stops the recursion.",
                        "concept": "Recursion",
                        "misconception_trap": "D"
                    },
                    {
                        "text": "What happens when a recursive function has no base case?",
                        "options": {"A": "It returns 0", "B": "Stack overflow", "C": "It runs once", "D": "Syntax error"},
                        "correct": "B",
                        "explanation": "Without a base case, the function calls itself infinitely until the call stack is exhausted.",
                        "concept": "Recursion",
                        "misconception_trap": "C"
                    },
                    {
                        "text": "In recursive fibonacci, what are the base cases?",
                        "options": {"A": "fib(0)=0 and fib(1)=1", "B": "fib(0)=1 only", "C": "fib(1)=1 and fib(2)=2", "D": "No base case needed"},
                        "correct": "A",
                        "explanation": "Fibonacci sequence starts with F(0)=0 and F(1)=1 as the base cases.",
                        "concept": "Recursion"
                    },
                ]
            },
        ]
    },
    {
        "code": "PHYS201",
        "name": "Physics II: Electricity and Magnetism",
        "description": "Comprehensive study of electrostatics, circuits, magnetism, and electromagnetic waves. Includes hands-on labs and problem-solving sessions.",
        "difficulty_level": "intermediate",
        "tags": ["physics", "electricity", "magnetism", "circuits"],
        "estimated_hours": 60,
        "modules": [
            {
                "title": "Electric Fields and Forces",
                "items": [
                    {"title": "Coulomb's Law", "type": "lesson", "content": "# Coulomb's Law\n\nThe force between two point charges is proportional to the product of charges and inversely proportional to the square of distance."},
                    {"title": "Electric Field Lines", "type": "lesson", "content": "# Electric Fields\n\nVisualize the electric field using field lines."},
                    {"title": "Electrostatics Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Electric Circuits",
                "items": [
                    {"title": "Ohm's Law and Resistance", "type": "lesson", "content": "# Ohm's Law\n\nV = IR relates voltage, current, and resistance."},
                    {"title": "Series and Parallel Circuits", "type": "lesson", "content": "# Circuit Configurations\n\nComponents can be connected in series or parallel."},
                    {"title": "Circuit Analysis Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Magnetism",
                "items": [
                    {"title": "Magnetic Fields", "type": "lesson", "content": "# Magnetic Fields\n\nMoving charges create magnetic fields."},
                    {"title": "Electromagnetic Induction", "type": "lesson", "content": "# Faraday's Law\n\nA changing magnetic field induces an electric field."},
                    {"title": "Magnetism Quiz", "type": "quiz"},
                ]
            },
        ],
        "quizzes": [
            {
                "title": "Electrostatics Quiz",
                "subject": "electrostatics",
                "questions": [
                    {
                        "text": "Two positive charges are placed near each other. What happens?",
                        "options": {"A": "They attract", "B": "They repel", "C": "Nothing", "D": "They neutralize"},
                        "correct": "B",
                        "explanation": "Like charges repel each other.",
                        "concept": "Electric Forces"
                    },
                    {
                        "text": "If the distance between two charges is doubled, the force becomes:",
                        "options": {"A": "Half", "B": "Double", "C": "Quarter", "D": "Four times"},
                        "correct": "C",
                        "explanation": "F is proportional to 1/r^2, so doubling r makes F = 1/4 of original.",
                        "concept": "Coulomb's Law",
                        "misconception_trap": "A"
                    },
                    {
                        "text": "Electric field lines point:",
                        "options": {"A": "From negative to positive", "B": "From positive to negative", "C": "In circles", "D": "Randomly"},
                        "correct": "B",
                        "explanation": "By convention, field lines point away from positive charges toward negative charges.",
                        "concept": "Electric Fields"
                    },
                ]
            },
            {
                "title": "Circuit Analysis Quiz",
                "subject": "circuits",
                "questions": [
                    {
                        "text": "In a series circuit, the current is:",
                        "options": {"A": "Different through each component", "B": "The same through all components", "C": "Zero", "D": "Infinite"},
                        "correct": "B",
                        "explanation": "In series, there's only one path for current, so it's the same everywhere.",
                        "concept": "Series Circuits"
                    },
                    {
                        "text": "Two 10-ohm resistors in parallel have total resistance of:",
                        "options": {"A": "20 ohms", "B": "10 ohms", "C": "5 ohms", "D": "0 ohms"},
                        "correct": "C",
                        "explanation": "1/R_total = 1/10 + 1/10 = 2/10, so R_total = 5 ohms.",
                        "concept": "Parallel Circuits",
                        "misconception_trap": "A"
                    },
                    {
                        "text": "What does a voltmeter measure?",
                        "options": {"A": "Current", "B": "Resistance", "C": "Potential difference", "D": "Power"},
                        "correct": "C",
                        "explanation": "A voltmeter measures the voltage (potential difference) across a component.",
                        "concept": "Circuit Measurements"
                    },
                ]
            },
        ]
    },
    {
        "code": "MATH150",
        "name": "Calculus I: Limits and Derivatives",
        "description": "Introduction to differential calculus. Topics include limits, continuity, derivatives, and applications of differentiation.",
        "difficulty_level": "intermediate",
        "tags": ["mathematics", "calculus", "limits", "derivatives"],
        "estimated_hours": 50,
        "modules": [
            {
                "title": "Limits and Continuity",
                "items": [
                    {"title": "Introduction to Limits", "type": "lesson", "content": "# Limits\n\nA limit describes the value a function approaches as the input approaches a certain value."},
                    {"title": "Evaluating Limits", "type": "lesson", "content": "# Limit Techniques\n\nDirect substitution, factoring, and L'Hopital's Rule."},
                    {"title": "Limits Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Derivatives",
                "items": [
                    {"title": "Definition of the Derivative", "type": "lesson", "content": "# The Derivative\n\nThe derivative measures the instantaneous rate of change."},
                    {"title": "Derivative Rules", "type": "lesson", "content": "# Differentiation Rules\n\nPower rule, product rule, quotient rule, chain rule."},
                    {"title": "Derivatives Quiz", "type": "quiz"},
                ]
            },
            {
                "title": "Applications of Derivatives",
                "items": [
                    {"title": "Optimization", "type": "lesson", "content": "# Optimization\n\nUse derivatives to find maximum and minimum values."},
                    {"title": "Related Rates", "type": "lesson", "content": "# Related Rates\n\nSolve problems where multiple quantities change with respect to time."},
                    {"title": "Applications Quiz", "type": "quiz"},
                ]
            },
        ],
        "quizzes": [
            {
                "title": "Limits Quiz",
                "subject": "limits",
                "questions": [
                    {
                        "text": "What is lim(x->0) sin(x)/x?",
                        "options": {"A": "0", "B": "1", "C": "Infinity", "D": "Does not exist"},
                        "correct": "B",
                        "explanation": "This is a famous limit equal to 1, often proved using the squeeze theorem.",
                        "concept": "Limits",
                        "misconception_trap": "A"
                    },
                    {
                        "text": "A function is continuous at x=a if:",
                        "options": {"A": "f(a) exists only", "B": "lim f(x) exists only", "C": "f(a) = lim(x->a) f(x)", "D": "f is differentiable"},
                        "correct": "C",
                        "explanation": "Continuity requires three conditions: f(a) exists, the limit exists, and they're equal.",
                        "concept": "Continuity"
                    },
                    {
                        "text": "What is lim(x->infinity) (3x^2 + 2)/(x^2 + 1)?",
                        "options": {"A": "0", "B": "1", "C": "3", "D": "Infinity"},
                        "correct": "C",
                        "explanation": "Divide by highest power of x. The limit equals 3/1 = 3.",
                        "concept": "Limits at Infinity"
                    },
                ]
            },
            {
                "title": "Derivatives Quiz",
                "subject": "derivatives",
                "questions": [
                    {
                        "text": "What is the derivative of x^3?",
                        "options": {"A": "x^2", "B": "3x^2", "C": "3x^3", "D": "x^4/4"},
                        "correct": "B",
                        "explanation": "By the power rule, d/dx[x^n] = n*x^(n-1), so d/dx[x^3] = 3x^2.",
                        "concept": "Power Rule"
                    },
                    {
                        "text": "If f(x) = sin(x), what is f'(x)?",
                        "options": {"A": "cos(x)", "B": "-cos(x)", "C": "sin(x)", "D": "-sin(x)"},
                        "correct": "A",
                        "explanation": "The derivative of sin(x) is cos(x).",
                        "concept": "Trigonometric Derivatives"
                    },
                    {
                        "text": "What does the chain rule help you find?",
                        "options": {"A": "Derivative of a sum", "B": "Derivative of a product", "C": "Derivative of a composition", "D": "Derivative of a quotient"},
                        "correct": "C",
                        "explanation": "The chain rule is used for composite functions: d/dx[f(g(x))] = f'(g(x)) * g'(x).",
                        "concept": "Chain Rule"
                    },
                ]
            },
        ]
    },
]


# Misconception data for tracking
MISCONCEPTIONS_DATA = [
    {
        "topic": "Recursion",
        "misconception": "Confuse stack overflow with infinite loop",
        "description": "Students think stack overflow and infinite loops are the same error, not understanding the call stack.",
        "severity": "high",
        "common_wrong_answer": "C",
        "suggested_intervention": "Use visual debugger to show call stack growing, then crashing vs a loop that just runs forever.",
    },
    {
        "topic": "Recursion",
        "misconception": "Forget the base case",
        "description": "Students write recursive functions without proper termination conditions.",
        "severity": "high",
        "common_wrong_answer": "D",
        "suggested_intervention": "Always start writing recursion by defining the base case first.",
    },
    {
        "topic": "Coulomb's Law",
        "misconception": "Inverse relationship confusion",
        "description": "Students think doubling distance halves the force instead of quartering it.",
        "severity": "medium",
        "common_wrong_answer": "A",
        "suggested_intervention": "Emphasize the squared relationship with numerical examples.",
    },
    {
        "topic": "Parallel Circuits",
        "misconception": "Add resistances like series",
        "description": "Students add parallel resistors directly instead of using 1/R formula.",
        "severity": "high",
        "common_wrong_answer": "A",
        "suggested_intervention": "Practice converting between series and parallel resistance formulas.",
    },
    {
        "topic": "Limits",
        "misconception": "Direct substitution for 0/0 forms",
        "description": "Students substitute x=0 directly in sin(x)/x and think the answer is 0.",
        "severity": "high",
        "common_wrong_answer": "A",
        "suggested_intervention": "Identify indeterminate forms before attempting evaluation.",
    },
]


async def check_demo_exists(db) -> bool:
    """Check if demo data already exists."""
    result = await db.execute(select(User).where(User.email == DEMO_TEACHER_EMAIL))
    return result.scalar_one_or_none() is not None


async def create_teachers(db) -> tuple:
    """Create demo teachers."""
    # Demo teacher with pre-populated data
    demo_teacher = User(
        id=uuid.uuid4(),
        email=DEMO_TEACHER_EMAIL,
        name="Dr. Demo Teacher",
        role="teacher",
    )
    db.add(demo_teacher)

    # Empty teacher for live creation during demo
    empty_teacher = User(
        id=uuid.uuid4(),
        email=DEMO_TEACHER_2_EMAIL,
        name="Prof. New Teacher",
        role="teacher",
    )
    db.add(empty_teacher)

    await db.flush()
    return demo_teacher, empty_teacher


async def create_students(db, students_data: List[Dict]) -> List[User]:
    """Create student users."""
    students = []
    for i, profile in enumerate(students_data):
        student = User(
            id=uuid.uuid4(),
            email=f"student{i+1}@quizly.ai",
            name=profile["name"],
            role="student",
        )
        db.add(student)
        students.append(student)

    await db.flush()
    return students


async def create_course_structure(
    db,
    teacher: User,
    course_data: Dict,
    students: List[User]
) -> Course:
    """Create a course with modules, items, and enrollments."""
    course = Course(
        id=uuid.uuid4(),
        teacher_id=teacher.id,
        name=f"{course_data['code']}: {course_data['name']}",
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

    # Create modules and items
    for mod_idx, module_data in enumerate(course_data["modules"]):
        module = CourseModule(
            id=uuid.uuid4(),
            course_id=course.id,
            title=module_data["title"],
            order_index=mod_idx,
            is_published=True,
        )
        db.add(module)
        await db.flush()

        for item_idx, item_data in enumerate(module_data["items"]):
            item = ModuleItem(
                id=uuid.uuid4(),
                module_id=module.id,
                title=item_data["title"],
                item_type=item_data["type"],
                order_index=item_idx,
                content=item_data.get("content", f"# {item_data['title']}\n\nContent coming soon."),
                points=10 if item_data["type"] == "quiz" else 0,
                is_published=True,
            )
            db.add(item)

    # Enroll students
    for student in students:
        enrollment = CourseEnrollment(
            id=uuid.uuid4(),
            course_id=course.id,
            student_id=student.id,
            student_name=student.name,
            role="student",
        )
        db.add(enrollment)

    await db.flush()
    return course


async def create_quiz_with_questions(
    db,
    teacher: User,
    course: Course,
    quiz_data: Dict,
) -> Quiz:
    """Create a quiz with questions."""
    quiz = Quiz(
        id=uuid.uuid4(),
        teacher_id=teacher.id,
        title=quiz_data["title"],
        description=f"Quiz for {course.name}",
        subject=quiz_data["subject"],
        is_public=True,
        quiz_type="teacher",
        course_id=course.id,
        timer_enabled=True,
        default_time_limit=30,
        peer_discussion_enabled=True,
        difficulty_adaptation=True,
    )
    db.add(quiz)
    await db.flush()

    questions = []
    for q_idx, q_data in enumerate(quiz_data["questions"]):
        question = QuizQuestion(
            id=uuid.uuid4(),
            quiz_id=quiz.id,
            order=q_idx,
            question_text=q_data["text"],
            question_type="multiple_choice",
            options=q_data["options"],
            correct_answer=q_data["correct"],
            explanation=q_data.get("explanation"),
            time_limit=30,
            points=1000,
        )
        db.add(question)
        questions.append(question)

    await db.flush()
    return quiz, questions


async def create_game_session_with_responses(
    db,
    quiz: Quiz,
    questions: List[QuizQuestion],
    teacher: User,
    students: List[User],
    game_code: str,
    is_demo_session: bool = False,
) -> GameSession:
    """Create a game session with player responses."""
    now = datetime.now(timezone.utc)

    # Determine status based on whether this is the demo session
    if is_demo_session:
        status = "lobby"
        started_at = None
        ended_at = None
    else:
        status = "finished"
        started_at = now - timedelta(hours=random.randint(1, 48))
        ended_at = started_at + timedelta(minutes=random.randint(15, 45))

    game = GameSession(
        id=uuid.uuid4(),
        quiz_id=quiz.id,
        host_id=teacher.id,
        game_code=game_code,
        status=status,
        current_question_index=-1 if is_demo_session else len(questions) - 1,
        sync_mode=True,
        show_leaderboard_after_each=True,
        show_correct_answer=True,
        show_answer_distribution=True,
        started_at=started_at,
        ended_at=ended_at,
    )
    db.add(game)
    await db.flush()

    # Create players and responses
    for student in students:
        profile = next((p for p in STUDENT_PROFILES if p["name"] == student.name), None)
        if not profile:
            continue

        player = Player(
            id=uuid.uuid4(),
            game_id=game.id,
            user_id=student.id,
            nickname=student.name.split()[0],  # First name
            total_score=0,
            correct_answers=0,
            current_streak=0,
            is_active=True,
        )
        db.add(player)
        await db.flush()

        # Generate responses based on student profile
        total_score = 0
        correct_count = 0
        streak = 0

        if not is_demo_session:  # Only add responses for completed games
            for question in questions:
                accuracy = random.uniform(*profile["accuracy_range"])
                is_correct = random.random() < accuracy
                confidence = random.randint(*profile["confidence_range"])

                if is_correct:
                    answer = question.correct_answer
                    correct_count += 1
                    streak += 1
                    # Points: base + speed bonus + streak bonus
                    points = int(question.points * (0.5 + random.random() * 0.5) + (streak * 100))
                    total_score += points
                else:
                    # Pick a wrong answer
                    wrong_options = [k for k in question.options.keys() if k != question.correct_answer]
                    answer = random.choice(wrong_options)
                    streak = 0
                    points = 0

                response_time = random.randint(2000, 25000)  # 2-25 seconds

                player_answer = PlayerAnswer(
                    id=uuid.uuid4(),
                    player_id=player.id,
                    question_id=question.id,
                    answer=answer,
                    is_correct=is_correct,
                    response_time_ms=response_time,
                    points_earned=points,
                    confidence=confidence,
                    reasoning=f"I chose {answer} because..." if random.random() > 0.5 else None,
                )
                db.add(player_answer)

            # Update player stats
            player.total_score = total_score
            player.correct_answers = correct_count
            player.current_streak = streak

    await db.flush()
    return game


async def create_concept_mastery_data(
    db,
    students: List[User],
    concepts: List[str],
):
    """Create concept mastery records for students."""
    for student in students:
        profile = next((p for p in STUDENT_PROFILES if p["name"] == student.name), None)
        if not profile:
            continue

        for concept in concepts:
            # Higher performers have higher mastery
            if profile["level"] == "high":
                mastery = random.uniform(70, 95)
                correct = random.randint(15, 20)
            elif profile["level"] == "medium":
                mastery = random.uniform(45, 70)
                correct = random.randint(8, 15)
            else:
                mastery = random.uniform(20, 45)
                correct = random.randint(3, 8)

            total = 20

            mastery_record = ConceptMastery(
                id=uuid.uuid4(),
                student_name=student.name,
                student_id=student.id,
                concept=concept,
                mastery_score=mastery,
                total_attempts=total,
                correct_attempts=correct,
                last_seen_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 72)),
                next_review_at=datetime.now(timezone.utc) + timedelta(days=random.randint(1, 7)),
            )
            db.add(mastery_record)

    await db.flush()


async def create_student_misconceptions(
    db,
    students: List[User],
    misconceptions: List[Dict],
):
    """Create student misconception records."""
    for student in students:
        profile = next((p for p in STUDENT_PROFILES if p["name"] == student.name), None)
        if not profile:
            continue

        # Low performers have more misconceptions
        if profile["level"] == "low":
            num_misconceptions = random.randint(3, 5)
        elif profile["level"] == "medium":
            num_misconceptions = random.randint(1, 3)
        else:
            num_misconceptions = random.randint(0, 1)

        selected = random.sample(misconceptions, min(num_misconceptions, len(misconceptions)))

        for m in selected:
            misconception = StudentMisconception(
                id=uuid.uuid4(),
                student_name=student.name,
                student_id=student.id,
                concept=m["topic"],
                misconception=m["misconception"],
                occurrence_count=random.randint(1, 5),
                is_resolved=random.random() > 0.7,
                first_seen_at=datetime.now(timezone.utc) - timedelta(days=random.randint(7, 30)),
                last_seen_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 7)),
            )
            db.add(misconception)

    await db.flush()


async def create_global_misconceptions(
    db,
    teacher: User,
    misconceptions_data: List[Dict],
):
    """Create global misconception records."""
    for m_data in misconceptions_data:
        misconception = Misconception(
            id=uuid.uuid4(),
            creator_id=teacher.id,
            topic=m_data["topic"],
            misconception=m_data["misconception"],
            description=m_data["description"],
            affected_count=random.randint(5, 15),
            total_count=15,
            severity=m_data["severity"],
            common_wrong_answer=m_data["common_wrong_answer"],
            suggested_intervention=m_data["suggested_intervention"],
            is_active=True,
        )
        db.add(misconception)

    await db.flush()


async def create_exit_tickets(
    db,
    students: List[User],
    game_id: uuid.UUID,
):
    """Create sample exit tickets for students."""
    concepts = ["Recursion", "Limits", "Electric Fields"]

    for student in students[:5]:  # Create for first 5 students
        concept = random.choice(concepts)

        ticket = ExitTicket(
            id=uuid.uuid4(),
            student_id=student.id,
            student_name=student.name,
            game_id=game_id,
            target_concept=concept,
            session_accuracy=random.uniform(0.4, 0.8),
            micro_lesson=f"Let's review {concept}. The key insight is...",
            encouragement="You're making good progress! Keep practicing.",
            question_prompt=f"Based on what we learned about {concept}, what would happen if...?",
            question_options=["A. Option A", "B. Option B", "C. Option C", "D. Option D"],
            correct_answer="B",
            hint="Think about the fundamental principle.",
            practice_questions=[
                {
                    "prompt": "Follow-up question 1",
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": "A",
                    "explanation": "Because..."
                }
            ],
            study_notes={
                "key_concepts": [f"{concept} is fundamental because..."],
                "common_mistakes": ["Don't forget to check the base case"],
                "strategies": ["Start by identifying the pattern"],
                "memory_tips": ["Remember: ABC - Always Begin with the base Case"]
            },
            flashcards=[
                {"front": f"What is {concept}?", "back": f"{concept} is..."}
            ],
            is_completed=random.choice([True, False]),
        )
        db.add(ticket)

    await db.flush()


async def create_peer_discussions(
    db,
    students: List[User],
    game_id: uuid.UUID,
):
    """Create sample peer discussion sessions."""
    for student in students[:3]:  # Create for first 3 students
        discussion = PeerDiscussionSession(
            id=uuid.uuid4(),
            student_id=student.id,
            student_name=student.name,
            game_id=game_id,
            question_index=0,
            question_text="What is the base case for factorial?",
            question_options={"A": "n == 0", "B": "n < 0", "C": "n > 100", "D": "n == n-1"},
            correct_answer="A",
            student_answer="D",
            student_confidence=75,
            student_reasoning="I thought the base case is when n equals n-1",
            was_correct=False,
            peer_type="ai",
            peer_name="Study Buddy",
            transcript=[
                {"sender": "student", "content": "I think D is correct because...", "timestamp": datetime.now(timezone.utc).isoformat()},
                {"sender": "ai", "content": "Interesting! Let's think about what happens when we call factorial(5)...", "timestamp": datetime.now(timezone.utc).isoformat()},
                {"sender": "student", "content": "Oh, I see! It would never stop if we used D.", "timestamp": datetime.now(timezone.utc).isoformat()},
            ],
            message_count=3,
            summary="Student initially confused the base case with the recursive step. Through guided discussion, they understood that n==n-1 can never be true and the base case must stop the recursion.",
            key_insights=["Understood difference between base case and recursive step"],
            misconceptions_identified=[{"type": "base_case_confusion", "description": "Confused termination condition"}],
            learning_moments=["Realized n==n-1 is always false"],
            understanding_improved=True,
            status="completed",
            probing_depth=3,
            probing_questions_asked=2,
            hints_given=1,
            misconceptions_detected=[{"type": "base_case_confusion", "resolved": True}],
            misconceptions_resolved=1,
            phases_visited=["probing", "hinting", "explaining"],
            final_phase="explaining",
            duration_seconds=180,
        )
        db.add(discussion)

    await db.flush()


async def seed_demo_data():
    """Main function to seed all demo data."""
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check idempotency
        if await check_demo_exists(db):
            print("Demo data already exists. Skipping...")
            print("To reseed, delete the existing demo teacher first.")
            return

        print("Seeding demo data...")

        # Create teachers
        print("  Creating teachers...")
        demo_teacher, empty_teacher = await create_teachers(db)

        # Create students
        print("  Creating students...")
        students = await create_students(db, STUDENT_PROFILES)

        # Create courses, quizzes, and game sessions
        all_concepts = []
        all_quizzes = []

        for course_data in COURSES_DATA:
            print(f"  Creating course: {course_data['code']}...")
            course = await create_course_structure(db, demo_teacher, course_data, students)

            # Create quizzes for this course
            for quiz_data in course_data.get("quizzes", []):
                quiz, questions = await create_quiz_with_questions(db, demo_teacher, course, quiz_data)
                all_quizzes.append((quiz, questions))

                # Collect concepts
                for q in quiz_data["questions"]:
                    if "concept" in q and q["concept"] not in all_concepts:
                        all_concepts.append(q["concept"])

                # Create a completed game session for this quiz
                game_code = f"{course_data['code']}{random.randint(100, 999)}"
                await create_game_session_with_responses(
                    db, quiz, questions, demo_teacher, students, game_code, is_demo_session=False
                )

        # Create the special DEMO2026 session with the first quiz
        if all_quizzes:
            print(f"  Creating demo game session (code: {DEMO_GAME_CODE})...")
            demo_quiz, demo_questions = all_quizzes[0]
            demo_game = await create_game_session_with_responses(
                db, demo_quiz, demo_questions, demo_teacher, students,
                DEMO_GAME_CODE, is_demo_session=True
            )

            # Create exit tickets and peer discussions for demo game
            print("  Creating exit tickets...")
            await create_exit_tickets(db, students, demo_game.id)

            print("  Creating peer discussion sessions...")
            await create_peer_discussions(db, students, demo_game.id)

        # Create concept mastery data
        print("  Creating concept mastery data...")
        await create_concept_mastery_data(db, students, all_concepts)

        # Create student misconceptions
        print("  Creating student misconceptions...")
        await create_student_misconceptions(db, students, MISCONCEPTIONS_DATA)

        # Create global misconceptions
        print("  Creating global misconceptions...")
        await create_global_misconceptions(db, demo_teacher, MISCONCEPTIONS_DATA)

        await db.commit()

        print("\n" + "=" * 50)
        print("Demo data seeded successfully!")
        print("=" * 50)
        print(f"\nTeachers created:")
        print(f"  - {demo_teacher.name} ({demo_teacher.email})")
        print(f"  - {empty_teacher.name} ({empty_teacher.email})")
        print(f"\nStudents created: {len(students)}")
        print(f"  - High performers: 5")
        print(f"  - Medium performers: 6")
        print(f"  - Low performers: 4")
        print(f"\nCourses created: {len(COURSES_DATA)}")
        for c in COURSES_DATA:
            print(f"  - {c['code']}: {c['name']}")
        print(f"\nQuizzes created: {len(all_quizzes)}")
        print(f"\nDemo game session ready:")
        print(f"  - Join code: {DEMO_GAME_CODE}")
        print(f"  - Status: lobby (waiting for students)")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())

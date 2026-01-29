"""
Pytest Configuration and Fixtures

Provides shared fixtures for all Quizly backend tests.
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Set test environment variables BEFORE importing app modules
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["TESTING"] = "true"
os.environ["GEMINI_API_KEY"] = ""  # Disable AI during tests
os.environ["CLERK_SECRET_KEY"] = ""  # Disable Clerk auth during tests

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, get_db
from app.main import app


# ==============================================================================
# Event Loop Fixtures
# ==============================================================================

@pytest.fixture(scope="session")
def anyio_backend():
    """Use asyncio as the async backend."""
    return "asyncio"


@pytest.fixture(scope="session")
def event_loop():
    """
    Create an event loop for the test session.

    This is required for session-scoped async fixtures.
    """
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


# ==============================================================================
# Database Fixtures
# ==============================================================================

@pytest.fixture(scope="session")
def test_db_url():
    """Return the test database URL (in-memory SQLite)."""
    return "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def engine(test_db_url):
    """Create a test database engine for the entire test session."""
    test_engine = create_async_engine(
        test_db_url,
        echo=False,
        future=True,
    )

    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield test_engine

    # Cleanup
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Create a fresh database session for each test.

    Tables are created/dropped for each test to ensure isolation.
    """
    # Create a new session factory
    SessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Drop and recreate tables for test isolation
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Provide the session
    async with SessionLocal() as session:
        yield session


# ==============================================================================
# HTTP Client Fixtures
# ==============================================================================

@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Create an async HTTP client for testing API endpoints.

    Uses httpx.AsyncClient with ASGITransport to communicate
    directly with the FastAPI app without starting a server.
    """
    async def override_get_db():
        """Override the database dependency with test session."""
        yield db_session

    # Override the dependency
    app.dependency_overrides[get_db] = override_get_db

    # Create the test client
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client

    # Clear overrides after test
    app.dependency_overrides.clear()


# ==============================================================================
# Sample Data Fixtures
# ==============================================================================

@pytest.fixture
def demo_teacher_data() -> dict:
    """Return sample teacher user data for testing."""
    return {
        "id": str(uuid.uuid4()),
        "email": "teacher@test.quizly.com",
        "name": "Test Teacher",
        "role": "teacher",
        "clerk_user_id": f"user_test_teacher_{uuid.uuid4().hex[:8]}",
    }


@pytest.fixture
def demo_student_data() -> dict:
    """Return sample student user data for testing."""
    return {
        "id": str(uuid.uuid4()),
        "email": "student@test.quizly.com",
        "name": "Test Student",
        "role": "student",
        "clerk_user_id": f"user_test_student_{uuid.uuid4().hex[:8]}",
    }


@pytest.fixture
def demo_quiz_data() -> dict:
    """Return sample quiz data for testing."""
    return {
        "title": "Test Quiz",
        "description": "A quiz for testing purposes",
        "is_public": False,
        "questions": [
            {
                "prompt": "What is 2 + 2?",
                "options": ["A. 3", "B. 4", "C. 5", "D. 6"],
                "correct_answer": "B",
                "explanation": "2 + 2 equals 4",
                "difficulty": 0.3,
            },
            {
                "prompt": "What is the capital of France?",
                "options": ["A. London", "B. Berlin", "C. Paris", "D. Madrid"],
                "correct_answer": "C",
                "explanation": "Paris is the capital of France",
                "difficulty": 0.2,
            },
            {
                "prompt": "Which planet is known as the Red Planet?",
                "options": ["A. Venus", "B. Jupiter", "C. Mars", "D. Saturn"],
                "correct_answer": "C",
                "explanation": "Mars appears red due to iron oxide on its surface",
                "difficulty": 0.4,
            },
        ],
    }


@pytest.fixture
def demo_course_data() -> dict:
    """Return sample course data for testing."""
    return {
        "name": "Test Course",
        "description": "A course for testing purposes",
        "is_published": True,
        "is_public": False,
        "tags": ["test", "demo"],
        "difficulty_level": "beginner",
        "estimated_hours": 10,
    }


@pytest.fixture
def demo_game_session_data() -> dict:
    """Return sample game session data for testing."""
    return {
        "status": "waiting",
        "current_question_index": 0,
        "settings": {
            "show_leaderboard": True,
            "time_per_question": 30,
            "allow_late_join": True,
        },
    }

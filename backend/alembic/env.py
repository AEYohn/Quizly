"""
Alembic environment configuration for async SQLAlchemy.
Supports both SQLite (dev) and PostgreSQL (prod).
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Load .env so DATABASE_URL is available
load_dotenv()

# Add project root to path so app modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Alembic Config object
config = context.config

# Set up loggers from ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ─── Resolve database URL ───
database_url = os.getenv("DATABASE_URL")
if not database_url:
    database_url = "sqlite+aiosqlite:///./sql_app.db"
else:
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgresql://") and "+" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    if "sslmode" not in database_url:
        separator = "&" if "?" in database_url else "?"
        database_url += f"{separator}sslmode=disable"

config.set_main_option("sqlalchemy.url", database_url)

# ─── Import all models so autogenerate can detect them ───
from app.database import Base  # noqa: E402
from app.db_models import (  # noqa: E402, F401
    User, Course, CourseModule, ModuleItem, CourseEnrollment, StudentProgress,
    Session, Question, Response, SessionParticipant, SessionLike,
    ConceptMastery, StudentMisconception, DiscussionLog, SpacedRepetitionItem,
    CodingProblem, TestCase, CodeSubmission, Misconception,
    StudyItem, FlashcardDeck, Flashcard, StudyNote, GameContent,
    Collection, CollectionItem, LibraryStudySession,
    SyllabusCache, SubjectResource, LearningSession, CodebaseAnalysis,
)
from app.models.game import Quiz, QuizQuestion, GameSession, Player, PlayerAnswer  # noqa: E402, F401
from app.db_models_learning import (  # noqa: E402, F401
    ExitTicket, DetailedMisconception, AdaptiveLearningState,
    PeerDiscussionSession, DebateSession, StudentAssignment,
)
from app.db_models_content_pool import ContentItem, UserContentInteraction, UserTopicPreference  # noqa: E402, F401
from app.db_models_assessment import FamiliarityAssessment  # noqa: E402, F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (SQL script output)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # Required for SQLite ALTER TABLE support
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Configure context and run migrations with a connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,  # Required for SQLite ALTER TABLE support
        compare_type=True,  # Detect column type changes
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online migrations — runs async."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

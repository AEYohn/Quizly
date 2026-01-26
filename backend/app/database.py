"""
Database Configuration
SQLAlchemy async setup for PostgreSQL with Railway.
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData

# Naming convention for constraints (Alembic-friendly)
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    """Base class for all models."""
    metadata = metadata


# Database URL from environment
# Default to SQLite for local development, use DATABASE_URL env var for production (PostgreSQL)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Local development: use SQLite
    # Use a simple relative path without URL encoding
    DATABASE_URL = "sqlite+aiosqlite:///./sql_app.db"
else:
    # Production: handle Railway's postgres:// prefix
    # Use psycopg async driver which handles SSL better
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://") and "+" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

    # Add sslmode=disable for Railway PostgreSQL
    if "sslmode" not in DATABASE_URL:
        separator = "&" if "?" in DATABASE_URL else "?"
        DATABASE_URL += f"{separator}sslmode=disable"

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("DEBUG", "false").lower() == "true",
    pool_pre_ping=True,
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """Dependency to get database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


def run_migrations(conn):
    """Add missing columns to existing tables (for schema updates)."""
    from sqlalchemy import text
    import sys

    print("🔄 Running database migrations...", flush=True)

    # Check if we're using PostgreSQL (skip for SQLite)
    dialect = conn.dialect.name
    print(f"   Database dialect: {dialect}", flush=True)
    if dialect != "postgresql":
        print("   Skipping migrations (SQLite mode)", flush=True)
        return

    # Columns to add to the quizzes table
    quiz_columns = [
        ("timer_enabled", "BOOLEAN", "FALSE"),
        ("default_time_limit", "INTEGER", "30"),
        ("shuffle_questions", "BOOLEAN", "FALSE"),
        ("shuffle_answers", "BOOLEAN", "FALSE"),
        ("allow_retries", "BOOLEAN", "TRUE"),
        ("max_retries", "INTEGER", "0"),
        ("show_correct_answer", "BOOLEAN", "TRUE"),
        ("show_explanation", "BOOLEAN", "TRUE"),
        ("show_distribution", "BOOLEAN", "FALSE"),
        ("difficulty_adaptation", "BOOLEAN", "TRUE"),
        ("peer_discussion_enabled", "BOOLEAN", "TRUE"),
        ("peer_discussion_trigger", "VARCHAR(50)", "'high_confidence_wrong'"),
        ("allow_teacher_intervention", "BOOLEAN", "TRUE"),
        ("sync_pacing_available", "BOOLEAN", "FALSE"),
    ]

    for col_name, col_type, default_val in quiz_columns:
        try:
            check_sql = text(f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'quizzes' AND column_name = '{col_name}'
            """)
            result = conn.execute(check_sql)
            if result.fetchone() is None:
                alter_sql = text(f"ALTER TABLE quizzes ADD COLUMN {col_name} {col_type} DEFAULT {default_val}")
                conn.execute(alter_sql)
                print(f"   Added column 'quizzes.{col_name}'", flush=True)
        except Exception as e:
            print(f"   Migration warning for quizzes.{col_name}: {e}", flush=True)

    # Columns to add to player_answers table
    player_answer_columns = [
        ("confidence", "INTEGER"),
        ("reasoning", "TEXT"),
        ("misconception_data", "JSONB"),
    ]

    for col_name, col_type in player_answer_columns:
        try:
            check_sql = text(f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'player_answers' AND column_name = '{col_name}'
            """)
            result = conn.execute(check_sql)
            if result.fetchone() is None:
                alter_sql = text(f"ALTER TABLE player_answers ADD COLUMN {col_name} {col_type}")
                conn.execute(alter_sql)
                print(f"   Added column 'player_answers.{col_name}'", flush=True)
        except Exception as e:
            print(f"   Migration warning for player_answers.{col_name}: {e}", flush=True)

    print("✅ Migrations complete", flush=True)


async def init_db():
    """Create all tables and run migrations."""
    # Import all models so they're registered with Base
    from .db_models import User, Course, Session, Question, Response  # noqa
    from .models.game import Quiz, QuizQuestion, GameSession, Player, PlayerAnswer  # noqa
    # Import learning models for exit tickets, misconceptions, etc.
    from .db_models_learning import ExitTicket, DetailedMisconception, AdaptiveLearningState, DebateSession, PeerDiscussionSession  # noqa

    async with engine.begin() as conn:
        # Create tables that don't exist
        print("   Creating tables...", flush=True)
        await conn.run_sync(Base.metadata.create_all)
        print("   Tables ready", flush=True)
        # Add missing columns to existing tables
        try:
            await conn.run_sync(run_migrations)
        except Exception as e:
            print(f"   Migration error: {e}", flush=True)
            raise


async def close_db():
    """Close database connections."""
    await engine.dispose()

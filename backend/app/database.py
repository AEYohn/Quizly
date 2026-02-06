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

# Engine kwargs
_engine_kwargs: dict = {
    "echo": os.getenv("DEBUG", "false").lower() == "true",
    "pool_pre_ping": True,
}

# SQLite-specific: enable WAL mode + busy timeout to prevent "database is locked"
_is_sqlite = DATABASE_URL.startswith("sqlite")
if _is_sqlite:
    from sqlalchemy import event as _sa_event

    _engine_kwargs["connect_args"] = {"timeout": 30}  # 30s busy timeout

# Create async engine
engine = create_async_engine(DATABASE_URL, **_engine_kwargs)

# Enable WAL mode for SQLite (much better concurrent read/write)
if _is_sqlite:
    @_sa_event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

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

    print("🔄 Running database migrations...", flush=True)

    # Check database dialect
    dialect = conn.dialect.name
    print(f"   Database dialect: {dialect}", flush=True)
    is_sqlite = dialect == "sqlite"

    def column_exists(table_name: str, column_name: str) -> bool:
        """Check if a column exists in a table (works for both SQLite and PostgreSQL)."""
        if is_sqlite:
            result = conn.execute(text(f"PRAGMA table_info({table_name})"))
            columns = [row[1] for row in result.fetchall()]
            return column_name in columns
        else:
            result = conn.execute(text(f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = '{table_name}' AND column_name = '{column_name}'
            """))
            return result.fetchone() is not None

    def get_type(pg_type: str) -> str:
        """Convert PostgreSQL type to SQLite type if needed."""
        if is_sqlite:
            type_map = {
                "BOOLEAN": "INTEGER",
                "JSONB": "TEXT",
                "VARCHAR(50)": "TEXT",
                "VARCHAR(255)": "TEXT",
            }
            return type_map.get(pg_type, pg_type)
        return pg_type

    def get_default(default_val: str) -> str:
        """Convert default value for SQLite if needed."""
        if is_sqlite:
            # SQLite uses 0/1 for booleans
            val_map = {
                "FALSE": "0",
                "TRUE": "1",
                "'{}'::jsonb": "'{}'",
                "'[]'::jsonb": "'[]'",
            }
            return val_map.get(default_val, default_val)
        return default_val

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
        ("quiz_type", "VARCHAR(50)", "'teacher'"),  # "teacher" or "self_study"
    ]

    for col_name, col_type, default_val in quiz_columns:
        try:
            if not column_exists("quizzes", col_name):
                sql_type = get_type(col_type)
                sql_default = get_default(default_val)
                alter_sql = text(f"ALTER TABLE quizzes ADD COLUMN {col_name} {sql_type} DEFAULT {sql_default}")
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
            if not column_exists("player_answers", col_name):
                sql_type = get_type(col_type)
                alter_sql = text(f"ALTER TABLE player_answers ADD COLUMN {col_name} {sql_type}")
                conn.execute(alter_sql)
                print(f"   Added column 'player_answers.{col_name}'", flush=True)
        except Exception as e:
            print(f"   Migration warning for player_answers.{col_name}: {e}", flush=True)

    # Columns to add to exit_tickets table
    exit_ticket_columns = [
        ("practice_questions", "JSONB", "'{}'::jsonb"),
        ("study_notes", "JSONB", "'{}'::jsonb"),
        ("flashcards", "JSONB", "'[]'::jsonb"),
        ("misconceptions", "JSONB", "'[]'::jsonb"),
    ]

    for col_name, col_type, default_val in exit_ticket_columns:
        try:
            if not column_exists("exit_tickets", col_name):
                sql_type = get_type(col_type)
                sql_default = get_default(default_val)
                alter_sql = text(f"ALTER TABLE exit_tickets ADD COLUMN {col_name} {sql_type} DEFAULT {sql_default}")
                conn.execute(alter_sql)
                print(f"   Added column 'exit_tickets.{col_name}'", flush=True)
        except Exception as e:
            print(f"   Migration warning for exit_tickets.{col_name}: {e}", flush=True)

    # Columns to add to users table (Clerk auth integration)
    user_columns = [
        ("clerk_user_id", "VARCHAR(255)"),
    ]

    for col_name, col_type in user_columns:
        try:
            if not column_exists("users", col_name):
                sql_type = get_type(col_type)
                alter_sql = text(f"ALTER TABLE users ADD COLUMN {col_name} {sql_type}")
                conn.execute(alter_sql)
                # Add unique index for clerk_user_id
                if col_name == "clerk_user_id":
                    index_sql = text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_clerk_user_id ON users(clerk_user_id)")
                    conn.execute(index_sql)
                print(f"   Added column 'users.{col_name}'", flush=True)
        except Exception as e:
            print(f"   Migration warning for users.{col_name}: {e}", flush=True)

    # Columns to add to module_items table (quiz_id for linking to quizzes table)
    module_item_columns = [
        ("quiz_id", "UUID"),
    ]

    for col_name, col_type in module_item_columns:
        try:
            if not column_exists("module_items", col_name):
                sql_type = get_type(col_type)
                alter_sql = text(f"ALTER TABLE module_items ADD COLUMN {col_name} {sql_type}")
                conn.execute(alter_sql)
                print(f"   Added column 'module_items.{col_name}'", flush=True)
        except Exception as e:
            print(f"   Migration warning for module_items.{col_name}: {e}", flush=True)

    print("✅ Migrations complete", flush=True)


async def init_db():
    """Initialize database: run Alembic migrations, then create any missing tables."""
    # Import all models so they're registered with Base
    from .db_models import User, Course, Session, Question, Response  # noqa
    from .models.game import Quiz, QuizQuestion, GameSession, Player, PlayerAnswer  # noqa
    from .db_models_learning import ExitTicket, DetailedMisconception, AdaptiveLearningState, DebateSession, PeerDiscussionSession, StudentAssignment  # noqa
    from .db_models_content_pool import ContentItem, UserContentInteraction, UserTopicPreference  # noqa
    from .db_models_assessment import FamiliarityAssessment  # noqa

    # Run Alembic migrations via subprocess (avoids nested event loop issues)
    import subprocess
    import os

    backend_dir = os.path.dirname(os.path.dirname(__file__))
    try:
        print("   Running Alembic migrations...", flush=True)
        result = subprocess.run(
            ["python", "-m", "alembic", "upgrade", "head"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            print("   Alembic migrations complete", flush=True)
        else:
            print(f"   Alembic migration note: {result.stderr.strip()}", flush=True)
            # Fall back to create_all if Alembic fails
            async with engine.begin() as conn:
                print("   Falling back to create_all...", flush=True)
                await conn.run_sync(Base.metadata.create_all)
                print("   Tables created via create_all", flush=True)
    except Exception as e:
        print(f"   Alembic migration note: {e}", flush=True)
        async with engine.begin() as conn:
            print("   Falling back to create_all...", flush=True)
            await conn.run_sync(Base.metadata.create_all)
            print("   Tables created via create_all", flush=True)

    # Run legacy column migrations for backwards compatibility
    async with engine.begin() as conn:
        try:
            await conn.run_sync(run_migrations)
        except Exception as e:
            print(f"   Legacy migration note: {e}", flush=True)


async def close_db():
    """Close database connections."""
    await engine.dispose()

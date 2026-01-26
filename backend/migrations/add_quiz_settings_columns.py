"""
Migration script to add async-first quiz settings columns to the quizzes table.

Run this script manually on Railway:
  python migrations/add_quiz_settings_columns.py

This adds columns that were missing from the production database.
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Get database URL from environment
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set")
    exit(1)

# Convert postgres:// to postgresql+psycopg:// (matching database.py)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# Add sslmode=disable for Railway PostgreSQL
if "sslmode" not in DATABASE_URL:
    separator = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL += f"{separator}sslmode=disable"


async def run_migration():
    engine = create_async_engine(DATABASE_URL, echo=True)

    # Columns to add to the quizzes table
    # Format: (column_name, column_type, default_value)
    columns_to_add = [
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

    async with engine.begin() as conn:
        for col_name, col_type, default_val in columns_to_add:
            try:
                # Check if column exists
                check_sql = text(f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'quizzes' AND column_name = '{col_name}'
                """)
                result = await conn.execute(check_sql)
                exists = result.fetchone() is not None

                if exists:
                    print(f"Column '{col_name}' already exists, skipping...")
                else:
                    # Add column with default value
                    alter_sql = text(f"""
                        ALTER TABLE quizzes
                        ADD COLUMN {col_name} {col_type} DEFAULT {default_val}
                    """)
                    await conn.execute(alter_sql)
                    print(f"Added column '{col_name}' ({col_type}) with default {default_val}")
            except Exception as e:
                print(f"Error adding column '{col_name}': {e}")

    # Also add columns to player_answers table for adaptive learning
    player_answer_columns = [
        ("confidence", "INTEGER", "NULL"),
        ("reasoning", "TEXT", "NULL"),
        ("misconception_data", "JSONB", "NULL"),
    ]

    print("\nAdding player_answers columns...")
    async with engine.begin() as conn:
        for col_name, col_type, default_val in player_answer_columns:
            try:
                check_sql = text(f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'player_answers' AND column_name = '{col_name}'
                """)
                result = await conn.execute(check_sql)
                exists = result.fetchone() is not None

                if exists:
                    print(f"Column '{col_name}' already exists, skipping...")
                else:
                    if default_val == "NULL":
                        alter_sql = text(f"""
                            ALTER TABLE player_answers
                            ADD COLUMN {col_name} {col_type}
                        """)
                    else:
                        alter_sql = text(f"""
                            ALTER TABLE player_answers
                            ADD COLUMN {col_name} {col_type} DEFAULT {default_val}
                        """)
                    await conn.execute(alter_sql)
                    print(f"Added column '{col_name}' ({col_type})")
            except Exception as e:
                print(f"Error adding column '{col_name}': {e}")

    print("\nMigration complete!")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_migration())

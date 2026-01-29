"""
Migration script to add adaptive discussion tracking columns to peer_discussion_sessions table.

Run this script manually on Railway:
  python migrations/add_adaptive_discussion_fields.py

This adds columns for:
- Initial assessment (error_type, probing_depth)
- Probing phase tracking
- Hint tracking (auto vs requested)
- Stuck detection
- Misconception tracking
- Phase progression
- Student journey tracking
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

    # Columns to add to the peer_discussion_sessions table
    # Format: (column_name, column_type, default_value or NULL)
    columns_to_add = [
        # Initial assessment
        ("error_type", "VARCHAR(50)", "NULL"),
        ("probing_depth", "INTEGER", "3"),

        # Probing phase tracking
        ("probing_questions_asked", "INTEGER", "0"),

        # Hint tracking
        ("hints_given", "INTEGER", "0"),
        ("hints_auto", "INTEGER", "0"),
        ("hints_requested", "INTEGER", "0"),

        # Stuck detection
        ("stuck_count", "INTEGER", "0"),
        ("stuck_recoveries", "INTEGER", "0"),

        # Misconception tracking
        ("misconceptions_detected", "JSONB", "'[]'"),
        ("misconceptions_resolved", "INTEGER", "0"),

        # Phase progression
        ("phases_visited", "JSONB", "'[]'"),
        ("final_phase", "VARCHAR(50)", "NULL"),

        # Student journey
        ("confusion_areas", "JSONB", "'[]'"),
        ("student_reasoning_points", "JSONB", "'[]'"),
    ]

    print("Adding adaptive discussion tracking columns to peer_discussion_sessions...")
    async with engine.begin() as conn:
        for col_name, col_type, default_val in columns_to_add:
            try:
                # Check if column exists
                check_sql = text(f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'peer_discussion_sessions' AND column_name = '{col_name}'
                """)
                result = await conn.execute(check_sql)
                exists = result.fetchone() is not None

                if exists:
                    print(f"Column '{col_name}' already exists, skipping...")
                else:
                    # Add column with default value
                    if default_val == "NULL":
                        alter_sql = text(f"""
                            ALTER TABLE peer_discussion_sessions
                            ADD COLUMN {col_name} {col_type}
                        """)
                    else:
                        alter_sql = text(f"""
                            ALTER TABLE peer_discussion_sessions
                            ADD COLUMN {col_name} {col_type} DEFAULT {default_val}
                        """)
                    await conn.execute(alter_sql)
                    print(f"Added column '{col_name}' ({col_type}) with default {default_val}")
            except Exception as e:
                print(f"Error adding column '{col_name}': {e}")

    print("\nMigration complete!")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_migration())

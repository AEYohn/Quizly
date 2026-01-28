"""
Add course_id column to quizzes table.
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "").replace("postgresql://", "postgresql+psycopg://")


async def run_migration():
    if not DATABASE_URL:
        print("DATABASE_URL not set")
        return

    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        # Add course_id column to quizzes table (nullable)
        await conn.execute(text("""
            ALTER TABLE quizzes
            ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
        """))
        print("Added course_id column to quizzes table")

    await engine.dispose()
    print("Migration complete!")


if __name__ == "__main__":
    asyncio.run(run_migration())

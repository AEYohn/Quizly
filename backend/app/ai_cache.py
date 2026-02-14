"""
AI Agent Cache Layer
====================
Shared cache utilities for AI agents to reduce redundant Gemini API calls.

Components:
- cache_key_builder: Deterministic key construction for agent outputs
- CachedPool: Pool-based caching for content needing variety (questions, flashcards)
- TTL constants per content type
"""

import hashlib
import random
from typing import Any, Dict, Optional

from .cache import CacheService
from .logging_config import get_logger

logger = get_logger(__name__)

# --- TTL constants (seconds) ---
TTL_QUESTION_POOL = 7200    # 2h — questions/flashcards need freshness
TTL_FLASHCARD_POOL = 7200   # 2h
TTL_STUDY_NOTES = 14400     # 4h — notes are stable
TTL_INFO_CARD = 14400       # 4h
TTL_MISCONCEPTION = 86400   # 24h — deterministic per Q+A pair

MAX_POOL_SIZE = 8


def _bucket_difficulty(difficulty: float) -> float:
    """Bucket difficulty to 0.3/0.5/0.7 for higher cache hit rates."""
    if difficulty < 0.4:
        return 0.3
    elif difficulty < 0.65:
        return 0.5
    else:
        return 0.7


def hash_context(text: Optional[str]) -> str:
    """Hash rich_context/context to 8-char hex for cache key."""
    if not text or not text.strip():
        return "none"
    return hashlib.md5(text.encode()).hexdigest()[:8]


def cache_key_builder(
    agent: str,
    concept_name: str,
    difficulty: Optional[float] = None,
    question_type: Optional[str] = None,
    context_hash: Optional[str] = None,
) -> str:
    """Build deterministic cache key for agent outputs.

    Example: agent:question:concept:photosynthesis:d:0.5:t:application:ctx:a1b2c3d4
    """
    parts = [f"agent:{agent}", f"concept:{concept_name.lower().strip()}"]
    if difficulty is not None:
        parts.append(f"d:{_bucket_difficulty(difficulty)}")
    if question_type:
        parts.append(f"t:{question_type}")
    if context_hash:
        parts.append(f"ctx:{context_hash}")
    return ":".join(parts)


class CachedPool:
    """Pool-based cache for content that needs variety (questions, flashcards).

    Each pool key maps to a list of items. get_one() picks a random item and
    removes it so repeated calls return unique content. add_to_pool() appends
    new items, capping the list at MAX_POOL_SIZE.
    """

    POOL_PREFIX = "pool"

    @staticmethod
    def _pool_key(key: str) -> str:
        return f"{CachedPool.POOL_PREFIX}:{key}"

    @staticmethod
    async def get_one(key: str) -> Optional[Dict]:
        """Get a random item from the pool and remove it.

        Returns None on cache miss or empty pool.
        """
        pool_key = CachedPool._pool_key(key)
        pool = await CacheService.get(pool_key)
        if not pool or not isinstance(pool, list) or len(pool) == 0:
            return None

        idx = random.randrange(len(pool))
        item = pool.pop(idx)

        # Write back the reduced pool (keep existing TTL approximation)
        if pool:
            await CacheService.set(pool_key, pool, TTL_QUESTION_POOL)
        else:
            await CacheService.delete(pool_key)

        logger.info("cache_pool_hit", extra={"key": key, "remaining": len(pool)})
        return item

    @staticmethod
    async def add_to_pool(key: str, item: Dict, ttl: int = TTL_QUESTION_POOL) -> None:
        """Append an item to the pool, capping at MAX_POOL_SIZE."""
        pool_key = CachedPool._pool_key(key)
        pool = await CacheService.get(pool_key)
        if not pool or not isinstance(pool, list):
            pool = []

        pool.append(item)
        # Cap pool size — drop oldest items
        if len(pool) > MAX_POOL_SIZE:
            pool = pool[-MAX_POOL_SIZE:]

        await CacheService.set(pool_key, pool, ttl)

    @staticmethod
    async def pool_size(key: str) -> int:
        """Check how many items are in the pool."""
        pool_key = CachedPool._pool_key(key)
        pool = await CacheService.get(pool_key)
        if not pool or not isinstance(pool, list):
            return 0
        return len(pool)

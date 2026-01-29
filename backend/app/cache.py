"""
Redis Caching Layer for Quizly

Provides a simple caching abstraction with:
- get_or_set pattern with TTL
- Graceful fallback when Redis unavailable
- JSON serialization for complex objects
"""

import os
import json
from typing import Any, Callable, Optional, TypeVar

T = TypeVar("T")

# Redis client (lazy initialized)
_redis_client = None
_redis_available = None


async def _get_redis():
    """Get or create Redis client."""
    global _redis_client, _redis_available

    if _redis_available is False:
        return None

    if _redis_client is not None:
        return _redis_client

    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        _redis_available = False
        return None

    try:
        import redis.asyncio as redis_lib
        _redis_client = redis_lib.from_url(redis_url, decode_responses=True)
        await _redis_client.ping()
        _redis_available = True
        return _redis_client
    except Exception as e:
        print(f"Redis cache unavailable: {e}")
        _redis_available = False
        return None


class CacheService:
    """Redis-backed caching service with graceful fallback."""

    # Default TTLs (in seconds)
    TTL_SHORT = 10       # Leaderboard snapshots
    TTL_MEDIUM = 300     # Teacher profiles (5 min)
    TTL_LONG = 3600      # Quiz questions (1 hour)

    @staticmethod
    async def get(key: str) -> Optional[Any]:
        """Get a value from cache."""
        redis = await _get_redis()
        if not redis:
            return None

        try:
            value = await redis.get(f"quizly:{key}")
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None

    @staticmethod
    async def set(key: str, value: Any, ttl: int = 300) -> bool:
        """Set a value in cache with TTL."""
        redis = await _get_redis()
        if not redis:
            return False

        try:
            await redis.setex(
                f"quizly:{key}",
                ttl,
                json.dumps(value, default=str)
            )
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    @staticmethod
    async def delete(key: str) -> bool:
        """Delete a value from cache."""
        redis = await _get_redis()
        if not redis:
            return False

        try:
            await redis.delete(f"quizly:{key}")
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False

    @staticmethod
    async def get_or_set(
        key: str,
        factory: Callable[[], Any],
        ttl: int = 300
    ) -> Any:
        """
        Get value from cache, or compute and cache it.

        Args:
            key: Cache key
            factory: Async function to compute value if not cached
            ttl: Time-to-live in seconds

        Returns:
            Cached or computed value
        """
        # Try cache first
        cached = await CacheService.get(key)
        if cached is not None:
            return cached

        # Compute value
        if callable(factory):
            value = await factory() if hasattr(factory, '__await__') or hasattr(factory, '__call__') else factory
            # Handle both sync and async factories
            import asyncio
            if asyncio.iscoroutine(value):
                value = await value
        else:
            value = factory

        # Cache it
        await CacheService.set(key, value, ttl)

        return value

    @staticmethod
    async def invalidate_pattern(pattern: str) -> int:
        """Invalidate all keys matching a pattern."""
        redis = await _get_redis()
        if not redis:
            return 0

        try:
            keys = []
            async for key in redis.scan_iter(f"quizly:{pattern}"):
                keys.append(key)

            if keys:
                await redis.delete(*keys)
            return len(keys)
        except Exception as e:
            print(f"Cache invalidate error: {e}")
            return 0


# Convenience functions for common cache patterns

async def cache_quiz_questions(quiz_id: str, questions: list) -> bool:
    """Cache quiz questions for 1 hour."""
    return await CacheService.set(
        f"quiz:{quiz_id}:questions",
        questions,
        CacheService.TTL_LONG
    )


async def get_cached_quiz_questions(quiz_id: str) -> Optional[list]:
    """Get cached quiz questions."""
    return await CacheService.get(f"quiz:{quiz_id}:questions")


async def cache_teacher_profile(teacher_id: str, profile: dict) -> bool:
    """Cache teacher profile for 5 minutes."""
    return await CacheService.set(
        f"teacher:{teacher_id}:profile",
        profile,
        CacheService.TTL_MEDIUM
    )


async def get_cached_teacher_profile(teacher_id: str) -> Optional[dict]:
    """Get cached teacher profile."""
    return await CacheService.get(f"teacher:{teacher_id}:profile")


async def cache_leaderboard(game_id: str, leaderboard: list) -> bool:
    """Cache leaderboard snapshot for 10 seconds."""
    return await CacheService.set(
        f"game:{game_id}:leaderboard",
        leaderboard,
        CacheService.TTL_SHORT
    )


async def get_cached_leaderboard(game_id: str) -> Optional[list]:
    """Get cached leaderboard."""
    return await CacheService.get(f"game:{game_id}:leaderboard")


async def invalidate_quiz_cache(quiz_id: str) -> int:
    """Invalidate all cache entries for a quiz."""
    return await CacheService.invalidate_pattern(f"quiz:{quiz_id}:*")


async def invalidate_game_cache(game_id: str) -> int:
    """Invalidate all cache entries for a game."""
    return await CacheService.invalidate_pattern(f"game:{game_id}:*")

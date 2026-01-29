"""
AI Demo Mode Cache
==================
Provides cached AI responses for reliable hackathon demos.
Falls back to cached responses when API is slow/unavailable.

Usage:
    from app.ai_agents.demo_cache import with_demo_fallback

    @with_demo_fallback("question_generator")
    async def generate_questions(topic: str, ...):
        # Real API call
        pass

Environment Variables:
    DEMO_MODE: Set to "true" to always use cached responses
    DEMO_CACHE_TIMEOUT: Timeout in seconds before falling back to cache (default: 3)
"""

import os
import json
import asyncio
import hashlib
import functools
import logging
from pathlib import Path
from typing import Any, Callable, Dict, Optional, TypeVar

logger = logging.getLogger(__name__)

# Type variable for generic return types
T = TypeVar('T')

# Default configuration
DEFAULT_TIMEOUT = 3.0  # seconds
DEMO_RESPONSES_FILE = Path(__file__).parent / "demo_responses.json"


def is_demo_mode() -> bool:
    """Check if demo mode is enabled via environment variable."""
    return os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")


def get_demo_timeout() -> float:
    """Get the demo cache timeout from environment variable."""
    try:
        return float(os.getenv("DEMO_CACHE_TIMEOUT", str(DEFAULT_TIMEOUT)))
    except ValueError:
        return DEFAULT_TIMEOUT


def load_demo_responses() -> Dict[str, Any]:
    """Load the demo responses from JSON file."""
    try:
        if DEMO_RESPONSES_FILE.exists():
            with open(DEMO_RESPONSES_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load demo responses: {e}")
    return {}


def generate_cache_key(func_name: str, **kwargs) -> str:
    """
    Generate a cache key from function name and keyword arguments.

    Args:
        func_name: Name of the AI function
        **kwargs: Key parameters like topic, concept, etc.

    Returns:
        A cache key string
    """
    # Extract relevant parameters for cache key
    key_params = []

    # Common parameters used for cache keys
    for param in ['topic', 'concept', 'concept_name', 'subject', 'difficulty', 'type']:
        if param in kwargs and kwargs[param] is not None:
            value = str(kwargs[param]).lower().strip()
            key_params.append(f"{param}:{value}")

    if key_params:
        params_str = "|".join(sorted(key_params))
        return f"{func_name}:{params_str}"

    # Fallback: hash all kwargs
    kwargs_str = json.dumps(kwargs, sort_keys=True, default=str)
    kwargs_hash = hashlib.md5(kwargs_str.encode()).hexdigest()[:8]
    return f"{func_name}:{kwargs_hash}"


def find_cached_response(cache_key: str, demo_responses: Dict[str, Any]) -> Optional[Any]:
    """
    Find a cached response matching the cache key.

    Supports exact matches and fuzzy matching for topics/concepts.

    Args:
        cache_key: The generated cache key
        demo_responses: Loaded demo responses dictionary

    Returns:
        Cached response data or None
    """
    # Direct match
    if cache_key in demo_responses:
        return demo_responses[cache_key]

    # Parse function name and params from key
    if ':' in cache_key:
        func_name, params = cache_key.split(':', 1)

        # Try to find matching responses for this function
        func_responses = demo_responses.get(func_name, {})

        if isinstance(func_responses, dict):
            # Check for topic/concept matches
            for param_pair in params.split('|'):
                if ':' in param_pair:
                    param_name, param_value = param_pair.split(':', 1)

                    # Look for matching key in func_responses
                    for key, response in func_responses.items():
                        if param_value in key.lower():
                            return response

    return None


def with_demo_fallback(func_name: str):
    """
    Decorator that provides demo fallback for async AI functions.

    When DEMO_MODE=true, always returns cached responses.
    When DEMO_MODE=false, tries real API but falls back to cache on timeout.

    Args:
        func_name: Identifier for caching (e.g., "question_generator")

    Example:
        @with_demo_fallback("question_generator")
        async def generate_questions(topic: str, num_questions: int = 5):
            # Real API implementation
            return await call_gemini_api(...)
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> T:
            demo_responses = load_demo_responses()
            cache_key = generate_cache_key(func_name, **kwargs)

            # Demo mode: always use cache
            if is_demo_mode():
                logger.info(f"[Demo Mode] Using cached response for {cache_key}")
                cached = find_cached_response(cache_key, demo_responses)
                if cached is not None:
                    return cached
                logger.warning(f"[Demo Mode] No cached response found for {cache_key}")
                # Fall through to real call if no cache

            # Normal mode: try real API with timeout fallback
            timeout = get_demo_timeout()

            try:
                # Run the actual function with timeout
                result = await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=timeout
                )
                return result

            except asyncio.TimeoutError:
                logger.warning(f"AI call timed out after {timeout}s, using cache for {cache_key}")
                cached = find_cached_response(cache_key, demo_responses)
                if cached is not None:
                    return cached
                logger.error(f"No cached response available for {cache_key}")
                raise

            except Exception as e:
                logger.warning(f"AI call failed ({type(e).__name__}), trying cache for {cache_key}")
                cached = find_cached_response(cache_key, demo_responses)
                if cached is not None:
                    return cached
                # Re-raise if no cache available
                raise

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> T:
            demo_responses = load_demo_responses()
            cache_key = generate_cache_key(func_name, **kwargs)

            # Demo mode: always use cache
            if is_demo_mode():
                logger.info(f"[Demo Mode] Using cached response for {cache_key}")
                cached = find_cached_response(cache_key, demo_responses)
                if cached is not None:
                    return cached
                logger.warning(f"[Demo Mode] No cached response found for {cache_key}")

            # For sync functions, just call directly (no timeout)
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.warning(f"AI call failed ({type(e).__name__}), trying cache for {cache_key}")
                cached = find_cached_response(cache_key, demo_responses)
                if cached is not None:
                    return cached
                raise

        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


class DemoCache:
    """
    Utility class for managing demo cache operations.

    Provides methods for:
    - Getting cached responses by key
    - Checking cache availability
    - Listing available cached responses
    """

    def __init__(self):
        self._cache: Optional[Dict[str, Any]] = None

    @property
    def cache(self) -> Dict[str, Any]:
        """Lazy-load cache on first access."""
        if self._cache is None:
            self._cache = load_demo_responses()
        return self._cache

    def reload(self) -> None:
        """Force reload of cache from disk."""
        self._cache = load_demo_responses()

    def get(self, func_name: str, **kwargs) -> Optional[Any]:
        """
        Get a cached response.

        Args:
            func_name: Function identifier
            **kwargs: Parameters for cache key generation

        Returns:
            Cached response or None
        """
        cache_key = generate_cache_key(func_name, **kwargs)
        return find_cached_response(cache_key, self.cache)

    def has_cache_for(self, func_name: str, **kwargs) -> bool:
        """Check if a cached response exists."""
        return self.get(func_name, **kwargs) is not None

    def list_cached_functions(self) -> list:
        """List all function names that have cached responses."""
        return list(self.cache.keys())

    def list_cached_keys(self, func_name: str) -> list:
        """List all cache keys for a function."""
        func_data = self.cache.get(func_name, {})
        if isinstance(func_data, dict):
            return list(func_data.keys())
        return []


# Singleton instance for convenience
demo_cache = DemoCache()


# Export commonly used items
__all__ = [
    'with_demo_fallback',
    'is_demo_mode',
    'get_demo_timeout',
    'demo_cache',
    'DemoCache',
    'generate_cache_key',
]

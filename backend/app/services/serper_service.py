"""
Serper Service — Stateless wrapper around Serper.dev search API.

Provides web search and YouTube search with in-memory caching.
No DB dependency — pure API client.
"""

import os
import hashlib
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False


SERPER_API_KEY = os.getenv("SERPER_API_KEY")
SERPER_BASE_URL = "https://google.serper.dev"

# In-memory cache: key -> (timestamp, results)
_cache: Dict[str, tuple] = {}
CACHE_TTL_SECONDS = 7 * 24 * 3600  # 7 days


@dataclass
class SerperResult:
    """Single search result from Serper API."""
    title: str
    url: str
    snippet: str
    source_type: str  # "web", "video"
    thumbnail_url: Optional[str] = None
    duration: Optional[str] = None
    channel: Optional[str] = None
    published_date: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _cache_key(query: str, search_type: str) -> str:
    raw = f"{query}:{search_type}"
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> Optional[List[SerperResult]]:
    if key in _cache:
        ts, results = _cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            return results
        del _cache[key]
    return None


def _set_cached(key: str, results: List[SerperResult]) -> None:
    # Evict oldest entries if cache grows too large
    if len(_cache) > 500:
        oldest_key = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest_key]
    _cache[key] = (time.time(), results)


class SerperService:
    """Stateless Serper.dev API client with caching."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or SERPER_API_KEY
        self.available = bool(self.api_key and HTTPX_AVAILABLE)

    async def web_search(
        self, query: str, num_results: int = 10
    ) -> List[SerperResult]:
        """Search the web via Serper."""
        if not self.available:
            return []

        key = _cache_key(query, "web")
        cached = _get_cached(key)
        if cached is not None:
            return cached[:num_results]

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{SERPER_BASE_URL}/search",
                    headers={
                        "X-API-KEY": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={"q": query, "num": num_results},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            print(f"Serper web search failed: {e}")
            return []

        results = []
        for item in data.get("organic", []):
            results.append(SerperResult(
                title=item.get("title", ""),
                url=item.get("link", ""),
                snippet=item.get("snippet", ""),
                source_type="web",
                published_date=item.get("date"),
            ))

        _set_cached(key, results)
        return results[:num_results]

    async def video_search(
        self, query: str, num_results: int = 10
    ) -> List[SerperResult]:
        """Search YouTube videos via Serper."""
        if not self.available:
            return []

        key = _cache_key(query, "video")
        cached = _get_cached(key)
        if cached is not None:
            return cached[:num_results]

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{SERPER_BASE_URL}/videos",
                    headers={
                        "X-API-KEY": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={"q": query, "num": num_results},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            print(f"Serper video search failed: {e}")
            return []

        results = []
        for item in data.get("videos", []):
            results.append(SerperResult(
                title=item.get("title", ""),
                url=item.get("link", ""),
                snippet=item.get("snippet", ""),
                source_type="video",
                thumbnail_url=item.get("imageUrl") or item.get("thumbnailUrl"),
                duration=item.get("duration"),
                channel=item.get("channel"),
                published_date=item.get("date"),
            ))

        _set_cached(key, results)
        return results[:num_results]

    async def search(
        self,
        query: str,
        search_type: str = "web",
        num_results: int = 10,
    ) -> List[SerperResult]:
        """Unified search dispatcher."""
        if search_type == "video":
            return await self.video_search(query, num_results)
        return await self.web_search(query, num_results)

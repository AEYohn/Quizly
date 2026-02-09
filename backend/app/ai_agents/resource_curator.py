"""
Resource Curator Agent — AI-Powered Learning Resource Curation

Uses Gemini with Google Search grounding to find and curate real learning
resources in a single call. No external search API needed.
"""

import json
import re
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..utils.llm_utils import call_gemini_with_timeout, GEMINI_AVAILABLE

logger = get_logger(__name__)


class ResourceCuratorAgent:
    """
    Curates learning resources using Gemini with Google Search grounding.

    Single-call pipeline:
    1. Gemini searches the web via built-in google_search_retrieval tool
    2. Returns curated, ranked resources with verified URLs
    3. Fallback: return [] when Gemini unavailable
    """

    def __init__(self, api_key: Optional[str] = None):
        self.available = GEMINI_AVAILABLE

    async def curate_resources(
        self,
        concept: str,
        difficulty: float = 0.5,
        max_results: int = 5,
        resource_types: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Curate learning resources for a concept using grounded search.

        Args:
            concept: The concept/topic to find resources for
            difficulty: 0.0-1.0 difficulty level
            max_results: Maximum resources to return
            resource_types: Types to search for (default: video, article, tutorial)

        Returns:
            List of curated resource dicts with title, url, source_type, etc.
        """
        if not self.available:
            return []

        if resource_types is None:
            resource_types = ["video", "article", "tutorial"]

        resources = await self._search_with_grounding(
            concept, difficulty, max_results, resource_types
        )
        return resources

    async def _search_with_grounding(
        self,
        concept: str,
        difficulty: float,
        max_results: int,
        resource_types: List[str],
    ) -> List[Dict[str, Any]]:
        """Call Gemini with google_search_retrieval to find and curate resources."""
        difficulty_label = (
            "beginner" if difficulty < 0.4
            else "intermediate" if difficulty < 0.7
            else "advanced"
        )
        types_str = ", ".join(resource_types)

        prompt = f"""Find the {max_results} best learning resources for this concept.

CONCEPT: {concept}
DIFFICULTY LEVEL: {difficulty_label}
RESOURCE TYPES WANTED: {types_str}

Search for real, currently-available resources: YouTube videos, articles,
tutorials, documentation, and interactive exercises. Prefer well-known
educational sources (Khan Academy, 3Blue1Brown, freeCodeCamp, MIT OCW,
GeeksforGeeks, W3Schools, MDN, official docs, etc).

For each resource, provide:
- title: The actual title of the resource
- url: The real, verified URL
- source_type: One of "video", "article", "tutorial", "documentation", "exercise"
- description: 1-sentence description of why this resource is useful
- difficulty_label: "{difficulty_label}"
- relevance_score: 0.0-1.0 how relevant to the concept

Return ONLY a valid JSON array:
[
    {{
        "title": "Resource Title",
        "url": "https://...",
        "source_type": "video",
        "description": "Why this is useful",
        "difficulty_label": "{difficulty_label}",
        "relevance_score": 0.85
    }}
]

Only include resources you are confident are real and accessible."""

        try:
            from google.genai import types as genai_types

            # Use Google Search grounding — the new SDK supports it natively.
            # Note: response_mime_type (JSON mode) is NOT compatible with
            # google_search tools, so we parse text manually instead.
            response = await call_gemini_with_timeout(
                prompt,
                tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                context={"agent": "resource_curator", "operation": "search_with_grounding"},
            )
            if response is None:
                return []

            resources = self._parse_response(response, difficulty_label, max_results)

            # Merge grounding metadata URLs if available
            grounding_urls = self._extract_grounding_urls(response)
            if grounding_urls:
                self._enrich_with_grounding(resources, grounding_urls)

            return resources

        except Exception as e:
            capture_exception(e, context={"service": "resource_curator", "operation": "search_with_grounding"})
            log_error(logger, "search_with_grounding failed", error=str(e))
            return []

    def _is_valid_url(self, url: str) -> bool:
        """Check if a URL is plausibly real and not hallucinated."""
        try:
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https"):
                return False
            netloc = parsed.netloc.replace("www.", "")
            if not netloc or "." not in netloc:
                return False
            # Reject known placeholder / loopback domains
            blocked = {"example.com", "example.org", "example.net", "localhost", "127.0.0.1"}
            if netloc in blocked:
                return False
            return True
        except Exception:
            return False

    def _parse_response(
        self,
        response: Any,
        difficulty_label: str,
        max_results: int,
    ) -> List[Dict[str, Any]]:
        """Parse the Gemini response text into resource dicts."""
        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        raw = json.loads(text)
        if not isinstance(raw, list):
            return []

        resources = []
        for item in raw[:max_results]:
            if not isinstance(item, dict) or not item.get("url"):
                continue

            if not self._is_valid_url(item["url"]):
                continue

            domain = ""
            try:
                domain = urlparse(item["url"]).netloc.replace("www.", "")
            except Exception:
                pass

            resources.append({
                "title": item.get("title", ""),
                "url": item["url"],
                "source_type": item.get("source_type", "article"),
                "thumbnail_url": item.get("thumbnail_url", ""),
                "description": item.get("description", ""),
                "duration": item.get("duration", ""),
                "channel": item.get("channel", ""),
                "difficulty_label": item.get("difficulty_label", difficulty_label),
                "relevance_score": min(1.0, max(0.0, float(item.get("relevance_score", 0.5)))),
                "external_domain": domain,
            })

        return resources

    def _extract_grounding_urls(self, response: Any) -> List[str]:
        """Extract verified URLs from Gemini grounding metadata."""
        urls = []
        try:
            for candidate in getattr(response, "candidates", []):
                metadata = getattr(candidate, "grounding_metadata", None)
                if not metadata:
                    continue
                for chunk in getattr(metadata, "grounding_chunks", []):
                    web = getattr(chunk, "web", None)
                    if web and getattr(web, "uri", None):
                        urls.append(web.uri)
        except Exception:
            pass
        return urls

    def _enrich_with_grounding(
        self, resources: List[Dict[str, Any]], grounding_urls: List[str]
    ) -> None:
        """Cross-reference parsed resources with grounding URLs for validation.

        When a resource's domain matches a grounding-verified URL domain,
        replace the LLM-generated URL with the verified one to avoid
        hallucinated links.
        """
        grounding_by_domain: Dict[str, str] = {}
        for url in grounding_urls:
            try:
                domain = urlparse(url).netloc.replace("www.", "")
                if domain:
                    # First grounding URL per domain wins (most relevant)
                    grounding_by_domain.setdefault(domain, url)
            except Exception:
                pass

        for resource in resources:
            domain = resource.get("external_domain", "")
            if domain in grounding_by_domain:
                # Replace LLM URL with Google Search-verified URL
                resource["url"] = grounding_by_domain[domain]
                resource["relevance_score"] = min(1.0, resource["relevance_score"] + 0.1)

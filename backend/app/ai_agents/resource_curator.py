"""
Resource Curator Agent — AI-Powered Learning Resource Curation

Uses Gemini to generate optimal search queries, executes them via SerperService,
then ranks/filters results by relevance, quality, and difficulty match.
Follows the same Gemini + fallback pattern as FlashcardGenerator.
"""

import os
import json
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class ResourceCuratorAgent:
    """
    Curates learning resources for concepts using Serper search + Gemini ranking.

    Pipeline:
    1. Gemini generates 2-3 optimal search queries per concept
    2. Execute queries via SerperService
    3. Gemini ranks/filters by relevance, quality, difficulty match
    4. Return top N as curated resource dicts
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None

        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception as e:
                print(f"Failed to initialize Gemini for ResourceCuratorAgent: {e}")

    async def curate_resources(
        self,
        concept: str,
        difficulty: float = 0.5,
        max_results: int = 5,
        resource_types: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Curate learning resources for a concept.

        Args:
            concept: The concept/topic to find resources for
            difficulty: 0.0-1.0 difficulty level
            max_results: Maximum resources to return
            resource_types: Types to search for (default: video, article, tutorial)

        Returns:
            List of curated resource dicts with title, url, source_type, etc.
        """
        if resource_types is None:
            resource_types = ["video", "article", "tutorial"]

        # Step 1: Generate search queries via Gemini
        queries = await self._generate_search_queries(concept, difficulty, resource_types)
        if not queries:
            queries = self._fallback_queries(concept, resource_types)

        # Step 2: Execute queries via SerperService
        from ..services.serper_service import SerperService
        serper = SerperService()
        if not serper.available:
            return []

        all_results = []
        seen_urls = set()
        for query_info in queries:
            query_text = query_info.get("query", concept)
            search_type = query_info.get("search_type", "web")
            results = await serper.search(query_text, search_type=search_type, num_results=5)
            for r in results:
                if r.url not in seen_urls:
                    seen_urls.add(r.url)
                    all_results.append(r)

        if not all_results:
            return []

        # Step 3: Rank/filter via Gemini
        ranked = await self._rank_results(concept, difficulty, all_results, max_results)
        return ranked

    async def _generate_search_queries(
        self,
        concept: str,
        difficulty: float,
        resource_types: List[str],
    ) -> List[Dict[str, str]]:
        """Use Gemini to generate optimal search queries."""
        if not self.model:
            return []

        difficulty_label = "beginner" if difficulty < 0.4 else "intermediate" if difficulty < 0.7 else "advanced"

        prompt = f"""Generate 2-3 search queries to find the best learning resources for this concept.

CONCEPT: {concept}
DIFFICULTY LEVEL: {difficulty_label}
RESOURCE TYPES WANTED: {', '.join(resource_types)}

For each query, specify whether to search "web" or "video".
- Use "video" for visual/tutorial content (YouTube)
- Use "web" for articles, documentation, tutorials

Return ONLY valid JSON array:
[
    {{"query": "binary search visualization youtube beginner", "search_type": "video"}},
    {{"query": "binary search algorithm tutorial explained simply", "search_type": "web"}}
]"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            queries = json.loads(response.text)
            if isinstance(queries, list) and len(queries) >= 1:
                return queries[:3]
        except Exception as e:
            print(f"Search query generation failed: {e}")

        return []

    def _fallback_queries(
        self, concept: str, resource_types: List[str]
    ) -> List[Dict[str, str]]:
        """Generate basic queries without LLM."""
        queries = []
        if "video" in resource_types:
            queries.append({"query": f"{concept} tutorial explained", "search_type": "video"})
        if "article" in resource_types or "tutorial" in resource_types:
            queries.append({"query": f"{concept} tutorial beginner guide", "search_type": "web"})
        return queries

    async def _rank_results(
        self,
        concept: str,
        difficulty: float,
        results: list,
        max_results: int,
    ) -> List[Dict[str, Any]]:
        """Use Gemini to rank and filter search results."""
        if not self.model or not results:
            # No LLM — return raw results converted to resource dicts
            return [self._result_to_resource(r, difficulty) for r in results[:max_results]]

        difficulty_label = "beginner" if difficulty < 0.4 else "intermediate" if difficulty < 0.7 else "advanced"

        # Build result summaries for ranking
        result_summaries = []
        for i, r in enumerate(results[:15]):  # Cap at 15 to avoid token bloat
            result_summaries.append(
                f"{i}. [{r.source_type}] \"{r.title}\" — {r.snippet[:100]}"
            )

        prompt = f"""Rank these search results for learning about "{concept}" at {difficulty_label} level.

RESULTS:
{chr(10).join(result_summaries)}

For each result worth recommending, score it 1-10 on:
- relevance: How well it teaches this specific concept
- quality: Production quality, clarity, credibility
- difficulty_match: How well it matches {difficulty_label} level

Return ONLY valid JSON array of the top {max_results} results:
[
    {{"index": 0, "relevance": 9, "quality": 8, "difficulty_match": 7, "description": "Brief 1-sentence description of why this is useful"}}
]

Only include results that score at least 5 overall. Return empty array if nothing is good."""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            rankings = json.loads(response.text)

            if not isinstance(rankings, list):
                raise ValueError("Expected array")

            curated = []
            for rank in rankings[:max_results]:
                idx = rank.get("index", 0)
                if 0 <= idx < len(results):
                    resource = self._result_to_resource(results[idx], difficulty)
                    resource["relevance_score"] = round(
                        (rank.get("relevance", 5) + rank.get("quality", 5) + rank.get("difficulty_match", 5)) / 30,
                        2,
                    )
                    resource["description"] = rank.get("description", resource.get("description", ""))
                    curated.append(resource)
            return curated

        except Exception as e:
            print(f"Result ranking failed, returning unranked: {e}")
            return [self._result_to_resource(r, difficulty) for r in results[:max_results]]

    def _result_to_resource(self, result, difficulty: float) -> Dict[str, Any]:
        """Convert a SerperResult to a curated resource dict."""
        difficulty_label = "beginner" if difficulty < 0.4 else "intermediate" if difficulty < 0.7 else "advanced"
        domain = ""
        try:
            domain = urlparse(result.url).netloc.replace("www.", "")
        except Exception:
            pass

        return {
            "title": result.title,
            "url": result.url,
            "source_type": result.source_type,
            "thumbnail_url": result.thumbnail_url or "",
            "description": result.snippet,
            "duration": result.duration or "",
            "channel": result.channel or "",
            "difficulty_label": difficulty_label,
            "relevance_score": 0.5,
            "external_domain": domain,
        }

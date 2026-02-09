"""
Study Notes Generator — Comprehensive Notes with Google Search Grounding

Uses Gemini with Google Search to produce in-depth study material per concept,
including mermaid diagrams and LaTeX math. Unlike InfoCardGenerator (100-200 word
info cards for the scroll feed), this generates comprehensive study notes.
"""

import re
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error
from ..utils.llm_utils import call_gemini_with_timeout, GEMINI_AVAILABLE

logger = get_logger(__name__)


SUBJECT_CATEGORIES = {
    "math": {
        "keywords": [
            "calculus", "algebra", "probability", "statistics", "geometry",
            "trigonometry", "linear algebra", "differential", "integral",
            "matrix", "vector", "theorem", "proof", "equation", "derivative",
            "limit", "series", "function", "polynomial", "logarithm",
            "combinatorics", "number theory", "topology", "optimization",
        ],
        "emphasis": (
            "FORMATTING EMPHASIS (MATH subject): Use extensive LaTeX math notation "
            "with $$...$$ for display equations and $...$ for inline math. Include "
            "step-by-step derivations, worked examples with intermediate steps, and "
            "formal definitions. Prefer precise mathematical language."
        ),
    },
    "cs": {
        "keywords": [
            "algorithm", "data structure", "programming", "python", "java",
            "javascript", "typescript", "code", "software", "database",
            "api", "recursion", "sorting", "graph", "tree", "hash",
            "complexity", "big-o", "object-oriented", "functional",
            "compiler", "operating system", "network", "web development",
            "machine learning", "artificial intelligence",
        ],
        "emphasis": (
            "FORMATTING EMPHASIS (CS subject): Use code blocks (```python, ```js, etc.) "
            "for examples. Include Big-O complexity analysis where relevant. Use mermaid "
            "flowchart diagrams for algorithms and data flow. Show pseudocode for "
            "key algorithms."
        ),
    },
    "science": {
        "keywords": [
            "biology", "chemistry", "physics", "genetics", "cell",
            "molecule", "atom", "energy", "force", "evolution",
            "ecosystem", "reaction", "element", "periodic", "dna",
            "protein", "thermodynamics", "quantum", "electromagnetic",
            "organic chemistry", "biochemistry", "neuroscience",
        ],
        "emphasis": (
            "FORMATTING EMPHASIS (SCIENCE subject): Use mermaid process diagrams for "
            "biological/chemical processes. Include chemical/physics formulas with LaTeX. "
            "Describe experimental methods and observations. Use diagrams to show "
            "relationships between components."
        ),
    },
    "history": {
        "keywords": [
            "civilization", "war", "revolution", "empire", "dynasty",
            "colonial", "medieval", "ancient", "modern", "century",
            "political", "treaty", "independence", "constitution",
            "democracy", "monarchy", "renaissance", "industrial",
            "world war", "cold war", "civil rights",
        ],
        "emphasis": (
            "FORMATTING EMPHASIS (HISTORY subject): Use chronological structure with "
            "**bolded dates** and time periods. Present cause-effect chains clearly. "
            "Use timeline narrative format. Include quotes from primary sources where "
            "relevant. Compare different perspectives on events."
        ),
    },
    "humanities": {
        "keywords": [
            "literature", "philosophy", "psychology", "economics",
            "sociology", "anthropology", "linguistics", "ethics",
            "aesthetics", "rhetoric", "critical theory", "semiotics",
            "existentialism", "phenomenology", "postmodernism",
            "macroeconomics", "microeconomics", "behavioral",
        ],
        "emphasis": (
            "FORMATTING EMPHASIS (HUMANITIES subject): Include relevant quotes and "
            "citations. Present contrasting viewpoints and schools of thought. Use "
            "mermaid concept map diagrams to show relationships between ideas. "
            "Define key terminology precisely."
        ),
    },
}


class StudyNotesGenerator:
    """
    Generates comprehensive study notes using Gemini with Google Search grounding.

    Output per concept:
    - Detailed explanation (400-800 words)
    - Mermaid diagram where it adds clarity
    - LaTeX math where applicable
    - Real examples and applications
    - Key takeaway
    - Source URLs extracted from grounding metadata
    """

    def __init__(self, api_key: Optional[str] = None):
        self.available = GEMINI_AVAILABLE

    @staticmethod
    def _detect_subject_category(concept_name: str, context: Optional[str] = None) -> str:
        """Detect subject category from concept name and context using keyword matching."""
        text = f"{concept_name} {context or ''}".lower()
        scores: Dict[str, int] = {}
        for category, info in SUBJECT_CATEGORIES.items():
            score = sum(1 for kw in info["keywords"] if kw in text)
            if score > 0:
                scores[category] = score
        if not scores:
            return "general"
        return max(scores, key=lambda k: scores[k])

    async def generate_comprehensive_note(
        self, concept: Dict, context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive study note for a concept.

        Args:
            concept: Dict with at least 'name', optionally 'topics', 'misconceptions'
            context: Optional topic/subject context string

        Returns:
            {title, body_markdown, key_takeaway, sources, style: "comprehensive"}
        """
        if not self.available:
            return self._fallback_note(concept)

        concept_name = concept.get("name", "Unknown")
        topics = ", ".join(concept.get("topics", []))
        misconceptions = ", ".join(concept.get("misconceptions", []))

        context_line = f"\nSUBJECT CONTEXT: {context[:500]}" if context else ""
        topics_line = f"\nRELATED TOPICS: {topics}" if topics else ""
        misconceptions_line = (
            f"\nCOMMON MISCONCEPTIONS: {misconceptions}" if misconceptions else ""
        )

        # Detect subject category for formatting emphasis
        category = self._detect_subject_category(concept_name, context)
        formatting_line = ""
        if category != "general" and category in SUBJECT_CATEGORIES:
            formatting_line = f"\n\n{SUBJECT_CATEGORIES[category]['emphasis']}"

        prompt = f"""You are creating comprehensive study notes for a student learning about a concept.
Use your search capabilities to find accurate, up-to-date information.

CONCEPT: {concept_name}{topics_line}{misconceptions_line}{context_line}{formatting_line}

Create thorough study notes with:
1. A clear, descriptive title
2. A detailed explanation (400-800 words) covering:
   - Core definition and intuition
   - How it works / underlying mechanism
   - Real-world examples and applications
   - Common pitfalls or misconceptions
3. Include a mermaid diagram (```mermaid ... ```) where it helps visualize relationships, processes, or hierarchies. Use flowchart, sequence diagram, or concept map as appropriate.
4. Use LaTeX math notation ($$...$$ for display, $...$ for inline) where formulas are relevant.
5. Use markdown formatting: **bold** for key terms, bullet points, numbered steps.
6. End with a one-sentence key takeaway.

IMPORTANT: Use this exact format with section delimiters:

===TITLE===
Your descriptive title here
===BODY===
Full markdown content with ```mermaid blocks, **bold**, LaTeX, headers, etc.
===TAKEAWAY===
One concise sentence summarizing the key insight.

Do NOT wrap the response in any outer code fence. Start directly with ===TITLE===."""

        try:
            from google.genai import types as genai_types

            response = await call_gemini_with_timeout(
                prompt,
                tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                timeout=45,
                context={
                    "agent": "study_notes_generator",
                    "operation": "generate_comprehensive_note",
                },
            )
            if response is None:
                return self._fallback_note(concept)

            # Parse structured sections
            parsed = self._parse_sections(response.text)
            if not parsed:
                return self._fallback_note(concept)

            # Extract grounding URLs as sources
            sources = self._extract_grounding_sources(response)

            return {
                "title": parsed["title"],
                "body_markdown": parsed["body"],
                "key_takeaway": parsed["takeaway"],
                "sources": sources,
                "concept": concept.get("id", concept.get("name", "unknown")),
                "style": "comprehensive",
            }

        except Exception as e:
            capture_exception(
                e,
                context={
                    "service": "study_notes_generator",
                    "operation": "generate_comprehensive_note",
                },
            )
            log_error(logger, "generate_comprehensive_note failed", error=str(e))
            return self._fallback_note(concept)

    def _parse_sections(self, text: str) -> Optional[Dict[str, str]]:
        """Parse the ===SECTION=== delimited response into title, body, takeaway."""
        if not text:
            return None

        # Extract sections using delimiters
        title_match = re.search(
            r"===TITLE===\s*\n(.*?)(?=\n===BODY===)", text, re.DOTALL
        )
        body_match = re.search(
            r"===BODY===\s*\n(.*?)(?=\n===TAKEAWAY===)", text, re.DOTALL
        )
        takeaway_match = re.search(r"===TAKEAWAY===\s*\n(.*)", text, re.DOTALL)

        if not title_match or not body_match or not takeaway_match:
            return None

        title = title_match.group(1).strip()
        body = body_match.group(1).strip()
        takeaway = takeaway_match.group(1).strip()

        # Validate minimum content
        if len(title) < 5 or len(body) < 100 or len(takeaway) < 10:
            return None

        return {"title": title, "body": body, "takeaway": takeaway}

    def _extract_grounding_sources(self, response: Any) -> List[Dict[str, str]]:
        """Extract source URLs and titles from Gemini grounding metadata."""
        sources: List[Dict[str, str]] = []
        seen_urls: set = set()

        try:
            for candidate in getattr(response, "candidates", []):
                metadata = getattr(candidate, "grounding_metadata", None)
                if not metadata:
                    continue
                for chunk in getattr(metadata, "grounding_chunks", []):
                    web = getattr(chunk, "web", None)
                    if web and getattr(web, "uri", None):
                        url = web.uri
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        title = getattr(web, "title", None) or self._domain_title(url)
                        sources.append({"title": title, "url": url})
        except Exception:
            pass

        return sources[:8]  # Cap at 8 sources

    def _domain_title(self, url: str) -> str:
        """Extract a readable domain name as fallback title."""
        try:
            domain = urlparse(url).netloc.replace("www.", "")
            return domain.split(".")[0].capitalize()
        except Exception:
            return "Source"

    def _fallback_note(self, concept: Dict) -> Dict[str, Any]:
        """Minimal note when Gemini is unavailable."""
        name = concept.get("name", "Unknown Concept")
        return {
            "title": f"[LLM Required] About {name}",
            "body_markdown": f"[LLM required to generate comprehensive notes about {name}]",
            "key_takeaway": f"[LLM required for {name} takeaway]",
            "sources": [],
            "concept": concept.get("id", name),
            "style": "comprehensive",
            "llm_required": True,
        }

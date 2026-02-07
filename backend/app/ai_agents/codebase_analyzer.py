"""
Codebase Analyzer Agent — GitHub Repository Analysis for Learning

Uses GitHub REST API (no cloning) + Gemini to analyze repositories
and extract learning topics, tech stack, architecture patterns.
"""

import os
import re
import json
from typing import Dict, Any, Optional

from ..utils.llm_utils import call_gemini_with_timeout

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

from ..sentry_config import capture_exception
from ..logging_config import get_logger, log_error

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = get_logger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_API_BASE = "https://api.github.com"


class CodebaseAnalyzerAgent:
    """
    Analyzes GitHub repositories via API + Gemini to extract
    learning topics, tech stack, architecture, and key patterns.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None
        self.github_token = GITHUB_TOKEN

        if GEMINI_AVAILABLE and self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-2.0-flash")
            except Exception as e:
                capture_exception(e, context={"service": "codebase_analyzer", "operation": "initialize_gemini"})
                log_error(logger, "initialize_gemini failed", error=str(e))

    def _parse_repo(self, github_url: str) -> Optional[tuple]:
        """Parse owner/repo from GitHub URL."""
        patterns = [
            r"github\.com/([^/]+)/([^/?#]+)",
            r"^([^/]+)/([^/]+)$",
        ]
        for pattern in patterns:
            match = re.search(pattern, github_url.rstrip("/"))
            if match:
                return match.group(1), match.group(2).replace(".git", "")
        return None

    def _github_headers(self) -> Dict[str, str]:
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self.github_token:
            headers["Authorization"] = f"token {self.github_token}"
        return headers

    async def analyze_repo(self, github_url: str) -> Dict[str, Any]:
        """
        Full repository analysis pipeline.

        1. Parse owner/repo from URL
        2. Fetch README, manifest files, directory tree
        3. Send to Gemini for analysis
        4. Return structured analysis
        """
        parsed = self._parse_repo(github_url)
        if not parsed:
            return {"error": "Invalid GitHub URL"}

        owner, repo = parsed

        if not HTTPX_AVAILABLE:
            return {"error": "httpx not installed"}

        # Fetch repo data via GitHub API
        repo_data = await self._fetch_repo_data(owner, repo)
        if "error" in repo_data:
            return repo_data

        # Analyze with Gemini
        analysis = await self._analyze_with_gemini(repo_data)
        return analysis

    async def _fetch_repo_data(self, owner: str, repo: str) -> Dict[str, Any]:
        """Fetch repo metadata, README, manifests, and directory tree."""
        headers = self._github_headers()
        data: Dict[str, Any] = {"owner": owner, "repo": repo}

        async with httpx.AsyncClient(timeout=15) as client:
            # 1. Repo metadata
            try:
                resp = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}",
                    headers=headers,
                )
                if resp.status_code == 404:
                    return {"error": f"Repository {owner}/{repo} not found"}
                resp.raise_for_status()
                meta = resp.json()
                data["description"] = meta.get("description", "")
                data["language"] = meta.get("language", "")
                data["topics"] = meta.get("topics", [])
                data["stars"] = meta.get("stargazers_count", 0)
                data["default_branch"] = meta.get("default_branch", "main")
            except Exception as e:
                return {"error": f"Failed to fetch repo metadata: {e}"}

            # 2. README
            try:
                resp = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}/readme",
                    headers=headers,
                )
                if resp.status_code == 200:
                    import base64
                    content = resp.json().get("content", "")
                    data["readme"] = base64.b64decode(content).decode("utf-8", errors="replace")[:3000]
                else:
                    data["readme"] = ""
            except Exception:
                data["readme"] = ""

            # 3. Directory tree (top 2 levels)
            try:
                branch = data.get("default_branch", "main")
                resp = await client.get(
                    f"{GITHUB_API_BASE}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
                    headers=headers,
                )
                if resp.status_code == 200:
                    tree = resp.json().get("tree", [])
                    # Only keep first 2 levels and limit to 100 entries
                    filtered = [
                        t["path"] for t in tree
                        if t["path"].count("/") <= 2
                    ][:100]
                    data["directory_tree"] = filtered
                else:
                    data["directory_tree"] = []
            except Exception:
                data["directory_tree"] = []

            # 4. Manifest files (package.json, requirements.txt, etc.)
            manifest_files = [
                "package.json", "requirements.txt", "Cargo.toml",
                "go.mod", "pom.xml", "build.gradle",
                "Pipfile", "pyproject.toml", "Gemfile",
            ]
            data["manifests"] = {}
            for mf in manifest_files:
                try:
                    resp = await client.get(
                        f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{mf}",
                        headers=headers,
                    )
                    if resp.status_code == 200:
                        import base64
                        content = resp.json().get("content", "")
                        data["manifests"][mf] = base64.b64decode(content).decode("utf-8", errors="replace")[:2000]
                except Exception:
                    pass

        return data

    async def _analyze_with_gemini(self, repo_data: Dict[str, Any]) -> Dict[str, Any]:
        """Use Gemini to analyze repo data and extract learning topics."""
        if not self.model:
            return self._fallback_analysis(repo_data)

        owner = repo_data.get("owner", "")
        repo = repo_data.get("repo", "")
        readme_excerpt = (repo_data.get("readme", "") or "")[:1500]
        manifests_str = ""
        for name, content in repo_data.get("manifests", {}).items():
            manifests_str += f"\n--- {name} ---\n{content[:500]}\n"
        dir_tree = "\n".join(repo_data.get("directory_tree", [])[:50])

        prompt = f"""Analyze this GitHub repository for a student who wants to learn from its codebase.

REPO: {owner}/{repo}
DESCRIPTION: {repo_data.get('description', '')}
PRIMARY LANGUAGE: {repo_data.get('language', '')}
TOPICS: {', '.join(repo_data.get('topics', []))}
STARS: {repo_data.get('stars', 0)}

README EXCERPT:
{readme_excerpt}

MANIFEST FILES:
{manifests_str}

DIRECTORY STRUCTURE:
{dir_tree}

Analyze and return ONLY valid JSON:
{{
    "repo_name": "{owner}/{repo}",
    "tech_stack": ["React", "TypeScript", "Node.js"],
    "architecture": "Brief description of the project architecture (2-3 sentences)",
    "key_patterns": ["Pattern 1", "Pattern 2"],
    "learning_topics": [
        {{
            "topic": "React Component Architecture",
            "description": "How components are organized and composed",
            "complexity": "intermediate",
            "order": 1
        }}
    ],
    "estimated_complexity": "beginner|intermediate|advanced",
    "learning_path_summary": "Brief learning path suggestion (2-3 sentences)"
}}

Rules:
- 10-15 learning topics, ordered by suggested learning sequence
- Each topic has complexity: beginner, intermediate, or advanced
- Tech stack should list all significant technologies/frameworks
- Focus on what a student can LEARN from this codebase"""

        try:
            response = await call_gemini_with_timeout(
                self.model, prompt,
                generation_config={"response_mime_type": "application/json"},
                context={"agent": "codebase_analyzer", "operation": "analyze_with_gemini"},
            )
            if response is not None:
                result = json.loads(response.text)
                if "tech_stack" in result and "learning_topics" in result:
                    return result
        except Exception as e:
            capture_exception(e, context={"service": "codebase_analyzer", "operation": "analyze_with_gemini"})
            log_error(logger, "analyze_with_gemini failed", error=str(e))

        return self._fallback_analysis(repo_data)

    def _fallback_analysis(self, repo_data: Dict[str, Any]) -> Dict[str, Any]:
        """Minimal analysis when Gemini is unavailable."""
        owner = repo_data.get("owner", "")
        repo = repo_data.get("repo", "")
        language = repo_data.get("language", "Unknown")

        tech_stack = [language] if language else []
        # Try to detect from manifests
        manifests = repo_data.get("manifests", {})
        if "package.json" in manifests:
            tech_stack.extend(["JavaScript", "Node.js"])
        if "requirements.txt" in manifests or "pyproject.toml" in manifests:
            tech_stack.append("Python")
        if "Cargo.toml" in manifests:
            tech_stack.append("Rust")

        return {
            "repo_name": f"{owner}/{repo}",
            "tech_stack": list(set(tech_stack)),
            "architecture": repo_data.get("description", ""),
            "key_patterns": [],
            "learning_topics": [
                {
                    "topic": f"{language} Fundamentals",
                    "description": f"Core {language} concepts used in this project",
                    "complexity": "beginner",
                    "order": 1,
                },
                {
                    "topic": "Project Architecture",
                    "description": "How the codebase is organized",
                    "complexity": "intermediate",
                    "order": 2,
                },
            ],
            "estimated_complexity": "intermediate",
            "learning_path_summary": f"Start with {language} fundamentals, then explore the project architecture.",
            "llm_required": True,
        }

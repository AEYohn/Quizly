"""
Codebase Learning Service — Connects codebase analysis → syllabus → resources.

Orchestrates the full "Learn this Project" flow:
1. Analyze repo via CodebaseAnalyzerAgent
2. Generate syllabus tree via SyllabusService
3. Background-trigger resource curation for each technology
"""

from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..ai_agents.codebase_analyzer import CodebaseAnalyzerAgent
from ..ai_agents.resource_curator import ResourceCuratorAgent
from ..services.syllabus_service import SyllabusService
from ..db_models import CodebaseAnalysis


class CodebaseLearningService:
    """Connects codebase analysis → syllabus generation → resource curation."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.analyzer = CodebaseAnalyzerAgent()
        self.syllabus_service = SyllabusService(db)
        self.resource_curator = ResourceCuratorAgent()

    async def analyze_and_build_tree(
        self,
        github_url: str,
        student_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Full pipeline: analyze repo → generate syllabus → trigger resource curation.
        """
        # Check for cached analysis
        cached = await self._get_cached_analysis(github_url)
        if cached:
            return {
                "analysis_id": str(cached.id),
                "analysis": cached.analysis_json,
                "tech_stack": cached.tech_stack_json,
                "syllabus_subject": cached.syllabus_subject,
                "cached": True,
            }

        # Step 1: Analyze repository
        analysis = await self.analyzer.analyze_repo(github_url)
        if "error" in analysis:
            return analysis

        repo_name = analysis.get("repo_name", github_url)
        tech_stack = analysis.get("tech_stack", [])
        learning_topics = analysis.get("learning_topics", [])

        # Step 2: Build document context from analysis for syllabus generation
        doc_context = self._build_doc_context(analysis)

        # Use repo name as subject
        subject = repo_name.split("/")[-1] if "/" in repo_name else repo_name

        # Store resource context for syllabus generation
        from ..db_models import SubjectResource
        resource = SubjectResource(
            subject=subject,
            student_id=student_id,
            file_name=f"github:{repo_name}",
            file_type="codebase_analysis",
            summary=analysis.get("architecture", ""),
            concepts_json=[t.get("topic", "") for t in learning_topics],
            key_content=doc_context[:1000],
        )
        self.db.add(resource)
        await self.db.flush()

        # Generate syllabus tree
        syllabus = await self.syllabus_service.get_or_generate(
            subject=subject,
            student_id=student_id,
        )

        # Step 3: Store analysis
        db_analysis = CodebaseAnalysis(
            github_url=github_url,
            repo_name=repo_name,
            analysis_json=analysis,
            tech_stack_json=tech_stack,
            student_id=student_id,
            syllabus_subject=subject,
        )
        self.db.add(db_analysis)
        await self.db.commit()
        await self.db.refresh(db_analysis)

        # Step 4: Background resource curation for technologies
        # (Fire and forget — don't block the response)
        try:
            for tech in tech_stack[:5]:  # Cap at 5 technologies
                resources = await self.resource_curator.curate_resources(
                    tech, difficulty=0.5, max_results=2
                )
                for res in resources:
                    from ..db_models_content_pool import ContentItem
                    item = ContentItem(
                        content_type="resource_card",
                        topic=subject,
                        concept=tech,
                        difficulty=0.3,
                        content_json=res,
                        tags=[tech.lower()],
                        source="serper_curated",
                        generator_agent="ResourceCuratorAgent",
                    )
                    self.db.add(item)
                await self.db.commit()
        except Exception as e:
            print(f"Background resource curation for codebase failed: {e}")

        return {
            "analysis_id": str(db_analysis.id),
            "analysis": analysis,
            "tech_stack": tech_stack,
            "syllabus": syllabus,
            "syllabus_subject": subject,
            "cached": False,
        }

    async def _get_cached_analysis(self, github_url: str) -> Optional[CodebaseAnalysis]:
        """Check for cached analysis of this repo."""
        query = (
            select(CodebaseAnalysis)
            .where(CodebaseAnalysis.github_url == github_url)
            .order_by(CodebaseAnalysis.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    def _build_doc_context(self, analysis: Dict[str, Any]) -> str:
        """Build document context string from analysis for syllabus generation."""
        parts = []
        parts.append(f"Tech Stack: {', '.join(analysis.get('tech_stack', []))}")
        parts.append(f"Architecture: {analysis.get('architecture', '')}")

        if analysis.get("key_patterns"):
            parts.append(f"Key Patterns: {', '.join(analysis['key_patterns'])}")

        topics = analysis.get("learning_topics", [])
        if topics:
            topic_names = [t.get("topic", "") for t in topics]
            parts.append(f"Learning Topics: {', '.join(topic_names)}")

        parts.append(f"Complexity: {analysis.get('estimated_complexity', 'intermediate')}")
        return "\n".join(parts)

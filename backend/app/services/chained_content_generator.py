"""
Chained Content Generator — Resources → Notes → Flashcards → Quiz

Each step uses output from previous steps as context, producing
content tightly grounded in the user's uploaded materials.
"""

import asyncio
from typing import Dict, Any, Optional, List, Callable, Awaitable

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update

from ..db_models import SubjectResource
from ..db_models_content_pool import ContentItem
from ..ai_agents.study_notes_generator import StudyNotesGenerator
from ..ai_agents.flashcard_generator import FlashcardGenerator
from ..ai_agents.question_generator import QuestionBankGenerator
from ..logging_config import get_logger, log_error
from ..sentry_config import capture_exception

logger = get_logger(__name__)

# Type for progress callback: (step, progress_0_to_1, message)
ProgressCallback = Callable[[str, float, str], Awaitable[None]]


class ChainedContentGenerator:
    """
    Chain: Resources → Study Notes → Flashcards → Quiz

    Each step feeds into the next:
    1. Load full_content from uploaded SubjectResource rows
    2. Generate study notes grounded in resource content (no Google Search)
    3. Generate flashcards using notes as rich_context
    4. Generate quiz MCQs using notes + resource text as rich_context
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.notes_gen = StudyNotesGenerator()
        self.flashcard_gen = FlashcardGenerator()
        self.question_gen = QuestionBankGenerator()

    async def generate_from_resources(
        self,
        subject: str,
        topic: str,
        concepts: List[str],
        student_id: Optional[str] = None,
        on_progress: Optional[ProgressCallback] = None,
    ) -> Dict[str, int]:
        """
        Full chained generation pipeline.

        Args:
            subject: Subject name (matches SubjectResource.subject)
            topic: Topic name for ContentItem storage
            concepts: List of concept names to generate content for
            student_id: Optional student ID to scope resource lookup
            on_progress: Optional async callback for progress updates

        Returns:
            {notes: N, flashcards: N, quiz: N}
        """
        async def progress(step: str, pct: float, msg: str):
            if on_progress:
                try:
                    await on_progress(step, pct, msg)
                except Exception:
                    pass

        # Step 0: Deactivate existing content for this topic so fresh content replaces old
        await self._deactivate_existing(topic)

        # Step 1: Load resources
        await progress("loading_resources", 0.05, "Loading uploaded resources...")
        resource_text = await self._load_full_resources(subject, student_id)
        if not resource_text:
            await progress("loading_resources", 0.1, "No resources found — using web search")

        # Step 2: Generate study notes
        notes_count = 0
        generated_notes: Dict[str, str] = {}  # concept -> body_markdown

        for i, concept_name in enumerate(concepts):
            pct = 0.1 + (i / max(len(concepts), 1)) * 0.35
            await progress(
                "generating_notes", pct,
                f"Generating notes for {concept_name}..."
            )

            concept_dict = {
                "id": concept_name.lower().replace(" ", "_"),
                "name": concept_name,
                "topics": [],
                "misconceptions": [],
            }

            note = await self.notes_gen.generate_comprehensive_note(
                concept_dict,
                context=topic,
                resource_content=resource_text,
            )
            if note.get("llm_required"):
                continue

            body = note.get("body_markdown", "")
            generated_notes[concept_name] = body

            item = ContentItem(
                topic=topic,
                concept=concept_name,
                content_type="study_note",
                difficulty=0.3,
                content_json={
                    "title": note.get("title", ""),
                    "body_markdown": body,
                    "key_takeaway": note.get("key_takeaway", ""),
                    "style": note.get("style", "comprehensive"),
                    "sources": note.get("sources", []),
                },
                generator_agent="chained_study_notes",
                quality_score=0.8,
            )
            self.db.add(item)
            notes_count += 1

        await self.db.commit()

        # Step 3: Generate flashcards using notes as rich_context
        flashcards_count = 0
        for i, concept_name in enumerate(concepts):
            pct = 0.45 + (i / max(len(concepts), 1)) * 0.25
            await progress(
                "generating_flashcards", pct,
                f"Creating flashcards for {concept_name}..."
            )

            concept_dict = {
                "id": concept_name.lower().replace(" ", "_"),
                "name": concept_name,
                "topics": [],
                "misconceptions": [],
            }

            # Use generated notes as rich_context, fall back to resource text
            rich_ctx = generated_notes.get(concept_name, resource_text or "")

            for diff in [0.3, 0.5, 0.7]:
                fc = await self.flashcard_gen.generate_flashcard(
                    concept_dict,
                    difficulty=diff,
                    context=topic,
                    rich_context=rich_ctx[:5000] if rich_ctx else None,
                )
                if fc.get("llm_required"):
                    continue

                item = ContentItem(
                    topic=topic,
                    concept=concept_name,
                    content_type="flashcard",
                    difficulty=diff,
                    content_json={
                        "front": fc.get("front", ""),
                        "back": fc.get("back", ""),
                        "hint": fc.get("hint", ""),
                    },
                    generator_agent="chained_flashcard",
                    quality_score=0.7,
                )
                self.db.add(item)
                flashcards_count += 1

            await self.db.commit()

        # Step 4: Generate quiz MCQs using notes + resource text
        quiz_count = 0
        for i, concept_name in enumerate(concepts):
            pct = 0.7 + (i / max(len(concepts), 1)) * 0.25
            await progress(
                "generating_quiz", pct,
                f"Building quiz questions for {concept_name}..."
            )

            concept_dict = {
                "id": concept_name.lower().replace(" ", "_"),
                "name": concept_name,
                "topics": [],
                "misconceptions": [],
            }

            # Combine notes + resource text for maximum context
            notes_text = generated_notes.get(concept_name, "")
            rich_ctx = notes_text
            if resource_text:
                remaining = 10000 - len(rich_ctx)
                if remaining > 500:
                    rich_ctx += "\n\n" + resource_text[:remaining]

            for diff, qtype in [(0.3, "conceptual"), (0.5, "application"), (0.7, "analysis")]:
                mcq = await self.question_gen.generate_question(
                    concept_dict,
                    difficulty=diff,
                    question_type=qtype,
                    rich_context=rich_ctx[:10000] if rich_ctx else None,
                )
                if mcq.get("llm_required"):
                    continue

                item = ContentItem(
                    topic=topic,
                    concept=concept_name,
                    content_type="mcq",
                    difficulty=diff,
                    content_json={
                        "prompt": mcq.get("prompt", ""),
                        "options": mcq.get("options", []),
                        "correct_answer": mcq.get("correct_answer", ""),
                        "explanation": mcq.get("explanation", ""),
                    },
                    generator_agent="chained_quiz",
                    quality_score=0.7,
                )
                self.db.add(item)
                quiz_count += 1

            await self.db.commit()

        await progress("complete", 1.0, f"Done! {notes_count} notes, {flashcards_count} flashcards, {quiz_count} quiz questions")

        return {
            "notes": notes_count,
            "flashcards": flashcards_count,
            "quiz": quiz_count,
        }

    async def _load_full_resources(
        self, subject: str, student_id: Optional[str] = None
    ) -> Optional[str]:
        """Load combined full_content from all SubjectResource rows for a subject."""
        conditions = [SubjectResource.subject == subject]
        if student_id:
            conditions.append(SubjectResource.student_id == student_id)

        query = select(SubjectResource).where(and_(*conditions)).limit(10)
        result = await self.db.execute(query)
        resources = result.scalars().all()

        if not resources:
            return None

        parts = []
        for r in resources:
            content = getattr(r, "full_content", None) or r.key_content
            if content and content.strip():
                parts.append(content[:30000])

        return "\n\n---\n\n".join(parts)[:60000] if parts else None

    async def _deactivate_existing(self, topic: str):
        """Mark existing generated content as inactive so fresh content replaces it."""
        await self.db.execute(
            update(ContentItem)
            .where(
                and_(
                    ContentItem.topic == topic,
                    ContentItem.is_active.is_(True),
                    ContentItem.generator_agent.like("chained_%"),
                )
            )
            .values(is_active=False)
        )
        await self.db.commit()

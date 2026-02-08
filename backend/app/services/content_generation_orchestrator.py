"""
Content Generation Orchestrator — WideSeek-Inspired Lead Agent

Decomposes topic → concepts → dispatches specialist subagents → stores in shared pool.
If the pool already has enough content for a topic, skips generation entirely.

Architecture supports asyncio.gather for parallel dispatch in Phase 2;
Phase 1 uses sequential dispatch to respect Gemini rate limits.
"""

import uuid
import hashlib
from typing import Dict, Any, Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from ..db_models_content_pool import ContentItem
from ..ai_agents.question_generator import QuestionBankGenerator
from ..ai_agents.flashcard_generator import FlashcardGenerator
from ..ai_agents.info_card_generator import InfoCardGenerator
from ..ai_agents.resource_curator import ResourceCuratorAgent


class ContentGenerationOrchestrator:
    """
    Lead agent: checks pool, dispatches subagents, stores results.
    Content is shared — one generation benefits all future users on the topic.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.question_gen = QuestionBankGenerator()
        self.flashcard_gen = FlashcardGenerator()
        self.info_card_gen = InfoCardGenerator()
        self.resource_curator = ResourceCuratorAgent()

    async def ensure_pool_ready(
        self,
        topic: str,
        concepts: List[str],
        min_items: int = 5,
        subject: Optional[str] = None,
    ) -> int:
        """
        Check pool for a topic. Generate content if deficit exists.
        Returns total items available after potential generation.
        """
        existing = await self._count_pool_items(topic)
        if existing >= min_items * len(concepts):
            return existing

        # Load resource context using subject (more reliable than topic name)
        notes = await self._get_resource_context(topic, subject=subject)

        # Generate to fill deficit
        await self.generate_content_for_topic(topic, concepts, notes=notes)
        return await self._count_pool_items(topic)

    async def _get_resource_context(self, topic: str, subject: Optional[str] = None) -> Optional[str]:
        """Auto-load stored resource context for a topic.

        Resources are stored under the subject name (e.g. "Flow Matching and
        Diffusion Models") but topics use a shorter name (e.g. "Flow Matching").
        We try: exact subject match → exact topic match → substring match.
        """
        from ..db_models import SubjectResource

        # Try explicit subject first (if provided by caller)
        if subject:
            query = select(SubjectResource).where(
                SubjectResource.subject == subject
            ).limit(5)
            result = await self.db.execute(query)
            resources = result.scalars().all()
            if resources:
                parts = [r.key_content for r in resources if r.key_content]
                return "\n".join(parts)[:2000] if parts else None

        # Try exact topic match
        query = select(SubjectResource).where(
            SubjectResource.subject == topic
        ).limit(5)
        result = await self.db.execute(query)
        resources = result.scalars().all()

        # Fallback: substring match (topic in subject or subject in topic)
        if not resources:
            query = select(SubjectResource).where(
                SubjectResource.subject.contains(topic)
            ).limit(5)
            result = await self.db.execute(query)
            resources = result.scalars().all()

        if not resources:
            return None
        parts = [r.key_content for r in resources if r.key_content]
        return "\n".join(parts)[:2000] if parts else None

    async def generate_content_for_topic(
        self,
        topic: str,
        concepts: List[str],
        count_per_type: int = 3,
        notes: Optional[str] = None,
    ) -> Dict[str, int]:
        """
        Dispatch all subagents for a topic. Store results in ContentItem pool.
        Returns count of items generated per type.
        """
        # Auto-load stored resources if no explicit notes provided
        if notes is None:
            notes = await self._get_resource_context(topic)

        counts = {"mcq": 0, "flashcard": 0, "info_card": 0, "resource_card": 0}

        for concept_name in concepts:
            concept_dict = {
                "id": concept_name.lower().replace(" ", "_"),
                "name": concept_name,
                "topics": [],
                "misconceptions": [],
            }

            # Difficulty spread across generated items
            difficulties = [0.3, 0.5, 0.7] if count_per_type >= 3 else [0.5]

            for i, diff in enumerate(difficulties[:count_per_type]):
                # MCQ via existing QuestionBankGenerator
                mcq = await self.question_gen.generate_question(
                    concept_dict,
                    difficulty=diff,
                    question_type="conceptual" if diff < 0.5 else "application",
                    context=notes,
                )
                # Skip placeholder content (LLM fallback)
                if mcq.get("llm_required"):
                    continue
                stored = await self._store_content_item(
                    content_type="mcq",
                    topic=topic,
                    concept=concept_name,
                    difficulty=diff,
                    content_json={
                        "prompt": mcq.get("prompt", ""),
                        "options": mcq.get("options", []),
                        "correct_answer": mcq.get("correct_answer", ""),
                        "explanation": mcq.get("explanation", ""),
                    },
                    tags=_topic_to_tags(topic, concept_name),
                    agent="QuestionBankGenerator",
                )
                if stored:
                    counts["mcq"] += 1

                # Flashcard via FlashcardGenerator
                fc = await self.flashcard_gen.generate_flashcard(
                    concept_dict,
                    difficulty=diff,
                    context=notes,
                )
                stored = await self._store_content_item(
                    content_type="flashcard",
                    topic=topic,
                    concept=concept_name,
                    difficulty=diff,
                    content_json={
                        "front": fc.get("front", ""),
                        "back": fc.get("back", ""),
                        "hint": fc.get("hint", ""),
                    },
                    tags=_topic_to_tags(topic, concept_name),
                    agent="FlashcardGenerator",
                )
                if stored:
                    counts["flashcard"] += 1

                # Info cards: generate 2 per concept with varied styles
                if i == 0:
                    intro_styles = ["key_insight", "summary", "example"]
                    for style_idx, info_style in enumerate(intro_styles[:2]):
                        ic = await self.info_card_gen.generate_info_card(
                            concept_dict, style=info_style, context=notes
                        )
                        if ic.get("llm_required"):
                            continue
                        info_difficulty = 0.2 if style_idx == 0 else 0.5
                        stored = await self._store_content_item(
                            content_type="info_card",
                            topic=topic,
                            concept=concept_name,
                            difficulty=info_difficulty,
                            content_json={
                                "title": ic.get("title", ""),
                                "body_markdown": ic.get("body_markdown", ""),
                                "key_takeaway": ic.get("key_takeaway", ""),
                                "style": ic.get("style", info_style),
                            },
                            tags=_topic_to_tags(topic, concept_name),
                            agent="InfoCardGenerator",
                        )
                        if stored:
                            counts["info_card"] += 1

            # Resource curation — 1-2 resources per concept (once, not per difficulty)
            try:
                resources = await self.resource_curator.curate_resources(
                    concept_name, difficulty=0.5, max_results=2
                )
                for res in resources:
                    if res.get("llm_required"):
                        continue
                    stored = await self._store_content_item(
                        content_type="resource_card",
                        topic=topic,
                        concept=concept_name,
                        difficulty=0.3,
                        content_json=res,
                        tags=_topic_to_tags(topic, concept_name),
                        agent="ResourceCuratorAgent",
                    )
                    if stored:
                        counts["resource_card"] += 1
            except Exception as e:
                print(f"Resource curation failed for {concept_name}: {e}")

            # Commit after each concept to release the write lock quickly
            # (prevents "database is locked" when other requests need to write)
            await self.db.commit()

        return counts

    async def _store_content_item(
        self,
        content_type: str,
        topic: str,
        concept: str,
        difficulty: float,
        content_json: Dict[str, Any],
        tags: list,
        agent: str,
    ) -> Optional[ContentItem]:
        """Persist to pool with hash-based dedup."""
        content_hash = _content_hash(content_type, content_json)

        # Check for duplicate
        existing = await self.db.execute(
            select(ContentItem.id).where(
                and_(
                    ContentItem.topic == topic,
                    ContentItem.concept == concept,
                    ContentItem.content_type == content_type,
                )
            ).limit(50)
        )
        existing_ids = [str(r[0]) for r in existing.all()]

        # Simple dedup: check if identical content hash exists
        # We hash the primary content field to detect exact duplicates
        for eid in existing_ids:
            item = await self.db.get(ContentItem, uuid.UUID(eid))
            if item and _content_hash(content_type, item.content_json) == content_hash:
                return None  # duplicate

        item = ContentItem(
            content_type=content_type,
            topic=topic,
            concept=concept,
            difficulty=difficulty,
            content_json=content_json,
            tags=tags,
            source="ai_generated",
            generator_agent=agent,
        )
        self.db.add(item)
        return item

    async def _count_pool_items(self, topic: str) -> int:
        result = await self.db.execute(
            select(func.count(ContentItem.id)).where(
                and_(
                    ContentItem.topic == topic,
                    ContentItem.is_active.is_(True),
                )
            )
        )
        return result.scalar() or 0


def _topic_to_tags(topic: str, concept: str) -> list:
    """Simple tag generation from topic and concept strings."""
    tags = set()
    for word in topic.lower().split():
        if len(word) > 2:
            tags.add(word)
    for word in concept.lower().split():
        if len(word) > 2:
            tags.add(word)
    return sorted(tags)


def _content_hash(content_type: str, content_json: Dict) -> str:
    """Hash primary content field for dedup."""
    if content_type == "mcq":
        key = content_json.get("prompt", "")
    elif content_type == "flashcard":
        key = content_json.get("front", "")
    elif content_type == "resource_card":
        key = content_json.get("url", "")
    else:
        key = content_json.get("title", "")
    return hashlib.md5(key.encode()).hexdigest()

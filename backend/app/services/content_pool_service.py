"""
Content Pool Service — Queries shared pool for the scroll feed.

Selects diverse cards with target distribution (60% MCQ, 20% flashcard, 20% info_card),
respects difficulty range, excludes previously served items, and tracks interactions.
"""

import uuid
from typing import Dict, Any, Optional, List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from ..db_models_content_pool import ContentItem, UserContentInteraction
from ..services.scroll_feed_engine import ScrollCard


class ContentPoolService:
    """Queries shared pool for scroll feed. Tracks interactions."""

    # Target content distribution
    TYPE_WEIGHTS = {"mcq": 0.5, "flashcard": 0.2, "info_card": 0.15, "resource_card": 0.15}

    def __init__(self, db: AsyncSession):
        self.db = db

    async def select_cards(
        self,
        topic: str,
        concepts: List[str],
        difficulty_range: Tuple[float, float] = (0.0, 1.0),
        exclude_ids: Optional[List[str]] = None,
        count: int = 3,
        type_weights: Optional[Dict[str, float]] = None,
    ) -> List[ScrollCard]:
        """
        Select diverse cards from pool.
        Target distribution: 60% MCQ, 20% flashcard, 20% info-card (default).
        Pass type_weights to override the distribution.
        """
        exclude_ids = exclude_ids or []
        exclude_uuids = []
        for eid in exclude_ids:
            try:
                exclude_uuids.append(uuid.UUID(eid))
            except ValueError:
                pass

        # Determine how many of each type to fetch
        type_counts = self._distribute_types(count, type_weights=type_weights)
        cards: List[ScrollCard] = []

        for content_type, type_count in type_counts.items():
            if type_count <= 0:
                continue
            items = await self.get_pool_items(
                topic=topic,
                concepts=concepts,
                content_type=content_type,
                difficulty_range=difficulty_range,
                exclude_ids=exclude_uuids,
                limit=type_count,
            )
            for item in items:
                cards.append(self._content_item_to_scroll_card(item))

        return cards

    async def get_pool_items(
        self,
        topic: str,
        concepts: Optional[List[str]] = None,
        content_type: Optional[str] = None,
        difficulty_range: Tuple[float, float] = (0.0, 1.0),
        exclude_ids: Optional[List[uuid.UUID]] = None,
        limit: int = 10,
    ) -> List[ContentItem]:
        """Query pool with filters. Ordered by least-served first for freshness."""
        conditions = [
            ContentItem.topic == topic,
            ContentItem.is_active.is_(True),
            ContentItem.difficulty >= difficulty_range[0],
            ContentItem.difficulty <= difficulty_range[1],
        ]
        if content_type:
            conditions.append(ContentItem.content_type == content_type)
        if concepts:
            conditions.append(ContentItem.concept.in_(concepts))
        if exclude_ids:
            conditions.append(ContentItem.id.notin_(exclude_ids))

        query = (
            select(ContentItem)
            .where(and_(*conditions))
            .order_by(ContentItem.times_served.asc(), func.random())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def record_interaction(
        self,
        student_name: str,
        content_item_id: str,
        interaction_type: str,
        answer: Optional[str] = None,
        is_correct: Optional[bool] = None,
        time_spent_ms: int = 0,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> None:
        """Record engagement and update ContentItem aggregates."""
        try:
            item_uuid = uuid.UUID(content_item_id)
        except ValueError:
            return

        interaction = UserContentInteraction(
            student_name=student_name,
            user_id=uuid.UUID(user_id) if user_id else None,
            content_item_id=item_uuid,
            interaction_type=interaction_type,
            answer=answer,
            is_correct=is_correct,
            time_spent_ms=time_spent_ms,
            session_id=uuid.UUID(session_id) if session_id else None,
        )
        self.db.add(interaction)

        # Update aggregates on ContentItem
        item = await self.db.get(ContentItem, item_uuid)
        if item:
            item.times_served += 1
            if is_correct is True:
                item.times_correct += 1
            if interaction_type == "skipped":
                item.times_skipped += 1
            if time_spent_ms > 0 and item.times_served > 0:
                # Running average
                item.avg_time_spent_ms = (
                    item.avg_time_spent_ms * (item.times_served - 1) + time_spent_ms
                ) / item.times_served

        await self.db.commit()

    async def record_skip(
        self,
        student_name: str,
        content_item_id: str,
        session_id: Optional[str] = None,
    ) -> None:
        """Record skip signal."""
        await self.record_interaction(
            student_name=student_name,
            content_item_id=content_item_id,
            interaction_type="skipped",
            session_id=session_id,
        )

    def _content_item_to_scroll_card(
        self, item: ContentItem, is_reintroduction: bool = False
    ) -> ScrollCard:
        """Convert ContentItem → ScrollCard format for the feed."""
        cj = item.content_json or {}

        if item.content_type == "mcq":
            question = {
                "prompt": cj.get("prompt", ""),
                "options": cj.get("options", []),
                "correct_answer": cj.get("correct_answer", ""),
                "explanation": cj.get("explanation", ""),
            }
        elif item.content_type == "flashcard":
            question = {
                "prompt": cj.get("front", ""),
                "options": [],
                "correct_answer": "",
                "explanation": cj.get("back", ""),
                "flashcard_front": cj.get("front", ""),
                "flashcard_back": cj.get("back", ""),
                "flashcard_hint": cj.get("hint", ""),
            }
        elif item.content_type == "resource_card":
            question = {
                "prompt": "",
                "options": [],
                "correct_answer": "",
                "explanation": "",
                "resource_title": cj.get("title", ""),
                "resource_url": cj.get("url", ""),
                "resource_type": cj.get("source_type", "web"),
                "resource_thumbnail": cj.get("thumbnail_url", ""),
                "resource_description": cj.get("description", ""),
                "resource_duration": cj.get("duration", ""),
                "resource_channel": cj.get("channel", ""),
                "resource_domain": cj.get("external_domain", ""),
            }
        else:  # info_card
            question = {
                "prompt": "",
                "options": [],
                "correct_answer": "",
                "explanation": "",
                "info_title": cj.get("title", ""),
                "info_body": cj.get("body_markdown", ""),
                "info_takeaway": cj.get("key_takeaway", ""),
            }

        xp_value = int(10 * (1 + item.difficulty)) if item.content_type == "mcq" else 5

        return ScrollCard(
            id=f"pool_{item.id.hex[:12]}",
            question=question,
            concept=item.concept,
            difficulty=item.difficulty,
            card_type=item.content_type,
            is_reintroduction=is_reintroduction,
            xp_value=xp_value,
            content_item_id=str(item.id),
        )

    def _distribute_types(
        self, count: int, type_weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, int]:
        """Distribute count across content types per target weights."""
        weights = type_weights or self.TYPE_WEIGHTS
        result: Dict[str, int] = {}
        remaining = count
        for ctype, weight in sorted(
            weights.items(), key=lambda x: x[1], reverse=True
        ):
            n = max(0, round(count * weight))
            n = min(n, remaining)
            result[ctype] = n
            remaining -= n
        # Assign any remainder to the first type
        if remaining > 0:
            first_type = next(iter(weights), "mcq")
            result[first_type] = result.get(first_type, 0) + remaining
        return result

    async def get_pool_status(self, topic: str) -> Dict[str, Any]:
        """Get pool status for a topic — used by the pool-status endpoint."""
        result = await self.db.execute(
            select(
                ContentItem.content_type,
                func.count(ContentItem.id),
            )
            .where(
                and_(
                    ContentItem.topic == topic,
                    ContentItem.is_active.is_(True),
                )
            )
            .group_by(ContentItem.content_type)
        )
        by_type = {row[0]: row[1] for row in result.all()}

        concepts_result = await self.db.execute(
            select(ContentItem.concept)
            .where(
                and_(
                    ContentItem.topic == topic,
                    ContentItem.is_active.is_(True),
                )
            )
            .distinct()
        )
        concepts = [row[0] for row in concepts_result.all()]

        total = sum(by_type.values())
        return {
            "topic": topic,
            "total_items": total,
            "by_type": by_type,
            "concepts": concepts,
        }

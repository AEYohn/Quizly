# Student Library & Study Material Creator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified "My Library" for students to create, organize, and study quizzes, flashcards, notes, and games in collections.

**Architecture:** Backend uses SQLAlchemy async models with FastAPI routes. Frontend uses Next.js App Router with Clerk auth. Content types share a base StudyItem model. Collections are many-to-many with StudyItems via join table.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Next.js 15, React 18, Tailwind CSS, Clerk auth, lucide-react icons.

---

## Phase 1: Database Models

### Task 1: Create StudyItem Base Model

**Files:**
- Modify: `backend/app/db_models.py`

**Step 1: Add StudyItem model to db_models.py**

Add after the existing models (around line 200+):

```python
class StudyItem(Base):
    """Base model for all student-created study content."""
    __tablename__ = "study_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # quiz, flashcard_deck, note, game
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(String(20), default="private")  # private, class, public
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual, ai, import

    # Stats
    times_studied: Mapped[int] = mapped_column(Integer, default=0)
    last_studied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="study_items")
    collection_items: Mapped[List["CollectionItem"]] = relationship(back_populates="study_item", cascade="all, delete-orphan")
```

**Step 2: Add relationship to User model**

Find the User class and add:

```python
    # In User class, add to relationships section:
    study_items: Mapped[List["StudyItem"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
```

**Step 3: Verify model compiles**

Run: `cd backend && python -c "from app.db_models import StudyItem; print('OK')"`

Expected: `OK`

**Step 4: Commit**

```bash
git add backend/app/db_models.py
git commit -m "feat(models): add StudyItem base model for student content"
```

---

### Task 2: Create FlashcardDeck and Flashcard Models

**Files:**
- Modify: `backend/app/db_models.py`

**Step 1: Add FlashcardDeck model**

Add after StudyItem:

```python
class FlashcardDeck(Base):
    """Flashcard deck extending StudyItem."""
    __tablename__ = "flashcard_decks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_items.id", ondelete="CASCADE"), nullable=False, unique=True)
    study_mode: Mapped[str] = mapped_column(String(20), default="classic")  # classic, shuffle, spaced

    # Stats
    cards_mastered: Mapped[int] = mapped_column(Integer, default=0)
    cards_struggling: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    study_item: Mapped["StudyItem"] = relationship()
    cards: Mapped[List["Flashcard"]] = relationship(back_populates="deck", cascade="all, delete-orphan")


class Flashcard(Base):
    """Individual flashcard in a deck."""
    __tablename__ = "flashcards"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    deck_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("flashcard_decks.id", ondelete="CASCADE"), nullable=False)
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Spaced repetition
    mastery_level: Mapped[int] = mapped_column(Integer, default=0)  # 0-5
    next_review_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    deck: Mapped["FlashcardDeck"] = relationship(back_populates="cards")
```

**Step 2: Verify models compile**

Run: `cd backend && python -c "from app.db_models import FlashcardDeck, Flashcard; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/db_models.py
git commit -m "feat(models): add FlashcardDeck and Flashcard models"
```

---

### Task 3: Create StudyNote Model

**Files:**
- Modify: `backend/app/db_models.py`

**Step 1: Add StudyNote model**

```python
class StudyNote(Base):
    """Study notes with rich markdown content."""
    __tablename__ = "study_notes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_items.id", ondelete="CASCADE"), nullable=False, unique=True)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    attachments: Mapped[Optional[List[dict]]] = mapped_column(JSON, default=list)  # [{url, type, name}]
    highlighted_terms: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)

    # Relationships
    study_item: Mapped["StudyItem"] = relationship()
```

**Step 2: Verify model compiles**

Run: `cd backend && python -c "from app.db_models import StudyNote; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/db_models.py
git commit -m "feat(models): add StudyNote model"
```

---

### Task 4: Create GameContent Model

**Files:**
- Modify: `backend/app/db_models.py`

**Step 1: Add GameContent model**

```python
class GameContent(Base):
    """Template-based game content."""
    __tablename__ = "game_contents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    study_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_items.id", ondelete="CASCADE"), nullable=False, unique=True)
    template_type: Mapped[str] = mapped_column(String(30), nullable=False)  # match_pairs, fill_blank, sort_it
    game_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    # game_data structure:
    # match_pairs: {pairs: [{term, definition}]}
    # fill_blank: {sentences: [{text, blanks: [{position, answer}]}]}
    # sort_it: {categories: [{name, items: []}]}

    # Stats
    best_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    best_time_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    study_item: Mapped["StudyItem"] = relationship()
```

**Step 2: Verify model compiles**

Run: `cd backend && python -c "from app.db_models import GameContent; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/db_models.py
git commit -m "feat(models): add GameContent model for template games"
```

---

### Task 5: Create Collection and CollectionItem Models

**Files:**
- Modify: `backend/app/db_models.py`

**Step 1: Add Collection and CollectionItem models**

```python
class Collection(Base):
    """Curated collection of study items."""
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_color: Mapped[str] = mapped_column(String(20), default="#3B82F6")  # Tailwind blue-500
    visibility: Mapped[str] = mapped_column(String(20), default="private")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="collections")
    items: Mapped[List["CollectionItem"]] = relationship(back_populates="collection", cascade="all, delete-orphan", order_by="CollectionItem.position")


class CollectionItem(Base):
    """Join table for Collection <-> StudyItem many-to-many."""
    __tablename__ = "collection_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    study_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_items.id", ondelete="CASCADE"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    collection: Mapped["Collection"] = relationship(back_populates="items")
    study_item: Mapped["StudyItem"] = relationship(back_populates="collection_items")

    __table_args__ = (
        # Prevent duplicate items in same collection
        {"sqlite_autoincrement": True},
    )
```

**Step 2: Add relationship to User model**

Find User class and add:

```python
    collections: Mapped[List["Collection"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
```

**Step 3: Verify models compile**

Run: `cd backend && python -c "from app.db_models import Collection, CollectionItem; print('OK')"`

Expected: `OK`

**Step 4: Commit**

```bash
git add backend/app/db_models.py
git commit -m "feat(models): add Collection and CollectionItem models"
```

---

### Task 6: Create StudySession Model

**Files:**
- Modify: `backend/app/db_models.py`

**Step 1: Add StudySession model**

```python
class LibraryStudySession(Base):
    """Tracks progress through a collection study session."""
    __tablename__ = "library_study_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)

    current_item_index: Mapped[int] = mapped_column(Integer, default=0)
    items_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_items: Mapped[int] = mapped_column(Integer, nullable=False)

    # Progress per item: {item_id: {score, time_spent, completed}}
    progress: Mapped[dict] = mapped_column(JSON, default=dict)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship()
    collection: Mapped["Collection"] = relationship()
```

**Step 2: Verify model compiles**

Run: `cd backend && python -c "from app.db_models import LibraryStudySession; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/db_models.py
git commit -m "feat(models): add LibraryStudySession for collection progress"
```

---

## Phase 2: Backend API Routes

### Task 7: Create Library Routes File Structure

**Files:**
- Create: `backend/app/routes/library_routes.py`

**Step 1: Create the routes file with imports and router**

```python
"""Student library routes for study items and collections."""
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..auth_clerk import get_current_user_clerk
from ..db_models import (
    User, StudyItem, FlashcardDeck, Flashcard,
    StudyNote, GameContent, Collection, CollectionItem, LibraryStudySession
)

router = APIRouter()


# ============ Pydantic Schemas ============

class StudyItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    visibility: str = Field(default="private")
    tags: List[str] = Field(default_factory=list)


class StudyItemResponse(BaseModel):
    id: str
    type: str
    title: str
    description: Optional[str]
    visibility: str
    tags: List[str]
    source: str
    times_studied: int
    last_studied_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudyItemListResponse(BaseModel):
    items: List[StudyItemResponse]
    total: int
```

**Step 2: Verify file imports correctly**

Run: `cd backend && python -c "from app.routes.library_routes import router; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/routes/library_routes.py
git commit -m "feat(routes): create library_routes.py with base schemas"
```

---

### Task 8: Add StudyItem CRUD Endpoints

**Files:**
- Modify: `backend/app/routes/library_routes.py`

**Step 1: Add list and get endpoints**

Add after the schemas:

```python
# ============ Study Items Endpoints ============

@router.get("/items", response_model=StudyItemListResponse)
async def list_study_items(
    type: Optional[str] = None,
    visibility: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """List all study items for current user."""
    query = select(StudyItem).where(StudyItem.owner_id == current_user.id)

    if type:
        query = query.where(StudyItem.type == type)
    if visibility:
        query = query.where(StudyItem.visibility == visibility)

    query = query.order_by(StudyItem.updated_at.desc())

    result = await db.execute(query)
    items = result.scalars().all()

    return StudyItemListResponse(
        items=[StudyItemResponse(id=str(i.id), **{
            k: getattr(i, k) for k in StudyItemResponse.model_fields if k != 'id'
        }) for i in items],
        total=len(items)
    )


@router.get("/items/{item_id}", response_model=StudyItemResponse)
async def get_study_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Get a specific study item."""
    result = await db.execute(
        select(StudyItem).where(StudyItem.id == item_id)
    )
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Study item not found")

    # Check access
    if item.owner_id != current_user.id and item.visibility == "private":
        raise HTTPException(status_code=403, detail="Access denied")

    return StudyItemResponse(id=str(item.id), **{
        k: getattr(item, k) for k in StudyItemResponse.model_fields if k != 'id'
    })


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Delete a study item."""
    result = await db.execute(
        select(StudyItem).where(StudyItem.id == item_id)
    )
    item = result.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Study item not found")

    if item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(item)
    await db.commit()
```

**Step 2: Verify endpoints compile**

Run: `cd backend && python -c "from app.routes.library_routes import list_study_items, get_study_item, delete_study_item; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/routes/library_routes.py
git commit -m "feat(routes): add study item list, get, delete endpoints"
```

---

### Task 9: Add Flashcard Deck Endpoints

**Files:**
- Modify: `backend/app/routes/library_routes.py`

**Step 1: Add flashcard schemas**

Add to schemas section:

```python
class FlashcardCreate(BaseModel):
    front: str = Field(..., min_length=1)
    back: str = Field(..., min_length=1)
    image_url: Optional[str] = None


class FlashcardResponse(BaseModel):
    id: str
    front: str
    back: str
    image_url: Optional[str]
    position: int
    mastery_level: int
    next_review_at: Optional[datetime]

    class Config:
        from_attributes = True


class FlashcardDeckCreate(StudyItemBase):
    cards: List[FlashcardCreate] = Field(default_factory=list)
    study_mode: str = Field(default="classic")


class FlashcardDeckResponse(StudyItemResponse):
    study_mode: str
    cards_mastered: int
    cards_struggling: int
    cards: List[FlashcardResponse]
```

**Step 2: Add flashcard deck create endpoint**

```python
@router.post("/flashcard-decks", response_model=FlashcardDeckResponse, status_code=status.HTTP_201_CREATED)
async def create_flashcard_deck(
    request: FlashcardDeckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Create a new flashcard deck."""
    # Create study item
    study_item = StudyItem(
        owner_id=current_user.id,
        type="flashcard_deck",
        title=request.title,
        description=request.description,
        visibility=request.visibility,
        tags=request.tags,
        source="manual"
    )
    db.add(study_item)
    await db.flush()

    # Create deck
    deck = FlashcardDeck(
        study_item_id=study_item.id,
        study_mode=request.study_mode
    )
    db.add(deck)
    await db.flush()

    # Create cards
    cards = []
    for i, card_data in enumerate(request.cards):
        card = Flashcard(
            deck_id=deck.id,
            front=card_data.front,
            back=card_data.back,
            image_url=card_data.image_url,
            position=i
        )
        db.add(card)
        cards.append(card)

    await db.commit()
    await db.refresh(study_item)
    await db.refresh(deck)

    return FlashcardDeckResponse(
        id=str(study_item.id),
        type=study_item.type,
        title=study_item.title,
        description=study_item.description,
        visibility=study_item.visibility,
        tags=study_item.tags,
        source=study_item.source,
        times_studied=study_item.times_studied,
        last_studied_at=study_item.last_studied_at,
        created_at=study_item.created_at,
        updated_at=study_item.updated_at,
        study_mode=deck.study_mode,
        cards_mastered=deck.cards_mastered,
        cards_struggling=deck.cards_struggling,
        cards=[FlashcardResponse(id=str(c.id), **{
            k: getattr(c, k) for k in FlashcardResponse.model_fields if k != 'id'
        }) for c in cards]
    )


@router.get("/flashcard-decks/{item_id}", response_model=FlashcardDeckResponse)
async def get_flashcard_deck(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Get a flashcard deck with all cards."""
    result = await db.execute(
        select(StudyItem).where(
            StudyItem.id == item_id,
            StudyItem.type == "flashcard_deck"
        )
    )
    study_item = result.scalars().first()

    if not study_item:
        raise HTTPException(status_code=404, detail="Flashcard deck not found")

    if study_item.owner_id != current_user.id and study_item.visibility == "private":
        raise HTTPException(status_code=403, detail="Access denied")

    # Get deck and cards
    deck_result = await db.execute(
        select(FlashcardDeck)
        .where(FlashcardDeck.study_item_id == item_id)
        .options(selectinload(FlashcardDeck.cards))
    )
    deck = deck_result.scalars().first()

    return FlashcardDeckResponse(
        id=str(study_item.id),
        type=study_item.type,
        title=study_item.title,
        description=study_item.description,
        visibility=study_item.visibility,
        tags=study_item.tags,
        source=study_item.source,
        times_studied=study_item.times_studied,
        last_studied_at=study_item.last_studied_at,
        created_at=study_item.created_at,
        updated_at=study_item.updated_at,
        study_mode=deck.study_mode,
        cards_mastered=deck.cards_mastered,
        cards_struggling=deck.cards_struggling,
        cards=[FlashcardResponse(id=str(c.id), **{
            k: getattr(c, k) for k in FlashcardResponse.model_fields if k != 'id'
        }) for c in sorted(deck.cards, key=lambda x: x.position)]
    )
```

**Step 3: Commit**

```bash
git add backend/app/routes/library_routes.py
git commit -m "feat(routes): add flashcard deck create and get endpoints"
```

---

### Task 10: Add Study Note Endpoints

**Files:**
- Modify: `backend/app/routes/library_routes.py`

**Step 1: Add note schemas**

```python
class StudyNoteCreate(StudyItemBase):
    content_markdown: str = Field(default="")
    attachments: List[dict] = Field(default_factory=list)


class StudyNoteResponse(StudyItemResponse):
    content_markdown: str
    attachments: List[dict]
    highlighted_terms: List[str]
```

**Step 2: Add note endpoints**

```python
@router.post("/notes", response_model=StudyNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_study_note(
    request: StudyNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Create a new study note."""
    study_item = StudyItem(
        owner_id=current_user.id,
        type="note",
        title=request.title,
        description=request.description,
        visibility=request.visibility,
        tags=request.tags,
        source="manual"
    )
    db.add(study_item)
    await db.flush()

    note = StudyNote(
        study_item_id=study_item.id,
        content_markdown=request.content_markdown,
        attachments=request.attachments
    )
    db.add(note)
    await db.commit()
    await db.refresh(study_item)
    await db.refresh(note)

    return StudyNoteResponse(
        id=str(study_item.id),
        type=study_item.type,
        title=study_item.title,
        description=study_item.description,
        visibility=study_item.visibility,
        tags=study_item.tags,
        source=study_item.source,
        times_studied=study_item.times_studied,
        last_studied_at=study_item.last_studied_at,
        created_at=study_item.created_at,
        updated_at=study_item.updated_at,
        content_markdown=note.content_markdown,
        attachments=note.attachments or [],
        highlighted_terms=note.highlighted_terms or []
    )


@router.get("/notes/{item_id}", response_model=StudyNoteResponse)
async def get_study_note(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Get a study note."""
    result = await db.execute(
        select(StudyItem).where(
            StudyItem.id == item_id,
            StudyItem.type == "note"
        )
    )
    study_item = result.scalars().first()

    if not study_item:
        raise HTTPException(status_code=404, detail="Study note not found")

    if study_item.owner_id != current_user.id and study_item.visibility == "private":
        raise HTTPException(status_code=403, detail="Access denied")

    note_result = await db.execute(
        select(StudyNote).where(StudyNote.study_item_id == item_id)
    )
    note = note_result.scalars().first()

    return StudyNoteResponse(
        id=str(study_item.id),
        type=study_item.type,
        title=study_item.title,
        description=study_item.description,
        visibility=study_item.visibility,
        tags=study_item.tags,
        source=study_item.source,
        times_studied=study_item.times_studied,
        last_studied_at=study_item.last_studied_at,
        created_at=study_item.created_at,
        updated_at=study_item.updated_at,
        content_markdown=note.content_markdown,
        attachments=note.attachments or [],
        highlighted_terms=note.highlighted_terms or []
    )


@router.patch("/notes/{item_id}", response_model=StudyNoteResponse)
async def update_study_note(
    item_id: uuid.UUID,
    request: StudyNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Update a study note."""
    result = await db.execute(
        select(StudyItem).where(StudyItem.id == item_id)
    )
    study_item = result.scalars().first()

    if not study_item or study_item.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Study note not found")

    # Update study item
    study_item.title = request.title
    study_item.description = request.description
    study_item.visibility = request.visibility
    study_item.tags = request.tags

    # Update note
    note_result = await db.execute(
        select(StudyNote).where(StudyNote.study_item_id == item_id)
    )
    note = note_result.scalars().first()
    note.content_markdown = request.content_markdown
    note.attachments = request.attachments

    await db.commit()
    await db.refresh(study_item)
    await db.refresh(note)

    return StudyNoteResponse(
        id=str(study_item.id),
        type=study_item.type,
        title=study_item.title,
        description=study_item.description,
        visibility=study_item.visibility,
        tags=study_item.tags,
        source=study_item.source,
        times_studied=study_item.times_studied,
        last_studied_at=study_item.last_studied_at,
        created_at=study_item.created_at,
        updated_at=study_item.updated_at,
        content_markdown=note.content_markdown,
        attachments=note.attachments or [],
        highlighted_terms=note.highlighted_terms or []
    )
```

**Step 3: Commit**

```bash
git add backend/app/routes/library_routes.py
git commit -m "feat(routes): add study note CRUD endpoints"
```

---

### Task 11: Add Game Content Endpoints

**Files:**
- Modify: `backend/app/routes/library_routes.py`

**Step 1: Add game schemas**

```python
class GameContentCreate(StudyItemBase):
    template_type: str = Field(...)  # match_pairs, fill_blank, sort_it
    game_data: dict = Field(...)


class GameContentResponse(StudyItemResponse):
    template_type: str
    game_data: dict
    best_score: Optional[int]
    best_time_seconds: Optional[int]
```

**Step 2: Add game endpoints**

```python
@router.post("/games", response_model=GameContentResponse, status_code=status.HTTP_201_CREATED)
async def create_game_content(
    request: GameContentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Create a new game."""
    if request.template_type not in ["match_pairs", "fill_blank", "sort_it"]:
        raise HTTPException(status_code=400, detail="Invalid template type")

    study_item = StudyItem(
        owner_id=current_user.id,
        type="game",
        title=request.title,
        description=request.description,
        visibility=request.visibility,
        tags=request.tags,
        source="manual"
    )
    db.add(study_item)
    await db.flush()

    game = GameContent(
        study_item_id=study_item.id,
        template_type=request.template_type,
        game_data=request.game_data
    )
    db.add(game)
    await db.commit()
    await db.refresh(study_item)
    await db.refresh(game)

    return GameContentResponse(
        id=str(study_item.id),
        type=study_item.type,
        title=study_item.title,
        description=study_item.description,
        visibility=study_item.visibility,
        tags=study_item.tags,
        source=study_item.source,
        times_studied=study_item.times_studied,
        last_studied_at=study_item.last_studied_at,
        created_at=study_item.created_at,
        updated_at=study_item.updated_at,
        template_type=game.template_type,
        game_data=game.game_data,
        best_score=game.best_score,
        best_time_seconds=game.best_time_seconds
    )


@router.get("/games/{item_id}", response_model=GameContentResponse)
async def get_game_content(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Get a game."""
    result = await db.execute(
        select(StudyItem).where(
            StudyItem.id == item_id,
            StudyItem.type == "game"
        )
    )
    study_item = result.scalars().first()

    if not study_item:
        raise HTTPException(status_code=404, detail="Game not found")

    if study_item.owner_id != current_user.id and study_item.visibility == "private":
        raise HTTPException(status_code=403, detail="Access denied")

    game_result = await db.execute(
        select(GameContent).where(GameContent.study_item_id == item_id)
    )
    game = game_result.scalars().first()

    return GameContentResponse(
        id=str(study_item.id),
        type=study_item.type,
        title=study_item.title,
        description=study_item.description,
        visibility=study_item.visibility,
        tags=study_item.tags,
        source=study_item.source,
        times_studied=study_item.times_studied,
        last_studied_at=study_item.last_studied_at,
        created_at=study_item.created_at,
        updated_at=study_item.updated_at,
        template_type=game.template_type,
        game_data=game.game_data,
        best_score=game.best_score,
        best_time_seconds=game.best_time_seconds
    )
```

**Step 3: Commit**

```bash
git add backend/app/routes/library_routes.py
git commit -m "feat(routes): add game content create and get endpoints"
```

---

### Task 12: Add Collection CRUD Endpoints

**Files:**
- Modify: `backend/app/routes/library_routes.py`

**Step 1: Add collection schemas**

```python
class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    cover_color: str = Field(default="#3B82F6")
    visibility: str = Field(default="private")


class CollectionItemResponse(BaseModel):
    id: str
    study_item: StudyItemResponse
    position: int
    added_at: datetime

    class Config:
        from_attributes = True


class CollectionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    cover_color: str
    visibility: str
    created_at: datetime
    updated_at: datetime
    item_count: int
    items: List[CollectionItemResponse] = []

    class Config:
        from_attributes = True


class CollectionListResponse(BaseModel):
    collections: List[CollectionResponse]
    total: int
```

**Step 2: Add collection endpoints**

```python
@router.get("/collections", response_model=CollectionListResponse)
async def list_collections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """List all collections for current user."""
    result = await db.execute(
        select(Collection)
        .where(Collection.owner_id == current_user.id)
        .options(selectinload(Collection.items))
        .order_by(Collection.updated_at.desc())
    )
    collections = result.scalars().all()

    return CollectionListResponse(
        collections=[CollectionResponse(
            id=str(c.id),
            name=c.name,
            description=c.description,
            cover_color=c.cover_color,
            visibility=c.visibility,
            created_at=c.created_at,
            updated_at=c.updated_at,
            item_count=len(c.items),
            items=[]  # Don't include items in list view
        ) for c in collections],
        total=len(collections)
    )


@router.post("/collections", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    request: CollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Create a new collection."""
    collection = Collection(
        owner_id=current_user.id,
        name=request.name,
        description=request.description,
        cover_color=request.cover_color,
        visibility=request.visibility
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    return CollectionResponse(
        id=str(collection.id),
        name=collection.name,
        description=collection.description,
        cover_color=collection.cover_color,
        visibility=collection.visibility,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        item_count=0,
        items=[]
    )


@router.get("/collections/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Get a collection with all items."""
    result = await db.execute(
        select(Collection)
        .where(Collection.id == collection_id)
        .options(
            selectinload(Collection.items).selectinload(CollectionItem.study_item)
        )
    )
    collection = result.scalars().first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if collection.owner_id != current_user.id and collection.visibility == "private":
        raise HTTPException(status_code=403, detail="Access denied")

    items_response = []
    for ci in sorted(collection.items, key=lambda x: x.position):
        si = ci.study_item
        items_response.append(CollectionItemResponse(
            id=str(ci.id),
            study_item=StudyItemResponse(
                id=str(si.id),
                type=si.type,
                title=si.title,
                description=si.description,
                visibility=si.visibility,
                tags=si.tags,
                source=si.source,
                times_studied=si.times_studied,
                last_studied_at=si.last_studied_at,
                created_at=si.created_at,
                updated_at=si.updated_at
            ),
            position=ci.position,
            added_at=ci.added_at
        ))

    return CollectionResponse(
        id=str(collection.id),
        name=collection.name,
        description=collection.description,
        cover_color=collection.cover_color,
        visibility=collection.visibility,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        item_count=len(collection.items),
        items=items_response
    )


@router.delete("/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Delete a collection (items are not deleted)."""
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = result.scalars().first()

    if not collection or collection.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Collection not found")

    await db.delete(collection)
    await db.commit()


@router.post("/collections/{collection_id}/items", status_code=status.HTTP_201_CREATED)
async def add_item_to_collection(
    collection_id: uuid.UUID,
    study_item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Add a study item to a collection."""
    # Verify collection ownership
    col_result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = col_result.scalars().first()

    if not collection or collection.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Verify study item ownership
    item_result = await db.execute(
        select(StudyItem).where(StudyItem.id == study_item_id)
    )
    study_item = item_result.scalars().first()

    if not study_item or study_item.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Study item not found")

    # Check if already in collection
    existing = await db.execute(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.study_item_id == study_item_id
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Item already in collection")

    # Get max position
    max_pos_result = await db.execute(
        select(CollectionItem.position)
        .where(CollectionItem.collection_id == collection_id)
        .order_by(CollectionItem.position.desc())
        .limit(1)
    )
    max_pos = max_pos_result.scalars().first() or -1

    collection_item = CollectionItem(
        collection_id=collection_id,
        study_item_id=study_item_id,
        position=max_pos + 1
    )
    db.add(collection_item)
    await db.commit()

    return {"message": "Item added to collection"}


@router.delete("/collections/{collection_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_item_from_collection(
    collection_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_clerk)
):
    """Remove a study item from a collection."""
    # Verify collection ownership
    col_result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = col_result.scalars().first()

    if not collection or collection.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Find and delete collection item
    ci_result = await db.execute(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.study_item_id == item_id
        )
    )
    collection_item = ci_result.scalars().first()

    if not collection_item:
        raise HTTPException(status_code=404, detail="Item not in collection")

    await db.delete(collection_item)
    await db.commit()
```

**Step 3: Commit**

```bash
git add backend/app/routes/library_routes.py
git commit -m "feat(routes): add collection CRUD and item management endpoints"
```

---

### Task 13: Register Routes in Main App

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Import and register library routes**

Find the imports section and add:

```python
from .routes import library_routes
```

Find where routers are included and add:

```python
app.include_router(
    library_routes.router,
    prefix="/library",
    tags=["library"]
)
```

**Step 2: Verify app starts**

Run: `cd backend && python -c "from app.main import app; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(routes): register library routes in main app"
```

---

## Phase 3: Frontend - Library Page

### Task 14: Create Library Page Structure

**Files:**
- Create: `frontend/src/app/student/library/page.tsx`

**Step 1: Create the library page**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import {
    Loader2, Plus, Search, Filter, Grid, List,
    BookOpen, StickyNote, Gamepad2, Layers,
    MoreVertical, Trash2, FolderPlus
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StudyItem {
    id: string;
    type: string;
    title: string;
    description: string | null;
    visibility: string;
    tags: string[];
    times_studied: number;
    last_studied_at: string | null;
    created_at: string;
    updated_at: string;
}

interface Collection {
    id: string;
    name: string;
    description: string | null;
    cover_color: string;
    item_count: number;
    created_at: string;
}

const typeIcons: Record<string, typeof BookOpen> = {
    flashcard_deck: BookOpen,
    note: StickyNote,
    game: Gamepad2,
    quiz: Layers,
};

const typeLabels: Record<string, string> = {
    flashcard_deck: "Flashcards",
    note: "Notes",
    game: "Game",
    quiz: "Quiz",
};

export default function LibraryPage() {
    const router = useRouter();
    const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
    const { token } = useAuth();

    const [items, setItems] = useState<StudyItem[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    useEffect(() => {
        if (clerkLoaded && !clerkUser) {
            router.push("/student");
            return;
        }
        if (token) {
            fetchData();
        }
    }, [token, clerkLoaded, clerkUser]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [itemsRes, collectionsRes] = await Promise.all([
                fetch(`${API_URL}/library/items`, {
                    headers: { "Authorization": `Bearer ${token}` }
                }),
                fetch(`${API_URL}/library/collections`, {
                    headers: { "Authorization": `Bearer ${token}` }
                })
            ]);

            if (!itemsRes.ok || !collectionsRes.ok) {
                throw new Error("Failed to fetch library data");
            }

            const itemsData = await itemsRes.json();
            const collectionsData = await collectionsRes.json();

            setItems(itemsData.items);
            setCollections(collectionsData.collections);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm("Delete this item?")) return;

        try {
            const res = await fetch(`${API_URL}/library/items/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setItems(prev => prev.filter(i => i.id !== id));
            }
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = !filterType || item.type === filterType;
        return matchesSearch && matchesType;
    });

    if (!clerkLoaded || loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="flex">
                {/* Sidebar - Collections */}
                <aside className="w-64 border-r border-gray-800 p-4 min-h-screen">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Collections</h2>
                        <Link
                            href="/student/library/collection/new"
                            className="p-1 hover:bg-gray-800 rounded"
                        >
                            <Plus className="w-5 h-5" />
                        </Link>
                    </div>

                    <div className="space-y-2">
                        {collections.map(collection => (
                            <Link
                                key={collection.id}
                                href={`/student/library/collection/${collection.id}`}
                                className="flex items-center gap-3 p-2 rounded hover:bg-gray-800"
                            >
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: collection.cover_color }}
                                />
                                <span className="flex-1 truncate">{collection.name}</span>
                                <span className="text-xs text-gray-500">{collection.item_count}</span>
                            </Link>
                        ))}

                        {collections.length === 0 && (
                            <p className="text-sm text-gray-500 p-2">
                                No collections yet
                            </p>
                        )}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold">My Library</h1>
                        <Link
                            href="/student/create"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >
                            <Plus className="w-5 h-5" />
                            Create
                        </Link>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search your library..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <select
                            value={filterType || ""}
                            onChange={(e) => setFilterType(e.target.value || null)}
                            className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg"
                        >
                            <option value="">All Types</option>
                            <option value="flashcard_deck">Flashcards</option>
                            <option value="note">Notes</option>
                            <option value="game">Games</option>
                            <option value="quiz">Quizzes</option>
                        </select>

                        <div className="flex border border-gray-800 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-2 ${viewMode === "grid" ? "bg-gray-800" : "hover:bg-gray-800"}`}
                            >
                                <Grid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-2 ${viewMode === "list" ? "bg-gray-800" : "hover:bg-gray-800"}`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    {/* Items Grid/List */}
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-12">
                            <Layers className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                            <h3 className="text-lg font-semibold mb-2">No items yet</h3>
                            <p className="text-gray-500 mb-4">Create your first study material</p>
                            <Link
                                href="/student/create"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                            >
                                <Plus className="w-5 h-5" />
                                Create
                            </Link>
                        </div>
                    ) : (
                        <div className={viewMode === "grid"
                            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                            : "space-y-2"
                        }>
                            {filteredItems.map(item => {
                                const Icon = typeIcons[item.type] || Layers;
                                return (
                                    <div
                                        key={item.id}
                                        className={`bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors ${
                                            viewMode === "list" ? "flex items-center gap-4" : ""
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${viewMode === "grid" ? "mb-3" : ""}`}>
                                            <div className="p-2 bg-gray-800 rounded-lg">
                                                <Icon className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <Link
                                                    href={`/student/study/${item.type}/${item.id}`}
                                                    className="font-semibold hover:text-blue-400 truncate block"
                                                >
                                                    {item.title}
                                                </Link>
                                                <span className="text-xs text-gray-500">
                                                    {typeLabels[item.type]}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteItem(item.id)}
                                                className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {viewMode === "grid" && (
                                            <>
                                                {item.description && (
                                                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                                                        {item.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center justify-between text-xs text-gray-500">
                                                    <span>Studied {item.times_studied}x</span>
                                                    <span>
                                                        {new Date(item.updated_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
```

**Step 2: Verify file compiles**

Run: `cd frontend && npx tsc --noEmit src/app/student/library/page.tsx 2>&1 | head -20`

Expected: No errors (or just warnings)

**Step 3: Commit**

```bash
git add frontend/src/app/student/library/page.tsx
git commit -m "feat(frontend): create library page with items and collections"
```

---

### Task 15: Create Content Creation Hub Page

**Files:**
- Create: `frontend/src/app/student/create/page.tsx`

**Step 1: Create the creation hub page**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
    BookOpen, StickyNote, Gamepad2, Layers,
    Upload, Sparkles, ArrowLeft
} from "lucide-react";

const contentTypes = [
    {
        id: "flashcards",
        title: "Flashcard Deck",
        description: "Create cards to memorize terms, definitions, and concepts",
        icon: BookOpen,
        href: "/student/create/flashcards",
        color: "bg-blue-600"
    },
    {
        id: "notes",
        title: "Study Notes",
        description: "Write and organize your notes with rich formatting",
        icon: StickyNote,
        href: "/student/create/notes",
        color: "bg-green-600"
    },
    {
        id: "game",
        title: "Learning Game",
        description: "Create fun games to practice and test yourself",
        icon: Gamepad2,
        href: "/student/create/game",
        color: "bg-purple-600"
    },
    {
        id: "quiz",
        title: "Practice Quiz",
        description: "Build quizzes with multiple choice questions",
        icon: Layers,
        href: "/student/create/quiz",
        color: "bg-orange-600"
    }
];

const quickActions = [
    {
        id: "ai-generate",
        title: "Generate with AI",
        description: "Describe a topic and let AI create study materials for you",
        icon: Sparkles,
        href: "/student/create/ai"
    },
    {
        id: "import",
        title: "Import Content",
        description: "Upload PDFs, images, or paste text to convert into study materials",
        icon: Upload,
        href: "/student/create/import"
    }
];

export default function CreatePage() {
    const router = useRouter();
    const { user: clerkUser, isLoaded } = useUser();

    if (isLoaded && !clerkUser) {
        router.push("/student");
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/student/library"
                        className="p-2 hover:bg-gray-800 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Create New</h1>
                        <p className="text-gray-400">Choose what you want to create</p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quickActions.map(action => (
                            <Link
                                key={action.id}
                                href={action.href}
                                className="flex items-start gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500 transition-colors"
                            >
                                <div className="p-3 bg-blue-600/20 rounded-lg">
                                    <action.icon className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">{action.title}</h3>
                                    <p className="text-sm text-gray-400">{action.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Content Types */}
                <div>
                    <h2 className="text-lg font-semibold mb-4">Create from Scratch</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contentTypes.map(type => (
                            <Link
                                key={type.id}
                                href={type.href}
                                className="flex items-start gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors group"
                            >
                                <div className={`p-3 ${type.color} rounded-lg`}>
                                    <type.icon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1 group-hover:text-blue-400 transition-colors">
                                        {type.title}
                                    </h3>
                                    <p className="text-sm text-gray-400">{type.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/student/create/page.tsx
git commit -m "feat(frontend): create content creation hub page"
```

---

### Task 16: Create Flashcard Deck Builder Page

**Files:**
- Create: `frontend/src/app/student/create/flashcards/page.tsx`

**Step 1: Create the flashcard builder**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import {
    ArrowLeft, Plus, Trash2, Save, Loader2,
    GripVertical, Sparkles
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Card {
    id: string;
    front: string;
    back: string;
}

export default function CreateFlashcardsPage() {
    const router = useRouter();
    const { token } = useAuth();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [cards, setCards] = useState<Card[]>([
        { id: "1", front: "", back: "" }
    ]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const addCard = () => {
        setCards([...cards, { id: Date.now().toString(), front: "", back: "" }]);
    };

    const removeCard = (id: string) => {
        if (cards.length === 1) return;
        setCards(cards.filter(c => c.id !== id));
    };

    const updateCard = (id: string, field: "front" | "back", value: string) => {
        setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Please enter a title");
            return;
        }

        const validCards = cards.filter(c => c.front.trim() && c.back.trim());
        if (validCards.length === 0) {
            setError("Please add at least one card with front and back content");
            return;
        }

        try {
            setSaving(true);
            setError("");

            const response = await fetch(`${API_URL}/library/flashcard-decks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    cards: validCards.map(c => ({
                        front: c.front.trim(),
                        back: c.back.trim()
                    }))
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to save");
            }

            const data = await response.json();
            router.push(`/student/library`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/student/create"
                            className="p-2 hover:bg-gray-800 rounded-lg"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-2xl font-bold">Create Flashcard Deck</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                    >
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        Save Deck
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Title and Description */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
                    <input
                        type="text"
                        placeholder="Deck Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full text-xl font-semibold bg-transparent border-none focus:outline-none mb-2"
                    />
                    <textarea
                        placeholder="Description (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="w-full bg-transparent border-none focus:outline-none text-gray-400 resize-none"
                    />
                </div>

                {/* Cards */}
                <div className="space-y-4 mb-6">
                    {cards.map((card, index) => (
                        <div
                            key={card.id}
                            className="bg-gray-900 border border-gray-800 rounded-lg p-4"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500">Card {index + 1}</span>
                                <button
                                    onClick={() => removeCard(card.id)}
                                    disabled={cards.length === 1}
                                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400 disabled:opacity-30"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Front</label>
                                    <textarea
                                        placeholder="Term or question"
                                        value={card.front}
                                        onChange={(e) => updateCard(card.id, "front", e.target.value)}
                                        rows={3}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Back</label>
                                    <textarea
                                        placeholder="Definition or answer"
                                        value={card.back}
                                        onChange={(e) => updateCard(card.id, "back", e.target.value)}
                                        rows={3}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Card Button */}
                <button
                    onClick={addCard}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-700 rounded-lg hover:border-gray-600 text-gray-400 hover:text-white transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Card
                </button>
            </div>
        </div>
    );
}
```

**Step 2: Create the directory**

Run: `mkdir -p frontend/src/app/student/create/flashcards`

**Step 3: Commit**

```bash
git add frontend/src/app/student/create/flashcards/page.tsx
git commit -m "feat(frontend): create flashcard deck builder page"
```

---

### Task 17: Create Study Notes Editor Page

**Files:**
- Create: `frontend/src/app/student/create/notes/page.tsx`

**Step 1: Create the notes editor**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CreateNotesPage() {
    const router = useRouter();
    const { token } = useAuth();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Please enter a title");
            return;
        }

        try {
            setSaving(true);
            setError("");

            const response = await fetch(`${API_URL}/library/notes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: title.trim(),
                    content_markdown: content
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to save");
            }

            router.push("/student/library");
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/student/create"
                            className="p-2 hover:bg-gray-800 rounded-lg"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-2xl font-bold">Create Study Notes</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                    >
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        Save Notes
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Editor */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg">
                    <input
                        type="text"
                        placeholder="Note Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full text-xl font-semibold bg-transparent border-b border-gray-800 p-4 focus:outline-none"
                    />
                    <textarea
                        placeholder="Start writing your notes... (Markdown supported)"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full min-h-[500px] bg-transparent p-4 focus:outline-none resize-none font-mono text-sm"
                    />
                </div>

                <p className="text-xs text-gray-500 mt-2">
                    Tip: Use Markdown for formatting. **bold**, *italic*, # headings, - lists
                </p>
            </div>
        </div>
    );
}
```

**Step 2: Create the directory**

Run: `mkdir -p frontend/src/app/student/create/notes`

**Step 3: Commit**

```bash
git add frontend/src/app/student/create/notes/page.tsx
git commit -m "feat(frontend): create study notes editor page"
```

---

### Task 18: Create Game Builder Page

**Files:**
- Create: `frontend/src/app/student/create/game/page.tsx`

**Step 1: Create the game builder**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import {
    ArrowLeft, Save, Loader2, Plus, Trash2,
    Layers, FileText, Grid3X3
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type TemplateType = "match_pairs" | "fill_blank" | "sort_it";

const templates = [
    {
        id: "match_pairs" as TemplateType,
        name: "Match Pairs",
        description: "Match terms with their definitions",
        icon: Grid3X3
    },
    {
        id: "fill_blank" as TemplateType,
        name: "Fill in the Blank",
        description: "Complete sentences with missing words",
        icon: FileText
    },
    {
        id: "sort_it" as TemplateType,
        name: "Sort It",
        description: "Sort items into the correct categories",
        icon: Layers
    }
];

interface MatchPair {
    id: string;
    term: string;
    definition: string;
}

interface FillBlankSentence {
    id: string;
    text: string;
    answer: string;
}

interface SortCategory {
    id: string;
    name: string;
    items: string[];
}

export default function CreateGamePage() {
    const router = useRouter();
    const { token } = useAuth();

    const [step, setStep] = useState<"template" | "content">("template");
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
    const [title, setTitle] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Match Pairs state
    const [pairs, setPairs] = useState<MatchPair[]>([
        { id: "1", term: "", definition: "" }
    ]);

    // Fill Blank state
    const [sentences, setSentences] = useState<FillBlankSentence[]>([
        { id: "1", text: "", answer: "" }
    ]);

    // Sort It state
    const [categories, setCategories] = useState<SortCategory[]>([
        { id: "1", name: "", items: [""] }
    ]);

    const selectTemplate = (template: TemplateType) => {
        setSelectedTemplate(template);
        setStep("content");
    };

    const buildGameData = () => {
        switch (selectedTemplate) {
            case "match_pairs":
                return {
                    pairs: pairs
                        .filter(p => p.term.trim() && p.definition.trim())
                        .map(p => ({ term: p.term.trim(), definition: p.definition.trim() }))
                };
            case "fill_blank":
                return {
                    sentences: sentences
                        .filter(s => s.text.trim() && s.answer.trim())
                        .map(s => ({
                            text: s.text.trim(),
                            blanks: [{ position: 0, answer: s.answer.trim() }]
                        }))
                };
            case "sort_it":
                return {
                    categories: categories
                        .filter(c => c.name.trim() && c.items.some(i => i.trim()))
                        .map(c => ({
                            name: c.name.trim(),
                            items: c.items.filter(i => i.trim())
                        }))
                };
            default:
                return {};
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Please enter a title");
            return;
        }

        const gameData = buildGameData();

        try {
            setSaving(true);
            setError("");

            const response = await fetch(`${API_URL}/library/games`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: title.trim(),
                    template_type: selectedTemplate,
                    game_data: gameData
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to save");
            }

            router.push("/student/library");
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    // Template Selection View
    if (step === "template") {
        return (
            <div className="min-h-screen bg-gray-950 text-white p-6">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-4 mb-8">
                        <Link href="/student/create" className="p-2 hover:bg-gray-800 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">Create a Game</h1>
                            <p className="text-gray-400">Choose a game template</p>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {templates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => selectTemplate(template.id)}
                                className="flex items-start gap-4 p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500 transition-colors text-left"
                            >
                                <div className="p-3 bg-purple-600/20 rounded-lg">
                                    <template.icon className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                                    <p className="text-gray-400">{template.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Content Editor View
    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setStep("template")} className="p-2 hover:bg-gray-800 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-2xl font-bold">
                            {templates.find(t => t.id === selectedTemplate)?.name}
                        </h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Save Game
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg mb-6">{error}</div>
                )}

                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
                    <input
                        type="text"
                        placeholder="Game Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full text-xl font-semibold bg-transparent border-none focus:outline-none"
                    />
                </div>

                {/* Match Pairs Editor */}
                {selectedTemplate === "match_pairs" && (
                    <div className="space-y-4">
                        {pairs.map((pair, index) => (
                            <div key={pair.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-gray-500">Pair {index + 1}</span>
                                    <button
                                        onClick={() => pairs.length > 1 && setPairs(pairs.filter(p => p.id !== pair.id))}
                                        className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Term"
                                        value={pair.term}
                                        onChange={(e) => setPairs(pairs.map(p => p.id === pair.id ? { ...p, term: e.target.value } : p))}
                                        className="bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Definition"
                                        value={pair.definition}
                                        onChange={(e) => setPairs(pairs.map(p => p.id === pair.id ? { ...p, definition: e.target.value } : p))}
                                        className="bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => setPairs([...pairs, { id: Date.now().toString(), term: "", definition: "" }])}
                            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-700 rounded-lg hover:border-gray-600 text-gray-400"
                        >
                            <Plus className="w-5 h-5" /> Add Pair
                        </button>
                    </div>
                )}

                {/* Fill Blank Editor */}
                {selectedTemplate === "fill_blank" && (
                    <div className="space-y-4">
                        {sentences.map((sentence, index) => (
                            <div key={sentence.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-gray-500">Sentence {index + 1}</span>
                                    <button
                                        onClick={() => sentences.length > 1 && setSentences(sentences.filter(s => s.id !== sentence.id))}
                                        className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Sentence with ____ for blank"
                                    value={sentence.text}
                                    onChange={(e) => setSentences(sentences.map(s => s.id === sentence.id ? { ...s, text: e.target.value } : s))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 mb-2 focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Correct answer"
                                    value={sentence.answer}
                                    onChange={(e) => setSentences(sentences.map(s => s.id === sentence.id ? { ...s, answer: e.target.value } : s))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        ))}
                        <button
                            onClick={() => setSentences([...sentences, { id: Date.now().toString(), text: "", answer: "" }])}
                            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-700 rounded-lg hover:border-gray-600 text-gray-400"
                        >
                            <Plus className="w-5 h-5" /> Add Sentence
                        </button>
                    </div>
                )}

                {/* Sort It Editor */}
                {selectedTemplate === "sort_it" && (
                    <div className="space-y-4">
                        {categories.map((category, catIndex) => (
                            <div key={category.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <input
                                        type="text"
                                        placeholder="Category name"
                                        value={category.name}
                                        onChange={(e) => setCategories(categories.map(c => c.id === category.id ? { ...c, name: e.target.value } : c))}
                                        className="bg-transparent font-semibold focus:outline-none"
                                    />
                                    <button
                                        onClick={() => categories.length > 1 && setCategories(categories.filter(c => c.id !== category.id))}
                                        className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {category.items.map((item, itemIndex) => (
                                        <div key={itemIndex} className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Item"
                                                value={item}
                                                onChange={(e) => {
                                                    const newItems = [...category.items];
                                                    newItems[itemIndex] = e.target.value;
                                                    setCategories(categories.map(c => c.id === category.id ? { ...c, items: newItems } : c));
                                                }}
                                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 focus:outline-none focus:border-blue-500"
                                            />
                                            <button
                                                onClick={() => {
                                                    if (category.items.length > 1) {
                                                        const newItems = category.items.filter((_, i) => i !== itemIndex);
                                                        setCategories(categories.map(c => c.id === category.id ? { ...c, items: newItems } : c));
                                                    }
                                                }}
                                                className="p-2 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setCategories(categories.map(c => c.id === category.id ? { ...c, items: [...c.items, ""] } : c))}
                                        className="text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        + Add item
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => setCategories([...categories, { id: Date.now().toString(), name: "", items: [""] }])}
                            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-700 rounded-lg hover:border-gray-600 text-gray-400"
                        >
                            <Plus className="w-5 h-5" /> Add Category
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
```

**Step 2: Create the directory**

Run: `mkdir -p frontend/src/app/student/create/game`

**Step 3: Commit**

```bash
git add frontend/src/app/student/create/game/page.tsx
git commit -m "feat(frontend): create game builder page with all templates"
```

---

### Task 19: Update Sidebar Navigation

**Files:**
- Modify: `frontend/src/components/ui/Sidebar.tsx`

**Step 1: Add Library link to student navigation**

Find the student navigation items section and add the Library link:

```typescript
// In the navigation items array for students, add:
{
    name: "My Library",
    href: "/student/library",
    icon: BookOpen,
}
```

Make sure `BookOpen` is imported from `lucide-react`.

**Step 2: Commit**

```bash
git add frontend/src/components/ui/Sidebar.tsx
git commit -m "feat(frontend): add library link to student sidebar"
```

---

## Phase 4: Study/Play Pages

### Task 20: Create Flashcard Study Page

**Files:**
- Create: `frontend/src/app/student/study/flashcard_deck/[id]/page.tsx`

**Step 1: Create flashcard study page**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import {
    ArrowLeft, ChevronLeft, ChevronRight,
    RotateCcw, Check, X, Loader2, Shuffle
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Flashcard {
    id: string;
    front: string;
    back: string;
    mastery_level: number;
}

interface FlashcardDeck {
    id: string;
    title: string;
    cards: Flashcard[];
}

export default function StudyFlashcardsPage() {
    const params = useParams();
    const router = useRouter();
    const { token } = useAuth();

    const [deck, setDeck] = useState<FlashcardDeck | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [shuffled, setShuffled] = useState(false);
    const [cardOrder, setCardOrder] = useState<number[]>([]);

    useEffect(() => {
        if (token && params.id) {
            fetchDeck();
        }
    }, [token, params.id]);

    const fetchDeck = async () => {
        try {
            const response = await fetch(`${API_URL}/library/flashcard-decks/${params.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Failed to fetch deck");

            const data = await response.json();
            setDeck(data);
            setCardOrder(data.cards.map((_: Flashcard, i: number) => i));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const shuffleCards = () => {
        const newOrder = [...cardOrder].sort(() => Math.random() - 0.5);
        setCardOrder(newOrder);
        setCurrentIndex(0);
        setIsFlipped(false);
        setShuffled(true);
    };

    const resetDeck = () => {
        setCardOrder(deck?.cards.map((_, i) => i) || []);
        setCurrentIndex(0);
        setIsFlipped(false);
        setShuffled(false);
    };

    const nextCard = () => {
        if (currentIndex < cardOrder.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
        }
    };

    const prevCard = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setIsFlipped(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!deck) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <p>Deck not found</p>
            </div>
        );
    }

    const currentCard = deck.cards[cardOrder[currentIndex]];

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/student/library" className="p-2 hover:bg-gray-800 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">{deck.title}</h1>
                            <p className="text-sm text-gray-400">
                                Card {currentIndex + 1} of {deck.cards.length}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={shuffleCards}
                            className={`p-2 rounded-lg ${shuffled ? "bg-blue-600" : "hover:bg-gray-800"}`}
                            title="Shuffle"
                        >
                            <Shuffle className="w-5 h-5" />
                        </button>
                        <button
                            onClick={resetDeck}
                            className="p-2 hover:bg-gray-800 rounded-lg"
                            title="Reset"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-800 rounded-full h-2 mb-8">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${((currentIndex + 1) / deck.cards.length) * 100}%` }}
                    />
                </div>

                {/* Card */}
                <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="relative w-full aspect-[3/2] cursor-pointer perspective-1000"
                >
                    <div className={`absolute inset-0 transition-transform duration-500 transform-style-3d ${isFlipped ? "rotate-y-180" : ""}`}>
                        {/* Front */}
                        <div className={`absolute inset-0 bg-gray-900 border border-gray-800 rounded-2xl p-8 flex items-center justify-center backface-hidden ${isFlipped ? "invisible" : ""}`}>
                            <p className="text-2xl text-center">{currentCard.front}</p>
                        </div>
                        {/* Back */}
                        <div className={`absolute inset-0 bg-gray-800 border border-gray-700 rounded-2xl p-8 flex items-center justify-center backface-hidden rotate-y-180 ${!isFlipped ? "invisible" : ""}`}>
                            <p className="text-2xl text-center">{currentCard.back}</p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-gray-500 mt-4 text-sm">
                    Click card to flip
                </p>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8">
                    <button
                        onClick={prevCard}
                        disabled={currentIndex === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Previous
                    </button>

                    <button
                        onClick={nextCard}
                        disabled={currentIndex === deck.cards.length - 1}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                    >
                        Next
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Completion */}
                {currentIndex === deck.cards.length - 1 && isFlipped && (
                    <div className="mt-8 p-6 bg-green-900/30 border border-green-700 rounded-lg text-center">
                        <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
                        <p className="text-lg font-semibold">Deck Complete!</p>
                        <p className="text-gray-400">You reviewed all {deck.cards.length} cards</p>
                        <button
                            onClick={resetDeck}
                            className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
                        >
                            Study Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
```

**Step 2: Create directory structure**

Run: `mkdir -p "frontend/src/app/student/study/flashcard_deck/[id]"`

**Step 3: Add CSS for 3D transforms**

Add to `frontend/src/app/globals.css`:

```css
.perspective-1000 {
    perspective: 1000px;
}
.transform-style-3d {
    transform-style: preserve-3d;
}
.backface-hidden {
    backface-visibility: hidden;
}
.rotate-y-180 {
    transform: rotateY(180deg);
}
```

**Step 4: Commit**

```bash
git add frontend/src/app/student/study/flashcard_deck/[id]/page.tsx frontend/src/app/globals.css
git commit -m "feat(frontend): create flashcard study page with flip animation"
```

---

### Task 21: Create Game Play Pages

**Files:**
- Create: `frontend/src/app/student/study/game/[id]/page.tsx`

This is a larger task - implement the Match Pairs game first as the primary example. Fill Blank and Sort It follow similar patterns.

**Step 1: Create game study page with Match Pairs**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCcw, Trophy, Clock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GameContent {
    id: string;
    title: string;
    template_type: string;
    game_data: {
        pairs?: { term: string; definition: string }[];
        sentences?: { text: string; blanks: { position: number; answer: string }[] }[];
        categories?: { name: string; items: string[] }[];
    };
    best_score: number | null;
    best_time_seconds: number | null;
}

interface MatchCard {
    id: string;
    content: string;
    type: "term" | "definition";
    pairIndex: number;
    matched: boolean;
    selected: boolean;
}

export default function PlayGamePage() {
    const params = useParams();
    const { token } = useAuth();

    const [game, setGame] = useState<GameContent | null>(null);
    const [loading, setLoading] = useState(true);

    // Match Pairs state
    const [cards, setCards] = useState<MatchCard[]>([]);
    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [matchedPairs, setMatchedPairs] = useState(0);
    const [moves, setMoves] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [gameComplete, setGameComplete] = useState(false);

    useEffect(() => {
        if (token && params.id) {
            fetchGame();
        }
    }, [token, params.id]);

    const fetchGame = async () => {
        try {
            const response = await fetch(`${API_URL}/library/games/${params.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Failed to fetch game");
            const data = await response.json();
            setGame(data);
            initializeGame(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const initializeGame = (gameData: GameContent) => {
        if (gameData.template_type === "match_pairs" && gameData.game_data.pairs) {
            const matchCards: MatchCard[] = [];
            gameData.game_data.pairs.forEach((pair, index) => {
                matchCards.push({
                    id: `term-${index}`,
                    content: pair.term,
                    type: "term",
                    pairIndex: index,
                    matched: false,
                    selected: false
                });
                matchCards.push({
                    id: `def-${index}`,
                    content: pair.definition,
                    type: "definition",
                    pairIndex: index,
                    matched: false,
                    selected: false
                });
            });
            // Shuffle
            setCards(matchCards.sort(() => Math.random() - 0.5));
            setStartTime(Date.now());
        }
    };

    const handleCardClick = (cardId: string) => {
        if (selectedCards.length >= 2) return;

        const card = cards.find(c => c.id === cardId);
        if (!card || card.matched || card.selected) return;

        const newSelected = [...selectedCards, cardId];
        setSelectedCards(newSelected);
        setCards(cards.map(c => c.id === cardId ? { ...c, selected: true } : c));

        if (newSelected.length === 2) {
            setMoves(moves + 1);
            const [firstId, secondId] = newSelected;
            const firstCard = cards.find(c => c.id === firstId)!;
            const secondCard = cards.find(c => c.id === secondId)!;

            if (firstCard.pairIndex === secondCard.pairIndex && firstCard.type !== secondCard.type) {
                // Match!
                setTimeout(() => {
                    setCards(prev => prev.map(c =>
                        c.pairIndex === firstCard.pairIndex ? { ...c, matched: true, selected: false } : c
                    ));
                    setSelectedCards([]);
                    const newMatchedCount = matchedPairs + 1;
                    setMatchedPairs(newMatchedCount);

                    if (game?.game_data.pairs && newMatchedCount === game.game_data.pairs.length) {
                        setEndTime(Date.now());
                        setGameComplete(true);
                    }
                }, 500);
            } else {
                // No match
                setTimeout(() => {
                    setCards(prev => prev.map(c => ({ ...c, selected: false })));
                    setSelectedCards([]);
                }, 1000);
            }
        }
    };

    const resetGame = () => {
        if (game) {
            initializeGame(game);
            setSelectedCards([]);
            setMatchedPairs(0);
            setMoves(0);
            setEndTime(null);
            setGameComplete(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!game) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <p>Game not found</p>
            </div>
        );
    }

    const elapsedTime = endTime && startTime ? Math.floor((endTime - startTime) / 1000) : null;

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/student/library" className="p-2 hover:bg-gray-800 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">{game.title}</h1>
                            <p className="text-sm text-gray-400">Match Pairs</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">Moves: {moves}</span>
                        <button onClick={resetGame} className="p-2 hover:bg-gray-800 rounded-lg">
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Game Complete */}
                {gameComplete && (
                    <div className="mb-6 p-6 bg-green-900/30 border border-green-700 rounded-lg text-center">
                        <Trophy className="w-12 h-12 mx-auto mb-2 text-yellow-400" />
                        <h2 className="text-2xl font-bold mb-2">Congratulations!</h2>
                        <p className="text-gray-300 mb-4">
                            You matched all pairs in {moves} moves
                            {elapsedTime && ` and ${elapsedTime} seconds`}!
                        </p>
                        <button
                            onClick={resetGame}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
                        >
                            Play Again
                        </button>
                    </div>
                )}

                {/* Match Pairs Grid */}
                {game.template_type === "match_pairs" && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {cards.map(card => (
                            <button
                                key={card.id}
                                onClick={() => handleCardClick(card.id)}
                                disabled={card.matched || gameComplete}
                                className={`
                                    aspect-square p-4 rounded-lg text-center flex items-center justify-center
                                    transition-all duration-200
                                    ${card.matched
                                        ? "bg-green-900/50 border-green-600 opacity-60"
                                        : card.selected
                                            ? "bg-blue-600 border-blue-400"
                                            : "bg-gray-900 border-gray-800 hover:border-gray-600"
                                    }
                                    border-2
                                    ${card.matched || gameComplete ? "cursor-default" : "cursor-pointer"}
                                `}
                            >
                                <span className={`text-sm ${card.type === "term" ? "font-semibold" : ""}`}>
                                    {card.content}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

**Step 2: Create directory**

Run: `mkdir -p "frontend/src/app/student/study/game/[id]"`

**Step 3: Commit**

```bash
git add frontend/src/app/student/study/game/[id]/page.tsx
git commit -m "feat(frontend): create game play page with match pairs"
```

---

## Summary

This plan covers the core implementation in 21 tasks:

**Phase 1 (Tasks 1-6):** Database models for StudyItem, FlashcardDeck, Flashcard, StudyNote, GameContent, Collection, CollectionItem, LibraryStudySession

**Phase 2 (Tasks 7-13):** Backend API routes for all CRUD operations on study items, collections, and their relationships

**Phase 3 (Tasks 14-19):** Frontend pages - Library view, Creation hub, Flashcard builder, Notes editor, Game builder, Sidebar update

**Phase 4 (Tasks 20-21):** Study/play pages for flashcards and games

---

**Plan complete and saved to `docs/plans/2026-01-27-student-library-implementation.md`. Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session in worktree with executing-plans, batch execution with checkpoints

Which approach?

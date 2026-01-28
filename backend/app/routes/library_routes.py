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


class StudyNoteCreate(StudyItemBase):
    content_markdown: str = Field(default="")
    attachments: List[dict] = Field(default_factory=list)


class StudyNoteResponse(StudyItemResponse):
    content_markdown: str
    attachments: List[dict]
    highlighted_terms: List[str]


class GameContentCreate(StudyItemBase):
    template_type: str = Field(...)  # match_pairs, fill_blank, sort_it
    game_data: dict = Field(...)


class GameContentResponse(StudyItemResponse):
    template_type: str
    game_data: dict
    best_score: Optional[int]
    best_time_seconds: Optional[int]


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


# ============ Flashcard Deck Endpoints ============

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


# ============ Study Note Endpoints ============

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


# ============ Game Content Endpoints ============

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


# ============ Collection Endpoints ============

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
            items=[]
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
    col_result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = col_result.scalars().first()

    if not collection or collection.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Collection not found")

    item_result = await db.execute(
        select(StudyItem).where(StudyItem.id == study_item_id)
    )
    study_item = item_result.scalars().first()

    if not study_item or study_item.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Study item not found")

    existing = await db.execute(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.study_item_id == study_item_id
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Item already in collection")

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
    col_result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    collection = col_result.scalars().first()

    if not collection or collection.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Collection not found")

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
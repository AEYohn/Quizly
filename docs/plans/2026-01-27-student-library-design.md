# Student Library & Study Material Creator

## Overview

A unified "My Library" experience for students to create, organize, and study their own materials. Consolidates all student content (quizzes, flashcards, notes, games) into a single personal learning hub.

## Navigation Structure

```
/student/library                  → Main library view (all content + collections)
/student/library/collection/[id]  → Single collection view
/student/create                   → Content creation hub
/student/create/quiz              → Quiz builder
/student/create/flashcards        → Flashcard deck builder
/student/create/notes             → Notes editor
/student/create/game              → Game template picker + builder
/student/study/[type]/[id]        → Study/play a specific item
```

## Library View Layout

- **Left sidebar**: Collections list + "Create New Collection" button
- **Main area**: Grid/list of all content items with type icons (quiz, flashcards, notes, game)
- **Top bar**: Search, filter by type, sort options
- **Each item shows**: title, type, last studied date, mastery indicator (if applicable)

### Collections

- Named bundles like "Biology Midterm Prep" or "Spanish Vocab Week 3"
- Can contain any mix of quizzes, flashcards, notes, and games
- "Study Collection" button starts a guided session through all items
- Drag-and-drop to add/reorder items within a collection

### Quick Actions

- Floating "+" button for quick creation
- "Add to Collection" action on every item
- Existing exit tickets and auto-generated content also appear in library

## Content Types

### Quizzes (extends existing)

- Multiple choice, true/false, fill-in-the-blank
- Optional timer per question
- Explanations for correct answers
- Track: times practiced, best score, average score

### Flashcard Decks

- Front/back cards with rich text + images
- Study modes: classic flip, shuffle, spaced repetition
- Track: cards mastered, cards struggling, next review date
- Can mark cards as "learned" or "needs practice"

### Study Notes

- Rich text editor with markdown support
- Headings, bullet points, code blocks, math notation
- Can highlight key terms (become potential flashcard candidates)
- Attachments: images, diagrams

### Games (template-based)

| Template | Description | Best For |
|----------|-------------|----------|
| **Match Pairs** | Flip cards to match term ↔ definition | Vocabulary, formulas |
| **Fill-in-Blank** | Complete sentences with missing words | Definitions, sequences |
| **Sort It** | Drag items into correct categories | Classification, grouping |

Each game stores the same underlying data (terms + definitions/categories) but renders differently based on template.

### Unified Content Model

All content types share: `id`, `title`, `created_at`, `updated_at`, `owner_id`, `visibility` (private/class/public), `tags[]`, `source` (manual/ai/import).

## Content Creation Flows

### Manual Creation

- Step-by-step builders for each content type
- Quiz builder: add questions one by one, set correct answers, add explanations
- Flashcard builder: add cards with front/back, preview as you go
- Notes editor: rich text with auto-save
- Game builder: pick template → add terms/definitions → preview & play

### AI-Assisted Creation

- "Generate from Topic" button on any builder
- Student enters: topic + difficulty + count (e.g., "Photosynthesis, intermediate, 10 questions")
- AI generates draft content → student reviews/edits before saving
- Works for quizzes, flashcards, and games
- Can regenerate individual items if not satisfied

### Import-Based Creation

- "Import" option in creation hub
- Accepts: pasted text, PDF upload, image upload (photo of notes/textbook)
- AI extracts key concepts and generates:
  - Suggested flashcards from definitions/terms found
  - Quiz questions from the content
  - Study notes summary
- Student picks which generated items to keep
- Original source saved for reference

### Cross-Content Generation

- From flashcards → "Generate Quiz" or "Generate Game"
- From quiz → "Generate Flashcards" (terms from questions)
- From notes → "Extract Flashcards" from highlighted terms

## Collections & Study Sessions

### Creating Collections

- Name + optional description + optional cover color/icon
- Add items from library via checkbox selection or drag-and-drop
- Items can belong to multiple collections (not exclusive)
- Reorder items within a collection to set study sequence

### Study Session Flow

When student clicks "Study Collection":

1. **Session Start** — Shows collection overview: X quizzes, Y flashcards, Z games
2. **Guided Flow** — Steps through each item in order (or shuffled if preferred)
3. **Between Items** — Brief progress summary ("3/7 complete, 85% accuracy so far")
4. **Session Complete** — Full summary with stats per item, weak areas identified, suggested next steps

### Smart Study Suggestions

- "Due for Review" section on library home — items not studied recently or flagged by spaced repetition
- "Weak Concepts" — AI surfaces content related to recent mistakes
- "Continue Studying" — Resume last incomplete session

### Collection Sharing

- Private by default
- "Share to Class" — Select which enrolled class(es) can access
- "Publish" — Makes discoverable in public library with your name as creator
- Shared collections are read-only copies; recipients can duplicate to edit

## Technical Architecture

### Database Models (new tables)

```
StudyItem          — Base for all content (id, type, title, owner_id, visibility, tags, source, created_at, updated_at)
FlashcardDeck      — Extends StudyItem (study_mode_preferences)
Flashcard          — Belongs to deck (front, back, image_url, mastery_level, next_review_at)
StudyNote          — Extends StudyItem (content_markdown, attachments[])
GameContent        — Extends StudyItem (template_type, game_data JSON)
Collection         — (id, name, description, owner_id, visibility, cover_color, created_at)
CollectionItem     — Join table (collection_id, study_item_id, position)
StudySession       — (id, student_id, collection_id, started_at, completed_at, progress JSON)
```

### Integration with Existing Features

- Exit tickets auto-appear in library under "Generated for You" section
- Existing student quizzes migrate to new StudyItem model
- Class enrollment connects to collection sharing permissions
- Misconception data informs "Weak Concepts" suggestions

### API Endpoints (new routes)

```
/api/library/items          — CRUD for all study items
/api/library/collections    — CRUD for collections
/api/library/import         — Upload files, returns AI-extracted content
/api/library/generate       — AI generation from topic
/api/library/study-session  — Start/update/complete sessions
```

### Frontend Structure

- New pages under `/student/library/*` and `/student/create/*`
- Shared components: `ContentCard`, `CollectionCard`, `StudyItemEditor`, `GamePlayer`

## Summary

| Feature | Details |
|---------|---------|
| **Content Types** | Quizzes, Flashcard Decks, Study Notes, Games (Match Pairs, Fill-in-Blank, Sort It) |
| **Organization** | Collections — curated bundles of mixed content |
| **Creation** | Manual, AI-assisted from topic, Import from PDF/images/text |
| **Sharing** | Private by default, share to class, or publish publicly |
| **Study Sessions** | Guided flow through collections with progress tracking |
| **Smart Features** | Spaced repetition, weak concept suggestions, cross-content generation |

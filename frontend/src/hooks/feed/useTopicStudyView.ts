"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { scrollApi, learnApi } from "~/lib/api";
import type { ScrollCard, ScrollStats, ScrollAnalytics } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";
import type { SyllabusTopic } from "~/stores/scrollSessionStore";

export type StudyTab = "notes" | "cards" | "quiz";

interface NoteEntry {
    id: string;
    concept: string;
    title: string;
    body_markdown: string;
    key_takeaway: string;
    sources?: Array<{ title: string; url: string }>;
}

interface NotesData {
    topic: string;
    total_notes: number;
    notes_by_concept: Record<string, NoteEntry[]>;
}

export function useTopicStudyView(topic: SyllabusTopic | null) {
    const auth = useAuth();
    const store = useScrollSessionStore();

    // Tab
    const [activeTab, setActiveTab] = useState<StudyTab>("notes");

    // Notes
    const [notesData, setNotesData] = useState<NotesData | null>(null);
    const [notesLoading, setNotesLoading] = useState(false);
    const [notesError, setNotesError] = useState<string | null>(null);

    // Note editing
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState("");
    const [editTakeawayDraft, setEditTakeawayDraft] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Cards (flashcards)
    const [cardsData, setCardsData] = useState<ScrollCard[]>([]);
    const [cardsLoading, setCardsLoading] = useState(false);
    const [cardIdx, setCardIdx] = useState(0);
    const [cardStats, setCardStats] = useState<ScrollStats>({
        streak: 0, best_streak: 0, total_xp: 0, difficulty: 0.3, cards_shown: 0,
    });
    const [flashcardXp, setFlashcardXp] = useState<number | null>(null);

    // Quiz
    const [quizData, setQuizData] = useState<ScrollCard[]>([]);
    const [quizLoading, setQuizLoading] = useState(false);
    const [quizIdx, setQuizIdx] = useState(0);
    const [quizResult, setQuizResult] = useState<{ isCorrect: boolean; xpEarned: number; streakBroken: boolean } | null>(null);
    const [quizStats, setQuizStats] = useState<ScrollStats>({
        streak: 0, best_streak: 0, total_xp: 0, difficulty: 0.3, cards_shown: 0,
    });
    const [quizAnalytics, setQuizAnalytics] = useState<ScrollAnalytics | null>(null);

    // Local session (NEVER touches store.sessionId)
    const [localSessionId, setLocalSessionId] = useState<string | null>(null);
    const sessionStartedRef = useRef(false);

    // Error state
    const [sessionError, setSessionError] = useState<string | null>(null);

    // Whether all initial flashcards have been reviewed (no more to fetch)
    const [flashcardsExhausted, setFlashcardsExhausted] = useState(false);

    // Peek notes
    const [showPeekNotes, setShowPeekNotes] = useState(false);

    // Peek resources
    const [showPeekResources, setShowPeekResources] = useState(false);
    const [viewingResourceId, setViewingResourceId] = useState<string | null>(null);

    // Reset everything when topic changes
    useEffect(() => {
        setActiveTab("notes");
        setNotesData(null);
        setNotesLoading(false);
        setCardsData([]);
        setCardsLoading(false);
        setCardIdx(0);
        setFlashcardXp(null);
        setQuizData([]);
        setQuizLoading(false);
        setQuizIdx(0);
        setQuizResult(null);
        setQuizAnalytics(null);
        setLocalSessionId(null);
        setEditingNoteId(null);
        setShowPeekNotes(false);
        setShowPeekResources(false);
        setViewingResourceId(null);
        setNotesError(null);
        setSessionError(null);
        setFlashcardsExhausted(false);
        sessionStartedRef.current = false;
    }, [topic?.id]);

    // Shared session init: tries resume first, falls back to startFeed
    const initSession = useCallback(async (topicObj: SyllabusTopic, signal: { cancelled: boolean }) => {
        const studentName = getStudentName(auth.user);
        setCardsLoading(true);
        setQuizLoading(true);
        setSessionError(null);

        let sessionId: string | null = null;
        let initialCards: ScrollCard[] = [];
        let initialStats: ScrollStats | null = null;
        let feedPhase: string | undefined;

        // 1. Try resuming an existing session
        try {
            const resumeRes = await scrollApi.resumeFeed(topicObj.name, studentName);
            if (resumeRes.success) {
                sessionId = resumeRes.data.session_id;
                initialCards = resumeRes.data.cards ?? [];
                initialStats = resumeRes.data.stats;
                feedPhase = resumeRes.data.feed_phase;
            }
        } catch {
            // 404 or other error — no resumable session, will start fresh
        }

        // 2. Fall back to starting a new session
        if (!sessionId) {
            try {
                const startRes = await scrollApi.startFeed(
                    topicObj.name,
                    studentName,
                    auth.user?.id,
                    undefined,
                    undefined,
                    "structured",
                );
                if (signal.cancelled) return;
                if (!startRes.success) {
                    setCardsLoading(false);
                    setQuizLoading(false);
                    const detail = startRes.error ? `: ${startRes.error}` : "";
                    console.error("[TopicStudyView] startFeed failed", startRes.error);
                    setSessionError(`Failed to start study session${detail}`);
                    return;
                }
                sessionId = startRes.data.session_id;
                initialCards = startRes.data.cards ?? [];
                initialStats = startRes.data.stats;
                feedPhase = undefined; // new session starts in learn/flashcards phase
            } catch (err) {
                if (signal.cancelled) return;
                setCardsLoading(false);
                setQuizLoading(false);
                const msg = err instanceof Error ? err.message : "Unknown error";
                setSessionError(`Failed to start study session: ${msg}`);
                return;
            }
        }

        if (signal.cancelled) return;
        setLocalSessionId(sessionId);
        sessionStartedRef.current = true;

        // 3. Set flashcard data from initial cards
        if (initialCards.length > 0) {
            setCardsData(initialCards);
            if (initialStats) setCardStats(initialStats);
        }
        setCardsLoading(false);

        // 4. Skip to quiz phase (only if not already there)
        if (feedPhase !== "quiz") {
            try {
                const qRes = await scrollApi.skipPhase(sessionId, "quiz");
                if (!signal.cancelled && qRes.success) {
                    setQuizData(qRes.data.cards);
                    setQuizStats(qRes.data.stats);
                }
            } catch {
                // Quiz load failed but flashcards still work
            }
        } else {
            // Already in quiz phase — use the resumed cards as quiz cards too
            if (initialCards.length > 0) {
                setQuizData(initialCards);
                if (initialStats) setQuizStats(initialStats);
            }
        }
        if (!signal.cancelled) setQuizLoading(false);
    }, [auth.user]);

    // Fetch notes + init session on mount
    useEffect(() => {
        if (!topic) return;
        const signal = { cancelled: false };

        // 1. Fetch notes
        const cached = store.topicNotesCache?.[topic.id];
        if (cached) {
            setNotesData(cached as NotesData);
        } else {
            setNotesLoading(true);
            learnApi.getTopicNotes(topic.name, topic.concepts).then((res) => {
                if (signal.cancelled) return;
                if (res.success) {
                    setNotesData(res.data as NotesData);
                    store.setTopicNotes(topic.id, res.data);
                } else {
                    console.error("[TopicStudyView] Notes fetch failed:", res.error);
                    setNotesError(res.error ?? "Failed to load study notes.");
                }
                setNotesLoading(false);
            }).catch((err) => {
                if (signal.cancelled) return;
                const msg = err instanceof Error ? err.message : "Unknown error";
                console.error("[TopicStudyView] Notes fetch error:", msg);
                setNotesError(`Failed to load study notes: ${msg}`);
                setNotesLoading(false);
            });
        }

        // 2. Init session (resume-first, then start)
        if (!sessionStartedRef.current) {
            sessionStartedRef.current = true;
            initSession(topic, signal);
        }

        return () => { signal.cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topic?.id]);

    // ── Flashcard handlers ──

    const handleFlashcardRate = useCallback(async (rating: number) => {
        if (!localSessionId) return;
        const card = cardsData[cardIdx];
        if (!card) return;

        try {
            const res = await scrollApi.flipFlashcard(
                localSessionId,
                card.content_item_id ?? card.id,
                3000,
                rating,
            );
            if (res.success) {
                setFlashcardXp(res.data.xp_earned);
                setCardStats(res.data.stats);
            }
        } catch { /* ignore */ }
    }, [localSessionId, cardsData, cardIdx]);

    const handleFlashcardNext = useCallback(async () => {
        setFlashcardXp(null);
        const nextIdx = cardIdx + 1;
        if (nextIdx < cardsData.length) {
            setCardIdx(nextIdx);
            return;
        }
        // Session is in quiz phase — cannot fetch more flashcards.
        // Signal that all initial flashcards have been reviewed.
        setFlashcardsExhausted(true);
    }, [cardIdx, cardsData.length]);

    // ── Quiz handlers ──

    const handleQuizAnswer = useCallback(async (answer: string) => {
        if (!localSessionId) return;
        const card = quizData[quizIdx];
        if (!card) return;

        const startTime = Date.now();
        try {
            const res = await scrollApi.submitAnswer(
                localSessionId,
                answer,
                Date.now() - startTime,
                card.content_item_id,
                card.correct_answer,
                undefined,
                { prompt: card.prompt, options: card.options, explanation: card.explanation, concept: card.concept },
            );
            if (res.success) {
                setQuizResult({
                    isCorrect: res.data.is_correct,
                    xpEarned: res.data.xp_earned,
                    streakBroken: res.data.streak_broken,
                });
                setQuizStats(res.data.stats);
                setQuizAnalytics(res.data.analytics);
            }
        } catch { /* ignore */ }
    }, [localSessionId, quizData, quizIdx]);

    const handleQuizNext = useCallback(async () => {
        setQuizResult(null);
        setQuizAnalytics(null);
        const nextIdx = quizIdx + 1;
        if (nextIdx < quizData.length) {
            setQuizIdx(nextIdx);
            return;
        }
        // Fetch more cards
        if (!localSessionId) return;
        try {
            const res = await scrollApi.getNextCards(localSessionId, 3);
            if (res.success && res.data.cards.length > 0) {
                setQuizData((prev) => [...prev, ...res.data.cards]);
                setQuizIdx(nextIdx);
                setQuizStats(res.data.stats);
            }
        } catch { /* ignore */ }
    }, [localSessionId, quizIdx, quizData.length]);

    // Key takeaways for peek overlay (computed early so handleQuizHelp can reference it)
    const keyTakeaways = notesData
        ? Object.values(notesData.notes_by_concept)
            .flat()
            .filter((n) => n.key_takeaway)
            .map((n) => ({ concept: n.concept, takeaway: n.key_takeaway }))
        : [];

    const handleQuizHelp = useCallback(() => {
        if (store.subjectResources.length > 0) {
            setShowPeekResources(true);
        } else if (keyTakeaways.length > 0) {
            setShowPeekNotes(true);
        }
    }, [store.subjectResources.length, keyTakeaways.length]);

    // ── Note editing handlers ──

    const startEditingNote = useCallback((note: NoteEntry) => {
        setEditingNoteId(note.id);
        setEditDraft(note.body_markdown);
        setEditTakeawayDraft(note.key_takeaway);
    }, []);

    const cancelEditingNote = useCallback(() => {
        setEditingNoteId(null);
        setEditDraft("");
        setEditTakeawayDraft("");
    }, []);

    const saveEditedNote = useCallback(async () => {
        if (!editingNoteId || !notesData) return;
        setIsSavingNote(true);

        // Optimistic local update
        const updatedNotes = { ...notesData };
        for (const [concept, notes] of Object.entries(updatedNotes.notes_by_concept)) {
            updatedNotes.notes_by_concept[concept] = notes.map((n) =>
                n.id === editingNoteId
                    ? { ...n, body_markdown: editDraft, key_takeaway: editTakeawayDraft }
                    : n,
            );
        }
        setNotesData(updatedNotes);
        if (topic) {
            store.setTopicNotes(topic.id, updatedNotes);
        }
        setEditingNoteId(null);

        // PATCH to backend
        try {
            await learnApi.updateTopicNote(editingNoteId, {
                body_markdown: editDraft,
                key_takeaway: editTakeawayDraft,
            });
        } catch { /* silent — optimistic update already applied */ }

        setIsSavingNote(false);
        setEditDraft("");
        setEditTakeawayDraft("");
    }, [editingNoteId, editDraft, editTakeawayDraft, notesData, topic, store]);

    // Retry notes fetch
    const retryNotes = useCallback(() => {
        if (!topic) return;
        setNotesError(null);
        setNotesLoading(true);
        learnApi.getTopicNotes(topic.name, topic.concepts).then((res) => {
            if (res.success) {
                setNotesData(res.data as NotesData);
                store.setTopicNotes(topic.id, res.data);
            } else {
                console.error("[TopicStudyView] Notes retry failed:", res.error);
                setNotesError(res.error ?? "Failed to load study notes.");
            }
            setNotesLoading(false);
        }).catch((err) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            console.error("[TopicStudyView] Notes retry error:", msg);
            setNotesError(`Failed to load study notes: ${msg}`);
            setNotesLoading(false);
        });
    }, [topic, store]);

    // Retry session creation
    const retrySession = useCallback(() => {
        sessionStartedRef.current = false;
        setSessionError(null);
        setCardsData([]);
        setQuizData([]);
        setCardIdx(0);
        setQuizIdx(0);
        setFlashcardsExhausted(false);
        if (!topic) return;
        initSession(topic, { cancelled: false });
    }, [topic, initSession]);

    return {
        activeTab,
        setActiveTab,

        // Notes
        notesData,
        notesLoading,
        notesError,
        retryNotes,
        editingNoteId,
        editDraft,
        setEditDraft,
        editTakeawayDraft,
        setEditTakeawayDraft,
        isSavingNote,
        startEditingNote,
        cancelEditingNote,
        saveEditedNote,

        // Cards
        cardsData,
        cardsLoading,
        cardIdx,
        cardStats,
        flashcardXp,
        currentFlashcard: cardsData[cardIdx] ?? null,
        handleFlashcardRate,
        handleFlashcardNext,

        // Quiz
        quizData,
        quizLoading,
        quizIdx,
        quizResult,
        quizStats,
        quizAnalytics,
        currentQuizCard: quizData[quizIdx] ?? null,
        handleQuizAnswer,
        handleQuizNext,
        handleQuizHelp,

        // Peek notes
        showPeekNotes,
        setShowPeekNotes,
        keyTakeaways,

        // Peek resources
        showPeekResources,
        setShowPeekResources,
        viewingResourceId,
        setViewingResourceId,

        // Error / retry
        sessionError,
        retrySession,

        // Flashcard exhaustion
        flashcardsExhausted,
    };
}

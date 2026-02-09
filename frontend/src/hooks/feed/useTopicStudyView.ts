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

    // Peek notes
    const [showPeekNotes, setShowPeekNotes] = useState(false);

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
        sessionStartedRef.current = false;
    }, [topic?.id]);

    // Fetch notes + create session + pre-load cards/quiz on mount
    useEffect(() => {
        if (!topic) return;
        let cancelled = false;
        const studentName = getStudentName(auth.user);

        // 1. Fetch notes
        const cached = store.topicNotesCache?.[topic.id];
        if (cached) {
            setNotesData(cached as NotesData);
        } else {
            setNotesLoading(true);
            learnApi.getTopicNotes(topic.name, topic.concepts).then((res) => {
                if (cancelled) return;
                if (res.success) {
                    setNotesData(res.data as NotesData);
                    store.setTopicNotes(topic.id, res.data);
                }
                setNotesLoading(false);
            }).catch(() => { if (!cancelled) setNotesLoading(false); });
        }

        // 2. Create session + pre-load cards/quiz
        if (!sessionStartedRef.current) {
            sessionStartedRef.current = true;
            setCardsLoading(true);
            setQuizLoading(true);

            scrollApi.startFeed(
                topic.name,
                studentName,
                auth.user?.id,
                undefined,
                undefined,
                "structured",
            ).then(async (res) => {
                if (cancelled) return;
                if (!res.success) {
                    setCardsLoading(false);
                    setQuizLoading(false);
                    return;
                }

                const sessionId = res.data.session_id;
                setLocalSessionId(sessionId);

                // Pre-load flashcards
                try {
                    const fcRes = await scrollApi.skipPhase(sessionId, "flashcards");
                    if (!cancelled && fcRes.success) {
                        setCardsData(fcRes.data.cards);
                        setCardStats(fcRes.data.stats);
                    }
                } catch { /* ignore */ }
                if (!cancelled) setCardsLoading(false);

                // Pre-load quiz
                try {
                    const qRes = await scrollApi.skipPhase(sessionId, "quiz");
                    if (!cancelled && qRes.success) {
                        setQuizData(qRes.data.cards);
                        setQuizStats(qRes.data.stats);
                    }
                } catch { /* ignore */ }
                if (!cancelled) setQuizLoading(false);
            }).catch(() => {
                if (!cancelled) {
                    setCardsLoading(false);
                    setQuizLoading(false);
                }
            });
        }

        return () => { cancelled = true; };
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
        // Fetch more cards
        if (!localSessionId) return;
        try {
            const res = await scrollApi.getNextCards(localSessionId, 3);
            if (res.success && res.data.cards.length > 0) {
                setCardsData((prev) => [...prev, ...res.data.cards]);
                setCardIdx(nextIdx);
                setCardStats(res.data.stats);
            }
        } catch { /* ignore */ }
    }, [localSessionId, cardIdx, cardsData.length]);

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

    const handleQuizHelp = useCallback(() => {
        // no-op for now — could open help in the future
    }, []);

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

    // Key takeaways for peek overlay
    const keyTakeaways = notesData
        ? Object.values(notesData.notes_by_concept)
            .flat()
            .filter((n) => n.key_takeaway)
            .map((n) => ({ concept: n.concept, takeaway: n.key_takeaway }))
        : [];

    return {
        activeTab,
        setActiveTab,

        // Notes
        notesData,
        notesLoading,
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
    };
}

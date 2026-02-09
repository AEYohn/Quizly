"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { scrollApi, curriculumApi, learnApi } from "~/lib/api";
import type { ScrollSessionAnalytics } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";

export function useActiveFeed(answerStartTime: React.MutableRefObject<number>) {
    const auth = useAuth();
    const store = useScrollSessionStore();

    const [sessionAnalytics, setSessionAnalytics] = useState<ScrollSessionAnalytics | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [showTuneSheet, setShowTuneSheet] = useState(false);

    const answeredCardIdx = useRef<number>(-1);

    // File upload
    const handleFileUpload = useCallback(async (file: File) => {
        setUploadedFile(file);
        setIsProcessingFile(true);
        store.setError(null);
        try {
            const formData = new FormData();
            formData.append("files", file);
            const res = await curriculumApi.processMaterials(formData);
            if (res.success) {
                if (res.data.topic) store.setTopicInput(res.data.topic);
                const notesText = [
                    res.data.summary,
                    res.data.concepts.length ? "\n\nKey concepts: " + res.data.concepts.join(", ") : "",
                    res.data.objectives.length ? "\nObjectives: " + res.data.objectives.join("; ") : "",
                ].join("");
                store.setNotesInput(notesText);
                setShowNotes(true);
            } else {
                store.setError("Failed to process file: " + (res.error ?? "Unknown error"));
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to process file");
        } finally {
            setIsProcessingFile(false);
        }
    }, [store]);

    // Start feed (manual entry)
    const handleStart = useCallback(async () => {
        if (!store.topicInput.trim()) return;
        store.setIsLoading(true);
        store.setError(null);

        try {
            const studentName = getStudentName(auth.user);
            const prefs = store.preferences;
            const apiPrefs = {
                difficulty: prefs.difficulty,
                content_mix: prefs.contentMix,
                question_style: prefs.questionStyle,
            };

            const res = await scrollApi.startFeed(
                store.topicInput.trim(),
                studentName,
                auth.user?.id,
                store.notesInput.trim() || undefined,
                apiPrefs,
            );

            if (!res.success) {
                store.setError(res.error ?? "Failed to start feed");
                store.setIsLoading(false);
                return;
            }

            store.setSessionId(res.data.session_id);
            store.setTopic(store.topicInput.trim());
            store.setCards(res.data.cards);
            store.setCurrentIdx(0);
            store.setStats(res.data.stats);
            store.clearCardState();
            answerStartTime.current = Date.now();
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            store.setIsLoading(false);
        }
    }, [store, auth.user, answerStartTime]);

    // Submit answer
    const handleAnswer = useCallback(
        async (answer: string) => {
            if (!store.sessionId || store.result) return;

            const timeMs = Date.now() - answerStartTime.current;
            const currentCard = store.cards[store.currentIdx];
            if (!currentCard) return;

            answeredCardIdx.current = store.currentIdx;

            const isCorrect = answer.trim().toUpperCase() === currentCard.correct_answer.trim().toUpperCase();
            store.setResult({
                isCorrect,
                xpEarned: isCorrect ? currentCard.xp_value : 0,
                streakBroken: !isCorrect && store.stats.streak >= 3,
            });

            try {
                const res = await scrollApi.submitAnswer(store.sessionId, answer, timeMs, currentCard.content_item_id, currentCard.correct_answer, undefined, { prompt: currentCard.prompt, options: currentCard.options, explanation: currentCard.explanation, concept: currentCard.concept });
                if (res.success) {
                    store.setStats(res.data.stats);
                    if (res.data.next_cards.length > 0) {
                        store.addCards(res.data.next_cards);
                    }
                    // Use live store state — the closure's store.currentIdx is stale if user already advanced
                    const liveIdx = useScrollSessionStore.getState().currentIdx;
                    if (answeredCardIdx.current === liveIdx) {
                        store.setAnalytics(res.data.analytics);
                        store.setResult({
                            isCorrect,
                            xpEarned: res.data.xp_earned,
                            streakBroken: res.data.streak_broken,
                        });
                    }
                }
            } catch {
                // Keep local feedback if server fails
            }
        },
        [store, answerStartTime],
    );

    // Next card
    const handleNext = useCallback(() => {
        store.advanceCard();
        answerStartTime.current = Date.now();
    }, [store, answerStartTime]);

    // Skip card
    const handleSkip = useCallback(async () => {
        const currentCard = store.cards[store.currentIdx];
        if (!store.sessionId || !currentCard?.content_item_id) {
            handleNext();
            return;
        }
        try {
            const res = await scrollApi.skipCard(store.sessionId, currentCard.content_item_id, "skipped");
            if (res.success) {
                store.setStats(res.data.stats);
                if (res.data.cards.length > 0) {
                    store.addCards(res.data.cards);
                }
            }
        } catch {
            // Skip anyway
        }
        handleNext();
    }, [store, handleNext]);

    // Flashcard rate
    const handleFlashcardRate = useCallback(async (rating: number) => {
        const currentCard = store.cards[store.currentIdx];
        if (!store.sessionId || !currentCard?.content_item_id) return;

        const timeMs = Date.now() - answerStartTime.current;
        try {
            const res = await scrollApi.flipFlashcard(store.sessionId, currentCard.content_item_id, timeMs, rating);
            if (res.success) {
                store.setFlashcardXp(res.data.xp_earned);
                store.setStats(res.data.stats);
            }
        } catch {
            store.setFlashcardXp(5);
        }
    }, [store, answerStartTime]);

    // Info card got it
    const handleInfoGotIt = useCallback(async () => {
        const currentCard = store.cards[store.currentIdx];
        if (!store.sessionId || !currentCard?.content_item_id) {
            store.setInfoAcknowledged(true);
            return;
        }

        const timeMs = Date.now() - answerStartTime.current;
        try {
            const res = await scrollApi.flipFlashcard(store.sessionId, currentCard.content_item_id, timeMs, 3);
            if (res.success) {
                store.setStats(res.data.stats);
            }
        } catch {
            // Continue anyway
        }
        store.setInfoAcknowledged(true);
    }, [store, answerStartTime]);

    // Analytics
    const handleShowAnalytics = useCallback(async () => {
        if (!store.sessionId) return;
        const res = await scrollApi.getAnalytics(store.sessionId);
        if (res.success) {
            setSessionAnalytics(res.data);
            setShowAnalytics(true);
        }
    }, [store.sessionId]);

    // Pre-fetch topic notes when a syllabus-based session starts
    useEffect(() => {
        if (!store.sessionId || !store.activeSyllabusNode || !store.syllabus) return;
        const topicId = store.activeSyllabusNode;
        // Skip if already cached
        if (store.topicNotesCache[topicId]) return;
        const topic = store.syllabus.units
            .flatMap((u) => u.topics)
            .find((t) => t.id === topicId);
        if (!topic) return;
        learnApi.getTopicNotes(topic.name, topic.concepts).then((res) => {
            if (res.success) {
                store.setTopicNotes(topicId, res.data);
            }
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.sessionId, store.activeSyllabusNode]);

    // Memoized topic notes for the active node
    const topicNotesData = useMemo(() => {
        if (!store.activeSyllabusNode) return null;
        return store.topicNotesCache[store.activeSyllabusNode] ?? null;
    }, [store.activeSyllabusNode, store.topicNotesCache]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((store.result || store.flashcardXp !== null || store.infoAcknowledged) && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
                e.preventDefault();
                handleNext();
            }
            if (e.key === "Escape") {
                handleSkip();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [store.result, store.flashcardXp, store.infoAcknowledged, handleNext, handleSkip]);

    return {
        sessionAnalytics,
        showAnalytics,
        setShowAnalytics,
        showNotes,
        setShowNotes,
        uploadedFile,
        isProcessingFile,
        showTuneSheet,
        setShowTuneSheet,
        topicNotesData,
        handleFileUpload,
        handleStart,
        handleAnswer,
        handleNext,
        handleSkip,
        handleFlashcardRate,
        handleInfoGotIt,
        handleShowAnalytics,
    };
}

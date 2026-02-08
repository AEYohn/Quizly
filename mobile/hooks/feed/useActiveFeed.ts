import { useState, useCallback, useRef } from "react";
import { scrollApi } from "@/lib/learnApi";
import type { ScrollSessionAnalytics } from "@/types/learn";
import { useAuth } from "@/providers/AuthProvider";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";

export function useActiveFeed(
  answerStartTime: React.MutableRefObject<number>,
) {
  const auth = useAuth();
  const store = useScrollSessionStore();

  const [sessionAnalytics, setSessionAnalytics] =
    useState<ScrollSessionAnalytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTuneSheet, setShowTuneSheet] = useState(false);

  const answeredCardIdx = useRef<number>(-1);

  // Start feed (manual entry)
  const handleStart = useCallback(async () => {
    if (!store.topicInput.trim()) return;
    store.setIsLoading(true);
    store.setError(null);

    try {
      const studentName = auth.isSignedIn
        ? (auth.nickname || "Student")
        : (auth.userId ?? "guest_anonymous");
      const prefs = store.preferences;
      const apiPrefs = {
        difficulty: prefs.difficulty,
        content_mix: prefs.contentMix,
        question_style: prefs.questionStyle,
      };

      const res = await scrollApi.startFeed(
        store.topicInput.trim(),
        studentName,
        auth.userId ?? undefined,
        store.notesInput.trim() || undefined,
        apiPrefs,
      );

      if (!res.success) {
        store.setError(res.error ?? "Failed to start feed");
        store.setIsLoading(false);
        return;
      }

      store.setSessionId(res.data!.session_id);
      store.setTopic(store.topicInput.trim());
      store.setCards(res.data!.cards);
      store.setCurrentIdx(0);
      store.setStats(res.data!.stats);
      store.clearCardState();
      answerStartTime.current = Date.now();
    } catch (err) {
      store.setError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      store.setIsLoading(false);
    }
  }, [store, auth.nickname, auth.userId, answerStartTime]);

  // Submit answer
  const handleAnswer = useCallback(
    async (answer: string) => {
      if (!store.sessionId || store.result) return;

      const timeMs = Date.now() - answerStartTime.current;
      const currentCard = store.cards[store.currentIdx];
      if (!currentCard) return;

      answeredCardIdx.current = store.currentIdx;

      const isCorrect =
        answer.trim().toUpperCase() ===
        currentCard.correct_answer.trim().toUpperCase();
      store.setResult({
        isCorrect,
        xpEarned: isCorrect ? currentCard.xp_value : 0,
        streakBroken: !isCorrect && store.stats.streak >= 3,
      });

      try {
        const res = await scrollApi.submitAnswer(
          store.sessionId,
          answer,
          timeMs,
          currentCard.content_item_id,
          currentCard.correct_answer,
        );
        if (res.success && res.data) {
          store.setStats(res.data.stats);
          if (res.data.next_cards.length > 0) {
            store.addCards(res.data.next_cards);
          }
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
      const res = await scrollApi.skipCard(
        store.sessionId,
        currentCard.content_item_id,
        "skipped",
      );
      if (res.success && res.data) {
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
  const handleFlashcardRate = useCallback(
    async (rating: number) => {
      const currentCard = store.cards[store.currentIdx];
      if (!store.sessionId || !currentCard?.content_item_id) return;

      const timeMs = Date.now() - answerStartTime.current;
      try {
        const res = await scrollApi.flipFlashcard(
          store.sessionId,
          currentCard.content_item_id,
          timeMs,
          rating,
        );
        if (res.success && res.data) {
          store.setFlashcardXp(res.data.xp_earned);
          store.setStats(res.data.stats);
        }
      } catch {
        store.setFlashcardXp(5);
      }
    },
    [store, answerStartTime],
  );

  // Info card got it
  const handleInfoGotIt = useCallback(async () => {
    const currentCard = store.cards[store.currentIdx];
    if (!store.sessionId || !currentCard?.content_item_id) {
      store.setInfoAcknowledged(true);
      return;
    }

    const timeMs = Date.now() - answerStartTime.current;
    try {
      const res = await scrollApi.flipFlashcard(
        store.sessionId,
        currentCard.content_item_id,
        timeMs,
        3,
      );
      if (res.success && res.data) {
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
    if (res.success && res.data) {
      setSessionAnalytics(res.data);
      setShowAnalytics(true);
    }
  }, [store.sessionId]);

  return {
    sessionAnalytics,
    showAnalytics,
    setShowAnalytics,
    showTuneSheet,
    setShowTuneSheet,
    handleStart,
    handleAnswer,
    handleNext,
    handleSkip,
    handleFlashcardRate,
    handleInfoGotIt,
    handleShowAnalytics,
  };
}

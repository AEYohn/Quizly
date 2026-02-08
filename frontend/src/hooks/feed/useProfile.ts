"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { learnApi } from "~/lib/api";
import type {
    LearnProgressResponse,
    CalibrationResponse,
    QuestionHistoryItem,
    QuestionHistorySessionSummary,
    PaginationMeta,
} from "~/lib/api";
import { useAuth } from "~/lib/auth";
import type { ProfileTab, HistoryFilter, WeakConcept } from "~/variants/contracts";

const HISTORY_BATCH = 20;

export function useProfile() {
    const auth = useAuth();
    const [progress, setProgress] = useState<LearnProgressResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Tab state
    const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>("overview");

    // Calibration
    const [calibration, setCalibration] = useState<CalibrationResponse | null>(null);
    const [isLoadingCalibration, setIsLoadingCalibration] = useState(false);
    const [calibrationLoaded, setCalibrationLoaded] = useState(false);

    // History tab
    const [questionSessions, setQuestionSessions] = useState<QuestionHistorySessionSummary[]>([]);
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyPagination, setHistoryPagination] = useState<PaginationMeta | null>(null);
    const [historyLoaded, setHistoryLoaded] = useState(false);

    // Session expansion
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [expandedSessionQuestions, setExpandedSessionQuestions] = useState<QuestionHistoryItem[]>([]);

    // Wrong answers (for weak areas tab)
    const [wrongAnswerPatterns, setWrongAnswerPatterns] = useState<QuestionHistoryItem[]>([]);
    const [isLoadingWrongAnswers, setIsLoadingWrongAnswers] = useState(false);
    const [wrongAnswersLoaded, setWrongAnswersLoaded] = useState(false);

    const studentName = auth.user?.name || "Student";
    const initial = studentName.charAt(0).toUpperCase();

    // Initial load: progress + calibration
    useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                const [progressRes, calibrationRes] = await Promise.all([
                    learnApi.getProgress(studentName),
                    learnApi.getCalibration(studentName),
                ]);
                if (progressRes.success) setProgress(progressRes.data);
                if (calibrationRes.success) {
                    setCalibration(calibrationRes.data);
                    setCalibrationLoaded(true);
                }
            } catch (err) {
                console.warn("Failed to fetch profile:", err);
            }
            setIsLoading(false);
        }
        load();
    }, [studentName]);

    // Lazy-load history when History tab activated
    useEffect(() => {
        if (activeProfileTab !== "history" || historyLoaded) return;

        async function loadHistory() {
            setIsLoadingHistory(true);
            try {
                const res = await learnApi.getQuestionHistorySessions(studentName, {
                    limit: HISTORY_BATCH,
                    offset: 0,
                });
                if (res.success) {
                    setQuestionSessions(res.data.sessions);
                    setHistoryPagination(res.data.pagination);
                    setHistoryLoaded(true);
                }
            } catch (err) {
                console.warn("Failed to load history:", err);
            }
            setIsLoadingHistory(false);
        }
        loadHistory();
    }, [activeProfileTab, historyLoaded, studentName]);

    // Lazy-load wrong answers when Weak Areas tab activated
    useEffect(() => {
        if (activeProfileTab !== "weakAreas" || wrongAnswersLoaded) return;

        async function loadWrongAnswers() {
            setIsLoadingWrongAnswers(true);
            try {
                const res = await learnApi.getQuestionHistory(studentName, { is_correct: false }, {
                    limit: 20,
                    offset: 0,
                });
                if (res.success) {
                    setWrongAnswerPatterns(res.data.items);
                    setWrongAnswersLoaded(true);
                }
            } catch (err) {
                console.warn("Failed to load wrong answers:", err);
            }
            setIsLoadingWrongAnswers(false);
        }
        loadWrongAnswers();
    }, [activeProfileTab, wrongAnswersLoaded, studentName]);

    // Load more sessions
    const onLoadMoreHistory = useCallback(async () => {
        if (!historyPagination || isLoadingHistory) return;
        const nextOffset = historyPagination.offset + historyPagination.limit;
        if (nextOffset >= historyPagination.total) return;

        setIsLoadingHistory(true);
        try {
            const res = await learnApi.getQuestionHistorySessions(studentName, {
                limit: HISTORY_BATCH,
                offset: nextOffset,
            });
            if (res.success) {
                setQuestionSessions((prev) => [...prev, ...res.data.sessions]);
                setHistoryPagination(res.data.pagination);
            }
        } catch (err) {
            console.warn("Failed to load more sessions:", err);
        }
        setIsLoadingHistory(false);
    }, [historyPagination, isLoadingHistory, studentName]);

    // Toggle session expansion
    const onToggleSession = useCallback(async (sessionId: string) => {
        if (expandedSessionId === sessionId) {
            setExpandedSessionId(null);
            setExpandedSessionQuestions([]);
            return;
        }

        setExpandedSessionId(sessionId);
        setExpandedSessionQuestions([]);

        try {
            const res = await learnApi.getSessionQuestions(sessionId);
            if (res.success) {
                setExpandedSessionQuestions(res.data.items);
            }
        } catch (err) {
            console.warn("Failed to load session questions:", err);
        }
    }, [expandedSessionId]);

    // History filter change — currently filters are visual only on session view
    // We don't re-fetch sessions, the filter is used for the expanded question display
    const onHistoryFilterChange = useCallback((filter: HistoryFilter) => {
        setHistoryFilter(filter);
    }, []);

    // Derived: weak concepts (mastery < 50, sorted ascending)
    const weakConcepts: WeakConcept[] = useMemo(() => {
        if (!progress?.mastery) return [];
        return progress.mastery
            .filter((c) => c.score < 50)
            .sort((a, b) => a.score - b.score)
            .map((c) => ({
                concept: c.concept,
                score: Math.round(c.score),
                attempts: c.attempts,
                correct: c.correct,
            }));
    }, [progress?.mastery]);

    // Compute stats from progress data
    const totalXp = progress?.recent_sessions.reduce((sum, s) => sum + (s.questions_correct * 10), 0) ?? 0;
    const totalSessions = progress?.recent_sessions.length ?? 0;
    const totalAnswered = progress?.recent_sessions.reduce((sum, s) => sum + s.questions_answered, 0) ?? 0;
    const totalCorrect = progress?.recent_sessions.reduce((sum, s) => sum + s.questions_correct, 0) ?? 0;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const level = Math.max(1, Math.floor(Math.sqrt(totalXp / 100)));

    return {
        studentName,
        initial,
        email: auth.user?.email || "Student",
        progress,
        isLoading,
        totalXp,
        totalSessions,
        accuracy,
        level,
        logout: auth.logout,
        onLogout: auth.logout,
        // Tab state
        activeProfileTab,
        onProfileTabChange: setActiveProfileTab,
        // History
        questionSessions,
        historyFilter,
        onHistoryFilterChange,
        isLoadingHistory,
        historyPagination,
        onLoadMoreHistory,
        expandedSessionId,
        expandedSessionQuestions,
        onToggleSession,
        // Calibration & weak areas
        calibration,
        isLoadingCalibration,
        weakConcepts,
        wrongAnswerPatterns,
        isLoadingWrongAnswers,
    };
}

"use client";

import { useReducer, useEffect, useCallback, useMemo } from "react";
import { learnApi } from "~/lib/api";
import type {
    LearnProgressResponse,
    CalibrationResponse,
    QuestionHistoryItem,
    QuestionHistorySessionSummary,
    PaginationMeta,
} from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";
import type { ProfileTab, HistoryFilter, WeakConcept } from "~/variants/contracts";

const HISTORY_BATCH = 20;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ProfileState {
    progress: LearnProgressResponse | null;
    isLoading: boolean;

    activeProfileTab: ProfileTab;

    calibration: CalibrationResponse | null;
    isLoadingCalibration: boolean;
    calibrationLoaded: boolean;

    questionSessions: QuestionHistorySessionSummary[];
    historyFilter: HistoryFilter;
    isLoadingHistory: boolean;
    historyPagination: PaginationMeta | null;
    historyLoaded: boolean;

    expandedSessionId: string | null;
    expandedSessionQuestions: QuestionHistoryItem[];

    wrongAnswerPatterns: QuestionHistoryItem[];
    isLoadingWrongAnswers: boolean;
    wrongAnswersLoaded: boolean;
}

const initialState: ProfileState = {
    progress: null,
    isLoading: true,

    activeProfileTab: "overview",

    calibration: null,
    isLoadingCalibration: false,
    calibrationLoaded: false,

    questionSessions: [],
    historyFilter: "all",
    isLoadingHistory: false,
    historyPagination: null,
    historyLoaded: false,

    expandedSessionId: null,
    expandedSessionQuestions: [],

    wrongAnswerPatterns: [],
    isLoadingWrongAnswers: false,
    wrongAnswersLoaded: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type ProfileAction =
    | { type: "SET_LOADING"; payload: boolean }
    | { type: "SET_PROGRESS"; payload: LearnProgressResponse | null }
    | { type: "SET_CALIBRATION"; payload: CalibrationResponse | null }
    | { type: "SET_ACTIVE_TAB"; payload: ProfileTab }
    | { type: "HISTORY_LOADING" }
    | { type: "HISTORY_LOADED"; payload: { sessions: QuestionHistorySessionSummary[]; pagination: PaginationMeta } }
    | { type: "HISTORY_APPEND"; payload: { sessions: QuestionHistorySessionSummary[]; pagination: PaginationMeta } }
    | { type: "HISTORY_DONE_LOADING" }
    | { type: "SET_HISTORY_FILTER"; payload: HistoryFilter }
    | { type: "EXPAND_SESSION"; payload: { sessionId: string } }
    | { type: "COLLAPSE_SESSION" }
    | { type: "SET_SESSION_QUESTIONS"; payload: QuestionHistoryItem[] }
    | { type: "WRONG_ANSWERS_LOADING" }
    | { type: "WRONG_ANSWERS_LOADED"; payload: QuestionHistoryItem[] }
    | { type: "WRONG_ANSWERS_DONE_LOADING" }
    | { type: "INITIAL_LOADED"; payload: { progress: LearnProgressResponse | null; calibration: CalibrationResponse | null } };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
    switch (action.type) {
        case "SET_LOADING":
            return { ...state, isLoading: action.payload };

        case "SET_PROGRESS":
            return { ...state, progress: action.payload };

        case "SET_CALIBRATION":
            return { ...state, calibration: action.payload, calibrationLoaded: true };

        case "SET_ACTIVE_TAB":
            return { ...state, activeProfileTab: action.payload };

        case "HISTORY_LOADING":
            return { ...state, isLoadingHistory: true };

        case "HISTORY_LOADED":
            return {
                ...state,
                questionSessions: action.payload.sessions,
                historyPagination: action.payload.pagination,
                historyLoaded: true,
                isLoadingHistory: false,
            };

        case "HISTORY_APPEND":
            return {
                ...state,
                questionSessions: [...state.questionSessions, ...action.payload.sessions],
                historyPagination: action.payload.pagination,
                isLoadingHistory: false,
            };

        case "HISTORY_DONE_LOADING":
            return { ...state, isLoadingHistory: false };

        case "SET_HISTORY_FILTER":
            return { ...state, historyFilter: action.payload };

        case "EXPAND_SESSION":
            return {
                ...state,
                expandedSessionId: action.payload.sessionId,
                expandedSessionQuestions: [],
            };

        case "COLLAPSE_SESSION":
            return {
                ...state,
                expandedSessionId: null,
                expandedSessionQuestions: [],
            };

        case "SET_SESSION_QUESTIONS":
            return { ...state, expandedSessionQuestions: action.payload };

        case "WRONG_ANSWERS_LOADING":
            return { ...state, isLoadingWrongAnswers: true };

        case "WRONG_ANSWERS_LOADED":
            return {
                ...state,
                wrongAnswerPatterns: action.payload,
                wrongAnswersLoaded: true,
                isLoadingWrongAnswers: false,
            };

        case "WRONG_ANSWERS_DONE_LOADING":
            return { ...state, isLoadingWrongAnswers: false };

        case "INITIAL_LOADED": {
            const next: Partial<ProfileState> = { isLoading: false };
            if (action.payload.progress) next.progress = action.payload.progress;
            if (action.payload.calibration) {
                next.calibration = action.payload.calibration;
                next.calibrationLoaded = true;
            }
            return { ...state, ...next };
        }

        default:
            return state;
    }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProfile() {
    const auth = useAuth();
    const [state, dispatch] = useReducer(profileReducer, initialState);

    const studentName = getStudentName(auth.user);
    const initial = studentName.charAt(0).toUpperCase();

    // Initial load: progress + calibration
    useEffect(() => {
        async function load() {
            dispatch({ type: "SET_LOADING", payload: true });
            try {
                const [progressRes, calibrationRes] = await Promise.all([
                    learnApi.getProgress(studentName),
                    learnApi.getCalibration(studentName),
                ]);
                dispatch({
                    type: "INITIAL_LOADED",
                    payload: {
                        progress: progressRes.success ? progressRes.data : null,
                        calibration: calibrationRes.success ? calibrationRes.data : null,
                    },
                });
            } catch (err) {
                console.warn("Failed to fetch profile:", err);
                dispatch({ type: "SET_LOADING", payload: false });
            }
        }
        load();
    }, [studentName]);

    // Lazy-load history when History tab activated
    useEffect(() => {
        if (state.activeProfileTab !== "history" || state.historyLoaded) return;

        async function loadHistory() {
            dispatch({ type: "HISTORY_LOADING" });
            try {
                const res = await learnApi.getQuestionHistorySessions(studentName, {
                    limit: HISTORY_BATCH,
                    offset: 0,
                });
                if (res.success) {
                    dispatch({
                        type: "HISTORY_LOADED",
                        payload: { sessions: res.data.sessions, pagination: res.data.pagination },
                    });
                } else {
                    dispatch({ type: "HISTORY_DONE_LOADING" });
                }
            } catch (err) {
                console.warn("Failed to load history:", err);
                dispatch({ type: "HISTORY_DONE_LOADING" });
            }
        }
        loadHistory();
    }, [state.activeProfileTab, state.historyLoaded, studentName]);

    // Lazy-load wrong answers when Weak Areas tab activated
    useEffect(() => {
        if (state.activeProfileTab !== "weakAreas" || state.wrongAnswersLoaded) return;

        async function loadWrongAnswers() {
            dispatch({ type: "WRONG_ANSWERS_LOADING" });
            try {
                const res = await learnApi.getQuestionHistory(studentName, { is_correct: false }, {
                    limit: 20,
                    offset: 0,
                });
                if (res.success) {
                    dispatch({ type: "WRONG_ANSWERS_LOADED", payload: res.data.items });
                } else {
                    dispatch({ type: "WRONG_ANSWERS_DONE_LOADING" });
                }
            } catch (err) {
                console.warn("Failed to load wrong answers:", err);
                dispatch({ type: "WRONG_ANSWERS_DONE_LOADING" });
            }
        }
        loadWrongAnswers();
    }, [state.activeProfileTab, state.wrongAnswersLoaded, studentName]);

    // Load more sessions
    const onLoadMoreHistory = useCallback(async () => {
        if (!state.historyPagination || state.isLoadingHistory) return;
        const nextOffset = state.historyPagination.offset + state.historyPagination.limit;
        if (nextOffset >= state.historyPagination.total) return;

        dispatch({ type: "HISTORY_LOADING" });
        try {
            const res = await learnApi.getQuestionHistorySessions(studentName, {
                limit: HISTORY_BATCH,
                offset: nextOffset,
            });
            if (res.success) {
                dispatch({
                    type: "HISTORY_APPEND",
                    payload: { sessions: res.data.sessions, pagination: res.data.pagination },
                });
            } else {
                dispatch({ type: "HISTORY_DONE_LOADING" });
            }
        } catch (err) {
            console.warn("Failed to load more sessions:", err);
            dispatch({ type: "HISTORY_DONE_LOADING" });
        }
    }, [state.historyPagination, state.isLoadingHistory, studentName]);

    // Toggle session expansion
    const onToggleSession = useCallback(async (sessionId: string) => {
        if (state.expandedSessionId === sessionId) {
            dispatch({ type: "COLLAPSE_SESSION" });
            return;
        }

        dispatch({ type: "EXPAND_SESSION", payload: { sessionId } });

        try {
            const res = await learnApi.getSessionQuestions(sessionId);
            if (res.success) {
                dispatch({ type: "SET_SESSION_QUESTIONS", payload: res.data.items });
            }
        } catch (err) {
            console.warn("Failed to load session questions:", err);
        }
    }, [state.expandedSessionId]);

    // History filter change
    const onHistoryFilterChange = useCallback((filter: HistoryFilter) => {
        dispatch({ type: "SET_HISTORY_FILTER", payload: filter });
    }, []);

    // Tab change
    const onProfileTabChange = useCallback((tab: ProfileTab) => {
        dispatch({ type: "SET_ACTIVE_TAB", payload: tab });
    }, []);

    // Derived: weak concepts (mastery < 50, sorted ascending)
    const weakConcepts: WeakConcept[] = useMemo(() => {
        if (!state.progress?.mastery) return [];
        return state.progress.mastery
            .filter((c) => c.score < 50)
            .sort((a, b) => a.score - b.score)
            .map((c) => ({
                concept: c.concept,
                score: Math.round(c.score),
                attempts: c.attempts,
                correct: c.correct,
            }));
    }, [state.progress?.mastery]);

    // Compute stats from progress data
    const totalXp = state.progress?.recent_sessions.reduce((sum, s) => sum + (s.questions_correct * 10), 0) ?? 0;
    const totalSessions = state.progress?.recent_sessions.length ?? 0;
    const totalAnswered = state.progress?.recent_sessions.reduce((sum, s) => sum + s.questions_answered, 0) ?? 0;
    const totalCorrect = state.progress?.recent_sessions.reduce((sum, s) => sum + s.questions_correct, 0) ?? 0;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const level = Math.max(1, Math.floor(Math.sqrt(totalXp / 100)));

    return {
        studentName,
        initial,
        email: auth.user?.email || "Student",
        progress: state.progress,
        isLoading: state.isLoading,
        totalXp,
        totalSessions,
        accuracy,
        level,
        logout: auth.logout,
        onLogout: auth.logout,
        // Tab state
        activeProfileTab: state.activeProfileTab,
        onProfileTabChange,
        // History
        questionSessions: state.questionSessions,
        historyFilter: state.historyFilter,
        onHistoryFilterChange,
        isLoadingHistory: state.isLoadingHistory,
        historyPagination: state.historyPagination,
        onLoadMoreHistory,
        expandedSessionId: state.expandedSessionId,
        expandedSessionQuestions: state.expandedSessionQuestions,
        onToggleSession,
        // Calibration & weak areas
        calibration: state.calibration,
        isLoadingCalibration: state.isLoadingCalibration,
        weakConcepts,
        wrongAnswerPatterns: state.wrongAnswerPatterns,
        isLoadingWrongAnswers: state.isLoadingWrongAnswers,
    };
}

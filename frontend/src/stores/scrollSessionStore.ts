import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScrollCard, ScrollStats, ScrollAnalytics, SubjectHistory, LearningHistoryResponse, ResumeSessionInfo } from "~/lib/api";

// ============================================
// Types
// ============================================

export interface FeedPreferences {
    difficulty: number | null; // null = auto, 0.0-1.0 = manual
    contentMix: { mcq: number; flashcard: number; info_card: number; resource_card: number };
    questionStyle: string | null; // "conceptual" | "application" | "analysis" | "transfer" | null
}

export const PRESETS = {
    QUIZ_HEAVY: { mcq: 0.7, flashcard: 0.1, info_card: 0.1, resource_card: 0.1 },
    BALANCED: { mcq: 0.5, flashcard: 0.2, info_card: 0.15, resource_card: 0.15 },
    FLASHCARD_FOCUS: { mcq: 0.15, flashcard: 0.55, info_card: 0.15, resource_card: 0.15 },
} as const;

export const DEFAULT_PREFERENCES: FeedPreferences = {
    difficulty: null,
    contentMix: { ...PRESETS.BALANCED },
    questionStyle: null,
};

// ============================================
// Syllabus types
// ============================================

export interface SyllabusTopic {
    id: string;
    name: string;
    order: number;
    concepts: string[];
    prerequisites: string[];
    estimated_minutes: number;
}

export interface SyllabusUnit {
    id: string;
    name: string;
    order: number;
    icon: string;
    topics: SyllabusTopic[];
}

export interface SyllabusTree {
    subject: string;
    units: SyllabusUnit[];
}

// ============================================
// Store interface
// ============================================

interface ScrollSessionState {
    // Session (persisted)
    sessionId: string | null;
    topic: string | null;
    cards: ScrollCard[];
    currentIdx: number;
    stats: ScrollStats;
    preferences: FeedPreferences;
    topicInput: string;
    notesInput: string;

    // Syllabus (persisted)
    syllabus: SyllabusTree | null;
    selectedSubject: string | null;
    activeSyllabusNode: string | null;

    // Syllabus (transient)
    syllabusLoading: boolean;
    mastery: Record<string, number>; // topicId → mastery 0-100
    presence: Record<string, number>; // topicId → active learner count

    // RL-adaptive (transient)
    recommendedNext: string | null;
    bktMastery: Record<string, { pLearned: number; confidence: number }>;

    // Learning history (transient)
    history: SubjectHistory[];
    historyOverall: LearningHistoryResponse["overall"] | null;
    historyLoading: boolean;
    suggestions: string[];
    activeSession: ResumeSessionInfo | null;

    // Resources (transient)
    subjectResources: Array<{ id: string; file_name: string; file_type: string; concepts_count: number }>;
    isUploadingResource: boolean;

    // Assessment (transient)
    assessmentPhase: 'none' | 'self_rating' | 'diagnostic' | 'complete';

    // Codebase analysis (transient)
    codebaseAnalysis: Record<string, unknown> | null;
    codebaseLoading: boolean;
    githubUrlInput: string;

    // Interaction (not persisted)
    result: { isCorrect: boolean; xpEarned: number; streakBroken: boolean } | null;
    analytics: ScrollAnalytics | null;
    flashcardXp: number | null;
    infoAcknowledged: boolean;
    isLoading: boolean;
    error: string | null;
    showHelp: boolean;

    // Actions
    setSessionId: (id: string) => void;
    setTopic: (topic: string) => void;
    setCards: (cards: ScrollCard[]) => void;
    addCards: (cards: ScrollCard[]) => void;
    setCurrentIdx: (idx: number) => void;
    advanceCard: () => void;
    setStats: (stats: ScrollStats) => void;
    setPreferences: (prefs: Partial<FeedPreferences>) => void;
    setTopicInput: (value: string) => void;
    setNotesInput: (value: string) => void;
    setResult: (result: ScrollSessionState["result"]) => void;
    setAnalytics: (analytics: ScrollAnalytics | null) => void;
    setFlashcardXp: (xp: number | null) => void;
    setInfoAcknowledged: (value: boolean) => void;
    setIsLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    setShowHelp: (value: boolean) => void;
    clearCardState: () => void;
    reset: () => void;
    // Syllabus actions
    setSyllabus: (tree: SyllabusTree) => void;
    setSelectedSubject: (subject: string | null) => void;
    setSyllabusLoading: (loading: boolean) => void;
    setMastery: (mastery: Record<string, number>) => void;
    setPresence: (presence: Record<string, number>) => void;
    setActiveSyllabusNode: (nodeId: string | null) => void;
    clearSyllabus: () => void;
    // RL-adaptive actions
    setRecommendedNext: (id: string | null) => void;
    setBktMastery: (m: Record<string, { pLearned: number; confidence: number }>) => void;
    // Resource actions
    setSubjectResources: (r: Array<{ id: string; file_name: string; file_type: string; concepts_count: number }>) => void;
    setIsUploadingResource: (v: boolean) => void;
    addSubjectResource: (r: { id: string; file_name: string; file_type: string; concepts_count: number }) => void;
    removeSubjectResource: (id: string) => void;
    // History actions
    setHistory: (subjects: SubjectHistory[], overall: LearningHistoryResponse["overall"]) => void;
    setHistoryLoading: (loading: boolean) => void;
    setSuggestions: (s: string[]) => void;
    setActiveSession: (s: ResumeSessionInfo | null) => void;
    // Assessment actions
    setAssessmentPhase: (phase: 'none' | 'self_rating' | 'diagnostic' | 'complete') => void;
    // Codebase actions
    setCodebaseAnalysis: (a: Record<string, unknown> | null) => void;
    setCodebaseLoading: (v: boolean) => void;
    setGithubUrlInput: (v: string) => void;
}

// ============================================
// Initial state
// ============================================

const initialStats: ScrollStats = {
    streak: 0,
    best_streak: 0,
    total_xp: 0,
    difficulty: 0.4,
    cards_shown: 0,
};

const initialState = {
    sessionId: null as string | null,
    topic: null as string | null,
    cards: [] as ScrollCard[],
    currentIdx: 0,
    stats: initialStats,
    preferences: { ...DEFAULT_PREFERENCES },
    topicInput: "",
    notesInput: "",
    // Syllabus (persisted)
    syllabus: null as SyllabusTree | null,
    selectedSubject: null as string | null,
    activeSyllabusNode: null as string | null,
    // Syllabus (transient)
    syllabusLoading: false,
    mastery: {} as Record<string, number>,
    presence: {} as Record<string, number>,
    // RL-adaptive (transient)
    recommendedNext: null as string | null,
    bktMastery: {} as Record<string, { pLearned: number; confidence: number }>,
    // History (transient)
    history: [] as SubjectHistory[],
    historyOverall: null as LearningHistoryResponse["overall"] | null,
    historyLoading: false,
    suggestions: [] as string[],
    activeSession: null as ResumeSessionInfo | null,
    // Resources (transient)
    subjectResources: [] as Array<{ id: string; file_name: string; file_type: string; concepts_count: number }>,
    isUploadingResource: false,
    // Assessment (transient)
    assessmentPhase: 'none' as const,
    // Codebase (transient)
    codebaseAnalysis: null as Record<string, unknown> | null,
    codebaseLoading: false,
    githubUrlInput: "",
    // Interaction (transient)
    result: null as ScrollSessionState["result"],
    analytics: null as ScrollAnalytics | null,
    flashcardXp: null as number | null,
    infoAcknowledged: false,
    isLoading: false,
    error: null as string | null,
    showHelp: false,
};

// ============================================
// Store
// ============================================

export const useScrollSessionStore = create<ScrollSessionState>()(
    persist(
        (set) => ({
            ...initialState,

            setSessionId: (id) => set({ sessionId: id }),
            setTopic: (topic) => set({ topic }),
            setCards: (cards) => set({ cards }),
            addCards: (cards) =>
                set((state) => ({ cards: [...state.cards, ...cards] })),
            setCurrentIdx: (idx) => set({ currentIdx: idx }),
            advanceCard: () =>
                set((state) => ({
                    currentIdx: state.currentIdx + 1,
                    result: null,
                    analytics: null,
                    flashcardXp: null,
                    infoAcknowledged: false,
                    showHelp: false,
                })),
            setStats: (stats) => set({ stats }),
            setPreferences: (prefs) =>
                set((state) => ({
                    preferences: { ...state.preferences, ...prefs },
                })),
            setTopicInput: (value) => set({ topicInput: value }),
            setNotesInput: (value) => set({ notesInput: value }),
            setResult: (result) => set({ result }),
            setAnalytics: (analytics) => set({ analytics }),
            setFlashcardXp: (xp) => set({ flashcardXp: xp }),
            setInfoAcknowledged: (value) => set({ infoAcknowledged: value }),
            setIsLoading: (value) => set({ isLoading: value }),
            setError: (error) => set({ error }),
            setShowHelp: (value) => set({ showHelp: value }),
            clearCardState: () =>
                set({
                    result: null,
                    analytics: null,
                    flashcardXp: null,
                    infoAcknowledged: false,
                    showHelp: false,
                }),
            reset: () =>
                set((state) => ({
                    ...initialState,
                    // Preserve syllabus state when resetting feed session
                    syllabus: state.syllabus,
                    selectedSubject: state.selectedSubject,
                    mastery: state.mastery,
                    presence: state.presence,
                    recommendedNext: state.recommendedNext,
                    bktMastery: state.bktMastery,
                })),
            // Syllabus actions
            setSyllabus: (tree) => set({ syllabus: tree }),
            setSelectedSubject: (subject) => set({ selectedSubject: subject }),
            setSyllabusLoading: (loading) => set({ syllabusLoading: loading }),
            setMastery: (mastery) => set({ mastery }),
            setPresence: (presence) => set({ presence }),
            setActiveSyllabusNode: (nodeId) => set({ activeSyllabusNode: nodeId }),
            clearSyllabus: () =>
                set({
                    syllabus: null,
                    selectedSubject: null,
                    activeSyllabusNode: null,
                    mastery: {},
                    presence: {},
                    recommendedNext: null,
                    bktMastery: {},
                }),
            // RL-adaptive actions
            setRecommendedNext: (id) => set({ recommendedNext: id }),
            setBktMastery: (m) => set({ bktMastery: m }),
            // Resource actions
            setSubjectResources: (r) => set({ subjectResources: r }),
            setIsUploadingResource: (v) => set({ isUploadingResource: v }),
            addSubjectResource: (r) => set((state) => ({ subjectResources: [...state.subjectResources, r] })),
            removeSubjectResource: (id) => set((state) => ({
                subjectResources: state.subjectResources.filter((r) => r.id !== id),
            })),
            // History actions
            setHistory: (subjects, overall) => set({ history: subjects, historyOverall: overall }),
            setHistoryLoading: (loading) => set({ historyLoading: loading }),
            setSuggestions: (s) => set({ suggestions: s }),
            setActiveSession: (s) => set({ activeSession: s }),
            // Assessment actions
            setAssessmentPhase: (phase) => set({ assessmentPhase: phase }),
            // Codebase actions
            setCodebaseAnalysis: (a) => set({ codebaseAnalysis: a }),
            setCodebaseLoading: (v) => set({ codebaseLoading: v }),
            setGithubUrlInput: (v) => set({ githubUrlInput: v }),
        }),
        {
            name: "quizly-scroll-session",
            partialize: (state) => ({
                sessionId: state.sessionId,
                topic: state.topic,
                cards: state.cards.slice(-20), // Keep last 20 cards
                currentIdx: state.currentIdx,
                stats: state.stats,
                preferences: state.preferences,
                topicInput: state.topicInput,
                notesInput: state.notesInput,
                syllabus: state.syllabus,
                selectedSubject: state.selectedSubject,
                activeSyllabusNode: state.activeSyllabusNode,
            }),
        }
    )
);

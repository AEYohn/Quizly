import type { ScrollCard, ScrollStats, ScrollAnalytics, ScrollSessionAnalytics, LeaderboardEntry, LearnProgressResponse, QuestionHistoryItem, QuestionHistorySessionSummary, CalibrationResponse, PaginationMeta } from "~/lib/api";
import type { ApiResult } from "~/types";
import type { SyllabusTopic, SyllabusTree } from "~/stores/scrollSessionStore";

// Home screen props
export interface HomeScreenProps {
    history: Array<{
        subject: string;
        total_sessions: number;
        total_questions: number;
        accuracy: number;
        total_xp: number;
        last_studied_at: string | null;
        has_syllabus: boolean;
    }>;
    historyOverall: { total_subjects: number; total_sessions: number; total_questions: number; total_xp: number; concepts_mastered: number } | null;
    suggestions: string[];
    activeSession: { session_id: string; topic: string; questions_answered: number; questions_correct: number; total_xp: number; streak: number; accuracy: number } | null;
    topicInput: string;
    syllabusLoading: boolean;
    isLoading: boolean;
    error: string | null;
    onTopicInputChange: (value: string) => void;
    onSubjectSelect: (subject: string) => void;
    onQuickStart: (topic: string) => void;
    onPdfUpload: (files: FileList) => void;
    pdfUploading: boolean;
    pdfUploadStage: string;
    onDeleteSubject: (subject: string) => void;
    timeAgo: (iso: string | null) => string;
    // Codebase analysis
    onCodebaseAnalyze?: (githubUrl: string) => void;
    codebaseLoading?: boolean;
    githubUrlInput?: string;
    onGithubUrlInputChange?: (value: string) => void;
}

// Skill tree props
export interface SkillTreeProps {
    syllabus: SyllabusTree;
    mastery: Record<string, number>;
    presence: Record<string, number>;
    recommendedNext: string | null;
    totalPresence: number;
    resourceCount: number;
    isUploading: boolean;
    isLoading: boolean;
    loadingMessage: string;
    error: string | null;
    showRegenBanner: boolean;
    isRegenerating: boolean;
    subjectResources: Array<{ id: string; file_name: string; file_type: string; concepts_count: number }>;
    showResourceSheet: boolean;
    onNodeTap: (topic: SyllabusTopic) => void;
    onStartLearning: (topic: SyllabusTopic) => void;
    onStudyNotes: (topic: SyllabusTopic) => Promise<ApiResult<{ topic: string; total_notes: number; notes_by_concept: Record<string, Array<{ id: string; concept: string; title: string; body_markdown: string; key_takeaway: string }>> }>>;
    onQuizOnly: (topic: SyllabusTopic) => void;
    recentSessions: Array<{ id: string; topic: string; phase: string; questions_answered: number; questions_correct: number; accuracy: number; started_at: string | null; ended_at: string | null }>;
    onBack: () => void;
    onUploadResource: (files: FileList) => void;
    onManageResources: () => void;
    onDeleteResource: (id: string) => void;
    onRegenerateSyllabus: () => void;
    onDismissRegenBanner: () => void;
    onCloseResourceSheet: () => void;
    // Assessment
    onStartAssessment?: () => void;
    assessmentPhase?: string;
    topicResources?: Record<string, Array<{ title: string; url: string; source_type: string; thumbnail_url?: string }>>;
    // Analysis
    onOpenAnalysis?: () => void;
}

// Active feed props
export interface ActiveFeedProps {
    currentCard: ScrollCard;
    cards: ScrollCard[];
    currentIdx: number;
    stats: ScrollStats;
    result: { isCorrect: boolean; xpEarned: number; streakBroken: boolean } | null;
    analytics: ScrollAnalytics | null;
    flashcardXp: number | null;
    infoAcknowledged: boolean;
    showHelp: boolean;
    sessionId: string;
    selectedSubject: string | null;
    sessionAnalytics: ScrollSessionAnalytics | null;
    showAnalytics: boolean;
    showTuneSheet: boolean;
    showNotes: boolean;
    uploadedFile: File | null;
    isProcessingFile: boolean;
    onAnswer: (answer: string) => void;
    onNext: () => void;
    onSkip: () => void;
    onHelp: () => void;
    onCloseHelp: () => void;
    onFlashcardRate: (rating: number) => void;
    onInfoGotIt: () => void;
    onShowAnalytics: () => void;
    onCloseAnalytics: () => void;
    onOpenTuneSheet: () => void;
    onCloseTuneSheet: () => void;
    onFileUpload: (file: File) => void;
    onToggleNotes: () => void;
    onReset: () => void;
    notesData: { topic: string; total_notes: number; notes_by_concept: Record<string, Array<{ id: string; concept: string; title: string; body_markdown: string; key_takeaway: string }>> } | null;
    notesLoading: boolean;
}

// Leaderboard props
export interface LeaderboardProps {
    period: "weekly" | "alltime";
    entries: LeaderboardEntry[];
    currentUserEntry: LeaderboardEntry | null;
    totalPlayers: number;
    isLoading: boolean;
    onPeriodChange: (period: "weekly" | "alltime") => void;
}

// Profile tab types
export type ProfileTab = "overview" | "history" | "weakAreas";
export type HistoryFilter = "all" | "correct" | "incorrect";

export interface WeakConcept {
    concept: string;
    score: number;
    attempts: number;
    correct: number;
}

// Profile props
export interface ProfileProps {
    studentName: string;
    initial: string;
    email: string;
    progress: LearnProgressResponse | null;
    isLoading: boolean;
    totalXp: number;
    totalSessions: number;
    accuracy: number;
    level: number;
    onLogout: () => void;
    // Tab state
    activeProfileTab: ProfileTab;
    onProfileTabChange: (tab: ProfileTab) => void;
    // History tab
    questionSessions: QuestionHistorySessionSummary[];
    historyFilter: HistoryFilter;
    onHistoryFilterChange: (filter: HistoryFilter) => void;
    isLoadingHistory: boolean;
    historyPagination: PaginationMeta | null;
    onLoadMoreHistory: () => void;
    expandedSessionId: string | null;
    expandedSessionQuestions: QuestionHistoryItem[];
    onToggleSession: (sessionId: string) => void;
    // Calibration & weak areas
    calibration: CalibrationResponse | null;
    isLoadingCalibration: boolean;
    weakConcepts: WeakConcept[];
    wrongAnswerPatterns: QuestionHistoryItem[];
    isLoadingWrongAnswers: boolean;
}

// Variant component set
export interface VariantComponents {
    Feed: React.ComponentType;
    HomeScreen: React.ComponentType<HomeScreenProps>;
    SkillTree: React.ComponentType<SkillTreeProps>;
    ActiveFeed: React.ComponentType<ActiveFeedProps>;
    Leaderboard: React.ComponentType<LeaderboardProps>;
    Profile: React.ComponentType<ProfileProps>;
}

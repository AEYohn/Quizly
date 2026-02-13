"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
    BookOpen,
    Zap,
    Check,
    X,
    ChevronDown,
    ChevronUp,
    Loader2,
    Filter,
    Clock,
    Target,
    ArrowLeft,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
    learnApi,
    type QuestionHistoryItem,
    type QuestionHistorySessionSummary,
    type PaginationMeta,
} from "~/lib/api";

const BATCH_SIZE = 20;

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function truncate(str: string, len: number): string {
    if (str.length <= len) return str;
    return str.slice(0, len) + "...";
}

// ============================================
// Session Card
// ============================================

function SessionCard({
    session,
    studentName,
}: {
    session: QuestionHistorySessionSummary;
    studentName: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const [questions, setQuestions] = useState<QuestionHistoryItem[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    const loadQuestions = useCallback(async () => {
        if (questions.length > 0) return;
        setLoadingQuestions(true);
        const res = await learnApi.getSessionQuestions(session.session_id);
        if (res.success) {
            setQuestions(res.data.items);
        }
        setLoadingQuestions(false);
    }, [session.session_id, questions.length]);

    const handleToggle = () => {
        if (!expanded) loadQuestions();
        setExpanded((p) => !p);
    };

    const accuracyColor =
        session.accuracy >= 80
            ? "text-green-400"
            : session.accuracy >= 50
              ? "text-yellow-400"
              : "text-red-400";

    return (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
            <button
                onClick={handleToggle}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
            >
                <div className="flex-shrink-0">
                    {session.mode === "scroll" ? (
                        <Zap className="h-5 w-5 text-yellow-400" />
                    ) : (
                        <BookOpen className="h-5 w-5 text-blue-400" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{session.topic}</p>
                    <p className="text-xs text-gray-400">
                        {formatDate(session.started_at)} &middot; {session.questions_answered} questions
                    </p>
                </div>
                <div className={cn("text-sm font-semibold", accuracyColor)}>
                    {session.accuracy}%
                </div>
                {expanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                )}
            </button>

            {expanded && (
                <div className="border-t border-gray-800 px-4 py-3">
                    {loadingQuestions ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                        </div>
                    ) : questions.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">
                            No question data available for this session.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {questions.map((q) => (
                                <QuestionRow key={q.id} question={q} compact />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// Question Row
// ============================================

function QuestionRow({ question, compact }: { question: QuestionHistoryItem; compact?: boolean }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className={cn(
                "rounded-lg border bg-gray-900/30",
                question.is_correct ? "border-green-900/30" : "border-red-900/30"
            )}
        >
            <button
                onClick={() => setExpanded((p) => !p)}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-800/30 transition-colors"
            >
                <div className="flex-shrink-0 mt-0.5">
                    {question.is_correct ? (
                        <Check className="h-4 w-4 text-green-400" />
                    ) : (
                        <X className="h-4 w-4 text-red-400" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">
                        {compact ? truncate(question.prompt, 80) : question.prompt}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="inline-flex items-center rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                            {question.concept}
                        </span>
                        {!compact && (
                            <span className="text-xs text-gray-500">
                                {formatDate(question.answered_at)} {formatTime(question.answered_at)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0">
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-gray-800 px-3 py-2.5 space-y-2">
                    {!compact && <p className="text-sm text-gray-300">{question.prompt}</p>}
                    <div className="flex flex-col gap-1 text-sm">
                        <div className="flex gap-2">
                            <span className="text-gray-500">Your answer:</span>
                            <span
                                className={
                                    question.is_correct ? "text-green-400" : "text-red-400"
                                }
                            >
                                {question.student_answer}
                            </span>
                        </div>
                        {!question.is_correct && (
                            <div className="flex gap-2">
                                <span className="text-gray-500">Correct:</span>
                                <span className="text-green-400">{question.correct_answer}</span>
                            </div>
                        )}
                    </div>
                    {question.explanation && (
                        <p className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-2">
                            {question.explanation}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// Filter Chips
// ============================================

function FilterChip({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                active
                    ? "bg-teal-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            )}
        >
            {label}
        </button>
    );
}

// ============================================
// Main Page
// ============================================

export default function HistoryPage() {
    const router = useRouter();
    const { user: clerkUser } = useUser();

    const [studentName, setStudentName] = useState("");
    const [tab, setTab] = useState<"sessions" | "questions">("sessions");
    const [loading, setLoading] = useState(true);

    // Sessions tab state
    const [sessions, setSessions] = useState<QuestionHistorySessionSummary[]>([]);
    const [sessionsPagination, setSessionsPagination] = useState<PaginationMeta | null>(null);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Questions tab state
    const [questions, setQuestions] = useState<QuestionHistoryItem[]>([]);
    const [questionsPagination, setQuestionsPagination] = useState<PaginationMeta | null>(null);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // Filters for questions tab
    const [filterCorrect, setFilterCorrect] = useState<boolean | undefined>(undefined);

    // Resolve student name
    useEffect(() => {
        const customName = localStorage.getItem("quizly_display_name");
        const name =
            customName ||
            clerkUser?.firstName ||
            clerkUser?.username ||
            localStorage.getItem("quizly_student_name");
        if (name) {
            setStudentName(name);
        } else {
            router.push("/student");
        }
    }, [clerkUser, router]);

    // Load sessions
    const loadSessions = useCallback(
        async (offset = 0) => {
            if (!studentName) return;
            setLoadingSessions(true);
            const res = await learnApi.getQuestionHistorySessions(studentName, {
                limit: BATCH_SIZE,
                offset,
            });
            if (res.success) {
                if (offset === 0) {
                    setSessions(res.data.sessions);
                } else {
                    setSessions((prev) => [...prev, ...res.data.sessions]);
                }
                setSessionsPagination(res.data.pagination);
            }
            setLoadingSessions(false);
            setLoading(false);
        },
        [studentName]
    );

    // Load questions
    const loadQuestions = useCallback(
        async (offset = 0, correctFilter?: boolean) => {
            if (!studentName) return;
            setLoadingQuestions(true);
            const filters: { is_correct?: boolean } = {};
            if (correctFilter !== undefined) {
                filters.is_correct = correctFilter;
            }
            const res = await learnApi.getQuestionHistory(studentName, filters, {
                limit: BATCH_SIZE,
                offset,
            });
            if (res.success) {
                if (offset === 0) {
                    setQuestions(res.data.items);
                } else {
                    setQuestions((prev) => [...prev, ...res.data.items]);
                }
                setQuestionsPagination(res.data.pagination);
            }
            setLoadingQuestions(false);
            setLoading(false);
        },
        [studentName]
    );

    // Initial load
    useEffect(() => {
        if (!studentName) return;
        if (tab === "sessions") {
            loadSessions(0);
        } else {
            loadQuestions(0, filterCorrect);
        }
    }, [studentName, tab, filterCorrect, loadSessions, loadQuestions]);

    const hasMoreSessions =
        sessionsPagination &&
        sessionsPagination.offset + sessionsPagination.limit < sessionsPagination.total;

    const hasMoreQuestions =
        questionsPagination &&
        questionsPagination.offset + questionsPagination.limit < questionsPagination.total;

    if (loading && !studentName) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="mx-auto max-w-3xl px-4 py-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => router.push("/student/dashboard")}
                        className="rounded-lg p-2 hover:bg-gray-800 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">Question History</h1>
                        <p className="text-sm text-gray-400">
                            Review your past questions and track progress
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 rounded-lg bg-gray-900 p-1 mb-6">
                    <button
                        onClick={() => setTab("sessions")}
                        className={cn(
                            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                            tab === "sessions"
                                ? "bg-gray-800 text-white"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        <Clock className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                        Sessions
                    </button>
                    <button
                        onClick={() => setTab("questions")}
                        className={cn(
                            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                            tab === "questions"
                                ? "bg-gray-800 text-white"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        <Target className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                        Questions
                    </button>
                </div>

                {/* Sessions Tab */}
                {tab === "sessions" && (
                    <div className="space-y-3">
                        {loading && sessions.length === 0 ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="text-center py-12">
                                <BookOpen className="mx-auto h-10 w-10 text-gray-600 mb-3" />
                                <p className="text-gray-400">No sessions yet.</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Start learning and your question history will appear here.
                                </p>
                            </div>
                        ) : (
                            <>
                                {sessions.map((s) => (
                                    <SessionCard
                                        key={s.session_id}
                                        session={s}
                                        studentName={studentName}
                                    />
                                ))}
                                {sessionsPagination && (
                                    <p className="text-center text-xs text-gray-500">
                                        Showing {sessions.length} of {sessionsPagination.total}
                                    </p>
                                )}
                                {hasMoreSessions && (
                                    <button
                                        onClick={() =>
                                            loadSessions(
                                                (sessionsPagination?.offset ?? 0) +
                                                    BATCH_SIZE
                                            )
                                        }
                                        disabled={loadingSessions}
                                        className="w-full rounded-lg border border-gray-800 py-2.5 text-sm text-gray-400 hover:bg-gray-900 hover:text-white transition-colors disabled:opacity-50"
                                    >
                                        {loadingSessions ? (
                                            <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                                        ) : null}
                                        Load more
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Questions Tab */}
                {tab === "questions" && (
                    <div className="space-y-3">
                        {/* Filters */}
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="h-4 w-4 text-gray-500" />
                            <FilterChip
                                label="All"
                                active={filterCorrect === undefined}
                                onClick={() => setFilterCorrect(undefined)}
                            />
                            <FilterChip
                                label="Correct"
                                active={filterCorrect === true}
                                onClick={() =>
                                    setFilterCorrect(filterCorrect === true ? undefined : true)
                                }
                            />
                            <FilterChip
                                label="Incorrect"
                                active={filterCorrect === false}
                                onClick={() =>
                                    setFilterCorrect(filterCorrect === false ? undefined : false)
                                }
                            />
                        </div>

                        {loading && questions.length === 0 ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
                            </div>
                        ) : questions.length === 0 ? (
                            <div className="text-center py-12">
                                <Target className="mx-auto h-10 w-10 text-gray-600 mb-3" />
                                <p className="text-gray-400">No questions found.</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {filterCorrect !== undefined
                                        ? "Try clearing your filters."
                                        : "Start learning and your questions will appear here."}
                                </p>
                            </div>
                        ) : (
                            <>
                                {questions.map((q) => (
                                    <QuestionRow key={q.id} question={q} />
                                ))}
                                {questionsPagination && (
                                    <p className="text-center text-xs text-gray-500">
                                        Showing {questions.length} of {questionsPagination.total}
                                    </p>
                                )}
                                {hasMoreQuestions && (
                                    <button
                                        onClick={() =>
                                            loadQuestions(
                                                (questionsPagination?.offset ?? 0) +
                                                    BATCH_SIZE,
                                                filterCorrect
                                            )
                                        }
                                        disabled={loadingQuestions}
                                        className="w-full rounded-lg border border-gray-800 py-2.5 text-sm text-gray-400 hover:bg-gray-900 hover:text-white transition-colors disabled:opacity-50"
                                    >
                                        {loadingQuestions ? (
                                            <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                                        ) : null}
                                        Load more
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

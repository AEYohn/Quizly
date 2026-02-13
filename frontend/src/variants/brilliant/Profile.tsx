"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
    LogOut,
    Zap,
    Target,
    BookOpen,
    TrendingUp,
    Award,
    Loader2,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    AlertTriangle,
    Brain,
    Clock,
    History,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { ProfileProps, ProfileTab } from "~/variants/contracts";
import type { QuestionHistoryItem, QuestionHistorySessionSummary } from "~/lib/api";

const CalibrationChart = dynamic(
    () => import("~/components/feed/CalibrationChart").then((m) => ({ default: m.CalibrationChart })),
    { ssr: false },
);

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncate(str: string, len: number): string {
    if (str.length <= len) return str;
    return str.slice(0, len) + "...";
}

// ============================================
// Sub-components
// ============================================

function SessionRow({
    session,
    isExpanded,
    questions,
    historyFilter,
    onToggle,
}: {
    session: QuestionHistorySessionSummary;
    isExpanded: boolean;
    questions: QuestionHistoryItem[];
    historyFilter: string;
    onToggle: () => void;
}) {
    const accuracyColor =
        session.accuracy >= 80
            ? "text-emerald-400"
            : session.accuracy >= 50
              ? "text-amber-400"
              : "text-red-400";

    const filteredQuestions = questions.filter((q) => {
        if (historyFilter === "correct") return q.is_correct;
        if (historyFilter === "incorrect") return !q.is_correct;
        return true;
    });

    return (
        <div className="rounded-xl border border-teal-500/10 bg-[#1A1A1A]/60 overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-teal-500/5 transition-colors text-left"
            >
                <div className="shrink-0">
                    {session.mode === "scroll" ? (
                        <Zap className="h-4 w-4 text-amber-400" />
                    ) : (
                        <BookOpen className="h-4 w-4 text-teal-400" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{session.topic}</p>
                    <p className="text-[11px] text-teal-300/30">
                        {formatDate(session.started_at)} &middot; {session.questions_answered}q
                    </p>
                </div>
                <span className={cn("text-sm font-bold tabular-nums", accuracyColor)}>
                    {session.accuracy}%
                </span>
                {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-teal-300/30 shrink-0" />
                ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-teal-300/30 shrink-0" />
                )}
            </button>

            {isExpanded && (
                <div className="border-t border-teal-500/8 px-4 py-3">
                    {questions.length === 0 ? (
                        <div className="flex justify-center py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-teal-400/50" />
                        </div>
                    ) : filteredQuestions.length === 0 ? (
                        <p className="text-xs text-teal-300/30 text-center py-2">No matching questions.</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredQuestions.map((q) => (
                                <QuestionItem key={q.id} question={q} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function QuestionItem({ question }: { question: QuestionHistoryItem }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className={cn(
                "rounded-lg border",
                question.is_correct ? "border-emerald-500/10 bg-emerald-500/[0.03]" : "border-red-500/10 bg-red-500/[0.03]",
            )}
        >
            <button
                onClick={() => setExpanded((p) => !p)}
                className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
            >
                <div className="shrink-0 mt-0.5">
                    {question.is_correct ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                        <X className="h-3.5 w-3.5 text-red-400" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gray-300 leading-snug">{truncate(question.prompt, 90)}</p>
                    <span className="inline-block mt-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300/50">
                        {question.concept}
                    </span>
                </div>
                <div className="shrink-0">
                    {expanded ? (
                        <ChevronUp className="h-3 w-3 text-teal-300/30" />
                    ) : (
                        <ChevronDown className="h-3 w-3 text-teal-300/30" />
                    )}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-teal-500/8 px-3 py-2.5 space-y-1.5 text-[12px]">
                    <div className="flex gap-2">
                        <span className="text-teal-300/40">Your answer:</span>
                        <span className={question.is_correct ? "text-emerald-400" : "text-red-400"}>
                            {question.student_answer}
                        </span>
                    </div>
                    {!question.is_correct && (
                        <div className="flex gap-2">
                            <span className="text-teal-300/40">Correct:</span>
                            <span className="text-emerald-400">{question.correct_answer}</span>
                        </div>
                    )}
                    {question.explanation && (
                        <p className="text-teal-300/40 bg-teal-500/5 rounded-lg p-2 mt-1 leading-relaxed">
                            {question.explanation}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// Main Profile Component
// ============================================

export function Profile({
    studentName,
    initial,
    email,
    progress,
    isLoading,
    totalXp,
    totalSessions,
    accuracy,
    level,
    onLogout,
    activeProfileTab,
    onProfileTabChange,
    questionSessions,
    historyFilter,
    onHistoryFilterChange,
    isLoadingHistory,
    historyPagination,
    onLoadMoreHistory,
    expandedSessionId,
    expandedSessionQuestions,
    onToggleSession,
    calibration,
    isLoadingCalibration,
    weakConcepts,
    wrongAnswerPatterns,
    isLoadingWrongAnswers,
}: ProfileProps) {
    const xpForLevel = level * 500;
    const xpProgress = totalXp % 500;
    const xpPercent = Math.min((xpProgress / 500) * 100, 100);

    const tabs: { id: ProfileTab; label: string }[] = [
        { id: "overview", label: "Overview" },
        { id: "history", label: "History" },
        { id: "weakAreas", label: "Weak Areas" },
    ];

    const hasMoreSessions =
        historyPagination &&
        historyPagination.offset + historyPagination.limit < historyPagination.total;

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-[#0F0F0F] via-[#131313] to-[#0F0F0F] relative overflow-y-auto">
            {/* Star field */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(1px 1px at 8% 12%, rgba(255,255,255,0.3) 50%, transparent 100%),
                        radial-gradient(1px 1px at 25% 45%, rgba(77,208,225,0.3) 50%, transparent 100%),
                        radial-gradient(1px 1px at 50% 20%, rgba(255,255,255,0.2) 50%, transparent 100%),
                        radial-gradient(1px 1px at 72% 60%, rgba(110,231,183,0.2) 50%, transparent 100%),
                        radial-gradient(1px 1px at 90% 30%, rgba(251,191,36,0.15) 50%, transparent 100%),
                        radial-gradient(1px 1px at 40% 80%, rgba(77,208,225,0.2) 50%, transparent 100%)
                    `,
                }}
            />

            <div className="relative z-10 px-5 pt-8 pb-8 space-y-6 max-w-lg mx-auto w-full">
                {/* Avatar as "planet" with orbital ring */}
                <div className="flex flex-col items-center">
                    <div className="relative w-28 h-28">
                        {/* Orbital ring */}
                        <svg className="absolute inset-0 w-28 h-28" viewBox="0 0 112 112">
                            <ellipse
                                cx="56" cy="56" rx="54" ry="20"
                                fill="none"
                                stroke="rgba(38,198,218,0.2)"
                                strokeWidth="1"
                                transform="rotate(-20, 56, 56)"
                            />
                            <ellipse
                                cx="56" cy="56" rx="54" ry="20"
                                fill="none"
                                stroke="rgba(38,198,218,0.15)"
                                strokeWidth="0.5"
                                transform="rotate(-20, 56, 56)"
                                strokeDasharray="4 6"
                            />
                            <circle r="3" fill="#26C6DA" opacity="0.8">
                                <animateMotion
                                    dur="6s"
                                    repeatCount="indefinite"
                                    path="M 56,36 A 54,20 -20 1,1 55.9,36 Z"
                                />
                            </circle>
                        </svg>

                        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-teal-600 via-teal-800 to-[#131313] border-2 border-teal-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(0,184,212,0.25)]">
                            <span className="text-2xl font-bold text-teal-200">{initial}</span>
                        </div>

                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400 text-[10px] font-bold">
                            Level {level}
                        </div>
                    </div>

                    <h1 className="text-xl font-bold text-gray-100 mt-5">{studentName}</h1>
                    <p className="text-xs text-teal-300/40 mt-0.5">{email}</p>

                    {/* XP progress bar */}
                    <div className="w-full max-w-[200px] mt-4">
                        <div className="flex items-center justify-between text-[10px] text-teal-300/40 mb-1">
                            <span>{totalXp} XP total</span>
                            <span>Level {level + 1}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-teal-500/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-amber-400 transition-all duration-500"
                                style={{ width: `${xpPercent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Stats constellation */}
                <div className="relative">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 180" preserveAspectRatio="none">
                        <line x1="75" y1="45" x2="225" y2="45" stroke="rgba(38,198,218,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="75" y1="45" x2="75" y2="135" stroke="rgba(38,198,218,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="225" y1="45" x2="225" y2="135" stroke="rgba(38,198,218,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="75" y1="135" x2="225" y2="135" stroke="rgba(38,198,218,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="150" y1="0" x2="150" y2="180" stroke="rgba(38,198,218,0.06)" strokeWidth="1" strokeDasharray="4 4" />
                    </svg>

                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: "Total XP", value: totalXp, icon: Zap, color: "text-amber-400", glow: "rgba(251,191,36,0.3)" },
                            { label: "Voyages", value: totalSessions, icon: BookOpen, color: "text-teal-400", glow: "rgba(38,198,218,0.3)" },
                            { label: "Accuracy", value: `${accuracy}%`, icon: Target, color: "text-emerald-400", glow: "rgba(110,231,183,0.3)" },
                            { label: "Level", value: level, icon: Award, color: "text-amber-400", glow: "rgba(251,191,36,0.3)" },
                        ].map(({ label, value, icon: Icon, color, glow }) => (
                            <div
                                key={label}
                                className="relative bg-[#1A1A1A]/80 border border-teal-500/10 rounded-2xl p-4 text-center group hover:border-teal-500/20 transition-all"
                            >
                                <div
                                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ boxShadow: `inset 0 0 20px ${glow}` }}
                                />
                                <div className="relative">
                                    <Icon className={cn("w-5 h-5 mx-auto mb-2", color)} />
                                    <div className="text-xl font-bold text-gray-100">{value}</div>
                                    <div className="text-[10px] text-teal-300/40 uppercase tracking-wider mt-1">{label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tab bar */}
                <div className="sticky top-0 z-20 pt-1 pb-2 bg-gradient-to-b from-[#131313] to-transparent">
                    <div className="flex gap-1 p-1 rounded-xl bg-[#1A1A1A]/80 border border-teal-500/10">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => onProfileTabChange(tab.id)}
                                className={cn(
                                    "flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
                                    activeProfileTab === tab.id
                                        ? "bg-teal-600/30 text-teal-200 shadow-[0_0_12px_rgba(0,184,212,0.2)]"
                                        : "text-teal-300/40 hover:text-teal-300/60",
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab content */}
                {activeProfileTab === "overview" && (
                    <OverviewTab progress={progress} isLoading={isLoading} />
                )}

                {activeProfileTab === "history" && (
                    <HistoryTab
                        sessions={questionSessions}
                        filter={historyFilter}
                        onFilterChange={onHistoryFilterChange}
                        isLoading={isLoadingHistory}
                        pagination={historyPagination}
                        onLoadMore={onLoadMoreHistory}
                        expandedSessionId={expandedSessionId}
                        expandedSessionQuestions={expandedSessionQuestions}
                        onToggleSession={onToggleSession}
                    />
                )}

                {activeProfileTab === "weakAreas" && (
                    <WeakAreasTab
                        weakConcepts={weakConcepts}
                        calibration={calibration}
                        isLoadingCalibration={isLoadingCalibration}
                        wrongAnswers={wrongAnswerPatterns}
                        isLoadingWrongAnswers={isLoadingWrongAnswers}
                    />
                )}

                {/* Logout */}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/15 text-red-400/70 hover:bg-red-500/5 hover:text-red-400 hover:border-red-500/25 transition-all text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    End Mission
                </button>
            </div>
        </div>
    );
}

// ============================================
// Overview Tab (existing mastery content)
// ============================================

function OverviewTab({
    progress,
    isLoading,
}: {
    progress: ProfileProps["progress"];
    isLoading: boolean;
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            </div>
        );
    }

    if (!progress || !progress.mastery || progress.mastery.length === 0) {
        return (
            <div className="text-center py-8">
                <Brain className="w-8 h-8 text-teal-400/30 mx-auto mb-2" />
                <p className="text-sm text-teal-300/40">Start learning to see your mastery data.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h2 className="text-xs font-semibold text-teal-300/50 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Explored Concepts
            </h2>
            <div className="space-y-2">
                {progress.mastery.slice(0, 10).map((concept) => {
                    const scorePercent = Math.min(Math.round(concept.score), 100);
                    return (
                        <div
                            key={concept.concept}
                            className="bg-[#1A1A1A]/60 border border-teal-500/8 rounded-xl px-4 py-3"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-200 font-medium truncate">{concept.concept}</span>
                                <span className="text-xs text-teal-300/30 shrink-0 ml-2">{concept.attempts} attempts</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-1.5 rounded-full bg-teal-500/10 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all",
                                            scorePercent >= 80 ? "bg-emerald-500" : scorePercent >= 50 ? "bg-amber-500" : "bg-red-500",
                                        )}
                                        style={{ width: `${scorePercent}%` }}
                                    />
                                </div>
                                <span className="text-[11px] text-teal-300/40 w-10 text-right">{scorePercent}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {progress.summary && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                        { label: "Mastered", value: progress.summary.mastered, color: "text-emerald-400" },
                        { label: "In Progress", value: progress.summary.in_progress, color: "text-teal-400" },
                        { label: "Needs Work", value: progress.summary.needs_work, color: "text-red-400" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-[#1A1A1A]/60 border border-teal-500/8 rounded-xl p-3 text-center">
                            <div className={cn("text-lg font-bold", color)}>{value}</div>
                            <div className="text-[9px] text-teal-300/30 uppercase tracking-wider mt-0.5">{label}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// History Tab
// ============================================

function HistoryTab({
    sessions,
    filter,
    onFilterChange,
    isLoading,
    pagination,
    onLoadMore,
    expandedSessionId,
    expandedSessionQuestions,
    onToggleSession,
}: {
    sessions: QuestionHistorySessionSummary[];
    filter: string;
    onFilterChange: (f: "all" | "correct" | "incorrect") => void;
    isLoading: boolean;
    pagination: import("~/lib/api").PaginationMeta | null;
    onLoadMore: () => void;
    expandedSessionId: string | null;
    expandedSessionQuestions: QuestionHistoryItem[];
    onToggleSession: (id: string) => void;
}) {
    const hasMore = pagination && pagination.offset + pagination.limit < pagination.total;

    return (
        <div className="space-y-3">
            {/* Filter chips */}
            <div className="flex items-center gap-2">
                {(["all", "correct", "incorrect"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => onFilterChange(f)}
                        className={cn(
                            "rounded-full px-3 py-1 text-[11px] font-semibold transition-all",
                            filter === f
                                ? "bg-teal-600/30 text-teal-200 shadow-[0_0_8px_rgba(0,184,212,0.2)]"
                                : "bg-[#1A1A1A]/60 text-teal-300/40 hover:text-teal-300/60 border border-teal-500/8",
                        )}
                    >
                        {f === "all" ? "All" : f === "correct" ? "Correct" : "Incorrect"}
                    </button>
                ))}
            </div>

            {isLoading && sessions.length === 0 ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-400/50" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-8">
                    <History className="w-8 h-8 text-teal-400/30 mx-auto mb-2" />
                    <p className="text-sm text-teal-300/40">No sessions yet. Start learning!</p>
                </div>
            ) : (
                <>
                    {sessions.map((s) => (
                        <SessionRow
                            key={s.session_id}
                            session={s}
                            isExpanded={expandedSessionId === s.session_id}
                            questions={expandedSessionId === s.session_id ? expandedSessionQuestions : []}
                            historyFilter={filter}
                            onToggle={() => onToggleSession(s.session_id)}
                        />
                    ))}

                    {pagination && (
                        <p className="text-center text-[10px] text-teal-300/30">
                            Showing {sessions.length} of {pagination.total}
                        </p>
                    )}

                    {hasMore && (
                        <button
                            onClick={onLoadMore}
                            disabled={isLoading}
                            className="w-full py-2.5 rounded-xl border border-teal-500/10 text-xs text-teal-300/40 hover:bg-teal-500/5 hover:text-teal-300/60 transition-all disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1" />
                            ) : null}
                            Load more sessions
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

// ============================================
// Weak Areas Tab
// ============================================

function WeakAreasTab({
    weakConcepts,
    calibration,
    isLoadingCalibration,
    wrongAnswers,
    isLoadingWrongAnswers,
}: {
    weakConcepts: ProfileProps["weakConcepts"];
    calibration: ProfileProps["calibration"];
    isLoadingCalibration: boolean;
    wrongAnswers: QuestionHistoryItem[];
    isLoadingWrongAnswers: boolean;
}) {
    return (
        <div className="space-y-6">
            {/* Needs Work section */}
            <div className="space-y-3">
                <h2 className="text-xs font-semibold text-teal-300/50 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Needs Work
                </h2>

                {weakConcepts.length === 0 ? (
                    <div className="text-center py-6">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                            <Check className="w-5 h-5 text-emerald-400" />
                        </div>
                        <p className="text-sm text-teal-300/40">No weak areas — nice work!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {weakConcepts.map((c) => (
                            <div
                                key={c.concept}
                                className="bg-[#1A1A1A]/60 border border-red-500/10 rounded-xl px-4 py-3"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-200 font-medium truncate">{c.concept}</span>
                                    <span className="text-[11px] text-teal-300/30 shrink-0 ml-2">
                                        {c.correct}/{c.attempts} correct
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-1.5 rounded-full bg-teal-500/10 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-red-500 transition-all"
                                            style={{ width: `${c.score}%` }}
                                        />
                                    </div>
                                    <span className="text-[11px] text-red-400/70 w-10 text-right font-medium">{c.score}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Calibration chart */}
            {calibration && calibration.calibration.total_responses > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-semibold text-teal-300/50 uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        Confidence Calibration
                    </h2>
                    <div className="bg-[#1A1A1A]/60 border border-teal-500/8 rounded-xl p-4">
                        <CalibrationChart
                            buckets={calibration.calibration.buckets}
                            brierScore={calibration.calibration.brier_score}
                            overconfidenceIndex={calibration.calibration.overconfidence_index}
                            totalResponses={calibration.calibration.total_responses}
                        />
                    </div>
                </div>
            )}

            {/* Overconfident areas (DK concepts) */}
            {calibration && calibration.dk_concepts.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-semibold text-teal-300/50 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Overconfident Areas
                    </h2>
                    <div className="space-y-2">
                        {calibration.dk_concepts.slice(0, 5).map((dk) => (
                            <div
                                key={dk.concept}
                                className="bg-[#1A1A1A]/60 border border-amber-500/10 rounded-xl px-4 py-3"
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm text-gray-200 font-medium truncate">{dk.concept}</span>
                                    <span className="text-[10px] text-amber-400/60 shrink-0 ml-2">
                                        DK: {dk.dk_score.toFixed(1)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-[11px]">
                                    <span className="text-teal-300/40">
                                        Confidence: <span className="text-amber-400 font-medium">{Math.round(dk.avg_confidence * 100)}%</span>
                                    </span>
                                    <span className="text-teal-300/40">
                                        Accuracy: <span className="text-red-400 font-medium">{Math.round(dk.accuracy * 100)}%</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Review wrong answers */}
            <div className="space-y-3">
                <h2 className="text-xs font-semibold text-teal-300/50 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Review These Questions
                </h2>

                {isLoadingWrongAnswers ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-teal-400/50" />
                    </div>
                ) : wrongAnswers.length === 0 ? (
                    <div className="text-center py-6">
                        <Check className="w-6 h-6 text-emerald-400/40 mx-auto mb-2" />
                        <p className="text-sm text-teal-300/40">No wrong answers to review.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {wrongAnswers.slice(0, 10).map((q) => (
                            <QuestionItem key={q.id} question={q} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    Brain,
    Check,
    Clock,
    Flame,
    Lightbulb,
    Loader2,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Minus,
    X,
    Play,
} from "lucide-react";
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { cn } from "~/lib/utils";
import { BottomSheet } from "~/components/feed/BottomSheet";
import { skillTreeAnalysisApi } from "~/lib/api";
import type { SkillTreeAnalysisResponse, SkillTreeAnalysisWeakness } from "~/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillTreeAnalysisProps {
    open: boolean;
    onClose: () => void;
    subject: string;
    studentName: string;
    onStudyNow?: (concept: string) => void;
}

type Tab = "overview" | "weaknesses" | "insights";

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
    const colors = {
        high: "bg-red-500/15 text-red-400 border-red-500/20",
        moderate: "bg-amber-500/15 text-amber-400 border-amber-500/20",
        low: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    };
    return (
        <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
            colors[severity as keyof typeof colors] ?? colors.low,
        )}>
            {severity}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Circular mastery ring
// ---------------------------------------------------------------------------

function MasteryRing({ value, size = 100 }: { value: number; size?: number }) {
    const stroke = 6;
    const radius = (size - stroke) / 2 - 4;
    const circumference = 2 * Math.PI * radius;
    const filled = (value / 100) * circumference;

    const color =
        value >= 80
            ? "stroke-emerald-400"
            : value >= 50
              ? "stroke-amber-400"
              : value >= 25
                ? "stroke-violet-400"
                : "stroke-red-400";

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={stroke}
                    className="text-gray-800"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - filled}
                    strokeLinecap="round"
                    className={cn("transition-all duration-1000 ease-out", color)}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white tabular-nums">
                    {Math.round(value)}
                </span>
                <span className="text-[10px] text-gray-500 font-bold">%</span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Trend badge
// ---------------------------------------------------------------------------

function TrendBadge({ trend }: { trend: string }) {
    if (trend === "improving") {
        return (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" /> Improving
            </span>
        );
    }
    if (trend === "declining") {
        return (
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full">
                <TrendingDown className="w-3 h-3" /> Declining
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-1 rounded-full">
            <Minus className="w-3 h-3" /> Stable
        </span>
    );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ data }: { data: SkillTreeAnalysisResponse }) {
    return (
        <div className="space-y-5">
            {/* Mastery ring + trend */}
            <div className="flex items-center gap-5">
                <MasteryRing value={data.overall_mastery_pct} />
                <div className="space-y-2">
                    <TrendBadge trend={data.trend} />
                    <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                        Overall mastery across all concepts in this skill tree.
                    </p>
                </div>
            </div>

            {/* 4-stat grid */}
            <div className="grid grid-cols-4 gap-2">
                {[
                    { label: "Mastered", value: data.summary.mastered, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { label: "Learning", value: data.summary.in_progress, color: "text-amber-400", bg: "bg-amber-500/10" },
                    { label: "Struggling", value: data.summary.struggling, color: "text-red-400", bg: "bg-red-500/10" },
                    { label: "Overdue", value: data.summary.overdue, color: "text-violet-400", bg: "bg-violet-500/10" },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className={cn("rounded-xl py-3 text-center", stat.bg)}
                    >
                        <div className={cn("text-lg font-black tabular-nums", stat.color)}>
                            {stat.value}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 mt-0.5">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Mastery timeline sparkline */}
            {data.mastery_timeline.length > 2 && (
                <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Mastery Over Time
                    </div>
                    <div className="h-24 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.mastery_timeline}>
                                <defs>
                                    <linearGradient id="masteryGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    hide
                                />
                                <YAxis domain={[0, 100]} hide />
                                <Tooltip
                                    contentStyle={{
                                        background: "#1a1a2e",
                                        border: "1px solid rgba(139,92,246,0.3)",
                                        borderRadius: 12,
                                        fontSize: 12,
                                    }}
                                    labelStyle={{ color: "#a78bfa" }}
                                    itemStyle={{ color: "#e0e0e0" }}
                                    formatter={(value: number | undefined) => [`${value ?? 0}%`, "Accuracy"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="overall"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    fill="url(#masteryGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Weaknesses Tab
// ---------------------------------------------------------------------------

function WeaknessCard({
    weakness,
    onStudyNow,
}: {
    weakness: SkillTreeAnalysisWeakness;
    onStudyNow?: (concept: string) => void;
}) {
    return (
        <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-3.5 space-y-2.5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-200 truncate">
                            {weakness.concept}
                        </span>
                        {weakness.is_overdue && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                                <Clock className="w-2.5 h-2.5" /> Overdue
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                        {weakness.total_attempts} attempt{weakness.total_attempts !== 1 ? "s" : ""}
                    </div>
                </div>
                {onStudyNow && (
                    <button
                        onClick={() => onStudyNow(weakness.concept)}
                        className="flex items-center gap-1 text-[11px] font-bold text-violet-300 bg-violet-500/15 border border-violet-500/20 px-2.5 py-1.5 rounded-lg hover:bg-violet-500/25 transition-colors shrink-0"
                    >
                        <Play className="w-3 h-3" /> Study
                    </button>
                )}
            </div>

            {/* Mastery bar */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-700",
                            weakness.mastery_score < 30 ? "bg-red-400" : "bg-amber-400",
                        )}
                        style={{ width: `${Math.max(weakness.mastery_score, 2)}%` }}
                    />
                </div>
                <span className={cn(
                    "text-xs font-bold tabular-nums",
                    weakness.mastery_score < 30 ? "text-red-400" : "text-amber-400",
                )}>
                    {weakness.mastery_score}%
                </span>
            </div>

            {/* Misconceptions */}
            {weakness.active_misconceptions.length > 0 && (
                <div className="space-y-1.5">
                    {weakness.active_misconceptions.map((m, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2 text-[11px] text-gray-400 bg-gray-800/50 rounded-lg px-2.5 py-1.5"
                        >
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate flex-1">{m.type}</span>
                            <SeverityBadge severity={m.severity} />
                            <span className="text-gray-600 tabular-nums">&times;{m.count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function WeaknessesTab({
    data,
    onStudyNow,
}: {
    data: SkillTreeAnalysisResponse;
    onStudyNow?: (concept: string) => void;
}) {
    if (data.weaknesses.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm text-gray-400">No weak areas detected yet.</p>
                <p className="text-xs text-gray-600 mt-1">Keep studying to build your mastery data.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="text-xs text-gray-500 font-medium">
                Ranked by mastery (lowest first)
            </div>
            {data.weaknesses.map((w) => (
                <WeaknessCard key={w.concept} weakness={w} onStudyNow={onStudyNow} />
            ))}

            {/* Misconceptions summary */}
            {data.misconceptions_summary.length > 0 && (
                <div className="mt-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Active Misconceptions
                    </div>
                    <div className="space-y-2">
                        {data.misconceptions_summary.map((m, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2.5"
                            >
                                <Brain className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-medium text-gray-300">
                                        {m.misconception}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                        {m.concept} &middot; seen {m.occurrence_count} time{m.occurrence_count !== 1 ? "s" : ""}
                                    </div>
                                </div>
                                <SeverityBadge severity={m.severity} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// AI Insights Tab
// ---------------------------------------------------------------------------

function InsightsTab({ data }: { data: SkillTreeAnalysisResponse }) {
    const insights = data.ai_insights;

    if (!insights.summary && insights.recommendations.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-violet-400" />
                </div>
                <p className="text-sm text-gray-400">Not enough data for AI insights yet.</p>
                <p className="text-xs text-gray-600 mt-1">Complete more study sessions to unlock insights.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* AI Summary */}
            {insights.summary && (
                <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Summary</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        {insights.summary}
                    </p>
                </div>
            )}

            {/* Recommendations */}
            {insights.recommendations.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2.5">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recommendations</span>
                    </div>
                    <div className="space-y-2">
                        {insights.recommendations.map((rec, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2.5"
                            >
                                <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-[10px] font-black text-amber-400">{idx + 1}</span>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed">{rec}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Overconfidence alerts */}
            {insights.overconfidence_alerts.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2.5">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Calibration Alerts</span>
                    </div>
                    <div className="space-y-2">
                        {insights.overconfidence_alerts.map((alert, idx) => (
                            <div
                                key={idx}
                                className="rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2.5"
                            >
                                <p className="text-sm text-gray-300">{alert}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pattern insights */}
            {insights.pattern_insights.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2.5">
                        <BookOpen className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Patterns</span>
                    </div>
                    <div className="space-y-2">
                        {insights.pattern_insights.map((p, idx) => (
                            <div
                                key={idx}
                                className="rounded-lg bg-blue-500/5 border border-blue-500/10 px-3 py-2.5"
                            >
                                <p className="text-sm text-gray-300">{p}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SkillTreeAnalysis({
    open,
    onClose,
    subject,
    studentName,
    onStudyNow,
}: SkillTreeAnalysisProps) {
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [data, setData] = useState<SkillTreeAnalysisResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalysis = useCallback(async () => {
        if (!subject || !studentName) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await skillTreeAnalysisApi.get(subject, studentName);
            if (res.success) {
                setData(res.data);
            } else {
                setError(res.error ?? "Failed to load analysis");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load analysis");
        } finally {
            setIsLoading(false);
        }
    }, [subject, studentName]);

    useEffect(() => {
        if (open && !data) {
            fetchAnalysis();
        }
    }, [open, data, fetchAnalysis]);

    // Reset data when subject changes
    useEffect(() => {
        setData(null);
        setActiveTab("overview");
    }, [subject]);

    const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
        { key: "overview", label: "Overview", icon: <BarChart3 className="w-3.5 h-3.5" /> },
        { key: "weaknesses", label: "Weaknesses", icon: <Flame className="w-3.5 h-3.5" /> },
        { key: "insights", label: "AI Insights", icon: <Sparkles className="w-3.5 h-3.5" /> },
    ];

    return (
        <BottomSheet open={open} onClose={onClose}>
            {/* Header with tabs */}
            <div className="space-y-3 -mt-1">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-100">Skill Tree Analysis</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 bg-gray-900/60 rounded-xl p-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all",
                                activeTab === tab.key
                                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                    : "text-gray-500 hover:text-gray-300",
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="mt-4 min-h-[200px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                        <p className="text-sm text-gray-500">Analyzing your progress...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-red-400">{error}</p>
                        <button
                            onClick={fetchAnalysis}
                            className="mt-3 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                ) : data ? (
                    <>
                        {activeTab === "overview" && <OverviewTab data={data} />}
                        {activeTab === "weaknesses" && (
                            <WeaknessesTab data={data} onStudyNow={onStudyNow} />
                        )}
                        {activeTab === "insights" && <InsightsTab data={data} />}
                    </>
                ) : null}
            </div>
        </BottomSheet>
    );
}

// ---------------------------------------------------------------------------
// Floating Analysis Button (for use in skill tree views)
// ---------------------------------------------------------------------------

export function AnalysisFloatingButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "fixed bottom-24 right-4 z-30",
                "flex items-center gap-2 px-4 py-2.5 rounded-full",
                "bg-gradient-to-r from-indigo-600 to-violet-600",
                "text-white text-sm font-bold shadow-xl",
                "hover:from-indigo-500 hover:to-violet-500 transition-all",
                "border border-indigo-400/30",
            )}
            style={{ boxShadow: "0 4px 24px rgba(99,102,241,0.4)" }}
        >
            <BarChart3 className="w-4 h-4" />
            Analysis
        </button>
    );
}

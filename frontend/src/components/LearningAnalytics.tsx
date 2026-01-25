"use client";

import { useState, useEffect } from "react";
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    HelpCircle,
    Brain,
    Lightbulb,
    Target,
    Clock,
    Loader2,
    ChevronDown,
    ChevronUp
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PlayerAnalytics {
    player_id: string;
    game_id: string;
    nickname: string;
    total_score: number;
    rank: number;
    total_players: number;
    accuracy: number;
    total_questions: number;
    correct_answers: number;
    avg_confidence: number;
    avg_confidence_correct: number;
    avg_confidence_incorrect: number;
    quadrants: {
        confident_correct: number;
        confident_incorrect: number;
        uncertain_correct: number;
        uncertain_incorrect: number;
    };
    misconceptions: Array<{
        question_text: string;
        student_answer: string;
        correct_answer: string;
        confidence: number;
        reasoning?: string;
        explanation?: string;
        severity: string;
    }>;
    misconception_rate: number;
    calibration: {
        status: string;
        gap: number;
        message: string;
    };
    personalized_tips: string[];
    avg_response_time_ms: number;
    insights: {
        strongest_area: string;
        focus_areas: string;
        learning_style: string;
    };
}

interface LearningAnalyticsProps {
    gameId: string;
    playerId: string;
    showCompact?: boolean;
}

export default function LearningAnalytics({
    gameId,
    playerId,
    showCompact = false
}: LearningAnalyticsProps) {
    const [analytics, setAnalytics] = useState<PlayerAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["overview"]));

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/games/${gameId}/players/${playerId}/analytics`
                );
                if (response.ok) {
                    const data = await response.json();
                    setAnalytics(data);
                } else {
                    setError("Could not load analytics");
                }
            } catch (err) {
                console.error("Failed to fetch analytics:", err);
                setError("Failed to load analytics");
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [gameId, playerId]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) {
                newSet.delete(section);
            } else {
                newSet.add(section);
            }
            return newSet;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                <span className="ml-3 text-white/70">Analyzing your performance...</span>
            </div>
        );
    }

    if (error || !analytics) {
        return (
            <div className="text-center p-8 text-white/70">
                <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{error || "Analytics not available"}</p>
            </div>
        );
    }

    // Calculate quadrant chart data
    const totalQuadrant = Object.values(analytics.quadrants).reduce((a, b) => a + b, 0);
    const quadrantPercentages = {
        confident_correct: Math.round((analytics.quadrants.confident_correct / Math.max(1, totalQuadrant)) * 100),
        confident_incorrect: Math.round((analytics.quadrants.confident_incorrect / Math.max(1, totalQuadrant)) * 100),
        uncertain_correct: Math.round((analytics.quadrants.uncertain_correct / Math.max(1, totalQuadrant)) * 100),
        uncertain_incorrect: Math.round((analytics.quadrants.uncertain_incorrect / Math.max(1, totalQuadrant)) * 100)
    };

    if (showCompact) {
        return <CompactAnalytics analytics={analytics} />;
    }

    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Your Learning Insights</h2>
                <p className="text-white/70">Based on your performance in this quiz</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-4 text-center backdrop-blur">
                    <p className="text-4xl font-bold text-white">{Math.round(analytics.accuracy)}%</p>
                    <p className="text-white/70 text-sm">Accuracy</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center backdrop-blur">
                    <p className="text-4xl font-bold text-white">{Math.round(analytics.avg_confidence)}%</p>
                    <p className="text-white/70 text-sm">Avg Confidence</p>
                </div>
            </div>

            {/* Calibration Status */}
            <div className={`rounded-xl p-4 ${
                analytics.calibration.status === "well_calibrated"
                    ? "bg-green-500/20 border border-green-500/30"
                    : analytics.calibration.status === "overconfident"
                        ? "bg-orange-500/20 border border-orange-500/30"
                        : "bg-blue-500/20 border border-blue-500/30"
            }`}>
                <div className="flex items-center gap-3 mb-2">
                    {analytics.calibration.status === "well_calibrated" ? (
                        <CheckCircle className="h-6 w-6 text-green-400" />
                    ) : analytics.calibration.status === "overconfident" ? (
                        <TrendingUp className="h-6 w-6 text-orange-400" />
                    ) : (
                        <TrendingDown className="h-6 w-6 text-blue-400" />
                    )}
                    <span className="font-bold text-white capitalize">
                        {analytics.calibration.status.replace("_", " ")}
                    </span>
                </div>
                <p className="text-white/80 text-sm">{analytics.calibration.message}</p>
            </div>

            {/* Confidence-Correctness Quadrant */}
            <CollapsibleSection
                title="Confidence Analysis"
                icon={<Brain className="h-5 w-5" />}
                isOpen={expandedSections.has("confidence")}
                onToggle={() => toggleSection("confidence")}
            >
                <div className="grid grid-cols-2 gap-2">
                    <QuadrantCard
                        label="Mastered"
                        count={analytics.quadrants.confident_correct}
                        percentage={quadrantPercentages.confident_correct}
                        color="green"
                        icon={<CheckCircle className="h-4 w-4" />}
                        description="High confidence + Correct"
                    />
                    <QuadrantCard
                        label="Misconception"
                        count={analytics.quadrants.confident_incorrect}
                        percentage={quadrantPercentages.confident_incorrect}
                        color="red"
                        icon={<AlertTriangle className="h-4 w-4" />}
                        description="High confidence + Wrong"
                    />
                    <QuadrantCard
                        label="Lucky Guess"
                        count={analytics.quadrants.uncertain_correct}
                        percentage={quadrantPercentages.uncertain_correct}
                        color="blue"
                        icon={<HelpCircle className="h-4 w-4" />}
                        description="Low confidence + Correct"
                    />
                    <QuadrantCard
                        label="Knowledge Gap"
                        count={analytics.quadrants.uncertain_incorrect}
                        percentage={quadrantPercentages.uncertain_incorrect}
                        color="yellow"
                        icon={<Target className="h-4 w-4" />}
                        description="Low confidence + Wrong"
                    />
                </div>
            </CollapsibleSection>

            {/* Misconceptions */}
            {analytics.misconceptions.length > 0 && (
                <CollapsibleSection
                    title={`Misconceptions to Review (${analytics.misconceptions.length})`}
                    icon={<AlertTriangle className="h-5 w-5 text-orange-400" />}
                    isOpen={expandedSections.has("misconceptions")}
                    onToggle={() => toggleSection("misconceptions")}
                    badge={analytics.misconceptions.length}
                    badgeColor="orange"
                >
                    <div className="space-y-3">
                        {analytics.misconceptions.map((m, idx) => (
                            <div key={idx} className="bg-white/5 rounded-lg p-3 border border-orange-500/20">
                                <p className="text-white font-medium mb-2 text-sm">{m.question_text}</p>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-red-400">Your answer: {m.student_answer}</span>
                                    <span className="text-green-400">Correct: {m.correct_answer}</span>
                                </div>
                                {m.explanation && (
                                    <p className="mt-2 text-white/60 text-sm">{m.explanation}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>
            )}

            {/* Personalized Tips */}
            {analytics.personalized_tips.length > 0 && (
                <CollapsibleSection
                    title="Personalized Tips"
                    icon={<Lightbulb className="h-5 w-5 text-yellow-400" />}
                    isOpen={expandedSections.has("tips")}
                    onToggle={() => toggleSection("tips")}
                >
                    <ul className="space-y-2">
                        {analytics.personalized_tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                                <span className="text-yellow-400 mt-1">-</span>
                                {tip}
                            </li>
                        ))}
                    </ul>
                </CollapsibleSection>
            )}

            {/* Time Stats */}
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-white/80">
                    <Clock className="h-5 w-5" />
                    <span>Average response time: </span>
                    <span className="font-bold text-white">
                        {(analytics.avg_response_time_ms / 1000).toFixed(1)}s
                    </span>
                </div>
            </div>
        </div>
    );
}

// Collapsible Section Component
function CollapsibleSection({
    title,
    icon,
    children,
    isOpen,
    onToggle,
    badge,
    badgeColor
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    badge?: number;
    badgeColor?: string;
}) {
    return (
        <div className="bg-white/10 rounded-xl overflow-hidden backdrop-blur">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="font-medium text-white">{title}</span>
                    {badge !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            badgeColor === "orange" ? "bg-orange-500 text-white" : "bg-white/20 text-white"
                        }`}>
                            {badge}
                        </span>
                    )}
                </div>
                {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-white/50" />
                ) : (
                    <ChevronDown className="h-5 w-5 text-white/50" />
                )}
            </button>
            {isOpen && <div className="px-4 pb-4">{children}</div>}
        </div>
    );
}

// Quadrant Card Component
function QuadrantCard({
    label,
    count,
    percentage,
    color,
    icon,
    description
}: {
    label: string;
    count: number;
    percentage: number;
    color: "green" | "red" | "blue" | "yellow";
    icon: React.ReactNode;
    description: string;
}) {
    const colorClasses = {
        green: "bg-green-500/20 border-green-500/30 text-green-400",
        red: "bg-red-500/20 border-red-500/30 text-red-400",
        blue: "bg-blue-500/20 border-blue-500/30 text-blue-400",
        yellow: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
    };

    return (
        <div className={`rounded-lg p-3 border ${colorClasses[color]}`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="font-medium text-white text-sm">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{count}</p>
            <p className="text-xs text-white/50">{description}</p>
        </div>
    );
}

// Compact version for inline display
function CompactAnalytics({ analytics }: { analytics: PlayerAnalytics }) {
    return (
        <div className="bg-white/10 rounded-xl p-4 backdrop-blur space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-white/70">Accuracy</span>
                <span className="font-bold text-white">{Math.round(analytics.accuracy)}%</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-white/70">Avg Confidence</span>
                <span className="font-bold text-white">{Math.round(analytics.avg_confidence)}%</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-white/70">Calibration</span>
                <span className={`font-medium capitalize ${
                    analytics.calibration.status === "well_calibrated" ? "text-green-400" :
                    analytics.calibration.status === "overconfident" ? "text-orange-400" : "text-blue-400"
                }`}>
                    {analytics.calibration.status.replace("_", " ")}
                </span>
            </div>
            {analytics.misconceptions.length > 0 && (
                <div className="flex items-center gap-2 text-orange-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">{analytics.misconceptions.length} misconception(s) to review</span>
                </div>
            )}
        </div>
    );
}

// Export analytics summary widget
export function AnalyticsSummaryWidget({
    accuracy,
    confidence,
    calibrationStatus,
    misconceptionCount
}: {
    accuracy: number;
    confidence: number;
    calibrationStatus: string;
    misconceptionCount: number;
}) {
    return (
        <div className="flex items-center gap-4 bg-white/10 rounded-full px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-1">
                <Target className="h-4 w-4 text-green-400" />
                <span className="text-white font-medium">{Math.round(accuracy)}%</span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1">
                <Brain className="h-4 w-4 text-blue-400" />
                <span className="text-white font-medium">{Math.round(confidence)}%</span>
            </div>
            {misconceptionCount > 0 && (
                <>
                    <div className="w-px h-4 bg-white/20" />
                    <div className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                        <span className="text-orange-400 font-medium">{misconceptionCount}</span>
                    </div>
                </>
            )}
        </div>
    );
}

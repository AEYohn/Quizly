"use client";

import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, HelpCircle, XCircle, TrendingUp, MessageCircle, Users } from "lucide-react";
import { Badge, Card, Progress, Alert } from "./index";
import type { 
    ConfidenceCorrectnessAnalysis, 
    PeerMatchingResult, 
    InterventionCheck, 
    SessionPulse,
    DiscussionQuality 
} from "~/types";

// ============================================
// Confidence Correctness Display
// ============================================

interface ConfidenceCorrectnessProps {
    data: ConfidenceCorrectnessAnalysis;
    className?: string;
}

export function ConfidenceCorrectnessCard({ data, className }: ConfidenceCorrectnessProps) {
    const { categories, alert_level, message, misconception_rate, solid_understanding_rate } = data;
    
    const total = Object.values(categories).reduce((a, b) => a + b, 0);
    
    const alertColors = {
        normal: "info",
        good: "success",
        warning: "warning",
        critical: "danger",
    } as const;

    return (
        <Card className={clsx("overflow-hidden", className)} padding="none">
            {/* Alert Header */}
            <div
                className={clsx(
                    "px-4 py-3",
                    alert_level === "critical" && "bg-red-500 text-white",
                    alert_level === "warning" && "bg-amber-500 text-white",
                    alert_level === "good" && "bg-green-500 text-white",
                    alert_level === "normal" && "bg-gray-100 text-gray-700"
                )}
            >
                <div className="flex items-center gap-2">
                    {alert_level === "critical" && <AlertTriangle className="h-5 w-5" />}
                    {alert_level === "warning" && <AlertTriangle className="h-5 w-5" />}
                    {alert_level === "good" && <CheckCircle2 className="h-5 w-5" />}
                    {alert_level === "normal" && <HelpCircle className="h-5 w-5" />}
                    <span className="font-medium">{message}</span>
                </div>
            </div>

            <div className="p-4">
                {/* Category Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <CategoryBox
                        label="Confident & Correct"
                        count={categories.confident_correct}
                        total={total}
                        color="green"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                    />
                    <CategoryBox
                        label="Confident & Wrong"
                        count={categories.confident_incorrect}
                        total={total}
                        color="red"
                        icon={<XCircle className="h-4 w-4" />}
                        highlight={categories.confident_incorrect > 0}
                    />
                    <CategoryBox
                        label="Uncertain & Correct"
                        count={categories.uncertain_correct}
                        total={total}
                        color="blue"
                        icon={<HelpCircle className="h-4 w-4" />}
                    />
                    <CategoryBox
                        label="Uncertain & Wrong"
                        count={categories.uncertain_incorrect}
                        total={total}
                        color="gray"
                        icon={<HelpCircle className="h-4 w-4" />}
                    />
                </div>

                {/* Stats Row */}
                <div className="mt-4 flex justify-between text-sm">
                    <div>
                        <span className="text-gray-500">Misconception Rate:</span>{" "}
                        <span className={clsx("font-bold", misconception_rate > 15 ? "text-red-600" : "text-gray-900")}>
                            {misconception_rate}%
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">Solid Understanding:</span>{" "}
                        <span className="font-bold text-green-600">{solid_understanding_rate}%</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function CategoryBox({
    label,
    count,
    total,
    color,
    icon,
    highlight = false,
}: {
    label: string;
    count: number;
    total: number;
    color: "green" | "red" | "blue" | "gray";
    icon: React.ReactNode;
    highlight?: boolean;
}) {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

    const colors = {
        green: "border-green-200 bg-green-50 text-green-700",
        red: "border-red-200 bg-red-50 text-red-700",
        blue: "border-sky-200 bg-sky-50 text-sky-700",
        gray: "border-gray-200 bg-gray-50 text-gray-700",
    };

    return (
        <div
            className={clsx(
                "rounded-lg border p-3",
                colors[color],
                highlight && "ring-2 ring-red-400 ring-offset-1"
            )}
        >
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-xs font-medium">{label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold">{count}</span>
                <span className="text-xs opacity-70">({percentage}%)</span>
            </div>
        </div>
    );
}

// ============================================
// Peer Matching Display
// ============================================

interface PeerMatchingProps {
    data: PeerMatchingResult;
    className?: string;
    onAssignPair?: (mentor: string, learner: string) => void;
}

export function PeerMatchingCard({ data, className, onAssignPair }: PeerMatchingProps) {
    const { pairs, unpaired_students, pairing_stats } = data;

    return (
        <Card className={className}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                    <Users className="h-5 w-5 text-indigo-600" />
                    Smart Peer Pairs
                </h3>
                <Badge variant="purple">{pairs.length} pairs</Badge>
            </div>

            {pairs.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-4">
                    Not enough response variety for peer pairing
                </p>
            ) : (
                <div className="space-y-3">
                    {pairs.map((pair, i) => (
                        <div
                            key={i}
                            className={clsx(
                                "rounded-lg border p-3",
                                pair.priority === "high" ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-gray-50"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant={pair.type === "misconception_correction" ? "danger" : "info"}
                                    >
                                        {pair.type === "misconception_correction" ? "Fix Misconception" : "Build Confidence"}
                                    </Badge>
                                    {pair.priority === "high" && (
                                        <Badge variant="warning" dot pulse>Priority</Badge>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mt-3 flex items-center gap-3">
                                <div className="flex-1 text-center">
                                    <div className="text-xs text-gray-500">Mentor</div>
                                    <div className="font-medium text-green-700">{pair.mentor}</div>
                                    <div className="text-xs text-gray-400">answered {pair.mentor_answer}</div>
                                </div>
                                <div className="text-gray-300">→</div>
                                <div className="flex-1 text-center">
                                    <div className="text-xs text-gray-500">Learner</div>
                                    <div className="font-medium text-amber-700">{pair.learner}</div>
                                    <div className="text-xs text-gray-400">answered {pair.learner_answer}</div>
                                </div>
                            </div>

                            <p className="mt-2 text-xs text-gray-600 italic">
                                💬 &quot;{pair.discussion_prompt}&quot;
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {unpaired_students.length > 0 && (
                <div className="mt-4 border-t pt-4">
                    <p className="text-xs text-gray-500">
                        Unpaired: {unpaired_students.join(", ")}
                    </p>
                </div>
            )}
        </Card>
    );
}

// ============================================
// Intervention Alert
// ============================================

interface InterventionAlertProps {
    data: InterventionCheck;
    className?: string;
    onDismiss?: () => void;
}

export function InterventionAlert({ data, className, onDismiss }: InterventionAlertProps) {
    if (!data.needs_intervention) return null;

    const variant = data.severity === "high" ? "danger" : "warning";

    return (
        <Alert
            variant={variant}
            title="🚨 Intervention Suggested"
            className={className}
            onClose={onDismiss}
            icon={<AlertTriangle className="h-5 w-5" />}
        >
            <div className="space-y-2">
                {data.triggers.map((trigger, i) => (
                    <p key={i}>{trigger.message}</p>
                ))}
                
                {data.suggestions.length > 0 && (
                    <div className="mt-3 rounded-lg bg-white/50 p-3">
                        <p className="font-medium">Suggested Actions:</p>
                        <ul className="mt-1 list-inside list-disc space-y-1">
                            {data.suggestions.map((s, i) => (
                                <li key={i} className="text-sm">{s}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </Alert>
    );
}

// ============================================
// Session Pulse Display
// ============================================

interface SessionPulseProps {
    data: SessionPulse;
    className?: string;
}

export function SessionPulseCard({ data, className }: SessionPulseProps) {
    const actionColors = {
        move_on: "success",
        peer_discuss: "purple",
        reteach: "danger",
        clarify: "warning",
        waiting: "default",
    } as const;

    const actionEmoji = {
        move_on: "✅",
        peer_discuss: "💬",
        reteach: "📚",
        clarify: "❓",
        waiting: "⏳",
    };

    return (
        <Card className={className}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Class Pulse
                </h3>
                <Badge variant={actionColors[data.recommended_action]} dot pulse>
                    {actionEmoji[data.recommended_action]} {data.recommended_action.replace("_", " ")}
                </Badge>
            </div>

            <p className="mb-4 text-sm text-gray-600">{data.action_reason}</p>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <div className="text-xs text-gray-500">Correctness</div>
                    <div className="mt-1 text-xl font-bold text-gray-900">{data.correctness_rate}%</div>
                    <Progress
                        value={data.correctness_rate}
                        color={data.correctness_rate >= 70 ? "success" : data.correctness_rate >= 30 ? "warning" : "danger"}
                        size="sm"
                        className="mt-1"
                    />
                </div>
                <div>
                    <div className="text-xs text-gray-500">Confidence</div>
                    <div className="mt-1 text-xl font-bold text-gray-900">{data.avg_confidence}%</div>
                    <Progress value={data.avg_confidence} color="info" size="sm" className="mt-1" />
                </div>
                <div>
                    <div className="text-xs text-gray-500">Responses</div>
                    <div className="mt-1 text-xl font-bold text-gray-900">{data.response_count}</div>
                </div>
            </div>

            {/* Answer Distribution */}
            <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">Answer Distribution</div>
                <div className="flex gap-1">
                    {Object.entries(data.answer_distribution).map(([answer, count]) => {
                        const percentage = data.response_count > 0 ? (count / data.response_count) * 100 : 0;
                        return (
                            <div
                                key={answer}
                                className="flex-1 rounded-lg bg-indigo-100 p-2 text-center"
                                style={{ opacity: 0.3 + percentage / 100 * 0.7 }}
                            >
                                <div className="text-sm font-bold text-indigo-700">{answer}</div>
                                <div className="text-xs text-indigo-600">{count}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Misconception Alert */}
            {data.misconception_alert && (
                <Alert
                    variant={data.misconception_alert.level === "critical" ? "danger" : "warning"}
                    className="mt-4"
                >
                    {data.misconception_alert.message}
                </Alert>
            )}
        </Card>
    );
}

// ============================================
// Discussion Quality Display
// ============================================

interface DiscussionQualityProps {
    data: DiscussionQuality;
    className?: string;
}

export function DiscussionQualityCard({ data, className }: DiscussionQualityProps) {
    const qualityColors = {
        low: "danger",
        medium: "warning",
        high: "success",
    } as const;

    return (
        <Card className={className}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                    <MessageCircle className="h-5 w-5 text-indigo-600" />
                    Discussion Quality
                </h3>
                <Badge variant={qualityColors[data.quality_level]}>
                    {data.quality_level.toUpperCase()} ({Math.round(data.quality_score * 100)}%)
                </Badge>
            </div>

            {/* Quality Metrics */}
            <div className="space-y-3">
                <div>
                    <div className="mb-1 flex justify-between text-xs">
                        <span className="text-gray-500">Reasoning Depth</span>
                        <span className="font-medium">{Math.round(data.reasoning_depth_score * 100)}%</span>
                    </div>
                    <Progress value={data.reasoning_depth_score * 100} color="info" size="sm" />
                </div>
                <div>
                    <div className="mb-1 flex justify-between text-xs">
                        <span className="text-gray-500">Engagement</span>
                        <span className="font-medium">{Math.round(data.engagement_score * 100)}%</span>
                    </div>
                    <Progress value={data.engagement_score * 100} color="purple" size="sm" />
                </div>
            </div>

            {/* Learning Signals */}
            <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">Learning Signals Detected</div>
                <div className="flex flex-wrap gap-1">
                    {data.learning_signals.asked_why > 0 && (
                        <Badge variant="info">❓ Asked Why ({data.learning_signals.asked_why})</Badge>
                    )}
                    {data.learning_signals.gave_example > 0 && (
                        <Badge variant="success">📝 Examples ({data.learning_signals.gave_example})</Badge>
                    )}
                    {data.learning_signals.self_corrected > 0 && (
                        <Badge variant="purple">🔄 Self-Corrected ({data.learning_signals.self_corrected})</Badge>
                    )}
                    {data.learning_signals.expressed_insight > 0 && (
                        <Badge variant="warning">💡 Aha! ({data.learning_signals.expressed_insight})</Badge>
                    )}
                </div>
            </div>

            {/* Insights */}
            {data.insights.length > 0 && (
                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                    <div className="space-y-1">
                        {data.insights.map((insight, i) => (
                            <p key={i} className="text-sm text-gray-700">{insight}</p>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
}

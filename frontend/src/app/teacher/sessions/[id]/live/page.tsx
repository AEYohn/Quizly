"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    SkipForward,
    Square,
    Users,
    Clock,
    BarChart3,
    RefreshCw,
    Copy,
    CheckCircle,
    Brain,
    MessageCircle,
    AlertTriangle,
    TrendingUp,
    Zap,
    Activity,
    Target,
    Lightbulb,
} from "lucide-react";
import { api, adaptiveApi, analyticsApi } from "~/lib/api";
import { Button, Card, Badge, Progress, Alert } from "~/components/ui";
import { 
    ConfidenceCorrectnessCard, 
    PeerMatchingCard, 
    InterventionAlert, 
    SessionPulseCard,
    DiscussionQualityCard 
} from "~/components/ui/adaptive";
import type { 
    SessionStatus, 
    Question, 
    QuestionResponses, 
    ConfidenceCorrectnessAnalysis,
    PeerMatchingResult,
    InterventionCheck,
    SessionPulse,
    DiscussionQuality
} from "~/types";

type ViewMode = "overview" | "analytics" | "students";

export default function LiveSessionPage() {
    const router = useRouter();

    // Session state
    const [session, setSession] = useState<SessionStatus | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [responses, setResponses] = useState<QuestionResponses | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("overview");

    // Adaptive learning state
    const [confidenceAnalysis, setConfidenceAnalysis] = useState<ConfidenceCorrectnessAnalysis | null>(null);
    const [peerMatching, setPeerMatching] = useState<PeerMatchingResult | null>(null);
    const [intervention, setIntervention] = useState<InterventionCheck | null>(null);
    const [sessionPulse, setSessionPulse] = useState<SessionPulse | null>(null);
    const [discussionQuality, setDiscussionQuality] = useState<DiscussionQuality | null>(null);
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

    // Fetch adaptive analytics
    const fetchAnalytics = useCallback(async () => {
        if (!session?.session_id || !currentQuestion?.id) return;
        
        setIsLoadingAnalytics(true);
        
        try {
            // Fetch all analytics in parallel
            const [confResult, peerResult, interventionResult, pulseResult] = await Promise.all([
                adaptiveApi.analyzeConfidenceCorrectness(session.session_id, currentQuestion.id),
                adaptiveApi.getPeerMatching(session.session_id, currentQuestion.id),
                adaptiveApi.checkIntervention(session.session_id, currentQuestion.id),
                analyticsApi.getSessionPulse(session.session_id),
            ]);

            if (confResult.success) setConfidenceAnalysis(confResult.data);
            if (peerResult.success) setPeerMatching(peerResult.data);
            if (interventionResult.success) setIntervention(interventionResult.data);
            if (pulseResult.success) setSessionPulse(pulseResult.data);
        } catch (e) {
            console.error("Failed to fetch analytics:", e);
        }
        
        setIsLoadingAnalytics(false);
    }, [session?.session_id, currentQuestion?.id]);

    // Polling for real-time updates
    const fetchStatus = useCallback(async () => {
        const result = await api.liveSessions.getStatus();
        if (result.success) {
            setSession(result.data);

            // Fetch current question
            const questionResult = await api.liveSessions.getQuestion(
                result.data.current_question_index
            );
            if (questionResult.success) {
                setCurrentQuestion(questionResult.data.question);

                // Fetch responses for this question
                if (questionResult.data.question?.id) {
                    const responsesResult = await api.liveSessions.getResponses(
                        questionResult.data.question.id
                    );
                    if (responsesResult.success) {
                        setResponses(responsesResult.data);
                    }
                }
            }
        } else {
            setError(result.error);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Fetch analytics when question changes
    useEffect(() => {
        if (session && currentQuestion && responses && responses.count > 0) {
            fetchAnalytics();
        }
    }, [session?.session_id, currentQuestion?.id, responses?.count, fetchAnalytics]);

    const handleNextQuestion = async () => {
        const result = await api.liveSessions.nextQuestion();
        if (result.success) {
            // Reset analytics for new question
            setConfidenceAnalysis(null);
            setPeerMatching(null);
            setIntervention(null);
            fetchStatus();
        }
    };

    const handleEndSession = async () => {
        const result = await api.liveSessions.end();
        if (result.success) {
            router.push("/teacher/sessions");
        }
    };

    const copyJoinLink = () => {
        navigator.clipboard.writeText("http://localhost:3000/student");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Calculate response distribution
    const distribution = responses ? calculateDistribution(responses) : null;

    // Determine if we should show discussion prompt
    const shouldDiscuss = distribution && currentQuestion ? 
        calculateDiscussionNeeded(distribution, responses?.count || 0) : null;

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <RefreshCw className="mx-auto mb-4 h-12 w-12 animate-spin text-sky-500" />
                    <p className="text-xl">Loading session...</p>
                </div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
                <p className="mb-4 text-xl text-red-400">{error || "No active session"}</p>
                <Link href="/teacher/sessions" className="text-sky-400 hover:underline">
                    ← Back to Sessions
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
            {/* Top Bar */}
            <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-4">
                    <Link href="/teacher/sessions" className="text-gray-400 hover:text-white">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">{session.topic}</h1>
                        <p className="text-sm text-gray-400">Live Session • {session.students_joined.length} students</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex rounded-lg bg-white/10 p-1">
                        {[
                            { id: "overview", icon: BarChart3, label: "Overview" },
                            { id: "analytics", icon: Brain, label: "Analytics" },
                            { id: "students", icon: Users, label: "Students" },
                        ].map(({ id, icon: Icon, label }) => (
                            <button
                                key={id}
                                onClick={() => setViewMode(id as ViewMode)}
                                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all ${
                                    viewMode === id ? "bg-white/20 text-white" : "text-gray-400 hover:text-white"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={copyJoinLink}
                        className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm transition-all hover:bg-white/20"
                    >
                        {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied!" : "Join Link"}
                    </button>

                    <button
                        onClick={handleEndSession}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium transition-all hover:bg-red-700"
                    >
                        <Square className="h-4 w-4" />
                        End
                    </button>
                </div>
            </header>

            {/* Stats Bar with Live Pulse */}
            <div className="grid grid-cols-5 gap-4 border-b border-white/10 bg-black/20 p-4">
                <StatBox
                    icon={<BarChart3 className="h-5 w-5" />}
                    label="Question"
                    value={`${session.current_question_index + 1} / ${session.total_questions}`}
                    color="sky"
                />
                <StatBox
                    icon={<Users className="h-5 w-5" />}
                    label="Students"
                    value={session.students_joined.length.toString()}
                    color="green"
                />
                <StatBox
                    icon={<CheckCircle className="h-5 w-5" />}
                    label="Responses"
                    value={responses?.count.toString() || "0"}
                    color="purple"
                />
                <StatBox
                    icon={<Activity className="h-5 w-5" />}
                    label="Engagement"
                    value={sessionPulse ? `${Math.round(sessionPulse.engagement_score * 100)}%` : "—"}
                    color="amber"
                    pulse={sessionPulse && sessionPulse.engagement_score > 0.8}
                />
                <StatBox
                    icon={<Target className="h-5 w-5" />}
                    label="Accuracy"
                    value={sessionPulse ? `${Math.round(sessionPulse.accuracy_trend * 100)}%` : "—"}
                    color={sessionPulse && sessionPulse.accuracy_trend > 0.7 ? "green" : "amber"}
                />
            </div>

            {/* Intervention Alert */}
            {intervention?.needs_intervention && (
                <div className="border-b border-white/10 bg-amber-500/10 px-6 py-4">
                    <div className="mx-auto max-w-5xl flex items-center gap-4">
                        <AlertTriangle className="h-6 w-6 text-amber-400" />
                        <div className="flex-1">
                            <p className="font-semibold text-amber-200">{intervention.reason}</p>
                            <p className="text-sm text-amber-300/80">{intervention.suggested_action}</p>
                        </div>
                        <Badge variant="warning" pulse>{intervention.intervention_type.replace("_", " ")}</Badge>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="p-6">
                <div className="mx-auto max-w-6xl">
                    {viewMode === "overview" && (
                        <div className="grid grid-cols-3 gap-6">
                            {/* Left: Question and Responses */}
                            <div className="col-span-2 space-y-6">
                                {/* Current Question */}
                                {currentQuestion && (
                                    <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-lg">
                                        <div className="mb-4 flex items-center justify-between">
                                            <Badge variant="info">Question {session.current_question_index + 1}</Badge>
                                            <span className="text-sm text-gray-400">{currentQuestion.concept || "General"}</span>
                                        </div>

                                        <h2 className="mb-6 text-xl font-bold leading-relaxed">{currentQuestion.prompt}</h2>

                                        {/* Response Distribution */}
                                        <div className="space-y-3">
                                            {currentQuestion.options.map((option, i) => {
                                                const letter = String.fromCharCode(65 + i);
                                                const count = distribution?.[letter] || 0;
                                                const percentage = responses?.count ? Math.round((count / responses.count) * 100) : 0;
                                                const isCorrect = currentQuestion.correct_answer === letter;
                                                const colors = ["bg-red-500", "bg-blue-500", "bg-amber-500", "bg-green-500"];

                                                return (
                                                    <div
                                                        key={i}
                                                        className={`relative overflow-hidden rounded-xl border-2 p-4 transition-all ${
                                                            isCorrect ? "border-green-500 bg-green-500/10" : "border-white/20"
                                                        }`}
                                                    >
                                                        <div
                                                            className={`absolute inset-y-0 left-0 ${colors[i]} opacity-20 transition-all duration-500`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                        <div className="relative flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[i]} text-sm font-bold`}>
                                                                    {letter}
                                                                </span>
                                                                <span className="font-medium">{option.replace(/^[A-D]\.\s*/, "")}</span>
                                                                {isCorrect && <CheckCircle className="h-5 w-5 text-green-400" />}
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xl font-bold">{count}</div>
                                                                <div className="text-sm text-gray-400">{percentage}%</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Discussion Recommendation */}
                                        {shouldDiscuss && (
                                            <div className="mt-6 rounded-xl bg-purple-500/20 p-4 border border-purple-500/30">
                                                <div className="flex items-center gap-3">
                                                    <MessageCircle className="h-6 w-6 text-purple-400" />
                                                    <div>
                                                        <p className="font-semibold text-purple-200">
                                                            {shouldDiscuss.recommend ? "💡 Peer Discussion Recommended!" : "✓ Good understanding overall"}
                                                        </p>
                                                        <p className="text-sm text-purple-300/80">{shouldDiscuss.reason}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Controls */}
                                <div className="flex justify-center gap-4">
                                    <button
                                        onClick={handleNextQuestion}
                                        disabled={session.current_question_index >= session.total_questions - 1}
                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-purple-600 px-8 py-4 text-lg font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        <SkipForward className="h-6 w-6" />
                                        Next Question
                                    </button>
                                </div>
                            </div>

                            {/* Right: Real-time Insights */}
                            <div className="space-y-4">
                                {/* Confidence-Correctness Matrix */}
                                {confidenceAnalysis && (
                                    <div className="rounded-xl bg-white/10 p-4 backdrop-blur-lg">
                                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                                            <Brain className="h-4 w-4" />
                                            Confidence Analysis
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                            <div className="rounded-lg bg-green-500/20 p-3">
                                                <div className="text-2xl font-bold text-green-400">{confidenceAnalysis.quadrants.high_confidence_correct}</div>
                                                <div className="text-green-300">Mastered</div>
                                            </div>
                                            <div className="rounded-lg bg-amber-500/20 p-3">
                                                <div className="text-2xl font-bold text-amber-400">{confidenceAnalysis.quadrants.high_confidence_incorrect}</div>
                                                <div className="text-amber-300">Overconfident</div>
                                            </div>
                                            <div className="rounded-lg bg-blue-500/20 p-3">
                                                <div className="text-2xl font-bold text-blue-400">{confidenceAnalysis.quadrants.low_confidence_correct}</div>
                                                <div className="text-blue-300">Lucky?</div>
                                            </div>
                                            <div className="rounded-lg bg-red-500/20 p-3">
                                                <div className="text-2xl font-bold text-red-400">{confidenceAnalysis.quadrants.low_confidence_incorrect}</div>
                                                <div className="text-red-300">Learning</div>
                                            </div>
                                        </div>
                                        {confidenceAnalysis.insights.length > 0 && (
                                            <div className="mt-3 space-y-1">
                                                {confidenceAnalysis.insights.slice(0, 2).map((insight, i) => (
                                                    <p key={i} className="text-xs text-gray-400">• {insight}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Peer Matching Suggestions */}
                                {peerMatching && peerMatching.pairs.length > 0 && (
                                    <div className="rounded-xl bg-white/10 p-4 backdrop-blur-lg">
                                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                                            <Users className="h-4 w-4" />
                                            Suggested Peer Pairs
                                        </h3>
                                        <div className="space-y-2">
                                            {peerMatching.pairs.slice(0, 3).map((pair, i) => (
                                                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 p-2 text-sm">
                                                    <span className="text-green-400">{pair.mentor}</span>
                                                    <span className="text-gray-500">↔</span>
                                                    <span className="text-blue-400">{pair.learner}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Quick Session Pulse */}
                                {sessionPulse && (
                                    <div className="rounded-xl bg-white/10 p-4 backdrop-blur-lg">
                                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                                            <Activity className="h-4 w-4" />
                                            Session Pulse
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-gray-400">Pace</span>
                                                    <span className={sessionPulse.pace_indicator === "good" ? "text-green-400" : "text-amber-400"}>
                                                        {sessionPulse.pace_indicator}
                                                    </span>
                                                </div>
                                                <div className="h-2 rounded-full bg-white/10">
                                                    <div 
                                                        className={`h-full rounded-full transition-all ${
                                                            sessionPulse.pace_indicator === "good" ? "bg-green-500" : "bg-amber-500"
                                                        }`}
                                                        style={{ width: `${sessionPulse.engagement_score * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-gray-400">Suggested next:</span>
                                                <Badge variant="purple" className="text-xs">
                                                    {sessionPulse.suggested_action || "Continue"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Loading State */}
                                {isLoadingAnalytics && (
                                    <div className="rounded-xl bg-white/5 p-8 text-center">
                                        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-400">Analyzing responses...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === "analytics" && (
                        <div className="grid grid-cols-2 gap-6">
                            {confidenceAnalysis && <ConfidenceCorrectnessCard analysis={confidenceAnalysis} />}
                            {peerMatching && <PeerMatchingCard matching={peerMatching} />}
                            {sessionPulse && <SessionPulseCard pulse={sessionPulse} />}
                            {discussionQuality && <DiscussionQualityCard quality={discussionQuality} />}
                        </div>
                    )}

                    {viewMode === "students" && (
                        <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-lg">
                            <h3 className="mb-6 text-xl font-semibold">👥 Students ({session.students_joined.length})</h3>
                            <div className="grid grid-cols-4 gap-4">
                                {session.students_joined.map((name, i) => {
                                    // Find this student's response
                                    const studentResponse = responses?.responses ? 
                                        Object.entries(responses.responses).find(([_, r]) => r.student_name === name)?.[1] : null;
                                    const isCorrect = studentResponse && currentQuestion ? 
                                        studentResponse.answer === currentQuestion.correct_answer : null;

                                    return (
                                        <div
                                            key={i}
                                            className={`rounded-xl p-4 transition-all ${
                                                studentResponse 
                                                    ? isCorrect 
                                                        ? "bg-green-500/20 border border-green-500/30" 
                                                        : "bg-red-500/20 border border-red-500/30"
                                                    : "bg-white/5"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold">
                                                    {name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{name}</p>
                                                    {studentResponse ? (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className={isCorrect ? "text-green-400" : "text-red-400"}>
                                                                {studentResponse.answer}
                                                            </span>
                                                            {studentResponse.confidence && (
                                                                <span className="text-gray-400">
                                                                    {studentResponse.confidence}% confident
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">Waiting...</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Stat box component
function StatBox({
    icon,
    label,
    value,
    color,
    pulse = false
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: "sky" | "green" | "purple" | "amber";
    pulse?: boolean;
}) {
    const colors = {
        sky: "text-sky-400",
        green: "text-green-400",
        purple: "text-purple-400",
        amber: "text-amber-400",
    };

    return (
        <div className={`flex items-center gap-3 rounded-lg bg-white/5 p-4 ${pulse ? "animate-pulse" : ""}`}>
            <div className={colors[color]}>{icon}</div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="text-xl font-bold">{value}</p>
            </div>
        </div>
    );
}

// Calculate response distribution
function calculateDistribution(responses: QuestionResponses): Record<string, number> {
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

    Object.values(responses.responses).forEach(r => {
        const answer = r.answer.toUpperCase();
        if (answer in dist) {
            dist[answer]++;
        }
    });

    return dist;
}

// Determine if peer discussion is recommended (Mazur's 30-70% rule)
function calculateDiscussionNeeded(distribution: Record<string, number>, totalResponses: number): { recommend: boolean; reason: string } {
    if (totalResponses < 3) {
        return { recommend: false, reason: "Waiting for more responses..." };
    }

    const correctPercentage = Math.max(...Object.values(distribution)) / totalResponses * 100;
    
    if (correctPercentage < 30) {
        return { 
            recommend: false, 
            reason: "Consider re-teaching - most students are struggling with this concept." 
        };
    } else if (correctPercentage >= 30 && correctPercentage <= 70) {
        return { 
            recommend: true, 
            reason: `${Math.round(correctPercentage)}% correct - ideal range for peer discussion to boost understanding!` 
        };
    } else {
        return { 
            recommend: false, 
            reason: `${Math.round(correctPercentage)}% correct - great understanding! Consider moving to the next question.` 
        };
    }
}

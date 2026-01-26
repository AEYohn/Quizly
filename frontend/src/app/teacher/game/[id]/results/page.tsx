"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Trophy,
    Users,
    Brain,
    Lightbulb,
    AlertTriangle,
    CheckCircle,
    ArrowRight,
    Loader2,
    Sparkles,
    Home,
    BarChart2,
    Target,
    Send,
} from "lucide-react";
import { SendPracticeModal } from "@/components/SendPracticeModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PlayerScore {
    player_id: string;
    nickname: string;
    score: number;
    rank: number;
    correct_answers: number;
    total_answers: number;
}

interface GameResults {
    id: string;
    quiz_title: string;
    player_count: number;
    leaderboard: PlayerScore[];
    questions_summary: {
        question_text: string;
        correct_count: number;
        total_answers: number;
    }[];
}

interface AIInsights {
    overall_performance: string;
    class_strengths: string[];
    areas_for_review: string[];
    common_misconceptions: {
        topic: string;
        misconception: string;
        suggestion: string;
    }[];
    engagement_notes: string;
    next_steps: string[];
}

interface ComprehensiveInsights {
    quiz_title: string;
    total_players: number;
    total_questions: number;
    total_responses: number;
    performance: {
        overall_accuracy: number;
        avg_confidence: number;
        avg_time_per_question: number;
        total_correct: number;
        total_wrong: number;
        score_distribution: {
            highest: number;
            lowest: number;
            median: number;
        };
    };
    calibration?: {
        brier_score: number;
        calibration_error: number;
        overconfident_wrong_count: number;
        underconfident_right_count: number;
        well_calibrated_count: number;
        calibration_status: string;
        flagged_responses: {
            student: string;
            issue: string;
            confidence: number;
            answer: string;
        }[];
        calibration_curve: {
            confidence_range: string;
            count: number;
            accuracy: number;
        }[];
    };
    misconceptions?: {
        total_wrong_answers: number;
        unique_questions_missed: number;
        misconception_clusters: {
            label: string;
            description: string;
            size: number;
            suggested_intervention: string;
        }[];
        most_common_mistakes: {
            question: string;
            wrong_answer: string;
            count: number;
            correct_answer: string;
        }[];
    };
    question_analysis: {
        question_id: string;
        question_text: string;
        accuracy: number;
        avg_confidence: number;
        difficulty: string;
        most_common_wrong_answer: string | null;
        wrong_answer_count: number;
        needs_review: boolean;
    }[];
    student_analysis: {
        student_name: string;
        accuracy: number;
        avg_confidence: number;
        questions_answered: number;
        calibration_status: string;
        high_confidence_errors: number;
        needs_attention: boolean;
    }[];
    peer_discussions?: {
        total_discussions: number;
        completed_discussions: number;
        quality_distribution: Record<string, number>;
        common_misconceptions_from_discussions: {
            misconception: string;
            count: number;
        }[];
        key_insights: string[];
        students_who_improved: string[];
    };
    ai_recommendations: {
        overall_summary: string;
        class_strengths: string[];
        areas_for_improvement: string[];
        immediate_actions: string[];
        individual_interventions: {
            student: string;
            recommendation: string;
        }[];
        follow_up_topics: string[];
        misconception_corrections: {
            misconception: string;
            correction: string;
            activity: string;
        }[];
    };
}

export default function GameResultsPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.id as string;

    const [results, setResults] = useState<GameResults | null>(null);
    const [insights, setInsights] = useState<AIInsights | null>(null);
    const [comprehensiveInsights, setComprehensiveInsights] = useState<ComprehensiveInsights | null>(null);
    const [loading, setLoading] = useState(true);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Send Practice modal state
    const [sendPracticeOpen, setSendPracticeOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<string>("");
    const [selectedMisconceptions, setSelectedMisconceptions] = useState<{question: string; wrong_answer: string; correct_answer: string}[]>([]);

    const fetchResults = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${API_URL}/games/${gameId}/results`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                setResults(data);
            } else {
                const errorData = await response.json().catch(() => ({}));
                setError(errorData.detail || `Error ${response.status}: Unable to load results`);
            }
        } catch (error) {
            console.error("Failed to fetch results:", error);
            if (error instanceof Error && error.name === "AbortError") {
                setError("Request timed out. Please try again.");
            } else {
                setError("Network error: Unable to connect to server");
            }
        } finally {
            setLoading(false);
        }
    }, [gameId]);

    const fetchAIInsights = async () => {
        if (!results) return;

        setInsightsLoading(true);
        try {
            const token = localStorage.getItem("token");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for comprehensive AI analysis

            // Fetch comprehensive insights using game_id
            const response = await fetch(`${API_URL}/host/insights/${gameId}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                setComprehensiveInsights(data);

                // Handle ai_recommendations which might be an array (from Gemini)
                let aiRec = data.ai_recommendations;
                if (Array.isArray(aiRec)) {
                    aiRec = aiRec[0] || {};
                }

                // Also set legacy insights format for backwards compatibility
                if (aiRec && typeof aiRec === 'object') {
                    setInsights({
                        overall_performance: aiRec.overall_summary || "",
                        class_strengths: aiRec.class_strengths || [],
                        areas_for_review: aiRec.areas_for_improvement || [],
                        common_misconceptions: (aiRec.misconception_corrections || []).map((m: { misconception: string; correction: string; activity: string }) => ({
                            topic: m.misconception,
                            misconception: m.misconception,
                            suggestion: m.correction + (m.activity ? ` (Activity: ${m.activity})` : ""),
                        })),
                        engagement_notes: `${data.total_responses} responses from ${data.total_players} students`,
                        next_steps: aiRec.immediate_actions || [],
                    });
                }
                setShowInsights(true);
            } else {
                console.error("Failed to fetch insights:", response.status);
            }
        } catch (error) {
            console.error("Failed to fetch AI insights:", error);
        } finally {
            setInsightsLoading(false);
        }
    };

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    // Open send practice modal for a student
    const handleSendPractice = (studentName: string) => {
        // Get misconceptions for this student from the common mistakes
        const studentMisconceptions: {question: string; wrong_answer: string; correct_answer: string}[] = [];

        if (comprehensiveInsights?.misconceptions?.most_common_mistakes) {
            // Add the common mistakes as potential misconceptions
            comprehensiveInsights.misconceptions.most_common_mistakes.forEach(m => {
                studentMisconceptions.push({
                    question: m.question,
                    wrong_answer: m.wrong_answer,
                    correct_answer: m.correct_answer
                });
            });
        }

        setSelectedStudent(studentName);
        setSelectedMisconceptions(studentMisconceptions);
        setSendPracticeOpen(true);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-12 w-12 animate-spin text-sky-400" />
            </div>
        );
    }

    if (error || !results) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
                <AlertTriangle className="mb-4 h-16 w-16 text-yellow-400" />
                <div className="text-xl text-white text-center max-w-md">
                    {error || "Results not found"}
                </div>
                {error?.includes("not available") && (
                    <p className="mt-2 text-gray-400 text-center">
                        The game may still be in progress. Wait for it to finish or end it from the host screen.
                    </p>
                )}
                <div className="mt-6 flex gap-4">
                    <button
                        onClick={() => router.push("/teacher")}
                        className="rounded-full bg-sky-600 px-6 py-3 font-bold text-white hover:bg-sky-700"
                    >
                        Go Home
                    </button>
                    <button
                        onClick={() => {
                            setError(null);
                            setLoading(true);
                            fetchResults();
                        }}
                        className="rounded-full bg-gray-800 px-6 py-3 font-bold text-white border border-gray-700 hover:bg-gray-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const topThree = results.leaderboard.slice(0, 3);
    const podiumColors = ["bg-yellow-400", "bg-gray-300", "bg-orange-400"];
    const podiumHeights = ["h-32", "h-24", "h-20"];
    const podiumOrder = [1, 0, 2]; // Show 2nd, 1st, 3rd

    return (
        <div className="min-h-screen bg-gray-950 p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-8 text-center">
                    <Trophy className="mx-auto mb-4 h-16 w-16 text-yellow-400" />
                    <h1 className="text-4xl font-bold text-white">{results.quiz_title}</h1>
                    <p className="mt-2 text-xl text-gray-400">
                        {results.player_count} players participated
                    </p>
                </div>

                {/* Podium */}
                {topThree.length >= 3 && (
                    <div className="mb-8 flex items-end justify-center gap-4">
                        {podiumOrder.map((idx) => {
                            const player = topThree[idx];
                            if (!player) return <div key={`empty-${idx}`} />;
                            return (
                                <div key={player.player_id} className="flex flex-col items-center">
                                    <div className="mb-2 text-center">
                                        <div className="text-lg font-bold text-white">
                                            {player.nickname}
                                        </div>
                                        <div className="text-yellow-300">
                                            {(player.score ?? 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <div
                                        className={`${podiumColors[idx]} ${podiumHeights[idx]} w-24 rounded-t-lg flex items-center justify-center`}
                                    >
                                        <span className="text-3xl font-bold text-white">
                                            {idx + 1}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Leaderboard */}
                <div className="mb-8 rounded-2xl bg-gray-900 border border-gray-800 p-6">
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                        <BarChart2 className="h-6 w-6" />
                        Full Leaderboard
                    </h2>
                    <div className="space-y-2">
                        {results.leaderboard.map((player, idx) => (
                            <div
                                key={player.player_id}
                                className="flex items-center gap-4 rounded-xl bg-gray-800 p-3"
                            >
                                <span
                                    className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                        idx === 0
                                            ? "bg-yellow-400 text-yellow-900"
                                            : idx === 1
                                            ? "bg-gray-300 text-gray-700"
                                            : idx === 2
                                            ? "bg-orange-400 text-orange-900"
                                            : "bg-gray-700 text-gray-300"
                                    }`}
                                >
                                    {idx + 1}
                                </span>
                                <span className="flex-1 font-medium text-white">
                                    {player.nickname}
                                </span>
                                <span className="text-gray-400">
                                    {player.correct_answers}/{player.total_answers} correct
                                </span>
                                <span className="font-bold text-yellow-400">
                                    {(player.score ?? 0).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Insights Section */}
                {!showInsights ? (
                    <div className="mb-8 rounded-2xl bg-gray-900 border border-gray-800 p-6 text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500">
                                <Sparkles className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-white">
                            Get AI Insights
                        </h2>
                        <p className="mb-6 text-gray-400">
                            Let Quizzy analyze your class's performance and identify areas for improvement
                        </p>
                        <button
                            onClick={fetchAIInsights}
                            disabled={insightsLoading}
                            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-sky-700 disabled:opacity-50"
                        >
                            {insightsLoading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Brain className="h-5 w-5" />
                                    Generate Insights
                                </>
                            )}
                        </button>
                    </div>
                ) : comprehensiveInsights ? (
                    <div className="mb-8 space-y-4">
                        {/* Performance Overview */}
                        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                                <Target className="h-5 w-5 text-sky-400" />
                                Performance Overview
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="text-center p-3 rounded-lg bg-gray-800">
                                    <div className="text-2xl font-bold text-white">
                                        {comprehensiveInsights.performance?.overall_accuracy ?? 0}%
                                    </div>
                                    <div className="text-sm text-gray-400">Accuracy</div>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-gray-800">
                                    <div className="text-2xl font-bold text-white">
                                        {comprehensiveInsights.performance?.avg_confidence ?? 0}%
                                    </div>
                                    <div className="text-sm text-gray-400">Avg Confidence</div>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-gray-800">
                                    <div className="text-2xl font-bold text-emerald-400">
                                        {comprehensiveInsights.performance?.total_correct ?? 0}
                                    </div>
                                    <div className="text-sm text-gray-400">Correct</div>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-gray-800">
                                    <div className="text-2xl font-bold text-red-400">
                                        {comprehensiveInsights.performance?.total_wrong ?? 0}
                                    </div>
                                    <div className="text-sm text-gray-400">Wrong</div>
                                </div>
                            </div>
                            {comprehensiveInsights.ai_recommendations?.overall_summary && (
                                <p className="text-gray-300">{comprehensiveInsights.ai_recommendations.overall_summary}</p>
                            )}
                        </div>

                        {/* Calibration Analysis */}
                        {comprehensiveInsights.calibration && (
                            <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/30 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-indigo-400">
                                    <BarChart2 className="h-5 w-5" />
                                    Confidence Calibration
                                </h3>
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="text-center p-3 rounded-lg bg-gray-800">
                                        <div className="text-xl font-bold text-red-400">
                                            {comprehensiveInsights.calibration.overconfident_wrong_count}
                                        </div>
                                        <div className="text-xs text-gray-400">Overconfident Wrong</div>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-gray-800">
                                        <div className="text-xl font-bold text-yellow-400">
                                            {comprehensiveInsights.calibration.underconfident_right_count}
                                        </div>
                                        <div className="text-xs text-gray-400">Underconfident Right</div>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-gray-800">
                                        <div className="text-xl font-bold text-emerald-400">
                                            {comprehensiveInsights.calibration.well_calibrated_count}
                                        </div>
                                        <div className="text-xs text-gray-400">Well Calibrated</div>
                                    </div>
                                </div>
                                {comprehensiveInsights.calibration.flagged_responses.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="text-sm font-medium text-indigo-300 mb-2">Students Needing Attention</h4>
                                        <div className="space-y-2">
                                            {comprehensiveInsights.calibration.flagged_responses.slice(0, 3).map((r, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-gray-800">
                                                    <span className="text-white">{r.student}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                                        r.issue === 'overconfident'
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                        {r.issue} ({r.confidence}%)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Misconceptions */}
                        {comprehensiveInsights.misconceptions && comprehensiveInsights.misconceptions.most_common_mistakes.length > 0 && (
                            <div className="rounded-2xl bg-purple-500/10 border border-purple-500/30 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-purple-400">
                                    <Lightbulb className="h-5 w-5" />
                                    Common Mistakes & Misconceptions
                                </h3>
                                <div className="space-y-3">
                                    {comprehensiveInsights.misconceptions.most_common_mistakes.map((mistake, idx) => (
                                        <div key={idx} className="rounded-lg bg-gray-800 p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="text-sm text-gray-300 line-clamp-2">{mistake.question}</div>
                                                    <div className="mt-2 flex items-center gap-4 text-sm">
                                                        <span className="text-red-400">
                                                            Wrong: <strong>{mistake.wrong_answer}</strong> ({mistake.count} students)
                                                        </span>
                                                        <span className="text-emerald-400">
                                                            Correct: <strong>{mistake.correct_answer}</strong>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {comprehensiveInsights.misconceptions.misconception_clusters.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-purple-500/30">
                                        <h4 className="text-sm font-medium text-purple-300 mb-2">Identified Misconception Patterns</h4>
                                        {comprehensiveInsights.misconceptions.misconception_clusters.map((cluster, idx) => (
                                            <div key={idx} className="mb-2 p-3 rounded-lg bg-gray-800">
                                                <div className="font-medium text-purple-300">{cluster.label}</div>
                                                <div className="text-sm text-gray-400">{cluster.description}</div>
                                                {cluster.suggested_intervention && (
                                                    <div className="mt-1 text-sm text-purple-400 flex items-start gap-1">
                                                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                        {cluster.suggested_intervention}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Questions Analysis */}
                        {comprehensiveInsights.question_analysis.filter(q => q.needs_review).length > 0 && (
                            <div className="rounded-2xl bg-orange-500/10 border border-orange-500/30 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-orange-400">
                                    <AlertTriangle className="h-5 w-5" />
                                    Questions Needing Review
                                </h3>
                                <div className="space-y-2">
                                    {comprehensiveInsights.question_analysis.filter(q => q.needs_review).map((q, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
                                            <div className="flex-1 mr-4">
                                                <div className="text-sm text-white line-clamp-1">{q.question_text}</div>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className={`px-2 py-0.5 rounded ${
                                                    q.accuracy < 40 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                    {q.accuracy}% accuracy
                                                </span>
                                                {q.most_common_wrong_answer && (
                                                    <span className="text-gray-400">
                                                        Most chose: {q.most_common_wrong_answer}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Students Needing Attention */}
                        {comprehensiveInsights.student_analysis.filter(s => s.needs_attention).length > 0 && (
                            <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-yellow-400">
                                    <Users className="h-5 w-5" />
                                    Students Needing Support
                                </h3>
                                <div className="space-y-2">
                                    {comprehensiveInsights.student_analysis.filter(s => s.needs_attention).map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
                                            <span className="font-medium text-white">{s.student_name}</span>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="text-gray-400">{s.accuracy}% accuracy</span>
                                                {s.high_confidence_errors > 0 && (
                                                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                                                        {s.high_confidence_errors} high-confidence errors
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                    s.calibration_status === 'overconfident'
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : s.calibration_status === 'underconfident'
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : 'bg-emerald-500/20 text-emerald-400'
                                                }`}>
                                                    {s.calibration_status.replace('_', ' ')}
                                                </span>
                                                <button
                                                    onClick={() => handleSendPractice(s.student_name)}
                                                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-500 transition-colors"
                                                >
                                                    <Send className="h-3 w-3" />
                                                    Send Practice
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Peer Discussion Insights */}
                        {comprehensiveInsights.peer_discussions && comprehensiveInsights.peer_discussions.total_discussions > 0 && (
                            <div className="rounded-2xl bg-cyan-500/10 border border-cyan-500/30 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-cyan-400">
                                    <Users className="h-5 w-5" />
                                    Peer Discussion Insights
                                </h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="text-center p-3 rounded-lg bg-gray-800">
                                        <div className="text-xl font-bold text-white">
                                            {comprehensiveInsights.peer_discussions.total_discussions}
                                        </div>
                                        <div className="text-xs text-gray-400">Total Discussions</div>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-gray-800">
                                        <div className="text-xl font-bold text-emerald-400">
                                            {comprehensiveInsights.peer_discussions.students_who_improved.length}
                                        </div>
                                        <div className="text-xs text-gray-400">Students Improved</div>
                                    </div>
                                </div>
                                {comprehensiveInsights.peer_discussions.key_insights.length > 0 && (
                                    <div className="mt-3">
                                        <h4 className="text-sm font-medium text-cyan-300 mb-2">Key Insights from Discussions</h4>
                                        <ul className="space-y-1">
                                            {comprehensiveInsights.peer_discussions.key_insights.slice(0, 5).map((insight, idx) => (
                                                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                                    <span className="text-cyan-400 mt-1">•</span>
                                                    {insight}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI Recommendations */}
                        {comprehensiveInsights.ai_recommendations && (
                            <>
                                {/* Strengths */}
                                {comprehensiveInsights.ai_recommendations.class_strengths.length > 0 && (
                                    <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-6">
                                        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-green-400">
                                            <CheckCircle className="h-5 w-5" />
                                            Class Strengths
                                        </h3>
                                        <ul className="space-y-2">
                                            {comprehensiveInsights.ai_recommendations.class_strengths.map((strength, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-green-300">
                                                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                                                    {strength}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Immediate Actions */}
                                {comprehensiveInsights.ai_recommendations.immediate_actions.length > 0 && (
                                    <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-6">
                                        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-400">
                                            <ArrowRight className="h-5 w-5" />
                                            Recommended Next Steps
                                        </h3>
                                        <ol className="space-y-2">
                                            {comprehensiveInsights.ai_recommendations.immediate_actions.map((action, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-blue-300">
                                                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/30 text-sm font-bold">
                                                        {idx + 1}
                                                    </span>
                                                    {action}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Individual Interventions */}
                                {comprehensiveInsights.ai_recommendations.individual_interventions.length > 0 && (
                                    <div className="rounded-2xl bg-pink-500/10 border border-pink-500/30 p-6">
                                        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-pink-400">
                                            <Users className="h-5 w-5" />
                                            Individual Student Recommendations
                                        </h3>
                                        <div className="space-y-2">
                                            {comprehensiveInsights.ai_recommendations.individual_interventions.map((item, idx) => (
                                                <div key={idx} className="p-3 rounded-lg bg-gray-800">
                                                    <span className="font-medium text-pink-300">{item.student}:</span>
                                                    <span className="ml-2 text-gray-300">{item.recommendation}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ) : null}

                {/* Actions */}
                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => router.push(`/teacher/game/${gameId}/insights`)}
                        className="flex items-center gap-2 rounded-full bg-purple-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-purple-700"
                    >
                        <Brain className="h-5 w-5" />
                        View Misconception Insights
                    </button>
                    <button
                        onClick={() => router.push("/teacher")}
                        className="flex items-center gap-2 rounded-full bg-sky-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-sky-700"
                    >
                        <Home className="h-5 w-5" />
                        Back to Dashboard
                    </button>
                </div>

                {/* Powered by */}
                <div className="mt-8 flex items-center justify-center gap-2 text-gray-500">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm">Insights powered by Gemini AI</span>
                </div>
            </div>

            {/* Send Practice Modal */}
            <SendPracticeModal
                isOpen={sendPracticeOpen}
                onClose={() => setSendPracticeOpen(false)}
                studentName={selectedStudent}
                gameId={gameId}
                misconceptions={selectedMisconceptions}
                onSent={() => {
                    // Could show a success toast here
                    console.log("Practice sent to", selectedStudent);
                }}
            />
        </div>
    );
}

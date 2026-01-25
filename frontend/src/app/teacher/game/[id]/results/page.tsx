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
} from "lucide-react";

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

export default function GameResultsPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.id as string;

    const [results, setResults] = useState<GameResults | null>(null);
    const [insights, setInsights] = useState<AIInsights | null>(null);
    const [loading, setLoading] = useState(true);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchResults = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/${gameId}/results`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setResults(data);
            } else {
                const errorData = await response.json().catch(() => ({}));
                setError(errorData.detail || `Error ${response.status}: Unable to load results`);
            }
        } catch (error) {
            console.error("Failed to fetch results:", error);
            setError("Network error: Unable to connect to server");
        } finally {
            setLoading(false);
        }
    }, [gameId]);

    const fetchAIInsights = async () => {
        if (!results) return;

        setInsightsLoading(true);
        try {
            const token = localStorage.getItem("token");

            // Fetch detailed game data for AI analysis
            const response = await fetch(`${API_URL}/host/insights`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    quiz_title: results.quiz_title,
                    questions: results.questions_summary,
                    responses: results.leaderboard.map((p) => ({
                        nickname: p.nickname,
                        correct: p.correct_answers,
                        total: p.total_answers,
                        score: p.score,
                    })),
                    player_count: results.player_count,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setInsights(data.insights);
                setShowInsights(true);
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

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
        );
    }

    if (error || !results) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8">
                <AlertTriangle className="mb-4 h-16 w-16 text-yellow-400" />
                <div className="text-xl text-white text-center max-w-md">
                    {error || "Results not found"}
                </div>
                {error?.includes("not available") && (
                    <p className="mt-2 text-white/70 text-center">
                        The game may still be in progress. Wait for it to finish or end it from the host screen.
                    </p>
                )}
                <div className="mt-6 flex gap-4">
                    <button
                        onClick={() => router.push("/teacher")}
                        className="rounded-full bg-white px-6 py-3 font-bold text-purple-600"
                    >
                        Go Home
                    </button>
                    <button
                        onClick={() => {
                            setError(null);
                            setLoading(true);
                            fetchResults();
                        }}
                        className="rounded-full bg-white/20 px-6 py-3 font-bold text-white border-2 border-white/30"
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
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-8 text-center">
                    <Trophy className="mx-auto mb-4 h-16 w-16 text-yellow-400" />
                    <h1 className="text-4xl font-bold text-white">{results.quiz_title}</h1>
                    <p className="mt-2 text-xl text-white/80">
                        {results.player_count} players participated
                    </p>
                </div>

                {/* Podium */}
                {topThree.length >= 3 && (
                    <div className="mb-8 flex items-end justify-center gap-4">
                        {podiumOrder.map((idx) => {
                            const player = topThree[idx];
                            if (!player) return null;
                            return (
                                <div key={player.player_id} className="flex flex-col items-center">
                                    <div className="mb-2 text-center">
                                        <div className="text-lg font-bold text-white">
                                            {player.nickname}
                                        </div>
                                        <div className="text-yellow-300">
                                            {player.score.toLocaleString()}
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
                <div className="mb-8 rounded-2xl bg-white/10 p-6 backdrop-blur">
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                        <BarChart2 className="h-6 w-6" />
                        Full Leaderboard
                    </h2>
                    <div className="space-y-2">
                        {results.leaderboard.map((player, idx) => (
                            <div
                                key={player.player_id}
                                className="flex items-center gap-4 rounded-xl bg-white/10 p-3"
                            >
                                <span
                                    className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                        idx === 0
                                            ? "bg-yellow-400 text-yellow-900"
                                            : idx === 1
                                            ? "bg-gray-300 text-gray-700"
                                            : idx === 2
                                            ? "bg-orange-400 text-orange-900"
                                            : "bg-white/20 text-white"
                                    }`}
                                >
                                    {idx + 1}
                                </span>
                                <span className="flex-1 font-medium text-white">
                                    {player.nickname}
                                </span>
                                <span className="text-white/70">
                                    {player.correct_answers}/{player.total_answers} correct
                                </span>
                                <span className="font-bold text-yellow-400">
                                    {player.score.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Insights Section */}
                {!showInsights ? (
                    <div className="mb-8 rounded-2xl bg-white p-6 text-center shadow-xl">
                        <div className="mb-4 flex justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                                <Sparkles className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">
                            Get AI Insights
                        </h2>
                        <p className="mb-6 text-gray-600">
                            Let Quizzy analyze your class's performance and identify areas for improvement
                        </p>
                        <button
                            onClick={fetchAIInsights}
                            disabled={insightsLoading}
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 disabled:opacity-50"
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
                ) : insights ? (
                    <div className="mb-8 space-y-4">
                        {/* Overall Performance */}
                        <div className="rounded-2xl bg-white p-6 shadow-xl">
                            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
                                <Target className="h-5 w-5 text-purple-600" />
                                Overall Performance
                            </h3>
                            <p className="text-gray-700">{insights.overall_performance}</p>
                        </div>

                        {/* Strengths */}
                        {insights.class_strengths.length > 0 && (
                            <div className="rounded-2xl bg-green-50 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-green-800">
                                    <CheckCircle className="h-5 w-5" />
                                    Class Strengths
                                </h3>
                                <ul className="space-y-2">
                                    {insights.class_strengths.map((strength, idx) => (
                                        <li
                                            key={idx}
                                            className="flex items-start gap-2 text-green-700"
                                        >
                                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                                            {strength}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Areas for Review */}
                        {insights.areas_for_review.length > 0 && (
                            <div className="rounded-2xl bg-orange-50 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-orange-800">
                                    <AlertTriangle className="h-5 w-5" />
                                    Areas for Review
                                </h3>
                                <ul className="space-y-2">
                                    {insights.areas_for_review.map((area, idx) => (
                                        <li
                                            key={idx}
                                            className="flex items-start gap-2 text-orange-700"
                                        >
                                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-500" />
                                            {area}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Misconceptions */}
                        {insights.common_misconceptions.length > 0 && (
                            <div className="rounded-2xl bg-purple-50 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-purple-800">
                                    <Lightbulb className="h-5 w-5" />
                                    Common Misconceptions
                                </h3>
                                <div className="space-y-4">
                                    {insights.common_misconceptions.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="rounded-lg bg-white p-4 shadow-sm"
                                        >
                                            <div className="font-medium text-purple-900">
                                                {item.topic}
                                            </div>
                                            <div className="mt-1 text-purple-700">
                                                {item.misconception}
                                            </div>
                                            <div className="mt-2 flex items-start gap-2 text-sm text-purple-600">
                                                <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                {item.suggestion}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Next Steps */}
                        {insights.next_steps.length > 0 && (
                            <div className="rounded-2xl bg-blue-50 p-6">
                                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-800">
                                    <ArrowRight className="h-5 w-5" />
                                    Recommended Next Steps
                                </h3>
                                <ol className="space-y-2">
                                    {insights.next_steps.map((step, idx) => (
                                        <li
                                            key={idx}
                                            className="flex items-start gap-3 text-blue-700"
                                        >
                                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-200 text-sm font-bold text-blue-800">
                                                {idx + 1}
                                            </span>
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Actions */}
                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => router.push("/teacher")}
                        className="flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-purple-600 shadow-lg transition-all hover:scale-105"
                    >
                        <Home className="h-5 w-5" />
                        Back to Dashboard
                    </button>
                </div>

                {/* Powered by */}
                <div className="mt-8 flex items-center justify-center gap-2 text-white/60">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm">Insights powered by Gemini AI</span>
                </div>
            </div>
        </div>
    );
}

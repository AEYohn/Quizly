"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Radio,
    Users,
    Clock,
    BarChart3,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Send,
    Pause,
    Play,
    MessageSquare,
    Brain,
    TrendingUp,
    RefreshCw,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GameState {
    id: string;
    game_code: string;
    quiz_title: string;
    status: string;
    current_question_index: number;
    total_questions: number;
    player_count: number;
    players: Array<{
        id: string;
        nickname: string;
        avatar?: string;
        score: number;
        joined_at: string;
    }>;
    leaderboard: Array<{
        player_id: string;
        nickname: string;
        score: number;
        rank: number;
    }>;
    current_question?: {
        question_text: string;
        options: { [key: string]: string };
        time_limit: number;
    };
    time_remaining?: number;
    sync_mode: boolean;
    show_correct_answer: boolean;
    show_answer_distribution: boolean;
}

interface QuestionResults {
    question_text: string;
    correct_answer: string;
    answer_distribution: { [key: string]: number };
    total_answers: number;
    correct_count: number;
}

export default function LiveMonitorPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.id as string;

    const [game, setGame] = useState<GameState | null>(null);
    const [questionResults, setQuestionResults] = useState<QuestionResults | null>(null);
    const [loading, setLoading] = useState(true);
    const [showHintModal, setShowHintModal] = useState(false);
    const [hintMessage, setHintMessage] = useState("");
    const [sendingHint, setSendingHint] = useState(false);
    const [expandedSection, setExpandedSection] = useState<string | null>("responses");

    const fetchGameState = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/${gameId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setGame(data);

                // Fetch question results if showing results
                if (data.status === "results" || data.current_question_index >= 0) {
                    fetchQuestionResults(data.current_question_index);
                }
            }
        } catch (error) {
            console.error("Failed to fetch game state:", error);
        } finally {
            setLoading(false);
        }
    }, [gameId]);

    const fetchQuestionResults = async (questionIndex: number) => {
        try {
            const response = await fetch(
                `${API_URL}/games/${gameId}/questions/${questionIndex}/results`
            );
            if (response.ok) {
                const data = await response.json();
                setQuestionResults(data);
            }
        } catch (error) {
            console.error("Failed to fetch question results:", error);
        }
    };

    useEffect(() => {
        fetchGameState();
        // Poll for updates every 2 seconds for real-time feel
        const interval = setInterval(fetchGameState, 2000);
        return () => clearInterval(interval);
    }, [fetchGameState]);

    const sendHint = async () => {
        if (!hintMessage.trim()) return;
        setSendingHint(true);
        try {
            const token = localStorage.getItem("token");
            await fetch(`${API_URL}/games/${gameId}/hint`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ message: hintMessage }),
            });
            setHintMessage("");
            setShowHintModal(false);
        } catch (error) {
            console.error("Failed to send hint:", error);
        } finally {
            setSendingHint(false);
        }
    };

    const getAccuracyColor = (accuracy: number) => {
        if (accuracy >= 70) return "text-green-400";
        if (accuracy >= 50) return "text-yellow-400";
        return "text-red-400";
    };

    const getAccuracyBg = (accuracy: number) => {
        if (accuracy >= 70) return "bg-green-500";
        if (accuracy >= 50) return "bg-yellow-500";
        return "bg-red-500";
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-sky-400 mx-auto mb-3" />
                    <p className="text-gray-400">Loading session...</p>
                </div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Session Not Found</h2>
                    <p className="text-gray-400 mb-4">This game session may have ended.</p>
                    <Link
                        href="/teacher/live"
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Live Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const accuracy = questionResults
        ? Math.round((questionResults.correct_count / Math.max(1, questionResults.total_answers)) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/teacher/live"
                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-bold text-white">{game.quiz_title}</h1>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400 border border-green-500/30">
                                        <Radio className="h-3 w-3 animate-pulse" />
                                        Live
                                    </span>
                                </div>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    Code: <span className="font-mono text-sky-400">{game.game_code}</span>
                                    {" "} | {" "}
                                    {game.sync_mode ? "Synchronized" : "Self-paced (Async)"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowHintModal(true)}
                                className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-gray-300 hover:bg-gray-800"
                            >
                                <MessageSquare className="h-4 w-4" />
                                Send Hint
                            </button>
                            <Link
                                href={`/teacher/game/${gameId}/results`}
                                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
                            >
                                <BarChart3 className="h-4 w-4" />
                                Full Results
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <div className="p-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20">
                                <Users className="h-5 w-5 text-sky-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{game.player_count}</p>
                                <p className="text-xs text-gray-400">Students</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                                <BarChart3 className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">
                                    Q{game.current_question_index + 1}/{game.total_questions}
                                </p>
                                <p className="text-xs text-gray-400">Progress</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                accuracy >= 70 ? "bg-green-500/20" : accuracy >= 50 ? "bg-yellow-500/20" : "bg-red-500/20"
                            }`}>
                                <TrendingUp className={`h-5 w-5 ${getAccuracyColor(accuracy)}`} />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${getAccuracyColor(accuracy)}`}>{accuracy}%</p>
                                <p className="text-xs text-gray-400">Accuracy</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                                <Clock className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">
                                    {game.time_remaining !== undefined ? `${game.time_remaining}s` : "--"}
                                </p>
                                <p className="text-xs text-gray-400">Time Left</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Current Question & Responses */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Current Question */}
                        {game.current_question && (
                            <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                                <h2 className="text-sm font-medium text-gray-400 mb-3">Current Question</h2>
                                <p className="text-lg text-white mb-4">{game.current_question.question_text}</p>

                                {/* Answer Distribution */}
                                {questionResults && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-medium text-gray-400">Response Distribution</h3>
                                        {Object.entries(game.current_question.options).map(([key, value]) => {
                                            const count = questionResults.answer_distribution[key] || 0;
                                            const percentage = questionResults.total_answers > 0
                                                ? Math.round((count / questionResults.total_answers) * 100)
                                                : 0;
                                            const isCorrect = key === questionResults.correct_answer;

                                            return (
                                                <div key={key} className="relative">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm text-gray-300 flex items-center gap-2">
                                                            <span className={`font-mono font-bold ${isCorrect ? "text-green-400" : "text-gray-400"}`}>
                                                                {key}
                                                            </span>
                                                            {value}
                                                            {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                                                        </span>
                                                        <span className="text-sm font-medium text-gray-400">
                                                            {count} ({percentage}%)
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                isCorrect ? "bg-green-500" : "bg-gray-600"
                                                            }`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="text-xs text-gray-500 mt-2">
                                            {questionResults.total_answers} of {game.player_count} students answered
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Class Pulse - Misconception Alerts */}
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                            <button
                                onClick={() => setExpandedSection(expandedSection === "pulse" ? null : "pulse")}
                                className="w-full flex items-center justify-between"
                            >
                                <h2 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                    <Brain className="h-4 w-4 text-amber-400" />
                                    Class Pulse
                                </h2>
                                {expandedSection === "pulse" ? (
                                    <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                            </button>

                            {expandedSection === "pulse" && (
                                <div className="mt-4 space-y-3">
                                    {accuracy < 50 && questionResults && questionResults.total_answers > 0 && (
                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-red-400">Low Accuracy Alert</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Only {accuracy}% of students got this question right. Consider pausing for discussion.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {accuracy >= 70 && questionResults && questionResults.total_answers > 0 && (
                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                                            <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-green-400">Good Understanding</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {accuracy}% accuracy! The class seems to understand this concept well.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {(!questionResults || questionResults.total_answers === 0) && (
                                        <div className="text-center py-4 text-gray-500 text-sm">
                                            Waiting for student responses...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                        <h2 className="text-sm font-medium text-gray-400 mb-4">Live Leaderboard</h2>
                        <div className="space-y-2">
                            {game.leaderboard.slice(0, 10).map((player, index) => (
                                <div
                                    key={player.player_id}
                                    className={`flex items-center gap-3 p-2 rounded-lg ${
                                        index < 3 ? "bg-gray-800" : ""
                                    }`}
                                >
                                    <span className={`w-6 text-center font-bold ${
                                        index === 0 ? "text-yellow-400" :
                                        index === 1 ? "text-gray-300" :
                                        index === 2 ? "text-amber-600" :
                                        "text-gray-500"
                                    }`}>
                                        {index === 0 ? "1" : index === 1 ? "2" : index === 2 ? "3" : player.rank}
                                    </span>
                                    <span className="flex-1 text-white truncate">{player.nickname}</span>
                                    <span className="font-mono text-sm text-gray-400">
                                        {player.score.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                            {game.leaderboard.length === 0 && (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    No scores yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Send Hint Modal */}
            {showHintModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Send Hint to Class</h2>
                        <p className="text-sm text-gray-400 mb-4">
                            This message will be displayed to all students currently in the quiz.
                        </p>
                        <textarea
                            value={hintMessage}
                            onChange={(e) => setHintMessage(e.target.value)}
                            placeholder="Type your hint or message..."
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none resize-none"
                            rows={3}
                        />
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={() => setShowHintModal(false)}
                                className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-gray-300 hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={sendHint}
                                disabled={sendingHint || !hintMessage.trim()}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-50"
                            >
                                {sendingHint ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

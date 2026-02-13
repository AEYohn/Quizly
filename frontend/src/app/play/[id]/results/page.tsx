"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, Medal, ArrowLeft, Loader2, Users, Target, BarChart3 } from "lucide-react";
import { useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LeaderboardEntry {
    player_id?: string;
    id?: string;
    nickname: string;
    score?: number;
    total_score?: number;
    rank: number;
    correct_answers: number;
    total_answers?: number;
    avatar?: string;
    current_streak?: number;
}

interface QuestionSummary {
    question_text: string;
    correct_count: number;
    total_answers: number;
}

// Finished game format
interface FinishedGameResults {
    id: string;
    quiz_title: string;
    player_count: number;
    leaderboard: LeaderboardEntry[];
    questions_summary: QuestionSummary[];
}

// Mid-game results format
interface MidGameResults {
    correct_answer: string;
    explanation?: string;
    answer_distribution: Record<string, number>;
    leaderboard: LeaderboardEntry[];
}

type GameResults = FinishedGameResults | MidGameResults;

function isFinishedGameResults(results: GameResults): results is FinishedGameResults {
    return 'quiz_title' in results;
}

export default function GameResultsPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.id as string;
    const { isSignedIn } = useUser();

    const [results, setResults] = useState<GameResults | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Try to get the player's nickname from sessionStorage or localStorage
    const nickname = typeof window !== "undefined"
        ? sessionStorage.getItem("nickname") || localStorage.getItem("quizly_student_name")
        : null;

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const response = await fetch(`${API_URL}/games/${gameId}/results`);
                if (!response.ok) {
                    if (response.status === 400) {
                        setError("Results not available yet. The game may still be in progress.");
                    } else if (response.status === 404) {
                        setError("Game not found.");
                    } else {
                        setError("Failed to load results.");
                    }
                    return;
                }

                const data = await response.json();
                setResults(data);
            } catch (err) {
                console.error("Failed to fetch results:", err);
                setError("Failed to load results. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [gameId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-sky-400 mx-auto" />
                    <p className="mt-4 text-gray-400">Loading results...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
                <div className="text-center">
                    <BarChart3 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-white mb-2">Results Unavailable</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <Link
                        href={isSignedIn ? "/student/dashboard" : "/join"}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-500 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        {isSignedIn ? "Back to Dashboard" : "Join Another Game"}
                    </Link>
                </div>
            </div>
        );
    }

    if (!results) {
        return null;
    }

    // Normalize leaderboard entries to consistent format
    const normalizedLeaderboard = results.leaderboard.map(entry => ({
        player_id: entry.player_id || entry.id || "",
        nickname: entry.nickname,
        score: entry.score ?? entry.total_score ?? 0,
        rank: entry.rank,
        correct_answers: entry.correct_answers,
        total_answers: entry.total_answers,
    }));

    // Find player's position if they have a nickname
    const playerEntry = nickname
        ? normalizedLeaderboard.find(p => p.nickname.toLowerCase() === nickname.toLowerCase())
        : null;

    const isFinished = isFinishedGameResults(results);
    const quizTitle = isFinished ? results.quiz_title : "Game Results";
    const playerCount = isFinished ? results.player_count : normalizedLeaderboard.length;
    const questionsSummary = isFinished ? results.questions_summary : [];

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-400" />;
        if (rank === 2) return <Medal className="h-6 w-6 text-gray-300" />;
        if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
        return <span className="text-gray-400 font-bold">{rank}</span>;
    };

    const getRankBg = (rank: number, isCurrentPlayer: boolean) => {
        if (isCurrentPlayer) return "bg-sky-500/20 border-sky-500";
        if (rank === 1) return "bg-yellow-500/10 border-yellow-500/30";
        if (rank === 2) return "bg-gray-500/10 border-gray-500/30";
        if (rank === 3) return "bg-amber-500/10 border-amber-500/30";
        return "bg-gray-800/50 border-gray-700";
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/50">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link
                            href={isSignedIn ? "/student/dashboard" : "/join"}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                            {isSignedIn ? "Dashboard" : "Join"}
                        </Link>
                        <div className="flex items-center gap-2 text-gray-400">
                            <Users className="h-5 w-5" />
                            <span>{playerCount} players</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {/* Title */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">{quizTitle}</h1>
                    <p className="text-gray-400">{isFinished ? "Final Results" : "Current Standings"}</p>
                </div>

                {/* Player's Result Highlight */}
                {playerEntry && (
                    <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-sky-500/20 to-teal-500/20 border border-sky-500/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-sky-500/30 rounded-xl">
                                    {getRankIcon(playerEntry.rank)}
                                </div>
                                <div>
                                    <p className="text-sm text-sky-300">Your Result</p>
                                    <h2 className="text-2xl font-bold">{playerEntry.nickname}</h2>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold text-sky-400">{playerEntry.score.toLocaleString()}</p>
                                <p className="text-sm text-gray-400">
                                    {playerEntry.correct_answers} correct
                                    {playerEntry.total_answers !== undefined && ` / ${playerEntry.total_answers}`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Leaderboard - Top 10 */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-400" />
                        Top 10
                    </h2>
                    <div className="space-y-2">
                        {normalizedLeaderboard.slice(0, 10).map((entry) => {
                            const isCurrentPlayer = playerEntry?.player_id === entry.player_id;
                            return (
                                <div
                                    key={entry.player_id || entry.nickname}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${getRankBg(entry.rank, isCurrentPlayer)}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 flex justify-center">
                                            {getRankIcon(entry.rank)}
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isCurrentPlayer ? "text-sky-300" : "text-white"}`}>
                                                {entry.nickname}
                                                {isCurrentPlayer && <span className="ml-2 text-xs text-sky-400">(You)</span>}
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                {entry.correct_answers} correct
                                                {entry.total_answers !== undefined && ` / ${entry.total_answers}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold">{entry.score.toLocaleString()}</p>
                                        <p className="text-xs text-gray-500">points</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Questions Summary */}
                {questionsSummary.length > 0 && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Target className="h-5 w-5 text-emerald-400" />
                            Questions Breakdown
                        </h2>
                        <div className="space-y-3">
                            {questionsSummary.map((q, index) => {
                                const percentage = q.total_answers > 0
                                    ? Math.round((q.correct_count / q.total_answers) * 100)
                                    : 0;
                                return (
                                    <div
                                        key={index}
                                        className="p-4 rounded-xl bg-gray-800/50 border border-gray-700"
                                    >
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <p className="text-sm text-gray-300 line-clamp-2">
                                                <span className="text-gray-500 mr-2">Q{index + 1}.</span>
                                                {q.question_text}
                                            </p>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                percentage >= 70
                                                    ? "bg-emerald-500/20 text-emerald-400"
                                                    : percentage >= 40
                                                    ? "bg-yellow-500/20 text-yellow-400"
                                                    : "bg-red-500/20 text-red-400"
                                            }`}>
                                                {percentage}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${
                                                    percentage >= 70
                                                        ? "bg-emerald-500"
                                                        : percentage >= 40
                                                        ? "bg-yellow-500"
                                                        : "bg-red-500"
                                                }`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {q.correct_count} of {q.total_answers} answered correctly
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex justify-center gap-4">
                    <Link
                        href={isSignedIn ? "/student/dashboard" : "/join"}
                        className="px-6 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
                    >
                        {isSignedIn ? "Back to Dashboard" : "Join Another Game"}
                    </Link>
                </div>
            </main>
        </div>
    );
}

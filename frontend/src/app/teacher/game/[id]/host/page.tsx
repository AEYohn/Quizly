"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Play,
    SkipForward,
    Users,
    Trophy,
    Clock,
    BarChart2,
    Loader2,
    Home,
    Wifi,
    WifiOff,
} from "lucide-react";
import { useGameSocket } from "~/lib/useGameSocket";
import type {
    QuestionStartMessage,
    ResultsMessage,
    GameEndMessage,
    PlayerConnectedMessage,
} from "~/lib/useGameSocket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PlayerScore {
    player_id: string;
    nickname: string;
    score: number;
    rank: number;
}

interface QuestionResult {
    question_text: string;
    correct_answer: string;
    answer_distribution: { [key: string]: number };
    correct_count: number;
    total_answers: number;
}

interface GameState {
    id: string;
    status: string;
    current_question_index: number;
    total_questions: number;
    player_count: number;
    quiz_title: string;
    sync_mode?: boolean;
    current_question?: {
        question_text: string;
        question_type: string;
        options: { [key: string]: string };
        time_limit: number;
        points: number;
    };
    leaderboard?: PlayerScore[];
    question_results?: QuestionResult;
}

export default function GameHostPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.id as string;

    const [game, setGame] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [answersReceived, setAnswersReceived] = useState(0);
    const [useSyncMode, setUseSyncMode] = useState(false);
    const [advancing, setAdvancing] = useState(false);

    // WebSocket connection for host
    const { isConnected, timeRemaining, playerCount } = useGameSocket({
        gameId,
        isHost: true,
        enabled: useSyncMode && !loading,
        onConnected: (data) => {
            console.log("Host WebSocket connected:", data);
        },
        onTimerTick: (data) => {
            setTimeLeft(data.time_remaining);
        },
        onQuestionStart: (data: QuestionStartMessage) => {
            console.log("Question started via WebSocket:", data);
            // Update game state with new question
            setGame(prev => prev ? {
                ...prev,
                status: "question",
                current_question_index: data.question_index,
                current_question: {
                    question_text: data.question_text,
                    question_type: data.question_type,
                    options: data.options,
                    time_limit: data.time_limit,
                    points: data.points,
                }
            } : prev);
            setShowResults(false);
            setTimeLeft(data.time_limit);
            setAnswersReceived(0);
        },
        onQuestionEnd: () => {
            console.log("Question ended via WebSocket");
            setTimeLeft(0);
        },
        onResults: (data: ResultsMessage) => {
            console.log("Results received via WebSocket:", data);
            setShowResults(true);
            // Fetch full results from API
            fetchQuestionResults();
        },
        onGameEnd: (data: GameEndMessage) => {
            console.log("Game ended via WebSocket:", data);
            setGame(prev => prev ? { ...prev, status: "finished" } : prev);
        },
        onPlayerConnected: (data: PlayerConnectedMessage) => {
            console.log("Player connected:", data);
            setGame(prev => prev ? { ...prev, player_count: data.player_count } : prev);
        },
        onPlayerDisconnected: (data) => {
            console.log("Player disconnected:", data);
            setGame(prev => prev ? { ...prev, player_count: data.player_count } : prev);
        },
        onHostDisconnected: () => {
            console.log("Host disconnected event received");
        },
        onError: (error) => {
            console.error("WebSocket error:", error);
        },
    });

    // Use WebSocket timer when in sync mode
    useEffect(() => {
        if (useSyncMode && timeRemaining !== null) {
            setTimeLeft(timeRemaining);
        }
    }, [useSyncMode, timeRemaining]);

    // Use WebSocket player count when connected
    useEffect(() => {
        if (isConnected && playerCount > 0) {
            setGame(prev => prev ? { ...prev, player_count: playerCount } : prev);
        }
    }, [isConnected, playerCount]);

    const fetchGame = useCallback(async () => {
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

                // Check if game uses sync mode
                if (data.sync_mode !== undefined) {
                    setUseSyncMode(data.sync_mode);
                }

                if (data.status === "lobby") {
                    router.push(`/teacher/game/${gameId}/lobby`);
                }
            }
        } catch (error) {
            console.error("Failed to fetch game:", error);
        } finally {
            setLoading(false);
        }
    }, [gameId, router]);

    const fetchQuestionResults = useCallback(async () => {
        if (!game || game.current_question_index < 0) return;

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `${API_URL}/games/${gameId}/questions/${game.current_question_index}/results`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            if (response.ok) {
                const data = await response.json();
                setAnswersReceived(data.total_answers);
                if (showResults) {
                    setGame(prev => prev ? { ...prev, question_results: data } : prev);
                }
            }
        } catch (error) {
            console.error("Failed to fetch results:", error);
        }
    }, [gameId, game?.current_question_index, showResults]);

    // Initial fetch
    useEffect(() => {
        fetchGame();
    }, [fetchGame]);

    // Polling for game state - only if WebSocket is not connected
    useEffect(() => {
        if (!isConnected && !loading) {
            const interval = setInterval(fetchGame, 3000);
            return () => clearInterval(interval);
        }
    }, [isConnected, loading, fetchGame]);

    // Poll for answer counts during question
    useEffect(() => {
        if (game?.status === "question" && !showResults) {
            fetchQuestionResults();
            const resultInterval = setInterval(fetchQuestionResults, 1500);
            return () => clearInterval(resultInterval);
        }
    }, [game?.status, showResults, fetchQuestionResults]);

    // Local timer initialization (for non-sync mode)
    useEffect(() => {
        if (!useSyncMode && game?.status === "question" && game.current_question && !showResults) {
            setTimeLeft(game.current_question.time_limit);
        }
    }, [game?.current_question_index, game?.status, showResults, useSyncMode, game?.current_question]);

    // Local timer countdown (only for non-sync mode)
    useEffect(() => {
        if (useSyncMode) return; // WebSocket handles timer in sync mode
        if (timeLeft === null || timeLeft <= 0 || showResults) return;

        const timer = setTimeout(() => {
            setTimeLeft(timeLeft - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [timeLeft, showResults, useSyncMode]);

    const showQuestionResults = async () => {
        setShowResults(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `${API_URL}/games/${gameId}/questions/${game?.current_question_index}/results`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            if (response.ok) {
                const data = await response.json();
                setGame((prev) =>
                    prev ? { ...prev, question_results: data } : prev
                );
            }
        } catch (error) {
            console.error("Failed to fetch results:", error);
        }
    };

    const nextQuestion = async () => {
        setAdvancing(true);
        setShowResults(false);
        setTimeLeft(null);
        setAnswersReceived(0);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/${gameId}/next`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                // Update game state directly from response
                if (data.current_question) {
                    setGame(prev => prev ? {
                        ...prev,
                        status: "question",
                        current_question_index: data.current_question_index,
                        current_question: data.current_question,
                    } : prev);
                    setTimeLeft(data.current_question.time_limit);
                } else if (data.status === "finished") {
                    setGame(prev => prev ? { ...prev, status: "finished" } : prev);
                } else {
                    // Fallback: refresh from server
                    await fetchGame();
                }
            }
        } catch (error) {
            console.error("Failed to advance:", error);
        } finally {
            setAdvancing(false);
        }
    };

    const endGame = async () => {
        router.push(`/teacher/game/${gameId}/results`);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-600 to-purple-800">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
        );
    }

    if (!game) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-600 to-purple-800">
                <div className="text-white">Game not found</div>
            </div>
        );
    }

    // Game finished
    if (game.status === "finished") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-purple-600 to-purple-800 p-8">
                <Trophy className="mb-6 h-24 w-24 text-yellow-400" />
                <h1 className="mb-4 text-4xl font-bold text-white">Game Complete!</h1>
                <p className="mb-8 text-xl text-white/80">
                    {game.player_count} players participated
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={() => router.push(`/teacher/game/${gameId}/results`)}
                        className="flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-purple-600 hover:bg-white/90"
                    >
                        <BarChart2 className="h-6 w-6" />
                        View Results
                    </button>
                    <button
                        onClick={() => router.push("/teacher/quizzes")}
                        className="flex items-center gap-2 rounded-xl bg-white/20 px-8 py-4 text-lg font-bold text-white hover:bg-white/30"
                    >
                        <Home className="h-6 w-6" />
                        Back to Quizzes
                    </button>
                </div>
            </div>
        );
    }

    const colors = ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"];

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 p-8">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-white">
                            <span className="text-white/70">Question</span>{" "}
                            <span className="text-2xl font-bold">
                                {game.current_question_index + 1}
                            </span>{" "}
                            <span className="text-white/70">of {game.total_questions}</span>
                        </div>

                        {/* Sync mode indicator */}
                        {useSyncMode && (
                            <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                                isConnected ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
                            }`}>
                                {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                                <span className="text-sm">{isConnected ? "Live Sync" : "Connecting..."}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-white">
                            <Users className="h-5 w-5" />
                            <span>{answersReceived} / {game.player_count} answered</span>
                        </div>
                        {timeLeft !== null && !showResults && (
                            <div className={`flex items-center gap-2 rounded-xl px-4 py-2 ${
                                timeLeft <= 5 ? "bg-red-500" : "bg-white"
                            }`}>
                                <Clock className={`h-5 w-5 ${timeLeft <= 5 ? "text-white" : "text-purple-600"}`} />
                                <span className={`text-2xl font-bold ${
                                    timeLeft <= 5 ? "text-white animate-pulse" : "text-purple-600"
                                }`}>
                                    {timeLeft}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Question Display */}
                {game.current_question && (
                    <div className="mb-8 rounded-2xl bg-white p-8 text-center shadow-xl">
                        <h2 className="text-3xl font-bold text-gray-900">
                            {game.current_question.question_text}
                        </h2>
                    </div>
                )}

                {/* Answer Options with Results */}
                {game.current_question && (
                    <div className="mb-8 grid grid-cols-2 gap-4">
                        {Object.entries(game.current_question.options).map(
                            ([key, value], index) => {
                                const resultCount =
                                    showResults && game.question_results
                                        ? game.question_results.answer_distribution[key] || 0
                                        : 0;
                                const totalAnswers =
                                    showResults && game.question_results
                                        ? game.question_results.total_answers
                                        : 1;
                                const percentage = totalAnswers > 0
                                    ? Math.round((resultCount / totalAnswers) * 100)
                                    : 0;
                                const isCorrect =
                                    showResults &&
                                    game.question_results?.correct_answer === key;

                                return (
                                    <div
                                        key={key}
                                        className={`relative overflow-hidden rounded-xl ${colors[index]} p-6 ${
                                            isCorrect && showResults
                                                ? "ring-4 ring-white ring-offset-2 ring-offset-purple-700"
                                                : ""
                                        }`}
                                    >
                                        {showResults && (
                                            <div
                                                className="absolute inset-0 bg-black/20"
                                                style={{
                                                    width: `${percentage}%`,
                                                    transition: "width 0.5s ease-out",
                                                }}
                                            />
                                        )}
                                        <div className="relative flex items-center justify-between">
                                            <span className="text-xl font-bold text-white">
                                                {value}
                                            </span>
                                            {showResults && (
                                                <span className="text-lg font-bold text-white">
                                                    {resultCount} ({percentage}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                        )}
                    </div>
                )}

                {/* Control Buttons */}
                <div className="flex justify-center gap-4">
                    {!showResults ? (
                        <button
                            onClick={showQuestionResults}
                            className="flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-purple-600 hover:bg-white/90"
                        >
                            <BarChart2 className="h-6 w-6" />
                            Show Results
                        </button>
                    ) : game.current_question_index < game.total_questions - 1 ? (
                        <button
                            onClick={nextQuestion}
                            disabled={advancing}
                            className="flex items-center gap-2 rounded-xl bg-green-500 px-8 py-4 text-lg font-bold text-white hover:bg-green-600 disabled:opacity-50"
                        >
                            {advancing ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <SkipForward className="h-6 w-6" />
                            )}
                            Next Question
                        </button>
                    ) : (
                        <button
                            onClick={endGame}
                            className="flex items-center gap-2 rounded-xl bg-yellow-500 px-8 py-4 text-lg font-bold text-white hover:bg-yellow-600"
                        >
                            <Trophy className="h-6 w-6" />
                            Show Final Results
                        </button>
                    )}
                </div>

                {/* Leaderboard Preview */}
                {showResults && game.leaderboard && game.leaderboard.length > 0 && (
                    <div className="mt-8 rounded-2xl bg-white/10 p-6 backdrop-blur">
                        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                            <Trophy className="h-5 w-5 text-yellow-400" />
                            Top Players
                        </h3>
                        <div className="space-y-2">
                            {game.leaderboard.slice(0, 5).map((player, index) => (
                                <div
                                    key={player.player_id}
                                    className="flex items-center gap-4 rounded-xl bg-white/10 p-3"
                                >
                                    <span
                                        className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                            index === 0
                                                ? "bg-yellow-400 text-yellow-900"
                                                : index === 1
                                                ? "bg-gray-300 text-gray-700"
                                                : index === 2
                                                ? "bg-orange-400 text-orange-900"
                                                : "bg-white/20 text-white"
                                        }`}
                                    >
                                        {index + 1}
                                    </span>
                                    <span className="flex-1 font-medium text-white">
                                        {player.nickname}
                                    </span>
                                    <span className="font-bold text-yellow-400">
                                        {player.score.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

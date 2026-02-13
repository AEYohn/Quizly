"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
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
    Sparkles,
    Brain,
    MessageSquare,
    AlertTriangle,
    TrendingUp,
    Lightbulb,
    Volume2,
    VolumeX,
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

interface AICommentary {
    message: string;
    type: "insight" | "encouragement" | "tip" | "warning";
    timestamp: Date;
}

export default function GameHostPage() {
    const params = useParams();
    const router = useRouter();
    const { getToken } = useClerkAuth();
    const gameId = params.id as string;

    const [game, setGame] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [answersReceived, setAnswersReceived] = useState(0);
    const [useSyncMode, setUseSyncMode] = useState(false);
    const [advancing, setAdvancing] = useState(false);

    // AI Commentary state
    const [aiCommentary, setAiCommentary] = useState<AICommentary[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [showAiPanel, setShowAiPanel] = useState(true);
    const commentaryRef = useRef<HTMLDivElement>(null);

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
            // Get AI commentary for new question
            fetchQuestionStartCommentary(data.question_text, data.question_index);
        },
        onQuestionEnd: () => {
            console.log("Question ended via WebSocket");
            setTimeLeft(0);
        },
        onResults: (data: ResultsMessage) => {
            console.log("Results received via WebSocket:", data);
            setShowResults(true);
            fetchQuestionResults();
        },
        onGameEnd: (data: GameEndMessage) => {
            console.log("Game ended via WebSocket:", data);
            setGame(prev => prev ? { ...prev, status: "finished" } : prev);
            fetchGameEndCommentary();
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

    // Fetch AI commentary for question start
    const fetchQuestionStartCommentary = async (questionText: string, questionIndex: number) => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/host/react/question-start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    question_text: questionText,
                    question_num: questionIndex + 1,
                    total: game?.total_questions || 0,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                addCommentary(data.reaction || data.message || data.commentary, "tip");
            }
        } catch (error) {
            console.error("Failed to fetch question commentary:", error);
        }
    };

    // Generate AI commentary for answer results
    const fetchAnswerCommentary = async (results: QuestionResult) => {
        if (aiLoading) return;
        setAiLoading(true);

        const correctPct = results.total_answers > 0
            ? Math.round((results.correct_count / results.total_answers) * 100)
            : 0;

        // Generate contextual commentary based on results
        let commentary = "";
        let type: AICommentary["type"] = "insight";

        if (correctPct >= 80) {
            commentary = `Excellent! ${correctPct}% got it right! 🎉 The class has a strong grasp of this concept.`;
            type = "encouragement";
        } else if (correctPct >= 60) {
            commentary = `Good progress! ${correctPct}% correct. Most students understand this, but a quick review might help.`;
            type = "encouragement";
        } else if (correctPct >= 40) {
            commentary = `${correctPct}% correct. This topic might need more discussion. Consider explaining the key concept.`;
            type = "insight";
        } else {
            commentary = `Only ${correctPct}% got this right. This is a challenging topic - consider a mini-lesson or peer discussion.`;
            type = "warning";
        }

        // Add distribution insight
        const entries = Object.entries(results.answer_distribution).sort((a, b) => b[1] - a[1]);
        const topAnswer = entries[0];
        if (entries.length > 1 && topAnswer && topAnswer[0] !== results.correct_answer) {
            commentary += ` Many chose option ${topAnswer[0]} - there might be a common misconception to address.`;
        }

        addCommentary(commentary, type);
        setAiLoading(false);
    };

    // Fetch AI commentary for game end
    const fetchGameEndCommentary = async () => {
        try {
            const token = await getToken();
            const winner = game?.leaderboard?.[0];
            const avgScore = game?.leaderboard?.length
                ? game.leaderboard.reduce((sum, p) => sum + p.score, 0) / game.leaderboard.length
                : 0;

            const response = await fetch(`${API_URL}/host/react/game-end`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    winner_name: winner?.nickname || "Everyone",
                    winner_score: winner?.score || 0,
                    player_count: game?.player_count || 0,
                    avg_score: avgScore,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                addCommentary(data.reaction || data.message || data.commentary, "encouragement");
            }
        } catch (error) {
            console.error("Failed to fetch game end commentary:", error);
        }
    };

    const addCommentary = (message: string, type: AICommentary["type"]) => {
        if (!message) return;
        setAiCommentary(prev => [...prev.slice(-4), { message, type, timestamp: new Date() }]);
        // Scroll to bottom
        setTimeout(() => {
            commentaryRef.current?.scrollTo({ top: commentaryRef.current.scrollHeight, behavior: "smooth" });
        }, 100);
    };

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
            const token = await getToken();
            const response = await fetch(`${API_URL}/games/${gameId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setGame(data);

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
    }, [gameId, router, getToken]);

    const fetchQuestionResults = useCallback(async () => {
        if (!game || game.current_question_index < 0) return;

        try {
            const token = await getToken();
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
                    // Get AI commentary for results
                    fetchAnswerCommentary(data);
                }
            }
        } catch (error) {
            console.error("Failed to fetch results:", error);
        }
    }, [gameId, game?.current_question_index, showResults, getToken]);

    // Initial fetch
    useEffect(() => {
        fetchGame();
    }, [fetchGame]);

    // Initial AI greeting
    useEffect(() => {
        if (game && aiCommentary.length === 0) {
            addCommentary(`Welcome to "${game.quiz_title}"! ${game.player_count} students are ready. Let's make learning fun! 🎉`, "encouragement");
        }
    }, [game]);

    // Polling for game state
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

    // Local timer initialization
    useEffect(() => {
        if (!useSyncMode && game?.status === "question" && game.current_question && !showResults) {
            setTimeLeft(game.current_question.time_limit);
        }
    }, [game?.current_question_index, game?.status, showResults, useSyncMode, game?.current_question]);

    // Local timer countdown
    useEffect(() => {
        if (useSyncMode) return;
        if (timeLeft === null || timeLeft <= 0 || showResults) return;

        const timer = setTimeout(() => {
            setTimeLeft(timeLeft - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [timeLeft, showResults, useSyncMode]);

    const showQuestionResults = async () => {
        setShowResults(true);
        try {
            const token = await getToken();
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
                setGame(prev => prev ? { ...prev, question_results: data } : prev);
                fetchAnswerCommentary(data);
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
            const token = await getToken();
            const response = await fetch(`${API_URL}/games/${gameId}/next`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.current_question) {
                    setGame(prev => prev ? {
                        ...prev,
                        status: "question",
                        current_question_index: data.current_question_index,
                        current_question: data.current_question,
                    } : prev);
                    setTimeLeft(data.current_question.time_limit);
                    fetchQuestionStartCommentary(data.current_question.question_text, data.current_question_index);
                } else if (data.status === "finished") {
                    setGame(prev => prev ? { ...prev, status: "finished" } : prev);
                } else {
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

    const getCommentaryIcon = (type: AICommentary["type"]) => {
        switch (type) {
            case "encouragement": return <TrendingUp className="h-4 w-4 text-green-500" />;
            case "warning": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
            case "tip": return <Lightbulb className="h-4 w-4 text-yellow-500" />;
            default: return <Brain className="h-4 w-4 text-teal-500" />;
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-12 w-12 animate-spin text-sky-400" />
            </div>
        );
    }

    if (!game) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <div className="text-white">Game not found</div>
            </div>
        );
    }

    // Game finished
    if (game.status === "finished") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
                <Trophy className="mb-6 h-24 w-24 text-yellow-400" />
                <h1 className="mb-4 text-4xl font-bold text-white">Game Complete!</h1>
                <p className="mb-8 text-xl text-gray-400">
                    {game.player_count} players participated
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={() => router.push(`/teacher/game/${gameId}/results`)}
                        className="flex items-center gap-2 rounded-xl bg-sky-600 px-8 py-4 text-lg font-bold text-white hover:bg-sky-700"
                    >
                        <BarChart2 className="h-6 w-6" />
                        View Results & AI Insights
                    </button>
                    <button
                        onClick={() => router.push("/teacher/quizzes")}
                        className="flex items-center gap-2 rounded-xl bg-gray-800 border border-gray-700 px-8 py-4 text-lg font-bold text-white hover:bg-gray-700"
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
        <div className="min-h-screen bg-gray-950 p-4 lg:p-8">
            <div className="mx-auto max-w-7xl">
                <div className="flex gap-6">
                    {/* Main Content */}
                    <div className="flex-1">
                        {/* Header */}
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="text-white">
                                    <span className="text-gray-400">Question</span>{" "}
                                    <span className="text-2xl font-bold">
                                        {game.current_question_index + 1}
                                    </span>{" "}
                                    <span className="text-gray-400">of {game.total_questions}</span>
                                </div>

                                {useSyncMode && (
                                    <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                                        isConnected ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
                                    }`}>
                                        {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                                        <span className="text-sm">{isConnected ? "Live" : "..."}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-white">
                                    <Users className="h-5 w-5" />
                                    <span>{answersReceived} / {game.player_count}</span>
                                </div>
                                {timeLeft !== null && !showResults && (
                                    <div className={`flex items-center gap-2 rounded-xl px-4 py-2 ${
                                        timeLeft <= 5 ? "bg-red-500" : "bg-gray-800 border border-gray-700"
                                    }`}>
                                        <Clock className={`h-5 w-5 ${timeLeft <= 5 ? "text-white" : "text-sky-400"}`} />
                                        <span className={`text-2xl font-bold ${
                                            timeLeft <= 5 ? "text-white animate-pulse" : "text-white"
                                        }`}>
                                            {timeLeft}
                                        </span>
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowAiPanel(!showAiPanel)}
                                    className={`rounded-lg p-2 transition-colors ${
                                        showAiPanel ? "bg-sky-500/20 text-sky-400" : "bg-gray-800 text-gray-500"
                                    }`}
                                    title="Toggle AI Commentary"
                                >
                                    <Sparkles className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Question Display */}
                        {game.current_question && (
                            <div className="mb-8 rounded-2xl bg-gray-900 border border-gray-800 p-8 text-center">
                                <h2 className="text-3xl font-bold text-white">
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
                                                        ? "ring-4 ring-white ring-offset-2 ring-offset-gray-950"
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
                                    className="flex items-center gap-2 rounded-xl bg-sky-600 px-8 py-4 text-lg font-bold text-white hover:bg-sky-700"
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
                            <div className="mt-8 rounded-2xl bg-gray-900 border border-gray-800 p-6">
                                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                                    <Trophy className="h-5 w-5 text-yellow-400" />
                                    Top Players
                                </h3>
                                <div className="space-y-2">
                                    {game.leaderboard.slice(0, 5).map((player, index) => (
                                        <div
                                            key={player.player_id}
                                            className="flex items-center gap-4 rounded-xl bg-gray-800 p-3"
                                        >
                                            <span
                                                className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                                    index === 0
                                                        ? "bg-yellow-400 text-yellow-900"
                                                        : index === 1
                                                        ? "bg-gray-300 text-gray-700"
                                                        : index === 2
                                                        ? "bg-orange-400 text-orange-900"
                                                        : "bg-gray-700 text-gray-300"
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

                    {/* AI Commentary Panel */}
                    {showAiPanel && (
                        <div className="w-80 flex-shrink-0">
                            <div className="sticky top-4 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
                                    <Sparkles className="h-5 w-5 text-yellow-400" />
                                    <span className="font-semibold text-white">AI Host Assistant</span>
                                    {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400 ml-auto" />}
                                </div>
                                <div
                                    ref={commentaryRef}
                                    className="p-4 space-y-3 max-h-[500px] overflow-y-auto"
                                >
                                    {aiCommentary.length === 0 ? (
                                        <div className="text-center text-gray-500 py-8">
                                            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">AI insights will appear here</p>
                                        </div>
                                    ) : (
                                        aiCommentary.map((comment, idx) => (
                                            <div
                                                key={idx}
                                                className="rounded-xl bg-gray-800 p-3 animate-in fade-in slide-in-from-bottom-2"
                                            >
                                                <div className="flex items-start gap-2">
                                                    {getCommentaryIcon(comment.type)}
                                                    <p className="text-sm text-gray-300 leading-relaxed">
                                                        {comment.message}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-700">
                                    <p className="text-xs text-gray-500 text-center">
                                        Powered by Gemini AI
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

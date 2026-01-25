"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, Trophy, Loader2, Check, X, Sparkles, Zap, Star } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GameState {
    id: string;
    status: "lobby" | "question" | "results" | "finished";
    current_question_index: number;
    total_questions: number;
    quiz_title: string;
    current_question?: {
        question_text: string;
        question_type: string;
        options: { [key: string]: string };
        time_limit: number;
        points: number;
    };
}

interface PlayerState {
    score: number;
    rank: number;
    last_answer_correct: boolean | null;
    last_answer_points: number;
}

export default function PlayGamePage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.id as string;

    const [game, setGame] = useState<GameState | null>(null);
    const [playerState, setPlayerState] = useState<PlayerState | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [questionStartTime, setQuestionStartTime] = useState<number>(0);

    // AI Host state
    const [hostMessage, setHostMessage] = useState<string>("");
    const [hostLoading, setHostLoading] = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);
    const [streak, setStreak] = useState(0);

    const playerId = typeof window !== "undefined"
        ? sessionStorage.getItem("playerId")
        : null;
    const nickname = typeof window !== "undefined"
        ? sessionStorage.getItem("nickname")
        : null;

    // Fetch AI host reaction
    const fetchHostReaction = useCallback(async (
        isCorrect: boolean,
        questionText: string,
        theirAnswer: string,
        correctAnswer: string,
        options: { [key: string]: string },
        timeTaken: number
    ) => {
        setHostLoading(true);
        try {
            const response = await fetch(`${API_URL}/host/react/answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    player_id: playerId,
                    player_name: nickname || "Player",
                    question_text: questionText,
                    their_answer: theirAnswer,
                    correct_answer: correctAnswer,
                    is_correct: isCorrect,
                    time_taken: timeTaken,
                    options: options
                })
            });
            if (response.ok) {
                const data = await response.json();
                setHostMessage(data.reaction);
                if (!isCorrect) {
                    setShowExplanation(true);
                }
            }
        } catch (error) {
            console.error("Failed to get host reaction:", error);
            // Fallback message
            setHostMessage(isCorrect ? "Nice one! 🎯" : "Keep going! You've got this! 💪");
        } finally {
            setHostLoading(false);
        }
    }, [playerId, nickname]);

    // Fetch player state
    const fetchPlayerState = useCallback(async () => {
        if (!playerId) return;

        try {
            const response = await fetch(
                `${API_URL}/games/${gameId}/players/${playerId}/state`
            );
            if (response.ok) {
                const data = await response.json();
                setPlayerState(data);
            }
        } catch (error) {
            console.error("Failed to fetch player state:", error);
        }
    }, [gameId, playerId]);

    const fetchGame = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/games/${gameId}/player`);
            if (response.ok) {
                const data = await response.json();

                // Check if question changed
                if (game && data.current_question_index !== game.current_question_index) {
                    setSelectedAnswer(null);
                    setHasAnswered(false);
                    setQuestionStartTime(Date.now());
                    setHostMessage("");
                    setShowExplanation(false);
                    if (data.current_question) {
                        setTimeLeft(data.current_question.time_limit);
                    }
                }

                setGame(data);
            }
        } catch (error) {
            console.error("Failed to fetch game:", error);
        } finally {
            setLoading(false);
        }
    }, [gameId, game]);

    useEffect(() => {
        if (!playerId) {
            router.push("/join");
            return;
        }

        fetchGame();

        const interval = setInterval(() => {
            fetchGame();
            if (hasAnswered || game?.status === "results") {
                fetchPlayerState();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [fetchGame, fetchPlayerState, playerId, router, hasAnswered, game?.status]);

    // Timer initialization
    useEffect(() => {
        if (game?.status === "question" && game.current_question && !hasAnswered) {
            setTimeLeft(game.current_question.time_limit);
            setQuestionStartTime(Date.now());
        }
    }, [game?.current_question_index]);

    // Timer countdown
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0 || hasAnswered) return;

        const timer = setTimeout(() => {
            setTimeLeft(timeLeft - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [timeLeft, hasAnswered]);

    const submitAnswer = async (answer: string) => {
        if (hasAnswered || !playerId || !game?.current_question) return;

        setSelectedAnswer(answer);
        setHasAnswered(true);

        const timeTaken = (Date.now() - questionStartTime) / 1000;
        const correctAnswer = Object.keys(game.current_question.options)[0]; // We'll get the real answer from the response

        try {
            const response = await fetch(`${API_URL}/games/${gameId}/answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    player_id: playerId,
                    question_index: game.current_question_index,
                    answer: answer,
                    time_taken: timeTaken,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                const isCorrect = result.correct;

                // Update streak
                if (isCorrect) {
                    setStreak(prev => prev + 1);
                } else {
                    setStreak(0);
                }

                // Fetch AI host reaction
                fetchHostReaction(
                    isCorrect,
                    game.current_question.question_text,
                    answer,
                    result.correct_answer || answer,
                    game.current_question.options,
                    timeTaken
                );
            }

            // Fetch updated player state
            fetchPlayerState();
        } catch (error) {
            console.error("Failed to submit answer:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
                <div className="text-center">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-white" />
                    <p className="mt-4 text-white/80">Loading game...</p>
                </div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8">
                <div className="text-xl text-white">Game not found</div>
                <button
                    onClick={() => router.push("/join")}
                    className="mt-4 rounded-full bg-white px-6 py-3 font-bold text-purple-600 shadow-lg hover:scale-105 transition-transform"
                >
                    Join Another Game
                </button>
            </div>
        );
    }

    // Lobby - waiting for game to start
    if (game.status === "lobby") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8">
                <div className="mb-8 animate-bounce">
                    <Sparkles className="h-20 w-20 text-yellow-300" />
                </div>
                <h1 className="mb-4 text-4xl font-bold text-white">
                    Hey {nickname}! 👋
                </h1>
                <p className="mb-8 text-xl text-white/80">
                    Get ready to play...
                </p>
                <div className="flex items-center gap-3 rounded-full bg-white/20 px-6 py-3 backdrop-blur">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                    <span className="text-white">Waiting for host to start</span>
                </div>
            </div>
        );
    }

    // Game finished
    if (game.status === "finished") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8">
                <div className="animate-bounce mb-6">
                    <Trophy className="h-24 w-24 text-yellow-400 drop-shadow-lg" />
                </div>
                <h1 className="mb-4 text-4xl font-bold text-white">Game Over!</h1>
                {playerState && (
                    <div className="mb-8 text-center">
                        <div className="mb-4 flex items-center justify-center gap-2">
                            <Star className="h-8 w-8 text-yellow-400" />
                            <span className="text-6xl font-bold text-white">
                                #{playerState.rank}
                            </span>
                        </div>
                        <p className="text-2xl text-white/90">
                            {playerState.score.toLocaleString()} points
                        </p>
                    </div>
                )}
                <button
                    onClick={() => router.push("/join")}
                    className="rounded-full bg-white px-8 py-4 text-lg font-bold text-purple-600 shadow-xl hover:scale-105 transition-transform"
                >
                    Play Again 🎮
                </button>
            </div>
        );
    }

    // Results - after answering (show AI host message)
    if (hasAnswered && hostMessage) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8">
                {/* Result Icon */}
                <div className={`mb-6 flex h-28 w-28 items-center justify-center rounded-full ${
                    playerState?.last_answer_correct
                        ? "bg-green-500 animate-pulse"
                        : "bg-orange-500"
                } shadow-2xl`}>
                    {playerState?.last_answer_correct ? (
                        <Check className="h-14 w-14 text-white" />
                    ) : (
                        <X className="h-14 w-14 text-white" />
                    )}
                </div>

                {/* Points earned */}
                {playerState?.last_answer_correct && playerState?.last_answer_points > 0 && (
                    <div className="mb-4 flex items-center gap-2 animate-bounce">
                        <Zap className="h-8 w-8 text-yellow-400" />
                        <span className="text-4xl font-bold text-yellow-400">
                            +{playerState.last_answer_points}
                        </span>
                    </div>
                )}

                {/* Streak indicator */}
                {streak >= 2 && (
                    <div className="mb-4 rounded-full bg-orange-500 px-4 py-2 text-white font-bold">
                        🔥 {streak} streak!
                    </div>
                )}

                {/* AI Host Message */}
                <div className="mb-8 max-w-md rounded-2xl bg-white/20 p-6 backdrop-blur-lg border border-white/30">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white/70 mb-1">Quizzy says:</p>
                            {hostLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin text-white" />
                            ) : (
                                <p className="text-lg text-white">{hostMessage}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Current Score */}
                <div className="rounded-2xl bg-white/10 px-8 py-4 text-center backdrop-blur">
                    <p className="text-white/70 text-sm">Your Score</p>
                    <p className="text-3xl font-bold text-white">
                        {playerState?.score.toLocaleString() || 0}
                    </p>
                    {playerState && (
                        <p className="mt-1 text-white/70">Rank #{playerState.rank}</p>
                    )}
                </div>

                {/* Waiting for next question */}
                <div className="mt-8 flex items-center gap-2 text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Waiting for next question...</span>
                </div>
            </div>
        );
    }

    // Waiting for result after answering
    if (hasAnswered && !hostMessage) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8">
                <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
                <p className="text-white/80">Checking your answer...</p>
            </div>
        );
    }

    // Question - answering phase
    const colors = [
        "from-red-500 to-red-600",
        "from-blue-500 to-blue-600",
        "from-yellow-500 to-yellow-600",
        "from-green-500 to-green-600",
    ];
    const shapes = ["▲", "◆", "●", "■"];

    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="rounded-full bg-white/20 px-4 py-2 backdrop-blur">
                    <span className="text-white/70">Q</span>{" "}
                    <span className="font-bold text-white">
                        {game.current_question_index + 1}/{game.total_questions}
                    </span>
                </div>

                {timeLeft !== null && (
                    <div className={`flex items-center gap-2 rounded-full px-5 py-2 ${
                        timeLeft <= 5
                            ? "bg-red-500 animate-pulse"
                            : "bg-white"
                    } shadow-lg`}>
                        <Clock className={`h-5 w-5 ${timeLeft <= 5 ? "text-white" : "text-purple-600"}`} />
                        <span className={`text-2xl font-bold ${
                            timeLeft <= 5 ? "text-white" : "text-purple-600"
                        }`}>
                            {timeLeft}
                        </span>
                    </div>
                )}
            </div>

            {/* Question Card */}
            <div className="mb-6 rounded-2xl bg-white p-6 shadow-xl">
                <p className="text-center text-xl font-bold text-gray-900">
                    {game.current_question?.question_text}
                </p>
            </div>

            {/* Answer Buttons */}
            {game.current_question && (
                <div className="flex flex-1 flex-col gap-3">
                    {Object.entries(game.current_question.options).map(
                        ([key, value], index) => (
                            <button
                                key={key}
                                onClick={() => submitAnswer(key)}
                                disabled={hasAnswered}
                                className={`flex flex-1 items-center gap-4 rounded-2xl bg-gradient-to-r ${colors[index]} p-5 text-white shadow-lg transition-all ${
                                    hasAnswered && selectedAnswer === key
                                        ? "ring-4 ring-white scale-95"
                                        : "hover:scale-[1.02] active:scale-95"
                                } ${hasAnswered ? "opacity-80" : ""}`}
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-2xl">
                                    {shapes[index]}
                                </span>
                                <span className="flex-1 text-left text-lg font-bold">
                                    {value}
                                </span>
                            </button>
                        )
                    )}
                </div>
            )}

            {/* Score footer */}
            <div className="mt-4 flex justify-center">
                <div className="rounded-full bg-white/20 px-6 py-2 backdrop-blur">
                    <span className="text-white/70">Score: </span>
                    <span className="font-bold text-white">
                        {playerState?.score?.toLocaleString() || 0}
                    </span>
                </div>
            </div>
        </div>
    );
}

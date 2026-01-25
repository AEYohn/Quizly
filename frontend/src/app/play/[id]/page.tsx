"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, Trophy, Loader2, Check, X, Sparkles, Zap, Star, ChevronDown, ChevronUp, Brain, MessageCircle, BarChart3, GraduationCap, Download, BookOpen, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useGameSocket } from "~/lib/useGameSocket";
import ConfidenceSlider from "~/components/ConfidenceSlider";
import PeerDiscussion from "~/components/PeerDiscussion";
import LearningAnalytics from "~/components/LearningAnalytics";
import PostQuizSummary from "~/components/PostQuizSummary";
import PracticeRecommendations from "~/components/PracticeRecommendations";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface QuizSettings {
    timer_enabled: boolean;
    default_time_limit: number;
    shuffle_questions: boolean;
    shuffle_answers: boolean;
    allow_retries: boolean;
    max_retries: number;
    show_correct_answer: boolean;
    show_explanation: boolean;
    show_distribution: boolean;
    difficulty_adaptation: boolean;
    peer_discussion_enabled: boolean;
    peer_discussion_trigger: "always" | "high_confidence_wrong" | "never";
    allow_teacher_intervention: boolean;
    sync_pacing_available: boolean;
}

interface GameState {
    id: string;
    status: "lobby" | "question" | "results" | "finished";
    current_question_index: number;
    total_questions: number;
    quiz_title: string;
    sync_mode: boolean;
    quiz_settings?: QuizSettings;
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

    // Async mode: track current question index independently
    const [asyncQuestionIndex, setAsyncQuestionIndex] = useState<number>(() => {
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem(`quiz_progress_${gameId}`);
            return saved ? parseInt(saved, 10) : 0;
        }
        return 0;
    });

    // AI Host state
    const [hostMessage, setHostMessage] = useState<string>("");
    const [hostLoading, setHostLoading] = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);
    const [streak, setStreak] = useState(0);

    // Adaptive learning state
    const [confidence, setConfidence] = useState<number>(70);
    const [reasoning, setReasoning] = useState<string>("");
    const [showReasoning, setShowReasoning] = useState(false);
    const [showConfirmStep, setShowConfirmStep] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState<string | null>(null);

    // AI Peer Discussion state
    const [showPeerDiscussion, setShowPeerDiscussion] = useState(false);

    // Learning Analytics state
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Post-quiz flow stages: "summary" -> "exit_ticket" -> "practice" -> "complete"
    const [postQuizStage, setPostQuizStage] = useState<"summary" | "exit_ticket" | "practice" | "complete">("summary");
    const [analyticsData, setAnalyticsData] = useState<{
        quadrants?: { confident_correct: number; confident_incorrect: number; uncertain_correct: number; uncertain_incorrect: number };
        calibration?: { status: "overconfident" | "underconfident" | "well_calibrated"; gap: number; message: string };
        avgConfidence?: number;
        misconceptionCount?: number;
        weakConcepts?: string[];
    } | null>(null);
    const [practiceQuestions, setPracticeQuestions] = useState<Array<{
        id: string;
        question_text: string;
        options: { [key: string]: string };
        correct_answer: string;
        explanation: string;
        concept: string;
    }>>([]);

    // Exit Ticket state (using new student learning API)
    const [exitTicket, setExitTicket] = useState<{
        id: string;
        target_concept: string;
        micro_lesson: string;
        encouragement?: string;
        question_prompt: string;
        question_options: string[];
        correct_answer: string;
        hint?: string;
        is_completed: boolean;
    } | null>(null);
    const [exitTicketLoading, setExitTicketLoading] = useState(false);
    const [showExitTicket, setShowExitTicket] = useState(false);
    const [exitTicketAnswer, setExitTicketAnswer] = useState<string | null>(null);
    const [exitTicketResult, setExitTicketResult] = useState<{is_correct: boolean; hint?: string} | null>(null);

    // Track student responses for exit ticket generation
    const [studentResponses, setStudentResponses] = useState<Array<{
        concept: string;
        is_correct: boolean;
        confidence: number;
        question_text: string;
    }>>([]);

    const playerId = typeof window !== "undefined"
        ? sessionStorage.getItem("playerId")
        : null;
    const nickname = typeof window !== "undefined"
        ? sessionStorage.getItem("nickname")
        : null;

    // WebSocket for real-time game updates (timer sync, question transitions)
    // Only needed for sync mode - async games work via HTTP polling
    const { isConnected, timeRemaining: wsTimeRemaining } = useGameSocket({
        gameId,
        playerId: playerId || undefined,
        enabled: !!playerId && game?.sync_mode !== false,
        onGameStarted: () => {
            // Game started - fetch latest state
            fetchGame();
        },
        onQuestionStart: (data) => {
            // New question arrived via WebSocket - update state immediately
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
            } : null);
            setSelectedAnswer(null);
            setHasAnswered(false);
            setQuestionStartTime(Date.now());
            setHostMessage("");
            setShowExplanation(false);
            setTimeLeft(data.time_limit);
            // Reset adaptive learning state
            setConfidence(70);
            setReasoning("");
            setShowReasoning(false);
            setShowConfirmStep(false);
            setShowPeerDiscussion(false);
            setLastCorrectAnswer(null);
        },
        onTimerTick: (data) => {
            // Synchronized timer from server - use this for accurate countdown
            if (!hasAnswered) {
                setTimeLeft(data.time_remaining);
            }
        },
        onQuestionEnd: () => {
            // Time's up
            setTimeLeft(0);
        },
        onResults: () => {
            // Results are being shown - fetch player state
            setGame(prev => prev ? { ...prev, status: "results" } : null);
            fetchPlayerState();
        },
        onGameEnd: () => {
            // Game finished
            setGame(prev => prev ? { ...prev, status: "finished" } : null);
            fetchPlayerState();
        },
        onHostDisconnected: () => {
            console.log("Host disconnected from game");
        },
        onError: (error) => {
            console.error("WebSocket error:", error);
        },
    });

    // Fetch AI host reaction with timeout
    const fetchHostReaction = useCallback(async (
        isCorrect: boolean,
        questionText: string,
        theirAnswer: string,
        correctAnswer: string,
        options: { [key: string]: string },
        timeTaken: number
    ) => {
        setHostLoading(true);

        // Set fallback message immediately for async mode or if AI fails
        const fallbackMessage = isCorrect
            ? "Correct! Well done! 🎯"
            : "Not quite, but keep going! 💪";

        try {
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

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
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                setHostMessage(data.reaction || fallbackMessage);
                if (!isCorrect) {
                    setShowExplanation(true);
                }
            } else {
                // Non-OK response - use fallback
                setHostMessage(fallbackMessage);
            }
        } catch (error) {
            console.error("Failed to get host reaction:", error);
            // Fallback message on error or timeout
            setHostMessage(fallbackMessage);
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
            // Always pass question_index - backend will use it for async mode, ignore for sync mode
            const url = `${API_URL}/games/${gameId}/player?question_index=${asyncQuestionIndex}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();

                // Check if question changed (for sync mode)
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
    }, [gameId, game, asyncQuestionIndex]);

    // Move to next question in async mode
    const nextQuestion = useCallback(() => {
        if (!game) return;
        const nextIndex = asyncQuestionIndex + 1;
        if (nextIndex < game.total_questions) {
            setAsyncQuestionIndex(nextIndex);
            // Save progress to sessionStorage
            if (typeof window !== "undefined") {
                sessionStorage.setItem(`quiz_progress_${gameId}`, nextIndex.toString());
            }
            setSelectedAnswer(null);
            setHasAnswered(false);
            setHostMessage("");
            setShowExplanation(false);
            setQuestionStartTime(Date.now());
        }
    }, [game, asyncQuestionIndex, gameId]);

    useEffect(() => {
        if (!playerId) {
            router.push("/join");
            return;
        }

        fetchGame();

        // Use WebSocket for real-time updates when connected
        // Fall back to polling at reduced frequency when not connected
        const pollInterval = isConnected ? 5000 : 1000;  // 5s with WS, 1s without

        const interval = setInterval(() => {
            fetchGame();
            if (hasAnswered || game?.status === "results") {
                fetchPlayerState();
            }
        }, pollInterval);

        return () => clearInterval(interval);
    }, [fetchGame, fetchPlayerState, playerId, router, hasAnswered, game?.status, isConnected]);

    // Timer initialization - only if timer is enabled in quiz settings
    useEffect(() => {
        if (game?.status === "question" && game.current_question && !hasAnswered) {
            // Only set timer if quiz_settings.timer_enabled is true
            const timerEnabled = game.quiz_settings?.timer_enabled ?? false;
            if (timerEnabled) {
                setTimeLeft(game.current_question.time_limit);
            } else {
                setTimeLeft(null); // No timer for async-first mode
            }
            setQuestionStartTime(Date.now());
        }
    }, [game?.current_question_index, game?.quiz_settings?.timer_enabled]);

    // Timer countdown
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0 || hasAnswered) return;

        const timer = setTimeout(() => {
            setTimeLeft(timeLeft - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [timeLeft, hasAnswered]);

    // Step 1: Select answer - shows confidence slider
    const selectAnswer = (answer: string) => {
        if (hasAnswered || !game?.current_question) return;
        setSelectedAnswer(answer);
        setShowConfirmStep(true);
    };

    // Step 2: Confirm answer with confidence - submits to backend
    const confirmAnswer = async () => {
        if (hasAnswered || !playerId || !game?.current_question || !selectedAnswer) return;

        setHasAnswered(true);
        setShowConfirmStep(false);

        const timeTaken = (Date.now() - questionStartTime) / 1000;

        try {
            const response = await fetch(`${API_URL}/games/${gameId}/answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    player_id: playerId,
                    question_index: game.current_question_index,
                    answer: selectedAnswer,
                    time_taken: timeTaken,
                    confidence: confidence,
                    reasoning: reasoning || undefined,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                const isCorrect = result.is_correct;

                // Store correct answer for peer discussion
                setLastCorrectAnswer(result.correct_answer);

                // Track response for exit ticket generation
                setStudentResponses(prev => [...prev, {
                    concept: game.quiz_title || "general",
                    is_correct: isCorrect,
                    confidence: confidence,
                    question_text: game.current_question?.question_text || "",
                }]);

                // Update streak
                if (isCorrect) {
                    setStreak(prev => prev + 1);
                } else {
                    setStreak(0);
                    // Show peer discussion based on quiz settings
                    const peerEnabled = game.quiz_settings?.peer_discussion_enabled ?? true;
                    const peerTrigger = game.quiz_settings?.peer_discussion_trigger ?? "high_confidence_wrong";

                    if (peerEnabled) {
                        if (peerTrigger === "always") {
                            setShowPeerDiscussion(true);
                        } else if (peerTrigger === "high_confidence_wrong" && confidence >= 60) {
                            setShowPeerDiscussion(true);
                        }
                        // "never" - don't show peer discussion
                    }
                }

                // Update player state immediately from response
                setPlayerState(prev => ({
                    ...prev,
                    score: result.total_score,
                    last_answer_correct: isCorrect,
                    last_answer_points: result.points_earned,
                    rank: prev?.rank || 1,
                }));

                // Fetch AI host reaction with correct answer from backend
                fetchHostReaction(
                    isCorrect,
                    game.current_question.question_text,
                    selectedAnswer,
                    result.correct_answer,
                    game.current_question.options,
                    timeTaken
                );
            } else {
                setHostMessage("Answer submitted!");
            }
        } catch (error) {
            console.error("Failed to submit answer:", error);
        }
    };

    // Legacy function for backward compatibility
    const submitAnswer = async (answer: string) => {
        selectAnswer(answer);
    };

    // Fetch personalized exit ticket using new student learning API
    const fetchExitTicket = async () => {
        if (!playerId || !game) return;

        setExitTicketLoading(true);
        try {
            const response = await fetch(`${API_URL}/student-learning/exit-ticket`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_name: nickname || "Student",
                    game_id: gameId,
                    responses: studentResponses,
                    concepts: [game.quiz_title || "general"]
                })
            });

            if (response.ok) {
                const data = await response.json();
                setExitTicket(data);
                setShowExitTicket(true);
            }
        } catch (error) {
            console.error("Failed to fetch exit ticket:", error);
        } finally {
            setExitTicketLoading(false);
        }
    };

    // Submit answer to exit ticket follow-up question
    const submitExitTicketAnswer = async (answer: string) => {
        if (!exitTicket) return;

        setExitTicketAnswer(answer);
        try {
            const response = await fetch(`${API_URL}/student-learning/exit-ticket/answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticket_id: exitTicket.id,
                    student_answer: answer,
                })
            });

            if (response.ok) {
                const result = await response.json();
                setExitTicketResult(result);
                setExitTicket(prev => prev ? { ...prev, is_completed: true } : null);
            }
        } catch (error) {
            console.error("Failed to submit exit ticket answer:", error);
        }
    };

    // Export study guide
    const exportStudyGuide = async () => {
        try {
            const url = `${API_URL}/games/${gameId}/export?format=md`;
            const response = await fetch(url);
            if (response.ok) {
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = `${game?.quiz_title || "quiz"}-results.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
            }
        } catch (error) {
            console.error("Failed to export:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <div className="text-center">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-sky-400" />
                    <p className="mt-4 text-gray-400">Loading game...</p>
                </div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
                <div className="text-xl text-white">Game not found</div>
                <button
                    onClick={() => router.push("/join")}
                    className="mt-4 rounded-full bg-sky-600 px-6 py-3 font-bold text-white shadow-lg hover:bg-sky-500 transition-colors"
                >
                    Join Another Game
                </button>
            </div>
        );
    }

    // Lobby - waiting for game to start
    // Async-first: students can start immediately without waiting for teacher
    // Sync mode: students wait for teacher to start the game
    if (game.status === "lobby") {
        // In async-first mode (sync_mode=false), skip lobby and go directly to questions
        if (game.sync_mode === false) {
            // This shouldn't render - fetchGame should return "question" status for async
            // But just in case, show a "ready to start" state
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
                    <div className="mb-8">
                        <Sparkles className="h-20 w-20 text-sky-400" />
                    </div>
                    <h1 className="mb-4 text-4xl font-bold text-white">
                        Hey {nickname}! 👋
                    </h1>
                    <p className="mb-8 text-xl text-gray-400">
                        Ready to start your quiz
                    </p>
                    <div className="text-center">
                        <p className="text-gray-500 text-sm mb-4">
                            {game.quiz_settings?.timer_enabled
                                ? `Timer: ${game.quiz_settings.default_time_limit}s per question`
                                : "Self-paced - take your time!"}
                        </p>
                        <Loader2 className="h-6 w-6 animate-spin text-sky-400 mx-auto" />
                        <p className="text-gray-400 text-sm mt-2">Loading questions...</p>
                    </div>
                </div>
            );
        }

        // Sync mode: wait for teacher
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
                <div className="mb-8 animate-bounce">
                    <Sparkles className="h-20 w-20 text-sky-400" />
                </div>
                <h1 className="mb-4 text-4xl font-bold text-white">
                    Hey {nickname}! 👋
                </h1>
                <p className="mb-8 text-xl text-gray-400">
                    Get ready to play...
                </p>
                <div className="flex items-center gap-3 rounded-full bg-gray-900 px-6 py-3 border border-gray-800">
                    <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
                    <span className="text-white">Waiting for host to start</span>
                </div>
            </div>
        );
    }

    // Game finished
    if (game.status === "finished") {
        return (
            <div className="min-h-screen bg-gray-950 p-4 overflow-auto">
                {showAnalytics && playerId ? (
                    <div className="max-w-2xl mx-auto py-8">
                        <button
                            onClick={() => setShowAnalytics(false)}
                            className="mb-4 text-gray-400 hover:text-white flex items-center gap-2"
                        >
                            ← Back to Results
                        </button>
                        <LearningAnalytics gameId={gameId} playerId={playerId} />
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={() => router.push("/join")}
                                className="rounded-full bg-sky-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-sky-500 transition-colors"
                            >
                                Play Again
                            </button>
                        </div>
                    </div>
                ) : showExitTicket && exitTicket ? (
                    <div className="max-w-2xl mx-auto py-8">
                        <button
                            onClick={() => setShowExitTicket(false)}
                            className="mb-4 text-gray-400 hover:text-white flex items-center gap-2"
                        >
                            ← Back to Results
                        </button>

                        {/* Exit Ticket Content */}
                        <div className="space-y-4">
                            <div className="text-center mb-6">
                                <GraduationCap className="h-12 w-12 text-yellow-400 mx-auto mb-2" />
                                <h2 className="text-2xl font-bold text-white">Your Personalized Exit Ticket</h2>
                                <p className="text-white/70 mt-1">Focus: {exitTicket.target_concept}</p>
                            </div>

                            {/* Micro Lesson */}
                            <div className="bg-sky-500/20 rounded-xl p-4 border border-sky-500/30">
                                <h3 className="font-bold text-sky-300 mb-2 flex items-center gap-2">
                                    <Sparkles className="h-5 w-5" /> Quick Review
                                </h3>
                                <p className="text-gray-200 text-sm">{exitTicket.micro_lesson}</p>
                                {exitTicket.encouragement && (
                                    <p className="text-cyan-300 text-sm mt-2 italic">{exitTicket.encouragement}</p>
                                )}
                            </div>

                            {/* Follow-up Question */}
                            <div className="bg-purple-500/20 rounded-xl p-4 border border-purple-500/30">
                                <h3 className="font-bold text-purple-300 mb-2">Check Your Understanding</h3>
                                <p className="text-white mb-3">{exitTicket.question_prompt}</p>
                                <div className="space-y-2">
                                    {exitTicket.question_options.map((opt, i) => {
                                        const optLetter = opt.charAt(0);
                                        const isSelected = exitTicketAnswer === optLetter;
                                        const showResult = exitTicketResult !== null;
                                        const isCorrect = exitTicket.correct_answer === optLetter;

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => !exitTicket.is_completed && submitExitTicketAnswer(optLetter)}
                                                disabled={exitTicket.is_completed}
                                                className={`w-full text-left rounded-lg px-4 py-2 text-white text-sm transition-colors ${
                                                    showResult
                                                        ? isCorrect
                                                            ? "bg-green-500/30 border border-green-500"
                                                            : isSelected && !exitTicketResult?.is_correct
                                                            ? "bg-red-500/30 border border-red-500"
                                                            : "bg-white/10"
                                                        : isSelected
                                                        ? "bg-white/30 border border-white"
                                                        : "bg-white/10 hover:bg-white/20"
                                                } ${exitTicket.is_completed ? "cursor-default" : "cursor-pointer"}`}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Result feedback */}
                                {exitTicketResult && (
                                    <div className={`mt-3 p-3 rounded-lg ${
                                        exitTicketResult.is_correct
                                            ? "bg-green-500/20 border border-green-500/30"
                                            : "bg-orange-500/20 border border-orange-500/30"
                                    }`}>
                                        {exitTicketResult.is_correct ? (
                                            <p className="text-green-300 flex items-center gap-2">
                                                <Check className="h-5 w-5" /> Excellent! You got it!
                                            </p>
                                        ) : (
                                            <div>
                                                <p className="text-orange-300">Not quite. The correct answer is {exitTicket.correct_answer}.</p>
                                                {exitTicket.hint && (
                                                    <p className="text-white/70 text-sm mt-2">
                                                        <Sparkles className="inline h-4 w-4 mr-1" />
                                                        {exitTicket.hint}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Link to learning dashboard */}
                            <Link
                                href="/student/learning"
                                className="flex items-center justify-center gap-2 bg-gray-900 rounded-xl p-4 border border-gray-800 text-white hover:bg-gray-800 transition-colors"
                            >
                                <BookOpen className="h-5 w-5" />
                                View All Your Exit Tickets
                                <ExternalLink className="h-4 w-4" />
                            </Link>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 items-center">
                            <button
                                onClick={() => router.push("/join")}
                                className="rounded-full bg-sky-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-sky-500 transition-colors"
                            >
                                Play Again
                            </button>
                        </div>
                    </div>
                ) : postQuizStage === "summary" ? (
                    <div className="flex min-h-[90vh] flex-col items-center justify-center py-8">
                        <PostQuizSummary
                            score={playerState?.score || 0}
                            totalQuestions={game.total_questions}
                            correctAnswers={playerState?.correct_answers || Math.floor((playerState?.score || 0) / 100)}
                            rank={playerState?.rank}
                            totalPlayers={undefined}
                            accuracy={game.total_questions > 0 ? Math.round(((playerState?.correct_answers || Math.floor((playerState?.score || 0) / 100)) / game.total_questions) * 100) : 0}
                            avgConfidence={analyticsData?.avgConfidence}
                            quadrants={analyticsData?.quadrants}
                            calibration={analyticsData?.calibration}
                            misconceptionCount={analyticsData?.misconceptionCount}
                            onContinue={() => {
                                fetchExitTicket();
                                setPostQuizStage("exit_ticket");
                            }}
                        />
                    </div>
                ) : postQuizStage === "practice" ? (
                    <div className="flex min-h-[90vh] flex-col items-center justify-center py-8">
                        <PracticeRecommendations
                            weakConcepts={analyticsData?.weakConcepts || []}
                            questions={practiceQuestions}
                            onComplete={(results) => {
                                console.log("Practice completed:", results);
                                setPostQuizStage("complete");
                            }}
                            onSkip={() => setPostQuizStage("complete")}
                        />
                    </div>
                ) : postQuizStage === "complete" ? (
                    <div className="flex min-h-[90vh] flex-col items-center justify-center py-8">
                        <div className="text-center max-w-md">
                            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/20 mb-4">
                                <Check className="h-8 w-8 text-green-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">All Done!</h2>
                            <p className="text-gray-400 mb-6">
                                Great job completing the quiz. Your weak areas have been added to your adaptive review queue.
                            </p>
                            <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 p-4 mb-6">
                                <p className="text-sm text-sky-300">
                                    <Sparkles className="inline h-4 w-4 mr-1" />
                                    Come back tomorrow for spaced repetition review!
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setShowAnalytics(true)}
                                    className="rounded-xl bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-700 flex items-center justify-center gap-2"
                                >
                                    <BarChart3 className="h-5 w-5" />
                                    View Full Analytics
                                </button>
                                <Link
                                    href="/student/learning"
                                    className="rounded-xl bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-500 flex items-center justify-center gap-2"
                                >
                                    <BookOpen className="h-5 w-5" />
                                    Learning Dashboard
                                </Link>
                                <button
                                    onClick={() => router.push("/join")}
                                    className="rounded-xl border border-gray-700 px-6 py-3 font-medium text-gray-300 hover:bg-gray-800 flex items-center justify-center gap-2"
                                >
                                    Play Again
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-[90vh] flex-col items-center justify-center">
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
                                <p className="text-2xl text-gray-300">
                                    {playerState.score.toLocaleString()} points
                                </p>
                            </div>
                        )}
                        <div className="flex flex-col gap-3 w-full max-w-sm">
                            <button
                                onClick={() => setShowAnalytics(true)}
                                className="rounded-full bg-sky-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-sky-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <BarChart3 className="h-5 w-5" />
                                View Learning Insights
                            </button>
                            <button
                                onClick={fetchExitTicket}
                                disabled={exitTicketLoading}
                                className="rounded-full bg-amber-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-amber-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {exitTicketLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <GraduationCap className="h-5 w-5" />
                                )}
                                Get Exit Ticket
                            </button>
                            <button
                                onClick={exportStudyGuide}
                                className="rounded-full bg-gray-800 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 border border-gray-700"
                            >
                                <Download className="h-5 w-5" />
                                Download Results
                            </button>
                            <Link
                                href="/student/learning"
                                className="rounded-full bg-purple-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-purple-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <BookOpen className="h-5 w-5" />
                                My Learning Dashboard
                            </Link>
                            <button
                                onClick={() => router.push("/join")}
                                className="rounded-full bg-emerald-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-emerald-500 transition-colors"
                            >
                                Play Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Results - after answering (show AI host message)
    if (hasAnswered && hostMessage) {
        return (
            <div className="min-h-screen bg-gray-950 p-4 overflow-auto">
                <div className="flex flex-col items-center justify-center min-h-[90vh] max-w-md mx-auto">
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

                    {/* Confidence feedback */}
                    {!playerState?.last_answer_correct && confidence >= 70 && (
                        <div className="mb-4 rounded-xl bg-orange-500/20 border border-orange-500/30 px-4 py-2 text-orange-200 text-sm flex items-center gap-2">
                            <Brain className="h-4 w-4" />
                            <span>High confidence but incorrect - let's review this concept!</span>
                        </div>
                    )}

                    {/* AI Peer Discussion for misconceptions */}
                    {showPeerDiscussion && game?.current_question && lastCorrectAnswer && selectedAnswer && playerId && (
                        <div className="mb-6 w-full">
                            <PeerDiscussion
                                gameId={gameId}
                                playerId={playerId}
                                playerName={nickname || "Player"}
                                question={{
                                    question_text: game.current_question.question_text,
                                    options: game.current_question.options,
                                }}
                                questionIndex={game.current_question_index}
                                studentAnswer={selectedAnswer}
                                studentReasoning={reasoning}
                                correctAnswer={lastCorrectAnswer}
                                isCorrect={false}
                                confidence={confidence}
                                onComplete={() => setShowPeerDiscussion(false)}
                            />
                        </div>
                    )}

                    {/* AI Host Message */}
                    {!showPeerDiscussion && (
                        <div className="mb-8 w-full rounded-2xl bg-gray-900 p-6 border border-gray-800">
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
                    )}

                    {/* Current Score */}
                    <div className="rounded-2xl bg-gray-900 px-8 py-4 text-center border border-gray-800 w-full">
                        <p className="text-gray-400 text-sm">Your Score</p>
                        <p className="text-3xl font-bold text-white">
                            {playerState?.score.toLocaleString() || 0}
                        </p>
                        {playerState && (
                            <p className="mt-1 text-gray-400">Rank #{playerState.rank}</p>
                        )}
                    </div>

                    {/* FOR ASYNC MODE: Show Next Question Button (always visible, even during peer discussion) */}
                    {game?.sync_mode === false && (
                        <div className="mt-8">
                            {asyncQuestionIndex + 1 < game.total_questions ? (
                                <button
                                    onClick={() => {
                                        nextQuestion();
                                        setConfidence(70);
                                        setReasoning("");
                                        setShowReasoning(false);
                                        setShowPeerDiscussion(false);
                                    }}
                                    className="rounded-full bg-white px-8 py-4 text-lg font-bold text-purple-600 shadow-xl hover:scale-105 transition-transform"
                                >
                                    Next Question →
                                </button>
                            ) : (
                                <button
                                    onClick={() => router.push("/join")}
                                    className="rounded-full bg-emerald-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-emerald-500 transition-colors"
                                >
                                    Finish Quiz
                                </button>
                            )}
                        </div>
                    )}

                    {/* FOR SYNC MODE: Keep existing waiting message */}
                    {game?.sync_mode !== false && !showPeerDiscussion && (
                        <div className="mt-8 flex items-center gap-2 text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Waiting for next question...</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Waiting for result after answering
    if (hasAnswered && !hostMessage) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
                <Loader2 className="h-12 w-12 animate-spin text-sky-400 mb-4" />
                <p className="text-gray-400">Checking your answer...</p>
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

    // Show confidence confirmation step
    if (showConfirmStep && selectedAnswer && game.current_question) {
        return (
            <div className="flex min-h-screen flex-col bg-gray-950 p-4">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-full bg-gray-900 px-4 py-2 border border-gray-800">
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

                {/* Selected Answer Display */}
                <div className="mb-6 rounded-2xl bg-gray-900 p-4 border border-gray-800">
                    <p className="text-gray-400 text-sm mb-2">Your answer:</p>
                    <div className={`flex items-center gap-3 rounded-xl bg-gradient-to-r ${
                        colors[Object.keys(game.current_question.options).indexOf(selectedAnswer)]
                    } p-4`}>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-xl">
                            {shapes[Object.keys(game.current_question.options).indexOf(selectedAnswer)]}
                        </span>
                        <span className="font-bold text-white">
                            {game.current_question.options[selectedAnswer]}
                        </span>
                    </div>
                </div>

                {/* Confidence Slider */}
                <div className="mb-6 rounded-2xl bg-gray-900 p-6 border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                        <Brain className="h-5 w-5 text-white" />
                        <h3 className="font-bold text-white">How confident are you?</h3>
                    </div>
                    <ConfidenceSlider
                        value={confidence}
                        onChange={setConfidence}
                        showLabels={true}
                    />
                </div>

                {/* Optional Reasoning Input */}
                <div className="mb-6">
                    <button
                        onClick={() => setShowReasoning(!showReasoning)}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-3"
                    >
                        {showReasoning ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="text-sm">Why did you choose this? (optional)</span>
                    </button>
                    {showReasoning && (
                        <textarea
                            value={reasoning}
                            onChange={(e) => setReasoning(e.target.value)}
                            placeholder="Share your thinking... (helps with personalized feedback)"
                            className="w-full bg-gray-800 rounded-xl p-4 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
                            rows={3}
                        />
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-auto">
                    <button
                        onClick={() => {
                            setShowConfirmStep(false);
                            setSelectedAnswer(null);
                        }}
                        className="flex-1 rounded-xl bg-gray-800 py-4 font-bold text-white hover:bg-gray-700 transition-colors border border-gray-700"
                    >
                        Change Answer
                    </button>
                    <button
                        onClick={confirmAnswer}
                        className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 py-4 font-bold text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-transform"
                    >
                        Submit Answer
                    </button>
                </div>

                {/* Score footer */}
                <div className="mt-4 flex justify-center">
                    <div className="rounded-full bg-gray-900 px-6 py-2 border border-gray-800">
                        <span className="text-gray-400">Score: </span>
                        <span className="font-bold text-white">
                            {playerState?.score?.toLocaleString() || 0}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-gray-950 p-4">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="rounded-full bg-gray-900 px-4 py-2 border border-gray-800">
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
                                onClick={() => selectAnswer(key)}
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
                <div className="rounded-full bg-gray-900 px-6 py-2 border border-gray-800">
                    <span className="text-gray-400">Score: </span>
                    <span className="font-bold text-white">
                        {playerState?.score?.toLocaleString() || 0}
                    </span>
                </div>
            </div>
        </div>
    );
}

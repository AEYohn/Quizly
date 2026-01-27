"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, Trophy, Loader2, Check, X, Sparkles, Zap, Star, ChevronDown, ChevronUp, Brain, MessageCircle, BarChart3, GraduationCap, Download, BookOpen, ExternalLink, LogOut, FileText, Pencil, AlertCircle, Lightbulb, UserPlus, Target } from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useGameSocket } from "~/lib/useGameSocket";
import ConfidenceSlider from "~/components/ConfidenceSlider";
import PeerDiscussion from "~/components/PeerDiscussion";
import LearningAnalytics from "~/components/LearningAnalytics";
import PostQuizSummary from "~/components/PostQuizSummary";
import PracticeRecommendations from "~/components/PracticeRecommendations";
import MathText from "~/components/MathText";

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
        image_url?: string;
    };
}

interface PlayerState {
    score: number;
    rank: number;
    last_answer_correct: boolean | null;
    last_answer_points: number;
    correct_answers?: number;
}

// Flashcard component for study packet
function FlashcardComponent({ front, back, index }: { front: string; back: string; index: number }) {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer"
        >
            <div className={`relative rounded-lg p-4 transition-all duration-200 ${
                isFlipped
                    ? "bg-gray-800 border border-gray-700"
                    : "bg-gray-900 border border-gray-800 hover:border-gray-700"
            }`}>
                <p className="text-white">{front}</p>
                {isFlipped && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-gray-400">{back}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PlayGamePage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.id as string;
    const { isSignedIn } = useUser();

    const [game, setGame] = useState<GameState | null>(null);
    const [playerState, setPlayerState] = useState<PlayerState | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [questionStartTime, setQuestionStartTime] = useState<number>(0);
    const [localCorrectCount, setLocalCorrectCount] = useState(0);
    // Track last answer correctness locally (not overwritten by backend fetch)
    const [lastAnswerWasCorrect, setLastAnswerWasCorrect] = useState<boolean | null>(null);

    // Async mode: track current question index independently
    // Initialize to 0, then restore from sessionStorage once we have playerId
    const [asyncQuestionIndex, setAsyncQuestionIndex] = useState<number>(0);

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
    // Track when quiz is manually completed to stop polling (use ref to avoid stale closure)
    const isQuizCompletedRef = useRef(false);
    // Refs for volatile values to avoid polling useEffect dependency issues (initialized with defaults, synced in useEffect)
    const gameStatusRef = useRef<string | undefined>(undefined);
    const isConnectedRef = useRef<boolean>(false);
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
    interface PracticeQuestion {
        prompt: string;
        options: string[];
        correct_answer: string;
        hint?: string;
        explanation?: string;
        difficulty?: "foundation" | "core" | "extension";
    }
    interface StudyNotes {
        key_concepts?: string[];
        common_mistakes?: string[];
        strategies?: string[];
        memory_tips?: string[];
    }
    const [exitTicket, setExitTicket] = useState<{
        id: string;
        target_concept: string;
        study_notes?: StudyNotes;
        micro_lesson: string;
        encouragement?: string;
        question_prompt: string;
        question_options: string[];
        correct_answer: string;
        hint?: string;
        is_completed: boolean;
        // Extended fields for multi-question practice
        practice_questions?: PracticeQuestion[];
        flashcards?: { front: string; back: string }[];
        misconceptions?: { type: string; description: string; correction: string }[];
    } | null>(null);
    // Track which section of the study packet the student is viewing
    const [studyPacketSection, setStudyPacketSection] = useState<"notes" | "homework" | "review">("notes");
    const [exitTicketLoading, setExitTicketLoading] = useState(false);
    const [showExitTicket, setShowExitTicket] = useState(false);
    const [exitTicketAnswer, setExitTicketAnswer] = useState<string | null>(null);
    const [exitTicketResult, setExitTicketResult] = useState<{is_correct: boolean; hint?: string} | null>(null);
    // Multi-question practice state
    const [practiceQuestionIndex, setPracticeQuestionIndex] = useState(0);
    const [practiceAnswers, setPracticeAnswers] = useState<Record<number, { answer: string; correct: boolean }>>({});

    // Track student responses for exit ticket generation
    const [studentResponses, setStudentResponses] = useState<Array<{
        concept: string;
        is_correct: boolean;
        confidence: number;
        question_text: string;
        student_answer: string;
        correct_answer: string;
        reasoning?: string;
        options?: Record<string, string>;
        time_taken_ms?: number;
        had_peer_discussion?: boolean;
    }>>([]);

    const playerId = typeof window !== "undefined"
        ? sessionStorage.getItem("playerId")
        : null;
    const nickname = typeof window !== "undefined"
        ? sessionStorage.getItem("nickname")
        : null;

    // Handle exit quiz - go to dashboard if signed in, join page if guest
    const handleExitQuiz = () => {
        if (isSignedIn) {
            router.push("/student/dashboard");
        } else {
            router.push("/join");
        }
    };

    // Handle sign-up for students - pre-set role and redirect
    const handleStudentSignUp = () => {
        console.log("[Play Page] handleStudentSignUp called", { playerId, gameId });
        localStorage.setItem("quizly_pending_role", "student");
        // Store guest data for linking after sign-up
        if (playerId) {
            localStorage.setItem("quizly_pending_player_id", playerId);
            console.log("[Play Page] Stored pending player_id:", playerId);
        } else {
            console.log("[Play Page] No playerId to store!");
        }
        localStorage.setItem("quizly_pending_game_id", gameId);
        console.log("[Play Page] Stored pending game_id:", gameId);
        // Store exit ticket ID for linking after sign-up
        if (exitTicket?.id) {
            localStorage.setItem("quizly_pending_exit_ticket_id", exitTicket.id);
            console.log("[Play Page] Stored pending exit_ticket_id:", exitTicket.id);
        }
        router.push("/sign-up");
    };

    // Back navigation handler - warn user if they try to leave during quiz
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            // Only show warning if quiz is in progress (not finished or in post-quiz flow)
            if (game?.status === "question" || game?.status === "results") {
                e.preventDefault();
                const confirmLeave = window.confirm(
                    "Are you sure you want to leave the quiz? Your progress will be saved but you'll exit the current session."
                );
                if (confirmLeave) {
                    router.push(isSignedIn ? "/student/dashboard" : "/");
                } else {
                    // Push state back to prevent actual navigation
                    window.history.pushState(null, "", window.location.href);
                }
            }
        };

        // Push initial state so we can intercept back navigation
        window.history.pushState(null, "", window.location.href);
        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [game?.status, router]);

    // WebSocket for real-time game updates (timer sync, question transitions)
    // Only needed for sync mode - async games work via HTTP polling
    const { isConnected, timeRemaining: wsTimeRemaining } = useGameSocket({
        gameId,
        playerId: playerId || undefined,
        enabled: !!playerId && game?.sync_mode === true,
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
            setLastAnswerWasCorrect(null);
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
            // Sync nickname to localStorage so student dashboard can find their data
            if (nickname) {
                localStorage.setItem("quizly_student_name", nickname);
                const recent = JSON.parse(localStorage.getItem("quizly_recent_students") || "[]");
                const updated = [nickname, ...recent.filter((n: string) => n !== nickname)].slice(0, 5);
                localStorage.setItem("quizly_recent_students", JSON.stringify(updated));
            }
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

    // Fetch player state - preserve local last_answer_correct to avoid race condition
    const fetchPlayerState = useCallback(async () => {
        if (!playerId) return;

        try {
            const response = await fetch(
                `${API_URL}/games/${gameId}/players/${playerId}/state`
            );
            if (response.ok) {
                const data = await response.json();
                // Preserve local last_answer_correct if it's set (backend might not have it)
                setPlayerState(prev => ({
                    ...data,
                    last_answer_correct: prev?.last_answer_correct ?? data.last_answer_correct ?? null,
                    last_answer_points: prev?.last_answer_points ?? data.last_answer_points ?? 0,
                }));
            }
        } catch (error) {
            console.error("Failed to fetch player state:", error);
        }
    }, [gameId, playerId]);

    const fetchGame = useCallback(async () => {
        // Don't fetch if quiz is completed (check ref to avoid stale closure)
        if (isQuizCompletedRef.current) {
            return;
        }

        try {
            // Always pass question_index - backend will use it for async mode, ignore for sync mode
            const url = `${API_URL}/games/${gameId}/player?question_index=${asyncQuestionIndex}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();

                // Don't update state if quiz was completed while fetching
                if (isQuizCompletedRef.current) {
                    return;
                }

                // Only update game state if something meaningful changed
                setGame(prevGame => {
                    // Skip update if nothing changed (prevents unnecessary re-renders)
                    if (prevGame &&
                        prevGame.status === data.status &&
                        prevGame.current_question_index === data.current_question_index) {
                        return prevGame;
                    }

                    // Check if question changed (for SYNC mode only - async mode manages its own state)
                    const isSyncMode = data.sync_mode !== false;
                    if (isSyncMode && prevGame && data.current_question_index !== prevGame.current_question_index) {
                        setSelectedAnswer(null);
                        setHasAnswered(false);
                        setQuestionStartTime(Date.now());
                        setHostMessage("");
                        setShowExplanation(false);
                        setLastAnswerWasCorrect(null);
                        if (data.current_question) {
                            setTimeLeft(data.current_question.time_limit);
                        }
                    }

                    return data;
                });
            }
        } catch (error) {
            console.error("Failed to fetch game:", error);
        } finally {
            setLoading(false);
        }
    }, [gameId, asyncQuestionIndex]);

    // Move to next question in async mode
    const nextQuestion = useCallback(() => {
        if (!game) return;
        const nextIndex = asyncQuestionIndex + 1;
        if (nextIndex < game.total_questions) {
            setAsyncQuestionIndex(nextIndex);
            // Save progress to sessionStorage (tied to player session)
            if (typeof window !== "undefined" && playerId) {
                sessionStorage.setItem(`quiz_progress_${gameId}_${playerId}`, nextIndex.toString());
            }
            setSelectedAnswer(null);
            setHasAnswered(false);
            setHostMessage("");
            setShowExplanation(false);
            setQuestionStartTime(Date.now());
            setLastAnswerWasCorrect(null); // Reset for next question
        }
    }, [game, asyncQuestionIndex, gameId, playerId]);

    // Keep refs in sync with volatile values (to avoid polling useEffect dependency issues)
    useEffect(() => {
        gameStatusRef.current = game?.status;
        isConnectedRef.current = isConnected;
    }, [game?.status, isConnected]);

    // Check for completed quiz state on mount (survives back navigation)
    // Key includes both gameId AND playerId so replaying with new session works
    useEffect(() => {
        if (typeof window !== "undefined" && gameId && playerId) {
            const wasCompleted = sessionStorage.getItem(`quiz_completed_${gameId}_${playerId}`);
            if (wasCompleted === "true") {
                // If they've completed this quiz session, redirect to appropriate place
                // Don't show 0/0 summary - just take them to their dashboard or join page
                if (isSignedIn) {
                    router.push("/student/dashboard");
                } else {
                    router.push("/join");
                }
                return;
            }
        }
    }, [gameId, playerId, isSignedIn, router]);

    // Restore quiz progress from sessionStorage (tied to player session)
    useEffect(() => {
        if (typeof window !== "undefined" && gameId && playerId) {
            const saved = sessionStorage.getItem(`quiz_progress_${gameId}_${playerId}`);
            if (saved) {
                const savedIndex = parseInt(saved, 10);
                if (!isNaN(savedIndex) && savedIndex > 0) {
                    setAsyncQuestionIndex(savedIndex);
                }
            }
        }
    }, [gameId, playerId]);

    useEffect(() => {
        if (!playerId) {
            router.push("/join");
            return;
        }

        // Don't poll if quiz is manually completed
        if (isQuizCompletedRef.current) {
            return;
        }

        fetchGame();

        // Use fixed poll interval to avoid rapid re-polling from dependency changes
        // Check current connection status via ref inside interval
        const pollInterval = 3000;

        const interval = setInterval(() => {
            // Stop polling if quiz is completed (check ref)
            if (isQuizCompletedRef.current) {
                clearInterval(interval);
                return;
            }
            fetchGame();
            if (hasAnswered || gameStatusRef.current === "results") {
                fetchPlayerState();
            }
        }, pollInterval);

        return () => clearInterval(interval);
    }, [fetchGame, fetchPlayerState, playerId, router, hasAnswered]);

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

                // Track response for exit ticket generation (with rich data for AI)
                setStudentResponses(prev => [...prev, {
                    concept: game.quiz_title || "general",
                    is_correct: isCorrect,
                    confidence: confidence,
                    question_text: game.current_question?.question_text || "",
                    student_answer: `${selectedAnswer}: ${game.current_question?.options?.[selectedAnswer || ""] || selectedAnswer}`,
                    correct_answer: `${result.correct_answer}: ${game.current_question?.options?.[result.correct_answer] || result.correct_answer}`,
                    reasoning: reasoning || undefined,
                    options: game.current_question?.options || undefined,
                    time_taken_ms: timeTaken,
                    had_peer_discussion: false, // Will be updated if peer discussion occurs
                }]);

                // Update streak and local correct count
                if (isCorrect) {
                    setStreak(prev => prev + 1);
                    setLocalCorrectCount(prev => prev + 1);
                } else {
                    setStreak(0);
                    // In async mode, ALWAYS show peer discussion for wrong answers
                    // This is required for the retry-in-chat flow
                    if (game.sync_mode === false) {
                        setShowPeerDiscussion(true);
                    } else {
                        // For sync mode, respect quiz settings
                        const peerEnabled = game.quiz_settings?.peer_discussion_enabled ?? true;
                        const peerTrigger = game.quiz_settings?.peer_discussion_trigger ?? "always";
                        if (peerEnabled && peerTrigger !== "never") {
                            setShowPeerDiscussion(true);
                        }
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

                // Track correctness locally (won't be overwritten by backend fetch)
                setLastAnswerWasCorrect(isCorrect);

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
                // API returned error - allow retry
                console.error("Answer API error, status:", response.status);
                setHostMessage("Something went wrong. Please try again.");
                setHasAnswered(false); // Allow retry
            }
        } catch (error) {
            console.error("Failed to submit answer:", error);
            setHostMessage("Network error. Please try again.");
            setHasAnswered(false); // Allow retry
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
            } else {
                // Handle error response - parse error details if available
                const error = await response.json().catch(() => ({ detail: "Unknown error" }));
                console.error("Exit ticket error:", error);
                // Set exit ticket to null but still show the view so user sees a fallback
                setExitTicket(null);
                setShowExitTicket(true);
            }
        } catch (error) {
            console.error("Failed to fetch exit ticket:", error);
            // Ensure we have a defined state even on network failure
            setExitTicket(null);
            setShowExitTicket(true);
        } finally {
            setExitTicketLoading(false);
        }
    };

    // Submit answer to practice question
    const submitPracticeAnswer = (answer: string) => {
        if (!exitTicket) return;

        const questions = exitTicket.practice_questions || [];
        const currentQ = questions[practiceQuestionIndex];
        if (!currentQ) return;

        const isCorrect = answer === currentQ.correct_answer;
        setPracticeAnswers(prev => ({
            ...prev,
            [practiceQuestionIndex]: { answer, correct: isCorrect }
        }));
    };

    // Move to next practice question
    const nextPracticeQuestion = () => {
        const questions = exitTicket?.practice_questions || [];
        if (practiceQuestionIndex < questions.length - 1) {
            setPracticeQuestionIndex(prev => prev + 1);
        }
    };

    // Get current practice question
    const currentPracticeQuestion = exitTicket?.practice_questions?.[practiceQuestionIndex];
    const currentPracticeAnswer = practiceAnswers[practiceQuestionIndex];
    const totalPracticeQuestions = exitTicket?.practice_questions?.length || 0;
    const practiceComplete = Object.keys(practiceAnswers).length === totalPracticeQuestions && totalPracticeQuestions > 0;
    const practiceScore = Object.values(practiceAnswers).filter(a => a.correct).length;

    // Legacy: Submit answer to exit ticket follow-up question (for backwards compatibility)
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

    // Handle quiz completion for async mode - triggers post-quiz flow
    const handleQuizComplete = async () => {
        // Mark quiz as completed to stop polling (set ref immediately)
        isQuizCompletedRef.current = true;

        // Persist completion status to sessionStorage to survive page refreshes/back navigation
        // Key includes playerId so replaying with a new session works
        if (typeof window !== "undefined" && playerId) {
            sessionStorage.setItem(`quiz_completed_${gameId}_${playerId}`, "true");
        }

        // Fetch final player state to get accurate correct_answers count
        await fetchPlayerState();

        // Optionally notify backend that player finished (for analytics)
        try {
            await fetch(`${API_URL}/games/${gameId}/player-finish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ player_id: playerId })
            });
        } catch (e) {
            console.error("Failed to notify finish:", e);
        }

        // Reset answer state so we exit the results view
        setHasAnswered(false);
        setHostMessage("");

        // Sync nickname to localStorage so student dashboard can find their data
        // This links the quiz session to the student profile
        if (nickname) {
            localStorage.setItem("quizly_student_name", nickname);
            // Also add to recent students list
            const recent = JSON.parse(localStorage.getItem("quizly_recent_students") || "[]");
            const updated = [nickname, ...recent.filter((n: string) => n !== nickname)].slice(0, 5);
            localStorage.setItem("quizly_recent_students", JSON.stringify(updated));
        }

        // Trigger post-quiz flow
        setPostQuizStage("summary");
        // Force game status to finished for rendering
        setGame(prev => prev ? { ...prev, status: "finished" } : null);
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
                    <div className="max-w-3xl mx-auto py-6 px-4">
                        {/* Header Bar */}
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={() => setShowExitTicket(false)}
                                className="text-gray-500 hover:text-white flex items-center gap-2 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            {!isSignedIn && (
                                <button
                                    onClick={handleStudentSignUp}
                                    className="flex items-center gap-2 bg-gray-200 hover:bg-white text-gray-900 text-sm font-medium px-4 py-2 rounded-full transition-colors"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Save this packet
                                </button>
                            )}
                        </div>

                        {/* Sign-up CTA Banner for guests */}
                        {!isSignedIn && (
                            <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
                                <p className="text-white font-medium mb-1">Want to keep this study packet?</p>
                                <p className="text-gray-400 text-sm mb-3">Create a free account to save your progress and access your study materials anytime.</p>
                                <button
                                    onClick={handleStudentSignUp}
                                    className="inline-flex items-center gap-2 bg-gray-200 text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white transition-colors"
                                >
                                    Sign up free
                                </button>
                            </div>
                        )}

                        {/* Header */}
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Study Packet</h2>
                            <p className="text-gray-400 mt-1">{exitTicket.target_concept}</p>
                        </div>

                        {/* Section Tabs - Monochrome */}
                        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl border border-gray-800">
                            <button
                                onClick={() => setStudyPacketSection("notes")}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    studyPacketSection === "notes"
                                        ? "bg-white text-gray-900"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                                }`}
                            >
                                <FileText className="h-4 w-4" />
                                Notes
                            </button>
                            <button
                                onClick={() => setStudyPacketSection("homework")}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    studyPacketSection === "homework"
                                        ? "bg-white text-gray-900"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                                }`}
                            >
                                <Pencil className="h-4 w-4" />
                                Homework {totalPracticeQuestions > 0 && <span className="text-xs opacity-60">{totalPracticeQuestions}</span>}
                            </button>
                            <button
                                onClick={() => setStudyPacketSection("review")}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    studyPacketSection === "review"
                                        ? "bg-white text-gray-900"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                                }`}
                            >
                                <BookOpen className="h-4 w-4" />
                                Flashcards
                            </button>
                        </div>

                        {/* STUDY NOTES SECTION - Card-based design */}
                        {studyPacketSection === "notes" && (
                            <div className="space-y-4">
                                {/* Quick Summary Card */}
                                <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4" />
                                        Summary
                                    </h3>
                                    <p className="text-gray-300 leading-relaxed text-[15px]">{exitTicket.micro_lesson}</p>
                                    {exitTicket.encouragement && (
                                        <p className="text-gray-500 mt-3 text-sm italic">{exitTicket.encouragement}</p>
                                    )}
                                </div>

                                {/* Key Concepts Card */}
                                {exitTicket.study_notes?.key_concepts && exitTicket.study_notes.key_concepts.length > 0 && (
                                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                            <BookOpen className="h-4 w-4" />
                                            Key Concepts
                                        </h3>
                                        <ul className="space-y-3">
                                            {exitTicket.study_notes.key_concepts.map((concept, i) => (
                                                <li key={i} className="text-gray-300 flex items-start gap-3 text-[15px]">
                                                    <span className="text-white bg-gray-800 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                                                    <span>{concept}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Watch Out For Card */}
                                {exitTicket.study_notes?.common_mistakes && exitTicket.study_notes.common_mistakes.length > 0 && (
                                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4" />
                                            Watch Out For
                                        </h3>
                                        <ul className="space-y-3">
                                            {exitTicket.study_notes.common_mistakes.map((mistake, i) => (
                                                <li key={i} className="text-gray-300 flex items-start gap-3 text-[15px]">
                                                    <X className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                                    <span>{mistake}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Strategies Card */}
                                {exitTicket.study_notes?.strategies && exitTicket.study_notes.strategies.length > 0 && (
                                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                            <Target className="h-4 w-4" />
                                            Strategies
                                        </h3>
                                        <ol className="space-y-3">
                                            {exitTicket.study_notes.strategies.map((strategy, i) => (
                                                <li key={i} className="text-gray-300 flex items-start gap-3 text-[15px]">
                                                    <span className="text-white bg-gray-800 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                                                    <span>{strategy}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Memory Tips Card */}
                                {exitTicket.study_notes?.memory_tips && exitTicket.study_notes.memory_tips.length > 0 && (
                                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                            <Lightbulb className="h-4 w-4" />
                                            Memory Tips
                                        </h3>
                                        <ul className="space-y-3">
                                            {exitTicket.study_notes.memory_tips.map((tip, i) => (
                                                <li key={i} className="text-gray-300 flex items-start gap-3 text-[15px]">
                                                    <span className="text-gray-500 mt-0.5">•</span>
                                                    <span>{tip}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-2 space-y-3">
                                    <button
                                        onClick={() => setStudyPacketSection("homework")}
                                        className="w-full rounded-xl bg-white text-gray-900 px-6 py-4 font-semibold hover:bg-gray-100 transition-colors"
                                    >
                                        Start Homework →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* HOMEWORK SECTION - Monochrome */}
                        {studyPacketSection === "homework" && (
                            <div className="space-y-4">
                                {totalPracticeQuestions > 0 && !practiceComplete && currentPracticeQuestion && (
                                    <div>
                                        {/* Progress indicator */}
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-gray-400 text-sm">Question {practiceQuestionIndex + 1} of {totalPracticeQuestions}</span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-1.5 bg-gray-800 rounded-full mb-6 overflow-hidden">
                                            <div
                                                className="h-full bg-gray-400 transition-all duration-300"
                                                style={{ width: `${((practiceQuestionIndex + 1) / totalPracticeQuestions) * 100}%` }}
                                            />
                                        </div>

                                        <p className="text-white mb-5 text-lg">{currentPracticeQuestion.prompt}</p>
                                        <div className="space-y-2">
                                            {currentPracticeQuestion.options.map((opt, i) => {
                                                const optLetter = String.fromCharCode(65 + i);
                                                const isSelected = currentPracticeAnswer?.answer === optLetter;
                                                const showResult = !!currentPracticeAnswer;
                                                const isCorrect = currentPracticeQuestion.correct_answer === optLetter;

                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => !currentPracticeAnswer && submitPracticeAnswer(optLetter)}
                                                        disabled={!!currentPracticeAnswer}
                                                        className={`w-full text-left rounded-lg px-4 py-3 transition-colors ${
                                                            showResult
                                                                ? isCorrect
                                                                    ? "bg-gray-200 text-gray-900 font-medium"
                                                                    : isSelected && !currentPracticeAnswer?.correct
                                                                    ? "bg-gray-800 text-gray-500 line-through"
                                                                    : "bg-gray-900 text-gray-400 border border-gray-800"
                                                                : "bg-gray-900 text-gray-200 hover:bg-gray-800 border border-gray-800"
                                                        } ${currentPracticeAnswer ? "cursor-default" : "cursor-pointer"}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Result feedback */}
                                        {currentPracticeAnswer && (
                                            <div className="mt-4 p-4 rounded-lg bg-gray-900 border border-gray-800">
                                                {currentPracticeAnswer.correct ? (
                                                    <p className="text-white flex items-center gap-2 font-medium">
                                                        <Check className="h-5 w-5" /> Correct
                                                    </p>
                                                ) : (
                                                    <div>
                                                        <p className="text-gray-300">The correct answer is {currentPracticeQuestion.correct_answer}.</p>
                                                        {currentPracticeQuestion.hint && (
                                                            <p className="text-gray-400 text-sm mt-2">{currentPracticeQuestion.hint}</p>
                                                        )}
                                                    </div>
                                                )}
                                                {currentPracticeQuestion.explanation && (
                                                    <p className="text-gray-400 text-sm mt-3 pt-3 border-t border-gray-800">
                                                        {currentPracticeQuestion.explanation}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Next Question button */}
                                        {currentPracticeAnswer && (
                                            <button
                                                onClick={() => {
                                                    if (practiceQuestionIndex < totalPracticeQuestions - 1) {
                                                        nextPracticeQuestion();
                                                    }
                                                }}
                                                className="w-full mt-4 rounded-xl bg-gray-200 text-gray-900 px-6 py-3 font-semibold hover:bg-white transition-colors"
                                            >
                                                {practiceQuestionIndex < totalPracticeQuestions - 1
                                                    ? "Next →"
                                                    : "See Results"}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Practice Complete - Show results */}
                                {practiceComplete && (
                                    <div className="text-center py-6">
                                        <h3 className="text-xl font-bold text-white mb-2">Complete</h3>
                                        <p className="text-gray-400 text-lg">
                                            {practiceScore} / {totalPracticeQuestions} correct
                                        </p>

                                        {/* Score breakdown */}
                                        <div className="flex flex-wrap justify-center gap-2 my-6">
                                            {Object.entries(practiceAnswers).map(([idx, result]) => (
                                                <div
                                                    key={idx}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                                        result.correct
                                                            ? "bg-gray-300 text-gray-900"
                                                            : "bg-gray-800 text-gray-500"
                                                    }`}
                                                >
                                                    {parseInt(idx) + 1}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Review Flashcards button */}
                                        {exitTicket.flashcards && exitTicket.flashcards.length > 0 && (
                                            <button
                                                onClick={() => setStudyPacketSection("review")}
                                                className="w-full rounded-xl bg-gray-200 text-gray-900 px-6 py-3 font-semibold hover:bg-white transition-colors"
                                            >
                                                Review Flashcards →
                                            </button>
                                        )}
                                    </div>
                                )}

                                {totalPracticeQuestions === 0 && (
                                    <p className="text-center text-gray-400 py-8">No homework questions available.</p>
                                )}
                            </div>
                        )}

                        {/* FLASHCARDS SECTION */}
                        {studyPacketSection === "review" && (
                            <div className="space-y-4">
                                {exitTicket.flashcards && exitTicket.flashcards.length > 0 ? (
                                    <>
                                        <p className="text-center text-gray-400 mb-4">Click a card to reveal the answer</p>
                                        {exitTicket.flashcards.map((card, i) => (
                                            <FlashcardComponent key={i} front={card.front} back={card.back} index={i} />
                                        ))}
                                    </>
                                ) : (
                                    <p className="text-center text-gray-400 py-8">No flashcards available.</p>
                                )}
                            </div>
                        )}

                        {/* Done / Navigation */}
                        <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col gap-3">
                            {!isSignedIn ? (
                                <>
                                    <button
                                        onClick={handleStudentSignUp}
                                        className="flex items-center justify-center gap-2 bg-gray-100 rounded-xl p-4 text-gray-900 font-bold hover:bg-white transition-colors ring-2 ring-gray-400 ring-offset-2 ring-offset-gray-950 w-full"
                                    >
                                        <UserPlus className="h-5 w-5" />
                                        Sign up to save this packet
                                    </button>
                                    <button
                                        onClick={() => router.push("/join")}
                                        className="rounded-xl bg-gray-800 px-6 py-3 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                                    >
                                        Play another quiz
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href="/student/learning"
                                        className="flex items-center justify-center gap-2 bg-gray-800 rounded-xl p-4 text-white hover:bg-gray-700 transition-colors"
                                    >
                                        <BookOpen className="h-5 w-5" />
                                        View All Exit Tickets
                                    </Link>
                                    <button
                                        onClick={() => router.push("/student/dashboard")}
                                        className="rounded-xl bg-gray-200 px-6 py-3 font-semibold text-gray-900 hover:bg-white transition-colors"
                                    >
                                        Done
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ) : postQuizStage === "summary" ? (
                    <div className="flex min-h-[90vh] flex-col items-center justify-center py-8">
                        <PostQuizSummary
                            score={playerState?.score || 0}
                            totalQuestions={game.total_questions}
                            correctAnswers={localCorrectCount}
                            rank={playerState?.rank}
                            totalPlayers={undefined}
                            accuracy={game.total_questions > 0 ? Math.round((localCorrectCount / game.total_questions) * 100) : 0}
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
                ) : postQuizStage === "exit_ticket" && exitTicketLoading ? (
                    <div className="flex min-h-[90vh] flex-col items-center justify-center py-8">
                        <div className="text-center">
                            <Loader2 className="mx-auto h-12 w-12 animate-spin text-sky-400 mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">Creating Your Study Packet</h2>
                            <p className="text-gray-400">Generating personalized notes and homework based on your performance...</p>
                        </div>
                    </div>
                ) : postQuizStage === "exit_ticket" && exitTicket ? (
                    <div className="max-w-3xl mx-auto py-6 px-4">
                        {/* Exit Header Bar */}
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={handleExitQuiz}
                                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            {!isSignedIn && (
                                <button
                                    onClick={handleStudentSignUp}
                                    className="flex items-center gap-2 bg-gray-200 hover:bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-full transition-colors"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Save this packet
                                </button>
                            )}
                        </div>

                        {/* Header */}
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Study Packet</h2>
                            <p className="text-gray-400 mt-1">{exitTicket.target_concept}</p>
                        </div>

                        {/* Section Tabs */}
                        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl border border-gray-800">
                            <button
                                onClick={() => setStudyPacketSection("notes")}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    studyPacketSection === "notes"
                                        ? "bg-gray-700 text-white"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                                }`}
                            >
                                <FileText className="h-4 w-4" />
                                Notes
                            </button>
                            <button
                                onClick={() => setStudyPacketSection("homework")}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    studyPacketSection === "homework"
                                        ? "bg-gray-700 text-white"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                                }`}
                            >
                                <Pencil className="h-4 w-4" />
                                Homework {totalPracticeQuestions > 0 && <span className="text-xs opacity-60">{totalPracticeQuestions}</span>}
                            </button>
                            <button
                                onClick={() => setStudyPacketSection("review")}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    studyPacketSection === "review"
                                        ? "bg-gray-700 text-white"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                                }`}
                            >
                                <BookOpen className="h-4 w-4" />
                                Flashcards
                            </button>
                        </div>

                        {/* STUDY NOTES SECTION */}
                        {studyPacketSection === "notes" && (
                            <div className="space-y-5">
                                {/* Quick Review / Micro Lesson */}
                                <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800">
                                    <p className="text-gray-200 leading-relaxed text-base">{exitTicket.micro_lesson}</p>
                                    {exitTicket.encouragement && (
                                        <p className="text-gray-400 mt-4 italic text-sm border-t border-gray-800 pt-4">{exitTicket.encouragement}</p>
                                    )}
                                </div>

                                {/* Key Concepts */}
                                {exitTicket.study_notes?.key_concepts && exitTicket.study_notes.key_concepts.length > 0 && (
                                    <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800">
                                        <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Key Concepts</h3>
                                        <ul className="space-y-3">
                                            {exitTicket.study_notes.key_concepts.map((concept, i) => (
                                                <li key={i} className="text-gray-200 flex items-start gap-3 text-base leading-relaxed">
                                                    <span className="text-gray-500 mt-1">•</span>
                                                    <span>{concept}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Common Mistakes to Avoid */}
                                {exitTicket.study_notes?.common_mistakes && exitTicket.study_notes.common_mistakes.length > 0 && (
                                    <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800">
                                        <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Common Mistakes</h3>
                                        <ul className="space-y-3">
                                            {exitTicket.study_notes.common_mistakes.map((mistake, i) => (
                                                <li key={i} className="text-gray-200 flex items-start gap-3 text-base leading-relaxed">
                                                    <X className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                                                    <span>{mistake}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Strategies */}
                                {exitTicket.study_notes?.strategies && exitTicket.study_notes.strategies.length > 0 && (
                                    <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800">
                                        <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Strategies</h3>
                                        <ol className="space-y-3">
                                            {exitTicket.study_notes.strategies.map((strategy, i) => (
                                                <li key={i} className="text-gray-200 flex items-start gap-3 text-base leading-relaxed">
                                                    <span className="text-gray-400 bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">{i + 1}</span>
                                                    <span>{strategy}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Memory Tips */}
                                {exitTicket.study_notes?.memory_tips && exitTicket.study_notes.memory_tips.length > 0 && (
                                    <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800">
                                        <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                                            <Lightbulb className="h-4 w-4" />
                                            Memory Tips
                                        </h3>
                                        <ul className="space-y-3">
                                            {exitTicket.study_notes.memory_tips.map((tip, i) => (
                                                <li key={i} className="text-gray-200 flex items-start gap-3 text-base leading-relaxed">
                                                    <span className="text-gray-500 mt-1">•</span>
                                                    <span>{tip}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Misconceptions if present */}
                                {exitTicket.misconceptions && exitTicket.misconceptions.length > 0 && (
                                    <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-800">
                                        <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Understanding Your Mistakes</h3>
                                        <div className="space-y-4">
                                            {exitTicket.misconceptions.map((m, i) => (
                                                <div key={i} className="bg-gray-800/50 rounded-lg p-4">
                                                    <p className="text-white font-medium mb-2">{m.type}</p>
                                                    <p className="text-gray-400 text-sm mb-2">{m.description}</p>
                                                    <p className="text-gray-200 text-sm">{m.correction}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Continue to Homework button */}
                                <button
                                    onClick={() => setStudyPacketSection("homework")}
                                    className="w-full rounded-xl bg-gray-200 text-gray-900 px-6 py-4 font-semibold hover:bg-white transition-colors"
                                >
                                    Start Homework →
                                </button>
                            </div>
                        )}

                        {/* HOMEWORK SECTION */}
                        {studyPacketSection === "homework" && (
                            <div className="space-y-4">
                                {/* Practice Questions - Multi-question flow */}
                                {totalPracticeQuestions > 0 && !practiceComplete && currentPracticeQuestion && (
                                    <div>
                                        {/* Progress indicator */}
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-gray-400 text-sm">Question {practiceQuestionIndex + 1} of {totalPracticeQuestions}</span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-1.5 bg-gray-800 rounded-full mb-6 overflow-hidden">
                                            <div
                                                className="h-full bg-gray-400 transition-all duration-300"
                                                style={{ width: `${((practiceQuestionIndex + 1) / totalPracticeQuestions) * 100}%` }}
                                            />
                                        </div>

                                        <p className="text-white mb-5 text-lg">{currentPracticeQuestion.prompt}</p>
                                        <div className="space-y-2">
                                            {currentPracticeQuestion.options.map((opt, i) => {
                                                const optLetter = String.fromCharCode(65 + i);
                                                const isSelected = currentPracticeAnswer?.answer === optLetter;
                                                const showResult = !!currentPracticeAnswer;
                                                const isCorrect = currentPracticeQuestion.correct_answer === optLetter;

                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => !currentPracticeAnswer && submitPracticeAnswer(optLetter)}
                                                        disabled={!!currentPracticeAnswer}
                                                        className={`w-full text-left rounded-lg px-4 py-3 transition-colors ${
                                                            showResult
                                                                ? isCorrect
                                                                    ? "bg-gray-200 text-gray-900 font-medium"
                                                                    : isSelected && !currentPracticeAnswer?.correct
                                                                    ? "bg-gray-800 text-gray-500 line-through"
                                                                    : "bg-gray-900 text-gray-400 border border-gray-800"
                                                                : "bg-gray-900 text-gray-200 hover:bg-gray-800 border border-gray-800"
                                                        } ${currentPracticeAnswer ? "cursor-default" : "cursor-pointer"}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Result feedback */}
                                        {currentPracticeAnswer && (
                                            <div className="mt-4 p-4 rounded-lg bg-gray-900 border border-gray-800">
                                                {currentPracticeAnswer.correct ? (
                                                    <p className="text-white flex items-center gap-2 font-medium">
                                                        <Check className="h-5 w-5" /> Correct
                                                    </p>
                                                ) : (
                                                    <div>
                                                        <p className="text-gray-300">The correct answer is {currentPracticeQuestion.correct_answer}.</p>
                                                        {currentPracticeQuestion.hint && (
                                                            <p className="text-gray-400 text-sm mt-2">{currentPracticeQuestion.hint}</p>
                                                        )}
                                                    </div>
                                                )}
                                                {currentPracticeQuestion.explanation && (
                                                    <p className="text-gray-400 text-sm mt-3 pt-3 border-t border-gray-800">
                                                        {currentPracticeQuestion.explanation}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Next Question button */}
                                        {currentPracticeAnswer && (
                                            <button
                                                onClick={() => {
                                                    if (practiceQuestionIndex < totalPracticeQuestions - 1) {
                                                        nextPracticeQuestion();
                                                    }
                                                }}
                                                className="w-full mt-4 rounded-xl bg-gray-200 text-gray-900 px-6 py-3 font-semibold hover:bg-white transition-colors"
                                            >
                                                {practiceQuestionIndex < totalPracticeQuestions - 1
                                                    ? "Next →"
                                                    : "See Results"}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Practice Complete - Show results */}
                                {practiceComplete && (
                                    <div className="text-center py-6">
                                        <h3 className="text-xl font-bold text-white mb-2">Complete</h3>
                                        <p className="text-gray-400 text-lg">
                                            {practiceScore} / {totalPracticeQuestions} correct
                                        </p>

                                        {/* Score breakdown */}
                                        <div className="flex flex-wrap justify-center gap-2 my-6">
                                            {Object.entries(practiceAnswers).map(([idx, result]) => (
                                                <div
                                                    key={idx}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                                        result.correct
                                                            ? "bg-gray-300 text-gray-900"
                                                            : "bg-gray-800 text-gray-500"
                                                    }`}
                                                >
                                                    {parseInt(idx) + 1}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Review Flashcards button */}
                                        {exitTicket.flashcards && exitTicket.flashcards.length > 0 && (
                                            <button
                                                onClick={() => setStudyPacketSection("review")}
                                                className="w-full rounded-xl bg-gray-200 text-gray-900 px-6 py-3 font-semibold hover:bg-white transition-colors"
                                            >
                                                Review Flashcards →
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Fallback if no practice questions */}
                                {totalPracticeQuestions === 0 && (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400">No homework questions available.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* FLASHCARDS SECTION */}
                        {studyPacketSection === "review" && (
                            <div className="space-y-3">
                                {exitTicket.flashcards && exitTicket.flashcards.length > 0 ? (
                                    <>
                                        <p className="text-gray-500 text-sm text-center mb-4">Tap to reveal</p>
                                        {exitTicket.flashcards.map((card, i) => (
                                            <FlashcardComponent key={i} front={card.front} back={card.back} index={i} />
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400">No flashcards available.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Done Button - visible when homework complete or in review section */}
                        {(practiceComplete || studyPacketSection === "review") && (
                            <div className="mt-6 pt-4 border-t border-gray-800">
                                <button
                                    onClick={() => setPostQuizStage("complete")}
                                    className="w-full rounded-xl border border-gray-700 px-6 py-4 font-medium text-gray-300 hover:bg-gray-900 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                ) : postQuizStage === "exit_ticket" ? (
                    <div className="flex min-h-[90vh] flex-col items-center justify-center py-8">
                        <div className="text-center max-w-md">
                            <Brain className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">No Exit Ticket Available</h2>
                            <p className="text-gray-400 mb-6">Unable to generate a personalized exit ticket at this time.</p>
                            <button
                                onClick={() => setPostQuizStage("practice")}
                                className="rounded-full bg-sky-600 px-6 py-3 font-bold text-white hover:bg-sky-700"
                            >
                                Continue
                            </button>
                        </div>
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
                    <div className="flex min-h-[90vh] flex-col items-center justify-center py-8 px-4">
                        <div className="text-center max-w-md w-full">
                            {isSignedIn ? (
                                <>
                                    <Check className="h-12 w-12 text-white mx-auto mb-4" />
                                    <h2 className="text-2xl font-bold text-white mb-2">All Done</h2>
                                    <p className="text-gray-400 mb-8">
                                        Your study packet has been saved to your dashboard.
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        <Link
                                            href="/student/dashboard"
                                            className="rounded-xl bg-white px-6 py-3 font-medium text-gray-900 hover:bg-gray-100 transition-colors"
                                        >
                                            Go to Dashboard
                                        </Link>
                                        <button
                                            onClick={() => router.push("/join")}
                                            className="rounded-xl border border-gray-700 px-6 py-3 font-medium text-gray-400 hover:bg-gray-900 transition-colors"
                                        >
                                            Join Another Quiz
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <GraduationCap className="h-12 w-12 text-white mx-auto mb-4" />
                                    <h2 className="text-2xl font-bold text-white mb-2">Nice work!</h2>
                                    <p className="text-gray-400 mb-6">
                                        Your personalized study packet is ready.
                                    </p>

                                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 text-left">
                                        <h3 className="font-semibold text-white mb-3">Want to keep this packet?</h3>
                                        <ul className="space-y-2 text-sm text-gray-400 mb-5">
                                            <li className="flex items-start gap-2">
                                                <Check className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                                Access your study notes anytime
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Check className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                                Track progress across quizzes
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Check className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                                Get personalized practice recommendations
                                            </li>
                                        </ul>
                                        <Link
                                            href="/sign-up"
                                            className="block w-full rounded-lg bg-white px-6 py-3 font-semibold text-gray-900 hover:bg-gray-100 transition-colors text-center"
                                        >
                                            Create Free Account
                                        </Link>
                                    </div>

                                    <button
                                        onClick={() => router.push("/join")}
                                        className="w-full text-gray-500 hover:text-white text-sm transition-colors"
                                    >
                                        Skip for now
                                    </button>
                                </>
                            )}
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
                <div className="flex flex-col items-center justify-center min-h-[90vh] max-w-xl mx-auto">
                    {/* Result Icon */}
                    <div className={`mb-6 flex h-28 w-28 items-center justify-center rounded-full ${
                        lastAnswerWasCorrect
                            ? "bg-green-500 animate-pulse"
                            : "bg-orange-500"
                    } shadow-2xl`}>
                        {lastAnswerWasCorrect ? (
                            <Check className="h-14 w-14 text-white" />
                        ) : (
                            <X className="h-14 w-14 text-white" />
                        )}
                    </div>

                    {/* Points earned */}
                    {lastAnswerWasCorrect && (playerState?.last_answer_points ?? 0) > 0 && (
                        <div className="mb-4 flex items-center gap-2 animate-bounce">
                            <Zap className="h-8 w-8 text-yellow-400" />
                            <span className="text-4xl font-bold text-yellow-400">
                                +{playerState?.last_answer_points}
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
                    {!lastAnswerWasCorrect && confidence >= 70 && (
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
                                onComplete={() => {
                                    setShowPeerDiscussion(false);
                                    // Mark that peer discussion occurred for exit ticket context
                                    setStudentResponses(prev => prev.map((resp, idx) =>
                                        idx === prev.length - 1
                                            ? { ...resp, had_peer_discussion: true }
                                            : resp
                                    ));
                                }}
                                onCorrectRetry={() => {
                                    // Student got it right on retry - proceed without points
                                    // Mark that peer discussion helped them understand
                                    setStudentResponses(prev => prev.map((resp, idx) =>
                                        idx === prev.length - 1
                                            ? { ...resp, had_peer_discussion: true, corrected_via_discussion: true }
                                            : resp
                                    ));
                                    setShowPeerDiscussion(false);
                                    setConfidence(70);
                                    setReasoning("");
                                    setShowReasoning(false);

                                    // Check if this was the last question
                                    const isLastQuestion = game && asyncQuestionIndex >= game.total_questions - 1;
                                    if (isLastQuestion) {
                                        // Complete the quiz
                                        handleQuizComplete();
                                    } else {
                                        // Move to next question
                                        nextQuestion();
                                    }
                                }}
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

                    {/* Current Score - hidden during peer discussion */}
                    {!showPeerDiscussion && (
                        <div className="rounded-2xl bg-gray-900 px-8 py-4 text-center border border-gray-800 w-full">
                            <p className="text-gray-400 text-sm">Your Score</p>
                            <p className="text-3xl font-bold text-white">
                                {playerState?.score.toLocaleString() || 0}
                            </p>
                            {playerState && (
                                <p className="mt-1 text-gray-400">Rank #{playerState.rank}</p>
                            )}
                        </div>
                    )}

                    {/* FOR ASYNC MODE: Show Next Question or Try Again based on correctness */}
                    {game?.sync_mode === false && !showPeerDiscussion && lastAnswerWasCorrect !== null && (
                        <div className="mt-8">
                            {lastAnswerWasCorrect === true ? (
                                // Correct answer - can proceed
                                asyncQuestionIndex + 1 < game.total_questions ? (
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
                                        onClick={handleQuizComplete}
                                        className="rounded-full bg-emerald-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-emerald-500 transition-colors"
                                    >
                                        Finish Quiz
                                    </button>
                                )
                            ) : (
                                // Incorrect answer - must try again
                                <div className="text-center">
                                    <button
                                        onClick={() => {
                                            setHasAnswered(false);
                                            setSelectedAnswer(null);
                                            setShowConfirmStep(false);
                                            setHostMessage("");
                                            setLastAnswerWasCorrect(null);
                                        }}
                                        className="rounded-full bg-sky-600 px-8 py-4 text-lg font-bold text-white shadow-xl hover:bg-sky-500 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                    <p className="mt-2 text-sm text-gray-400">Answer correctly to continue</p>
                                </div>
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExitQuiz}
                            className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            title="Exit quiz"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                        <div className="rounded-full bg-gray-900 px-4 py-2 border border-gray-800">
                            <span className="text-white/70">Q</span>{" "}
                            <span className="font-bold text-white">
                                {game.current_question_index + 1}/{game.total_questions}
                            </span>
                        </div>
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
                            <MathText text={game.current_question.options[selectedAnswer] || ""} />
                        </span>
                    </div>
                </div>

                {/* Confidence Selection */}
                <div className="mb-6 rounded-2xl bg-gray-900 p-6 border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                        <Brain className="h-5 w-5 text-white" />
                        <h3 className="font-bold text-white">How confident are you?</h3>
                    </div>
                    <ConfidenceSlider
                        value={confidence}
                        onChange={setConfidence}
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
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExitQuiz}
                        className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        title="Exit quiz"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                    <div className="rounded-full bg-gray-900 px-4 py-2 border border-gray-800">
                        <span className="text-white/70">Q</span>{" "}
                        <span className="font-bold text-white">
                            {game.current_question_index + 1}/{game.total_questions}
                        </span>
                    </div>
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
                {/* Question Image */}
                {game.current_question?.image_url && (
                    <div className="mb-4 flex justify-center">
                        <img
                            src={game.current_question.image_url}
                            alt="Question"
                            className="max-h-48 rounded-lg object-contain"
                        />
                    </div>
                )}
                <div className="text-center text-xl font-bold text-gray-900">
                    <MathText text={game.current_question?.question_text || ""} />
                </div>
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
                                className={`flex flex-1 items-center gap-4 rounded-2xl bg-gradient-to-r ${colors[index]} p-4 text-white shadow-lg transition-all ${
                                    hasAnswered && selectedAnswer === key
                                        ? "ring-4 ring-white scale-95"
                                        : "hover:scale-[1.02] active:scale-95"
                                } ${hasAnswered ? "opacity-80" : ""}`}
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-2xl flex-shrink-0">
                                    {shapes[index]}
                                </span>
                                <span className="flex-1 text-left text-lg font-bold">
                                    <MathText text={value} />
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

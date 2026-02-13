"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    X,
    Loader2,
    Trophy,
    BookOpen,
    Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ExitTicketCard } from "@/components/ExitTicketCard";
import { GuestConversionModal } from "@/components/GuestConversionModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Question {
    id: string;
    order: number;
    question_text: string;
    question_type: string;
    options: { A: string; B: string; C: string; D: string };
    correct_answer: string;
    explanation: string | null;
    time_limit: number;
    points: number;
}

interface Quiz {
    id: string;
    title: string;
    description: string | null;
    subject: string | null;
    questions: Question[];
}

interface AnswerResult {
    question_id: string;
    is_correct: boolean;
    correct_answer: string;
    explanation: string | null;
}

interface ExitTicket {
    id: string;
    student_name: string;
    target_concept: string;
    micro_lesson: string;
    encouragement?: string;
    question_prompt: string;
    question_options: string[];
    correct_answer: string;
    hint?: string;
    is_completed: boolean;
    created_at: string;
    study_notes?: {
        key_concepts?: string[];
        common_mistakes?: string[];
        strategies?: string[];
        memory_tips?: string[];
    };
    practice_questions?: {
        prompt: string;
        options: string[];
        correct_answer: string;
        hint?: string;
        explanation?: string;
        difficulty?: string;
    }[];
    flashcards?: { front: string; back: string }[];
    misconceptions?: { type: string; description: string; correction: string }[];
}

export default function PublicPracticePage() {
    const router = useRouter();
    const params = useParams();
    const quizId = params.quizId as string;
    const { isAuthenticated, user } = useAuth();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalCorrect, setTotalCorrect] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
    const [responses, setResponses] = useState<Array<{
        question_id: string;
        question_text: string;
        options: Record<string, string>;
        student_answer: string;
        correct_answer: string;
        is_correct: boolean;
        concept?: string;
    }>>([]);

    // Exit ticket state
    const [showResults, setShowResults] = useState(false);
    const [exitTicket, setExitTicket] = useState<ExitTicket | null>(null);
    const [generatingTicket, setGeneratingTicket] = useState(false);
    const [showConversionModal, setShowConversionModal] = useState(false);

    // Get student name from session storage or use authenticated user's name
    const getStudentName = (): string | null => {
        if (isAuthenticated && user?.name) {
            return user.name;
        }
        if (typeof window !== "undefined") {
            return sessionStorage.getItem("quizly_guest_name");
        }
        return null;
    };

    useEffect(() => {
        const studentName = getStudentName();

        // If no student name and not authenticated, redirect to join page
        if (!studentName && !isAuthenticated) {
            router.push(`/practice/${quizId}/join`);
            return;
        }

        fetchQuiz();
    }, [quizId, isAuthenticated]);

    const fetchQuiz = async () => {
        try {
            const response = await fetch(`${API_URL}/quizzes/public/${quizId}`);

            if (response.status === 404) {
                setError("Quiz not found or is not public");
                setLoading(false);
                return;
            }

            if (!response.ok) {
                setError("Failed to load quiz");
                setLoading(false);
                return;
            }

            const data = await response.json();
            setQuiz(data);
        } catch (err) {
            console.error("Failed to fetch quiz:", err);
            setError("Failed to load quiz");
        } finally {
            setLoading(false);
        }
    };

    const submitAnswer = () => {
        if (!selectedAnswer || !quiz) return;

        const question = quiz.questions[currentIndex];
        if (!question || answeredQuestions.has(question.id)) return;

        const isCorrect = selectedAnswer.toUpperCase() === question.correct_answer.toUpperCase();

        setAnswerResult({
            question_id: question.id,
            is_correct: isCorrect,
            correct_answer: question.correct_answer,
            explanation: question.explanation,
        });

        setAnsweredQuestions((prev) => new Set([...prev, question.id]));

        if (isCorrect) {
            setTotalCorrect((prev) => prev + 1);
        }

        // Track response for exit ticket
        setResponses((prev) => [
            ...prev,
            {
                question_id: question.id,
                question_text: question.question_text,
                options: question.options,
                student_answer: selectedAnswer,
                correct_answer: question.correct_answer,
                is_correct: isCorrect,
                concept: quiz.subject || "General",
            },
        ]);
    };

    const nextQuestion = () => {
        if (!quiz) return;

        if (currentIndex < quiz.questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setSelectedAnswer(null);
            setAnswerResult(null);
        } else {
            // Complete the practice - generate exit ticket
            completePractice();
        }
    };

    const completePractice = async () => {
        setShowResults(true);
        setGeneratingTicket(true);

        const studentName = getStudentName() || `Guest-${Date.now()}`;

        try {
            // Generate exit ticket
            const response = await fetch(`${API_URL}/student-learning/exit-ticket`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_name: studentName,
                    responses: responses,
                    concepts: quiz?.subject ? [quiz.subject] : ["General"],
                }),
            });

            if (response.ok) {
                const ticketData = await response.json();
                setExitTicket(ticketData);

                // Show conversion modal for guests after a short delay
                if (!isAuthenticated) {
                    setTimeout(() => {
                        setShowConversionModal(true);
                    }, 2000);
                }
            }
        } catch (err) {
            console.error("Failed to generate exit ticket:", err);
        } finally {
            setGeneratingTicket(false);
        }
    };

    const handleExitTicketAnswer = async (ticketId: string, answer: string) => {
        const response = await fetch(`${API_URL}/student-learning/exit-ticket/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ticket_id: ticketId,
                student_answer: answer,
            }),
        });

        if (response.ok) {
            return await response.json();
        }
        throw new Error("Failed to submit answer");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="text-center max-w-md px-4">
                    <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Quiz Not Available</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 rounded-lg font-medium transition-colors"
                    >
                        Go Home
                    </Link>
                </div>
            </div>
        );
    }

    if (!quiz || quiz.questions.length === 0) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No Questions</h2>
                    <p className="text-gray-400 mb-4">This quiz doesn't have any questions yet.</p>
                    <Link
                        href="/"
                        className="text-sky-400 hover:text-sky-300"
                    >
                        Go Home
                    </Link>
                </div>
            </div>
        );
    }

    // Results view with exit ticket
    if (showResults) {
        const scorePercent = Math.round((totalCorrect / quiz.questions.length) * 100);
        const studentName = getStudentName() || "Guest";

        return (
            <div className="min-h-screen bg-gray-950 text-white">
                <header className="border-b border-gray-800 bg-gray-900/50">
                    <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                        <h1 className="font-semibold">{quiz.title}</h1>
                        <Link
                            href="/"
                            className="text-gray-400 hover:text-white text-sm"
                        >
                            Exit
                        </Link>
                    </div>
                </header>

                <main className="max-w-3xl mx-auto px-4 py-8">
                    {/* Score Summary */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-sky-600 to-teal-600 mb-4">
                            <Trophy className="w-12 h-12 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Great Job, {studentName}!</h2>
                        <p className="text-gray-400">
                            You scored <span className="text-sky-400 font-bold">{totalCorrect}/{quiz.questions.length}</span> ({scorePercent}%)
                        </p>
                    </div>

                    {/* Exit Ticket */}
                    {generatingTicket ? (
                        <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto mb-4" />
                            <p className="text-gray-400">Generating your personalized study materials...</p>
                        </div>
                    ) : exitTicket ? (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-white">Your Personalized Study Packet</h3>
                            <ExitTicketCard
                                ticket={exitTicket}
                                onAnswer={handleExitTicketAnswer}
                            />
                        </div>
                    ) : (
                        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center">
                            <p className="text-gray-400">
                                Review your answers and practice again to improve!
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => {
                                setCurrentIndex(0);
                                setSelectedAnswer(null);
                                setAnswerResult(null);
                                setTotalCorrect(0);
                                setAnsweredQuestions(new Set());
                                setResponses([]);
                                setShowResults(false);
                                setExitTicket(null);
                            }}
                            className="px-6 py-3 bg-sky-600 hover:bg-sky-500 rounded-lg font-medium transition-colors"
                        >
                            Practice Again
                        </button>
                        <Link
                            href="/"
                            className="px-6 py-3 border border-gray-600 hover:border-gray-500 rounded-lg font-medium text-center transition-colors"
                        >
                            Back to Home
                        </Link>
                    </div>
                </main>

                {/* Guest Conversion Modal */}
                {showConversionModal && exitTicket && (
                    <GuestConversionModal
                        exitTicket={exitTicket}
                        onClose={() => setShowConversionModal(false)}
                        onSignUp={() => {
                            localStorage.setItem("quizly_pending_role", "student");
                            router.push("/sign-up");
                        }}
                    />
                )}
            </div>
        );
    }

    // Quiz question view
    const question = quiz.questions[currentIndex];
    if (!question) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Question not found</h2>
                    <Link href="/" className="text-sky-400 hover:text-sky-300">
                        Go Home
                    </Link>
                </div>
            </div>
        );
    }

    const progress = ((currentIndex + 1) / quiz.questions.length) * 100;
    const isLastQuestion = currentIndex === quiz.questions.length - 1;

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Exit
                        </Link>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-sky-400">
                                <Check className="w-4 h-4" />
                                {totalCorrect}/{currentIndex + (answerResult ? 1 : 0)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">
                            {currentIndex + 1} / {quiz.questions.length}
                        </span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-sky-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Question */}
            <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-8">
                <div className="flex-1">
                    <h2 className="text-2xl font-semibold mb-8">{question.question_text}</h2>

                    <div className="space-y-3">
                        {(["A", "B", "C", "D"] as const).map((opt) => {
                            if (!question.options[opt]) return null;

                            const isSelected = selectedAnswer === opt;
                            const isCorrect = answerResult?.correct_answer === opt;
                            const isWrong = answerResult && isSelected && !isCorrect;

                            let bgColor = "bg-gray-900 border-gray-700 hover:border-gray-600";
                            if (answerResult) {
                                if (isCorrect) {
                                    bgColor = "bg-emerald-900/30 border-emerald-500";
                                } else if (isWrong) {
                                    bgColor = "bg-red-900/30 border-red-500";
                                }
                            } else if (isSelected) {
                                bgColor = "bg-sky-900/20 border-sky-500";
                            }

                            return (
                                <button
                                    key={opt}
                                    onClick={() => !answerResult && setSelectedAnswer(opt)}
                                    disabled={!!answerResult}
                                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${bgColor}`}
                                >
                                    <span
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold ${
                                            isSelected || isCorrect
                                                ? "bg-sky-600 text-white"
                                                : isWrong
                                                ? "bg-red-600 text-white"
                                                : "bg-gray-800 text-gray-400"
                                        }`}
                                    >
                                        {answerResult && isCorrect ? (
                                            <Check className="w-5 h-5" />
                                        ) : answerResult && isWrong ? (
                                            <X className="w-5 h-5" />
                                        ) : (
                                            opt
                                        )}
                                    </span>
                                    <span className="flex-1">{question.options[opt]}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Explanation */}
                    {answerResult && answerResult.explanation && (
                        <div className="mt-6 p-4 bg-gray-900 border border-gray-800 rounded-xl">
                            <h3 className="font-semibold mb-2 text-sky-400">Explanation</h3>
                            <p className="text-gray-300">{answerResult.explanation}</p>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <div className="pt-6">
                    {!answerResult ? (
                        <button
                            onClick={submitAnswer}
                            disabled={!selectedAnswer}
                            className="w-full py-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Submit Answer
                        </button>
                    ) : (
                        <button
                            onClick={nextQuestion}
                            className="w-full py-4 bg-sky-600 hover:bg-sky-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            {isLastQuestion ? (
                                <>
                                    <Trophy className="w-5 h-5" />
                                    See Results
                                </>
                            ) : (
                                <>
                                    Next Question
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
}

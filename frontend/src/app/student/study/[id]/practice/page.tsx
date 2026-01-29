"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    X,
    Loader2,
    Clock,
    Trophy,
    BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

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
    questions: Question[];
}

interface AnswerResult {
    question_id: string;
    is_correct: boolean;
    correct_answer: string;
    explanation: string | null;
    points_earned: number;
}

export default function PracticePage() {
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;
    const { token, isLoading: authLoading } = useAuth();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [startTime, setStartTime] = useState<number>(0);
    const [totalCorrect, setTotalCorrect] = useState(0);
    const [totalPoints, setTotalPoints] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!authLoading && token) {
            startPractice();
        }
    }, [authLoading, token, quizId]);

    const startPractice = async () => {
        try {
            // First get the quiz details
            const quizRes = await fetch(`${API_URL}/student/quizzes/${quizId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!quizRes.ok) {
                router.push("/student/study");
                return;
            }

            const quizData = await quizRes.json();
            setQuiz(quizData);

            // Start a practice session
            const sessionRes = await fetch(
                `${API_URL}/student/quizzes/${quizId}/practice`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (sessionRes.ok) {
                const sessionData = await sessionRes.json();
                setSessionId(sessionData.session_id);
                setStartTime(Date.now());
            }
        } catch (error) {
            console.error("Failed to start practice:", error);
        } finally {
            setLoading(false);
        }
    };

    const submitAnswer = async () => {
        if (!selectedAnswer || !sessionId || !quiz) return;

        const question = quiz.questions[currentIndex];
        if (!question || answeredQuestions.has(question.id)) return;

        setSubmitting(true);

        try {
            const response = await fetch(
                `${API_URL}/student/quizzes/${quizId}/practice/${sessionId}/answer`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        question_id: question.id,
                        answer: selectedAnswer,
                        response_time_ms: Date.now() - startTime,
                    }),
                }
            );

            if (response.ok) {
                const result: AnswerResult = await response.json();
                setAnswerResult(result);
                setAnsweredQuestions((prev) => new Set([...prev, question.id]));

                if (result.is_correct) {
                    setTotalCorrect((prev) => prev + 1);
                }
                setTotalPoints((prev) => prev + result.points_earned);
            }
        } catch (error) {
            console.error("Failed to submit answer:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const nextQuestion = () => {
        if (!quiz) return;

        if (currentIndex < quiz.questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setSelectedAnswer(null);
            setAnswerResult(null);
            setStartTime(Date.now());
        } else {
            // Complete the practice
            completePractice();
        }
    };

    const completePractice = async () => {
        if (!sessionId) return;

        try {
            await fetch(
                `${API_URL}/student/quizzes/${quizId}/practice/${sessionId}/complete`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            router.push(`/student/study/${quizId}/results`);
        } catch (error) {
            console.error("Failed to complete practice:", error);
            router.push(`/student/study/${quizId}/results`);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
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
                        href="/student/study"
                        className="text-emerald-400 hover:text-emerald-300"
                    >
                        Back to Study
                    </Link>
                </div>
            </div>
        );
    }

    const question = quiz.questions[currentIndex];
    if (!question) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Question not found</h2>
                    <Link href="/student/study" className="text-emerald-400 hover:text-emerald-300">
                        Back to Study
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
                            href="/student/study"
                            className="flex items-center gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Exit
                        </Link>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-emerald-400">
                                <Check className="w-4 h-4" />
                                {totalCorrect}/{currentIndex + (answerResult ? 1 : 0)}
                            </span>
                            <span className="flex items-center gap-1 text-yellow-400">
                                <Trophy className="w-4 h-4" />
                                {totalPoints}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">
                            {currentIndex + 1} / {quiz.questions.length}
                        </span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
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
                                bgColor = "bg-emerald-900/20 border-emerald-500";
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
                                                ? "bg-emerald-600 text-white"
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
                            <h3 className="font-semibold mb-2 text-emerald-400">Explanation</h3>
                            <p className="text-gray-300">{answerResult.explanation}</p>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <div className="pt-6">
                    {!answerResult ? (
                        <button
                            onClick={submitAnswer}
                            disabled={!selectedAnswer || submitting}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-5 h-5" />
                                    Submit Answer
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={nextQuestion}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
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

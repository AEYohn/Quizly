"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    BookOpen,
    Check,
    X,
    Loader2,
    MessageSquare,
    AlertCircle,
    ChevronRight,
    Trophy,
    ArrowRight,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Question {
    prompt: string;
    options: { A: string; B: string; C: string; D: string };
    correct_answer: string;
    explanation: string;
}

interface Assignment {
    id: string;
    student_name: string;
    title: string;
    note: string | null;
    status: string;
    is_read: boolean;
    question_count: number;
    created_at: string;
    completed_at: string | null;
    score: number | null;
    total_questions: number | null;
    practice_questions: Question[];
    answers: { question_index: number; answer: string }[] | null;
}

interface SubmitResult {
    score: number;
    total: number;
    score_percent: number;
    feedback: string;
    results: {
        question_index: number;
        student_answer: string;
        correct_answer: string;
        is_correct: boolean;
        explanation: string;
    }[];
}

export default function AssignmentPracticePage() {
    const params = useParams();
    const router = useRouter();
    const assignmentId = params.id as string;

    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Practice state
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);
    const [showReview, setShowReview] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("quizly_student_name");
        if (!stored) {
            router.push("/student");
            return;
        }
        fetchAssignment();
    }, [assignmentId, router]);

    const fetchAssignment = async () => {
        try {
            const res = await fetch(`${API_URL}/assignments/${assignmentId}`);
            if (res.ok) {
                const data = await res.json();
                setAssignment(data);

                // If already completed, show result
                if (data.status === "completed" && data.answers) {
                    setShowReview(true);
                }
            } else if (res.status === 404) {
                setError("Assignment not found");
            } else {
                setError("Failed to load assignment");
            }
        } catch (err) {
            console.error("Error fetching assignment:", err);
            setError("Connection error");
        } finally {
            setLoading(false);
        }
    };

    const handleStartPractice = async () => {
        try {
            await fetch(`${API_URL}/assignments/${assignmentId}/start`, {
                method: "POST",
            });
            if (assignment) {
                setAssignment({ ...assignment, status: "in_progress" });
            }
        } catch (err) {
            console.error("Error starting assignment:", err);
        }
    };

    const handleSelectAnswer = (answer: string) => {
        setSelectedAnswers((prev) => ({
            ...prev,
            [currentQuestion]: answer,
        }));
    };

    const handleNext = () => {
        if (assignment && currentQuestion < assignment.practice_questions.length - 1) {
            setCurrentQuestion((prev) => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion((prev) => prev - 1);
        }
    };

    const handleSubmit = async () => {
        if (!assignment) return;

        setIsSubmitting(true);
        try {
            const answers = Object.entries(selectedAnswers).map(([idx, answer]) => ({
                question_index: parseInt(idx),
                answer,
            }));

            const res = await fetch(`${API_URL}/assignments/${assignmentId}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers }),
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
            } else {
                setError("Failed to submit answers");
            }
        } catch (err) {
            console.error("Error submitting:", err);
            setError("Connection error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
        );
    }

    if (error || !assignment) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-6">
                <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                <p className="text-white text-lg mb-4">{error || "Assignment not found"}</p>
                <button
                    onClick={() => router.push("/student/dashboard")}
                    className="px-4 py-2 rounded-lg bg-sky-600 text-white"
                >
                    Back to Inbox
                </button>
            </div>
        );
    }

    // Show result screen
    if (result) {
        const scorePercent = result.score_percent;
        const scoreColor = scorePercent >= 80 ? "text-emerald-400" : scorePercent >= 60 ? "text-yellow-400" : "text-red-400";

        return (
            <div className="min-h-screen bg-gray-950">
                <div className="mx-auto max-w-2xl px-6 py-12">
                    {/* Result Card */}
                    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-8 text-center mb-8">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 mx-auto mb-6">
                            <Trophy className={`h-10 w-10 ${scoreColor}`} />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">Practice Complete!</h1>
                        <p className={`text-4xl font-bold ${scoreColor} mb-4`}>
                            {result.score}/{result.total} ({Math.round(scorePercent)}%)
                        </p>
                        <p className="text-gray-300">{result.feedback}</p>
                    </div>

                    {/* Question Review */}
                    <h2 className="text-lg font-bold text-white mb-4">Review Your Answers</h2>
                    <div className="space-y-4">
                        {result.results.map((r, idx) => (
                            <div
                                key={idx}
                                className={`rounded-xl p-4 border ${
                                    r.is_correct
                                        ? "bg-emerald-500/10 border-emerald-500/30"
                                        : "bg-red-500/10 border-red-500/30"
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 ${
                                            r.is_correct ? "bg-emerald-500" : "bg-red-500"
                                        }`}
                                    >
                                        {r.is_correct ? (
                                            <Check className="h-4 w-4 text-white" />
                                        ) : (
                                            <X className="h-4 w-4 text-white" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white font-medium mb-2">
                                            {assignment.practice_questions[idx]?.prompt}
                                        </p>
                                        <div className="text-sm space-y-1">
                                            <p className={r.is_correct ? "text-emerald-400" : "text-red-400"}>
                                                Your answer: {r.student_answer || "No answer"}
                                            </p>
                                            {!r.is_correct && (
                                                <p className="text-emerald-400">
                                                    Correct answer: {r.correct_answer}
                                                </p>
                                            )}
                                        </div>
                                        {r.explanation && (
                                            <p className="mt-2 text-sm text-gray-400 italic">
                                                {r.explanation}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="mt-8 flex justify-center gap-4">
                        <button
                            onClick={() => router.push("/student/dashboard")}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-800 text-white hover:bg-gray-700"
                        >
                            <ArrowLeft className="h-5 w-5" />
                            Back to Inbox
                        </button>
                        <button
                            onClick={() => router.push("/student")}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-600 text-white hover:bg-sky-500"
                        >
                            Done
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Show intro screen for pending assignments
    if (assignment.status === "pending") {
        return (
            <div className="min-h-screen bg-gray-950">
                <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                    <div className="mx-auto max-w-2xl px-6 py-4">
                        <Link
                            href="/student/dashboard"
                            className="flex items-center gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-5 w-5" />
                            Back to Inbox
                        </Link>
                    </div>
                </header>

                <main className="mx-auto max-w-2xl px-6 py-12">
                    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-8 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/20 mx-auto mb-6">
                            <BookOpen className="h-8 w-8 text-pink-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">{assignment.title}</h1>
                        <p className="text-gray-400 mb-6">
                            {assignment.question_count} practice questions from your teacher
                        </p>

                        {assignment.note && (
                            <div className="mb-6 p-4 rounded-xl bg-gray-800 text-left">
                                <div className="flex items-center gap-2 text-sky-400 mb-2">
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="text-sm font-medium">Note from teacher</span>
                                </div>
                                <p className="text-gray-300">{assignment.note}</p>
                            </div>
                        )}

                        <button
                            onClick={handleStartPractice}
                            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-400 transition-colors"
                        >
                            Start Practice
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // Practice screen (in_progress)
    const question = assignment.practice_questions[currentQuestion];
    const totalQuestions = assignment.practice_questions.length;
    const answeredCount = Object.keys(selectedAnswers).length;
    const isLastQuestion = currentQuestion === totalQuestions - 1;
    const allAnswered = answeredCount === totalQuestions;

    // Guard against undefined question
    if (!question) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header with progress */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="mx-auto max-w-2xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">
                            Question {currentQuestion + 1} of {totalQuestions}
                        </div>
                        <div className="text-sm text-gray-400">
                            {answeredCount}/{totalQuestions} answered
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1 rounded-full bg-gray-800">
                        <div
                            className="h-full rounded-full bg-pink-500 transition-all"
                            style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
                        />
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-6 py-8">
                {/* Question */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-white mb-6">{question.prompt}</h2>

                    {/* Options */}
                    <div className="space-y-3">
                        {Object.entries(question.options).map(([key, value]) => {
                            const isSelected = selectedAnswers[currentQuestion] === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => handleSelectAnswer(key)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                                        isSelected
                                            ? "bg-pink-500/20 border-pink-500 text-white"
                                            : "bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-600"
                                    }`}
                                >
                                    <span
                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg mr-3 text-sm font-bold ${
                                            isSelected
                                                ? "bg-pink-500 text-white"
                                                : "bg-gray-800 text-gray-400"
                                        }`}
                                    >
                                        {key}
                                    </span>
                                    {value}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={currentQuestion === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Previous
                    </button>

                    {isLastQuestion ? (
                        <button
                            onClick={handleSubmit}
                            disabled={!allAnswered || isSubmitting}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    Submit Answers
                                    <Check className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-400"
                        >
                            Next
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Question dots */}
                <div className="mt-8 flex justify-center gap-2">
                    {assignment.practice_questions.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentQuestion(idx)}
                            className={`h-3 w-3 rounded-full transition-all ${
                                idx === currentQuestion
                                    ? "bg-pink-500 scale-125"
                                    : selectedAnswers[idx]
                                    ? "bg-pink-500/50"
                                    : "bg-gray-700"
                            }`}
                        />
                    ))}
                </div>
            </main>
        </div>
    );
}

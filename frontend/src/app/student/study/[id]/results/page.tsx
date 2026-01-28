"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Trophy,
    Clock,
    Target,
    Play,
    Check,
    X,
    Loader2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PracticeResult {
    session_id: string;
    quiz_title: string;
    total_questions: number;
    correct_answers: number;
    score_percentage: number;
    total_points: number;
    time_taken_seconds: number;
    answers: Array<{
        question_id: string;
        question_text: string;
        your_answer: string;
        correct_answer: string;
        is_correct: boolean;
        explanation: string | null;
        points_earned: number;
        response_time_ms: number;
    }>;
    completed_at: string;
}

export default function ResultsPage() {
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;
    const { token, isLoading: authLoading } = useAuth();

    const [results, setResults] = useState<PracticeResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedResult, setExpandedResult] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && token) {
            fetchResults();
        }
    }, [authLoading, token, quizId]);

    const fetchResults = async () => {
        try {
            const response = await fetch(
                `${API_URL}/student/quizzes/${quizId}/results`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setResults(data);
                // Expand the most recent result by default
                if (data.length > 0) {
                    setExpandedResult(data[0].session_id);
                }
            }
        } catch (error) {
            console.error("Failed to fetch results:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getScoreColor = (percentage: number) => {
        if (percentage >= 80) return "text-emerald-400";
        if (percentage >= 60) return "text-yellow-400";
        return "text-red-400";
    };

    const getScoreBg = (percentage: number) => {
        if (percentage >= 80) return "bg-emerald-500";
        if (percentage >= 60) return "bg-yellow-500";
        return "bg-red-500";
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/student/study"
                            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-semibold">Practice History</h1>
                    </div>
                    <Link
                        href={`/student/study/${quizId}/practice`}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors"
                    >
                        <Play className="w-4 h-4" />
                        Practice Again
                    </Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                {results.length === 0 ? (
                    <div className="text-center py-16">
                        <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">No results yet</h2>
                        <p className="text-gray-400 mb-6">
                            Complete a practice session to see your results here.
                        </p>
                        <Link
                            href={`/student/study/${quizId}/practice`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors"
                        >
                            <Play className="w-5 h-5" />
                            Start Practice
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {results.map((result, index) => {
                            const isExpanded = expandedResult === result.session_id;
                            const isLatest = index === 0;

                            return (
                                <div
                                    key={result.session_id}
                                    className={`bg-gray-900 border rounded-xl overflow-hidden ${
                                        isLatest ? "border-emerald-500/50" : "border-gray-800"
                                    }`}
                                >
                                    {/* Summary Header */}
                                    <button
                                        onClick={() =>
                                            setExpandedResult(isExpanded ? null : result.session_id)
                                        }
                                        className="w-full p-5 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg ${getScoreBg(
                                                    result.score_percentage
                                                )}`}
                                            >
                                                {result.score_percentage.toFixed(0)}%
                                            </div>
                                            <div className="text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">
                                                        {result.correct_answers} / {result.total_questions} correct
                                                    </span>
                                                    {isLatest && (
                                                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                                            Latest
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-400 flex items-center gap-3 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatTime(result.time_taken_seconds)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Trophy className="w-3.5 h-3.5" />
                                                        {result.total_points} pts
                                                    </span>
                                                    <span>{formatDate(result.completed_at)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>

                                    {/* Expanded Details */}
                                    {isExpanded && result.answers.length > 0 && (
                                        <div className="border-t border-gray-800 p-5 space-y-4">
                                            {result.answers.map((answer, i) => (
                                                <div
                                                    key={answer.question_id}
                                                    className={`p-4 rounded-lg border ${
                                                        answer.is_correct
                                                            ? "bg-emerald-900/10 border-emerald-500/30"
                                                            : "bg-red-900/10 border-red-500/30"
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div
                                                            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                                answer.is_correct
                                                                    ? "bg-emerald-500"
                                                                    : "bg-red-500"
                                                            }`}
                                                        >
                                                            {answer.is_correct ? (
                                                                <Check className="w-4 h-4" />
                                                            ) : (
                                                                <X className="w-4 h-4" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm text-gray-400 mb-1">
                                                                Question {i + 1}
                                                            </p>
                                                            <p className="font-medium mb-2">
                                                                {answer.question_text}
                                                            </p>
                                                            <div className="text-sm space-y-1">
                                                                <p>
                                                                    <span className="text-gray-400">Your answer: </span>
                                                                    <span
                                                                        className={
                                                                            answer.is_correct
                                                                                ? "text-emerald-400"
                                                                                : "text-red-400"
                                                                        }
                                                                    >
                                                                        {answer.your_answer}
                                                                    </span>
                                                                </p>
                                                                {!answer.is_correct && (
                                                                    <p>
                                                                        <span className="text-gray-400">
                                                                            Correct answer:{" "}
                                                                        </span>
                                                                        <span className="text-emerald-400">
                                                                            {answer.correct_answer}
                                                                        </span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {answer.explanation && (
                                                                <p className="text-sm text-gray-400 mt-2 pt-2 border-t border-gray-700">
                                                                    {answer.explanation}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-right text-sm">
                                                            <span className="text-yellow-400">
                                                                +{answer.points_earned}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, BookOpen, Lock, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Quiz {
    id: string;
    title: string;
    description: string | null;
    subject: string | null;
    question_count: number;
}

export default function JoinPracticePage() {
    const router = useRouter();
    const params = useParams();
    const quizId = params.quizId as string;
    const { isAuthenticated, user } = useAuth();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [nickname, setNickname] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        // If already authenticated, redirect to practice
        if (isAuthenticated && user?.name) {
            router.push(`/practice/${quizId}`);
            return;
        }

        // Check if already has guest name in session
        const existingName = sessionStorage.getItem("quizly_guest_name");
        if (existingName) {
            router.push(`/practice/${quizId}`);
            return;
        }

        fetchQuiz();
    }, [quizId, isAuthenticated, user]);

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

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = nickname.trim();
        if (!trimmedName) return;

        setJoining(true);

        // Store name in session storage
        sessionStorage.setItem("quizly_guest_name", trimmedName);

        // Navigate to practice page
        router.push(`/practice/${quizId}`);
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

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/50">
                <div className="max-w-lg mx-auto px-4 py-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Link>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md">
                    {/* Quiz info card */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-600/20 mb-4">
                            <BookOpen className="w-8 h-8 text-sky-400" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">{quiz?.title}</h1>
                        {quiz?.description && (
                            <p className="text-gray-400 mb-2">{quiz.description}</p>
                        )}
                        <p className="text-sm text-gray-500">
                            {quiz?.question_count} questions
                            {quiz?.subject && ` • ${quiz.subject}`}
                        </p>
                    </div>

                    {/* Join form */}
                    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                        <form onSubmit={handleJoin} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Enter your name to start
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="Your name"
                                        maxLength={30}
                                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!nickname.trim() || joining}
                                className="w-full py-4 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                {joining ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Starting...
                                    </>
                                ) : (
                                    <>
                                        Start Practice
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Sign in option */}
                        <div className="mt-6 pt-6 border-t border-gray-800 text-center">
                            <p className="text-sm text-gray-400 mb-3">
                                Have an account? Sign in to save your progress
                            </p>
                            <Link
                                href={`/sign-in?redirect_url=/practice/${quizId}`}
                                className="text-sky-400 hover:text-sky-300 text-sm font-medium"
                            >
                                Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    PlusCircle,
    Users,
    Trophy,
    Sparkles,
    Loader2,
    Gamepad2,
    Pencil,
    Trash2,
    BarChart3,
    Copy,
    Check,
    Share2,
    ExternalLink,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Quiz {
    id: string;
    title: string;
    question_count: number;
    times_played: number;
}

interface Game {
    id: string;
    game_code: string;
    quiz_id: string;
    quiz_title: string;
    status: string;
    sync_mode: boolean;
    player_count: number;
    created_at: string;
}

export default function TeacherDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [allGames, setAllGames] = useState<Game[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [creatingGame, setCreatingGame] = useState<string | null>(null);
    const [deletingQuiz, setDeletingQuiz] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
            return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        try {
            const [quizzesRes, gamesRes] = await Promise.all([
                fetch(`${API_URL}/quizzes/`, { headers }),
                fetch(`${API_URL}/games/`, { headers })
            ]);

            if (quizzesRes.ok) {
                setQuizzes(await quizzesRes.json());
            }
            if (gamesRes.ok) {
                setAllGames(await gamesRes.json());
            }
        } catch (err) {
            console.error("Failed to fetch data:", err);
        }
        setIsLoading(false);
    }

    // Get or create async game for a quiz
    const getGameForQuiz = (quizId: string): Game | undefined => {
        return allGames.find(g => g.quiz_id === quizId && g.status !== "finished");
    };

    const createGame = async (quizId: string) => {
        setCreatingGame(quizId);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ quiz_id: quizId, sync_mode: false }),
            });
            if (response.ok) {
                const game = await response.json();
                setAllGames(prev => [...prev, game]);
                copyCode(game.game_code);
            }
        } catch (error) {
            console.error("Failed to create game:", error);
        }
        setCreatingGame(null);
    };

    const deleteQuiz = async (quizId: string) => {
        if (!confirm("Are you sure you want to delete this quiz?")) return;

        setDeletingQuiz(quizId);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/quizzes/${quizId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                setQuizzes(quizzes.filter(q => q.id !== quizId));
            } else {
                alert("Failed to delete quiz");
            }
        } catch (error) {
            console.error("Failed to delete quiz:", error);
            alert("Failed to delete quiz");
        }
        setDeletingQuiz(null);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const getJoinUrl = (code: string) => {
        if (typeof window !== "undefined") {
            return `${window.location.origin}/join?code=${code}`;
        }
        return "";
    };

    const shareQuiz = async (code: string, title: string) => {
        const url = getJoinUrl(code);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${title} on Quizly`,
                    text: `Use code ${code} to join!`,
                    url: url,
                });
            } catch {
                copyCode(code);
            }
        } else {
            copyCode(code);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="border-b bg-white">
                <div className="mx-auto max-w-5xl px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">My Quizzes</h1>
                            <p className="text-gray-500">Create and share quizzes with your students</p>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                href="/teacher/quizzes/new"
                                className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 font-medium text-white hover:bg-purple-700 transition-colors"
                            >
                                <Sparkles className="h-4 w-4" />
                                Create Quiz
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-6 py-8">
                {quizzes.length === 0 ? (
                    <div className="rounded-2xl bg-white p-16 text-center border border-gray-200">
                        <Gamepad2 className="mx-auto h-16 w-16 text-gray-300" />
                        <h3 className="mt-6 text-xl font-semibold text-gray-900">No quizzes yet</h3>
                        <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                            Create your first quiz with AI - just describe what you want and we'll generate it
                        </p>
                        <Link
                            href="/teacher/quizzes/new"
                            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
                        >
                            <PlusCircle className="h-5 w-5" />
                            Create Your First Quiz
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {quizzes.map((quiz) => {
                            const game = getGameForQuiz(quiz.id);
                            const isCreating = creatingGame === quiz.id;

                            return (
                                <div
                                    key={quiz.id}
                                    className="rounded-xl bg-white border border-gray-200 p-6 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Quiz Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                                                {quiz.title}
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                {quiz.question_count} questions
                                            </p>
                                        </div>

                                        {/* Game Code / Share Section */}
                                        <div className="flex items-center gap-3">
                                            {game ? (
                                                <>
                                                    {/* Code Display */}
                                                    <div className="flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-200 px-4 py-2">
                                                        <span className="text-sm text-purple-600 font-medium">Code:</span>
                                                        <span className="font-mono text-lg font-bold text-purple-700">
                                                            {game.game_code}
                                                        </span>
                                                        <button
                                                            onClick={() => copyCode(game.game_code)}
                                                            className="p-1 rounded hover:bg-purple-100 text-purple-600"
                                                            title="Copy code"
                                                        >
                                                            {copiedCode === game.game_code ? (
                                                                <Check className="h-4 w-4" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>

                                                    {/* Share Button */}
                                                    <button
                                                        onClick={() => shareQuiz(game.game_code, quiz.title)}
                                                        className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
                                                    >
                                                        <Share2 className="h-4 w-4" />
                                                        Share
                                                    </button>

                                                    {/* Results */}
                                                    <Link
                                                        href={`/teacher/game/${game.id}/results`}
                                                        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <BarChart3 className="h-4 w-4" />
                                                        Results
                                                        {game.player_count > 0 && (
                                                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                                                {game.player_count}
                                                            </span>
                                                        )}
                                                    </Link>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => createGame(quiz.id)}
                                                    disabled={isCreating}
                                                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                                                >
                                                    {isCreating ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Creating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Share2 className="h-4 w-4" />
                                                            Get Share Code
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            {/* Edit/Delete */}
                                            <div className="flex items-center border-l border-gray-200 pl-3 ml-1">
                                                <Link
                                                    href={`/teacher/quizzes/${quiz.id}/edit`}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                                    title="Edit quiz"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => deleteQuiz(quiz.id)}
                                                    disabled={deletingQuiz === quiz.id}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                    title="Delete quiz"
                                                >
                                                    {deletingQuiz === quiz.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Student count for active games */}
                                    {game && game.player_count > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
                                            <Users className="h-4 w-4" />
                                            <span>{game.player_count} students have joined</span>
                                            <span className="text-green-500">● Active</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

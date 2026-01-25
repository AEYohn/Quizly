"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Play,
    PlusCircle,
    Users,
    Trophy,
    Sparkles,
    Loader2,
    ChevronRight,
    Gamepad2,
    Clock,
    Zap,
    MoreVertical,
    Pencil,
    Trash2,
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
    code: string;
    quiz_title: string;
    status: string;
    player_count: number;
    created_at: string;
}

export default function TeacherDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [activeGames, setActiveGames] = useState<Game[]>([]);
    const [recentGames, setRecentGames] = useState<Game[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startingGame, setStartingGame] = useState<string | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [deletingQuiz, setDeletingQuiz] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenDropdown(null);
        if (openDropdown) {
            document.addEventListener("click", handleClickOutside);
            return () => document.removeEventListener("click", handleClickOutside);
        }
    }, [openDropdown]);

    async function fetchData() {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
            return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        try {
            // Fetch quizzes
            const quizzesRes = await fetch(`${API_URL}/quizzes/`, { headers });
            if (quizzesRes.ok) {
                const data = await quizzesRes.json();
                setQuizzes(data.slice(0, 6));
            }

            // Fetch games
            const gamesRes = await fetch(`${API_URL}/games/`, { headers });
            if (gamesRes.ok) {
                const games = await gamesRes.json();
                setActiveGames(games.filter((g: Game) => g.status === "lobby" || g.status === "question"));
                setRecentGames(games.filter((g: Game) => g.status === "finished").slice(0, 5));
            }
        } catch (err) {
            console.error("Failed to fetch data:", err);
        }
        setIsLoading(false);
    }

    const startGame = async (quizId: string) => {
        setStartingGame(quizId);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ quiz_id: quizId }),
            });
            if (response.ok) {
                const game = await response.json();
                router.push(`/teacher/game/${game.id}/lobby`);
            }
        } catch (error) {
            console.error("Failed to start game:", error);
        }
        setStartingGame(null);
    };

    const deleteQuiz = async (quizId: string) => {
        if (!confirm("Are you sure you want to delete this quiz?")) return;

        setDeletingQuiz(quizId);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/quizzes/${quizId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                setQuizzes(quizzes.filter(q => q.id !== quizId));
            }
        } catch (error) {
            console.error("Failed to delete quiz:", error);
        }
        setDeletingQuiz(null);
        setOpenDropdown(null);
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="mt-1 text-gray-500">Create quizzes with AI and host live games</p>
                </div>

                {/* Active Games Banner */}
                {activeGames.length > 0 && (
                    <div className="mb-8 space-y-3">
                        {activeGames.map((game) => (
                            <div
                                key={game.id}
                                className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white shadow-lg"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                                            <div className="h-3 w-3 animate-pulse rounded-full bg-white" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold uppercase tracking-wide text-white/80">
                                                    Live Game
                                                </span>
                                                <span className="rounded bg-white/20 px-2 py-0.5 text-sm font-mono font-bold">
                                                    {game.code}
                                                </span>
                                            </div>
                                            <h2 className="text-xl font-bold">{game.quiz_title}</h2>
                                            <p className="text-white/80">{game.player_count} players joined</p>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/teacher/game/${game.id}/${game.status === "lobby" ? "lobby" : "host"}`}
                                        className="rounded-xl bg-white px-6 py-3 font-bold text-green-600 shadow-lg transition-transform hover:scale-105"
                                    >
                                        {game.status === "lobby" ? "Open Lobby" : "Control Game"}
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Actions */}
                <div className="mb-8 grid grid-cols-2 gap-4">
                    <Link
                        href="/teacher/quizzes/new"
                        className="group rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-white shadow-lg transition-transform hover:scale-[1.02]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20">
                                <Sparkles className="h-7 w-7" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Create Quiz with AI</h3>
                                <p className="text-purple-100">Generate questions instantly</p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm text-purple-200">
                            <Zap className="h-4 w-4" />
                            Powered by Gemini
                        </div>
                    </Link>

                    <Link
                        href="/teacher/coding/new"
                        className="group rounded-2xl bg-white p-6 border-2 border-gray-200 shadow-sm transition-all hover:border-purple-300 hover:shadow-md"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 group-hover:bg-purple-100 transition-colors">
                                <span className="text-2xl">{"</>"}</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Coding Challenge</h3>
                                <p className="text-gray-500">LeetCode-style problems</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Quick Start Games */}
                {quizzes.length > 0 && (
                    <div className="mb-8">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">Quick Start</h2>
                            <Link href="/teacher/quizzes" className="text-sm text-purple-600 hover:underline">
                                View all quizzes →
                            </Link>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {quizzes.map((quiz) => (
                                <div
                                    key={quiz.id}
                                    className="rounded-xl bg-white p-4 border border-gray-200 shadow-sm relative"
                                >
                                    {/* Dropdown Menu */}
                                    <div className="absolute top-2 right-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenDropdown(openDropdown === quiz.id ? null : quiz.id);
                                            }}
                                            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <MoreVertical className="h-4 w-4 text-gray-500" />
                                        </button>
                                        {openDropdown === quiz.id && (
                                            <div className="absolute right-0 mt-1 w-36 rounded-lg bg-white border border-gray-200 shadow-lg z-10">
                                                <Link
                                                    href={`/teacher/quizzes/${quiz.id}/edit`}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                                                    onClick={() => setOpenDropdown(null)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Edit
                                                </Link>
                                                <button
                                                    onClick={() => deleteQuiz(quiz.id)}
                                                    disabled={deletingQuiz === quiz.id}
                                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
                                                >
                                                    {deletingQuiz === quiz.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="font-semibold text-gray-900 truncate pr-6">{quiz.title}</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {quiz.question_count} questions
                                    </p>
                                    <button
                                        onClick={() => startGame(quiz.id)}
                                        disabled={startingGame === quiz.id}
                                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {startingGame === quiz.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Play className="h-4 w-4" />
                                                Start Game
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {quizzes.length === 0 && (
                    <div className="rounded-2xl bg-white p-12 text-center border-2 border-dashed border-gray-200">
                        <Gamepad2 className="mx-auto h-12 w-12 text-gray-300" />
                        <h3 className="mt-4 text-lg font-semibold text-gray-900">No quizzes yet</h3>
                        <p className="mt-2 text-gray-500">Create your first quiz with AI to get started</p>
                        <Link
                            href="/teacher/quizzes/new"
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
                        >
                            <PlusCircle className="h-5 w-5" />
                            Create Quiz
                        </Link>
                    </div>
                )}

                {/* Recent Games */}
                {recentGames.length > 0 && (
                    <div>
                        <h2 className="mb-4 text-lg font-bold text-gray-900">Recent Games</h2>
                        <div className="rounded-xl bg-white border border-gray-200 divide-y divide-gray-100">
                            {recentGames.map((game) => (
                                <Link
                                    key={game.id}
                                    href={`/teacher/game/${game.id}/results`}
                                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                                            <Trophy className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{game.quiz_title}</p>
                                            <p className="text-sm text-gray-500">
                                                {game.player_count} players
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-gray-400" />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

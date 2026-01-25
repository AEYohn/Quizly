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
    BarChart3,
    Copy,
    Check,
    Hash,
    Calendar,
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
    const [startingGame, setStartingGame] = useState<string | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [deletingQuiz, setDeletingQuiz] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"quizzes" | "games">("quizzes");

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
                setQuizzes(data);
            }

            // Fetch games
            const gamesRes = await fetch(`${API_URL}/games/`, { headers });
            if (gamesRes.ok) {
                const games = await gamesRes.json();
                setAllGames(games);
            }
        } catch (err) {
            console.error("Failed to fetch data:", err);
        }
        setIsLoading(false);
    }

    const activeGames = allGames.filter((g) => g.status === "lobby" || g.status === "question");
    const recentGames = allGames.filter((g) => g.status === "finished");

    // Find existing async game for a quiz (not finished)
    const getAsyncGameForQuiz = (quizId: string) => {
        return allGames.find(g => g.quiz_id === quizId && g.sync_mode === false && g.status !== "finished");
    };

    // Start a LIVE (sync) game - new code each time
    const startLiveGame = async (quizId: string) => {
        setStartingGame(quizId);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ quiz_id: quizId, sync_mode: true }),
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

    // Create or get async (homework) game - reuses existing code
    const getOrCreateAsyncGame = async (quizId: string) => {
        // Check if async game already exists
        const existingGame = getAsyncGameForQuiz(quizId);
        if (existingGame) {
            copyCode(existingGame.game_code);
            return;
        }

        // Create new async game
        setStartingGame(quizId);
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
                setAllGames([...allGames, { ...game, quiz_id: quizId, quiz_title: quizzes.find(q => q.id === quizId)?.title || "" }]);
                copyCode(game.game_code);
            }
        } catch (error) {
            console.error("Failed to create async game:", error);
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
                    "Content-Type": "application/json",
                },
            });
            if (response.ok) {
                setQuizzes(quizzes.filter(q => q.id !== quizId));
            } else {
                const errorText = await response.text();
                try {
                    const error = JSON.parse(errorText);
                    alert(`Failed to delete: ${error.detail || response.statusText}`);
                } catch {
                    alert(`Failed to delete: ${response.status} ${response.statusText}`);
                }
            }
        } catch (error: unknown) {
            console.error("Failed to delete quiz:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            alert(`Network error: ${message}`);
        }
        setDeletingQuiz(null);
        setOpenDropdown(null);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <p className="mt-1 text-gray-500">Create quizzes with AI and host live games</p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/teacher/quizzes/new"
                            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700"
                        >
                            <Sparkles className="h-4 w-4" />
                            Create Quiz
                        </Link>
                        <Link
                            href="/teacher/coding/new"
                            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                        >
                            {"</>"}
                            <span>Coding Challenge</span>
                        </Link>
                    </div>
                </div>

                {/* Active Games Banner */}
                {activeGames.length > 0 && (
                    <div className="mb-6 space-y-3">
                        {activeGames.map((game) => (
                            <div
                                key={game.id}
                                className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white shadow-lg"
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
                                                <button
                                                    onClick={() => copyCode(game.game_code)}
                                                    className="flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-sm font-mono font-bold hover:bg-white/30 transition-colors"
                                                >
                                                    {game.game_code}
                                                    {copiedCode === game.game_code ? (
                                                        <Check className="h-3 w-3" />
                                                    ) : (
                                                        <Copy className="h-3 w-3" />
                                                    )}
                                                </button>
                                            </div>
                                            <h2 className="text-xl font-bold">{game.quiz_title}</h2>
                                            <p className="text-white/80">{game.player_count} players joined</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/teacher/game/${game.id}/results`}
                                            className="rounded-xl bg-white/20 px-4 py-3 font-bold text-white hover:bg-white/30 transition-colors"
                                        >
                                            <BarChart3 className="h-5 w-5" />
                                        </Link>
                                        <Link
                                            href={`/teacher/game/${game.id}/${game.status === "lobby" ? "lobby" : "host"}`}
                                            className="rounded-xl bg-white px-6 py-3 font-bold text-green-600 shadow-lg transition-transform hover:scale-105"
                                        >
                                            {game.status === "lobby" ? "Open Lobby" : "Control Game"}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
                    <button
                        onClick={() => setActiveTab("quizzes")}
                        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "quizzes"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        My Quizzes ({quizzes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("games")}
                        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "games"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        My Games ({allGames.length})
                    </button>
                </div>

                {/* Quizzes Tab */}
                {activeTab === "quizzes" && (
                    <>
                        {quizzes.length === 0 ? (
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
                        ) : (
                            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Homework Code</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {quizzes.map((quiz) => {
                                            const asyncGame = getAsyncGameForQuiz(quiz.id);
                                            return (
                                                <tr key={quiz.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4">
                                                        <p className="font-medium text-gray-900">{quiz.title}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500">
                                                        {quiz.question_count} questions
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {asyncGame ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => copyCode(asyncGame.game_code)}
                                                                    className="flex items-center gap-1 rounded bg-purple-100 px-3 py-1 font-mono text-sm font-bold text-purple-700 hover:bg-purple-200 transition-colors"
                                                                >
                                                                    {asyncGame.game_code}
                                                                    {copiedCode === asyncGame.game_code ? (
                                                                        <Check className="h-3 w-3" />
                                                                    ) : (
                                                                        <Copy className="h-3 w-3" />
                                                                    )}
                                                                </button>
                                                                <Link
                                                                    href={`/teacher/game/${asyncGame.id}/results`}
                                                                    className="text-purple-600 hover:text-purple-800"
                                                                    title="View Results"
                                                                >
                                                                    <BarChart3 className="h-4 w-4" />
                                                                </Link>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => getOrCreateAsyncGame(quiz.id)}
                                                                disabled={startingGame === quiz.id}
                                                                className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
                                                            >
                                                                + Create homework link
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Link
                                                                href={`/teacher/quizzes/${quiz.id}/edit`}
                                                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                                                title="Edit"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Link>
                                                            <button
                                                                onClick={() => deleteQuiz(quiz.id)}
                                                                disabled={deletingQuiz === quiz.id}
                                                                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                                                                title="Delete"
                                                            >
                                                                {deletingQuiz === quiz.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => startLiveGame(quiz.id)}
                                                                disabled={startingGame === quiz.id}
                                                                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                                            >
                                                                {startingGame === quiz.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <Play className="h-4 w-4" />
                                                                        Live Game
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* Games Tab */}
                {activeTab === "games" && (
                    <>
                        {allGames.length === 0 ? (
                            <div className="rounded-2xl bg-white p-12 text-center border-2 border-dashed border-gray-200">
                                <Trophy className="mx-auto h-12 w-12 text-gray-300" />
                                <h3 className="mt-4 text-lg font-semibold text-gray-900">No games yet</h3>
                                <p className="mt-2 text-gray-500">Start a game from one of your quizzes</p>
                            </div>
                        ) : (
                            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {allGames.map((game) => (
                                            <tr key={game.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-gray-900">{game.quiz_title}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => copyCode(game.game_code)}
                                                        className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 font-mono text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
                                                    >
                                                        {game.game_code}
                                                        {copiedCode === game.game_code ? (
                                                            <Check className="h-3 w-3 text-green-600" />
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium w-fit ${
                                                            game.status === "lobby" || game.status === "question"
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-gray-100 text-gray-600"
                                                        }`}>
                                                            {(game.status === "lobby" || game.status === "question") && (
                                                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                            )}
                                                            {game.status === "lobby" ? "In Lobby" :
                                                             game.status === "question" ? "Live" :
                                                             "Finished"}
                                                        </span>
                                                        <span className={`text-xs ${game.sync_mode === false ? "text-purple-600" : "text-gray-400"}`}>
                                                            {game.sync_mode === false ? "Homework (async)" : "Live session"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    <div className="flex items-center gap-1">
                                                        <Users className="h-4 w-4" />
                                                        {game.player_count}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {formatDate(game.created_at)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            href={`/teacher/game/${game.id}/results`}
                                                            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50"
                                                        >
                                                            <BarChart3 className="h-4 w-4" />
                                                            Analytics
                                                        </Link>
                                                        {(game.status === "lobby" || game.status === "question") && (
                                                            <Link
                                                                href={`/teacher/game/${game.id}/${game.status === "lobby" ? "lobby" : "host"}`}
                                                                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                                                            >
                                                                <Play className="h-4 w-4" />
                                                                {game.status === "lobby" ? "Lobby" : "Control"}
                                                            </Link>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

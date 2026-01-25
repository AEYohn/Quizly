"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Sparkles,
    Search,
    Play,
    Clock,
    Users,
    BookOpen,
    Trophy,
    ArrowRight,
    Loader2,
    Gamepad2,
    Code2,
    LogOut,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Quiz {
    id: string;
    title: string;
    description: string | null;
    subject: string | null;
    question_count: number;
    times_played: number;
}

interface ActiveGame {
    id: string;
    game_code: string;
    quiz_title: string;
    player_count: number;
    status: string;
}

export default function StudentDashboard() {
    const router = useRouter();
    const [studentName, setStudentName] = useState("");
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [joiningGame, setJoiningGame] = useState(false);
    const [joinError, setJoinError] = useState("");

    useEffect(() => {
        const name = localStorage.getItem("quizly_student_name");
        if (!name) {
            router.push("/student");
            return;
        }
        setStudentName(name);
        fetchData();
    }, [router]);

    const fetchData = async () => {
        try {
            // Fetch public quizzes
            const quizzesRes = await fetch(`${API_URL}/quizzes/public`);
            if (quizzesRes.ok) {
                const data = await quizzesRes.json();
                setQuizzes(data);
            }

            // Fetch active games (lobby status)
            try {
                const gamesRes = await fetch(`${API_URL}/games/lobby`);
                if (gamesRes.ok) {
                    const data = await gamesRes.json();
                    setActiveGames(data);
                }
            } catch {
                // Games endpoint may not exist, that's okay
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinWithCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;

        setJoiningGame(true);
        setJoinError("");

        try {
            const response = await fetch(`${API_URL}/games/code/${joinCode.toUpperCase()}`);
            if (response.ok) {
                const game = await response.json();
                if (game.status !== "lobby") {
                    setJoinError("This game has already started!");
                    setJoiningGame(false);
                    return;
                }

                // Join the game using /games/join endpoint with game_code
                const joinRes = await fetch(`${API_URL}/games/join`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        game_code: joinCode.toUpperCase(),
                        nickname: studentName
                    }),
                });

                if (joinRes.ok) {
                    const joinData = await joinRes.json();
                    sessionStorage.setItem("playerId", joinData.player_id);
                    sessionStorage.setItem("nickname", studentName);
                    sessionStorage.setItem("gameId", joinData.game_id);
                    router.push(`/play/${joinData.game_id}`);
                } else {
                    const error = await joinRes.json();
                    setJoinError(error.detail || "Couldn't join the game");
                }
            } else {
                setJoinError("Game not found. Check your code!");
            }
        } catch (error) {
            setJoinError("Connection failed. Try again!");
        } finally {
            setJoiningGame(false);
        }
    };

    const joinActiveGame = async (gameId: string) => {
        try {
            const response = await fetch(`${API_URL}/games/${gameId}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nickname: studentName }),
            });

            if (response.ok) {
                const data = await response.json();
                sessionStorage.setItem("playerId", data.player_id);
                sessionStorage.setItem("nickname", studentName);
                sessionStorage.setItem("gameId", gameId);
                router.push(`/play/${gameId}`);
            } else {
                const error = await response.json();
                alert(error.detail || "Couldn't join");
            }
        } catch (error) {
            alert("Failed to join game");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("quizly_student_name");
        sessionStorage.clear();
        router.push("/student");
    };

    const filteredQuizzes = quizzes.filter(
        (quiz) =>
            quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            quiz.subject?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="mx-auto max-w-6xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-xl">
                                <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-white">Quizly</h1>
                                <p className="text-xs text-gray-400">Welcome, {studentName}!</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/student/learning"
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sky-400 hover:bg-gray-800 font-medium"
                            >
                                <BookOpen className="h-4 w-4" />
                                My Learning
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                            >
                                <LogOut className="h-4 w-4" />
                                Switch User
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-8">
                {/* Join with Code */}
                <div className="mb-8 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 p-6 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold mb-1">Join a Live Game</h2>
                            <p className="text-sky-200">Enter the game code from your teacher</p>
                        </div>
                        <form onSubmit={handleJoinWithCode} className="flex gap-3">
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="ABC123"
                                maxLength={6}
                                className="w-32 rounded-xl bg-white/20 px-4 py-3 text-center text-lg font-bold tracking-widest placeholder-white/50 focus:bg-white/30 focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={joiningGame || joinCode.length < 4}
                                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-sky-600 transition-all hover:bg-sky-50 disabled:opacity-50"
                            >
                                {joiningGame ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        Join
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                    {joinError && (
                        <p className="mt-3 text-sm text-red-200">{joinError}</p>
                    )}
                </div>

                {/* Active Games */}
                {activeGames.length > 0 && (
                    <section className="mb-8">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                            <Gamepad2 className="h-5 w-5 text-emerald-400" />
                            Live Games
                        </h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {activeGames.map((game) => (
                                <div
                                    key={game.id}
                                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 transition-all hover:bg-emerald-500/20"
                                >
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white animate-pulse">
                                            LIVE
                                        </span>
                                        <span className="font-mono text-lg font-bold text-emerald-400">
                                            {game.game_code}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-white mb-2">{game.quiz_title}</h3>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1 text-sm text-gray-400">
                                            <Users className="h-4 w-4" />
                                            {game.player_count} players
                                        </span>
                                        <button
                                            onClick={() => joinActiveGame(game.id)}
                                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                                        >
                                            <Play className="h-4 w-4" />
                                            Join
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Browse Quizzes */}
                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                            <BookOpen className="h-5 w-5 text-sky-400" />
                            Browse Quizzes
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="rounded-lg border border-gray-700 bg-gray-800 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex h-48 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                        </div>
                    ) : filteredQuizzes.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-gray-700 bg-gray-900 p-12 text-center">
                            <BookOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">No quizzes available</h3>
                            <p className="text-gray-400">Ask your teacher to share a game code!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredQuizzes.map((quiz) => (
                                <div
                                    key={quiz.id}
                                    className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition-all hover:border-gray-700"
                                >
                                    <div className="mb-3">
                                        <span className="inline-block rounded-full bg-sky-500/20 px-3 py-1 text-xs font-medium text-sky-400">
                                            {quiz.subject || "General"}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-white mb-2">{quiz.title}</h3>
                                    {quiz.description && (
                                        <p className="text-sm text-gray-400 line-clamp-2 mb-3">{quiz.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Code2 className="h-3 w-3" />
                                            {quiz.question_count} questions
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Trophy className="h-3 w-3" />
                                            {quiz.times_played} plays
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

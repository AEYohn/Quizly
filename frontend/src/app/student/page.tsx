"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowRight, Loader2, Sparkles, Gamepad2, BookOpen, Code2,
    Trophy, Brain, User, LogOut, Play, Target
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function StudentHubPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [savedName, setSavedName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState("");
    const [stats, setStats] = useState<{
        total_exit_tickets: number;
        active_misconceptions: number;
        games_played: number;
    } | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem("quizly_student_name");
        if (stored) {
            setSavedName(stored);
            setName(stored);
            fetchStudentStats(stored);
        }
    }, []);

    const fetchStudentStats = async (studentName: string) => {
        try {
            const res = await fetch(
                `${API_URL}/student-learning/dashboard/${encodeURIComponent(studentName)}`
            );
            if (res.ok) {
                const data = await res.json();
                setStats({
                    total_exit_tickets: data.summary?.total_exit_tickets || 0,
                    active_misconceptions: data.summary?.active_misconceptions || 0,
                    games_played: data.exit_tickets?.length || 0,
                });
            }
        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    };

    const handleSaveName = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        localStorage.setItem("quizly_student_name", name);
        sessionStorage.setItem("quizly_student_name", name);
        setSavedName(name);
        fetchStudentStats(name);
    };

    const handleJoinGame = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim() || !savedName) return;

        setIsLoading(true);
        setJoinError("");

        try {
            const response = await fetch(`${API_URL}/games/code/${joinCode.toUpperCase()}`);
            if (response.ok) {
                const game = await response.json();
                if (game.status !== "lobby") {
                    setJoinError("This game has already started!");
                    setIsLoading(false);
                    return;
                }

                // Join the game
                const joinRes = await fetch(`${API_URL}/games/${game.id}/join`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nickname: savedName }),
                });

                if (joinRes.ok) {
                    const joinData = await joinRes.json();
                    sessionStorage.setItem("playerId", joinData.player_id);
                    sessionStorage.setItem("nickname", savedName);
                    sessionStorage.setItem("gameId", game.id);
                    router.push(`/play/${game.id}`);
                } else {
                    const error = await joinRes.json();
                    setJoinError(error.detail || "Couldn't join the game");
                }
            } else {
                setJoinError("Game not found. Check your code!");
            }
        } catch {
            setJoinError("Connection failed. Try again!");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("quizly_student_name");
        sessionStorage.clear();
        setSavedName(null);
        setName("");
        setStats(null);
    };

    // If no name saved, show name entry form
    if (!savedName) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-6">
                <div className="w-full max-w-md animate-fade-in rounded-2xl bg-white p-8 shadow-xl">
                    <div className="mb-8 text-center">
                        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-3xl shadow-lg shadow-indigo-600/20">
                            🎒
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Welcome to Quizly!</h1>
                        <p className="mt-2 text-gray-500">
                            Enter your name to get started
                        </p>
                    </div>

                    <form onSubmit={handleSaveName} className="space-y-6">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                What's your name?
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Alex Smith"
                                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg outline-none transition-all placeholder:text-gray-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/40 disabled:opacity-50"
                        >
                            Get Started
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Student Hub - main dashboard
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-sm">
                <div className="mx-auto max-w-4xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
                                <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900">Quizly</h1>
                                <p className="text-xs text-gray-500">Welcome back, {savedName}!</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                        >
                            <LogOut className="h-4 w-4" />
                            Switch User
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-6 py-8">
                {/* Join Game Card */}
                <div className="mb-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                                <Gamepad2 className="h-6 w-6" />
                                Join a Live Game
                            </h2>
                            <p className="text-indigo-200">Enter the game code from your teacher</p>
                        </div>
                        <form onSubmit={handleJoinGame} className="flex gap-3">
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
                                disabled={isLoading || joinCode.length < 4}
                                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-indigo-600 transition-all hover:bg-indigo-50 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Play className="h-5 w-5" />
                                        Join
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                    {joinError && (
                        <p className="mt-3 text-sm text-red-200">{joinError}</p>
                    )}
                </div>

                {/* Stats Overview */}
                {stats && (
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 text-indigo-600 mb-1">
                                <Trophy className="h-4 w-4" />
                                <span className="text-xs font-medium">Games Played</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{stats.games_played}</p>
                        </div>
                        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 text-emerald-600 mb-1">
                                <BookOpen className="h-4 w-4" />
                                <span className="text-xs font-medium">Exit Tickets</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{stats.total_exit_tickets}</p>
                        </div>
                        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 text-orange-600 mb-1">
                                <Target className="h-4 w-4" />
                                <span className="text-xs font-medium">To Review</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{stats.active_misconceptions}</p>
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <h2 className="text-lg font-bold text-gray-900 mb-4">What would you like to do?</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Learning Dashboard */}
                    <Link
                        href="/student/learning"
                        className="group rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <Brain className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-1">My Learning Dashboard</h3>
                                <p className="text-sm text-gray-500">
                                    View exit tickets, track progress, and review misconceptions
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                    </Link>

                    {/* Coding Challenges */}
                    <Link
                        href="/play/coding"
                        className="group rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-200 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Code2 className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-1">Coding Challenges</h3>
                                <p className="text-sm text-gray-500">
                                    Practice LeetCode-style problems and improve your skills
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                        </div>
                    </Link>

                    {/* Browse Quizzes */}
                    <Link
                        href="/student/dashboard"
                        className="group rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <BookOpen className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-1">Browse Quizzes</h3>
                                <p className="text-sm text-gray-500">
                                    Find and join available quizzes from your teachers
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                        </div>
                    </Link>

                    {/* My Profile */}
                    <Link
                        href="/student/profile"
                        className="group rounded-xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-amber-200 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                <User className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-1">My Profile</h3>
                                <p className="text-sm text-gray-500">
                                    View your stats, achievements, and learning history
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-amber-600 transition-colors" />
                        </div>
                    </Link>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="flex items-center justify-center gap-2 text-sm text-gray-400">
                        <Sparkles className="h-4 w-4" />
                        Powered by Quizly AI
                    </p>
                </div>
            </main>
        </div>
    );
}

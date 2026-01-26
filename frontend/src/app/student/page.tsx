"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowRight, Loader2, Sparkles, Gamepad2, BookOpen, Code2,
    Trophy, Brain, User, LogOut, Play, Target, Inbox
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function StudentHubPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [savedName, setSavedName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState("");
    const [recentStudents, setRecentStudents] = useState<string[]>([]);
    const [stats, setStats] = useState<{
        total_exit_tickets: number;
        active_misconceptions: number;
        games_played: number;
    } | null>(null);
    const [inboxCount, setInboxCount] = useState(0);

    useEffect(() => {
        // Load recent students from localStorage
        const recent = localStorage.getItem("quizly_recent_students");
        if (recent) {
            try {
                setRecentStudents(JSON.parse(recent));
            } catch {
                setRecentStudents([]);
            }
        }

        const stored = localStorage.getItem("quizly_student_name");
        if (stored) {
            setSavedName(stored);
            setName(stored);
            fetchStudentStats(stored);
            fetchInboxCount(stored);
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

    const fetchInboxCount = async (studentName: string) => {
        try {
            const res = await fetch(
                `${API_URL}/assignments/inbox/${encodeURIComponent(studentName)}`
            );
            if (res.ok) {
                const data = await res.json();
                setInboxCount(data.unread_count || 0);
            }
        } catch (err) {
            console.error("Error fetching inbox:", err);
        }
    };

    // Add student to recent students list (max 5)
    const addToRecentStudents = (studentName: string) => {
        const updated = [studentName, ...recentStudents.filter(n => n !== studentName)].slice(0, 5);
        setRecentStudents(updated);
        localStorage.setItem("quizly_recent_students", JSON.stringify(updated));
    };

    // Quick switch to a recent student
    const switchToStudent = (studentName: string) => {
        localStorage.setItem("quizly_student_name", studentName);
        sessionStorage.setItem("quizly_student_name", studentName);
        sessionStorage.setItem("nickname", studentName);
        setSavedName(studentName);
        setName(studentName);
        addToRecentStudents(studentName);
        fetchStudentStats(studentName);
        fetchInboxCount(studentName);
    };

    const handleSaveName = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        localStorage.setItem("quizly_student_name", name.trim());
        sessionStorage.setItem("quizly_student_name", name.trim());
        sessionStorage.setItem("nickname", name.trim());
        setSavedName(name.trim());
        addToRecentStudents(name.trim());
        fetchStudentStats(name.trim());
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

                // Join the game using /games/join endpoint with game_code
                const joinRes = await fetch(`${API_URL}/games/join`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        game_code: joinCode.toUpperCase(),
                        nickname: savedName
                    }),
                });

                if (joinRes.ok) {
                    const joinData = await joinRes.json();
                    sessionStorage.setItem("playerId", joinData.player_id);
                    sessionStorage.setItem("nickname", savedName);
                    sessionStorage.setItem("gameId", joinData.game_id);
                    router.push(`/play/${joinData.game_id}`);
                } else {
                    setJoinError("Couldn't join game. Try again!");
                }
            } else {
                setJoinError("Game not found. Check the code!");
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
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6">
                <div className="w-full max-w-md animate-fade-in rounded-2xl bg-gray-900 p-8 shadow-xl border border-gray-800">
                    <div className="mb-8 text-center">
                        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-600 text-3xl shadow-lg shadow-sky-600/20">
                            🎒
                        </div>
                        <h1 className="text-2xl font-bold text-white">Welcome to Quizly!</h1>
                        <p className="mt-2 text-gray-400">
                            Enter your name to get started
                        </p>
                    </div>

                    {/* Recent Students for quick switch */}
                    {recentStudents.length > 0 && (
                        <div className="mb-6">
                            <p className="mb-3 text-sm font-medium text-gray-400">
                                Recent Students
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {recentStudents.map((studentName) => (
                                    <button
                                        key={studentName}
                                        onClick={() => switchToStudent(studentName)}
                                        className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-700 transition-colors border border-gray-700 hover:border-sky-500"
                                    >
                                        <User className="h-4 w-4 text-gray-400" />
                                        {studentName}
                                    </button>
                                ))}
                            </div>
                            <div className="my-4 flex items-center gap-3">
                                <div className="h-px flex-1 bg-gray-800" />
                                <span className="text-xs text-gray-500">or enter a new name</span>
                                <div className="h-px flex-1 bg-gray-800" />
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSaveName} className="space-y-6">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-300">
                                What&apos;s your name?
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Alex Smith"
                                className="w-full rounded-xl border-2 border-gray-700 bg-gray-800 px-4 py-3 text-lg text-white outline-none transition-all placeholder:text-gray-500 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-4 text-lg font-bold text-white shadow-lg shadow-sky-600/30 transition-all hover:bg-sky-500 hover:shadow-xl hover:shadow-sky-600/40 disabled:opacity-50"
                        >
                            Get Started
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Student Hub - main dashboard
    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="mx-auto max-w-4xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
                                <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-white">Quizly</h1>
                                <p className="text-xs text-gray-400">Welcome back, {savedName}!</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                        >
                            <LogOut className="h-4 w-4" />
                            Switch User
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-6 py-8">
                {/* Join Game Card */}
                <div className="mb-8 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 p-6 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                                <Gamepad2 className="h-6 w-6" />
                                Join a Live Game
                            </h2>
                            <p className="text-sky-200">Enter the game code from your teacher</p>
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
                                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-sky-600 transition-all hover:bg-sky-50 disabled:opacity-50"
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

                {/* Quick Switch - Other Recent Students */}
                {recentStudents.filter(n => n !== savedName).length > 0 && (
                    <div className="mb-6 rounded-xl bg-gray-900/50 p-4 border border-gray-800">
                        <p className="text-sm text-gray-400 mb-3">Quick switch to another student:</p>
                        <div className="flex flex-wrap gap-2">
                            {recentStudents.filter(n => n !== savedName).map((studentName) => (
                                <button
                                    key={studentName}
                                    onClick={() => switchToStudent(studentName)}
                                    className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700 transition-colors border border-gray-700 hover:border-sky-500"
                                >
                                    <User className="h-3 w-3 text-gray-400" />
                                    {studentName}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats Overview */}
                {stats && (
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="rounded-xl bg-gray-900 p-4 border border-gray-800">
                            <div className="flex items-center gap-2 text-sky-400 mb-1">
                                <Trophy className="h-4 w-4" />
                                <span className="text-xs font-medium">Games Played</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{stats.games_played}</p>
                        </div>
                        <div className="rounded-xl bg-gray-900 p-4 border border-gray-800">
                            <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                <BookOpen className="h-4 w-4" />
                                <span className="text-xs font-medium">Exit Tickets</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{stats.total_exit_tickets}</p>
                        </div>
                        <div className="rounded-xl bg-gray-900 p-4 border border-gray-800">
                            <div className="flex items-center gap-2 text-orange-400 mb-1">
                                <Target className="h-4 w-4" />
                                <span className="text-xs font-medium">To Review</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{stats.active_misconceptions}</p>
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <h2 className="text-lg font-bold text-white mb-4">What would you like to do?</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Learning Dashboard */}
                    <Link
                        href="/student/learning"
                        className="group rounded-xl bg-gray-900 p-6 border border-gray-800 hover:border-sky-500/50 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                                <Brain className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-white mb-1">My Learning Dashboard</h3>
                                <p className="text-sm text-gray-400">
                                    View exit tickets, track progress, and review misconceptions
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-sky-400 transition-colors" />
                        </div>
                    </Link>

                    {/* Inbox from Teacher */}
                    <Link
                        href="/student/inbox"
                        className="group rounded-xl bg-gray-900 p-6 border border-gray-800 hover:border-pink-500/50 transition-all relative"
                    >
                        {inboxCount > 0 && (
                            <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 text-xs font-bold text-white shadow-lg">
                                {inboxCount}
                            </div>
                        )}
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                                <Inbox className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-white mb-1">
                                    My Inbox
                                    {inboxCount > 0 && (
                                        <span className="ml-2 text-sm text-pink-400">({inboxCount} new)</span>
                                    )}
                                </h3>
                                <p className="text-sm text-gray-400">
                                    Practice assignments from your teacher
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-pink-400 transition-colors" />
                        </div>
                    </Link>

                    {/* Coding Challenges */}
                    <Link
                        href="/play/coding"
                        className="group rounded-xl bg-gray-900 p-6 border border-gray-800 hover:border-emerald-500/50 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                <Code2 className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-white mb-1">Coding Challenges</h3>
                                <p className="text-sm text-gray-400">
                                    Practice LeetCode-style problems and improve your skills
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                        </div>
                    </Link>

                    {/* Browse Quizzes */}
                    <Link
                        href="/student/dashboard"
                        className="group rounded-xl bg-gray-900 p-6 border border-gray-800 hover:border-purple-500/50 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <BookOpen className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-white mb-1">Browse Quizzes</h3>
                                <p className="text-sm text-gray-400">
                                    Find and join available quizzes from your teachers
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                        </div>
                    </Link>

                    {/* My Profile */}
                    <Link
                        href="/student/profile"
                        className="group rounded-xl bg-gray-900 p-6 border border-gray-800 hover:border-amber-500/50 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                <User className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-white mb-1">My Profile</h3>
                                <p className="text-sm text-gray-400">
                                    View your stats, achievements, and learning history
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-amber-400 transition-colors" />
                        </div>
                    </Link>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="flex items-center justify-center gap-2 text-sm text-gray-500">
                        <Sparkles className="h-4 w-4" />
                        Powered by Quizly AI
                    </p>
                </div>
            </main>
        </div>
    );
}

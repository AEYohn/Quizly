"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowRight, Loader2, Sparkles, Gamepad2, Code2, BookOpen,
    Trophy, Brain, User, LogOut, Play, Target, UserCircle2
} from "lucide-react";
import { useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function StudentHubPage() {
    const router = useRouter();
    const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
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
    const [inboxCount, setInboxCount] = useState(0);

    // Check if user is signed in with Clerk
    const isSignedIn = !!clerkUser;
    const clerkName = clerkUser?.firstName || clerkUser?.username || clerkUser?.primaryEmailAddress?.emailAddress?.split("@")[0];

    useEffect(() => {
        // If signed in with Clerk, use their name
        if (clerkLoaded && clerkUser && clerkName) {
            const customName = localStorage.getItem("quizly_display_name");
            const displayName = customName || clerkName;
            setSavedName(displayName);
            setName(displayName);
            localStorage.setItem("quizly_student_name", displayName);
            fetchStudentStats(displayName);
            fetchInboxCount(displayName);
            return;
        }

        const stored = localStorage.getItem("quizly_student_name");
        if (stored) {
            setSavedName(stored);
            setName(stored);
            fetchStudentStats(stored);
            fetchInboxCount(stored);
        }
    }, [clerkLoaded, clerkUser, clerkName]);

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

    const handleSaveName = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        localStorage.setItem("quizly_student_name", name.trim());
        sessionStorage.setItem("quizly_student_name", name.trim());
        sessionStorage.setItem("nickname", name.trim());
        setSavedName(name.trim());
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

                    {/* Sign in for more features */}
                    <div className="mt-6 pt-6 border-t border-gray-800">
                        <Link
                            href="/sign-in"
                            className="flex items-center justify-center gap-2 w-full rounded-xl border border-gray-700 bg-gray-800/50 py-3 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-teal-500/50 transition-all"
                        >
                            <UserCircle2 className="h-5 w-5" />
                            Sign in for more features
                        </Link>
                        <p className="mt-2 text-xs text-gray-500 text-center">
                            Save progress, create study quizzes, track your learning
                        </p>
                    </div>

                    <div className="mt-6 text-center">
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
                        <div className="flex items-center gap-2">
                            {isSignedIn ? (
                                <Link
                                    href="/student/dashboard"
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-emerald-400 hover:bg-gray-800 font-medium"
                                >
                                    <UserCircle2 className="h-4 w-4" />
                                    My Account
                                </Link>
                            ) : (
                                <Link
                                    href="/sign-in"
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-teal-400 hover:bg-gray-800 font-medium"
                                >
                                    <UserCircle2 className="h-4 w-4" />
                                    Sign In
                                </Link>
                            )}
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                            >
                                <LogOut className="h-4 w-4" />
                                Switch
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-6 py-8">
                {/* Join Game Card */}
                <div className="mb-6 rounded-xl bg-gray-900 border border-gray-800 p-5">
                    <h2 className="font-semibold text-white mb-3">Join a Game</h2>
                    <form onSubmit={handleJoinGame} className="flex gap-3">
                        <input
                            type="text"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="Enter code"
                            maxLength={6}
                            className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white font-mono tracking-wider placeholder-gray-500 focus:border-gray-600 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || joinCode.length < 4}
                            className="flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-gray-900 transition-all hover:bg-gray-100 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                "Join"
                            )}
                        </button>
                    </form>
                    {joinError && (
                        <p className="mt-3 text-sm text-red-400">{joinError}</p>
                    )}
                </div>

                {/* Sign up CTA for non-authenticated users */}
                {!isSignedIn && (
                    <div className="mb-8 rounded-xl bg-gray-900 border border-gray-800 p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <p className="font-semibold text-white mb-1">Save your study packets</p>
                                <p className="text-sm text-gray-400">Create a free account to access your exit tickets anytime</p>
                            </div>
                            <Link
                                href="/sign-up"
                                className="flex items-center justify-center gap-2 rounded-lg bg-white text-gray-900 px-5 py-2.5 text-sm font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap"
                            >
                                Sign Up Free
                            </Link>
                        </div>
                    </div>
                )}

                {/* Stats Overview */}
                {stats && (
                    <div className="flex gap-6 mb-6 text-sm">
                        <div>
                            <span className="text-gray-500">Games</span>
                            <span className="ml-2 font-semibold text-white">{stats.games_played}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Exit Tickets</span>
                            <span className="ml-2 font-semibold text-white">{stats.total_exit_tickets}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">To Review</span>
                            <span className="ml-2 font-semibold text-white">{stats.active_misconceptions}</span>
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="space-y-3">
                    {/* My Dashboard */}
                    <Link
                        href="/student/dashboard"
                        className="group flex items-center justify-between rounded-xl bg-gray-900 p-4 border border-gray-800 hover:border-gray-700 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <Brain className="h-5 w-5 text-gray-400" />
                            <div>
                                <h3 className="font-medium text-white">My Dashboard</h3>
                                <p className="text-sm text-gray-500">Activity, quizzes, classes</p>
                            </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-white transition-colors" />
                    </Link>

                    {/* Coding Challenges */}
                    <Link
                        href="/play/coding"
                        className="group flex items-center justify-between rounded-xl bg-gray-900 p-4 border border-gray-800 hover:border-gray-700 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <Code2 className="h-5 w-5 text-gray-400" />
                            <div>
                                <h3 className="font-medium text-white">Coding Challenges</h3>
                                <p className="text-sm text-gray-500">Practice coding problems</p>
                            </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-white transition-colors" />
                    </Link>

                    {/* My Profile */}
                    <Link
                        href="/student/profile"
                        className="group flex items-center justify-between rounded-xl bg-gray-900 p-4 border border-gray-800 hover:border-gray-700 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <User className="h-5 w-5 text-gray-400" />
                            <div>
                                <h3 className="font-medium text-white">My Profile</h3>
                                <p className="text-sm text-gray-500">Stats and history</p>
                            </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-white transition-colors" />
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

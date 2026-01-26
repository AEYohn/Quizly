"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Radio,
    Users,
    Clock,
    Play,
    Eye,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    BarChart3,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ActiveGame {
    id: string;
    quiz_id: string;
    quiz_title: string;
    game_code: string;
    status: "lobby" | "playing" | "question" | "results" | "finished";
    sync_mode: boolean;
    current_question_index: number;
    player_count: number;
    created_at: string;
}

export default function LiveDashboardPage() {
    const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchActiveGames = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/my/active`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setActiveGames(data);
            }
        } catch (error) {
            console.error("Failed to fetch active games:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchActiveGames();
        // Poll for updates every 5 seconds
        const interval = setInterval(fetchActiveGames, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchActiveGames();
    };

    const getStatusBadge = (status: string, syncMode: boolean) => {
        const defaultConfig = { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "In Lobby", icon: <Clock className="h-3 w-3" /> };
        const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
            lobby: defaultConfig,
            playing: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Live", icon: <Radio className="h-3 w-3 animate-pulse" /> },
            question: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Live", icon: <Radio className="h-3 w-3 animate-pulse" /> },
            results: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Reviewing", icon: <BarChart3 className="h-3 w-3" /> },
            finished: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "Finished", icon: <CheckCircle2 className="h-3 w-3" /> },
        };

        const config = statusConfig[status] || defaultConfig;
        return (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${config.color}`}>
                {config.icon}
                {config.label}
                {!syncMode && status !== "finished" && <span className="text-[10px] opacity-70">(async)</span>}
            </span>
        );
    };

    const liveGames = activeGames.filter(g => g.status === "question" || g.status === "playing" || g.status === "results");
    const lobbyGames = activeGames.filter(g => g.status === "lobby");

    return (
        <div className="min-h-screen bg-gray-950 p-8">
            {/* Header */}
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
                            <Radio className="h-5 w-5 text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Live Sessions</h1>
                    </div>
                    <p className="text-gray-400">
                        Monitor active quizzes and student progress in real-time
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </header>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="text-center">
                        <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-400">Loading active sessions...</p>
                    </div>
                </div>
            ) : activeGames.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-700 bg-gray-900">
                    <Radio className="mb-4 h-12 w-12 text-gray-500" />
                    <h3 className="mb-2 text-lg font-semibold text-white">No Active Sessions</h3>
                    <p className="mb-4 text-gray-400 text-center max-w-md">
                        Start a game from your Library to see it here. Students taking quizzes will appear in real-time.
                    </p>
                    <Link
                        href="/teacher/library"
                        className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
                    >
                        <Play className="h-4 w-4" />
                        Go to Library
                    </Link>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Live Games Section */}
                    {liveGames.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                Live Now ({liveGames.length})
                            </h2>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {liveGames.map((game) => (
                                    <Link
                                        key={game.id}
                                        href={`/teacher/live/${game.id}`}
                                        className="group rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-gray-900 p-6 transition-all hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/10"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="text-lg font-semibold text-white group-hover:text-green-400 transition-colors">
                                                    {game.quiz_title}
                                                </h3>
                                                <p className="text-sm text-gray-400 mt-1">
                                                    Code: <span className="font-mono text-green-400">{game.game_code}</span>
                                                </p>
                                            </div>
                                            {getStatusBadge(game.status, game.sync_mode)}
                                        </div>

                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="flex items-center gap-1.5 text-gray-300">
                                                <Users className="h-4 w-4 text-green-400" />
                                                {game.player_count} students
                                            </span>
                                            <span className="flex items-center gap-1.5 text-gray-300">
                                                <BarChart3 className="h-4 w-4 text-sky-400" />
                                                Q{game.current_question_index + 1}
                                            </span>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                                            <span className="text-xs text-gray-500">Click to monitor</span>
                                            <Eye className="h-4 w-4 text-gray-500 group-hover:text-green-400 transition-colors" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Lobby Games Section */}
                    {lobbyGames.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Clock className="h-5 w-5 text-yellow-400" />
                                Waiting in Lobby ({lobbyGames.length})
                            </h2>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {lobbyGames.map((game) => (
                                    <Link
                                        key={game.id}
                                        href={`/teacher/game/${game.id}/lobby`}
                                        className="group rounded-xl border border-gray-700 bg-gray-900 p-6 transition-all hover:border-yellow-500/50"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="text-lg font-semibold text-white">
                                                    {game.quiz_title}
                                                </h3>
                                                <p className="text-sm text-gray-400 mt-1">
                                                    Code: <span className="font-mono text-yellow-400">{game.game_code}</span>
                                                </p>
                                            </div>
                                            {getStatusBadge(game.status, game.sync_mode)}
                                        </div>

                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="flex items-center gap-1.5 text-gray-300">
                                                <Users className="h-4 w-4 text-yellow-400" />
                                                {game.player_count} waiting
                                            </span>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                                            <span className="text-xs text-gray-500">Click to manage</span>
                                            <Play className="h-4 w-4 text-gray-500 group-hover:text-yellow-400 transition-colors" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Quick Stats */}
                    <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                                    <Radio className="h-5 w-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{liveGames.length}</p>
                                    <p className="text-sm text-gray-400">Active Sessions</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20">
                                    <Users className="h-5 w-5 text-sky-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">
                                        {activeGames.reduce((sum, g) => sum + g.player_count, 0)}
                                    </p>
                                    <p className="text-sm text-gray-400">Total Students</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
                                    <Clock className="h-5 w-5 text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{lobbyGames.length}</p>
                                    <p className="text-sm text-gray-400">Waiting to Start</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

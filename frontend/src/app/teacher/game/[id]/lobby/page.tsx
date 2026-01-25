"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users, Play, Copy, Check, Loader2, X, RefreshCw, Wifi, WifiOff, Zap, CheckCircle } from "lucide-react";
import { useGameSocket } from "~/lib/useGameSocket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Player {
    id: string;
    nickname: string;
    avatar: string | null;
    joined_at: string;
}

interface GameInfo {
    id: string;
    game_code: string;
    quiz_title: string;
    status: string;
    player_count: number;
    players: Player[];
    sync_mode?: boolean;
}

export default function GameLobbyPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.id as string;

    const [game, setGame] = useState<GameInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [starting, setStarting] = useState(false);
    const [players, setPlayers] = useState<Player[]>([]);

    // WebSocket for real-time player updates
    const { isConnected, playerCount } = useGameSocket({
        gameId,
        isHost: true,
        enabled: !!gameId,  // Connect immediately, before game data loads
        onConnected: (data) => {
            console.log("Host connected to lobby WebSocket", data);
        },
        onPlayerConnected: (data) => {
            console.log("Player joined:", data);
            // Refresh player list when someone joins
            fetchPlayers();
        },
        onPlayerDisconnected: (data) => {
            console.log("Player left:", data);
            // Refresh player list when someone leaves
            fetchPlayers();
        },
        onGameStarted: () => {
            // Game was started (possibly from another tab)
            router.push(`/teacher/game/${gameId}/host`);
        },
        onError: (error) => {
            console.error("WebSocket error:", error);
        },
    });

    const fetchGame = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/${gameId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setGame(data);
                setPlayers(data.players || []);

                // If game has started, redirect to host view
                if (data.status !== "lobby") {
                    router.push(`/teacher/game/${gameId}/host`);
                }
            } else if (response.status === 404) {
                router.push("/teacher/quizzes");
            }
        } catch (error) {
            console.error("Failed to fetch game:", error);
        } finally {
            setLoading(false);
        }
    }, [gameId, router]);

    const fetchPlayers = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/${gameId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setPlayers(data.players || []);
                setGame(prev => prev ? { ...prev, player_count: data.player_count, players: data.players } : null);
            }
        } catch (error) {
            console.error("Failed to fetch players:", error);
        }
    }, [gameId]);

    useEffect(() => {
        fetchGame();
    }, [fetchGame]);

    // Fallback polling only if WebSocket is not connected (every 5 seconds instead of 2)
    useEffect(() => {
        if (!isConnected && !loading) {
            const interval = setInterval(fetchPlayers, 5000);
            return () => clearInterval(interval);
        }
    }, [isConnected, loading, fetchPlayers]);

    const copyCode = () => {
        if (game) {
            navigator.clipboard.writeText(game.game_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const startGame = async () => {
        setStarting(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/${gameId}/start`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                router.push(`/teacher/game/${gameId}/host`);
            }
        } catch (error) {
            console.error("Failed to start game:", error);
        } finally {
            setStarting(false);
        }
    };

    const cancelGame = async () => {
        if (!confirm("Are you sure you want to cancel this game?")) return;

        try {
            const token = localStorage.getItem("token");
            await fetch(`${API_URL}/games/${gameId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            router.push("/teacher/quizzes");
        } catch (error) {
            console.error("Failed to cancel game:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-600 to-purple-800">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
        );
    }

    if (!game) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-600 to-purple-800">
                <div className="text-white">Game not found</div>
            </div>
        );
    }

    // Use WebSocket player count if available, otherwise use game state
    const displayPlayerCount = isConnected ? (playerCount || players.length) : players.length;

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 p-8">
            {/* Header */}
            <div className="mx-auto max-w-4xl">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">{game.quiz_title}</h1>
                        {/* Connection status indicator */}
                        <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                            isConnected ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"
                        }`}>
                            {isConnected ? (
                                <>
                                    <Wifi className="h-3 w-3" />
                                    <span>Live</span>
                                </>
                            ) : (
                                <>
                                    <WifiOff className="h-3 w-3" />
                                    <span>Polling</span>
                                </>
                            )}
                        </div>
                    </div>
                    {game?.sync_mode !== false && (
                        <button
                            onClick={cancelGame}
                            className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-white hover:bg-white/20"
                        >
                            <X className="h-5 w-5" />
                            Cancel
                        </button>
                    )}
                </div>

                {/* Join Code Display */}
                <div className="mb-8 rounded-2xl bg-white p-8 text-center shadow-xl">
                    <p className="mb-2 text-gray-500">Join at quizly.app or enter code:</p>
                    <div className="mb-4 flex items-center justify-center gap-4">
                        <span className="text-6xl font-bold tracking-wider text-purple-600">
                            {game.game_code}
                        </span>
                        <button
                            onClick={copyCode}
                            className="rounded-lg bg-purple-100 p-3 text-purple-600 hover:bg-purple-200"
                        >
                            {copied ? (
                                <Check className="h-6 w-6" />
                            ) : (
                                <Copy className="h-6 w-6" />
                            )}
                        </button>
                    </div>
                    <p className="text-sm text-gray-400">
                        Students can join at{" "}
                        <span className="font-medium text-purple-600">
                            {typeof window !== "undefined"
                                ? `${window.location.origin}/join`
                                : ""}
                        </span>
                    </p>
                </div>

                {/* Player Count & Start Button */}
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <Users className="h-6 w-6" />
                        <span className="text-2xl font-bold">{displayPlayerCount}</span>
                        <span className="text-xl">
                            {displayPlayerCount === 1 ? "player" : "players"} joined
                        </span>
                    </div>
                    {game.sync_mode === false ? (
                        /* Async mode - game is already live, no start needed */
                        <div className="flex items-center gap-3 rounded-xl bg-green-500/20 border border-green-500 px-6 py-4">
                            <CheckCircle className="h-6 w-6 text-green-400" />
                            <div className="text-left">
                                <p className="text-lg font-bold text-green-400">Game is Live!</p>
                                <p className="text-sm text-green-300">Students can start immediately</p>
                            </div>
                        </div>
                    ) : (
                        /* Sync mode - need to start game */
                        <button
                            onClick={startGame}
                            disabled={displayPlayerCount === 0 || starting}
                            className="flex items-center gap-2 rounded-xl bg-green-500 px-8 py-4 text-xl font-bold text-white transition-all hover:bg-green-600 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {starting ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <Play className="h-6 w-6" />
                            )}
                            Start Game
                        </button>
                    )}
                </div>

                {/* Players Grid */}
                <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Players</h2>
                        <button
                            onClick={fetchPlayers}
                            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                            title="Refresh player list"
                        >
                            <RefreshCw className="h-5 w-5" />
                        </button>
                    </div>

                    {players.length === 0 ? (
                        <div className="py-12 text-center text-white/70">
                            <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                            {game.sync_mode === false ? (
                                <>
                                    <p>No players yet</p>
                                    <p className="mt-2 text-sm">Share the game code - students can start anytime!</p>
                                </>
                            ) : (
                                <>
                                    <p>Waiting for players to join...</p>
                                    <p className="mt-2 text-sm">Share the game code above</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {players.map((player, index) => (
                                <div
                                    key={player.id}
                                    className="flex items-center gap-3 rounded-xl bg-white/10 p-3 animate-in fade-in slide-in-from-bottom-2"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-lg font-bold text-white">
                                        {player.avatar || player.nickname?.[0]?.toUpperCase() || "?"}
                                    </div>
                                    <span className="truncate font-medium text-white">
                                        {player.nickname}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Join Instructions */}
                <div className="mt-8 text-center text-white/60 text-sm">
                    <p>Players join using the code above at <strong>/join</strong></p>
                    {game.sync_mode === false ? (
                        <p className="mt-1 text-green-300">
                            <Zap className="inline h-4 w-4 mr-1" />
                            Async mode - students can start and progress at their own pace
                        </p>
                    ) : (
                        <p className="mt-1">Sync mode - all players will see questions at the same time</p>
                    )}
                </div>
            </div>
        </div>
    );
}

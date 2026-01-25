"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Loader2, Zap } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function JoinGamePage() {
    const router = useRouter();
    const [gameCode, setGameCode] = useState("");
    const [nickname, setNickname] = useState("");
    const [step, setStep] = useState<"code" | "nickname">("code");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [gameId, setGameId] = useState("");

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gameCode.trim()) return;

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API_URL}/games/code/${gameCode.toUpperCase()}`);
            if (response.ok) {
                const game = await response.json();
                if (game.status !== "lobby") {
                    setError("This game has already started!");
                    setLoading(false);
                    return;
                }
                setGameId(game.game_id || game.id);
                setStep("nickname");
            } else {
                setError("Game not found. Check your code!");
            }
        } catch {
            setError("Can't connect. Try again!");
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) return;

        setLoading(true);
        setError("");

        try {
            // Use /games/join endpoint with game_code and nickname
            const response = await fetch(`${API_URL}/games/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    game_code: gameCode.toUpperCase(),
                    nickname: nickname.trim()
                }),
            });

            if (response.ok) {
                const data = await response.json();
                // Store player info
                sessionStorage.setItem("playerId", data.player_id);
                sessionStorage.setItem("nickname", nickname.trim());
                sessionStorage.setItem("gameId", data.game_id || gameId);
                // Navigate to game
                router.push(`/play/${data.game_id || gameId}`);
            } else {
                const errorData = await response.json();
                setError(errorData.detail || "Couldn't join. Try a different name!");
            }
        } catch {
            setError("Connection failed. Try again!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6">
            {/* Logo */}
            <div className="mb-8 text-center">
                <div className="mb-4 flex items-center justify-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl">
                        <Sparkles className="h-9 w-9 text-purple-600" />
                    </div>
                </div>
                <h1 className="text-4xl font-bold text-white">Quizly</h1>
                <p className="mt-2 text-white/80">Play, Learn, Win!</p>
            </div>

            {/* Card */}
            <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
                {step === "code" ? (
                    <form onSubmit={handleCodeSubmit}>
                        <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
                            Enter Game Code
                        </h2>
                        <input
                            type="text"
                            value={gameCode}
                            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                            placeholder="ABC123"
                            maxLength={6}
                            className="mb-4 w-full rounded-2xl border-2 border-gray-200 p-4 text-center text-3xl font-bold tracking-widest text-gray-900 focus:border-purple-500 focus:outline-none transition-colors"
                            autoFocus
                        />
                        {error && (
                            <p className="mb-4 text-center text-red-500 font-medium">{error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={loading || gameCode.length < 4}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 p-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    Join Game
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleJoin}>
                        <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
                            What's your name?
                        </h2>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Your nickname"
                            maxLength={20}
                            className="mb-4 w-full rounded-2xl border-2 border-gray-200 p-4 text-center text-xl font-bold text-gray-900 focus:border-purple-500 focus:outline-none transition-colors"
                            autoFocus
                        />
                        {error && (
                            <p className="mb-4 text-center text-red-500 font-medium">{error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={loading || !nickname.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    Let's Go!
                                    <Zap className="h-5 w-5" />
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStep("code");
                                setError("");
                            }}
                            className="mt-4 w-full text-center text-gray-500 hover:text-gray-700"
                        >
                            ← Different code
                        </button>
                    </form>
                )}
            </div>

            {/* Powered by */}
            <div className="mt-8 flex items-center gap-2 text-white/60">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Powered by Gemini AI</span>
            </div>
        </div>
    );
}

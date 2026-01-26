"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight, Loader2, Zap } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function JoinGameContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [gameCode, setGameCode] = useState("");
    const [nickname, setNickname] = useState("");
    const [step, setStep] = useState<"code" | "nickname">("code");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [gameId, setGameId] = useState("");

    // Auto-fill and validate game code from URL
    const validateAndSetCode = useCallback(async (code: string) => {
        setGameCode(code);
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API_URL}/games/code/${code.toUpperCase()}`);
            if (response.ok) {
                const game = await response.json();
                if (game.status !== "lobby") {
                    setError("This game has already started!");
                    setLoading(false);
                    return;
                }
                const id = game.game_id;
                if (!id) {
                    setError("Invalid game. Please try again.");
                    setLoading(false);
                    return;
                }
                setGameId(id);
                setStep("nickname");
            } else {
                setError("Game not found. Check your code!");
            }
        } catch {
            setError("Can't connect. Try again!");
        } finally {
            setLoading(false);
        }
    }, []);

    // Check for code in URL on mount
    useEffect(() => {
        const codeFromUrl = searchParams.get("code");
        if (codeFromUrl && codeFromUrl.length >= 4) {
            validateAndSetCode(codeFromUrl.toUpperCase());
        }
    }, [searchParams, validateAndSetCode]);

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
                const gameId = game.game_id;
                if (!gameId) {
                    setError("Invalid game. Please try again.");
                    setLoading(false);
                    return;
                }
                setGameId(gameId);
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
            // Use /games/join endpoint with game_code
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
                sessionStorage.setItem("gameId", data.game_id);
                // Navigate to game
                router.push(`/play/${data.game_id}`);
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
        <div className="flex min-h-dvh flex-col items-center justify-center bg-[#030712] p-6">
            {/* Logo */}
            <div className="mb-8 text-center">
                <div className="mb-4 flex items-center justify-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-600 shadow-xl shadow-sky-600/20">
                        <Sparkles className="h-9 w-9 text-white" />
                    </div>
                </div>
                <h1 className="text-4xl font-bold text-white">Quizly</h1>
                <p className="mt-2 text-gray-400">Play, Learn, Win!</p>
            </div>

            {/* Card */}
            <div className="w-full max-w-sm rounded-3xl bg-gray-900 p-8 shadow-2xl border border-gray-800">
                {step === "code" ? (
                    <form onSubmit={handleCodeSubmit}>
                        <h2 className="mb-6 text-center text-2xl font-bold text-white">
                            Enter Game Code
                        </h2>
                        <input
                            type="text"
                            value={gameCode}
                            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                            placeholder="ABC123"
                            maxLength={6}
                            className="mb-4 w-full rounded-2xl border-2 border-gray-700 bg-gray-800 p-4 text-center text-3xl font-bold tracking-widest text-white focus:border-sky-500 focus:outline-none transition-colors"
                            autoFocus
                        />
                        {error && (
                            <p className="mb-4 text-center text-red-400 font-medium">{error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={loading || gameCode.length < 4}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 p-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
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
                        <h2 className="mb-6 text-center text-2xl font-bold text-white">
                            What&apos;s your name?
                        </h2>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Your nickname"
                            maxLength={20}
                            className="mb-4 w-full rounded-2xl border-2 border-gray-700 bg-gray-800 p-4 text-center text-xl font-bold text-white focus:border-sky-500 focus:outline-none transition-colors"
                            autoFocus
                        />
                        {error && (
                            <p className="mb-4 text-center text-red-400 font-medium">{error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={loading || !nickname.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    Let&apos;s Go!
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
                            className="mt-4 w-full text-center text-gray-500 hover:text-gray-300"
                        >
                            ← Different code
                        </button>
                    </form>
                )}
            </div>

            {/* Powered by */}
            <div className="mt-8 flex items-center gap-2 text-gray-500">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Powered by Gemini AI</span>
            </div>
        </div>
    );
}

export default function JoinGamePage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-dvh items-center justify-center bg-[#030712]">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
        }>
            <JoinGameContent />
        </Suspense>
    );
}

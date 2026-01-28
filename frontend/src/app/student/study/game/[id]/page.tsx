"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCcw, Trophy, Clock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GameContent {
    id: string;
    title: string;
    template_type: string;
    game_data: {
        pairs?: { term: string; definition: string }[];
        sentences?: { text: string; blanks: { position: number; answer: string }[] }[];
        categories?: { name: string; items: string[] }[];
    };
    best_score: number | null;
    best_time_seconds: number | null;
}

interface MatchCard {
    id: string;
    content: string;
    type: "term" | "definition";
    pairIndex: number;
    matched: boolean;
    selected: boolean;
}

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function createCardsFromPairs(pairs: { term: string; definition: string }[]): MatchCard[] {
    const cards: MatchCard[] = [];
    pairs.forEach((pair, index) => {
        cards.push({
            id: `term-${index}`,
            content: pair.term,
            type: "term",
            pairIndex: index,
            matched: false,
            selected: false,
        });
        cards.push({
            id: `def-${index}`,
            content: pair.definition,
            type: "definition",
            pairIndex: index,
            matched: false,
            selected: false,
        });
    });
    return shuffleArray(cards);
}

export default function GamePlayPage() {
    const params = useParams();
    const router = useRouter();
    const { token, isLoading: authLoading } = useAuth();
    const gameId = params.id as string;

    const [game, setGame] = useState<GameContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Match Pairs game state
    const [cards, setCards] = useState<MatchCard[]>([]);
    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [matchedPairs, setMatchedPairs] = useState(0);
    const [moves, setMoves] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [gameComplete, setGameComplete] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // Fetch game data
    useEffect(() => {
        if (authLoading) return;
        if (!token) {
            router.push("/login");
            return;
        }

        const fetchGame = async () => {
            try {
                const response = await fetch(`${API_URL}/library/games/${gameId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch game");
                }

                const data = await response.json();
                setGame(data);

                // Initialize cards for match_pairs
                if (data.template_type === "match_pairs" && data.game_data?.pairs) {
                    setCards(createCardsFromPairs(data.game_data.pairs));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load game");
            } finally {
                setLoading(false);
            }
        };

        fetchGame();
    }, [gameId, token, authLoading, router]);

    const resetGame = useCallback(() => {
        if (game?.game_data?.pairs) {
            setCards(createCardsFromPairs(game.game_data.pairs));
        }
        setSelectedCards([]);
        setMatchedPairs(0);
        setMoves(0);
        setStartTime(null);
        setEndTime(null);
        setGameComplete(false);
        setIsChecking(false);
    }, [game]);

    const handleCardClick = useCallback((cardId: string) => {
        if (isChecking || gameComplete) return;

        const clickedCard = cards.find((c) => c.id === cardId);
        if (!clickedCard || clickedCard.matched || clickedCard.selected) return;

        // Start timer on first click
        if (startTime === null) {
            setStartTime(Date.now());
        }

        // Select the card
        setCards((prev) =>
            prev.map((c) => (c.id === cardId ? { ...c, selected: true } : c))
        );

        const newSelected = [...selectedCards, cardId];
        setSelectedCards(newSelected);

        // If we have 2 cards selected, check for match
        if (newSelected.length === 2) {
            setMoves((prev) => prev + 1);
            setIsChecking(true);

            const [firstId, secondId] = newSelected;
            const firstCard = cards.find((c) => c.id === firstId)!;
            const secondCard = cards.find((c) => c.id === secondId)!;

            // Check if they match (same pair, different types)
            if (
                firstCard.pairIndex === secondCard.pairIndex &&
                firstCard.type !== secondCard.type
            ) {
                // Match found
                setCards((prev) =>
                    prev.map((c) =>
                        c.id === firstId || c.id === secondId
                            ? { ...c, matched: true, selected: false }
                            : c
                    )
                );
                setSelectedCards([]);
                setIsChecking(false);

                const newMatchedPairs = matchedPairs + 1;
                setMatchedPairs(newMatchedPairs);

                // Check for game completion
                if (game?.game_data?.pairs && newMatchedPairs === game.game_data.pairs.length) {
                    setEndTime(Date.now());
                    setGameComplete(true);
                }
            } else {
                // No match - deselect after delay
                setTimeout(() => {
                    setCards((prev) =>
                        prev.map((c) =>
                            c.id === firstId || c.id === secondId
                                ? { ...c, selected: false }
                                : c
                    )
                    );
                    setSelectedCards([]);
                    setIsChecking(false);
                }, 1000);
            }
        }
    }, [cards, selectedCards, isChecking, gameComplete, startTime, matchedPairs, game]);

    const formatTime = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    };

    const elapsedTime = endTime && startTime ? endTime - startTime : 0;

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error || !game) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || "Game not found"}</p>
                    <Link
                        href="/student/study"
                        className="text-indigo-600 hover:text-indigo-800"
                    >
                        Back to Study
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/student/study"
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5 text-gray-600" />
                            </Link>
                            <div>
                                <h1 className="text-lg font-semibold text-gray-900">
                                    {game.title}
                                </h1>
                                <p className="text-sm text-gray-500">Match Pairs</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-600">
                                <span className="font-medium">{moves}</span> moves
                            </div>
                            <button
                                onClick={resetGame}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Reset game"
                            >
                                <RotateCcw className="h-5 w-5 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Completion Banner */}
                {gameComplete && (
                    <div className="mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-yellow-100 rounded-full">
                                    <Trophy className="h-8 w-8 text-yellow-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        Congratulations!
                                    </h2>
                                    <p className="text-gray-600">
                                        Completed in <span className="font-semibold">{moves}</span> moves
                                        {" \u2022 "}
                                        <Clock className="inline h-4 w-4 mb-0.5" />{" "}
                                        <span className="font-semibold">{formatTime(elapsedTime)}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={resetGame}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                            >
                                Play Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Game Grid */}
                {game.template_type === "match_pairs" && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {cards.map((card) => (
                            <button
                                key={card.id}
                                onClick={() => handleCardClick(card.id)}
                                disabled={card.matched || isChecking}
                                className={`
                                    p-4 rounded-xl text-center font-medium transition-all duration-200
                                    min-h-[100px] flex items-center justify-center
                                    ${
                                        card.matched
                                            ? "bg-green-100 text-green-800 border-2 border-green-300 cursor-default"
                                            : card.selected
                                            ? "bg-indigo-100 text-indigo-800 border-2 border-indigo-400 scale-105 shadow-lg"
                                            : "bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer"
                                    }
                                `}
                            >
                                <span className="text-sm md:text-base">{card.content}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Unsupported game type */}
                {game.template_type !== "match_pairs" && (
                    <div className="text-center py-12">
                        <p className="text-gray-600">
                            Game type &quot;{game.template_type}&quot; is not yet supported.
                        </p>
                        <Link
                            href="/student/study"
                            className="mt-4 inline-block text-indigo-600 hover:text-indigo-800"
                        >
                            Back to Study
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

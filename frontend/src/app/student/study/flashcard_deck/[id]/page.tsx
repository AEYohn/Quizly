"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Shuffle,
    RotateCcw,
    Loader2,
    Layers,
    PartyPopper,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Flashcard {
    id: string;
    front: string;
    back: string;
    image_url: string | null;
    position: number;
    mastery_level: number;
    next_review_at: string | null;
}

interface FlashcardDeck {
    id: string;
    type: string;
    title: string;
    description: string | null;
    visibility: string;
    tags: string[];
    source: string;
    times_studied: number;
    last_studied_at: string | null;
    created_at: string;
    updated_at: string;
    study_mode: string;
    cards_mastered: number;
    cards_struggling: number;
    cards: Flashcard[];
}

export default function FlashcardStudyPage() {
    const router = useRouter();
    const params = useParams();
    const deckId = params.id as string;
    const { token, isLoading: authLoading } = useAuth();

    // State
    const [deck, setDeck] = useState<FlashcardDeck | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [shuffled, setShuffled] = useState(false);
    const [cardOrder, setCardOrder] = useState<number[]>([]);

    // Fetch deck
    const fetchDeck = useCallback(async () => {
        if (!token) return;

        try {
            const response = await fetch(
                `${API_URL}/library/flashcard-decks/${deckId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!response.ok) {
                router.push("/student/library");
                return;
            }

            const data: FlashcardDeck = await response.json();
            setDeck(data);
            // Initialize card order to original order
            setCardOrder(data.cards.map((_, index) => index));
        } catch (error) {
            console.error("Failed to fetch deck:", error);
            router.push("/student/library");
        } finally {
            setLoading(false);
        }
    }, [token, deckId, router]);

    useEffect(() => {
        if (!authLoading && token) {
            fetchDeck();
        }
    }, [authLoading, token, fetchDeck]);

    // Shuffle cards: randomize cardOrder, reset to index 0
    const shuffleCards = useCallback(() => {
        if (!deck) return;

        const newOrder = [...cardOrder];
        // Fisher-Yates shuffle
        for (let i = newOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = newOrder[i];
            newOrder[i] = newOrder[j]!;
            newOrder[j] = temp!;
        }
        setCardOrder(newOrder);
        setCurrentIndex(0);
        setIsFlipped(false);
        setShuffled(true);
    }, [deck, cardOrder]);

    // Reset deck: restore original order, reset to index 0
    const resetDeck = useCallback(() => {
        if (!deck) return;

        setCardOrder(deck.cards.map((_, index) => index));
        setCurrentIndex(0);
        setIsFlipped(false);
        setShuffled(false);
    }, [deck]);

    // Navigate to next card
    const nextCard = useCallback(() => {
        if (!deck || currentIndex >= deck.cards.length - 1) return;
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
    }, [deck, currentIndex]);

    // Navigate to previous card
    const prevCard = useCallback(() => {
        if (currentIndex <= 0) return;
        setCurrentIndex((prev) => prev - 1);
        setIsFlipped(false);
    }, [currentIndex]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
                prevCard();
            } else if (e.key === "ArrowRight") {
                nextCard();
            } else if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setIsFlipped((prev) => !prev);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [nextCard, prevCard]);

    // Loading state
    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    // No deck or empty deck
    if (!deck || deck.cards.length === 0) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <Layers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No Cards</h2>
                    <p className="text-gray-400 mb-4">
                        This deck doesn&apos;t have any cards yet.
                    </p>
                    <Link
                        href="/student/library"
                        className="text-teal-400 hover:text-teal-300"
                    >
                        Back to Library
                    </Link>
                </div>
            </div>
        );
    }

    const cardIndex = cardOrder[currentIndex] ?? 0;
    const currentCard = deck.cards[cardIndex]!;
    const progress = ((currentIndex + 1) / deck.cards.length) * 100;
    const isAtEnd = currentIndex === deck.cards.length - 1;
    const isComplete = isAtEnd && isFlipped;

    if (!currentCard) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <Link
                            href="/student/library"
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Link>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={shuffleCards}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    shuffled
                                        ? "bg-teal-600 text-white"
                                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                                }`}
                                title="Shuffle cards"
                            >
                                <Shuffle className="w-4 h-4" />
                                Shuffle
                            </button>
                            <button
                                onClick={resetDeck}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                                title="Reset deck"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-semibold truncate flex-1">
                            {deck.title}
                        </h1>
                        <span className="text-sm text-gray-400 whitespace-nowrap">
                            {currentIndex + 1} / {deck.cards.length}
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </header>

            {/* Main Card Area */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
                {isComplete ? (
                    // Completion message
                    <div className="text-center animate-fade-in">
                        <PartyPopper className="w-20 h-20 text-yellow-400 mx-auto mb-6" />
                        <h2 className="text-3xl font-bold mb-2">
                            Deck Complete!
                        </h2>
                        <p className="text-gray-400 mb-8">
                            You&apos;ve reviewed all {deck.cards.length} cards
                            {shuffled && " (shuffled)"}
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={resetDeck}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                            >
                                <RotateCcw className="w-5 h-5" />
                                Study Again
                            </button>
                            <Link
                                href="/student/library"
                                className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 rounded-xl font-medium transition-colors"
                            >
                                Back to Library
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Flashcard */}
                        <div
                            onClick={() => setIsFlipped(!isFlipped)}
                            className="perspective-1000 w-full max-w-2xl aspect-[3/2] cursor-pointer"
                        >
                            <div
                                className={`relative w-full h-full transform-style-3d transition-transform duration-500 ${
                                    isFlipped ? "rotate-y-180" : ""
                                }`}
                            >
                                {/* Front of card */}
                                <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl">
                                    <span className="absolute top-4 left-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Front
                                    </span>
                                    <p className="text-2xl md:text-3xl font-medium text-center leading-relaxed">
                                        {currentCard.front}
                                    </p>
                                </div>

                                {/* Back of card */}
                                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-teal-900/50 to-gray-900 border border-teal-700/50 rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl">
                                    <span className="absolute top-4 left-4 text-xs font-medium text-teal-400 uppercase tracking-wider">
                                        Back
                                    </span>
                                    <p className="text-2xl md:text-3xl font-medium text-center leading-relaxed">
                                        {currentCard.back}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Click to flip hint */}
                        <p className="mt-6 text-sm text-gray-500">
                            Click card or press Space to flip
                        </p>

                        {/* Navigation buttons */}
                        <div className="mt-8 flex items-center gap-6">
                            <button
                                onClick={prevCard}
                                disabled={currentIndex === 0}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Previous
                            </button>
                            <button
                                onClick={nextCard}
                                disabled={isAtEnd}
                                className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                            >
                                Next
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Keyboard hint */}
                        <p className="mt-4 text-xs text-gray-600">
                            Use arrow keys to navigate
                        </p>
                    </>
                )}
            </main>
        </div>
    );
}

"use client";

import { useState, useRef } from "react";
import { RotateCcw, Zap, ArrowRight, Lightbulb } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ScrollCard, ScrollStats } from "~/lib/api";

interface FlashcardCardProps {
    card: ScrollCard;
    onRate: (rating: number) => void;
    onNext: () => void;
    stats: ScrollStats;
    xpEarned: number | null;
}

const RATING_LABELS = [
    { value: 1, label: "No idea", color: "text-red-400 border-red-500/30 bg-red-500/10" },
    { value: 2, label: "Vaguely", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
    { value: 3, label: "Kinda", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
    { value: 4, label: "Mostly", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    { value: 5, label: "Knew it", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
];

export function FlashcardCard({ card, onRate, onNext, stats, xpEarned }: FlashcardCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [rated, setRated] = useState(false);
    const flipTimeRef = useRef<number>(Date.now());

    const front = card.flashcard_front ?? card.prompt;
    const back = card.flashcard_back ?? card.explanation;
    const hint = card.flashcard_hint ?? "";

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleRate = (rating: number) => {
        if (rated) return;
        setRated(true);
        onRate(rating);
    };

    return (
        <div className="h-full w-full flex flex-col px-5 pt-4 pb-5 overflow-y-auto">
            {/* Concept + type badge */}
            <div className="flex items-center gap-2 mb-5 shrink-0">
                <span className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                    <RotateCcw className="w-3 h-3" />
                    Flashcard
                </span>
                <span className="text-[11px] font-medium text-gray-500 tracking-wide uppercase">
                    {card.concept}
                </span>
            </div>

            {/* Card */}
            <button
                onClick={handleFlip}
                className="flex-1 min-h-0 flex flex-col"
            >
                <div
                    className={cn(
                        "flex-1 rounded-2xl border p-6 flex flex-col items-center justify-center text-center transition-all duration-500",
                        !isFlipped
                            ? "border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 cursor-pointer hover:border-cyan-500/50"
                            : "border-gray-700 bg-gray-900/60",
                    )}
                >
                    {!isFlipped ? (
                        <>
                            <p className="text-[17px] font-medium text-gray-100 leading-[1.6]">
                                {front}
                            </p>
                            {hint && (
                                <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
                                    <Lightbulb className="w-3 h-3" />
                                    {hint}
                                </div>
                            )}
                            <div className="mt-6 text-xs text-gray-600">Tap to reveal</div>
                        </>
                    ) : (
                        <>
                            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-3">
                                Answer
                            </div>
                            <p className="text-[16px] text-gray-200 leading-[1.7]">
                                {back}
                            </p>
                        </>
                    )}
                </div>
            </button>

            {/* Rating buttons — shown after flip */}
            {isFlipped && !rated && (
                <div className="mt-4 space-y-3 shrink-0">
                    <div className="text-xs text-gray-500 text-center">
                        How well did you know this?
                    </div>
                    <div className="flex gap-2">
                        {RATING_LABELS.map(({ value, label, color }) => (
                            <button
                                key={value}
                                onClick={() => handleRate(value)}
                                className={cn(
                                    "flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all active:scale-95",
                                    color,
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* After rating — XP + next */}
            {rated && (
                <div className="mt-4 space-y-3 shrink-0">
                    {xpEarned !== null && xpEarned > 0 && (
                        <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-sm">
                            <Zap className="w-4 h-4" />
                            +{xpEarned} XP
                        </div>
                    )}
                    <button
                        onClick={onNext}
                        className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-500 active:scale-[0.98] transition-all"
                    >
                        <span className="flex items-center justify-center gap-2">
                            Continue
                            <ArrowRight className="w-4 h-4" />
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

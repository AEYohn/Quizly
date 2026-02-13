"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Zap, HelpCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { RichText, Explanation } from "~/components/shared";
import type { ScrollCard, ScrollStats, ScrollAnalytics } from "~/lib/api";

interface CosmicQuizCardProps {
    card: ScrollCard;
    onAnswer: (answer: string) => void;
    onNext: () => void;
    onHelp: () => void;
    result: { isCorrect: boolean; xpEarned: number; streakBroken: boolean } | null;
    stats: ScrollStats;
    analytics: ScrollAnalytics | null;
}

/** Star burst animation on correct answer */
function StarBurst({ show }: { show: boolean }) {
    if (!show) return null;

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
            {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30) * (Math.PI / 180);
                const tx = Math.cos(angle) * 120;
                const ty = Math.sin(angle) * 120;
                const delay = i * 30;
                return (
                    <div
                        key={i}
                        className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-amber-400"
                        style={{
                            animation: `correct-burst 0.8s ${delay}ms ease-out forwards`,
                            transform: "translate(-50%, -50%)",
                            opacity: 0,
                            ["--tx" as string]: `${tx}px`,
                            ["--ty" as string]: `${ty}px`,
                        }}
                    />
                );
            })}
            <style>{`
                @keyframes correct-burst {
                    0% { opacity: 1; transform: translate(-50%, -50%) scale(0); }
                    50% { opacity: 0.8; transform: translate(calc(-50% + var(--tx) / 2), calc(-50% + var(--ty) / 2)) scale(1.5); }
                    100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.5); }
                }
            `}</style>
        </div>
    );
}

/** Floating XP indicator */
function XpFloat({ xp }: { xp: number }) {
    return (
        <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-sm animate-bounce">
            <Zap className="w-4 h-4" fill="currentColor" style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,0.6))" }} />
            <span style={{ textShadow: "0 0 8px rgba(251,191,36,0.4)" }}>+{xp} XP</span>
        </div>
    );
}

export function CosmicQuizCard({
    card,
    onAnswer,
    onNext,
    onHelp,
    result,
    stats,
    analytics,
}: CosmicQuizCardProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showBurst, setShowBurst] = useState(false);

    // Trigger star burst on correct answer
    useEffect(() => {
        if (result?.isCorrect) {
            setShowBurst(true);
            const timer = setTimeout(() => setShowBurst(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [result?.isCorrect]);

    // Reset selection on new card
    useEffect(() => {
        setSelectedOption(null);
    }, [card.id]);

    const handleOptionSelect = (option: string) => {
        if (result) return; // Already answered
        setSelectedOption(option);
    };

    const handleSubmit = () => {
        if (!selectedOption || result) return;
        // Send the letter (A/B/C/D) not the full option text
        const idx = card.options.indexOf(selectedOption);
        const letter = String.fromCharCode(65 + idx);
        onAnswer(letter);
    };

    // Strip leading "A. " / "B) " etc. since the badge already shows the letter
    const stripPrefix = (opt: string) => opt.replace(/^[A-D][.)]\s*/, "");

    const isAnswered = result !== null;

    return (
        <div className="h-full w-full flex flex-col px-5 pt-4 pb-5 overflow-y-auto relative">
            <StarBurst show={showBurst} />

            {/* Concept badge */}
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <span className="text-[11px] font-medium text-teal-300/40 tracking-wide uppercase">
                    {card.concept}
                </span>
            </div>

            {/* Question prompt */}
            <div className="mb-5 shrink-0">
                <RichText
                    text={card.prompt}
                    className="text-[16px] font-medium text-gray-100 leading-[1.65]"
                />
            </div>

            {/* Pill-shaped options */}
            <div className="space-y-2.5 mb-5 flex-1">
                {card.options.map((option, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isSelected = selectedOption === option;
                    const isCorrect = isAnswered && letter === card.correct_answer;
                    const isWrong = isAnswered && isSelected && !result?.isCorrect;

                    return (
                        <button
                            key={`${card.id}-${i}`}
                            onClick={() => handleOptionSelect(option)}
                            disabled={isAnswered}
                            className={cn(
                                "w-full text-left px-4 py-3.5 rounded-2xl border transition-all duration-300 overflow-hidden",
                                "flex items-start gap-3",
                                !isAnswered && !isSelected && "border-teal-500/15 bg-[#1A1A1A]/80 hover:border-teal-500/30 hover:bg-teal-500/5",
                                !isAnswered && isSelected && "border-teal-500/50 bg-teal-500/10 shadow-[0_0_20px_rgba(0,184,212,0.15)]",
                                isCorrect && "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]",
                                isWrong && "border-red-500/40 bg-red-500/10",
                                isAnswered && !isCorrect && !isWrong && "opacity-50",
                            )}
                        >
                            <span
                                className={cn(
                                    "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all",
                                    !isAnswered && !isSelected && "border-teal-500/20 text-teal-400/60 bg-teal-500/5",
                                    !isAnswered && isSelected && "border-teal-500/40 text-teal-300 bg-teal-500/15",
                                    isCorrect && "border-emerald-500/40 text-emerald-300 bg-emerald-500/15",
                                    isWrong && "border-red-500/40 text-red-300 bg-red-500/15",
                                )}
                            >
                                {letter}
                            </span>
                            <RichText
                                text={stripPrefix(option)}
                                className={cn(
                                    "text-sm leading-relaxed pt-0.5 min-w-0 flex-1 break-words [overflow-wrap:anywhere]",
                                    !isAnswered && "text-gray-300",
                                    isCorrect && "text-emerald-200",
                                    isWrong && "text-red-200",
                                    isAnswered && !isCorrect && !isWrong && "text-gray-500",
                                )}
                            />
                        </button>
                    );
                })}
            </div>

            {/* Action area */}
            <div className="shrink-0 space-y-3">
                {!isAnswered ? (
                    <>
                        {/* Transmit Answer button */}
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedOption}
                            className={cn(
                                "w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]",
                                selectedOption
                                    ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-500 hover:to-teal-400 shadow-[0_0_20px_rgba(0,184,212,0.25)]"
                                    : "bg-[#1A1A1A] text-teal-400/30 border border-teal-500/10 cursor-not-allowed",
                            )}
                        >
                            Check Answer
                        </button>

                        {/* Help link */}
                        <button
                            onClick={onHelp}
                            className="w-full flex items-center justify-center gap-1.5 text-xs text-teal-400/40 hover:text-teal-400/70 transition-colors py-1"
                        >
                            <HelpCircle className="w-3.5 h-3.5" />
                            I don&apos;t know — help me think through it
                        </button>
                    </>
                ) : (
                    <>
                        {/* Result message */}
                        <div className={cn(
                            "rounded-xl px-4 py-3 text-center text-sm font-semibold",
                            result?.isCorrect
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                : "bg-red-500/10 border border-red-500/20 text-red-400",
                        )}>
                            {result?.isCorrect ? "Correct!" : "Incorrect"}
                        </div>

                        {/* XP float */}
                        {result && result.xpEarned > 0 && (
                            <XpFloat xp={result.xpEarned} />
                        )}

                        {/* Explanation panel */}
                        {card.explanation && (
                            <div className="rounded-xl bg-[#1A1A1A] border-l-2 border-teal-500/40 px-4 py-3">
                                <Explanation text={card.explanation} />
                            </div>
                        )}

                        {/* Continue button */}
                        <button
                            onClick={onNext}
                            className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-500 hover:to-teal-400 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,184,212,0.2)]"
                        >
                            <span className="flex items-center justify-center gap-2">
                                Continue
                                <ArrowRight className="w-4 h-4" />
                            </span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

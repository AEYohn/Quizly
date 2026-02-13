"use client";

import { Trophy, Flame, ArrowRight, BookOpen, Layers, Brain } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ScrollCard } from "~/lib/api";

interface MilestoneCardProps {
    card: ScrollCard;
    onNext: () => void;
}

const PHASE_STYLES = {
    learn: { Icon: BookOpen, bg: "bg-teal-500/15", text: "text-teal-400", btnBg: "bg-teal-500/20 hover:bg-teal-500/30", btnText: "text-teal-300" },
    flashcards: { Icon: Layers, bg: "bg-teal-500/15", text: "text-teal-400", btnBg: "bg-teal-500/20 hover:bg-teal-500/30", btnText: "text-teal-300" },
    quiz: { Icon: Brain, bg: "bg-pink-500/15", text: "text-pink-400", btnBg: "bg-pink-500/20 hover:bg-pink-500/30", btnText: "text-pink-300" },
} as const;

export function MilestoneCard({ card, onNext }: MilestoneCardProps) {
    const isMastery = card.milestone_type === "concept_mastered";
    const isPhaseTransition = card.milestone_type === "phase_transition";
    const stats = card.milestone_stats;

    // Phase transition variant
    if (isPhaseTransition) {
        const toPhase = (card.to_phase ?? "quiz") as keyof typeof PHASE_STYLES;
        const style = PHASE_STYLES[toPhase] ?? PHASE_STYLES.quiz;
        const PhaseIcon = style.Icon;
        const ctaLabels: Record<string, string> = {
            flashcards: "Start Flashcards",
            quiz: "Start Quiz",
        };

        return (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-5", style.bg)}>
                    <PhaseIcon className={cn("w-8 h-8", style.text)} />
                </div>
                <h2 className="text-xl font-bold text-gray-100 mb-2">
                    {card.milestone_message || "Phase complete!"}
                </h2>
                <p className="text-sm text-gray-400 mb-6 max-w-[260px]">
                    Great progress! Ready for the next step.
                </p>
                <button
                    onClick={onNext}
                    className={cn("flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-colors", style.btnBg, style.btnText)}
                >
                    {ctaLabels[toPhase] ?? "Continue"}
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            {/* Icon */}
            <div
                className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-5",
                    isMastery
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-teal-500/15 text-teal-400",
                )}
            >
                {isMastery ? (
                    <Trophy className="w-8 h-8" />
                ) : (
                    <Flame className="w-8 h-8" />
                )}
            </div>

            {/* Headline */}
            <h2 className="text-xl font-bold text-gray-100 mb-2">
                {isMastery
                    ? `You mastered ${card.milestone_concept}!`
                    : `${stats?.cards_answered ?? 0} cards done!`}
            </h2>

            {/* Subtext */}
            <p className="text-sm text-gray-400 mb-6 max-w-[260px]">
                {isMastery
                    ? `${stats?.concepts_mastered ?? 0} of ${stats?.total_concepts ?? 0} concepts mastered`
                    : stats?.accuracy !== undefined
                        ? `${stats.accuracy}% accuracy — ${stats.accuracy >= 80 ? "great work!" : stats.accuracy >= 60 ? "keep it up!" : "you're getting there!"}`
                        : "Keep going!"}
            </p>

            {/* CTA */}
            <button
                onClick={onNext}
                className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-colors",
                    isMastery
                        ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        : "bg-teal-500/20 text-teal-300 hover:bg-teal-500/30",
                )}
            >
                Keep Going
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
    );
}

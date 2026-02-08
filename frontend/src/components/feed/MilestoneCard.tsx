"use client";

import { Trophy, Flame, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ScrollCard } from "~/lib/api";

interface MilestoneCardProps {
    card: ScrollCard;
    onNext: () => void;
}

export function MilestoneCard({ card, onNext }: MilestoneCardProps) {
    const isMastery = card.milestone_type === "concept_mastered";
    const stats = card.milestone_stats;

    return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            {/* Icon */}
            <div
                className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-5",
                    isMastery
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-violet-500/15 text-violet-400",
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
                        : "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30",
                )}
            >
                Keep Going
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
    );
}

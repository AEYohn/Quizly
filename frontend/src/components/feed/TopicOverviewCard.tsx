"use client";

import { BookOpen, Clock, ArrowRight } from "lucide-react";
import type { ScrollCard } from "~/lib/api";

interface TopicOverviewCardProps {
    card: ScrollCard;
    onStart: () => void;
}

export function TopicOverviewCard({ card, onStart }: TopicOverviewCardProps) {
    const concepts = card.options || [];
    const estimatedMinutes = card.xp_value || 0;

    return (
        <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
                <BookOpen className="w-8 h-8 text-indigo-500" />
            </div>

            {/* Topic name */}
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
                {card.concept}
            </h2>

            {/* Meta row */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs text-gray-500">{concepts.length} concepts</span>
                </div>
                {estimatedMinutes > 0 && (
                    <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs text-gray-500">~{estimatedMinutes} min</span>
                    </div>
                )}
            </div>

            {/* Concept chips */}
            <div className="flex flex-wrap justify-center gap-1.5 mb-5 max-w-xs">
                {concepts.map((concept: string) => (
                    <span key={concept} className="bg-gray-100 px-2.5 py-1 rounded-full text-[11px] text-gray-600">
                        {concept}
                    </span>
                ))}
            </div>

            {/* Start button */}
            <button
                onClick={onStart}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
            >
                Start Learning
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
    );
}

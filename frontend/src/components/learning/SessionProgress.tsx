"use client";

import { cn } from "~/lib/utils";

interface SessionProgressProps {
    questionsAnswered: number;
    correctCount: number;
    currentConcept?: string;
    conceptsRemaining?: number;
    phase?: string;
}

export function SessionProgress({
    questionsAnswered,
    correctCount,
    currentConcept,
    conceptsRemaining,
    phase,
}: SessionProgressProps) {
    const accuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;

    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-900/50 border-b border-gray-800 text-xs">
            <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Questions:</span>
                <span className="text-gray-200 font-medium">{questionsAnswered}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Accuracy:</span>
                <span
                    className={cn(
                        "font-medium",
                        accuracy >= 70 ? "text-emerald-400" : accuracy >= 40 ? "text-amber-400" : "text-red-400"
                    )}
                >
                    {accuracy}%
                </span>
            </div>
            {currentConcept && (
                <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">Topic:</span>
                    <span className="text-sky-400 font-medium truncate max-w-[120px]">{currentConcept}</span>
                </div>
            )}
            {conceptsRemaining !== undefined && conceptsRemaining > 0 && (
                <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-gray-500">{conceptsRemaining} more</span>
                </div>
            )}
            {phase && (
                <div className="ml-auto">
                    <span
                        className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            phase === "diagnostic" && "bg-amber-500/20 text-amber-400",
                            phase === "learning" && "bg-sky-500/20 text-sky-400",
                            phase === "ended" && "bg-emerald-500/20 text-emerald-400"
                        )}
                    >
                        {phase === "diagnostic" ? "Diagnosing" : phase === "learning" ? "Learning" : phase}
                    </span>
                </div>
            )}
        </div>
    );
}

"use client";

import { BookOpen, Layers, Brain, Check, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

interface PhaseProgressBarProps {
    phase: "learn" | "flashcards" | "quiz" | "mixed";
    progress?: { current: number; total: number; label: string };
    onSkip?: (targetPhase: string) => void;
}

const PHASES = [
    { key: "learn", label: "Learn", Icon: BookOpen },
    { key: "flashcards", label: "Memorize", Icon: Layers },
    { key: "quiz", label: "Quiz", Icon: Brain },
] as const;

export function PhaseProgressBar({ phase, progress, onSkip }: PhaseProgressBarProps) {
    const currentIdx = PHASES.findIndex((p) => p.key === phase);
    const progressPct = progress
        ? Math.min(100, Math.round((progress.current / Math.max(1, progress.total)) * 100))
        : 0;

    return (
        <div className="px-4 py-2 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                    {PHASES.map((p, idx) => {
                        const isCompleted = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        const Icon = p.Icon;

                        return (
                            <div key={p.key} className="flex items-center">
                                <div
                                    className={cn(
                                        "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold",
                                        isCurrent && "bg-indigo-100 text-indigo-600",
                                        isCompleted && "bg-emerald-50 text-emerald-600",
                                        !isCurrent && !isCompleted && "bg-gray-50 text-gray-400",
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                        <Icon
                                            className={cn(
                                                "w-3 h-3",
                                                isCurrent ? "text-indigo-500" : "text-gray-400",
                                            )}
                                        />
                                    )}
                                    {p.label}
                                </div>
                                {idx < PHASES.length - 1 && (
                                    <ChevronRight className="w-2.5 h-2.5 text-gray-300 mx-0.5" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {onSkip && phase !== "quiz" && (
                    <button
                        onClick={() => onSkip(phase === "learn" ? "flashcards" : "quiz")}
                        className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700 px-2 py-1"
                    >
                        Skip to Quiz
                    </button>
                )}
            </div>

            {progress && (
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            )}
        </div>
    );
}

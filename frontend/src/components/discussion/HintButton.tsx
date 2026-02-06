"use client";

import { Lightbulb } from "lucide-react";

interface HintButtonProps {
    onClick: () => void;
    hintsUsed: number;
    maxHints?: number;
    disabled?: boolean;
}

export function HintButton({ onClick, hintsUsed, maxHints = 3, disabled }: HintButtonProps) {
    const remaining = maxHints - hintsUsed;

    return (
        <button
            onClick={onClick}
            disabled={disabled || remaining <= 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
            <Lightbulb className="w-3.5 h-3.5" />
            Give me a hint ({remaining} left)
        </button>
    );
}

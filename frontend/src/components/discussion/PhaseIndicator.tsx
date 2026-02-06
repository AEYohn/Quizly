"use client";

import { cn } from "~/lib/utils";

interface PhaseIndicatorProps {
    phase: string | null;
}

const phases: Record<string, { label: string; color: string }> = {
    probing: { label: "Exploring your thinking", color: "text-sky-400 bg-sky-500/10" },
    hinting: { label: "Giving hints", color: "text-amber-400 bg-amber-500/10" },
    targeted: { label: "Addressing misconception", color: "text-orange-400 bg-orange-500/10" },
    explaining: { label: "Explaining", color: "text-emerald-400 bg-emerald-500/10" },
};

export function PhaseIndicator({ phase }: PhaseIndicatorProps) {
    if (!phase) return null;
    const info = phases[phase] || { label: phase, color: "text-gray-400 bg-gray-500/10" };

    return (
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", info.color)}>
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
            {info.label}
        </span>
    );
}

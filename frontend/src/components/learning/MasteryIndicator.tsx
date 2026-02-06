"use client";

import { cn } from "~/lib/utils";

interface MasteryIndicatorProps {
    concept: string;
    score: number;
    trend?: "up" | "down" | "stable";
    compact?: boolean;
}

export function MasteryIndicator({ concept, score, trend, compact }: MasteryIndicatorProps) {
    const radius = compact ? 16 : 22;
    const stroke = compact ? 3 : 4;
    const circumference = 2 * Math.PI * radius;
    const filled = (score / 100) * circumference;

    const color =
        score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
    const strokeColor =
        score >= 80 ? "stroke-emerald-400" : score >= 50 ? "stroke-amber-400" : "stroke-red-400";

    const size = compact ? 40 : 52;

    return (
        <div className="flex items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={stroke}
                        className="text-gray-700"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - filled}
                        strokeLinecap="round"
                        className={cn("transition-all duration-500", strokeColor)}
                    />
                </svg>
                <div className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold", color)}>
                    {Math.round(score)}
                </div>
            </div>
            {!compact && (
                <div>
                    <div className="text-sm text-gray-200 font-medium truncate max-w-[120px]">{concept}</div>
                    {trend && (
                        <div className="text-xs text-gray-500">
                            {trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

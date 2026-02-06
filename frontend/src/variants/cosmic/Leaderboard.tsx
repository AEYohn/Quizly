"use client";

import { Trophy, Star, Medal, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import type { LeaderboardProps } from "~/variants/contracts";

const PERIOD_LABELS = {
    weekly: "This Week",
    alltime: "All Time",
} as const;

const PODIUM_CONFIG = [
    { place: 1, height: "h-28", glow: "rgba(251,191,36,0.5)", color: "text-amber-400", border: "border-amber-400/30", bg: "from-amber-400/10 to-amber-400/5", label: "1st" },
    { place: 2, height: "h-20", glow: "rgba(192,192,192,0.4)", color: "text-gray-300", border: "border-gray-400/30", bg: "from-gray-400/10 to-gray-400/5", label: "2nd" },
    { place: 3, height: "h-16", glow: "rgba(205,127,50,0.4)", color: "text-amber-600", border: "border-amber-600/30", bg: "from-amber-600/10 to-amber-600/5", label: "3rd" },
];

export function Leaderboard({
    period,
    entries,
    currentUserEntry,
    totalPlayers,
    isLoading,
    onPeriodChange,
}: LeaderboardProps) {
    const top3 = entries.slice(0, 3);
    const rest = entries.slice(3);

    // Reorder top 3 for podium display: [2nd, 1st, 3rd]
    const podiumOrder = top3.length >= 3
        ? [top3[1]!, top3[0]!, top3[2]!]
        : top3;

    // Unique key for an entry since no student_id
    const entryKey = (e: typeof entries[number], idx?: number) =>
        `${e.rank}-${e.student_name}-${idx ?? 0}`;

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-[#050510] via-[#0a0820] to-[#050515] relative overflow-y-auto">
            {/* Star field background */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.3) 50%, transparent 100%),
                        radial-gradient(1px 1px at 30% 55%, rgba(165,180,252,0.25) 50%, transparent 100%),
                        radial-gradient(1px 1px at 55% 25%, rgba(255,255,255,0.2) 50%, transparent 100%),
                        radial-gradient(1px 1px at 75% 65%, rgba(251,191,36,0.15) 50%, transparent 100%),
                        radial-gradient(1px 1px at 90% 35%, rgba(165,180,252,0.2) 50%, transparent 100%),
                        radial-gradient(1px 1px at 45% 85%, rgba(255,255,255,0.15) 50%, transparent 100%)
                    `,
                }}
            />

            <div className="relative z-10 px-5 pt-6 pb-8 space-y-6 max-w-lg mx-auto w-full">
                {/* Header */}
                <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <h1 className="text-xl font-bold text-gray-100">Star Rankings</h1>
                    </div>
                    <p className="text-xs text-indigo-300/40">{totalPlayers} explorers competing</p>
                </div>

                {/* Period tabs with indigo active state */}
                <div className="flex gap-2 justify-center">
                    {(["weekly", "alltime"] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => onPeriodChange(p)}
                            className={cn(
                                "px-5 py-2 rounded-xl text-sm font-medium transition-all border",
                                period === p
                                    ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                                    : "bg-transparent text-indigo-300/40 border-indigo-500/10 hover:border-indigo-500/20",
                            )}
                        >
                            {PERIOD_LABELS[p]}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Cosmic gradient podium */}
                        {top3.length >= 3 && (
                            <div className="flex items-end justify-center gap-3 pt-4 pb-2">
                                {podiumOrder.map((entry, displayIdx) => {
                                    const actualRank = entry.rank;
                                    const config = PODIUM_CONFIG[actualRank - 1]!;
                                    return (
                                        <div key={entryKey(entry, displayIdx)} className="flex flex-col items-center gap-2 w-24">
                                            {/* Avatar with glow */}
                                            <div
                                                className="relative"
                                                style={{ filter: `drop-shadow(0 0 10px ${config.glow})` }}
                                            >
                                                <div className={cn(
                                                    "w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-bold",
                                                    config.border,
                                                    `bg-gradient-to-br ${config.bg}`,
                                                    config.color,
                                                )}>
                                                    {entry.student_name.charAt(0).toUpperCase()}
                                                </div>
                                                {actualRank === 1 && (
                                                    <Star
                                                        className="absolute -top-2 -right-1 w-5 h-5 text-amber-400"
                                                        fill="currentColor"
                                                    />
                                                )}
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xs font-semibold text-gray-200 truncate max-w-[80px]">
                                                    {entry.student_name}
                                                </div>
                                                <div className="text-[10px] text-amber-400 font-medium">{entry.total_xp} XP</div>
                                            </div>
                                            {/* Trapezoid platform */}
                                            <div
                                                className={cn(
                                                    "w-full rounded-t-lg border border-b-0",
                                                    config.height,
                                                    config.border,
                                                    `bg-gradient-to-t ${config.bg}`,
                                                )}
                                                style={{
                                                    clipPath: "polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)",
                                                }}
                                            >
                                                <div className="flex items-center justify-center pt-2">
                                                    <span className={cn("text-sm font-bold", config.color)}>{config.label}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Remaining ranks */}
                        {rest.length > 0 && (
                            <div className="space-y-2">
                                {rest.map((entry, idx) => (
                                    <div
                                        key={entryKey(entry, idx)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                            entry.is_current_user
                                                ? "bg-indigo-500/10 border-indigo-500/20"
                                                : "bg-[#0d0b25]/60 border-indigo-500/5",
                                        )}
                                    >
                                        <span className="text-sm font-bold text-indigo-300/40 w-8 text-center shrink-0">
                                            {entry.rank}
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                                            {entry.student_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-200 truncate">
                                                {entry.student_name}
                                            </div>
                                            <div className="text-[10px] text-indigo-300/30">
                                                {entry.sessions_played} voyages &middot; {entry.accuracy}% accuracy
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-amber-400/80 shrink-0">{entry.total_xp}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Current user footer if not in visible list */}
                        {currentUserEntry && !entries.find((e) => e.is_current_user) && (
                            <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                <span className="text-sm font-bold text-indigo-300 w-8 text-center shrink-0">
                                    {currentUserEntry.rank}
                                </span>
                                <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                                    {currentUserEntry.student_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-100 truncate">
                                        {currentUserEntry.student_name} (You)
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-amber-400 shrink-0">{currentUserEntry.total_xp}</span>
                            </div>
                        )}

                        {entries.length === 0 && (
                            <div className="text-center py-12 text-indigo-300/30 text-sm">
                                No rankings yet. Be the first explorer!
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

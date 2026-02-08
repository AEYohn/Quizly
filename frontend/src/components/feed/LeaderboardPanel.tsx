"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Trophy,
    Flame,
    Crown,
    Medal,
    Target,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { learnApi } from "~/lib/api";
import type { LeaderboardEntry } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";

// ---------------------------------------------------------------------------
// Podium — top 3 visual display
// ---------------------------------------------------------------------------

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
    const first = entries[0];
    const second = entries[1];
    const third = entries[2];

    if (!first) return null;

    const podiumSlot = (
        entry: LeaderboardEntry | undefined,
        rank: 1 | 2 | 3,
    ) => {
        if (!entry) {
            return (
                <div className="flex flex-col items-center opacity-20">
                    <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700" />
                    <div
                        className={cn(
                            "w-full rounded-t-xl mt-3 bg-gray-800/40 border border-gray-700/40 border-b-0",
                            rank === 1 ? "h-28" : rank === 2 ? "h-20" : "h-14",
                        )}
                    />
                </div>
            );
        }

        const colors = {
            1: {
                ring: "ring-amber-400/80",
                bg: "from-amber-500/20 to-amber-600/5",
                bar: "from-amber-500/30 via-amber-500/20 to-amber-600/10",
                border: "border-amber-500/30",
                text: "text-amber-400",
                icon: <Crown className="w-5 h-5 text-amber-400" />,
                glow: "shadow-[0_0_30px_rgba(251,191,36,0.15)]",
            },
            2: {
                ring: "ring-gray-300/60",
                bg: "from-gray-400/15 to-gray-500/5",
                bar: "from-gray-400/20 via-gray-400/15 to-gray-500/5",
                border: "border-gray-400/25",
                text: "text-gray-300",
                icon: <Medal className="w-4.5 h-4.5 text-gray-300" />,
                glow: "",
            },
            3: {
                ring: "ring-orange-400/50",
                bg: "from-orange-500/15 to-orange-600/5",
                bar: "from-orange-500/20 via-orange-500/15 to-orange-600/5",
                border: "border-orange-500/20",
                text: "text-orange-400",
                icon: <Medal className="w-4 h-4 text-orange-400" />,
                glow: "",
            },
        };

        const c = colors[rank];
        const initial = entry.student_name.charAt(0).toUpperCase();

        return (
            <div className="flex flex-col items-center">
                <div className="relative mb-1">
                    <div
                        className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ring-2 bg-gradient-to-br",
                            c.ring, c.bg, c.glow,
                            entry.is_current_user && "ring-3",
                        )}
                    >
                        <span className={c.text}>{initial}</span>
                    </div>
                    <div className="absolute -top-2 -right-1">{c.icon}</div>
                </div>
                <span
                    className={cn(
                        "text-xs font-semibold truncate max-w-[80px] text-center",
                        entry.is_current_user ? "text-violet-300" : "text-gray-200",
                    )}
                >
                    {entry.student_name}
                </span>
                <span className={cn("text-[11px] font-bold", c.text)}>
                    {entry.total_xp.toLocaleString()} XP
                </span>
                <div
                    className={cn(
                        "w-full rounded-t-xl mt-2 bg-gradient-to-b border border-b-0 flex items-end justify-center pb-2",
                        c.bar, c.border,
                        rank === 1 ? "h-28" : rank === 2 ? "h-20" : "h-14",
                    )}
                >
                    <span className={cn("text-2xl font-black", c.text)}>{rank}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-3 gap-3 items-end px-4 pt-6 pb-0">
            {podiumSlot(second, 2)}
            {podiumSlot(first, 1)}
            {podiumSlot(third, 3)}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Rank row
// ---------------------------------------------------------------------------

function RankRow({ entry }: { entry: LeaderboardEntry }) {
    const initial = entry.student_name.charAt(0).toUpperCase();
    const isTop3 = entry.rank <= 3;
    const rankColor = isTop3
        ? entry.rank === 1 ? "text-amber-400" : entry.rank === 2 ? "text-gray-300" : "text-orange-400"
        : "text-gray-600";

    return (
        <div
            className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors",
                entry.is_current_user
                    ? "bg-violet-500/8 border border-violet-500/20 ring-1 ring-violet-500/10"
                    : "bg-gray-900/40 border border-gray-800/40 hover:bg-gray-800/40",
            )}
        >
            <span className={cn("w-7 text-sm font-bold text-right tabular-nums", rankColor)}>
                {entry.rank}
            </span>
            <div
                className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                    entry.is_current_user
                        ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30"
                        : "bg-gray-800 text-gray-400",
                )}
            >
                {initial}
            </div>
            <div className="flex-1 min-w-0">
                <div className={cn(
                    "text-sm font-semibold truncate",
                    entry.is_current_user ? "text-violet-200" : "text-gray-200",
                )}>
                    {entry.student_name}
                    {entry.is_current_user && (
                        <span className="ml-1.5 text-[10px] font-medium text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                            You
                        </span>
                    )}
                </div>
                <div className="text-[11px] text-gray-500">
                    Lv. {entry.level} &middot; {entry.sessions_played} session{entry.sessions_played !== 1 ? "s" : ""}
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                {entry.best_streak > 0 && (
                    <div className="flex items-center gap-0.5 text-[11px] text-orange-400/70">
                        <Flame className="w-3 h-3" />
                        {entry.best_streak}
                    </div>
                )}
                <div className="flex items-center gap-0.5 text-[11px] text-gray-500">
                    <Target className="w-3 h-3" />
                    {entry.accuracy}%
                </div>
                <div className="text-right">
                    <span className="text-sm font-bold text-amber-400 tabular-nums">
                        {entry.total_xp.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-amber-400/50 ml-0.5">XP</span>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Your rank card
// ---------------------------------------------------------------------------

function YourRankCard({ entry, totalPlayers }: { entry: LeaderboardEntry; totalPlayers: number }) {
    return (
        <div className="mx-4 p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-600/5 to-fuchsia-500/5 border border-violet-500/20 ring-1 ring-violet-500/10">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Your Ranking</span>
                <span className="text-xs text-gray-500">#{entry.rank} of {totalPlayers}</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-center">
                    <div className="text-3xl font-black text-violet-300 tabular-nums">#{entry.rank}</div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="text-center">
                        <div className="text-lg font-bold text-amber-400 tabular-nums">{entry.total_xp.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">XP</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-gray-200 tabular-nums">Lv.{entry.level}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Level</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-emerald-400 tabular-nums">{entry.accuracy}%</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Acc</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// LeaderboardPanel — used in tab container and standalone page
// ---------------------------------------------------------------------------

export function LeaderboardPanel() {
    const auth = useAuth();
    const [period, setPeriod] = useState<"weekly" | "alltime">("weekly");
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
    const [totalPlayers, setTotalPlayers] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const studentName = getStudentName(auth.user);

    const fetchLeaderboard = useCallback(
        async (p: "weekly" | "alltime") => {
            setIsLoading(true);
            const result = await learnApi.getLeaderboard(p, studentName);
            if (result.success) {
                setEntries(result.data.entries);
                setCurrentUserRank(result.data.current_user_rank);
                setTotalPlayers(result.data.total_players);
            }
            setIsLoading(false);
        },
        [studentName],
    );

    useEffect(() => {
        fetchLeaderboard(period);
    }, [period, fetchLeaderboard]);

    const currentUserEntry = entries.find((e) => e.is_current_user);

    return (
        <div className="h-full flex flex-col bg-gray-950 max-w-lg mx-auto w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/40 shrink-0">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h1 className="text-lg font-bold text-gray-100 tracking-tight">Leaderboard</h1>
            </div>

            {/* Period tabs */}
            <div className="px-4 pt-4 pb-2 shrink-0">
                <div className="flex bg-gray-900/60 rounded-2xl p-1 border border-gray-800/40">
                    {(["weekly", "alltime"] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-xs font-semibold transition-all",
                                period === p
                                    ? "bg-gray-800 text-gray-100 shadow-sm"
                                    : "text-gray-500 hover:text-gray-400",
                            )}
                        >
                            {p === "weekly" ? "This Week" : "All Time"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-pulse">
                            <Trophy className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="text-xs text-gray-500">Loading rankings...</span>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && entries.length === 0 && (
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto">
                            <Trophy className="w-8 h-8 text-gray-700" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-gray-300 mb-1">No rankings yet</h2>
                            <p className="text-sm text-gray-500">
                                {period === "weekly"
                                    ? "No one has played this week yet. Be the first!"
                                    : "Start learning to appear on the leaderboard."}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Leaderboard content */}
            {!isLoading && entries.length > 0 && (
                <div className="flex-1 overflow-y-auto pb-4">
                    <Podium entries={entries} />
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent mx-4 my-5" />
                    {currentUserEntry && (
                        <>
                            <YourRankCard entry={currentUserEntry} totalPlayers={totalPlayers} />
                            <div className="h-4" />
                        </>
                    )}
                    <div className="px-4 space-y-2">
                        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                            Rankings
                        </h3>
                        {entries.map((entry) => (
                            <RankRow key={entry.student_name} entry={entry} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

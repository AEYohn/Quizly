"use client";

import { LogOut, Star, Zap, Target, BookOpen, TrendingUp, Award, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ProfileProps } from "~/variants/contracts";

export function Profile({
    studentName,
    initial,
    email,
    progress,
    isLoading,
    totalXp,
    totalSessions,
    accuracy,
    level,
    onLogout,
}: ProfileProps) {
    // XP thresholds per level
    const xpForLevel = level * 500;
    const xpProgress = totalXp % 500;
    const xpPercent = Math.min((xpProgress / 500) * 100, 100);

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-[#050510] via-[#0a0820] to-[#050515] relative overflow-y-auto">
            {/* Star field */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(1px 1px at 8% 12%, rgba(255,255,255,0.3) 50%, transparent 100%),
                        radial-gradient(1px 1px at 25% 45%, rgba(165,180,252,0.3) 50%, transparent 100%),
                        radial-gradient(1px 1px at 50% 20%, rgba(255,255,255,0.2) 50%, transparent 100%),
                        radial-gradient(1px 1px at 72% 60%, rgba(110,231,183,0.2) 50%, transparent 100%),
                        radial-gradient(1px 1px at 90% 30%, rgba(251,191,36,0.15) 50%, transparent 100%),
                        radial-gradient(1px 1px at 40% 80%, rgba(165,180,252,0.2) 50%, transparent 100%)
                    `,
                }}
            />

            <div className="relative z-10 px-5 pt-8 pb-8 space-y-8 max-w-lg mx-auto w-full">
                {/* Avatar as "planet" with orbital ring */}
                <div className="flex flex-col items-center">
                    <div className="relative w-28 h-28">
                        {/* Orbital ring */}
                        <svg className="absolute inset-0 w-28 h-28" viewBox="0 0 112 112">
                            <ellipse
                                cx="56" cy="56" rx="54" ry="20"
                                fill="none"
                                stroke="rgba(129,140,248,0.2)"
                                strokeWidth="1"
                                transform="rotate(-20, 56, 56)"
                            />
                            <ellipse
                                cx="56" cy="56" rx="54" ry="20"
                                fill="none"
                                stroke="rgba(129,140,248,0.15)"
                                strokeWidth="0.5"
                                transform="rotate(-20, 56, 56)"
                                strokeDasharray="4 6"
                            />
                            {/* Orbiting dot */}
                            <circle r="3" fill="#818cf8" opacity="0.8">
                                <animateMotion
                                    dur="6s"
                                    repeatCount="indefinite"
                                    path="M 56,36 A 54,20 -20 1,1 55.9,36 Z"
                                />
                            </circle>
                        </svg>

                        {/* Planet body */}
                        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-800 to-[#0a0820] border-2 border-indigo-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.25)]">
                            <span className="text-2xl font-bold text-indigo-200">{initial}</span>
                        </div>

                        {/* Level badge */}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400 text-[10px] font-bold">
                            Level {level}
                        </div>
                    </div>

                    <h1 className="text-xl font-bold text-gray-100 mt-5">{studentName}</h1>
                    <p className="text-xs text-indigo-300/40 mt-0.5">{email}</p>

                    {/* XP progress bar */}
                    <div className="w-full max-w-[200px] mt-4">
                        <div className="flex items-center justify-between text-[10px] text-indigo-300/40 mb-1">
                            <span>{totalXp} XP total</span>
                            <span>Level {level + 1}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-indigo-500/10 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-amber-400 transition-all duration-500"
                                style={{ width: `${xpPercent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Stats in constellation-pattern layout */}
                <div className="relative">
                    {/* Connecting lines between stat nodes */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 180" preserveAspectRatio="none">
                        <line x1="75" y1="45" x2="225" y2="45" stroke="rgba(129,140,248,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="75" y1="45" x2="75" y2="135" stroke="rgba(129,140,248,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="225" y1="45" x2="225" y2="135" stroke="rgba(129,140,248,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="75" y1="135" x2="225" y2="135" stroke="rgba(129,140,248,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="150" y1="0" x2="150" y2="180" stroke="rgba(129,140,248,0.06)" strokeWidth="1" strokeDasharray="4 4" />
                    </svg>

                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: "Total XP", value: totalXp, icon: Zap, color: "text-amber-400", glow: "rgba(251,191,36,0.3)" },
                            { label: "Voyages", value: totalSessions, icon: BookOpen, color: "text-indigo-400", glow: "rgba(129,140,248,0.3)" },
                            { label: "Accuracy", value: `${accuracy}%`, icon: Target, color: "text-emerald-400", glow: "rgba(110,231,183,0.3)" },
                            { label: "Level", value: level, icon: Award, color: "text-amber-400", glow: "rgba(251,191,36,0.3)" },
                        ].map(({ label, value, icon: Icon, color, glow }) => (
                            <div
                                key={label}
                                className="relative bg-[#0d0b25]/80 border border-indigo-500/10 rounded-2xl p-4 text-center group hover:border-indigo-500/20 transition-all"
                            >
                                {/* Subtle glow on hover */}
                                <div
                                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ boxShadow: `inset 0 0 20px ${glow}` }}
                                />
                                <div className="relative">
                                    <Icon className={cn("w-5 h-5 mx-auto mb-2", color)} />
                                    <div className="text-xl font-bold text-gray-100">{value}</div>
                                    <div className="text-[10px] text-indigo-300/40 uppercase tracking-wider mt-1">{label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Subject progress */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    </div>
                ) : progress && progress.mastery && progress.mastery.length > 0 ? (
                    <div className="space-y-3">
                        <h2 className="text-xs font-semibold text-indigo-300/50 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Explored Concepts
                        </h2>
                        <div className="space-y-2">
                            {progress.mastery.slice(0, 10).map((concept) => {
                                const scorePercent = Math.round(concept.score * 100);
                                return (
                                    <div
                                        key={concept.concept}
                                        className="bg-[#0d0b25]/60 border border-indigo-500/8 rounded-xl px-4 py-3"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-200 font-medium truncate">{concept.concept}</span>
                                            <span className="text-xs text-indigo-300/30 shrink-0 ml-2">{concept.attempts} attempts</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 rounded-full bg-indigo-500/10 overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all",
                                                        scorePercent >= 80 ? "bg-emerald-500" : scorePercent >= 50 ? "bg-amber-500" : "bg-red-500",
                                                    )}
                                                    style={{ width: `${scorePercent}%` }}
                                                />
                                            </div>
                                            <span className="text-[11px] text-indigo-300/40 w-10 text-right">{scorePercent}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary */}
                        {progress.summary && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                                {[
                                    { label: "Mastered", value: progress.summary.mastered, color: "text-emerald-400" },
                                    { label: "In Progress", value: progress.summary.in_progress, color: "text-indigo-400" },
                                    { label: "Needs Work", value: progress.summary.needs_work, color: "text-red-400" },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="bg-[#0d0b25]/60 border border-indigo-500/8 rounded-xl p-3 text-center">
                                        <div className={cn("text-lg font-bold", color)}>{value}</div>
                                        <div className="text-[9px] text-indigo-300/30 uppercase tracking-wider mt-0.5">{label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Logout */}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/15 text-red-400/70 hover:bg-red-500/5 hover:text-red-400 hover:border-red-500/25 transition-all text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    End Mission
                </button>
            </div>
        </div>
    );
}

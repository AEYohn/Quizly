"use client";

import { useState, useEffect } from "react";
import { User, Zap, BookOpen, Target, LogOut, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { learnApi } from "~/lib/api";
import type { LearnProgressResponse } from "~/lib/api";
import { useAuth } from "~/lib/auth";

export function ProfilePanel() {
    const auth = useAuth();
    const [progress, setProgress] = useState<LearnProgressResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const studentName = auth.user?.name || "Student";
    const initial = studentName.charAt(0).toUpperCase();

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            const res = await learnApi.getProgress(studentName);
            if (res.success) {
                setProgress(res.data);
            }
            setIsLoading(false);
        }
        load();
    }, [studentName]);

    // Compute stats from progress data
    const totalXp = progress?.recent_sessions.reduce((sum, s) => sum + (s.questions_correct * 10), 0) ?? 0;
    const totalSessions = progress?.recent_sessions.length ?? 0;
    const totalAnswered = progress?.recent_sessions.reduce((sum, s) => sum + s.questions_answered, 0) ?? 0;
    const totalCorrect = progress?.recent_sessions.reduce((sum, s) => sum + s.questions_correct, 0) ?? 0;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const level = totalXp > 0 ? Math.floor(Math.sqrt(totalXp / 100)) : 0;

    return (
        <div className="h-full flex flex-col bg-gray-950 max-w-lg mx-auto w-full overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/40 shrink-0">
                <User className="w-5 h-5 text-violet-400" />
                <h1 className="text-lg font-bold text-gray-100 tracking-tight">Profile</h1>
            </div>

            <div className="flex-1 p-4 space-y-6">
                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-violet-500/20 border-2 border-violet-500/30 flex items-center justify-center text-2xl font-bold text-violet-300">
                        {initial}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-100">{studentName}</h2>
                        <p className="text-sm text-gray-500">{auth.user?.email || "Student"}</p>
                    </div>
                </div>

                {/* Stats grid */}
                {isLoading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-20 rounded-2xl bg-gray-900/60 border border-gray-800/40 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/40">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Total XP</span>
                            </div>
                            <div className="text-2xl font-bold text-amber-400 tabular-nums">{totalXp.toLocaleString()}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/40">
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Level</span>
                            </div>
                            <div className="text-2xl font-bold text-violet-300 tabular-nums">{level}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/40">
                            <div className="flex items-center gap-1.5 mb-2">
                                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                                <span className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Sessions</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-100 tabular-nums">{totalSessions}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/40">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Target className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Accuracy</span>
                            </div>
                            <div className="text-2xl font-bold text-emerald-400 tabular-nums">{accuracy}%</div>
                        </div>
                    </div>
                )}

                {/* Mastery summary */}
                {progress && progress.summary && (
                    <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/40">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Concept Mastery</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-emerald-400">Mastered</span>
                                    <span className="text-gray-400 tabular-nums">{progress.summary.mastered}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${progress.summary.total_concepts > 0 ? (progress.summary.mastered / progress.summary.total_concepts * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-amber-400">In Progress</span>
                                    <span className="text-gray-400 tabular-nums">{progress.summary.in_progress}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-amber-500 transition-all"
                                        style={{ width: `${progress.summary.total_concepts > 0 ? (progress.summary.in_progress / progress.summary.total_concepts * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Links */}
                <div className="space-y-2">
                    <Link
                        href="/progress"
                        className="flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-900/40 border border-gray-800/40 hover:bg-gray-800/40 transition-colors"
                    >
                        <span className="text-sm text-gray-200">Full Progress Dashboard</span>
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                    </Link>
                </div>

                {/* Logout */}
                <button
                    onClick={() => auth.logout()}
                    className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400 text-sm hover:bg-red-500/10 transition-colors w-full"
                >
                    <LogOut className="w-4 h-4" />
                    Log Out
                </button>
            </div>
        </div>
    );
}

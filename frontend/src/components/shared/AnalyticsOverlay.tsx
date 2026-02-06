"use client";

import { X, Target } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ScrollSessionAnalytics } from "~/lib/api";

export function AnalyticsOverlay({ data, onClose }: { data: ScrollSessionAnalytics; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 bg-gray-950/98 backdrop-blur-sm flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60">
                <h2 className="text-lg font-bold text-gray-100">Session Stats</h2>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 text-gray-400 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-1 p-5 space-y-6 max-w-lg mx-auto w-full">
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "Accuracy", value: `${data.accuracy}%`, color: "text-gray-100" },
                        { label: "Total XP", value: data.total_xp, color: "text-amber-400" },
                        { label: "Best Streak", value: data.best_streak, color: "text-orange-400" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4 text-center">
                            <div className={cn("text-2xl font-bold", color)}>{value}</div>
                            <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide">{label}</div>
                        </div>
                    ))}
                </div>

                {data.improvement_areas.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-red-400 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                            <Target className="w-3.5 h-3.5" />Needs Work
                        </h3>
                        <div className="space-y-2">
                            {data.improvement_areas.map((area) => {
                                const concept = data.concepts.find((c) => c.concept === area);
                                return (
                                    <div key={area} className="flex items-center justify-between bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3">
                                        <span className="text-sm text-gray-200">{area}</span>
                                        <span className="text-xs font-medium text-red-400">{concept?.accuracy ?? 0}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {data.strengths.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold text-emerald-400 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                            <Target className="w-3.5 h-3.5" />Strengths
                        </h3>
                        <div className="space-y-2">
                            {data.strengths.map((area) => {
                                const concept = data.concepts.find((c) => c.concept === area);
                                return (
                                    <div key={area} className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3">
                                        <span className="text-sm text-gray-200">{area}</span>
                                        <span className="text-xs font-medium text-emerald-400">{concept?.accuracy ?? 0}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">All Concepts</h3>
                    <div className="space-y-2">
                        {data.concepts.map((c) => (
                            <div key={c.concept} className="bg-gray-900/60 border border-gray-800/40 rounded-xl px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-200">{c.concept}</span>
                                    <span className="text-xs text-gray-500">{c.attempts} Qs</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                c.accuracy >= 80 ? "bg-emerald-500" : c.accuracy >= 50 ? "bg-amber-500" : "bg-red-500",
                                            )}
                                            style={{ width: `${c.accuracy}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 w-10 text-right">{c.accuracy}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Lightbulb, Target, Filter } from "lucide-react";

interface Misconception {
    id: string;
    student_name: string;
    misconception_type: string;
    category: string;
    severity: string;
    description: string;
    root_cause?: string;
    suggested_remediation?: string;
    is_resolved: boolean;
    created_at: string;
}

interface MisconceptionTrackerProps {
    misconceptions: Misconception[];
    onResolve?: (misconceptionId: string) => Promise<void>;
    showFilters?: boolean;
}

const SEVERITY_CONFIG = {
    minor: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Minor" },
    moderate: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", label: "Moderate" },
    severe: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Severe" },
};

const CATEGORY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string }> = {
    conceptual: { icon: Target, color: "text-purple-400" },
    procedural: { icon: AlertTriangle, color: "text-blue-400" },
    careless: { icon: AlertTriangle, color: "text-yellow-400" },
    incomplete: { icon: AlertTriangle, color: "text-orange-400" },
    overconfident: { icon: AlertTriangle, color: "text-red-400" },
    unknown: { icon: AlertTriangle, color: "text-gray-400" },
};

export function MisconceptionCard({
    misconception,
    onResolve,
}: {
    misconception: Misconception;
    onResolve?: (id: string) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [isResolving, setIsResolving] = useState(false);

    const severityConfig = SEVERITY_CONFIG[misconception.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.moderate;
    const categoryConfig = CATEGORY_CONFIG[misconception.category] || CATEGORY_CONFIG.unknown!;
    const CategoryIcon = categoryConfig.icon;

    const handleResolve = async () => {
        if (!onResolve) return;
        setIsResolving(true);
        try {
            await onResolve(misconception.id);
        } catch (err) {
            console.error("Error resolving misconception:", err);
        }
        setIsResolving(false);
    };

    if (misconception.is_resolved) {
        return (
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-400" />
                <div className="flex-1">
                    <span className="text-gray-400 line-through">{misconception.misconception_type}</span>
                    <span className="ml-2 text-emerald-400 text-sm">Resolved</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-xl border ${severityConfig.border} ${severityConfig.bg} overflow-hidden`}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-black/10"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gray-800 ${categoryConfig.color}`}>
                        <CategoryIcon className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white capitalize">
                                {misconception.misconception_type.replace(/_/g, " ")}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${severityConfig.color} ${severityConfig.bg}`}>
                                {severityConfig.label}
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 capitalize">{misconception.category} error</p>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-white p-1">
                    {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
            </div>

            {/* Content */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Description */}
                    <div className="p-3 rounded-lg bg-gray-800">
                        <p className="text-gray-300 text-sm">{misconception.description}</p>
                    </div>

                    {/* Root Cause */}
                    {misconception.root_cause && (
                        <div className="p-3 rounded-lg bg-gray-800">
                            <p className="text-xs text-gray-500 mb-1">Root Cause</p>
                            <p className="text-gray-300 text-sm">{misconception.root_cause}</p>
                        </div>
                    )}

                    {/* Remediation */}
                    {misconception.suggested_remediation && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-2 mb-1 text-emerald-400">
                                <Lightbulb className="h-4 w-4" />
                                <span className="text-xs font-medium">How to Improve</span>
                            </div>
                            <p className="text-gray-300 text-sm">{misconception.suggested_remediation}</p>
                        </div>
                    )}

                    {/* Actions */}
                    {onResolve && (
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handleResolve}
                                disabled={isResolving}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                            >
                                <Check className="h-4 w-4" />
                                {isResolving ? "Marking..." : "Mark as Resolved"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function MisconceptionTracker({ misconceptions, onResolve, showFilters = true }: MisconceptionTrackerProps) {
    const [filter, setFilter] = useState<"all" | "severe" | "moderate" | "minor">("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    const categories = Array.from(new Set(misconceptions.map(m => m.category)));

    const filteredMisconceptions = misconceptions.filter(m => {
        if (filter !== "all" && m.severity !== filter) return false;
        if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
        return true;
    });

    const activeCount = misconceptions.filter(m => !m.is_resolved).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                    <h2 className="text-lg font-semibold text-white">Misconceptions</h2>
                    {activeCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-sm">
                            {activeCount} active
                        </span>
                    )}
                </div>
            </div>

            {/* Filters */}
            {showFilters && misconceptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Filter className="h-4 w-4" />
                        Severity:
                    </div>
                    {["all", "severe", "moderate", "minor"].map((sev) => (
                        <button
                            key={sev}
                            onClick={() => setFilter(sev as typeof filter)}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                filter === sev
                                    ? "bg-sky-500 text-white"
                                    : "bg-gray-800 text-gray-400 hover:text-white"
                            }`}
                        >
                            {sev.charAt(0).toUpperCase() + sev.slice(1)}
                        </button>
                    ))}

                    {categories.length > 1 && (
                        <>
                            <div className="w-px h-6 bg-gray-700 mx-2" />
                            <div className="flex items-center gap-1 text-sm text-gray-400">Category:</div>
                            <button
                                onClick={() => setCategoryFilter("all")}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    categoryFilter === "all"
                                        ? "bg-sky-500 text-white"
                                        : "bg-gray-800 text-gray-400 hover:text-white"
                                }`}
                            >
                                All
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`px-3 py-1 rounded-full text-sm capitalize transition-colors ${
                                        categoryFilter === cat
                                            ? "bg-sky-500 text-white"
                                            : "bg-gray-800 text-gray-400 hover:text-white"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* List */}
            {filteredMisconceptions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    {misconceptions.length === 0 ? (
                        <>
                            <Check className="h-12 w-12 mx-auto mb-3 text-emerald-400 opacity-50" />
                            <p>No misconceptions detected!</p>
                            <p className="text-sm">Keep up the great work.</p>
                        </>
                    ) : (
                        <>
                            <Filter className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No misconceptions match the current filter.</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredMisconceptions.map((misconception) => (
                        <MisconceptionCard
                            key={misconception.id}
                            misconception={misconception}
                            onResolve={onResolve}
                        />
                    ))}
                </div>
            )}

            {/* Summary */}
            {misconceptions.length > 0 && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-red-400">
                            {misconceptions.filter(m => m.severity === "severe" && !m.is_resolved).length}
                        </p>
                        <p className="text-xs text-gray-500">Severe</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-orange-400">
                            {misconceptions.filter(m => m.severity === "moderate" && !m.is_resolved).length}
                        </p>
                        <p className="text-xs text-gray-500">Moderate</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-400">
                            {misconceptions.filter(m => m.severity === "minor" && !m.is_resolved).length}
                        </p>
                        <p className="text-xs text-gray-500">Minor</p>
                    </div>
                </div>
            )}
        </div>
    );
}

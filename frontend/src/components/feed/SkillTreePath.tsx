"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    FileUp,
    Loader2,
    Users,
    Check,
    Sparkles,
    Circle,
} from "lucide-react";
import { ResourceChip } from "~/components/feed/ResourceChip";
import { cn } from "~/lib/utils";
import type { SyllabusTopic, SyllabusTree } from "~/stores/scrollSessionStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NodeState = "ready" | "in_progress" | "mastered" | "recommended";

export interface SkillTreePathProps {
    syllabus: SyllabusTree;
    mastery: Record<string, number>;
    presence: Record<string, number>;
    recommendedNext: string | null;
    totalPresence: number;
    resourceCount: number;
    isUploading: boolean;
    onNodeTap: (topic: SyllabusTopic) => void;
    onBack: () => void;
    onUploadResource: (files: FileList) => void;
    onManageResources: () => void;
    topicResources?: Record<string, Array<{ title: string; url: string; source_type: string; thumbnail_url?: string }>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeState(
    topic: SyllabusTopic,
    mastery: Record<string, number>,
    recommendedNext: string | null,
): NodeState {
    const m = mastery[topic.id] ?? 0;
    if (topic.id === recommendedNext) return "recommended";
    if (m >= 80) return "mastered";
    if (m > 0) return "in_progress";
    return "ready";
}

// ---------------------------------------------------------------------------
// Status icon per node state
// ---------------------------------------------------------------------------

function StatusIcon({ state }: { state: NodeState }) {
    switch (state) {
        case "mastered":
            return (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15">
                    <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />
                </div>
            );
        case "recommended":
            return (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/15">
                    <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                </div>
            );
        case "in_progress":
            return (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/10">
                    <Circle className="w-3.5 h-3.5 text-violet-400" strokeWidth={2.5} />
                </div>
            );
        default: // ready
            return (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20">
                    <Circle className="w-3 h-3 text-violet-500" strokeWidth={2} />
                </div>
            );
    }
}

// ---------------------------------------------------------------------------
// Mastery bar colors
// ---------------------------------------------------------------------------

function masteryBarColor(state: NodeState, m: number): string {
    if (state === "mastered") return "bg-emerald-400";
    if (state === "recommended") return "bg-violet-400";
    if (m > 0) return "bg-violet-500";
    return "bg-gray-700";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillTreePath({
    syllabus,
    mastery,
    presence,
    recommendedNext,
    totalPresence,
    resourceCount,
    isUploading,
    onNodeTap,
    onBack,
    onUploadResource,
    onManageResources,
    topicResources,
}: SkillTreePathProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // All units expanded by default
    const [expandedUnits, setExpandedUnits] = useState<Set<number>>(() =>
        new Set(syllabus.units.map((_, i) => i)),
    );

    const sortedUnits = useMemo(
        () => [...syllabus.units].sort((a, b) => a.order - b.order),
        [syllabus],
    );

    const allTopics = useMemo(
        () => syllabus.units.flatMap((u) => u.topics),
        [syllabus],
    );
    const totalMastery =
        allTopics.length > 0
            ? Math.round(
                  allTopics.reduce((sum, t) => sum + (mastery[t.id] ?? 0), 0) /
                      allTopics.length,
              )
            : 0;
    const masteredCount = allTopics.filter(
        (t) => (mastery[t.id] ?? 0) >= 80,
    ).length;

    const toggleUnit = (idx: number) => {
        setExpandedUnits((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    // Scroll to recommended topic on mount
    useEffect(() => {
        if (!recommendedNext || !scrollRef.current) return;
        const timeout = setTimeout(() => {
            const el = scrollRef.current?.querySelector(
                `[data-topic-id="${recommendedNext}"]`,
            );
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
        return () => clearTimeout(timeout);
    }, [recommendedNext]);

    return (
        <div
            className="h-full flex flex-col overflow-hidden relative"
            style={{
                background:
                    "linear-gradient(180deg, #08070f 0%, #0d0b1a 30%, #0a0918 60%, #060510 100%)",
            }}
        >
            {/* Atmospheric dot grid overlay */}
            <div
                className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                }}
            />

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        onUploadResource(e.target.files);
                        e.target.value = "";
                    }
                }}
            />

            {/* Header */}
            <div className="relative z-20 flex items-center justify-between px-5 py-4 shrink-0">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="text-[15px] font-semibold tracking-tight">
                        {syllabus.subject}
                    </span>
                </button>
                <div className="flex items-center gap-3">
                    {totalPresence > 0 && (
                        <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <Users className="w-3 h-3" />
                            {totalPresence}
                        </div>
                    )}
                    {resourceCount > 0 && (
                        <button
                            onClick={onManageResources}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/15 transition-colors"
                        >
                            {resourceCount} {resourceCount === 1 ? "doc" : "docs"}
                        </button>
                    )}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={cn(
                            "p-2 rounded-xl transition-colors",
                            isUploading
                                ? "text-violet-400 animate-pulse"
                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5",
                        )}
                        title="Upload study materials"
                    >
                        {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <FileUp className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>

            {/* Progress section */}
            <div className="relative z-10 px-5 pb-4 shrink-0">
                <div className="flex items-end justify-between mb-2.5">
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold mb-1">
                            Progress
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-white tabular-nums">
                                {totalMastery}
                            </span>
                            <span className="text-[11px] text-gray-500 font-bold">%</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[11px] text-gray-500 font-semibold">
                            {masteredCount}/{allTopics.length} mastered
                        </span>
                    </div>
                </div>
                {/* Progress bar */}
                <div
                    className="h-2 rounded-full overflow-hidden relative"
                    style={{
                        background: "rgba(255,255,255,0.04)",
                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
                    }}
                >
                    <div
                        className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                        style={{
                            width: `${Math.max(totalMastery, 2)}%`,
                            background:
                                totalMastery >= 80
                                    ? "linear-gradient(90deg, #059669, #34d399)"
                                    : "linear-gradient(90deg, #6d28d9, #8b5cf6, #a78bfa)",
                        }}
                    >
                        <div
                            className="absolute inset-0 animate-[shine_3s_ease-in-out_infinite]"
                            style={{
                                background:
                                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                                backgroundSize: "200% 100%",
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div
                className="h-px mx-5 shrink-0"
                style={{
                    background:
                        "linear-gradient(90deg, transparent, rgba(139,92,246,0.15), transparent)",
                }}
            />

            {/* Scrollable tree list */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto scroll-smooth relative z-10 px-4 py-3"
            >
                <div className="space-y-2">
                    {sortedUnits.map((unit, unitIdx) => {
                        const isExpanded = expandedUnits.has(unitIdx);
                        const unitMastered = unit.topics.filter(
                            (t) => (mastery[t.id] ?? 0) >= 80,
                        ).length;
                        const sortedTopics = [...unit.topics].sort(
                            (a, b) => a.order - b.order,
                        );

                        return (
                            <div key={unit.id} className="rounded-2xl overflow-hidden" style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.04)",
                            }}>
                                {/* Unit header */}
                                <button
                                    onClick={() => toggleUnit(unitIdx)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                                >
                                    <span className="text-lg shrink-0">{unit.icon}</span>
                                    <span className="text-[13px] font-bold text-gray-300 tracking-tight flex-1 text-left">
                                        {unit.name}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-600 tabular-nums shrink-0 mr-1">
                                        {unitMastered}/{unit.topics.length}
                                    </span>
                                    {isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                                    ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                                    )}
                                </button>

                                {/* Topics list */}
                                {isExpanded && (
                                    <div className="px-2 pb-2">
                                        {sortedTopics.map((topic) => {
                                            const state = getNodeState(
                                                topic,
                                                mastery,
                                                recommendedNext,
                                            );
                                            const m = mastery[topic.id] ?? 0;
                                            const peers = presence[topic.id] ?? 0;

                                            return (
                                                <button
                                                    key={topic.id}
                                                    data-topic-id={topic.id}
                                                    onClick={() => onNodeTap(topic)}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                                                        "hover:bg-white/[0.03] active:scale-[0.98] cursor-pointer",
                                                        state === "recommended" &&
                                                            "bg-violet-500/[0.06] border border-violet-500/15",
                                                    )}
                                                >
                                                    {/* Status icon */}
                                                    <StatusIcon state={state} />

                                                    {/* Topic info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={cn(
                                                                    "text-[12px] font-semibold truncate",
                                                                    state === "mastered"
                                                                        ? "text-emerald-300/80"
                                                                        : state === "recommended"
                                                                          ? "text-violet-200"
                                                                          : "text-gray-300",
                                                                )}
                                                            >
                                                                {topic.name}
                                                            </span>
                                                            {peers > 0 && (
                                                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded-full shrink-0">
                                                                    <Users className="w-2.5 h-2.5" />
                                                                    {peers}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Mastery bar + concept count */}
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all duration-700",
                                                                        masteryBarColor(state, m),
                                                                    )}
                                                                    style={{
                                                                        width: `${Math.max(m, 0)}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            {m > 0 && (
                                                                <span className={cn(
                                                                    "text-[10px] font-bold tabular-nums shrink-0",
                                                                    m >= 80 ? "text-emerald-400" : "text-violet-400",
                                                                )}>
                                                                    {m}%
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-gray-600 font-medium tabular-nums shrink-0">
                                                                {topic.concepts.length} concept{topic.concepts.length !== 1 ? "s" : ""}
                                                            </span>
                                                        </div>

                                                        {/* Curated resource chips */}
                                                        {topicResources?.[topic.id] && topicResources[topic.id]!.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                                                                {topicResources[topic.id]!.map((r, idx) => (
                                                                    <ResourceChip
                                                                        key={idx}
                                                                        title={r.title}
                                                                        url={r.url}
                                                                        sourceType={r.source_type}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Bottom spacer */}
                <div className="h-20" />
            </div>

            {/* Global animations */}
            <style jsx global>{`
                @keyframes shine {
                    0% {
                        background-position: -200% 0;
                    }
                    100% {
                        background-position: 200% 0;
                    }
                }
            `}</style>
        </div>
    );
}

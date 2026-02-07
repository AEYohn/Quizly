"use client";

import { useMemo, useRef, useId, useState, useEffect } from "react";
import { ArrowLeft, BarChart3, Star, Sparkles, Upload, FileUp, RefreshCw, Trash2, FileText, Loader2, Check, Users, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { BottomSheet } from "~/components/feed/BottomSheet";
import { ResourceChip } from "~/components/feed/ResourceChip";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";
import type { SkillTreeProps } from "~/variants/contracts";
import type { SyllabusTopic } from "~/stores/scrollSessionStore";

// ============================================
// Star particle background
// ============================================

function CosmicStarField() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
                className="absolute inset-0"
                style={{
                    background: `
                        radial-gradient(2px 2px at 5% 10%, rgba(255,255,255,0.7) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 12% 45%, rgba(255,255,255,0.5) 50%, transparent 100%),
                        radial-gradient(2.5px 2.5px at 22% 22%, rgba(165,180,252,0.8) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 30% 70%, rgba(255,255,255,0.5) 50%, transparent 100%),
                        radial-gradient(2px 2px at 42% 15%, rgba(255,255,255,0.6) 50%, transparent 100%),
                        radial-gradient(2.5px 2.5px at 55% 50%, rgba(110,231,183,0.6) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 62% 80%, rgba(255,255,255,0.4) 50%, transparent 100%),
                        radial-gradient(2px 2px at 75% 25%, rgba(255,255,255,0.7) 50%, transparent 100%),
                        radial-gradient(2.5px 2.5px at 82% 60%, rgba(165,180,252,0.6) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 90% 40%, rgba(255,255,255,0.5) 50%, transparent 100%),
                        radial-gradient(2px 2px at 95% 85%, rgba(251,191,36,0.5) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 18% 88%, rgba(255,255,255,0.4) 50%, transparent 100%),
                        radial-gradient(2px 2px at 48% 92%, rgba(165,180,252,0.4) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 68% 5%, rgba(255,255,255,0.5) 50%, transparent 100%)
                    `,
                }}
            />
        </div>
    );
}

// ============================================
// Node types & helpers
// ============================================

interface NodePosition {
    x: number;
    y: number;
    xPercent: number;
    topic: SyllabusTopic;
    status: "mastered" | "in_progress" | "recommended";
    masteryValue: number;
}

function getNodeStatus(
    topic: SyllabusTopic,
    mastery: Record<string, number>,
    recommendedNext: string | null,
    completedIds: Set<string>,
): "mastered" | "in_progress" | "recommended" {
    if (topic.id === recommendedNext) return "recommended";
    const m = mastery[topic.id] ?? 0;
    if (m >= 80) return "mastered";
    return "in_progress";
}

// Color palette per state — ported from TreeNode.tsx with cosmic enhancements
const PALETTE = {
    mastered: {
        ring: "#34d399",
        glow: "rgba(52,211,153,0.5)",
        fill1: "#064e3b",
        fill2: "#022c22",
        labelColor: "text-emerald-300",
        masteryColor: "text-emerald-400/80",
    },
    in_progress: {
        ring: "#818cf8",
        glow: "rgba(129,140,248,0.4)",
        fill1: "#2e1065",
        fill2: "#0f0a2e",
        labelColor: "text-indigo-200",
        masteryColor: "text-indigo-300/80",
    },
    recommended: {
        ring: "#c4b5fd",
        glow: "rgba(196,181,253,0.6)",
        fill1: "#3b1d8e",
        fill2: "#1e1b4b",
        labelColor: "text-violet-200",
        masteryColor: "text-violet-300/80",
    },
} as const;

// ============================================
// Individual HTML node component
// ============================================

const NODE_SIZE = 80;
const RING_STROKE = 4;

function CosmicNode({
    node,
    index,
    presence,
    resources,
    onTap,
}: {
    node: NodePosition;
    index: number;
    presence: number;
    resources: Array<{ title: string; url: string; source_type: string; thumbnail_url?: string }>;
    onTap: () => void;
}) {
    const uid = useId();
    const p = PALETTE[node.status];
    const tappable = true;

    const svgSize = NODE_SIZE + 24;
    const center = svgSize / 2;
    const ringR = NODE_SIZE / 2 - 3;
    const circumference = 2 * Math.PI * ringR;
    const masteryFraction = Math.max(0, Math.min(100, node.masteryValue)) / 100;
    const dashOffset = circumference * (1 - masteryFraction);

    const gradId = `cg-${uid}`;
    const shadowId = `cs-${uid}`;
    const glowId = `cgl-${uid}`;

    return (
        <div
            className={cn(
                "absolute flex flex-col items-center",
                "cursor-pointer",
            )}
            style={{
                left: `${node.xPercent * 100}%`,
                top: node.y,
                transform: "translateX(-50%)",
            }}
            onClick={() => onTap()}
            role="button"
            tabIndex={0}
        >
            {/* Peer badge */}
            {presence > 0 && (
                <div
                    className="absolute z-30 flex items-center gap-0.5 rounded-full text-[9px] font-black text-white shadow-xl"
                    style={{
                        top: 0,
                        right: center - 50,
                        padding: "2px 7px",
                        background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                        boxShadow: "0 2px 12px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                >
                    <Users className="w-2.5 h-2.5" />
                    {presence}
                </div>
            )}

            {/* Main node with SVG rings + gradients */}
            <div
                className={cn(
                    "relative transition-transform duration-200 ease-out",
                    "hover:scale-[1.12] active:scale-[0.92]",
                    node.status === "recommended" && "animate-[float_4s_ease-in-out_infinite]",
                )}
            >
                <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                    <defs>
                        <radialGradient id={gradId} cx="38%" cy="32%" r="60%">
                            <stop offset="0%" stopColor={p.fill1} />
                            <stop offset="100%" stopColor={p.fill2} />
                        </radialGradient>
                        <filter id={shadowId} x="-30%" y="-20%" width="160%" height="160%">
                            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.6" />
                        </filter>
                        {node.status === "recommended" && (
                            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                                <feFlood floodColor="#c4b5fd" floodOpacity="0.3" result="color" />
                                <feComposite in="color" in2="blur" operator="in" result="glow" />
                                <feMerge>
                                    <feMergeNode in="glow" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        )}
                    </defs>

                    {/* Recommended outer pulse */}
                    {node.status === "recommended" && (
                        <>
                            <circle
                                cx={center} cy={center} r={ringR + 10}
                                fill="none" stroke="rgba(196,181,253,0.15)" strokeWidth="2"
                                className="animate-ping"
                                style={{ animationDuration: "3s", transformOrigin: "center" }}
                            />
                            <circle
                                cx={center} cy={center} r={ringR + 6}
                                fill="none" stroke="rgba(196,181,253,0.2)" strokeWidth="1.5"
                            />
                        </>
                    )}

                    {/* Mastered outer glow ring */}
                    {node.status === "mastered" && (
                        <circle
                            cx={center} cy={center} r={ringR + 8}
                            fill="none" stroke="rgba(52,211,153,0.15)" strokeWidth="3"
                        />
                    )}

                    {/* Main circle body with gradient fill */}
                    <circle
                        cx={center} cy={center} r={NODE_SIZE / 2}
                        fill={`url(#${gradId})`}
                        filter={`url(#${shadowId})`}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                    />

                    {/* Inner light highlight for depth */}
                    <circle
                        cx={center - NODE_SIZE * 0.12} cy={center - NODE_SIZE * 0.15}
                        r={NODE_SIZE * 0.25}
                        fill="rgba(255,255,255,0.04)"
                    />

                    {/* Track ring (background) */}
                    <circle
                        cx={center} cy={center} r={ringR}
                        fill="none"
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth={RING_STROKE}
                    />

                    {/* Mastery arc */}
                    {masteryFraction > 0 && (
                        <circle
                            cx={center} cy={center} r={ringR}
                            fill="none"
                            stroke={p.ring}
                            strokeWidth={RING_STROKE}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${center} ${center})`}
                            className="transition-all duration-700 ease-out"
                            style={{ filter: `drop-shadow(0 0 6px ${p.glow})` }}
                        />
                    )}

                    {/* Recommended: faint full ring when no mastery */}
                    {node.status === "recommended" && masteryFraction === 0 && (
                        <circle
                            cx={center} cy={center} r={ringR}
                            fill="none"
                            stroke="rgba(196,181,253,0.3)"
                            strokeWidth={RING_STROKE}
                        />
                    )}
                </svg>

                {/* Center icon / content — HTML overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {node.status === "mastered" ? (
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-400/15 backdrop-blur-sm">
                            <Star className="w-6 h-6 text-emerald-400" fill="currentColor" strokeWidth={1.5} />
                        </div>
                    ) : node.status === "recommended" ? (
                        <div className="relative">
                            <Sparkles
                                className="w-8 h-8 text-violet-200"
                                style={{ filter: "drop-shadow(0 0 10px rgba(196,181,253,0.7))" }}
                            />
                        </div>
                    ) : node.masteryValue > 0 ? (
                        <span className="text-[18px] font-black tabular-nums text-white/85 drop-shadow-sm">
                            {node.masteryValue}
                        </span>
                    ) : (
                        <span className="text-[22px] font-black text-indigo-300/60">
                            {index + 1}
                        </span>
                    )}
                </div>
            </div>

            {/* HTML label — crisp rendering */}
            <span
                className={cn(
                    "mt-2.5 text-sm font-semibold text-center leading-tight max-w-[120px] line-clamp-2 tracking-wide",
                    p.labelColor,
                )}
            >
                {node.topic.name}
            </span>

            {/* Mastery percentage below label */}
            {node.masteryValue > 0 && (
                <span className={cn("text-xs font-medium mt-0.5", p.masteryColor)}>
                    {node.masteryValue}%
                </span>
            )}

            {/* Curated resource chips */}
            {resources.length > 0 && (
                <div
                    className="flex flex-col items-center gap-1 mt-1.5 max-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {resources.slice(0, 2).map((r, idx) => (
                        <ResourceChip key={idx} title={r.title} url={r.url} sourceType={r.source_type} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// Main SkillTree component
// ============================================

export function SkillTree({
    syllabus,
    mastery,
    presence,
    recommendedNext,
    totalPresence,
    resourceCount,
    isUploading,
    isLoading,
    loadingMessage,
    error,
    showRegenBanner,
    isRegenerating,
    subjectResources,
    showResourceSheet,
    onNodeTap,
    onBack,
    onUploadResource,
    onManageResources,
    onDeleteResource,
    onRegenerateSyllabus,
    onDismissRegenBanner,
    onCloseResourceSheet,
    topicResources,
    onOpenAnalysis,
}: SkillTreeProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hintDismissed, setHintDismissed] = useState(false);
    const store = useScrollSessionStore();

    // Auto-dismiss error after 5 seconds
    useEffect(() => {
        if (!error) return;
        const timer = setTimeout(() => store.setError(null), 5000);
        return () => clearTimeout(timer);
    }, [error, store]);

    const allTopics = useMemo(() => {
        const topics: SyllabusTopic[] = [];
        for (const unit of syllabus.units) {
            for (const topic of unit.topics) {
                topics.push(topic);
            }
        }
        return topics;
    }, [syllabus]);

    const completedIds = useMemo(() => {
        const set = new Set<string>();
        for (const [id, m] of Object.entries(mastery)) {
            if (m >= 80) set.add(id);
        }
        return set;
    }, [mastery]);

    // Layout constants — bigger, more spacious
    const NODE_SPACING_Y = 180;
    const AMPLITUDE = 0.22; // as fraction of container width
    const SVG_INTERNAL_WIDTH = 400;

    const nodePositions: NodePosition[] = useMemo(() => {
        return allTopics.map((topic, i) => {
            const y = 80 + i * NODE_SPACING_Y;
            const xPercent = 0.5 + AMPLITUDE * Math.sin((i * Math.PI) / 2.2);
            const x = xPercent * SVG_INTERNAL_WIDTH;
            const status = getNodeStatus(topic, mastery, recommendedNext, completedIds);
            const masteryValue = mastery[topic.id] ?? 0;
            return { x, y, xPercent, topic, status, masteryValue };
        });
    }, [allTopics, mastery, recommendedNext, completedIds]);

    // Total height of the scrollable area — enough room for last node + label
    const totalHeight = nodePositions.length > 0
        ? nodePositions[nodePositions.length - 1]!.y + 220
        : 400;

    // SVG path for connecting curve (uses SVG coordinate space, then scaled via viewBox)
    const pathD = useMemo(() => {
        if (nodePositions.length < 2) return "";
        let d = `M ${nodePositions[0]!.x} ${nodePositions[0]!.y}`;
        for (let i = 1; i < nodePositions.length; i++) {
            const prev = nodePositions[i - 1]!;
            const curr = nodePositions[i]!;
            const cpY = (prev.y + curr.y) / 2;
            d += ` C ${prev.x} ${cpY}, ${curr.x} ${cpY}, ${curr.x} ${curr.y}`;
        }
        return d;
    }, [nodePositions]);

    const masteredCount = Object.values(mastery).filter((m) => m >= 80).length;

    if (isLoading) {
        return (
            <div className="h-full bg-[#050510] flex items-center justify-center relative">
                <CosmicStarField />
                <div className="relative z-10 text-center space-y-4">
                    <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />
                        <div className="relative w-20 h-20 flex items-center justify-center">
                            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                        </div>
                    </div>
                    <p className="text-base text-indigo-200">{loadingMessage || "Mapping star systems..."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-[#050510] via-[#0a0820] to-[#050515] relative">
            <CosmicStarField />

            {/* Header */}
            <div className="relative z-10 shrink-0 px-5 pt-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-xl hover:bg-white/10 text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        {resourceCount > 0 && (
                            <button
                                onClick={onManageResources}
                                className="p-2 rounded-xl hover:bg-white/10 text-indigo-200 transition-colors relative"
                            >
                                <FileText className="w-5 h-5" />
                                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {resourceCount}
                                </span>
                            </button>
                        )}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors border",
                                isUploading
                                    ? "text-violet-400 border-violet-500/20 bg-violet-500/10 animate-pulse"
                                    : "text-violet-200 border-violet-400/20 bg-violet-500/10 hover:bg-violet-500/20",
                            )}
                        >
                            {isUploading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <FileUp className="w-3.5 h-3.5" />
                            )}
                            Add Materials
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.txt,.md,.doc,.docx"
                            multiple
                            onChange={(e) => e.target.files && onUploadResource(e.target.files)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-300" />
                        {syllabus.subject}
                    </h1>
                    <p className="text-base text-indigo-100">
                        Sectors Explored: <span className="text-white font-semibold">{masteredCount}/{allTopics.length}</span>
                        {totalPresence > 0 && (
                            <span className="ml-2">&middot; {totalPresence} active explorers</span>
                        )}
                    </p>
                </div>

                {error && (
                    <div
                        onClick={() => store.setError(null)}
                        className="mt-3 rounded-xl bg-red-500/20 border border-red-400/40 px-4 py-2.5 text-sm text-red-200 font-medium cursor-pointer active:opacity-70 transition-opacity"
                    >
                        {error}
                    </div>
                )}
            </div>

            {/* Hint banner when no resources uploaded */}
            {resourceCount === 0 && !hintDismissed && (
                <div className="relative z-10 mx-5 mb-3">
                    <div className="rounded-xl bg-violet-500/8 border border-violet-500/15 px-4 py-3 flex items-start gap-3">
                        <Sparkles className="w-4 h-4 text-violet-300 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-indigo-100/80 leading-relaxed">
                                Upload your syllabus or notes to get questions tailored to your course
                            </p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <FileUp className="w-3.5 h-3.5" />
                                Upload Materials
                            </button>
                        </div>
                        <button
                            onClick={() => setHintDismissed(true)}
                            className="p-1 rounded-md hover:bg-white/5 text-gray-600 transition-colors shrink-0"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}

            {/* Regen banner */}
            {showRegenBanner && (
                <div className="relative z-10 mx-5 mb-3 rounded-xl bg-indigo-500/15 border border-indigo-400/30 px-4 py-3 flex items-center justify-between">
                    <div className="text-sm text-indigo-100">
                        New resources detected. Regenerate star map?
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={onDismissRegenBanner}
                            className="text-sm text-indigo-300 hover:text-white transition-colors"
                        >
                            Dismiss
                        </button>
                        <button
                            onClick={onRegenerateSyllabus}
                            disabled={isRegenerating}
                            className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", isRegenerating && "animate-spin")} />
                            Regen
                        </button>
                    </div>
                </div>
            )}

            {/* Scrollable hybrid SVG path + HTML nodes */}
            <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
                <div className="relative w-full" style={{ height: totalHeight }}>
                    {/* SVG layer — path only */}
                    <svg
                        className="absolute inset-0 w-full pointer-events-none"
                        style={{ height: totalHeight }}
                        viewBox={`0 0 ${SVG_INTERNAL_WIDTH} ${totalHeight}`}
                        preserveAspectRatio="none"
                    >
                        <defs>
                            <linearGradient id="cosmic-path-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.9" />
                                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.6" />
                                <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.9" />
                            </linearGradient>
                            <filter id="cosmic-path-glow" x="-30%" y="-5%" width="160%" height="110%">
                                <feGaussianBlur stdDeviation="8" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>

                        {/* Glow layer — thick blurred path */}
                        {pathD && (
                            <path
                                d={pathD}
                                fill="none"
                                stroke="url(#cosmic-path-gradient)"
                                strokeWidth="8"
                                strokeLinecap="round"
                                filter="url(#cosmic-path-glow)"
                                opacity="0.7"
                            />
                        )}

                        {/* Main solid path */}
                        {pathD && (
                            <path
                                d={pathD}
                                fill="none"
                                stroke="url(#cosmic-path-gradient)"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                        )}
                    </svg>

                    {/* HTML node layer — positioned absolutely along the curve */}
                    {nodePositions.map((node, i) => (
                        <CosmicNode
                            key={node.topic.id}
                            node={node}
                            index={i}
                            presence={presence[node.topic.id] ?? 0}
                            resources={topicResources?.[node.topic.id] ?? []}
                            onTap={() => onNodeTap(node.topic)}
                        />
                    ))}
                </div>
            </div>

            {/* Floating analysis button */}
            {onOpenAnalysis && (
                <button
                    onClick={onOpenAnalysis}
                    className={cn(
                        "absolute bottom-6 right-4 z-30",
                        "flex items-center gap-2 px-4 py-2.5 rounded-full",
                        "bg-gradient-to-r from-indigo-600 to-violet-600",
                        "text-white text-sm font-bold shadow-xl",
                        "hover:from-indigo-500 hover:to-violet-500 transition-all",
                        "border border-indigo-400/30",
                    )}
                    style={{ boxShadow: "0 4px 24px rgba(99,102,241,0.4)" }}
                >
                    <BarChart3 className="w-4 h-4" />
                    Analysis
                </button>
            )}

            {/* Resource management bottom sheet */}
            <BottomSheet
                open={showResourceSheet}
                onClose={onCloseResourceSheet}
                title="Star Chart Resources"
            >
                <div className="space-y-3">
                    {subjectResources.length === 0 ? (
                        <p className="text-sm text-indigo-200/60 text-center py-4">
                            No resources uploaded yet. Upload study materials to enhance your star chart.
                        </p>
                    ) : (
                        subjectResources.map((resource) => (
                            <div
                                key={resource.id}
                                className="flex items-center justify-between bg-[#0f0d2e] border border-indigo-400/20 rounded-xl px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <div className="text-sm text-white truncate">{resource.file_name}</div>
                                    <div className="text-xs text-indigo-200/50 mt-0.5">
                                        {resource.file_type} &middot; {resource.concepts_count} concepts
                                    </div>
                                </div>
                                <button
                                    onClick={() => onDeleteResource(resource.id)}
                                    className="p-2 rounded-lg hover:bg-red-500/15 text-gray-400 hover:text-red-400 transition-colors shrink-0 ml-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </BottomSheet>

            {/* Float animation keyframes */}
            <style jsx global>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
            `}</style>
        </div>
    );
}

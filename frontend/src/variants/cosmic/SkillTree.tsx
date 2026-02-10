"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, BarChart3, Sparkles, FileUp, RefreshCw, Trash2, FileText, Loader2, Users, X, Play } from "lucide-react";
import { cn } from "~/lib/utils";
import { BottomSheet } from "~/components/feed/BottomSheet";
import { ResourceChip } from "~/components/feed/ResourceChip";
import { TopicStudyView } from "~/components/feed/TopicStudyView";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";
import type { SkillTreeProps } from "~/variants/contracts";
import type { SyllabusTopic } from "~/stores/scrollSessionStore";

// ============================================
// Mastery ring — SVG circle with stroke-dasharray
// ============================================

function MasteryRing({ mastery, size = 40 }: { mastery: number; size?: number }) {
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const fraction = Math.max(0, Math.min(100, mastery)) / 100;
    const dashOffset = circumference * (1 - fraction);

    const color =
        mastery >= 80 ? "#34d399" :   // emerald-400
        mastery >= 40 ? "#818cf8" :   // indigo-400
        mastery > 0   ? "rgba(129,140,248,0.3)" : // indigo-400/30
                        "rgba(129,140,248,0.15)";  // indigo-400/15

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Track */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke="rgba(129,140,248,0.1)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress arc */}
                {fraction > 0 && (
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        className="transition-all duration-700 ease-out"
                    />
                )}
                {/* Full ring for 0% — faint outline */}
                {fraction === 0 && (
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                    />
                )}
            </svg>
            {/* Center percentage */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn(
                    "text-[11px] font-bold tabular-nums",
                    mastery >= 80 ? "text-emerald-400" :
                    mastery > 0 ? "text-indigo-300" :
                    "text-indigo-400/30",
                )}>
                    {mastery > 0 ? `${mastery}` : ""}
                </span>
            </div>
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
    onStartLearning,
    onStudyNotes,
    onQuizOnly,
    onFlashcardsOnly,
    recentSessions,
    onBack,
    onUploadResource,
    onManageResources,
    onDeleteResource,
    onRegenerateSyllabus,
    onDismissRegenBanner,
    onCloseResourceSheet,
    topicResources,
    onOpenAnalysis,
    onGenerateFromResources,
    isGeneratingContent,
    generationProgress,
}: SkillTreeProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hintDismissed, setHintDismissed] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<SyllabusTopic | null>(null);
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

    const masteredCount = Object.values(mastery).filter((m) => m >= 80).length;

    if (isLoading) {
        return (
            <div className="h-full bg-[#050510] flex items-center justify-center">
                <div className="text-center space-y-4">
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
        <div className="h-full flex flex-col bg-[#050510] relative">
            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-3">
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
                <div className="mx-5 mb-3">
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
                <div className="mx-5 mb-3 rounded-xl bg-indigo-500/15 border border-indigo-400/30 px-4 py-3 flex items-center justify-between">
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

            {/* Scrollable list body */}
            <div className="flex-1 overflow-y-auto px-5 pb-20">
                {syllabus.units.map((unit) => (
                    <div key={unit.id} className="mb-6">
                        {/* Unit header */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">{unit.icon}</span>
                            <span className="text-base font-semibold text-indigo-100">{unit.name}</span>
                        </div>

                        {/* Topics list */}
                        <div className="ml-3 border-l-2 border-indigo-400/20 pl-4 space-y-2">
                            {unit.topics.map((topic) => {
                                const m = mastery[topic.id] ?? 0;
                                const p = presence[topic.id] ?? 0;
                                const isRecommended = recommendedNext === topic.id;
                                const resources = topicResources?.[topic.id] ?? [];

                                return (
                                    <button
                                        key={topic.id}
                                        onClick={() => setSelectedTopic(topic)}
                                        className={cn(
                                            "w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors",
                                            "bg-indigo-950/40 border",
                                            "hover:bg-indigo-950/60 hover:border-indigo-400/25",
                                            isRecommended
                                                ? "border-indigo-400/40"
                                                : "border-indigo-400/15",
                                        )}
                                    >
                                        <MasteryRing mastery={m} size={40} />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-medium text-white truncate">
                                                    {topic.name}
                                                </span>
                                                {isRecommended && (
                                                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
                                                        NEXT
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-indigo-300/50">
                                                    {topic.concepts.length} concepts &middot; ~{topic.estimated_minutes}m
                                                </span>
                                                {p > 0 && (
                                                    <span className="flex items-center gap-0.5 text-xs text-indigo-300/50">
                                                        <Users className="w-3 h-3" />
                                                        {p}
                                                    </span>
                                                )}
                                            </div>
                                            {resources.length > 0 && (
                                                <div
                                                    className="flex flex-wrap gap-1 mt-1.5"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {resources.slice(0, 2).map((r, idx) => (
                                                        <ResourceChip key={idx} title={r.title} url={r.url} sourceType={r.source_type} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <Play className="w-4 h-4 text-indigo-400/60 shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
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

                    {/* Generate content from resources */}
                    {subjectResources.length > 0 && onGenerateFromResources && (
                        <div className="pt-2 border-t border-indigo-400/10">
                            {generationProgress && generationProgress.step !== "complete" && generationProgress.step !== "error" ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-indigo-200/70">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                        {generationProgress.message}
                                    </div>
                                    <div className="h-1.5 bg-indigo-900/50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.round(generationProgress.progress * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ) : generationProgress?.step === "complete" ? (
                                <p className="text-xs text-emerald-400 text-center py-1">{generationProgress.message}</p>
                            ) : generationProgress?.step === "error" ? (
                                <p className="text-xs text-red-400 text-center py-1">{generationProgress.message}</p>
                            ) : (
                                <button
                                    onClick={onGenerateFromResources}
                                    disabled={isGeneratingContent}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Generate Notes, Cards &amp; Quiz
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </BottomSheet>

            {/* Full-screen topic study view */}
            {selectedTopic && (
                <TopicStudyView
                    topic={selectedTopic}
                    mastery={mastery[selectedTopic.id] ?? 0}
                    onClose={() => setSelectedTopic(null)}
                    onStudyNotes={onStudyNotes}
                    topicResources={topicResources?.[selectedTopic.id]}
                />
            )}
        </div>
    );
}

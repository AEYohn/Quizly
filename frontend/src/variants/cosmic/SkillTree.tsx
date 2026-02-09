"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { ArrowLeft, BarChart3, Sparkles, FileUp, RefreshCw, Trash2, FileText, Loader2, Users, X, Play, BookOpen, Zap, Layers, Clock, CheckCircle2 } from "lucide-react";
import { MathMarkdown } from "~/components/MathMarkdown";
import { cn } from "~/lib/utils";
import { BottomSheet } from "~/components/feed/BottomSheet";
import { ResourceChip } from "~/components/feed/ResourceChip";
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
}: SkillTreeProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hintDismissed, setHintDismissed] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<SyllabusTopic | null>(null);
    const [notesData, setNotesData] = useState<{ topic: string; total_notes: number; notes_by_concept: Record<string, Array<{ id: string; concept: string; title: string; body_markdown: string; key_takeaway: string }>> } | null>(null);
    const [notesLoading, setNotesLoading] = useState(false);
    const [showNotesSheet, setShowNotesSheet] = useState(false);
    const store = useScrollSessionStore();

    const topicSessions = useMemo(() => {
        if (!selectedTopic) return [];
        return recentSessions
            .filter((s) => s.topic.toLowerCase() === selectedTopic.name.toLowerCase() || s.topic.toLowerCase() === store.selectedSubject?.toLowerCase())
            .slice(0, 3);
    }, [selectedTopic, recentSessions, store.selectedSubject]);

    const handleFetchNotes = useCallback(async (topic: SyllabusTopic) => {
        setNotesLoading(true);
        setShowNotesSheet(true);
        setSelectedTopic(null);
        const res = await onStudyNotes(topic);
        if (res.success) {
            setNotesData(res.data);
            store.setTopicNotes(topic.id, res.data);
        }
        setNotesLoading(false);
    }, [onStudyNotes, store]);

    // Inline notes preview: auto-fetch when topic sheet opens
    const [inlineNotesLoading, setInlineNotesLoading] = useState(false);
    const [inlineNotesData, setInlineNotesData] = useState<typeof notesData>(null);

    useEffect(() => {
        if (!selectedTopic) { setInlineNotesData(null); return; }
        const cached = useScrollSessionStore.getState().topicNotesCache?.[selectedTopic.id];
        if (cached) { setInlineNotesData(cached); return; }
        let cancelled = false;
        setInlineNotesLoading(true);
        onStudyNotes(selectedTopic).then((res) => {
            if (cancelled) return;
            if (res.success) {
                setInlineNotesData(res.data);
                useScrollSessionStore.getState().setTopicNotes(selectedTopic.id, res.data);
            }
            setInlineNotesLoading(false);
        }).catch(() => { if (!cancelled) setInlineNotesLoading(false); });
        return () => { cancelled = true; };
    }, [selectedTopic, onStudyNotes]);

    const timeAgo = useCallback((iso: string | null) => {
        if (!iso) return "";
        const normalized = /[Z+\-]\d{0,2}:?\d{0,2}$/.test(iso) ? iso : iso + "Z";
        const diff = Date.now() - new Date(normalized).getTime();
        if (diff < 0 || diff < 60000) return "just now";
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return `${Math.floor(days / 7)}w ago`;
    }, []);

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
                </div>
            </BottomSheet>

            {/* Topic action sheet */}
            <BottomSheet
                open={!!selectedTopic}
                onClose={() => setSelectedTopic(null)}
                title={selectedTopic?.name}
            >
                {selectedTopic && (
                    <div className="space-y-5">
                        {/* Topic header with mastery ring */}
                        <div className="flex items-center gap-4">
                            <MasteryRing mastery={mastery[selectedTopic.id] ?? 0} size={56} />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-white truncate">{selectedTopic.name}</h3>
                                <p className="text-sm text-indigo-300/60 mt-0.5">
                                    {selectedTopic.concepts.length} concepts &middot; ~{selectedTopic.estimated_minutes}m
                                </p>
                            </div>
                        </div>

                        {/* Concept chips */}
                        <div className="overflow-x-auto -mx-5 px-5">
                            <div className="flex gap-2 pb-1">
                                {selectedTopic.concepts.map((concept) => (
                                    <span
                                        key={concept}
                                        className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-400/20 text-indigo-200"
                                    >
                                        {concept}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Inline notes preview */}
                        <div className="rounded-xl bg-indigo-950/40 border border-indigo-400/15 px-4 py-3 max-h-40 overflow-y-auto">
                            {inlineNotesLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                                </div>
                            ) : inlineNotesData && inlineNotesData.total_notes > 0 ? (
                                <div className="space-y-2">
                                    {Object.entries(inlineNotesData.notes_by_concept).slice(0, 2).map(([concept, notes]) => (
                                        <div key={concept}>
                                            <h4 className="text-xs font-bold text-indigo-300 mb-1">{concept}</h4>
                                            {notes.slice(0, 1).map((note) => (
                                                <div key={note.id} className="text-xs">
                                                    <MathMarkdown dark className="[&_p]:!text-xs [&_p]:!mb-1 [&_li]:!text-xs [&_h1]:!text-sm [&_h2]:!text-sm [&_h3]:!text-xs">
                                                        {note.body_markdown.length > 300 ? note.body_markdown.slice(0, 300) + "..." : note.body_markdown}
                                                    </MathMarkdown>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-indigo-300/40 text-center py-2">Notes will appear here</p>
                            )}
                        </div>

                        {/* 2x2 action button grid */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => {
                                    const topic = selectedTopic;
                                    setSelectedTopic(null);
                                    onStartLearning(topic);
                                }}
                                className="flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
                            >
                                <Play className="w-5 h-5" />
                                <span>Learn</span>
                                <span className="text-[10px] font-normal text-indigo-200/70">Info cards first</span>
                            </button>
                            <button
                                onClick={() => {
                                    const topic = selectedTopic;
                                    setSelectedTopic(null);
                                    onFlashcardsOnly(topic);
                                }}
                                className="flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl bg-indigo-950/60 border border-indigo-400/20 hover:bg-indigo-950/80 text-indigo-100 font-semibold text-sm transition-colors"
                            >
                                <Layers className="w-5 h-5" />
                                <span>Flashcards</span>
                                <span className="text-[10px] font-normal text-indigo-300/50">Skip to cards</span>
                            </button>
                            <button
                                onClick={() => {
                                    const topic = selectedTopic;
                                    setSelectedTopic(null);
                                    onQuizOnly(topic);
                                }}
                                className="flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl bg-indigo-950/60 border border-indigo-400/20 hover:bg-indigo-950/80 text-indigo-100 font-semibold text-sm transition-colors"
                            >
                                <Zap className="w-5 h-5" />
                                <span>Quiz</span>
                                <span className="text-[10px] font-normal text-indigo-300/50">Straight to questions</span>
                            </button>
                            <button
                                onClick={() => handleFetchNotes(selectedTopic)}
                                className="flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl bg-indigo-950/60 border border-indigo-400/20 hover:bg-indigo-950/80 text-indigo-100 font-semibold text-sm transition-colors"
                            >
                                <BookOpen className="w-5 h-5" />
                                <span>Review</span>
                                <span className="text-[10px] font-normal text-indigo-300/50">Full study notes</span>
                            </button>
                        </div>

                        {/* Resource chips for this topic */}
                        {(topicResources?.[selectedTopic.id]?.length ?? 0) > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-indigo-300/60 uppercase tracking-wider mb-2">Resources</h4>
                                <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    {topicResources![selectedTopic.id]!.map((r, idx) => (
                                        <ResourceChip key={idx} title={r.title} url={r.url} sourceType={r.source_type} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recent history */}
                        {topicSessions.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-indigo-300/60 uppercase tracking-wider mb-2">Recent Sessions</h4>
                                <div className="space-y-2">
                                    {topicSessions.map((session) => (
                                        <div
                                            key={session.id}
                                            className="flex items-center gap-3 bg-indigo-950/40 border border-indigo-400/10 rounded-lg px-3 py-2.5"
                                        >
                                            <CheckCircle2 className={cn(
                                                "w-4 h-4 shrink-0",
                                                session.accuracy >= 80 ? "text-emerald-400" :
                                                session.accuracy >= 50 ? "text-indigo-400" :
                                                "text-indigo-400/40",
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-white font-medium">
                                                    {session.questions_correct}/{session.questions_answered} correct
                                                    <span className="text-indigo-300/50 ml-1">({Math.round(session.accuracy)}%)</span>
                                                </div>
                                                <div className="text-[10px] text-indigo-300/40 mt-0.5 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {timeAgo(session.ended_at || session.started_at)}
                                                </div>
                                            </div>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300/60 font-medium">
                                                {session.phase}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </BottomSheet>

            {/* Study notes bottom sheet */}
            <BottomSheet
                open={showNotesSheet}
                onClose={() => { setShowNotesSheet(false); setNotesData(null); }}
                title="Concept Review"
            >
                {notesLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    </div>
                ) : notesData && notesData.total_notes > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(notesData.notes_by_concept).map(([concept, notes]) => (
                            <div key={concept}>
                                <h3 className="text-sm font-bold text-indigo-200 mb-3 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-indigo-400" />
                                    {concept}
                                </h3>
                                <div className="space-y-3">
                                    {notes.map((note) => (
                                        <div
                                            key={note.id}
                                            className="bg-indigo-950/40 border border-indigo-400/15 rounded-xl px-4 py-3"
                                        >
                                            <h4 className="text-sm font-semibold text-white mb-2">{note.title}</h4>
                                            <div className="text-sm leading-relaxed">
                                                <MathMarkdown dark>{note.body_markdown}</MathMarkdown>
                                            </div>
                                            {note.key_takeaway && (
                                                <div className="mt-3 pt-2 border-t border-indigo-400/10">
                                                    <p className="text-xs text-indigo-300/70">
                                                        <span className="font-semibold text-indigo-300">Key takeaway:</span> {note.key_takeaway}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <BookOpen className="w-10 h-10 text-indigo-400/30 mx-auto mb-3" />
                        <p className="text-sm text-indigo-200/60">No study notes available for this topic yet.</p>
                        <p className="text-xs text-indigo-300/40 mt-1">Start a learning session to generate notes.</p>
                    </div>
                )}
            </BottomSheet>
        </div>
    );
}

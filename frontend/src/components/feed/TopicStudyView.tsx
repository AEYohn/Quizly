"use client";

import { ArrowLeft, BookOpen, Layers, Zap, Pencil, Check, XIcon, Loader2, Eye, ExternalLink, RefreshCw, AlertCircle, FileText } from "lucide-react";
import { cn } from "~/lib/utils";
import { MathMarkdown } from "~/components/MathMarkdown";
import { FlashcardCard } from "~/components/learning/FlashcardCard";
import { CosmicQuizCard } from "~/variants/brilliant/QuizCard";
import { useTopicStudyView, type StudyTab } from "~/hooks/feed/useTopicStudyView";
import { ResourceContentViewer } from "~/components/feed/ResourceContentViewer";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";
import type { SyllabusTopic } from "~/stores/scrollSessionStore";
import type { ApiResult } from "~/types";

// ============================================
// Mastery ring (self-contained, same as SkillTree)
// ============================================

function MasteryRing({ mastery, size = 40 }: { mastery: number; size?: number }) {
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const fraction = Math.max(0, Math.min(100, mastery)) / 100;
    const dashOffset = circumference * (1 - fraction);
    const color =
        mastery >= 80 ? "#34d399" :
        mastery >= 40 ? "#26C6DA" :
        mastery > 0   ? "rgba(38,198,218,0.3)" :
                        "rgba(38,198,218,0.15)";

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(38,198,218,0.1)" strokeWidth={strokeWidth} />
                {fraction > 0 && (
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
                        strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-700 ease-out" />
                )}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-[11px] font-bold tabular-nums",
                    mastery >= 80 ? "text-emerald-400" : mastery > 0 ? "text-teal-300" : "text-teal-400/30",
                )}>{mastery > 0 ? `${mastery}` : ""}</span>
            </div>
        </div>
    );
}

// ============================================
// Shimmer animation helper
// ============================================

function ShimmerBlock({ className }: { className?: string }) {
    return (
        <div className={cn("rounded-lg bg-teal-400/[0.07] animate-pulse", className)} />
    );
}

// ============================================
// Tab-specific skeleton loaders (centered)
// ============================================

function NotesLoadingSkeleton() {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
            <BookOpen className="w-8 h-8 text-teal-400/40 animate-pulse" />
            <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            <p className="text-xs text-teal-300/50">Generating study notes...</p>
            <div className="w-full max-w-sm space-y-3 mt-2">
                <ShimmerBlock className="h-4 w-3/4" />
                <ShimmerBlock className="h-3 w-full" />
                <ShimmerBlock className="h-3 w-5/6" />
                <ShimmerBlock className="h-3 w-2/3" />
            </div>
        </div>
    );
}

function CardsLoadingSkeleton() {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
            <Layers className="w-8 h-8 text-teal-400/40 animate-pulse" />
            <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            <p className="text-xs text-teal-300/50">Preparing flashcards...</p>
            <div className="w-full max-w-xs mt-2">
                <ShimmerBlock className="h-48 w-full rounded-2xl" />
            </div>
        </div>
    );
}

function QuizLoadingSkeleton() {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
            <Zap className="w-8 h-8 text-teal-400/40 animate-pulse" />
            <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            <p className="text-xs text-teal-300/50">Building quiz questions...</p>
            <div className="w-full max-w-xs space-y-2.5 mt-2">
                <ShimmerBlock className="h-5 w-4/5" />
                <ShimmerBlock className="h-10 w-full rounded-xl" />
                <ShimmerBlock className="h-10 w-full rounded-xl" />
                <ShimmerBlock className="h-10 w-full rounded-xl" />
                <ShimmerBlock className="h-10 w-full rounded-xl" />
            </div>
        </div>
    );
}

function SessionErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
            <AlertCircle className="w-8 h-8 text-red-400/70" />
            <p className="text-sm text-red-300/80 text-center max-w-xs">{message}</p>
            <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors"
            >
                <RefreshCw className="w-4 h-4" />
                Retry
            </button>
        </div>
    );
}

// ============================================
// Tab button
// ============================================

const TABS: { key: StudyTab; label: string; icon: typeof BookOpen }[] = [
    { key: "notes", label: "Notes", icon: BookOpen },
    { key: "cards", label: "Cards", icon: Layers },
    { key: "quiz", label: "Quiz", icon: Zap },
];

// ============================================
// Peek Notes overlay
// ============================================

function PeekNotesOverlay({ takeaways, onClose }: { takeaways: Array<{ concept: string; takeaway: string }>; onClose: () => void }) {
    return (
        <div className="absolute inset-x-0 bottom-0 z-40 animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#131313]/95 backdrop-blur-xl border-t border-teal-400/20 rounded-t-2xl max-h-[50vh] overflow-y-auto px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-teal-200">Key Takeaways</h4>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-teal-300/60"><XIcon className="w-4 h-4" /></button>
                </div>
                {takeaways.length === 0 ? (
                    <p className="text-xs text-teal-300/40">No takeaways available yet.</p>
                ) : (
                    <div className="space-y-2.5">
                        {takeaways.map((t, i) => (
                            <div key={i} className="px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-400/15">
                                <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">{t.concept}</span>
                                <p className="text-xs text-teal-200/80 mt-0.5 leading-relaxed">{t.takeaway}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// Peek Resources overlay
// ============================================

function PeekResourcesOverlay({
    resources,
    onClose,
    onViewResource,
}: {
    resources: Array<{ id: string; file_name: string; concepts_count: number }>;
    onClose: () => void;
    onViewResource: (id: string) => void;
}) {
    return (
        <div className="absolute inset-x-0 bottom-0 z-40 animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#131313]/95 backdrop-blur-xl border-t border-indigo-400/20 rounded-t-2xl max-h-[50vh] overflow-y-auto px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-indigo-200">Uploaded Materials</h4>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-indigo-300/60"><XIcon className="w-4 h-4" /></button>
                </div>
                {resources.length === 0 ? (
                    <p className="text-xs text-indigo-300/40">No materials uploaded yet.</p>
                ) : (
                    <div className="space-y-2">
                        {resources.map((r) => (
                            <button
                                key={r.id}
                                onClick={() => { onViewResource(r.id); onClose(); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-400/15 hover:bg-indigo-500/20 transition-colors text-left"
                            >
                                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-indigo-200 truncate">{r.file_name}</p>
                                    <p className="text-[11px] text-indigo-300/50">{r.concepts_count} concepts</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// Main component
// ============================================

interface TopicStudyViewProps {
    topic: SyllabusTopic;
    mastery: number;
    onClose: () => void;
    onStudyNotes: (topic: SyllabusTopic) => Promise<ApiResult<{ topic: string; total_notes: number; notes_by_concept: Record<string, Array<{ id: string; concept: string; title: string; body_markdown: string; key_takeaway: string }>> }>>;
    topicResources?: Array<{ title: string; url: string; source_type: string; thumbnail_url?: string }>;
}

export function TopicStudyView({ topic, mastery, onClose, topicResources }: TopicStudyViewProps) {
    const s = useTopicStudyView(topic);
    const store = useScrollSessionStore();

    return (
        <div className="fixed inset-0 z-50 bg-[#0F0F0F] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* ── Header ── */}
            <div className="shrink-0 px-4 pt-4 pb-2">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/10 text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <MasteryRing mastery={mastery} size={36} />
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-white truncate">{topic.name}</h2>
                        <p className="text-[11px] text-teal-300/50">{topic.concepts.length} concepts</p>
                    </div>
                </div>

                {/* ── Tab bar ── */}
                <div className="flex gap-1 mt-3 p-1 bg-neutral-900/40 rounded-xl border border-teal-400/10">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = s.activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => s.setActiveTab(tab.key)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                                    isActive
                                        ? "bg-teal-600 text-white shadow-lg shadow-teal-500/20"
                                        : "text-teal-300/60 hover:text-teal-200 hover:bg-teal-500/10",
                                )}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Content area — all 3 rendered, only active visible ── */}
            <div className="flex-1 min-h-0 relative">
                {/* Notes tab */}
                <div className={cn("absolute inset-0 overflow-y-auto", s.activeTab !== "notes" && "hidden")}>
                    <div className="px-4 py-4">
                        {s.notesLoading ? (
                            <NotesLoadingSkeleton />
                        ) : s.notesError ? (
                            <SessionErrorState message={s.notesError} onRetry={s.retryNotes} />
                        ) : s.notesData && s.notesData.total_notes > 0 ? (
                            <div className="space-y-5">
                                {Object.entries(s.notesData.notes_by_concept).map(([concept, notes]) => (
                                    <div key={concept}>
                                        <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-2">{concept}</h4>
                                        {notes.map((note) => (
                                            <div key={note.id} className="mb-4">
                                                {s.editingNoteId === note.id ? (
                                                    /* Edit mode */
                                                    <div className="space-y-3">
                                                        <textarea
                                                            value={s.editDraft}
                                                            onChange={(e) => s.setEditDraft(e.target.value)}
                                                            className="w-full min-h-[200px] bg-[#1A1A1A] border border-teal-400/20 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono leading-relaxed resize-y focus:outline-none focus:border-teal-400/40"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-teal-300/50 font-semibold uppercase">Takeaway:</span>
                                                            <input
                                                                value={s.editTakeawayDraft}
                                                                onChange={(e) => s.setEditTakeawayDraft(e.target.value)}
                                                                className="flex-1 bg-[#1A1A1A] border border-teal-400/20 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-teal-400/40"
                                                            />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={s.saveEditedNote}
                                                                disabled={s.isSavingNote}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={s.cancelEditingNote}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/60 border border-teal-400/20 text-teal-200 text-xs font-medium transition-colors hover:bg-neutral-900/80"
                                                            >
                                                                <XIcon className="w-3 h-3" />
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* View mode */
                                                    <div className="group relative">
                                                        <button
                                                            onClick={() => s.startEditingNote(note)}
                                                            className="absolute top-1 right-1 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/5 text-teal-300/40 hover:text-teal-300 transition-all z-10"
                                                            title="Edit note"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <MathMarkdown dark className="[&_p]:!text-[13px] [&_p]:!leading-relaxed [&_li]:!text-[13px] [&_h1]:!text-sm [&_h2]:!text-sm [&_h3]:!text-[13px]">
                                                            {note.body_markdown}
                                                        </MathMarkdown>
                                                        {note.key_takeaway && (
                                                            <div className="mt-2 px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-400/15">
                                                                <p className="text-xs text-teal-200/80 leading-relaxed">
                                                                    <span className="font-semibold text-teal-300">Key takeaway:</span> {note.key_takeaway}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {note.sources && note.sources.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                {note.sources.map((src, i) => (
                                                                    <a
                                                                        key={i}
                                                                        href={src.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-teal-500/10 border border-teal-400/15 text-teal-300 hover:text-teal-200 hover:bg-teal-500/20 transition-colors"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                        {src.title}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ))}

                                {/* Resource chips */}
                                {topicResources && topicResources.length > 0 && (
                                    <div className="pt-3 border-t border-teal-400/10">
                                        <h4 className="text-[10px] font-semibold text-teal-300/50 uppercase tracking-wider mb-1.5">Resources</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {topicResources.map((r, idx) => (
                                                <a
                                                    key={idx}
                                                    href={r.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-teal-500/10 border border-teal-400/15 text-teal-300 hover:text-teal-200 hover:bg-teal-500/20 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    {r.title}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <BookOpen className="w-5 h-5 text-teal-400/30" />
                                <p className="text-xs text-teal-300/40">No study notes available yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cards (flashcards) tab */}
                <div className={cn("absolute inset-0", s.activeTab !== "cards" && "hidden")}>
                    {s.sessionError ? (
                        <SessionErrorState message={s.sessionError} onRetry={s.retrySession} />
                    ) : s.cardsLoading ? (
                        <CardsLoadingSkeleton />
                    ) : s.flashcardsExhausted ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 px-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                <Check className="w-6 h-6 text-emerald-400" />
                            </div>
                            <p className="text-sm font-semibold text-teal-200">All cards reviewed!</p>
                            <p className="text-xs text-teal-300/50 text-center max-w-xs">You&apos;ve gone through all the flashcards for this topic. Try the Quiz tab to test your knowledge.</p>
                        </div>
                    ) : s.currentFlashcard ? (
                        <FlashcardCard
                            card={s.currentFlashcard}
                            onRate={s.handleFlashcardRate}
                            onNext={s.handleFlashcardNext}
                            stats={s.cardStats}
                            xpEarned={s.flashcardXp}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-2">
                            <Layers className="w-5 h-5 text-teal-400/30" />
                            <p className="text-xs text-teal-300/40">No flashcards available.</p>
                        </div>
                    )}
                </div>

                {/* Quiz tab */}
                <div className={cn("absolute inset-0", s.activeTab !== "quiz" && "hidden")}>
                    {s.sessionError ? (
                        <SessionErrorState message={s.sessionError} onRetry={s.retrySession} />
                    ) : s.quizLoading ? (
                        <QuizLoadingSkeleton />
                    ) : s.currentQuizCard ? (
                        <CosmicQuizCard
                            card={s.currentQuizCard}
                            onAnswer={s.handleQuizAnswer}
                            onNext={s.handleQuizNext}
                            onHelp={s.handleQuizHelp}
                            result={s.quizResult}
                            stats={s.quizStats}
                            analytics={s.quizAnalytics}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-2">
                            <Zap className="w-5 h-5 text-teal-400/30" />
                            <p className="text-xs text-teal-300/40">No quiz cards available.</p>
                        </div>
                    )}
                </div>

                {/* Floating buttons — visible on Cards/Quiz tabs */}
                {s.activeTab !== "notes" && (
                    <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
                        {/* Peek PDFs button */}
                        {store.subjectResources.length > 0 && (
                            <button
                                onClick={() => s.setShowPeekResources(!s.showPeekResources)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-full",
                                    "bg-indigo-600/90 backdrop-blur text-white text-xs font-semibold",
                                    "shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all",
                                    "border border-indigo-400/30",
                                )}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Peek PDFs
                            </button>
                        )}

                        {/* Peek Notes button */}
                        {s.keyTakeaways.length > 0 && (
                            <button
                                onClick={() => s.setShowPeekNotes(!s.showPeekNotes)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-full",
                                    "bg-teal-600/90 backdrop-blur text-white text-xs font-semibold",
                                    "shadow-lg shadow-teal-500/20 hover:bg-teal-500 transition-all",
                                    "border border-teal-400/30",
                                )}
                            >
                                <Eye className="w-3.5 h-3.5" />
                                Peek Notes
                            </button>
                        )}
                    </div>
                )}

                {/* Peek notes overlay */}
                {s.showPeekNotes && s.activeTab !== "notes" && (
                    <PeekNotesOverlay
                        takeaways={s.keyTakeaways}
                        onClose={() => s.setShowPeekNotes(false)}
                    />
                )}

                {/* Peek resources overlay */}
                {s.showPeekResources && s.activeTab !== "notes" && (
                    <PeekResourcesOverlay
                        resources={store.subjectResources}
                        onClose={() => s.setShowPeekResources(false)}
                        onViewResource={(id) => s.setViewingResourceId(id)}
                    />
                )}

                {/* Resource content viewer */}
                <ResourceContentViewer
                    resourceId={s.viewingResourceId}
                    onClose={() => s.setViewingResourceId(null)}
                />
            </div>
        </div>
    );
}

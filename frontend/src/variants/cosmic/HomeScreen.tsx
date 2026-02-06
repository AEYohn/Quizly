"use client";

import { useState, useRef } from "react";
import { Search, Star, Sparkles, ArrowRight, Rocket, Zap, BookOpen, Target, TrendingUp, Play, Upload, Trash2, Github, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import type { HomeScreenProps } from "~/variants/contracts";

function StarField() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
                className="absolute inset-0 animate-pulse"
                style={{
                    background: `
                        radial-gradient(2px 2px at 10% 15%, rgba(255,255,255,0.7) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 25% 35%, rgba(255,255,255,0.5) 50%, transparent 100%),
                        radial-gradient(2px 2px at 40% 8%, rgba(255,255,255,0.8) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 55% 42%, rgba(255,255,255,0.5) 50%, transparent 100%),
                        radial-gradient(2px 2px at 70% 20%, rgba(255,255,255,0.6) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 85% 55%, rgba(255,255,255,0.4) 50%, transparent 100%),
                        radial-gradient(2px 2px at 15% 60%, rgba(255,255,255,0.5) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 90% 10%, rgba(255,255,255,0.6) 50%, transparent 100%),
                        radial-gradient(2px 2px at 50% 75%, rgba(255,255,255,0.4) 50%, transparent 100%),
                        radial-gradient(1.5px 1.5px at 35% 90%, rgba(255,255,255,0.5) 50%, transparent 100%)
                    `,
                    animationDuration: "4s",
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    background: `
                        radial-gradient(2.5px 2.5px at 20% 25%, rgba(165,180,252,0.8) 50%, transparent 100%),
                        radial-gradient(2.5px 2.5px at 60% 15%, rgba(165,180,252,0.7) 50%, transparent 100%),
                        radial-gradient(2.5px 2.5px at 80% 45%, rgba(110,231,183,0.6) 50%, transparent 100%),
                        radial-gradient(3px 3px at 45% 55%, rgba(251,191,36,0.5) 50%, transparent 100%),
                        radial-gradient(2px 2px at 30% 70%, rgba(165,180,252,0.6) 50%, transparent 100%),
                        radial-gradient(2px 2px at 75% 80%, rgba(110,231,183,0.5) 50%, transparent 100%)
                    `,
                }}
            />
        </div>
    );
}

export function HomeScreen({
    history,
    historyOverall,
    suggestions,
    activeSession,
    topicInput,
    syllabusLoading,
    isLoading,
    error,
    onTopicInputChange,
    onSubjectSelect,
    onQuickStart,
    onPdfUpload,
    pdfUploading,
    onDeleteSubject,
    timeAgo,
    onCodebaseAnalyze,
    codebaseLoading,
    githubUrlInput,
    onGithubUrlInputChange,
}: HomeScreenProps) {
    const [searchFocused, setSearchFocused] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasHistory = history.length > 0;

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-[#050510] via-[#0a0820] to-[#050515] overflow-y-auto relative">
            <StarField />

            <div className="relative z-10 flex-1 px-5 pt-6 pb-8 space-y-7 max-w-lg mx-auto w-full">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Star className="w-6 h-6 text-amber-400" fill="currentColor" />
                        <h1 className="text-2xl font-bold text-white">
                            {hasHistory ? "Welcome back, Explorer" : "Welcome, Explorer"}
                        </h1>
                    </div>
                    <p className="text-base text-indigo-200/80">Chart Your Course Through the Stars</p>
                </div>

                {/* Stats bar */}
                {historyOverall && (
                    <div className="grid grid-cols-4 gap-2.5">
                        {[
                            { label: "Subjects", value: historyOverall.total_subjects, icon: Rocket, color: "text-indigo-300" },
                            { label: "Sessions", value: historyOverall.total_sessions, icon: Target, color: "text-emerald-300" },
                            { label: "Total XP", value: historyOverall.total_xp, icon: Zap, color: "text-amber-300" },
                            { label: "Mastered", value: historyOverall.concepts_mastered, icon: Star, color: "text-amber-300" },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div
                                key={label}
                                className="bg-indigo-950/60 border border-indigo-400/20 rounded-xl p-3 text-center"
                            >
                                <Icon className={cn("w-4 h-4 mx-auto mb-1.5", color)} />
                                <div className="text-lg font-bold text-white">{value}</div>
                                <div className="text-[10px] text-indigo-200/60 uppercase tracking-wide">{label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search bar */}
                <div className="relative">
                    <div
                        className={cn(
                            "absolute -inset-1.5 rounded-2xl transition-all duration-300",
                            searchFocused ? "bg-indigo-500/30 blur-lg" : "bg-transparent",
                        )}
                    />
                    <div className="relative flex items-center gap-3 bg-indigo-950/60 border border-indigo-400/25 rounded-2xl px-4 py-3.5">
                        <Search className="w-5 h-5 text-indigo-300 shrink-0" />
                        <input
                            value={topicInput}
                            onChange={(e) => onTopicInputChange(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && topicInput.trim()) {
                                    onQuickStart(topicInput.trim());
                                }
                            }}
                            placeholder="Search the cosmos... (e.g., Quantum Physics)"
                            className="flex-1 bg-transparent text-base text-white placeholder-indigo-300/40 outline-none"
                        />
                        {topicInput.trim() && (
                            <button
                                onClick={() => onQuickStart(topicInput.trim())}
                                disabled={syllabusLoading}
                                className="shrink-0 px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-400 disabled:opacity-50 transition-colors text-sm"
                            >
                                Go
                            </button>
                        )}
                    </div>
                </div>

                {/* PDF Upload */}
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.md"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files?.length) {
                                onPdfUpload(e.target.files);
                                e.target.value = "";
                            }
                        }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={pdfUploading}
                        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl border-2 border-dashed border-indigo-400/25 text-indigo-200/60 hover:border-indigo-400/50 hover:text-indigo-200 transition-all disabled:opacity-50"
                    >
                        {pdfUploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-indigo-300/50 border-t-indigo-300 rounded-full animate-spin" />
                                <span className="text-sm font-medium">Processing document...</span>
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                <span className="text-sm font-medium">Upload PDF to generate skill tree</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Learn a Project — GitHub URL */}
                {onCodebaseAnalyze && (
                    <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-indigo-200/70 uppercase tracking-wider flex items-center gap-2">
                            <Github className="w-4 h-4" />
                            Learn a Project
                        </h2>
                        <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-400/25 rounded-2xl px-4 py-3">
                            <Github className="w-5 h-5 text-indigo-300/60 shrink-0" />
                            <input
                                value={githubUrlInput ?? ""}
                                onChange={(e) => onGithubUrlInputChange?.(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && githubUrlInput?.trim()) {
                                        onCodebaseAnalyze(githubUrlInput.trim());
                                    }
                                }}
                                placeholder="https://github.com/owner/repo"
                                className="flex-1 bg-transparent text-sm text-white placeholder-indigo-300/40 outline-none"
                            />
                            {githubUrlInput?.trim() && (
                                <button
                                    onClick={() => onCodebaseAnalyze(githubUrlInput.trim())}
                                    disabled={codebaseLoading}
                                    className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                >
                                    {codebaseLoading ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        "Analyze"
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {/* Resume banner */}
                {activeSession && (
                    <button
                        onClick={() => onSubjectSelect(activeSession.topic)}
                        className="w-full group"
                    >
                        <div className="relative bg-gradient-to-r from-indigo-600/20 to-emerald-600/20 border border-indigo-400/30 rounded-2xl p-4 flex items-center gap-4 hover:border-indigo-400/50 transition-all">
                            <div className="relative w-16 h-16 shrink-0">
                                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(129,140,248,0.2)" strokeWidth="3.5" />
                                    <circle
                                        cx="32" cy="32" r="28" fill="none"
                                        strokeWidth="3.5"
                                        strokeLinecap="round"
                                        stroke="url(#orbital-grad)"
                                        strokeDasharray={`${(activeSession.accuracy / 100) * 175.9} 175.9`}
                                    />
                                    <defs>
                                        <linearGradient id="orbital-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#a5b4fc" />
                                            <stop offset="100%" stopColor="#34d399" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Rocket className="w-6 h-6 text-indigo-300" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm text-emerald-300 font-semibold mb-0.5">Resume Mission</div>
                                <div className="text-base font-bold text-white truncate">{activeSession.topic}</div>
                                <div className="text-sm text-indigo-200/60 mt-0.5">
                                    {activeSession.questions_answered} signals &middot; {activeSession.accuracy}% accuracy
                                </div>
                            </div>
                            <Play className="w-6 h-6 text-indigo-300 group-hover:text-white transition-colors shrink-0" fill="currentColor" />
                        </div>
                    </button>
                )}

                {/* Subject cards */}
                {hasHistory && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-indigo-200/70 uppercase tracking-wider flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            Your Star Systems
                        </h2>
                        <div className="space-y-2.5">
                            {history.map((entry) => (
                                <div key={entry.subject} className="relative group">
                                    <button
                                        onClick={() => onSubjectSelect(entry.subject)}
                                        className="w-full text-left"
                                    >
                                        <div className="bg-indigo-950/50 border border-indigo-400/15 rounded-2xl p-4 hover:border-indigo-400/40 hover:bg-indigo-950/70 transition-all">
                                            <div className="flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <div className="text-base font-semibold text-white truncate group-hover:text-indigo-200 transition-colors">
                                                        {entry.subject}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1.5 text-sm text-indigo-200/50">
                                                        <span>{entry.total_sessions} voyages</span>
                                                        <span>{entry.accuracy}% accuracy</span>
                                                        <span className="text-amber-300/70">{entry.total_xp} XP</span>
                                                    </div>
                                                    {entry.last_studied_at && (
                                                        <div className="text-xs text-indigo-200/35 mt-1">
                                                            Last visited {timeAgo(entry.last_studied_at)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="shrink-0 ml-3">
                                                    {entry.has_syllabus ? (
                                                        <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center">
                                                            <BookOpen className="w-5 h-5 text-indigo-300" />
                                                        </div>
                                                    ) : (
                                                        <ArrowRight className="w-5 h-5 text-indigo-300/60 group-hover:text-indigo-300 transition-colors" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Delete "${entry.subject}" and all its data?`)) {
                                                onDeleteSubject(entry.subject);
                                            }
                                        }}
                                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/0 hover:bg-red-500/20 text-indigo-200/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all z-10"
                                        title="Delete subject"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Suggested topics */}
                {suggestions.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-indigo-200/70 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Uncharted Territories
                        </h2>
                        <div className="flex flex-wrap gap-2.5">
                            {suggestions.map((topic) => (
                                <button
                                    key={topic}
                                    onClick={() => onQuickStart(topic)}
                                    disabled={syllabusLoading}
                                    className="relative group"
                                >
                                    <div className="absolute -inset-0.5 rounded-full bg-indigo-400/30 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                                    <div className="relative px-4 py-2 rounded-full text-sm font-medium text-indigo-100 bg-indigo-500/10 border border-indigo-400/25 hover:border-indigo-400/50 hover:text-white transition-all">
                                        {topic}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {(isLoading || syllabusLoading) && (
                    <div className="flex items-center justify-center gap-3 py-8">
                        <div className="relative w-10 h-10">
                            <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30" />
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-300 animate-spin" />
                        </div>
                        <span className="text-base text-indigo-200">Calculating trajectory...</span>
                    </div>
                )}
            </div>
        </div>
    );
}

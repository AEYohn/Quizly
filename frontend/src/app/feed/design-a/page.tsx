"use client";

/**
 * Design A: "Ambient Glass"
 *
 * Aesthetic: Frosted glass panels floating over a rich animated mesh gradient.
 * Deep, immersive, premium. Like a luxury learning cockpit.
 *
 * Key choices:
 * - Animated gradient mesh background (CSS only)
 * - Glassmorphism panels with backdrop-blur
 * - Outfit font (geometric, modern, clean)
 * - Teal/cyan accent on deep teal-black
 * - Generous whitespace, centered layout
 * - Shimmer CTA button
 */

import { useState, useCallback } from "react";
import { Outfit } from "next/font/google";
import {
    Zap, Upload, BookOpen, ChevronDown, ChevronUp,
    Sparkles, ArrowRight,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useScrollSessionStore, PRESETS, DEFAULT_PREFERENCES } from "~/stores/scrollSessionStore";
import type { FeedPreferences } from "~/stores/scrollSessionStore";
import { scrollApi, curriculumApi } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";
import { useRouter } from "next/navigation";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

// Preset helpers
type PresetKey = "QUIZ_HEAVY" | "BALANCED" | "FLASHCARD_FOCUS";
const PRESET_LABELS: Record<PresetKey, string> = {
    QUIZ_HEAVY: "Quiz Heavy",
    BALANCED: "Balanced",
    FLASHCARD_FOCUS: "Flashcard Focus",
};

function getActivePreset(mix: FeedPreferences["contentMix"]): PresetKey | null {
    for (const [key, preset] of Object.entries(PRESETS)) {
        if (Math.abs(mix.mcq - preset.mcq) < 0.01 && Math.abs(mix.flashcard - preset.flashcard) < 0.01) {
            return key as PresetKey;
        }
    }
    return null;
}

const STYLES = ["Any", "Conceptual", "Application", "Analysis", "Transfer"] as const;
const STYLE_VALUES = [null, "conceptual", "application", "analysis", "transfer"] as const;

export default function DesignAPage() {
    const auth = useAuth();
    const router = useRouter();
    const store = useScrollSessionStore();
    const [showNotes, setShowNotes] = useState(false);
    const [showTune, setShowTune] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);

    const activePreset = getActivePreset(store.preferences.contentMix);

    const handleFileUpload = useCallback(async (file: File) => {
        setUploadedFile(file);
        setIsProcessingFile(true);
        store.setError(null);
        try {
            const formData = new FormData();
            formData.append("files", file);
            const res = await curriculumApi.processMaterials(formData);
            if (res.success) {
                if (res.data.topic) store.setTopicInput(res.data.topic);
                const notesText = [res.data.summary, res.data.concepts.length ? "\n\nKey concepts: " + res.data.concepts.join(", ") : ""].join("");
                store.setNotesInput(notesText);
                setShowNotes(true);
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to process file");
        } finally {
            setIsProcessingFile(false);
        }
    }, [store]);

    const handleStart = useCallback(async () => {
        if (!store.topicInput.trim()) return;
        store.setIsLoading(true);
        store.setError(null);
        try {
            const studentName = getStudentName(auth.user);
            const res = await scrollApi.startFeed(
                store.topicInput.trim(), studentName, auth.user?.id,
                store.notesInput.trim() || undefined,
                { difficulty: store.preferences.difficulty, content_mix: store.preferences.contentMix, question_style: store.preferences.questionStyle },
            );
            if (!res.success) { store.setError(res.error ?? "Failed"); store.setIsLoading(false); return; }
            store.setSessionId(res.data.session_id);
            store.setTopic(store.topicInput.trim());
            store.setCards(res.data.cards);
            store.setCurrentIdx(0);
            store.setStats(res.data.stats);
            store.clearCardState();
            router.push("/feed");
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            store.setIsLoading(false);
        }
    }, [store, auth.user, router]);

    return (
        <div className={cn(outfit.variable, "min-h-screen relative overflow-hidden")} style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}>
            {/* Animated mesh gradient background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#111111]" />
                <div
                    className="absolute inset-0 opacity-60"
                    style={{
                        background: `
                            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(56,189,248,0.15) 0%, transparent 70%),
                            radial-gradient(ellipse 60% 80% at 80% 70%, rgba(168,85,247,0.12) 0%, transparent 70%),
                            radial-gradient(ellipse 50% 50% at 50% 50%, rgba(20,184,166,0.08) 0%, transparent 70%)
                        `,
                        animation: "meshMove 20s ease-in-out infinite alternate",
                    }}
                />
                {/* Noise overlay */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")" }} />
            </div>

            <style>{`
                @keyframes meshMove {
                    0% { transform: scale(1) rotate(0deg); }
                    100% { transform: scale(1.1) rotate(3deg); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .glass {
                    background: rgba(255,255,255,0.04);
                    backdrop-filter: blur(20px) saturate(1.4);
                    -webkit-backdrop-filter: blur(20px) saturate(1.4);
                    border: 1px solid rgba(255,255,255,0.06);
                }
                .glass-input {
                    background: rgba(255,255,255,0.05);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .glass-input:focus {
                    border-color: rgba(56,189,248,0.4);
                    box-shadow: 0 0 0 3px rgba(56,189,248,0.08), inset 0 1px 2px rgba(0,0,0,0.2);
                }
                .btn-shimmer {
                    background: linear-gradient(110deg, #0ea5e9, #14b8a6, #0ea5e9, #06b6d4);
                    background-size: 200% 100%;
                    animation: shimmer 3s ease-in-out infinite;
                }
                .chip {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    transition: all 0.2s;
                }
                .chip:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.15);
                }
                .chip-active {
                    background: rgba(56,189,248,0.12) !important;
                    border-color: rgba(56,189,248,0.3) !important;
                    color: #67e8f9 !important;
                }
            `}</style>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-5 py-12">
                <div className="w-full max-w-md space-y-7">
                    {/* Hero */}
                    <div className="text-center space-y-4">
                        <div className="relative inline-flex">
                            <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl scale-150" />
                            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-teal-400/10 border border-cyan-400/20 flex items-center justify-center">
                                <Sparkles className="w-7 h-7 text-cyan-300" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold text-white tracking-tight">
                                Start Learning
                            </h1>
                            <p className="text-[15px] text-white/40 mt-2 leading-relaxed">
                                Your AI-powered study feed adapts in real time.
                            </p>
                        </div>
                    </div>

                    {/* Main glass card */}
                    <div className="glass rounded-3xl p-6 space-y-4">
                        {/* Topic input */}
                        <div>
                            <label className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em] mb-2 block">Topic</label>
                            <input
                                type="text"
                                value={store.topicInput}
                                onChange={(e) => store.setTopicInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                                placeholder="What are you studying?"
                                className="glass-input w-full px-4 py-3.5 rounded-xl text-white placeholder-white/25 focus:outline-none text-sm"
                                autoFocus
                            />
                        </div>

                        {/* Upload */}
                        <label className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all",
                            isProcessingFile ? "glass border-cyan-400/30" : uploadedFile ? "glass border-teal-400/30" : "glass hover:border-white/12",
                        )}>
                            <Upload className={cn("w-4 h-4 shrink-0", isProcessingFile ? "text-cyan-300 animate-pulse" : uploadedFile ? "text-teal-300" : "text-white/25")} />
                            <span className={cn("text-sm", isProcessingFile ? "text-cyan-200" : uploadedFile ? "text-teal-200" : "text-white/35")}>
                                {isProcessingFile ? "Processing..." : uploadedFile ? uploadedFile.name : "Upload study materials"}
                            </span>
                            <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                        </label>

                        {/* Notes toggle */}
                        <button onClick={() => setShowNotes(!showNotes)} className="text-xs text-white/25 hover:text-white/40 flex items-center gap-1.5 transition-colors">
                            <BookOpen className="w-3 h-3" /> {showNotes ? "Hide notes" : "Add notes (optional)"}
                        </button>
                        {showNotes && (
                            <textarea
                                value={store.notesInput}
                                onChange={(e) => store.setNotesInput(e.target.value)}
                                placeholder="Paste class notes or syllabus..."
                                rows={3}
                                className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-white/20 focus:outline-none text-sm resize-none"
                            />
                        )}
                    </div>

                    {/* Tune controls glass card */}
                    <div className="glass rounded-3xl overflow-hidden">
                        <button onClick={() => setShowTune(!showTune)} className="w-full flex items-center justify-between px-6 py-4 text-sm text-white/50 hover:text-white/70 transition-colors">
                            <span className="font-medium">Tune Your Feed</span>
                            {showTune ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {showTune && (
                            <div className="px-6 pb-5 space-y-5 border-t border-white/5 pt-4">
                                {/* Difficulty */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em]">Difficulty</span>
                                        <button
                                            onClick={() => store.setPreferences({ difficulty: store.preferences.difficulty === null ? 0.5 : null })}
                                            className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all",
                                                store.preferences.difficulty === null ? "bg-cyan-400/15 text-cyan-300 border border-cyan-400/20" : "bg-white/5 text-white/40 border border-white/8")}
                                        >
                                            {store.preferences.difficulty === null ? "AUTO" : "MANUAL"}
                                        </button>
                                    </div>
                                    {store.preferences.difficulty !== null && (
                                        <input type="range" min={0} max={100} value={Math.round(store.preferences.difficulty * 100)}
                                            onChange={(e) => store.setPreferences({ difficulty: parseInt(e.target.value) / 100 })}
                                            className="w-full h-1 accent-cyan-400 cursor-pointer" />
                                    )}
                                </div>

                                {/* Content Mix */}
                                <div>
                                    <span className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em] mb-2 block">Content Mix</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
                                            <button key={key} onClick={() => store.setPreferences({ contentMix: { ...PRESETS[key] } })}
                                                className={cn("chip px-3 py-1.5 rounded-lg text-xs text-white/50", activePreset === key && "chip-active")}>
                                                {PRESET_LABELS[key]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Question Style */}
                                <div>
                                    <span className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em] mb-2 block">Style</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {STYLES.map((label, i) => (
                                            <button key={label} onClick={() => store.setPreferences({ questionStyle: STYLE_VALUES[i] ?? null })}
                                                className={cn("chip px-3 py-1.5 rounded-lg text-xs text-white/50",
                                                    store.preferences.questionStyle === STYLE_VALUES[i] && "chip-active")}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleStart}
                        disabled={!store.topicInput.trim() || store.isLoading || isProcessingFile}
                        className="w-full py-4 rounded-2xl text-white font-semibold text-sm btn-shimmer disabled:opacity-20 disabled:cursor-not-allowed transition-opacity active:scale-[0.98] shadow-lg shadow-cyan-500/10"
                    >
                        {store.isLoading ? "Generating..." : (
                            <span className="flex items-center justify-center gap-2">
                                Start Learning <ArrowRight className="w-4 h-4" />
                            </span>
                        )}
                    </button>

                    {store.error && (
                        <div className="glass rounded-xl px-4 py-3 text-red-300 text-sm border-red-500/20">
                            {store.error}
                        </div>
                    )}

                    {/* Quick start */}
                    <div className="text-center space-y-3">
                        <span className="text-[10px] text-white/15 uppercase tracking-[0.2em] font-medium">Quick Start</span>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {["AP Biology", "Organic Chemistry", "Linear Algebra", "JavaScript", "World History"].map((t) => (
                                <button key={t} onClick={() => store.setTopicInput(t)}
                                    className="chip px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60">
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

/**
 * Design B: "Warm Editorial"
 *
 * Aesthetic: Light theme. Magazine-inspired editorial layout.
 * Sophisticated serif typography. Warm cream & terracotta palette.
 * Feels like opening a beautifully designed textbook.
 *
 * Key choices:
 * - Light cream background with subtle paper texture
 * - Instrument Serif for headings (elegant, editorial)
 * - DM Sans for body (clean, geometric)
 * - Terracotta/coral accent color
 * - Generous whitespace, left-aligned sections
 * - Underline-style inputs
 * - Decorative rule lines
 */

import { useState, useCallback } from "react";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import {
    Upload, BookOpen, ChevronDown, ChevronUp, ArrowRight, FileText,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useScrollSessionStore, PRESETS, DEFAULT_PREFERENCES } from "~/stores/scrollSessionStore";
import type { FeedPreferences } from "~/stores/scrollSessionStore";
import { scrollApi, curriculumApi } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";
import { useRouter } from "next/navigation";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-serif" });
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

type PresetKey = "QUIZ_HEAVY" | "BALANCED" | "FLASHCARD_FOCUS";
const PRESET_LABELS: Record<PresetKey, string> = { QUIZ_HEAVY: "Quiz Heavy", BALANCED: "Balanced", FLASHCARD_FOCUS: "Flashcard Focus" };

function getActivePreset(mix: FeedPreferences["contentMix"]): PresetKey | null {
    for (const [key, preset] of Object.entries(PRESETS)) {
        if (Math.abs(mix.mcq - preset.mcq) < 0.01 && Math.abs(mix.flashcard - preset.flashcard) < 0.01) return key as PresetKey;
    }
    return null;
}

const STYLES = ["Any", "Conceptual", "Application", "Analysis", "Transfer"] as const;
const STYLE_VALUES = [null, "conceptual", "application", "analysis", "transfer"] as const;

export default function DesignBPage() {
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
                store.setNotesInput([res.data.summary, res.data.concepts.length ? "\n\nKey concepts: " + res.data.concepts.join(", ") : ""].join(""));
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
            const res = await scrollApi.startFeed(store.topicInput.trim(), studentName, auth.user?.id,
                store.notesInput.trim() || undefined,
                { difficulty: store.preferences.difficulty, content_mix: store.preferences.contentMix, question_style: store.preferences.questionStyle });
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
        <div className={cn(serif.variable, sans.variable)} style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
            <style>{`
                :root {
                    --cream: #FAF6F1;
                    --cream-dark: #F0EAE0;
                    --ink: #1A1814;
                    --ink-light: #6B6560;
                    --ink-muted: #A8A09A;
                    --terra: #C4654A;
                    --terra-light: #E88B6D;
                    --terra-bg: rgba(196,101,74,0.06);
                    --terra-border: rgba(196,101,74,0.2);
                }
                .editorial-input {
                    border: none;
                    border-bottom: 1.5px solid #D5CEC7;
                    background: transparent;
                    padding: 12px 0;
                    font-size: 18px;
                    font-family: var(--font-serif), Georgia, serif;
                    color: var(--ink);
                    width: 100%;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .editorial-input::placeholder {
                    color: var(--ink-muted);
                    font-style: italic;
                }
                .editorial-input:focus {
                    border-bottom-color: var(--terra);
                }
                .rule {
                    height: 1px;
                    background: linear-gradient(90deg, var(--ink) 0%, var(--ink) 30%, transparent 100%);
                    opacity: 0.08;
                }
                .pill {
                    border: 1px solid #D5CEC7;
                    color: var(--ink-light);
                    transition: all 0.15s;
                }
                .pill:hover {
                    border-color: var(--ink-muted);
                    color: var(--ink);
                }
                .pill-active {
                    border-color: var(--terra) !important;
                    background: var(--terra-bg) !important;
                    color: var(--terra) !important;
                    font-weight: 500;
                }
                .section-label {
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    color: var(--ink-muted);
                    font-family: var(--font-sans), system-ui, sans-serif;
                }
            `}</style>

            <div className="min-h-screen" style={{ background: "var(--cream)" }}>
                <div className="max-w-md mx-auto px-6 py-16 space-y-10">
                    {/* Editorial header */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--terra-bg)", border: "1px solid var(--terra-border)" }}>
                                <FileText className="w-4 h-4" style={{ color: "var(--terra)" }} />
                            </div>
                            <span className="section-label">Quizly</span>
                        </div>
                        <div className="rule" />
                        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", color: "var(--ink)", fontSize: "36px", lineHeight: 1.15, fontWeight: 400 }}>
                            What would you<br />like to study?
                        </h1>
                        <p style={{ color: "var(--ink-muted)", fontSize: "14px", lineHeight: 1.7, maxWidth: "300px" }}>
                            Enter a topic and we&apos;ll create an adaptive study session tailored to your level.
                        </p>
                    </div>

                    {/* Topic input */}
                    <div>
                        <input
                            type="text"
                            value={store.topicInput}
                            onChange={(e) => store.setTopicInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleStart()}
                            placeholder="e.g., Organic Chemistry"
                            className="editorial-input"
                            autoFocus
                        />
                    </div>

                    {/* Upload + Notes */}
                    <div className="space-y-3">
                        <label className={cn(
                            "flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all border border-dashed",
                            isProcessingFile ? "border-amber-400 bg-amber-50" : uploadedFile ? "border-emerald-400 bg-emerald-50/50" : "border-gray-300 hover:border-gray-400",
                        )}>
                            <Upload className={cn("w-4 h-4", isProcessingFile ? "text-amber-500 animate-pulse" : uploadedFile ? "text-emerald-600" : "text-gray-400")} />
                            <span className={cn("text-sm", isProcessingFile ? "text-amber-700" : uploadedFile ? "text-emerald-700" : "text-gray-400")}>
                                {isProcessingFile ? "Processing..." : uploadedFile ? uploadedFile.name : "Upload PDF, notes, or syllabus"}
                            </span>
                            <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                        </label>

                        <button onClick={() => setShowNotes(!showNotes)} className="text-xs flex items-center gap-1.5 transition-colors" style={{ color: "var(--ink-muted)" }}>
                            <BookOpen className="w-3 h-3" /> {showNotes ? "Hide notes" : "Paste notes (optional)"}
                        </button>
                        {showNotes && (
                            <textarea
                                value={store.notesInput}
                                onChange={(e) => store.setNotesInput(e.target.value)}
                                placeholder="Paste class notes or syllabus here..."
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none"
                                style={{ border: "1px solid #D5CEC7", background: "white", color: "var(--ink)", fontFamily: "var(--font-sans)" }}
                            />
                        )}
                    </div>

                    <div className="rule" />

                    {/* Tune section */}
                    <div>
                        <button onClick={() => setShowTune(!showTune)} className="flex items-center justify-between w-full py-1">
                            <span className="section-label">Preferences</span>
                            {showTune ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "var(--ink-muted)" }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--ink-muted)" }} />}
                        </button>
                        {showTune && (
                            <div className="mt-5 space-y-6">
                                {/* Difficulty */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className="text-xs font-medium" style={{ color: "var(--ink-light)" }}>Difficulty</span>
                                        <button
                                            onClick={() => store.setPreferences({ difficulty: store.preferences.difficulty === null ? 0.5 : null })}
                                            className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                                            style={{
                                                background: store.preferences.difficulty === null ? "var(--terra-bg)" : "#F0EAE0",
                                                color: store.preferences.difficulty === null ? "var(--terra)" : "var(--ink-muted)",
                                                border: `1px solid ${store.preferences.difficulty === null ? "var(--terra-border)" : "#D5CEC7"}`,
                                            }}
                                        >
                                            {store.preferences.difficulty === null ? "AUTO" : "MANUAL"}
                                        </button>
                                    </div>
                                    {store.preferences.difficulty !== null && (
                                        <input type="range" min={0} max={100} value={Math.round(store.preferences.difficulty * 100)}
                                            onChange={(e) => store.setPreferences({ difficulty: parseInt(e.target.value) / 100 })}
                                            className="w-full h-1" style={{ accentColor: "var(--terra)" }} />
                                    )}
                                </div>

                                {/* Content Mix */}
                                <div>
                                    <span className="text-xs font-medium mb-2.5 block" style={{ color: "var(--ink-light)" }}>Content Mix</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
                                            <button key={key} onClick={() => store.setPreferences({ contentMix: { ...PRESETS[key] } })}
                                                className={cn("pill px-3 py-1.5 rounded-lg text-xs", activePreset === key && "pill-active")}>
                                                {PRESET_LABELS[key]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Question Style */}
                                <div>
                                    <span className="text-xs font-medium mb-2.5 block" style={{ color: "var(--ink-light)" }}>Question Style</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {STYLES.map((label, i) => (
                                            <button key={label} onClick={() => store.setPreferences({ questionStyle: STYLE_VALUES[i] ?? null })}
                                                className={cn("pill px-3 py-1.5 rounded-lg text-xs", store.preferences.questionStyle === STYLE_VALUES[i] && "pill-active")}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rule" />

                    {/* CTA */}
                    <button
                        onClick={handleStart}
                        disabled={!store.topicInput.trim() || store.isLoading || isProcessingFile}
                        className="w-full py-4 rounded-xl text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        style={{ background: "var(--terra)" }}
                    >
                        {store.isLoading ? "Preparing your session..." : (
                            <span className="flex items-center justify-center gap-2">
                                Begin Studying <ArrowRight className="w-4 h-4" />
                            </span>
                        )}
                    </button>

                    {store.error && (
                        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(220,38,38,0.06)", color: "#B91C1C", border: "1px solid rgba(220,38,38,0.15)" }}>
                            {store.error}
                        </div>
                    )}

                    {/* Quick picks */}
                    <div className="space-y-3">
                        <span className="section-label">Popular Topics</span>
                        <div className="flex flex-wrap gap-2">
                            {["AP Biology", "Organic Chemistry", "Linear Algebra", "JavaScript", "World History"].map((t) => (
                                <button key={t} onClick={() => store.setTopicInput(t)} className="pill px-3.5 py-1.5 rounded-lg text-xs">
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer rule */}
                    <div className="pt-4">
                        <div className="rule" />
                        <p className="text-center mt-4 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                            Powered by Quizly AI &mdash; adaptive learning
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

/**
 * Design C: "Neon Arcade"
 *
 * Aesthetic: Retro-futuristic gaming terminal. Neon glows on deep black.
 * Feels like booting up a learning game. High energy, addictive.
 *
 * Key choices:
 * - Near-black background with subtle grid pattern
 * - Neon cyan + hot pink + lime accents
 * - JetBrains Mono for labels (monospace terminal feel)
 * - Sora for headings (clean geometric futuristic)
 * - Glowing borders and neon box-shadows
 * - Equalizer-style tune controls
 * - "LAUNCH" instead of "Start", game language throughout
 */

import { useState, useCallback } from "react";
import { Sora, JetBrains_Mono } from "next/font/google";
import {
    Upload, BookOpen, ChevronDown, ChevronUp, Play, Crosshair,
    Gauge, Layers, Wand2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useScrollSessionStore, PRESETS, DEFAULT_PREFERENCES } from "~/stores/scrollSessionStore";
import type { FeedPreferences } from "~/stores/scrollSessionStore";
import { scrollApi, curriculumApi } from "~/lib/api";
import { useAuth } from "~/lib/auth";
import { useRouter } from "next/navigation";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

type PresetKey = "QUIZ_HEAVY" | "BALANCED" | "FLASHCARD_FOCUS";
const PRESET_LABELS: Record<PresetKey, string> = { QUIZ_HEAVY: "QUIZ", BALANCED: "MIX", FLASHCARD_FOCUS: "CARDS" };

function getActivePreset(mix: FeedPreferences["contentMix"]): PresetKey | null {
    for (const [key, preset] of Object.entries(PRESETS)) {
        if (Math.abs(mix.mcq - preset.mcq) < 0.01 && Math.abs(mix.flashcard - preset.flashcard) < 0.01) return key as PresetKey;
    }
    return null;
}

const STYLES = ["ANY", "CONCEPT", "APPLY", "ANALYZE", "TRANSFER"] as const;
const STYLE_VALUES = [null, "conceptual", "application", "analysis", "transfer"] as const;

export default function DesignCPage() {
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
            const studentName = auth.user?.name || "Student";
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
        <div className={cn(sora.variable, mono.variable)} style={{ fontFamily: "var(--font-sora), system-ui, sans-serif" }}>
            <style>{`
                :root {
                    --neon-cyan: #00F5FF;
                    --neon-pink: #FF2D78;
                    --neon-lime: #B8FF00;
                    --dark-bg: #08080C;
                    --dark-card: #0E0E14;
                    --dark-border: #1A1A24;
                    --grid-color: rgba(0,245,255,0.03);
                }
                .neon-grid {
                    background-image:
                        linear-gradient(var(--grid-color) 1px, transparent 1px),
                        linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
                    background-size: 40px 40px;
                }
                .neon-input {
                    background: var(--dark-card);
                    border: 1px solid var(--dark-border);
                    color: #E8E8EE;
                    padding: 14px 16px;
                    font-size: 15px;
                    border-radius: 8px;
                    outline: none;
                    font-family: var(--font-sora), system-ui, sans-serif;
                    transition: all 0.2s;
                    width: 100%;
                }
                .neon-input::placeholder {
                    color: #3A3A48;
                    font-family: var(--font-mono), monospace;
                    font-size: 13px;
                }
                .neon-input:focus {
                    border-color: var(--neon-cyan);
                    box-shadow: 0 0 0 2px rgba(0,245,255,0.1), 0 0 20px rgba(0,245,255,0.05);
                }
                .neon-card {
                    background: var(--dark-card);
                    border: 1px solid var(--dark-border);
                    border-radius: 12px;
                }
                .tag {
                    font-family: var(--font-mono), monospace;
                    font-size: 10px;
                    letter-spacing: 0.08em;
                    padding: 6px 12px;
                    border-radius: 6px;
                    background: transparent;
                    border: 1px solid var(--dark-border);
                    color: #4A4A58;
                    transition: all 0.15s;
                    cursor: pointer;
                }
                .tag:hover {
                    border-color: #2A2A38;
                    color: #8A8A98;
                }
                .tag-cyan {
                    border-color: rgba(0,245,255,0.25) !important;
                    color: var(--neon-cyan) !important;
                    background: rgba(0,245,255,0.05) !important;
                    text-shadow: 0 0 10px rgba(0,245,255,0.3);
                }
                .tag-pink {
                    border-color: rgba(255,45,120,0.25) !important;
                    color: var(--neon-pink) !important;
                    background: rgba(255,45,120,0.05) !important;
                }
                .launch-btn {
                    background: var(--neon-cyan);
                    color: #08080C;
                    font-family: var(--font-mono), monospace;
                    font-weight: 700;
                    font-size: 13px;
                    letter-spacing: 0.15em;
                    padding: 16px;
                    border-radius: 10px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    width: 100%;
                    text-transform: uppercase;
                    position: relative;
                    overflow: hidden;
                }
                .launch-btn:hover:not(:disabled) {
                    box-shadow: 0 0 30px rgba(0,245,255,0.25), 0 0 60px rgba(0,245,255,0.1);
                    transform: translateY(-1px);
                }
                .launch-btn:active:not(:disabled) {
                    transform: scale(0.98);
                }
                .launch-btn:disabled {
                    opacity: 0.15;
                    cursor: not-allowed;
                }
                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100vh); }
                }
                .hud-label {
                    font-family: var(--font-mono), monospace;
                    font-size: 9px;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: #3A3A48;
                }
                .eq-bar {
                    height: 4px;
                    border-radius: 2px;
                    transition: all 0.3s;
                }
            `}</style>

            <div className="min-h-screen neon-grid" style={{ background: "var(--dark-bg)" }}>
                {/* Subtle scanline effect */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.015]">
                    <div className="absolute inset-x-0 h-[2px] bg-white" style={{ animation: "scanline 8s linear infinite" }} />
                </div>

                <div className="relative z-10 max-w-md mx-auto px-5 py-12 space-y-6">
                    {/* HUD Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.15)" }}>
                                <Crosshair className="w-5 h-5" style={{ color: "var(--neon-cyan)" }} />
                            </div>
                            <div>
                                <div className="hud-label">System Ready</div>
                                <div className="text-sm font-semibold" style={{ color: "var(--neon-cyan)" }}>QUIZLY_v2</div>
                            </div>
                        </div>
                        <div className="hud-label" style={{ color: "var(--neon-cyan)", opacity: 0.5 }}>
                            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    </div>

                    {/* Divider with dot */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px" style={{ background: "var(--dark-border)" }} />
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--neon-cyan)", boxShadow: "0 0 6px var(--neon-cyan)" }} />
                        <div className="flex-1 h-px" style={{ background: "var(--dark-border)" }} />
                    </div>

                    {/* Title */}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#E8E8EE" }}>
                            Select Target
                        </h1>
                        <p className="text-sm mt-1" style={{ color: "#4A4A58", fontFamily: "var(--font-mono)" }}>
                            // initialize adaptive learning sequence
                        </p>
                    </div>

                    {/* Topic input */}
                    <input
                        type="text"
                        value={store.topicInput}
                        onChange={(e) => store.setTopicInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleStart()}
                        placeholder="> enter_topic"
                        className="neon-input"
                        autoFocus
                    />

                    {/* Upload */}
                    <label className={cn(
                        "neon-card flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all",
                        isProcessingFile && "border-amber-500/30",
                        uploadedFile && "border-green-500/30",
                    )}>
                        <Upload className={cn("w-4 h-4", isProcessingFile ? "text-amber-400 animate-pulse" : uploadedFile ? "text-green-400" : "text-gray-600")} />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: isProcessingFile ? "#FBBF24" : uploadedFile ? "#4ADE80" : "#4A4A58" }}>
                            {isProcessingFile ? "processing..." : uploadedFile ? uploadedFile.name : "upload_materials.pdf"}
                        </span>
                        <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                    </label>

                    {/* Notes */}
                    <button onClick={() => setShowNotes(!showNotes)} className="hud-label flex items-center gap-1.5 hover:text-gray-400 transition-colors">
                        <BookOpen className="w-3 h-3" /> {showNotes ? "hide_notes" : "add_notes --optional"}
                    </button>
                    {showNotes && (
                        <textarea value={store.notesInput} onChange={(e) => store.setNotesInput(e.target.value)}
                            placeholder="// paste study material here..."
                            rows={3} className="neon-input resize-none" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }} />
                    )}

                    {/* Tune Panel */}
                    <div className="neon-card overflow-hidden">
                        <button onClick={() => setShowTune(!showTune)} className="w-full flex items-center justify-between px-4 py-3.5">
                            <span className="flex items-center gap-2">
                                <Gauge className="w-4 h-4" style={{ color: "var(--neon-pink)" }} />
                                <span className="hud-label" style={{ color: "#6A6A78" }}>Configure Feed</span>
                            </span>
                            {showTune ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
                        </button>

                        {showTune && (
                            <div className="px-4 pb-4 space-y-5" style={{ borderTop: "1px solid var(--dark-border)" }}>
                                <div className="pt-4" />

                                {/* Difficulty */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className="hud-label flex items-center gap-1.5">
                                            <Crosshair className="w-3 h-3" style={{ color: "var(--neon-cyan)", opacity: 0.5 }} />
                                            Difficulty
                                        </span>
                                        <button
                                            onClick={() => store.setPreferences({ difficulty: store.preferences.difficulty === null ? 0.5 : null })}
                                            className="tag"
                                            style={store.preferences.difficulty === null ? { borderColor: "rgba(0,245,255,0.3)", color: "var(--neon-cyan)", background: "rgba(0,245,255,0.05)" } : {}}
                                        >
                                            {store.preferences.difficulty === null ? "AUTO" : `LVL ${Math.round((store.preferences.difficulty ?? 0.5) * 100)}`}
                                        </button>
                                    </div>
                                    {store.preferences.difficulty !== null && (
                                        <div className="flex items-center gap-2">
                                            <input type="range" min={0} max={100} value={Math.round(store.preferences.difficulty * 100)}
                                                onChange={(e) => store.setPreferences({ difficulty: parseInt(e.target.value) / 100 })}
                                                className="flex-1 h-1" style={{ accentColor: "var(--neon-cyan)" }} />
                                        </div>
                                    )}
                                </div>

                                {/* Content Mix - Equalizer style */}
                                <div>
                                    <span className="hud-label flex items-center gap-1.5 mb-3">
                                        <Layers className="w-3 h-3" style={{ color: "var(--neon-pink)", opacity: 0.5 }} />
                                        Content Mix
                                    </span>
                                    <div className="flex gap-2">
                                        {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
                                            <button key={key} onClick={() => store.setPreferences({ contentMix: { ...PRESETS[key] } })}
                                                className={cn("tag flex-1 text-center", activePreset === key && "tag-cyan")}>
                                                {PRESET_LABELS[key]}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Mini eq bars */}
                                    <div className="flex items-end gap-3 mt-3 px-2">
                                        {([
                                            { label: "MCQ", value: store.preferences.contentMix.mcq, color: "var(--neon-cyan)" },
                                            { label: "FLASH", value: store.preferences.contentMix.flashcard, color: "var(--neon-pink)" },
                                            { label: "INFO", value: store.preferences.contentMix.info_card, color: "var(--neon-lime)" },
                                        ]).map(({ label, value, color }) => (
                                            <div key={label} className="flex-1">
                                                <div className="h-12 flex items-end rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
                                                    <div className="eq-bar w-full" style={{ height: `${value * 100}%`, background: color, boxShadow: `0 0 8px ${color}40` }} />
                                                </div>
                                                <div className="text-center mt-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.1em", color: "#3A3A48" }}>{label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Question Style */}
                                <div>
                                    <span className="hud-label flex items-center gap-1.5 mb-3">
                                        <Wand2 className="w-3 h-3" style={{ color: "var(--neon-lime)", opacity: 0.5 }} />
                                        Mode
                                    </span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {STYLES.map((label, i) => (
                                            <button key={label} onClick={() => store.setPreferences({ questionStyle: STYLE_VALUES[i] ?? null })}
                                                className={cn("tag", store.preferences.questionStyle === STYLE_VALUES[i] && "tag-pink")}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Launch button */}
                    <button onClick={handleStart} disabled={!store.topicInput.trim() || store.isLoading || isProcessingFile} className="launch-btn">
                        {store.isLoading ? "INITIALIZING..." : (
                            <span className="flex items-center justify-center gap-2">
                                <Play className="w-4 h-4" fill="currentColor" />
                                LAUNCH FEED
                            </span>
                        )}
                    </button>

                    {store.error && (
                        <div className="neon-card px-4 py-3 text-sm" style={{ color: "var(--neon-pink)", borderColor: "rgba(255,45,120,0.2)" }}>
                            {store.error}
                        </div>
                    )}

                    {/* Quick load */}
                    <div className="space-y-3">
                        <span className="hud-label">Quick Load</span>
                        <div className="flex flex-wrap gap-2">
                            {["AP Biology", "Organic Chemistry", "Linear Algebra", "JavaScript", "World History"].map((t) => (
                                <button key={t} onClick={() => store.setTopicInput(t)} className="tag hover:border-gray-600 hover:text-gray-400">
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status bar */}
                    <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--dark-border)" }}>
                        <span className="hud-label">quizly://feed</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--neon-lime)", boxShadow: "0 0 4px var(--neon-lime)" }} />
                            <span className="hud-label" style={{ color: "var(--neon-lime)" }}>Online</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

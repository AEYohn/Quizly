"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "~/lib/utils";
import { useScrollSessionStore, PRESETS, DEFAULT_PREFERENCES } from "~/stores/scrollSessionStore";
import type { FeedPreferences } from "~/stores/scrollSessionStore";

type PresetKey = "QUIZ_HEAVY" | "BALANCED" | "FLASHCARD_FOCUS" | "CUSTOM";

const PRESET_LABELS: Record<PresetKey, string> = {
    QUIZ_HEAVY: "Quiz Heavy",
    BALANCED: "Balanced",
    FLASHCARD_FOCUS: "Flashcard Focus",
    CUSTOM: "Custom",
};

const QUESTION_STYLES = [
    { value: null, label: "Any" },
    { value: "conceptual", label: "Conceptual" },
    { value: "application", label: "Application" },
    { value: "analysis", label: "Analysis" },
    { value: "transfer", label: "Transfer" },
] as const;

function getActivePreset(mix: FeedPreferences["contentMix"]): PresetKey {
    for (const [key, preset] of Object.entries(PRESETS)) {
        if (
            Math.abs(mix.mcq - preset.mcq) < 0.01 &&
            Math.abs(mix.flashcard - preset.flashcard) < 0.01 &&
            Math.abs(mix.info_card - preset.info_card) < 0.01
        ) {
            return key as PresetKey;
        }
    }
    return "CUSTOM";
}

interface FeedTuneControlsProps {
    mode: "start" | "active";
}

export function FeedTuneControls({ mode }: FeedTuneControlsProps) {
    const { preferences, setPreferences } = useScrollSessionStore();
    const [expanded, setExpanded] = useState(mode === "active");
    const [showCustomSliders, setShowCustomSliders] = useState(false);

    const activePreset = getActivePreset(preferences.contentMix);
    const isAutoMode = preferences.difficulty === null;

    const handlePresetSelect = (key: PresetKey) => {
        if (key === "CUSTOM") {
            setShowCustomSliders(true);
            return;
        }
        setShowCustomSliders(false);
        setPreferences({ contentMix: { ...PRESETS[key] } });
    };

    const handleSliderChange = (type: "mcq" | "flashcard" | "info_card", value: number) => {
        const current = { ...preferences.contentMix };
        const oldValue = current[type];
        const delta = value - oldValue;

        // Distribute the delta across other types proportionally
        const otherTypes = (["mcq", "flashcard", "info_card"] as const).filter((t) => t !== type);
        const otherSum = otherTypes.reduce((sum, t) => sum + current[t], 0);

        if (otherSum === 0) return;

        for (const ot of otherTypes) {
            const proportion = current[ot] / otherSum;
            current[ot] = Math.max(0, Math.round((current[ot] - delta * proportion) * 100) / 100);
        }
        current[type] = value;

        // Normalize to ensure sum = 1
        const total = current.mcq + current.flashcard + current.info_card;
        if (total > 0) {
            current.mcq = Math.round((current.mcq / total) * 100) / 100;
            current.flashcard = Math.round((current.flashcard / total) * 100) / 100;
            current.info_card = Math.round((1 - current.mcq - current.flashcard) * 100) / 100;
        }

        setPreferences({ contentMix: current });
    };

    // Start mode: collapsible section
    if (mode === "start" && !expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-900/40 border border-gray-800/40 text-sm text-gray-400 hover:text-gray-300 hover:border-gray-700 transition-colors"
            >
                <span>Tune Your Feed</span>
                <ChevronDown className="w-4 h-4" />
            </button>
        );
    }

    return (
        <div className={cn(
            "space-y-5",
            mode === "start" && "rounded-2xl bg-gray-900/40 border border-gray-800/40 p-4",
        )}>
            {/* Collapse header for start mode */}
            {mode === "start" && (
                <button
                    onClick={() => setExpanded(false)}
                    className="w-full flex items-center justify-between text-sm text-gray-300"
                >
                    <span className="font-medium">Tune Your Feed</span>
                    <ChevronUp className="w-4 h-4" />
                </button>
            )}

            {/* Difficulty */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Difficulty</label>
                    <button
                        onClick={() => setPreferences({ difficulty: isAutoMode ? 0.5 : null })}
                        className={cn(
                            "text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors",
                            isAutoMode
                                ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                : "bg-gray-800 text-gray-500 border border-gray-700",
                        )}
                    >
                        {isAutoMode ? "Auto" : "Manual"}
                    </button>
                </div>
                {!isAutoMode && (
                    <div className="space-y-1">
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round((preferences.difficulty ?? 0.5) * 100)}
                            onChange={(e) => setPreferences({ difficulty: parseInt(e.target.value) / 100 })}
                            className="w-full accent-violet-500 h-1.5"
                        />
                        <div className="flex justify-between text-[10px] text-gray-600">
                            <span>Easy</span>
                            <span>{Math.round((preferences.difficulty ?? 0.5) * 100)}%</span>
                            <span>Challenge</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Mix */}
            <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Content Mix</label>
                <div className="flex gap-2 flex-wrap">
                    {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => (
                        <button
                            key={key}
                            onClick={() => handlePresetSelect(key)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border",
                                (activePreset === key && key !== "CUSTOM") || (key === "CUSTOM" && showCustomSliders)
                                    ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                                    : "bg-gray-800/60 text-gray-400 border-gray-700/50 hover:border-gray-600",
                            )}
                        >
                            {PRESET_LABELS[key]}
                        </button>
                    ))}
                </div>

                {/* Custom sliders */}
                {(showCustomSliders || activePreset === "CUSTOM") && (
                    <div className="mt-3 space-y-2.5">
                        {([
                            { key: "mcq" as const, label: "Quiz Questions", color: "accent-violet-500" },
                            { key: "flashcard" as const, label: "Flashcards", color: "accent-amber-500" },
                            { key: "info_card" as const, label: "Info Cards", color: "accent-sky-500" },
                        ]).map(({ key, label, color }) => (
                            <div key={key} className="flex items-center gap-3">
                                <span className="text-[11px] text-gray-500 w-24 shrink-0">{label}</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={Math.round(preferences.contentMix[key] * 100)}
                                    onChange={(e) => handleSliderChange(key, parseInt(e.target.value) / 100)}
                                    className={cn("flex-1 h-1.5", color)}
                                />
                                <span className="text-[11px] text-gray-500 w-8 text-right tabular-nums">
                                    {Math.round(preferences.contentMix[key] * 100)}%
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Question Style */}
            <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Question Style</label>
                <div className="flex gap-1.5 flex-wrap">
                    {QUESTION_STYLES.map(({ value, label }) => (
                        <button
                            key={label}
                            onClick={() => setPreferences({ questionStyle: value })}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border",
                                preferences.questionStyle === value
                                    ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                                    : "bg-gray-800/60 text-gray-400 border-gray-700/50 hover:border-gray-600",
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Reset */}
            {(preferences.difficulty !== null ||
              activePreset !== "BALANCED" ||
              preferences.questionStyle !== null) && (
                <button
                    onClick={() => setPreferences({ ...DEFAULT_PREFERENCES })}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                    Reset to defaults
                </button>
            )}
        </div>
    );
}

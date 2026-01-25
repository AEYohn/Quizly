"use client";

import { useState, useEffect } from "react";

interface ConfidenceSliderProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    showLabels?: boolean;
    size?: "sm" | "md" | "lg";
}

const confidenceLevels = [
    { min: 0, max: 25, label: "Just guessing", emoji: "🤔", color: "from-red-400 to-red-500" },
    { min: 26, max: 50, label: "Not sure", emoji: "😕", color: "from-orange-400 to-orange-500" },
    { min: 51, max: 75, label: "Fairly confident", emoji: "🙂", color: "from-yellow-400 to-yellow-500" },
    { min: 76, max: 100, label: "Very confident", emoji: "😎", color: "from-green-400 to-green-500" },
];

function getConfidenceLevel(value: number) {
    return confidenceLevels.find(level => value >= level.min && value <= level.max) ?? confidenceLevels[0]!;
}

export default function ConfidenceSlider({
    value,
    onChange,
    disabled = false,
    showLabels = true,
    size = "md"
}: ConfidenceSliderProps) {
    const [localValue, setLocalValue] = useState(value);
    const level = getConfidenceLevel(localValue);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (newValue: number) => {
        setLocalValue(newValue);
        onChange(newValue);
    };

    const sizeClasses = {
        sm: "h-2",
        md: "h-3",
        lg: "h-4"
    };

    const thumbSize = {
        sm: "w-4 h-4",
        md: "w-6 h-6",
        lg: "w-8 h-8"
    };

    return (
        <div className="w-full">
            {/* Confidence level display */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{level.emoji}</span>
                    <span className="font-medium text-white/90">{level.label}</span>
                </div>
                <span className={`font-bold text-lg px-3 py-1 rounded-full bg-gradient-to-r ${level.color}`}>
                    {localValue}%
                </span>
            </div>

            {/* Slider container */}
            <div className="relative">
                {/* Background track */}
                <div className={`w-full ${sizeClasses[size]} rounded-full bg-white/20 overflow-hidden`}>
                    {/* Filled portion */}
                    <div
                        className={`h-full rounded-full bg-gradient-to-r ${level.color} transition-all duration-150`}
                        style={{ width: `${localValue}%` }}
                    />
                </div>

                {/* Actual slider input */}
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={localValue}
                    onChange={(e) => handleChange(parseInt(e.target.value))}
                    disabled={disabled}
                    className={`absolute inset-0 w-full opacity-0 cursor-pointer ${disabled ? "cursor-not-allowed" : ""}`}
                    style={{ height: "100%" }}
                />

                {/* Custom thumb indicator */}
                <div
                    className={`absolute top-1/2 -translate-y-1/2 ${thumbSize[size]} rounded-full bg-white shadow-lg border-2 border-white/50 transition-all duration-150 pointer-events-none`}
                    style={{ left: `calc(${localValue}% - ${size === "sm" ? "8px" : size === "md" ? "12px" : "16px"})` }}
                />
            </div>

            {/* Labels below slider */}
            {showLabels && (
                <div className="flex justify-between mt-2 text-xs text-white/60">
                    <span>Guessing</span>
                    <span>Very Sure</span>
                </div>
            )}
        </div>
    );
}

// Compact version for inline use
export function ConfidenceSliderCompact({
    value,
    onChange,
    disabled = false
}: Omit<ConfidenceSliderProps, "showLabels" | "size">) {
    const level = getConfidenceLevel(value);

    return (
        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2">
            <span className="text-lg">{level.emoji}</span>
            <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                disabled={disabled}
                className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="font-medium text-white min-w-[3rem] text-right">{value}%</span>
        </div>
    );
}

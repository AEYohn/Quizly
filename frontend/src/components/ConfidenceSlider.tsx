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
    { value: 25, label: "Guessing", emoji: "🎲", color: "bg-red-500", hoverColor: "hover:bg-red-400", ringColor: "ring-red-400" },
    { value: 50, label: "Not sure", emoji: "🤔", color: "bg-orange-500", hoverColor: "hover:bg-orange-400", ringColor: "ring-orange-400" },
    { value: 75, label: "Pretty sure", emoji: "🙂", color: "bg-yellow-500", hoverColor: "hover:bg-yellow-400", ringColor: "ring-yellow-400" },
    { value: 100, label: "Certain", emoji: "😎", color: "bg-green-500", hoverColor: "hover:bg-green-400", ringColor: "ring-green-400" },
];

function getConfidenceLevel(value: number) {
    // Find the closest level
    return confidenceLevels.reduce((prev, curr) =>
        Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
    );
}

export default function ConfidenceSlider({
    value,
    onChange,
    disabled = false,
}: ConfidenceSliderProps) {
    const [selected, setSelected] = useState(() => getConfidenceLevel(value));

    useEffect(() => {
        setSelected(getConfidenceLevel(value));
    }, [value]);

    const handleSelect = (level: typeof confidenceLevels[0]) => {
        if (disabled) return;
        setSelected(level);
        onChange(level.value);
    };

    return (
        <div className="w-full">
            {/* Button grid */}
            <div className="grid grid-cols-4 gap-2">
                {confidenceLevels.map((level) => {
                    const isSelected = selected.value === level.value;
                    return (
                        <button
                            key={level.value}
                            onClick={() => handleSelect(level)}
                            disabled={disabled}
                            className={`
                                flex flex-col items-center justify-center p-3 rounded-xl
                                transition-all duration-200
                                ${isSelected
                                    ? `${level.color} ring-2 ${level.ringColor} ring-offset-2 ring-offset-gray-900 scale-105`
                                    : `bg-white/10 ${level.hoverColor} hover:bg-opacity-20`
                                }
                                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                            `}
                        >
                            <span className="text-2xl mb-1">{level.emoji}</span>
                            <span className={`text-xs font-medium ${isSelected ? "text-white" : "text-white/80"}`}>
                                {level.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// Compact version for inline use
export function ConfidenceSliderCompact({
    value,
    onChange,
    disabled = false
}: Omit<ConfidenceSliderProps, "showLabels" | "size">) {
    const selected = getConfidenceLevel(value);

    return (
        <div className="flex items-center gap-2">
            {confidenceLevels.map((level) => {
                const isSelected = selected.value === level.value;
                return (
                    <button
                        key={level.value}
                        onClick={() => !disabled && onChange(level.value)}
                        disabled={disabled}
                        className={`
                            p-2 rounded-lg transition-all
                            ${isSelected
                                ? `${level.color} ring-2 ${level.ringColor}`
                                : "bg-white/10 hover:bg-white/20"
                            }
                            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        `}
                        title={level.label}
                    >
                        <span className="text-lg">{level.emoji}</span>
                    </button>
                );
            })}
        </div>
    );
}

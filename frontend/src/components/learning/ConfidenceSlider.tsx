"use client";

import { cn } from "~/lib/utils";

interface ConfidenceSliderProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}

const levels = [
    { value: 25, label: "Guessing", color: "bg-red-500", ring: "ring-red-400" },
    { value: 50, label: "Not sure", color: "bg-orange-500", ring: "ring-orange-400" },
    { value: 75, label: "Pretty sure", color: "bg-yellow-500", ring: "ring-yellow-400" },
    { value: 100, label: "Certain", color: "bg-green-500", ring: "ring-green-400" },
];

export function ConfidenceSlider({ value, onChange, disabled }: ConfidenceSliderProps) {
    const closest = levels.reduce((prev, curr) =>
        Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
    );

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Confidence</span>
                <span className="font-medium text-gray-200">{closest.label}</span>
            </div>
            <div className="flex gap-2">
                {levels.map((level) => (
                    <button
                        key={level.value}
                        onClick={() => onChange(level.value)}
                        disabled={disabled}
                        className={cn(
                            "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                            value === level.value
                                ? `${level.color} text-white ring-2 ${level.ring}`
                                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        )}
                    >
                        {level.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

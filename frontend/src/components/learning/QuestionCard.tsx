"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";
import type { QuestionData } from "~/stores/learningSessionStore";

interface QuestionCardProps {
    question: QuestionData;
    onAnswer: (answer: string) => void;
    disabled?: boolean;
    showResult?: {
        isCorrect: boolean;
        correctAnswer: string;
        explanation: string;
    };
}

export function QuestionCard({ question, onAnswer, disabled, showResult }: QuestionCardProps) {
    const [selected, setSelected] = useState<string | null>(null);

    const handleSelect = (letter: string) => {
        if (disabled || showResult) return;
        setSelected(letter);
    };

    const handleSubmit = () => {
        if (!selected || disabled) return;
        onAnswer(selected);
    };

    const getOptionLetter = (option: string): string => {
        const match = option.match(/^([A-D])[.)]\s*/);
        return match?.[1] ?? option[0] ?? "A";
    };

    const getOptionText = (option: string): string => {
        return option.replace(/^[A-D][.)]\s*/, "");
    };

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                    {question.concept}
                </span>
                <span className="text-xs text-gray-500">
                    Difficulty: {Math.round(question.difficulty * 100)}%
                </span>
            </div>

            <p className="text-gray-100 text-sm leading-relaxed font-medium">
                {question.prompt}
            </p>

            <div className="space-y-2">
                {question.options.map((option) => {
                    const letter = getOptionLetter(option);
                    const text = getOptionText(option);
                    const isSelected = selected === letter;
                    const isCorrectOption = showResult && letter === showResult.correctAnswer;
                    const isWrongSelected = showResult && isSelected && !showResult.isCorrect;

                    return (
                        <button
                            key={letter}
                            onClick={() => handleSelect(letter)}
                            disabled={disabled || !!showResult}
                            className={cn(
                                "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all",
                                "hover:border-sky-500/50 hover:bg-sky-500/5",
                                !showResult && isSelected && "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500",
                                !showResult && !isSelected && "border-gray-700 bg-gray-800/30",
                                isCorrectOption && "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500",
                                isWrongSelected && "border-red-500 bg-red-500/10 ring-1 ring-red-500",
                                (disabled || !!showResult) && "cursor-default hover:border-gray-700 hover:bg-transparent"
                            )}
                        >
                            <span className="font-semibold text-gray-400 mr-2">{letter}.</span>
                            <span className="text-gray-200">{text}</span>
                        </button>
                    );
                })}
            </div>

            {!showResult && (
                <button
                    onClick={handleSubmit}
                    disabled={!selected || disabled}
                    className="w-full py-2.5 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    Submit Answer
                </button>
            )}

            {showResult && (
                <div
                    className={cn(
                        "rounded-xl p-3 text-sm",
                        showResult.isCorrect
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                            : "bg-red-500/10 border border-red-500/30 text-red-300"
                    )}
                >
                    <div className="font-medium mb-1">
                        {showResult.isCorrect ? "Correct!" : `Incorrect — the answer is ${showResult.correctAnswer}`}
                    </div>
                    {showResult.explanation && (
                        <div className="text-gray-300 text-xs">{showResult.explanation}</div>
                    )}
                </div>
            )}
        </div>
    );
}

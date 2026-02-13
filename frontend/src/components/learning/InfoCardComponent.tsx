"use client";

import { useState } from "react";
import { BookOpen, Zap, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ScrollCard } from "~/lib/api";

interface InfoCardComponentProps {
    card: ScrollCard;
    onGotIt: () => void;
    onNext: () => void;
    xpAwarded: boolean;
}

/**
 * Render markdown-lite text with **bold** and bullet points.
 */
function InfoBody({ text }: { text: string }) {
    const lines = text.split("\n");
    return (
        <div className="space-y-2">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
                const content = isBullet ? trimmed.slice(2) : trimmed;

                // Render **bold** segments
                const parts = content.split(/(\*\*[^*]+\*\*)/g);
                const rendered = parts.map((part, j) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                        return (
                            <span key={j} className="font-semibold text-gray-100">
                                {part.slice(2, -2)}
                            </span>
                        );
                    }
                    return <span key={j}>{part}</span>;
                });

                if (isBullet) {
                    return (
                        <div key={i} className="flex gap-2 pl-1">
                            <span className="text-teal-400 shrink-0 mt-0.5">&#8226;</span>
                            <span className="text-sm text-gray-300 leading-relaxed">{rendered}</span>
                        </div>
                    );
                }

                return (
                    <p key={i} className="text-sm text-gray-300 leading-relaxed">
                        {rendered}
                    </p>
                );
            })}
        </div>
    );
}

export function InfoCardComponent({ card, onGotIt, onNext, xpAwarded }: InfoCardComponentProps) {
    const [acknowledged, setAcknowledged] = useState(false);

    const title = card.info_title ?? "";
    const body = card.info_body ?? "";
    const takeaway = card.info_takeaway ?? "";

    const handleGotIt = () => {
        if (acknowledged) return;
        setAcknowledged(true);
        onGotIt();
    };

    return (
        <div className="h-full w-full flex flex-col px-5 pt-4 pb-5 overflow-y-auto">
            {/* Concept + type badge */}
            <div className="flex items-center gap-2 mb-5 shrink-0">
                <span className="flex items-center gap-1 text-[11px] font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                    <BookOpen className="w-3 h-3" />
                    Insight
                </span>
                <span className="text-[11px] font-medium text-gray-500 tracking-wide uppercase">
                    {card.concept}
                </span>
            </div>

            {/* Title */}
            {title && (
                <h3 className="text-lg font-semibold text-gray-100 mb-4 shrink-0">
                    {title}
                </h3>
            )}

            {/* Body */}
            <div className="flex-1 min-h-0 mb-4">
                <div className="rounded-2xl border border-gray-800/60 bg-gray-900/40 p-5">
                    <InfoBody text={body} />
                </div>
            </div>

            {/* Key takeaway */}
            {takeaway && (
                <div className="rounded-xl bg-teal-500/5 border border-teal-500/15 px-4 py-3 mb-4 shrink-0">
                    <div className="flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-teal-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-teal-300/90 leading-relaxed">
                            {takeaway}
                        </p>
                    </div>
                </div>
            )}

            {/* Got it / Next */}
            {!acknowledged ? (
                <button
                    onClick={handleGotIt}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-500 active:scale-[0.98] transition-all shrink-0"
                >
                    Got it
                </button>
            ) : (
                <div className="space-y-3 shrink-0">
                    {xpAwarded && (
                        <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-sm">
                            <Zap className="w-4 h-4" />
                            +5 XP
                        </div>
                    )}
                    <button
                        onClick={onNext}
                        className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-gray-800 text-gray-200 hover:bg-gray-700 active:scale-[0.98] transition-all"
                    >
                        <span className="flex items-center justify-center gap-2">
                            Continue
                            <ArrowRight className="w-4 h-4" />
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

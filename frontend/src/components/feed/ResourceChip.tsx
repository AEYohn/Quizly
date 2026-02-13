"use client";

import { useCallback } from "react";
import { Play, FileText, BookOpen } from "lucide-react";
import { cn } from "~/lib/utils";

interface ResourceChipProps {
    title: string;
    url: string;
    sourceType: string;
    domain?: string;
}

const SOURCE_ICONS: Record<string, typeof Play> = {
    video: Play,
    article: FileText,
    tutorial: BookOpen,
};

function truncateTitle(title: string, maxLength = 20): string {
    if (title.length <= maxLength) return title;
    return title.slice(0, maxLength - 1).trimEnd() + "\u2026";
}

export function ResourceChip({ title, url, sourceType, domain }: ResourceChipProps) {
    const Icon = SOURCE_ICONS[sourceType] ?? FileText;

    const handleClick = useCallback(() => {
        window.open(url, "_blank", "noopener,noreferrer");
    }, [url]);

    return (
        <button
            onClick={handleClick}
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                "bg-teal-500/10 border border-teal-500/20",
                "text-[11px] font-medium text-teal-300",
                "hover:bg-teal-500/15 hover:border-teal-500/30",
                "active:scale-[0.97]",
                "transition-all duration-150 ease-out",
                "cursor-pointer select-none",
            )}
        >
            <Icon className="w-3 h-3 shrink-0 text-teal-400" />

            <span className="truncate max-w-[120px] leading-tight">
                {truncateTitle(title)}
            </span>

            {domain && (
                <span className="shrink-0 text-[9px] font-medium text-teal-400/60 bg-teal-500/10 rounded px-1 py-px">
                    {domain}
                </span>
            )}
        </button>
    );
}

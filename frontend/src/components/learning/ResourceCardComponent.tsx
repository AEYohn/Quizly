"use client";

import { useState } from "react";
import {
    ExternalLink,
    Bookmark,
    SkipForward,
    Play,
    Globe,
    Zap,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { ScrollCard } from "~/lib/api";

interface ResourceCardComponentProps {
    card: ScrollCard;
    onNext: () => void;
    onOpen?: (card: ScrollCard) => void;
    onSave?: (card: ScrollCard) => void;
}

const XP_OPEN = 5;
const XP_SAVE = 3;

export function ResourceCardComponent({
    card,
    onNext,
    onOpen,
    onSave,
}: ResourceCardComponentProps) {
    const [opened, setOpened] = useState(false);
    const [saved, setSaved] = useState(false);
    const [xpGained, setXpGained] = useState(0);

    const resourceType = card.resource_type ?? "article";
    const title = card.resource_title ?? card.prompt;
    const url = card.resource_url ?? "#";
    const description = card.resource_description ?? "";
    const thumbnail = card.resource_thumbnail;
    const channel = card.resource_channel;
    const duration = card.resource_duration;
    const domain = card.resource_domain;

    const isVideo = resourceType === "video";

    const handleOpen = () => {
        window.open(url, "_blank", "noopener,noreferrer");
        if (!opened) {
            setOpened(true);
            setXpGained((prev) => prev + XP_OPEN);
        }
        onOpen?.(card);
    };

    const handleSave = () => {
        if (saved) return;
        setSaved(true);
        setXpGained((prev) => prev + XP_SAVE);
        onSave?.(card);
    };

    const typeBadge = {
        video: {
            label: "Video",
            color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
            Icon: Play,
        },
        article: {
            label: "Article",
            color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
            Icon: Globe,
        },
        tutorial: {
            label: "Tutorial",
            color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            Icon: Globe,
        },
    }[resourceType] ?? {
        label: "Resource",
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        Icon: Globe,
    };

    return (
        <div className="h-full w-full flex flex-col px-5 pt-4 pb-5 overflow-y-auto">
            {/* Concept + type badge */}
            <div className="flex items-center gap-2 mb-5 shrink-0">
                <span
                    className={cn(
                        "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border",
                        typeBadge.color,
                    )}
                >
                    <typeBadge.Icon className="w-3 h-3" />
                    {typeBadge.label}
                </span>
                <span className="text-[11px] font-medium text-gray-500 tracking-wide uppercase">
                    {card.concept}
                </span>
            </div>

            {/* Resource content */}
            <div className="flex-1 min-h-0 flex flex-col gap-4 mb-4">
                {/* Video thumbnail / Article domain header */}
                {isVideo && thumbnail ? (
                    <button
                        onClick={handleOpen}
                        className="relative rounded-2xl overflow-hidden border border-gray-800/60 group shrink-0"
                    >
                        <img
                            src={thumbnail}
                            alt={title}
                            className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/30">
                            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                            </div>
                        </div>
                        {/* Duration badge */}
                        {duration && (
                            <span className="absolute bottom-2 right-2 text-[11px] font-medium text-white bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md">
                                {duration}
                            </span>
                        )}
                    </button>
                ) : (
                    /* Article / Tutorial header with domain */
                    <div className="rounded-2xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 p-5 shrink-0">
                        {domain && (
                            <div className="flex items-center gap-1.5 mb-3">
                                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-xs font-medium text-indigo-400 truncate">
                                    {domain}
                                </span>
                            </div>
                        )}
                        {description && (
                            <p className="text-sm text-gray-400 leading-relaxed line-clamp-4">
                                {description}
                            </p>
                        )}
                    </div>
                )}

                {/* Title */}
                <h3 className="text-lg font-semibold text-gray-100 leading-snug shrink-0">
                    {title}
                </h3>

                {/* Video meta: channel + description */}
                {isVideo && (
                    <div className="space-y-2 shrink-0">
                        {channel && (
                            <span className="text-xs font-medium text-gray-400">
                                {channel}
                            </span>
                        )}
                        {description && (
                            <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">
                                {description}
                            </p>
                        )}
                    </div>
                )}

                {/* Non-video description (shown inside header above, but also below title for tutorial) */}
                {!isVideo && !domain && description && (
                    <p className="text-sm text-gray-400 leading-relaxed line-clamp-4 shrink-0">
                        {description}
                    </p>
                )}
            </div>

            {/* XP indicator */}
            {xpGained > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-sm mb-3 shrink-0">
                    <Zap className="w-4 h-4" />
                    +{xpGained} XP
                </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2.5 shrink-0">
                {/* Open button */}
                <button
                    onClick={handleOpen}
                    className={cn(
                        "w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]",
                        opened
                            ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                            : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20",
                    )}
                >
                    <span className="flex items-center justify-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        {opened ? "Opened" : `Open ${typeBadge.label}`}
                        {!opened && (
                            <span className="text-[10px] text-indigo-200/70 font-normal">
                                +{XP_OPEN} XP
                            </span>
                        )}
                    </span>
                </button>

                {/* Save + Skip row */}
                <div className="flex gap-2.5">
                    <button
                        onClick={handleSave}
                        className={cn(
                            "flex-1 py-3 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98]",
                            saved
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                : "border-gray-700/60 bg-gray-800/40 text-gray-300 hover:border-gray-600 hover:bg-gray-800/60",
                        )}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <Bookmark
                                className={cn("w-4 h-4", saved && "fill-amber-400")}
                            />
                            {saved ? "Saved" : "Save"}
                            {!saved && (
                                <span className="text-[10px] text-gray-500 font-normal">
                                    +{XP_SAVE} XP
                                </span>
                            )}
                        </span>
                    </button>

                    <button
                        onClick={onNext}
                        className="flex-1 py-3 rounded-2xl text-sm font-medium border border-gray-700/60 bg-gray-800/40 text-gray-300 hover:border-gray-600 hover:bg-gray-800/60 transition-all active:scale-[0.98]"
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <SkipForward className="w-4 h-4" />
                            Skip
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}

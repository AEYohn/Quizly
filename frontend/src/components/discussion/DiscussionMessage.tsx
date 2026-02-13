"use client";

import { cn } from "~/lib/utils";

interface DiscussionMessageProps {
    role: "ai" | "student";
    content: string;
    peerName?: string;
}

export function DiscussionMessage({ role, content, peerName }: DiscussionMessageProps) {
    const isAi = role === "ai";

    return (
        <div className={cn("flex", isAi ? "justify-start" : "justify-end")}>
            <div
                className={cn(
                    "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm",
                    isAi
                        ? "bg-teal-500/10 border border-teal-500/30 text-gray-200"
                        : "bg-sky-600/80 text-white"
                )}
            >
                {isAi && peerName && (
                    <div className="text-xs text-teal-400 font-medium mb-1">{peerName}</div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{content}</div>
            </div>
        </div>
    );
}

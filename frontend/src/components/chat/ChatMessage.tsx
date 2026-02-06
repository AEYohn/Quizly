"use client";

import { cn } from "~/lib/utils";

interface ChatMessageProps {
    role: "ai" | "student" | "system";
    content: string;
    agent?: string;
    timestamp?: number;
    children?: React.ReactNode;
}

const agentLabels: Record<string, string> = {
    plan: "Planner",
    quiz: "Quiz",
    assess: "Assessment",
    teach: "Tutor",
    discuss: "Study Buddy",
    refine: "Coach",
};

export function ChatMessage({ role, content, agent, children }: ChatMessageProps) {
    const isAi = role === "ai";
    const isSystem = role === "system";

    return (
        <div
            className={cn(
                "flex w-full",
                isAi ? "justify-start" : "justify-end",
                isSystem && "justify-center"
            )}
        >
            <div
                className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3",
                    isAi && "bg-gray-800 border border-gray-700 text-gray-100",
                    role === "student" && "bg-sky-600 text-white",
                    isSystem && "bg-gray-900 border border-gray-800 text-gray-400 text-sm max-w-[95%]"
                )}
            >
                {isAi && agent && (
                    <div className="text-xs text-sky-400 font-medium mb-1">
                        {agentLabels[agent] || agent}
                    </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {content.split("**").map((part, i) =>
                        i % 2 === 1 ? (
                            <strong key={i} className="font-semibold">
                                {part}
                            </strong>
                        ) : (
                            <span key={i}>{part}</span>
                        )
                    )}
                </div>
                {children}
            </div>
        </div>
    );
}

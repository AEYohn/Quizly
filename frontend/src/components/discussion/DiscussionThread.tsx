"use client";

import { useState } from "react";
import { DiscussionMessage } from "./DiscussionMessage";
import { PhaseIndicator } from "./PhaseIndicator";
import { HintButton } from "./HintButton";
import { ChatInput } from "~/components/chat/ChatInput";

interface Message {
    role: "ai" | "student";
    content: string;
}

interface DiscussionThreadProps {
    messages: Message[];
    phase: string | null;
    peerName?: string;
    hintsUsed?: number;
    onSendMessage: (message: string) => void;
    onRequestHint: () => void;
    disabled?: boolean;
}

export function DiscussionThread({
    messages,
    phase,
    peerName = "Alex",
    hintsUsed = 0,
    onSendMessage,
    onRequestHint,
    disabled,
}: DiscussionThreadProps) {
    return (
        <div className="bg-gray-800/30 border border-gray-700 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs text-indigo-400 font-bold">
                        {peerName[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-200">{peerName}</span>
                    <span className="text-xs text-gray-500">Study Buddy</span>
                </div>
                <div className="flex items-center gap-2">
                    <PhaseIndicator phase={phase} />
                    <HintButton onClick={onRequestHint} hintsUsed={hintsUsed} disabled={disabled} />
                </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                {messages.map((msg, i) => (
                    <DiscussionMessage
                        key={i}
                        role={msg.role}
                        content={msg.content}
                        peerName={msg.role === "ai" ? peerName : undefined}
                    />
                ))}
            </div>

            <ChatInput
                onSend={onSendMessage}
                placeholder="Reply to your study buddy..."
                disabled={disabled}
            />
        </div>
    );
}

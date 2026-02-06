"use client";

import { X } from "lucide-react";
import type { ScrollCard } from "~/lib/api";
import { useSocraticHelp } from "~/hooks/feed/useSocraticHelp";
import { ChatContainer } from "~/components/chat/ChatContainer";
import { ChatMessage } from "~/components/chat/ChatMessage";
import { ChatInput } from "~/components/chat/ChatInput";
import { AiThinkingIndicator } from "~/components/chat/AiThinkingIndicator";

export function SocraticOverlay({ card, sessionId, onClose }: { card: ScrollCard; sessionId: string; onClose: () => void }) {
    const { messages, isLoading, showReadyButton, sendMessage } = useSocraticHelp(card, sessionId);

    return (
        <div className="fixed inset-0 z-50 bg-gray-950/98 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60 shrink-0">
                <div className="min-w-0">
                    <h2 className="text-sm font-bold text-gray-100 truncate">Help: {card.concept}</h2>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{card.prompt.slice(0, 60)}...</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 text-gray-400 transition-colors shrink-0 ml-3">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <ChatContainer>
                {messages.map((msg, i) => (
                    <ChatMessage key={i} role={msg.role === "ai" ? "ai" : "student"} content={msg.content} agent={msg.role === "ai" ? "teach" : undefined} />
                ))}
                {isLoading && <AiThinkingIndicator />}
            </ChatContainer>
            {showReadyButton && (
                <div className="px-4 pb-2 shrink-0">
                    <button onClick={onClose} className="w-full py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 active:scale-[0.98] transition-all">
                        I&apos;m ready to try answering
                    </button>
                </div>
            )}
            <div className="shrink-0">
                <ChatInput onSend={sendMessage} placeholder="Ask a question or share your thinking..." disabled={isLoading} />
            </div>
        </div>
    );
}

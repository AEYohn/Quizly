"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { scrollApi } from "~/lib/api";
import type { ScrollCard } from "~/lib/api";

export function useSocraticHelp(card: ScrollCard, sessionId: string) {
    const [messages, setMessages] = useState<{ role: "ai" | "student"; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [readyToTry, setReadyToTry] = useState(false);

    const sendMessage = useCallback(
        async (text: string) => {
            setMessages((prev) => [...prev, { role: "student", content: text }]);
            setIsLoading(true);
            try {
                const res = await scrollApi.sendHelpMessage(sessionId, text, {
                    prompt: card.prompt,
                    concept: card.concept,
                    options: card.options,
                });
                if (res.success) {
                    setMessages((prev) => [...prev, { role: "ai", content: res.data.message }]);
                    setReadyToTry(res.data.ready_to_try);
                }
            } catch {
                setMessages((prev) => [...prev, { role: "ai", content: "Something went wrong. Try again?" }]);
            } finally {
                setIsLoading(false);
            }
        },
        [sessionId, card.prompt, card.concept, card.options],
    );

    const hasSentInitial = useRef(false);
    useEffect(() => {
        if (!hasSentInitial.current) {
            hasSentInitial.current = true;
            sendMessage("I don't know how to approach this question.");
        }
    }, [sendMessage]);

    const showReadyButton = readyToTry || messages.filter((m) => m.role === "student").length >= 3;

    return {
        messages,
        isLoading,
        readyToTry,
        showReadyButton,
        sendMessage,
    };
}

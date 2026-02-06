"use client";

import { useRef, useEffect } from "react";

interface ChatContainerProps {
    children: React.ReactNode;
}

export function ChatContainer({ children }: ChatContainerProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [children]);

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
            {children}
            <div ref={bottomRef} />
        </div>
    );
}

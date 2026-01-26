"use client";

import { useMemo } from "react";
import MathText from "./MathText";
import { MermaidDiagram } from "./MermaidDiagram";

interface RichTextProps {
    text: string;
    className?: string;
}

/**
 * Renders rich text content with support for:
 * - Mermaid diagrams (```mermaid ... ```)
 * - LaTeX math (via MathText)
 * - Code blocks and inline code
 * - Markdown-style formatting
 */
export function RichText({ text, className = "" }: RichTextProps) {
    const parts = useMemo(() => {
        if (!text) return [];

        // Split by mermaid code blocks
        // Pattern: ```mermaid\n ... \n```
        const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
        const segments: { type: "text" | "mermaid"; content: string }[] = [];

        let lastIndex = 0;
        let match;

        while ((match = mermaidRegex.exec(text)) !== null) {
            // Add text before this mermaid block
            if (match.index > lastIndex) {
                segments.push({
                    type: "text",
                    content: text.slice(lastIndex, match.index),
                });
            }

            // Add the mermaid diagram
            const mermaidContent = match[1];
            if (mermaidContent) {
                segments.push({
                    type: "mermaid",
                    content: mermaidContent.trim(),
                });
            }

            lastIndex = match.index + match[0].length;
        }

        // Add any remaining text after the last mermaid block
        if (lastIndex < text.length) {
            segments.push({
                type: "text",
                content: text.slice(lastIndex),
            });
        }

        // If no mermaid blocks found, return the whole text
        if (segments.length === 0) {
            segments.push({ type: "text", content: text });
        }

        return segments;
    }, [text]);

    return (
        <div className={className}>
            {parts.map((part, index) => {
                if (part.type === "mermaid") {
                    return (
                        <MermaidDiagram
                            key={index}
                            chart={part.content}
                            className="my-4"
                        />
                    );
                }
                return <MathText key={index} text={part.content} />;
            })}
        </div>
    );
}

export default RichText;

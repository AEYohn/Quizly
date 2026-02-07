"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Render subscripts (_t, _{text}) and superscripts (^2, ^{text}) in plain text.
 * Only converts single-char _X / ^X at word boundaries to avoid breaking snake_case.
 */
function renderMathText(src: string, key: number): ReactNode {
    const re = /_{([^}]+)}|\^{([^}]+)}|\b([a-zA-Z])_([a-zA-Z0-9])|\b([a-zA-Z])\^([a-zA-Z0-9])/g;
    const nodes: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let found = false;

    while ((m = re.exec(src)) !== null) {
        found = true;
        if (m.index > last) nodes.push(src.slice(last, m.index));

        if (m[1] != null) {
            nodes.push(<sub key={`m${m.index}`}>{m[1]}</sub>);
        } else if (m[2] != null) {
            nodes.push(<sup key={`m${m.index}`}>{m[2]}</sup>);
        } else if (m[3] != null && m[4] != null) {
            nodes.push(m[3]);
            nodes.push(<sub key={`m${m.index}`}>{m[4]}</sub>);
        } else if (m[5] != null && m[6] != null) {
            nodes.push(m[5]);
            nodes.push(<sup key={`m${m.index}`}>{m[6]}</sup>);
        }
        last = m.index + m[0].length;
    }

    if (!found) return <span key={key}>{src}</span>;
    if (last < src.length) nodes.push(src.slice(last));
    return <span key={key}>{nodes}</span>;
}

export function RichText({ text, className }: { text: string; className?: string }) {
    const parts: { type: "text" | "code-block" | "inline-code"; content: string; lang?: string }[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        const blockMatch = remaining.match(/```(\w*)\n?([\s\S]*?)```/);
        const inlineMatch = remaining.match(/`([^`]+)`/);

        if (blockMatch && (!inlineMatch || remaining.indexOf(blockMatch[0]) <= remaining.indexOf(inlineMatch[0]))) {
            const idx = remaining.indexOf(blockMatch[0]);
            if (idx > 0) parts.push({ type: "text", content: remaining.slice(0, idx) });
            parts.push({ type: "code-block", content: blockMatch[2] ?? "", lang: blockMatch[1] });
            remaining = remaining.slice(idx + blockMatch[0].length);
        } else if (inlineMatch) {
            const idx = remaining.indexOf(inlineMatch[0]);
            if (idx > 0) parts.push({ type: "text", content: remaining.slice(0, idx) });
            parts.push({ type: "inline-code", content: inlineMatch[1] ?? "" });
            remaining = remaining.slice(idx + inlineMatch[0].length);
        } else {
            parts.push({ type: "text", content: remaining });
            remaining = "";
        }
    }

    return (
        <div className={className}>
            {parts.map((part, i) => {
                if (part.type === "code-block") {
                    return (
                        <pre key={i} className="my-3 px-4 py-3 rounded-xl bg-[#0d1117] border border-gray-800/60 overflow-x-auto">
                            {part.lang && (
                                <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2 font-medium">{part.lang}</div>
                            )}
                            <code className="text-[13px] leading-relaxed font-mono text-emerald-300/90">{part.content.trim()}</code>
                        </pre>
                    );
                }
                if (part.type === "inline-code") {
                    return (
                        <code key={i} className="px-1.5 py-0.5 rounded-md bg-gray-800/80 text-amber-300/90 text-[0.9em] font-mono">
                            {part.content}
                        </code>
                    );
                }
                const boldParts = part.content.split(/\*\*(.*?)\*\*/g);
                return (
                    <Fragment key={i}>
                        {boldParts.map((bp, j) =>
                            j % 2 === 1 ? (
                                <strong key={j} className="font-semibold text-gray-100">{bp}</strong>
                            ) : (
                                renderMathText(bp, j)
                            )
                        )}
                    </Fragment>
                );
            })}
        </div>
    );
}

export function Explanation({ text }: { text: string }) {
    const hasBullets = /^[\s]*[*\-•]\s/m.test(text) || /^\d+\.\s/m.test(text);

    if (hasBullets) {
        const lines = text.split(/\n/).filter((l) => l.trim());
        return (
            <div className="space-y-2">
                {lines.map((line, i) => {
                    const cleaned = line.replace(/^[\s]*[*\-•]\s*/, "").replace(/^\d+\.\s*/, "");
                    return (
                        <div key={i} className="flex gap-2">
                            <span className="text-emerald-500/60 mt-0.5 shrink-0">&#x2022;</span>
                            <RichText text={cleaned} className="text-gray-300 text-sm leading-relaxed" />
                        </div>
                    );
                })}
            </div>
        );
    }

    const sentences = text.split(/(?<=\.)\s+/).filter((s) => s.trim());
    if (sentences.length > 2) {
        return (
            <div className="space-y-2">
                {sentences.map((sentence, i) => (
                    <RichText key={i} text={sentence} className="text-gray-300 text-sm leading-relaxed" />
                ))}
            </div>
        );
    }

    return <RichText text={text} className="text-gray-300 text-sm leading-relaxed" />;
}

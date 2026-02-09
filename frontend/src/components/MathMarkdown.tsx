"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import katex from "katex";
import "katex/dist/katex.min.css";
import { MermaidDiagram } from "./MermaidDiagram";

interface MathMarkdownProps {
    children: string;
    className?: string;
    dark?: boolean;
}

/**
 * Renders markdown content with LaTeX math support.
 *
 * Extracts math delimiters ($...$, $$...$$, \(...\), \[...\]) into
 * placeholder tokens, runs through react-markdown, then restores
 * math as rendered KaTeX HTML.
 *
 * Styled for light-theme learn pages (unlike Markdown.tsx which is dark-theme).
 */
export function MathMarkdown({ children, className = "", dark = false }: MathMarkdownProps) {
    // Extract math into placeholders before markdown parsing
    const mathBlocks: { id: string; html: string }[] = [];
    let processed = children;

    // Replace $$...$$ (display math)
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
        const id = `%%MATH_${mathBlocks.length}%%`;
        try {
            const html = katex.renderToString(latex.trim(), {
                displayMode: true,
                throwOnError: false,
            });
            mathBlocks.push({ id, html });
        } catch {
            mathBlocks.push({ id, html: `$$${latex}$$` });
        }
        return id;
    });

    // Replace \[...\] (display math)
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
        const id = `%%MATH_${mathBlocks.length}%%`;
        try {
            const html = katex.renderToString(latex.trim(), {
                displayMode: true,
                throwOnError: false,
            });
            mathBlocks.push({ id, html });
        } catch {
            mathBlocks.push({ id, html: `\\[${latex}\\]` });
        }
        return id;
    });

    // Replace \(...\) (inline math)
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => {
        const id = `%%MATH_${mathBlocks.length}%%`;
        try {
            const html = katex.renderToString(latex.trim(), {
                displayMode: false,
                throwOnError: false,
            });
            mathBlocks.push({ id, html });
        } catch {
            mathBlocks.push({ id, html: `\\(${latex}\\)` });
        }
        return id;
    });

    // Replace $...$ (inline math) — avoid escaped \$ and $$
    processed = processed.replace(/(?<!\$)\$(?!\$)([^$\n]+)\$(?!\$)/g, (_, latex) => {
        const id = `%%MATH_${mathBlocks.length}%%`;
        try {
            const html = katex.renderToString(latex.trim(), {
                displayMode: false,
                throwOnError: false,
            });
            mathBlocks.push({ id, html });
        } catch {
            mathBlocks.push({ id, html: `$${latex}$` });
        }
        return id;
    });

    // Restore math placeholders in rendered text nodes
    function restoreMath(text: string): (string | React.ReactElement)[] {
        const parts: (string | React.ReactElement)[] = [];
        let remaining = text;
        for (const block of mathBlocks) {
            const idx = remaining.indexOf(block.id);
            if (idx === -1) continue;
            if (idx > 0) parts.push(remaining.slice(0, idx));
            parts.push(
                <span
                    key={block.id}
                    dangerouslySetInnerHTML={{ __html: block.html }}
                />
            );
            remaining = remaining.slice(idx + block.id.length);
        }
        if (remaining) parts.push(remaining);
        return parts.length > 0 ? parts : [text];
    }

    return (
        <div className={`prose prose-sm max-w-none ${dark ? "prose-invert" : ""} ${className}`}>
            <ReactMarkdown
                components={{
                    h1: ({ children }) => (
                        <h1 className={`text-xl font-bold mb-3 ${dark ? "text-white" : "text-gray-900"}`}>{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className={`text-lg font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className={`text-base font-semibold mb-2 ${dark ? "text-indigo-200" : "text-gray-800"}`}>{children}</h3>
                    ),
                    p: ({ children }) => {
                        const cls = `mb-3 leading-relaxed ${dark ? "text-indigo-100/80" : "text-gray-700"}`;
                        if (typeof children === "string") {
                            const restored = restoreMath(children);
                            return <p className={cls}>{restored}</p>;
                        }
                        return <p className={cls}>{children}</p>;
                    },
                    strong: ({ children }) => (
                        <strong className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className={`italic ${dark ? "text-indigo-200" : "text-gray-700"}`}>{children}</em>
                    ),
                    code: ({ className: codeClassName, children }) => {
                        const isInline = !codeClassName;
                        const language = codeClassName?.replace("language-", "");

                        if (language === "mermaid") {
                            return <MermaidDiagram chart={String(children)} className="my-3" />;
                        }

                        if (isInline) {
                            return (
                                <code className={`px-1.5 py-0.5 rounded text-sm font-mono ${dark ? "bg-indigo-900/50 text-indigo-200" : "bg-gray-100 text-indigo-700"}`}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code
                                className={`block p-3 rounded-lg text-sm font-mono overflow-x-auto ${dark ? "bg-gray-900 text-gray-300" : "bg-gray-50 text-gray-800"} ${codeClassName || ""}`}
                            >
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className={`rounded-lg p-4 my-3 overflow-x-auto ${dark ? "bg-gray-900" : "bg-gray-50"}`}>
                            {children}
                        </pre>
                    ),
                    ul: ({ children }) => (
                        <ul className={`list-disc list-inside mb-3 space-y-1 ${dark ? "text-indigo-100/80" : "text-gray-700"}`}>
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className={`list-decimal list-inside mb-3 space-y-1 ${dark ? "text-indigo-100/80" : "text-gray-700"}`}>
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => {
                        const cls = dark ? "text-indigo-100/80" : "text-gray-700";
                        if (typeof children === "string") {
                            const restored = restoreMath(children);
                            return <li className={cls}>{restored}</li>;
                        }
                        return <li className={cls}>{children}</li>;
                    },
                    blockquote: ({ children }) => (
                        <blockquote className={`border-l-4 pl-4 italic my-3 ${dark ? "border-indigo-400/30 text-indigo-200/60" : "border-indigo-300 text-gray-600"}`}>
                            {children}
                        </blockquote>
                    ),
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className={`underline ${dark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-500"}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {children}
                        </a>
                    ),
                }}
            >
                {processed}
            </ReactMarkdown>
        </div>
    );
}

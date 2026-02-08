"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathMarkdownProps {
    children: string;
    className?: string;
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
export function MathMarkdown({ children, className = "" }: MathMarkdownProps) {
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
        <div className={`prose prose-sm max-w-none ${className}`}>
            <ReactMarkdown
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-gray-900 mb-3">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-bold text-gray-900 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold text-gray-800 mb-2">{children}</h3>
                    ),
                    p: ({ children }) => {
                        // Check if children contain math placeholders
                        if (typeof children === "string") {
                            const restored = restoreMath(children);
                            return <p className="text-gray-700 mb-3 leading-relaxed">{restored}</p>;
                        }
                        return <p className="text-gray-700 mb-3 leading-relaxed">{children}</p>;
                    },
                    strong: ({ children }) => (
                        <strong className="font-semibold text-gray-900">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-gray-700">{children}</em>
                    ),
                    code: ({ className: codeClassName, children }) => {
                        const isInline = !codeClassName;
                        if (isInline) {
                            return (
                                <code className="bg-gray-100 text-indigo-700 px-1.5 py-0.5 rounded text-sm font-mono">
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code
                                className={`block bg-gray-50 text-gray-800 p-3 rounded-lg text-sm font-mono overflow-x-auto ${codeClassName || ""}`}
                            >
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="bg-gray-50 rounded-lg p-4 my-3 overflow-x-auto">
                            {children}
                        </pre>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside text-gray-700 mb-3 space-y-1">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside text-gray-700 mb-3 space-y-1">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => {
                        if (typeof children === "string") {
                            const restored = restoreMath(children);
                            return <li className="text-gray-700">{restored}</li>;
                        }
                        return <li className="text-gray-700">{children}</li>;
                    },
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-indigo-300 pl-4 italic text-gray-600 my-3">
                            {children}
                        </blockquote>
                    ),
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className="text-indigo-600 hover:text-indigo-500 underline"
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

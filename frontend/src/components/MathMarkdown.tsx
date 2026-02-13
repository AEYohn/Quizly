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

    // Unescape \$ → $ (Gemini escapes dollar signs in currency contexts)
    processed = processed.replace(/\\\$/g, '$');

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

    // Restore math placeholders in a single text string
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

    // Recursively walk React children tree and restore math in every string node
    function restoreMathInChildren(node: React.ReactNode): React.ReactNode {
        if (typeof node === "string") {
            if (!node.includes("%%MATH_")) return node;
            const parts = restoreMath(node);
            return parts.length === 1 ? parts[0] : <React.Fragment>{parts}</React.Fragment>;
        }
        if (Array.isArray(node)) {
            return node.map((child, i) => {
                if (typeof child === "string") {
                    if (!child.includes("%%MATH_")) return child;
                    const parts = restoreMath(child);
                    return parts.length === 1 ? parts[0] : <React.Fragment key={`m${i}`}>{parts}</React.Fragment>;
                }
                if (React.isValidElement(child)) {
                    const el = child as React.ReactElement<{ children?: React.ReactNode }>;
                    return React.cloneElement(el, { key: el.key ?? i } as Record<string, unknown>, restoreMathInChildren(el.props.children));
                }
                return child;
            });
        }
        if (React.isValidElement(node)) {
            const el = node as React.ReactElement<{ children?: React.ReactNode }>;
            return React.cloneElement(el, {} as Record<string, unknown>, restoreMathInChildren(el.props.children));
        }
        return node;
    }

    const m = (node: React.ReactNode) => restoreMathInChildren(node);

    return (
        <div className={`prose prose-sm max-w-none ${dark ? "prose-invert" : ""} ${className}`}>
            <ReactMarkdown
                components={{
                    h1: ({ children }) => (
                        <h1 className={`text-xl font-bold mb-3 ${dark ? "text-white" : "text-gray-900"}`}>{m(children)}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className={`text-lg font-bold mb-2 ${dark ? "text-white" : "text-gray-900"}`}>{m(children)}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className={`text-base font-semibold mb-2 ${dark ? "text-teal-200" : "text-gray-800"}`}>{m(children)}</h3>
                    ),
                    p: ({ children }) => (
                        <p className={`mb-3 leading-relaxed ${dark ? "text-teal-100/80" : "text-gray-700"}`}>{m(children)}</p>
                    ),
                    strong: ({ children }) => (
                        <strong className={`font-semibold ${dark ? "text-white" : "text-gray-900"}`}>{m(children)}</strong>
                    ),
                    em: ({ children }) => (
                        <em className={`italic ${dark ? "text-teal-200" : "text-gray-700"}`}>{m(children)}</em>
                    ),
                    code: ({ className: codeClassName, children }) => {
                        const isInline = !codeClassName;
                        const language = codeClassName?.replace("language-", "");

                        if (language === "mermaid") {
                            return <MermaidDiagram chart={String(children)} dark={dark} className="my-3" />;
                        }

                        if (isInline) {
                            return (
                                <code className={`px-1.5 py-0.5 rounded text-sm font-mono ${dark ? "bg-teal-900/50 text-teal-200" : "bg-gray-100 text-teal-700"}`}>
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
                        <ul className={`list-disc list-inside mb-3 space-y-1 ${dark ? "text-teal-100/80" : "text-gray-700"}`}>
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className={`list-decimal list-inside mb-3 space-y-1 ${dark ? "text-teal-100/80" : "text-gray-700"}`}>
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className={dark ? "text-teal-100/80" : "text-gray-700"}>{m(children)}</li>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className={`border-l-4 pl-4 italic my-3 ${dark ? "border-teal-400/30 text-teal-200/60" : "border-teal-300 text-gray-600"}`}>
                            {m(children)}
                        </blockquote>
                    ),
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className={`underline ${dark ? "text-teal-400 hover:text-teal-300" : "text-teal-600 hover:text-teal-500"}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {m(children)}
                        </a>
                    ),
                }}
            >
                {processed}
            </ReactMarkdown>
        </div>
    );
}

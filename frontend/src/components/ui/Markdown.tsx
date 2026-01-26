"use client";

import ReactMarkdown from "react-markdown";
import { MermaidDiagram } from "@/components/MermaidDiagram";

interface MarkdownProps {
    children: string;
    className?: string;
}

export function Markdown({ children, className = "" }: MarkdownProps) {
    return (
        <div className={`prose prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                components={{
                    // Customize heading styles
                    h1: ({ children }) => <h1 className="text-xl font-bold text-white mb-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold text-white mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-md font-semibold text-gray-200 mb-2">{children}</h3>,
                    
                    // Paragraphs
                    p: ({ children }) => <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>,
                    
                    // Bold/strong
                    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                    
                    // Italic/emphasis
                    em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
                    
                    // Code blocks with Mermaid support
                    code: ({ className, children, ...props }) => {
                        const isInline = !className;

                        // Check for mermaid diagram
                        const match = /language-(\w+)/.exec(className || "");
                        const language = match ? match[1] : "";

                        if (language === "mermaid") {
                            const chart = String(children).replace(/\n$/, "");
                            return <MermaidDiagram chart={chart} className="my-4" />;
                        }

                        if (isInline) {
                            return (
                                <code className="bg-gray-800 text-emerald-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className={`block bg-gray-900 text-gray-300 p-3 rounded-lg text-sm font-mono overflow-x-auto ${className || ""}`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    
                    // Pre blocks (code block wrapper)
                    pre: ({ children }) => (
                        <pre className="bg-gray-900 rounded-lg p-4 my-3 overflow-x-auto">
                            {children}
                        </pre>
                    ),
                    
                    // Lists
                    ul: ({ children }) => <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-gray-300">{children}</li>,
                    
                    // Blockquotes
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-sky-500 pl-4 italic text-gray-400 my-3">
                            {children}
                        </blockquote>
                    ),
                    
                    // Links
                    a: ({ href, children }) => (
                        <a href={href} className="text-sky-400 hover:text-sky-300 underline" target="_blank" rel="noopener noreferrer">
                            {children}
                        </a>
                    ),
                    
                    // Horizontal rule
                    hr: () => <hr className="border-gray-700 my-4" />,
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}

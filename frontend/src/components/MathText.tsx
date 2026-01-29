"use client";

import { useMemo } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";

interface MathTextProps {
    text: string;
    className?: string;
}

// Helper to escape HTML entities in code
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Renders text with mathematical notation and code support.
 *
 * Supports:
 * - LaTeX inline math: $x^2$ or \(x^2\)
 * - LaTeX display math: $$x^2$$ or \[x^2\]
 * - Inline code: `code` or ```code```
 * - Auto-converts common patterns: 2^n, x_i, |S|, <=, >=, !=
 */
export default function MathText({ text, className = "" }: MathTextProps) {
    const rendered = useMemo(() => {
        if (!text) return "";

        // First, handle code blocks and inline code (before math processing)
        let result = text;

        // Handle triple backtick code blocks (```code```)
        result = result.replace(/```([^`]+)```/g, (_, code) => {
            return `<pre class="my-2 rounded-lg bg-gray-800 p-3 text-sm overflow-x-auto"><code class="font-mono text-green-400">${escapeHtml(code.trim())}</code></pre>`;
        });

        // Handle inline code with backticks (`code`)
        result = result.replace(/`([^`]+)`/g, (_, code) => {
            return `<code class="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-sm text-cyan-300">${escapeHtml(code)}</code>`;
        });

        // Detect code-like patterns (common programming syntax) and wrap in code style
        // Pattern: word followed by () like function calls - area(), Rectangle.area(), r->area(), etc.
        // Also handles -> (arrow operator) and . (dot operator) for method chains
        result = result.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*(?:(?:->|\.)[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\(\s*([^)]*)\s*\)/g, (match, func, args) => {
            // Don't double-wrap if already in a code tag
            if (match.includes('class="')) return match;
            // Escape the -> to HTML entity to prevent arrow conversion
            const escapedFunc = escapeHtml(func).replace(/-&gt;/g, '-&gt;');
            return `<code class="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-sm text-cyan-300">${escapedFunc}(${escapeHtml(args)})</code>`;
        });

        // Handle standalone method calls with arrow operator: r->area; (without parentheses - for property access)
        result = result.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)-&gt;([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()/g, (match, obj, member) => {
            if (match.includes('class="')) return match;
            return `<code class="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-sm text-cyan-300">${obj}-&gt;${member}</code>`;
        });

        // Detect struct/class definitions
        result = result.replace(/\b(struct|class|interface)\s+([A-Z][a-zA-Z0-9_]*)\s*\{([^}]+)\}/g, (match, keyword, name, body) => {
            if (match.includes('class="')) return match;
            return `<code class="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-sm text-cyan-300">${keyword} ${name} {${body}}</code>`;
        });

        // Detect variable declarations like "Type name = value"
        result = result.replace(/\b([A-Z][a-zA-Z0-9_]*)\s+([a-z][a-zA-Z0-9_]*)\s*=\s*(\{[^}]+\}|[^;,]+)/g, (match, type, name, value) => {
            if (match.includes('class="')) return match;
            return `<code class="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-sm text-cyan-300">${type} ${name} = ${value}</code>`;
        });

        // Detect C++ style namespaced identifiers with underscores (std::map::value_type, std::pair<...>)
        // This must run BEFORE subscript conversion to prevent value_type becoming value<sub>type</sub>
        result = result.replace(/\b(std::[a-zA-Z_][a-zA-Z0-9_:<>,\s]*)/g, (match) => {
            if (match.includes('class="')) return match;
            return `<code class="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-sm text-cyan-300">${escapeHtml(match)}</code>`;
        });

        // Detect common programming identifiers with underscores that should NOT be subscripts
        // Pattern: word_word or word_word_word (like snake_case identifiers, type names)
        // Only match if they look like code (have multiple underscores or are all lowercase/mixed with underscores)
        result = result.replace(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/gi, (match) => {
            if (match.includes('class="')) return match;
            // Skip if it's already inside a tag
            return `<code class="rounded bg-gray-700 px-1.5 py-0.5 font-mono text-sm text-cyan-300">${escapeHtml(match)}</code>`;
        });

        // Process display math first ($$...$$)
        result = result.replace(/\$\$([^$]+)\$\$/g, (_, latex) => {
            try {
                return katex.renderToString(latex.trim(), {
                    displayMode: true,
                    throwOnError: false,
                });
            } catch {
                return `$$${latex}$$`;
            }
        });

        // Process inline math ($...$) - but not escaped \$
        result = result.replace(/(?<!\\\$)\$([^$\n]+)\$(?!\$)/g, (_, latex) => {
            try {
                return katex.renderToString(latex.trim(), {
                    displayMode: false,
                    throwOnError: false,
                });
            } catch {
                return `$${latex}$`;
            }
        });

        // Auto-convert common math patterns (when not inside LaTeX)
        // Superscripts: 2^n, 2^(n-1), x^2
        result = result.replace(/(\w+)\^(\([^)]+\)|\w+)/g, (match, base, exp) => {
            // Remove parentheses from exponent if present
            const cleanExp = exp.startsWith("(") ? exp.slice(1, -1) : exp;
            try {
                return katex.renderToString(`${base}^{${cleanExp}}`, {
                    displayMode: false,
                    throwOnError: false,
                });
            } catch {
                return match;
            }
        });

        // Subscripts: x_i, a_1 (but ONLY for math-like patterns, NOT code identifiers)
        // Skip if already in a code tag or if it looks like a snake_case identifier
        result = result.replace(/(\w+)_(\w+)/g, (match, base, sub) => {
            // Don't convert if it looks like code (snake_case with lowercase)
            if (/^[a-z][a-z0-9]*_[a-z0-9]+$/i.test(match) && match === match.toLowerCase()) {
                return match; // Keep as-is, likely a code identifier
            }
            // Only convert short math-like subscripts (x_i, a_1, etc.)
            if (base.length <= 2 && sub.length <= 2) {
                try {
                    return katex.renderToString(`${base}_{${sub}}`, {
                        displayMode: false,
                        throwOnError: false,
                    });
                } catch {
                    return match;
                }
            }
            return match;
        });

        // Cardinality/absolute value: |S|, |x|
        result = result.replace(/\|([^|]+)\|/g, (match, inner) => {
            try {
                return katex.renderToString(`|${inner}|`, {
                    displayMode: false,
                    throwOnError: false,
                });
            } catch {
                return match;
            }
        });

        // Comparison operators
        result = result.replace(/(<|>)=/g, (match) => {
            const symbol = match === "<=" ? "\\leq" : "\\geq";
            try {
                return katex.renderToString(symbol, {
                    displayMode: false,
                    throwOnError: false,
                });
            } catch {
                return match;
            }
        });

        result = result.replace(/!=/g, () => {
            try {
                return katex.renderToString("\\neq", {
                    displayMode: false,
                    throwOnError: false,
                });
            } catch {
                return "!=";
            }
        });

        // Arrows: ->, <-, <-> (only when NOT inside code tags)
        // Skip arrow conversion if the result already contains code tags (to preserve r->area() syntax)
        if (!result.includes('<code')) {
            result = result.replace(/<->/g, () => {
                try {
                    return katex.renderToString("\\leftrightarrow", { displayMode: false, throwOnError: false });
                } catch {
                    return "<->";
                }
            });
            result = result.replace(/->/g, () => {
                try {
                    return katex.renderToString("\\rightarrow", { displayMode: false, throwOnError: false });
                } catch {
                    return "->";
                }
            });
            result = result.replace(/<-(?!>)/g, () => {
                try {
                    return katex.renderToString("\\leftarrow", { displayMode: false, throwOnError: false });
                } catch {
                    return "<-";
                }
            });
        }

        return result;
    }, [text]);

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{ __html: rendered }}
        />
    );
}

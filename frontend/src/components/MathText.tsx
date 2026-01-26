"use client";

import { useMemo } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";

interface MathTextProps {
    text: string;
    className?: string;
}

/**
 * Renders text with mathematical notation support.
 *
 * Supports:
 * - LaTeX inline math: $x^2$ or \(x^2\)
 * - LaTeX display math: $$x^2$$ or \[x^2\]
 * - Auto-converts common patterns: 2^n, x_i, |S|, <=, >=, !=
 */
export default function MathText({ text, className = "" }: MathTextProps) {
    const rendered = useMemo(() => {
        if (!text) return "";

        // First, handle explicit LaTeX delimiters
        let result = text;

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

        // Subscripts: x_i, a_1
        result = result.replace(/(\w+)_(\w+)/g, (match, base, sub) => {
            try {
                return katex.renderToString(`${base}_{${sub}}`, {
                    displayMode: false,
                    throwOnError: false,
                });
            } catch {
                return match;
            }
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

        // Arrows: ->, <-, <->
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

        return result;
    }, [text]);

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{ __html: rendered }}
        />
    );
}

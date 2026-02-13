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

// Common LaTeX commands that indicate math content
const LATEX_COMMANDS = [
    // Greek letters
    "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta",
    "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi",
    "varpi", "rho", "varrho", "sigma", "varsigma", "tau", "upsilon", "phi",
    "varphi", "chi", "psi", "omega",
    "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon",
    "Phi", "Psi", "Omega",
    // Structural commands
    "frac", "dfrac", "tfrac", "sqrt", "root", "binom", "tbinom", "dbinom",
    "overset", "underset", "stackrel", "overline", "underline", "hat", "bar",
    "vec", "dot", "ddot", "tilde", "widetilde", "widehat", "overbrace", "underbrace",
    // Operators and relations
    "cdot", "times", "div", "pm", "mp", "circ", "bullet", "star", "ast",
    "oplus", "otimes", "odot",
    "leq", "geq", "neq", "approx", "equiv", "sim", "simeq", "cong",
    "propto", "prec", "succ", "preceq", "succeq", "ll", "gg",
    "subset", "supset", "subseteq", "supseteq", "in", "notin", "ni",
    "cup", "cap", "setminus", "emptyset", "varnothing",
    "wedge", "vee", "neg", "forall", "exists", "nexists",
    // Big operators
    "sum", "prod", "coprod", "int", "iint", "iiint", "oint",
    "bigcup", "bigcap", "bigoplus", "bigotimes", "bigvee", "bigwedge",
    // Arrows
    "to", "rightarrow", "leftarrow", "leftrightarrow", "Rightarrow",
    "Leftarrow", "Leftrightarrow", "mapsto", "hookrightarrow", "hookleftarrow",
    "uparrow", "downarrow", "nearrow", "searrow",
    // Functions
    "log", "ln", "exp", "sin", "cos", "tan", "sec", "csc", "cot",
    "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
    "lim", "limsup", "liminf", "sup", "inf", "max", "min", "arg", "det", "dim",
    "ker", "hom", "deg",
    // Calculus / analysis
    "nabla", "partial", "grad", "curl",
    // Spacing and misc
    "quad", "qquad", "text", "mathrm", "mathbf", "mathbb", "mathcal", "mathfrak",
    "mathscr", "boldsymbol", "operatorname",
    // Delimiters
    "left", "right", "langle", "rangle", "lfloor", "rfloor", "lceil", "rceil",
    "lvert", "rvert", "lVert", "rVert",
    // Dots
    "ldots", "cdots", "vdots", "ddots", "dots",
    // Accents / modifiers
    "prime", "infty", "aleph", "hbar", "ell", "wp", "Re", "Im",
];

const LATEX_COMMAND_SET = new Set(LATEX_COMMANDS);

// Regex to find \command patterns
const BARE_COMMAND_RE = new RegExp(
    `\\\\(${LATEX_COMMANDS.join("|")})(?![a-zA-Z])`,
    "g"
);

interface Range {
    start: number;
    end: number;
}

/**
 * Build ranges of text already inside math delimiters or code tags,
 * so we don't double-wrap them.
 */
function buildProtectedRanges(text: string): Range[] {
    const ranges: Range[] = [];
    const patterns = [
        /\$\$[\s\S]*?\$\$/g,           // $$...$$
        /(?<!\$)\$(?!\$)[^$\n]+\$/g,    // $...$
        /\\\([\s\S]*?\\\)/g,            // \(...\)
        /\\\[[\s\S]*?\\\]/g,            // \[...\]
        /<code[\s\S]*?<\/code>/g,       // <code>...</code>
        /<pre[\s\S]*?<\/pre>/g,         // <pre>...</pre>
    ];
    for (const pat of patterns) {
        let m;
        while ((m = pat.exec(text)) !== null) {
            ranges.push({ start: m.index, end: m.index + m[0].length });
        }
    }
    return ranges;
}

function isInsideProtected(pos: number, ranges: Range[]): boolean {
    return ranges.some((r) => pos >= r.start && pos < r.end);
}

/**
 * Expand right from the end of a \command match to capture the full math expression.
 * Handles {…} groups, ^/_ subscripts, chained \commands, digits, single-letter vars,
 * math operators, and parenthesized groups.
 */
function expandRight(text: string, pos: number): number {
    let i = pos;
    const len = text.length;
    const at = (idx: number) => text.charAt(idx);

    while (i < len) {
        const ch = at(i);

        // Skip whitespace between math tokens
        if (ch === " " || ch === "\t") {
            // Look ahead: if next non-space is still math, include the space
            let j = i;
            while (j < len && (at(j) === " " || at(j) === "\t")) j++;
            if (j < len && (at(j) === "\\" || at(j) === "{" || at(j) === "^" || at(j) === "_" ||
                /[a-zA-Z0-9+\-*/=<>!,(.[\]|]/.test(at(j)))) {
                i = j;
                continue;
            }
            break;
        }

        // Consume brace groups {…}
        if (ch === "{") {
            let depth = 1;
            i++;
            while (i < len && depth > 0) {
                if (at(i) === "{") depth++;
                else if (at(i) === "}") depth--;
                i++;
            }
            continue;
        }

        // Consume ^{…} or _{…} or ^x or _x
        if (ch === "^" || ch === "_") {
            i++;
            if (i < len && at(i) === "{") {
                let depth = 1;
                i++;
                while (i < len && depth > 0) {
                    if (at(i) === "{") depth++;
                    else if (at(i) === "}") depth--;
                    i++;
                }
            } else if (i < len && /[a-zA-Z0-9\\]/.test(at(i))) {
                if (at(i) === "\\") {
                    // Chained command as superscript/subscript
                    i++;
                    while (i < len && /[a-zA-Z]/.test(at(i))) i++;
                } else {
                    i++;
                }
            }
            continue;
        }

        // Chained \command
        if (ch === "\\") {
            // Check if this is a known command
            let cmdEnd = i + 1;
            while (cmdEnd < len && /[a-zA-Z]/.test(at(cmdEnd))) cmdEnd++;
            const cmd = text.slice(i + 1, cmdEnd);
            if (cmd.length > 0 && LATEX_COMMAND_SET.has(cmd)) {
                i = cmdEnd;
                continue;
            }
            break;
        }

        // Parenthesized groups that are part of math: (…)
        if (ch === "(") {
            let depth = 1;
            let j = i + 1;
            while (j < len && depth > 0) {
                if (at(j) === "(") depth++;
                else if (at(j) === ")") depth--;
                j++;
            }
            if (depth === 0) {
                i = j;
                continue;
            }
            break;
        }

        // Square bracket groups that are part of math: [...]
        if (ch === "[") {
            let depth = 1;
            let j = i + 1;
            while (j < len && depth > 0) {
                if (at(j) === "[") depth++;
                else if (at(j) === "]") depth--;
                j++;
            }
            if (depth === 0) {
                i = j;
                continue;
            }
            break;
        }

        // Single-letter variables, digits, math operators
        if (/[a-zA-Z]/.test(ch)) {
            // Check if this starts a multi-letter word (English text, not math)
            let wordEnd = i;
            while (wordEnd < len && /[a-zA-Z]/.test(at(wordEnd))) wordEnd++;
            if (wordEnd - i >= 2) {
                // Multi-letter word — check if it's a known short math token
                const word = text.slice(i, wordEnd);
                // Common short math words that appear in expressions
                if (/^(dt|dx|dy|dz|dr|ds|dp|dq)$/.test(word)) {
                    i = wordEnd;
                    continue;
                }
                // Stop: this is an English word
                break;
            }
            // Single letter — part of math
            i++;
            continue;
        }

        if (/[0-9.+\-*/=<>!,|]/.test(ch)) {
            i++;
            continue;
        }

        // Stop at sentence-ending punctuation that isn't math
        if (ch === ")" || ch === "]") {
            i++;
            continue;
        }

        break;
    }

    // Trim trailing whitespace and punctuation from the right edge
    while (i > pos && /[\s,;.]/.test(at(i - 1))) {
        i--;
    }

    return i;
}

/**
 * Expand left from the start of a \command match to capture preceding math context.
 * Stops at multi-letter English words, sentence boundaries, etc.
 */
function expandLeft(text: string, pos: number): number {
    let i = pos;
    const at = (idx: number) => text.charAt(idx);

    while (i > 0) {
        const ch = at(i - 1);

        // Skip whitespace
        if (ch === " " || ch === "\t") {
            // Look further left to see if there's math content
            let j = i - 1;
            while (j > 0 && (at(j - 1) === " " || at(j - 1) === "\t")) j--;
            if (j > 0 && /[a-zA-Z0-9)}\]|+\-*/=<>!,._^]/.test(at(j - 1))) {
                i = j;
                continue;
            }
            break;
        }

        // Closing brace/paren/bracket — find matching open
        if (ch === "}") {
            let depth = 1;
            let j = i - 2;
            while (j >= 0 && depth > 0) {
                if (at(j) === "}") depth++;
                else if (at(j) === "{") depth--;
                j--;
            }
            if (depth === 0) {
                i = j + 1;
                continue;
            }
            break;
        }

        if (ch === ")") {
            let depth = 1;
            let j = i - 2;
            while (j >= 0 && depth > 0) {
                if (at(j) === ")") depth++;
                else if (at(j) === "(") depth--;
                j--;
            }
            if (depth === 0) {
                i = j + 1;
                continue;
            }
            break;
        }

        if (ch === "]") {
            let depth = 1;
            let j = i - 2;
            while (j >= 0 && depth > 0) {
                if (at(j) === "]") depth++;
                else if (at(j) === "[") depth--;
                j--;
            }
            if (depth === 0) {
                i = j + 1;
                continue;
            }
            break;
        }

        // Letters — check for multi-letter English words vs single-letter math vars
        if (/[a-zA-Z]/.test(ch)) {
            let wordStart = i - 1;
            while (wordStart > 0 && /[a-zA-Z]/.test(at(wordStart - 1))) wordStart--;
            const word = text.slice(wordStart, i);
            if (word.length >= 2) {
                // Multi-letter word — likely English, stop here
                // Exception: common math tokens
                if (/^(dt|dx|dy|dz|dr|ds|dp|dq)$/.test(word)) {
                    i = wordStart;
                    continue;
                }
                break;
            }
            // Single letter — math variable
            i = wordStart;
            continue;
        }

        // Digits, operators, math punctuation
        if (/[0-9.+\-*/=<>!,|_^]/.test(ch)) {
            i--;
            continue;
        }

        // Open brackets that might start a math group
        if (ch === "(" || ch === "[") {
            i--;
            continue;
        }

        break;
    }

    // Trim leading whitespace
    while (i < pos && /\s/.test(at(i))) {
        i++;
    }

    return i;
}

/**
 * Pre-process text to wrap bare LaTeX commands in $...$ delimiters.
 * Runs after code extraction but before delimiter-based math rendering.
 */
function wrapBareLatex(text: string): string {
    const protectedRanges = buildProtectedRanges(text);

    // Find all bare \command occurrences not inside protected ranges
    const regions: Range[] = [];
    let match;
    BARE_COMMAND_RE.lastIndex = 0;
    while ((match = BARE_COMMAND_RE.exec(text)) !== null) {
        const cmdStart = match.index;
        if (isInsideProtected(cmdStart, protectedRanges)) continue;

        // Expand the region around this command
        const cmdEnd = cmdStart + match[0].length;
        const left = expandLeft(text, cmdStart);
        const right = expandRight(text, cmdEnd);

        regions.push({ start: left, end: right });
    }

    if (regions.length === 0) return text;

    // Merge overlapping/adjacent regions
    regions.sort((a, b) => a.start - b.start);
    const merged: Range[] = [{ ...regions[0]! }];
    for (let i = 1; i < regions.length; i++) {
        const last = merged[merged.length - 1]!;
        const cur = regions[i]!;
        if (cur.start <= last.end) {
            last.end = Math.max(last.end, cur.end);
        } else {
            merged.push({ ...cur });
        }
    }

    // Build result with $...$ wrappers
    let result = "";
    let cursor = 0;
    for (const region of merged) {
        result += text.slice(cursor, region.start);
        const content = text.slice(region.start, region.end);
        result += `$${content}$`;
        cursor = region.end;
    }
    result += text.slice(cursor);

    return result;
}

/**
 * Renders text with mathematical notation and code support.
 *
 * Supports:
 * - LaTeX inline math: $x^2$ or \(x^2\)
 * - LaTeX display math: $$x^2$$ or \[x^2\]
 * - Inline code: `code` or ```code```
 * - Auto-detects bare LaTeX commands and wraps them in $...$
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

        // Wrap bare LaTeX commands (e.g. \frac{1}{2}) in $...$ before math rendering
        result = wrapBareLatex(result);

        // Process \[...\] display math
        result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
            try {
                return katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false });
            } catch {
                return `\\[${latex}\\]`;
            }
        });

        // Process \(...\) inline math
        result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => {
            try {
                return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false });
            } catch {
                return `\\(${latex}\\)`;
            }
        });

        // Process display math first ($$...$$)
        result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
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
            className={`${className} [&_.katex]:whitespace-normal [&_.katex_.base]:whitespace-normal [&_.katex-display]:overflow-x-auto`}
            dangerouslySetInnerHTML={{ __html: rendered }}
        />
    );
}

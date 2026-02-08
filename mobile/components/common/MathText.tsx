import React, { useMemo } from "react";
import { Text, View, type TextStyle, type ViewStyle } from "react-native";

interface MathTextProps {
  text: string;
  style?: TextStyle;
  /** Extra styles applied to the wrapping View */
  containerStyle?: ViewStyle;
  /** If true, wraps in View with flexDirection: 'row', flexWrap: 'wrap' */
  inline?: boolean;
}

// ---- Unicode maps ----

const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "\u2070",
  "1": "\u00B9",
  "2": "\u00B2",
  "3": "\u00B3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079",
  "+": "\u207A",
  "-": "\u207B",
  "=": "\u207C",
  "(": "\u207D",
  ")": "\u207E",
  n: "\u207F",
  i: "\u2071",
  x: "\u02E3",
  a: "\u1D43",
  b: "\u1D47",
  c: "\u1D9C",
  d: "\u1D48",
  e: "\u1D49",
  k: "\u1D4F",
  m: "\u1D50",
  p: "\u1D56",
  t: "\u1D57",
};

const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "\u2080",
  "1": "\u2081",
  "2": "\u2082",
  "3": "\u2083",
  "4": "\u2084",
  "5": "\u2085",
  "6": "\u2086",
  "7": "\u2087",
  "8": "\u2088",
  "9": "\u2089",
  "+": "\u208A",
  "-": "\u208B",
  "=": "\u208C",
  "(": "\u208D",
  ")": "\u208E",
  a: "\u2090",
  e: "\u2091",
  i: "\u1D62",
  j: "\u2C7C",
  k: "\u2096",
  n: "\u2099",
  o: "\u2092",
  p: "\u209A",
  r: "\u1D63",
  s: "\u209B",
  t: "\u209C",
  x: "\u2093",
};

const GREEK_MAP: Record<string, string> = {
  alpha: "\u03B1",
  beta: "\u03B2",
  gamma: "\u03B3",
  delta: "\u03B4",
  epsilon: "\u03B5",
  zeta: "\u03B6",
  eta: "\u03B7",
  theta: "\u03B8",
  iota: "\u03B9",
  kappa: "\u03BA",
  lambda: "\u03BB",
  mu: "\u03BC",
  nu: "\u03BD",
  xi: "\u03BE",
  pi: "\u03C0",
  rho: "\u03C1",
  sigma: "\u03C3",
  tau: "\u03C4",
  upsilon: "\u03C5",
  phi: "\u03C6",
  chi: "\u03C7",
  psi: "\u03C8",
  omega: "\u03C9",
  Gamma: "\u0393",
  Delta: "\u0394",
  Theta: "\u0398",
  Lambda: "\u039B",
  Xi: "\u039E",
  Pi: "\u03A0",
  Sigma: "\u03A3",
  Phi: "\u03A6",
  Psi: "\u03A8",
  Omega: "\u03A9",
  infty: "\u221E",
  infinity: "\u221E",
};

const SYMBOL_MAP: Record<string, string> = {
  "\\leq": "\u2264",
  "\\geq": "\u2265",
  "\\neq": "\u2260",
  "\\approx": "\u2248",
  "\\equiv": "\u2261",
  "\\pm": "\u00B1",
  "\\mp": "\u2213",
  "\\times": "\u00D7",
  "\\cdot": "\u00B7",
  "\\div": "\u00F7",
  "\\sqrt": "\u221A",
  "\\sum": "\u2211",
  "\\prod": "\u220F",
  "\\int": "\u222B",
  "\\partial": "\u2202",
  "\\nabla": "\u2207",
  "\\forall": "\u2200",
  "\\exists": "\u2203",
  "\\in": "\u2208",
  "\\notin": "\u2209",
  "\\subset": "\u2282",
  "\\supset": "\u2283",
  "\\subseteq": "\u2286",
  "\\supseteq": "\u2287",
  "\\cup": "\u222A",
  "\\cap": "\u2229",
  "\\emptyset": "\u2205",
  "\\to": "\u2192",
  "\\rightarrow": "\u2192",
  "\\leftarrow": "\u2190",
  "\\leftrightarrow": "\u2194",
  "\\Rightarrow": "\u21D2",
  "\\Leftarrow": "\u21D0",
  "\\Leftrightarrow": "\u21D4",
  "\\implies": "\u21D2",
  "\\iff": "\u21D4",
  "\\therefore": "\u2234",
  "\\because": "\u2235",
  "\\ldots": "\u2026",
  "\\cdots": "\u22EF",
  "\\vdots": "\u22EE",
  "\\langle": "\u27E8",
  "\\rangle": "\u27E9",
  "\\circ": "\u2218",
  "\\degree": "\u00B0",
  "\\perp": "\u22A5",
  "\\parallel": "\u2225",
  "\\angle": "\u2220",
  "\\triangle": "\u25B3",
  "\\neg": "\u00AC",
  "\\land": "\u2227",
  "\\lor": "\u2228",
  "\\oplus": "\u2295",
  "\\otimes": "\u2297",
  "\\propto": "\u221D",
  "\\sim": "\u223C",
  "\\cong": "\u2245",
};

function toSuperscript(s: string): string {
  return [...s].map((c) => SUPERSCRIPT_MAP[c] ?? c).join("");
}

function toSubscript(s: string): string {
  return [...s].map((c) => SUBSCRIPT_MAP[c] ?? c).join("");
}

/** Convert LaTeX content to Unicode-approximated text */
function latexToUnicode(latex: string): string {
  let result = latex.trim();

  // Replace \text{...} with plain content
  result = result.replace(/\\text\{([^}]*)\}/g, "$1");

  // Replace \textbf{...} and \mathbf{...}
  result = result.replace(/\\(?:textbf|mathbf)\{([^}]*)\}/g, "$1");

  // Replace \frac{a}{b} with a/b
  result = result.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)");

  // Replace \sqrt{x} with sqrt symbol
  result = result.replace(/\\sqrt\{([^}]*)\}/g, "\u221A($1)");
  result = result.replace(/\\sqrt\[(\d+)\]\{([^}]*)\}/g, "\u221A[$1]($2)");

  // Replace Greek letters: \alpha, \beta, etc.
  for (const [cmd, char] of Object.entries(GREEK_MAP)) {
    const re = new RegExp(`\\\\${cmd}(?![a-zA-Z])`, "g");
    result = result.replace(re, char);
  }

  // Replace symbols
  for (const [cmd, char] of Object.entries(SYMBOL_MAP)) {
    // Escape backslashes for regex
    const escaped = cmd.replace(/\\/g, "\\\\");
    const re = new RegExp(escaped + "(?![a-zA-Z])", "g");
    result = result.replace(re, char);
  }

  // Handle superscripts: x^{abc} or x^2
  result = result.replace(/\^{([^}]*)}/g, (_, exp) => toSuperscript(exp));
  result = result.replace(/\^([a-zA-Z0-9])/g, (_, exp) => toSuperscript(exp));

  // Handle subscripts: x_{abc} or x_2
  result = result.replace(/_{([^}]*)}/g, (_, sub) => toSubscript(sub));
  result = result.replace(/_([a-zA-Z0-9])/g, (_, sub) => toSubscript(sub));

  // Replace \left and \right with plain delimiters
  result = result.replace(/\\(?:left|right)\s*([()[\]|{}.])/g, "$1");
  result = result.replace(/\\(?:left|right)\s*\\([{}|])/g, "$1");

  // Remove remaining unknown commands (keep their argument)
  result = result.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1");
  result = result.replace(/\\[a-zA-Z]+/g, "");

  // Clean up braces and extra whitespace
  result = result.replace(/[{}]/g, "");
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

type Segment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

/** Parse text into alternating text and math segments */
function parseSegments(text: string): Segment[] {
  if (!text) return [];

  const segments: Segment[] = [];
  let remaining = text;

  // Combined regex for all math delimiters
  // Order matters: $$...$$ before $...$, \[...\] before \(...\)
  const mathPattern =
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]+\$|\\\([\s\S]*?\\\))/;

  while (remaining) {
    const match = remaining.match(mathPattern);
    if (!match || match.index === undefined) {
      if (remaining) segments.push({ type: "text", value: remaining });
      break;
    }

    // Text before the math
    if (match.index > 0) {
      segments.push({ type: "text", value: remaining.slice(0, match.index) });
    }

    const matched = match[0];
    let latex: string;
    let display: boolean;

    if (matched.startsWith("$$")) {
      latex = matched.slice(2, -2);
      display = true;
    } else if (matched.startsWith("\\[")) {
      latex = matched.slice(2, -2);
      display = true;
    } else if (matched.startsWith("\\(")) {
      latex = matched.slice(2, -2);
      display = false;
    } else {
      // $...$
      latex = matched.slice(1, -1);
      display = false;
    }

    segments.push({ type: "math", value: latex, display });
    remaining = remaining.slice(match.index + matched.length);
  }

  return segments;
}

/** Auto-convert common math patterns in plain text */
function autoConvertMathPatterns(text: string): string {
  let result = text;

  // Superscripts: 2^n, 2^(n-1), x^2
  result = result.replace(/(\w+)\^(\([^)]+\)|\w+)/g, (match, base, exp) => {
    const cleanExp = exp.startsWith("(") ? exp.slice(1, -1) : exp;
    const sup = toSuperscript(cleanExp);
    if (sup === cleanExp) return match;
    return `${base}${sup}`;
  });

  // Subscripts: x_i, a_1 (but NOT snake_case identifiers)
  result = result.replace(/(\w+)_(\w+)/g, (match, base, sub) => {
    if (
      /^[a-z][a-z0-9]*_[a-z0-9]+$/i.test(match) &&
      match === match.toLowerCase()
    ) {
      return match;
    }
    if (base.length <= 2 && sub.length <= 2) {
      const subscripted = toSubscript(sub);
      if (subscripted === sub) return match;
      return `${base}${subscripted}`;
    }
    return match;
  });

  // Comparison operators
  result = result.replace(/(<|>)=/g, (m) =>
    m === "<=" ? "\u2264" : "\u2265",
  );
  result = result.replace(/!=/g, "\u2260");

  // Arrows
  result = result.replace(/<->/g, "\u2194");
  result = result.replace(/->/g, "\u2192");
  result = result.replace(/<-(?!>)/g, "\u2190");

  return result;
}

/** Parse inline markdown (bold, italic, code) into styled Text nodes */
function parseInlineMarkdown(
  text: string,
  baseStyle: TextStyle | undefined,
  keyPrefix: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code`
  const inlineRe = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      const plain = autoConvertMathPatterns(text.slice(lastIndex, match.index));
      nodes.push(
        <Text key={`${keyPrefix}-t${lastIndex}`} style={baseStyle}>
          {plain}
        </Text>,
      );
    }

    if (match[2] !== undefined) {
      // **bold**
      nodes.push(
        <Text
          key={`${keyPrefix}-b${match.index}`}
          style={[baseStyle, { fontWeight: "700" }]}
        >
          {autoConvertMathPatterns(match[2])}
        </Text>,
      );
    } else if (match[3] !== undefined) {
      // *italic*
      nodes.push(
        <Text
          key={`${keyPrefix}-i${match.index}`}
          style={[baseStyle, { fontStyle: "italic" }]}
        >
          {autoConvertMathPatterns(match[3])}
        </Text>,
      );
    } else if (match[4] !== undefined) {
      // `code`
      nodes.push(
        <Text
          key={`${keyPrefix}-c${match.index}`}
          style={[
            baseStyle,
            {
              fontFamily: "monospace",
              backgroundColor: "#E5E7EB",
              paddingHorizontal: 4,
              borderRadius: 3,
              fontSize: (baseStyle?.fontSize ?? 16) - 1,
            },
          ]}
        >
          {match[4]}
        </Text>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing text
  if (lastIndex < text.length) {
    const plain = autoConvertMathPatterns(text.slice(lastIndex));
    nodes.push(
      <Text key={`${keyPrefix}-t${lastIndex}`} style={baseStyle}>
        {plain}
      </Text>,
    );
  }

  return nodes.length > 0 ? nodes : [
    <Text key={`${keyPrefix}-plain`} style={baseStyle}>
      {autoConvertMathPatterns(text)}
    </Text>,
  ];
}

/** Convert a text segment (non-math) into styled React Native nodes with markdown support */
function renderMarkdownSegment(
  text: string,
  baseStyle: TextStyle | undefined,
  keyPrefix: string,
): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const lineKey = `${keyPrefix}-L${li}`;

    // Headers: ### Header
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1]!.length;
      const sizes = [22, 19, 17] as const;
      nodes.push(
        <Text
          key={lineKey}
          style={[
            baseStyle,
            {
              fontSize: sizes[level - 1] ?? 17,
              fontWeight: "700",
              marginTop: 8,
              marginBottom: 4,
            },
          ]}
        >
          {autoConvertMathPatterns(headerMatch[2]!)}
          {"\n"}
        </Text>,
      );
      continue;
    }

    // Bullet: - item or * item
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (bulletMatch) {
      const indent = Math.min(bulletMatch[1]!.length, 4) * 8;
      nodes.push(
        <Text key={lineKey} style={[baseStyle, { paddingLeft: 12 + indent }]}>
          {"\u2022 "}
          {parseInlineMarkdown(bulletMatch[2]!, baseStyle, lineKey)}
          {"\n"}
        </Text>,
      );
      continue;
    }

    // Numbered list: 1. item
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const indent = Math.min(numberedMatch[1]!.length, 4) * 8;
      nodes.push(
        <Text key={lineKey} style={[baseStyle, { paddingLeft: 12 + indent }]}>
          {`${numberedMatch[2]}. `}
          {parseInlineMarkdown(numberedMatch[3]!, baseStyle, lineKey)}
          {"\n"}
        </Text>,
      );
      continue;
    }

    // Regular line — parse inline markdown
    if (line.trim().length > 0) {
      nodes.push(
        <Text key={lineKey} style={baseStyle}>
          {parseInlineMarkdown(line, baseStyle, lineKey)}
          {li < lines.length - 1 ? "\n" : ""}
        </Text>,
      );
    } else if (li < lines.length - 1) {
      // Blank line — paragraph break
      nodes.push(
        <Text key={lineKey} style={{ fontSize: 8 }}>
          {"\n"}
        </Text>,
      );
    }
  }

  return nodes;
}

/**
 * MathText renders text with LaTeX math support.
 *
 * Parses LaTeX delimiters ($...$, $$...$$, \(...\), \[...\]) and
 * converts math to Unicode-approximated text. Also auto-converts
 * common patterns like 2^n, x_i, <=, >=, !=, and arrows.
 */
function MathTextInner({ text, style, containerStyle, inline }: MathTextProps) {
  if (!text) return null;

  const segments = parseSegments(text);
  const hasMath = segments.some((s) => s.type === "math");
  const hasDisplayMath = segments.some(
    (s) => s.type === "math" && s.display,
  );

  // Plain text — no math delimiters found
  if (!hasMath) {
    const content = renderMarkdownSegment(text, style, "root");
    if (containerStyle) {
      return <View style={containerStyle}>{content}</View>;
    }
    return <Text style={style}>{content}</Text>;
  }

  // Build elements for each segment
  const elements = segments.map((seg, i) => {
    if (seg.type === "text") {
      return (
        <Text key={i} style={style}>
          {parseInlineMarkdown(seg.value, style, `seg${i}`)}
        </Text>
      );
    }

    const converted = latexToUnicode(seg.value);

    if (seg.display) {
      return (
        <View
          key={i}
          style={{ width: "100%", alignItems: "center", paddingVertical: 4 }}
        >
          <Text
            style={[
              style,
              { fontStyle: "italic", fontSize: (style?.fontSize ?? 16) + 2 },
            ]}
          >
            {converted}
          </Text>
        </View>
      );
    }

    return (
      <Text key={i} style={[style, { fontStyle: "italic" }]}>
        {converted}
      </Text>
    );
  });

  // Must use View wrapper if display math is present (View can't nest in Text)
  // or if inline mode is requested
  if (inline || hasDisplayMath) {
    return (
      <View
        style={[
          inline
            ? { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" }
            : undefined,
          containerStyle,
        ]}
      >
        {elements}
      </View>
    );
  }

  // Inline-only math — safe to wrap in Text
  if (containerStyle) {
    return (
      <View style={containerStyle}>
        <Text style={style}>{elements}</Text>
      </View>
    );
  }

  return <Text style={style}>{elements}</Text>;
}

export const MathText = React.memo(MathTextInner);

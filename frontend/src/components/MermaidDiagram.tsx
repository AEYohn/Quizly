"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface MermaidDiagramProps {
    chart: string;
    dark?: boolean;
    className?: string;
}

const darkThemeVars = {
    primaryColor: "#00B8D4",
    primaryTextColor: "#fff",
    primaryBorderColor: "#26C6DA",
    lineColor: "#6b7280",
    secondaryColor: "#1E1E1E",
    tertiaryColor: "#2A2A2A",
    background: "#171717",
    mainBkg: "#1E1E1E",
    nodeBorder: "#26C6DA",
    clusterBkg: "#2A2A2A",
    clusterBorder: "#333333",
    titleColor: "#F5F5F5",
    edgeLabelBackground: "#1E1E1E",
};

const lightThemeVars = {
    primaryColor: "#00838F",
    primaryTextColor: "#1a1a1a",
    primaryBorderColor: "#00B8D4",
    lineColor: "#9ca3af",
    secondaryColor: "#f3f4f6",
    tertiaryColor: "#e5e7eb",
    background: "#ffffff",
    mainBkg: "#f9fafb",
    nodeBorder: "#00B8D4",
    clusterBkg: "#f3f4f6",
    clusterBorder: "#d1d5db",
    titleColor: "#111827",
    edgeLabelBackground: "#f9fafb",
};

// Initialize with dark defaults
mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: darkThemeVars,
    flowchart: { htmlLabels: true, curve: "basis" },
    securityLevel: "loose",
});

// Module-level cache: "dark|light:chart" → rendered SVG
const svgCache = new Map<string, string>();
let idCounter = 0;
let currentThemeIsDark = true;

function applyTheme(dark: boolean) {
    if (currentThemeIsDark === dark) return;
    currentThemeIsDark = dark;
    mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: dark ? darkThemeVars : lightThemeVars,
        flowchart: { htmlLabels: true, curve: "basis" },
        securityLevel: "loose",
    });
}

/**
 * Sanitize mermaid chart syntax so it works with mermaid v11+.
 */
function sanitizeMermaidChart(raw: string): string {
    let s = raw.trim();

    s = s.replace(/^```mermaid\s*\n?/i, "").replace(/\n?```\s*$/, "");
    s = s.replace(/[\u200B\uFEFF\u00A0]/g, " ");
    s = s.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

    s = s.replace(/(\w+)\[([^\]"]+)\]/g, (match, nodeId, label) => {
        if (/[:()|{}#;&]/.test(label)) return `${nodeId}["${label}"]`;
        return match;
    });

    s = s.replace(/(\w+)\(([^)"]+)\)/g, (match, nodeId, label) => {
        if (/^-/.test(nodeId)) return match;
        if (/[:|{}[\]#;&]/.test(label)) return `${nodeId}("${label}")`;
        return match;
    });

    s = s.replace(/(\w+)\{([^}"]+)\}/g, (match, nodeId, label) => {
        if (/[:()|[\]#;&]/.test(label)) return `${nodeId}{"${label}"}`;
        return match;
    });

    s = s.replace(/--\s+([^-|>"'\n][^->\n]*?)\s+(-->|---)/g, (match, label, arrow) => {
        if (label.startsWith('"') || label.startsWith("|")) return match;
        return `-- "${label.trim()}" ${arrow}`;
    });

    s = s.replace(/\|([^|"]+)\|/g, (match, label) => {
        if (/[:()"{}#;&]/.test(label)) return `|"${label}"|`;
        return match;
    });

    return s;
}

export function MermaidDiagram({ chart, dark = true, className = "" }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cacheKey = `${dark ? "d" : "l"}:${chart.trim()}`;
    const [svg, setSvg] = useState<string>(() => svgCache.get(cacheKey) ?? "");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (svgCache.has(cacheKey)) {
            setSvg(svgCache.get(cacheKey)!);
            setError(null);
            return;
        }

        let cancelled = false;
        const thisId = `mermaid-${++idCounter}`;

        const renderDiagram = async () => {
            const trimmed = chart.trim();
            if (!trimmed) {
                setError("Empty diagram");
                return;
            }

            applyTheme(dark);
            const sanitized = sanitizeMermaidChart(trimmed);

            try {
                const { svg: renderedSvg } = await mermaid.render(thisId, sanitized);
                if (!cancelled) {
                    svgCache.set(cacheKey, renderedSvg);
                    setSvg(renderedSvg);
                    setError(null);
                }
            } catch {
                try {
                    const raw = trimmed
                        .replace(/^```mermaid\s*\n?/i, "")
                        .replace(/\n?```\s*$/, "");
                    const { svg: renderedSvg } = await mermaid.render(`${thisId}-raw`, raw);
                    if (!cancelled) {
                        svgCache.set(cacheKey, renderedSvg);
                        setSvg(renderedSvg);
                        setError(null);
                    }
                } catch (err2) {
                    console.warn("Mermaid rendering error:", err2);
                    if (!cancelled) setError(err2 instanceof Error ? err2.message : "Failed to render diagram");
                }
            }
        };

        renderDiagram();
        return () => { cancelled = true; };
    }, [chart, dark, cacheKey]);

    if (error) {
        return (
            <div className={`bg-red-500/10 border border-red-500/30 rounded-lg p-4 ${className}`}>
                <p className="text-red-400 text-sm">Diagram error: {error}</p>
                <pre className="mt-2 text-xs text-gray-500 overflow-x-auto">{chart}</pre>
            </div>
        );
    }

    if (!svg) {
        return (
            <div className={`${dark ? "bg-neutral-800" : "bg-gray-100"} rounded-lg p-4 animate-pulse ${className}`}>
                <div className={`h-32 flex items-center justify-center ${dark ? "text-gray-500" : "text-gray-400"}`}>
                    Loading diagram...
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`mermaid-container ${dark ? "bg-neutral-900/50" : "bg-gray-50"} rounded-lg p-4 overflow-x-auto ${className}`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

export default MermaidDiagram;

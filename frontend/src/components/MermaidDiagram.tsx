"use client";

import { useEffect, useRef, useState, useId } from "react";
import mermaid from "mermaid";

interface MermaidDiagramProps {
    chart: string;
    className?: string;
}

// Initialize mermaid with dark theme
mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
        primaryColor: "#3b82f6",
        primaryTextColor: "#fff",
        primaryBorderColor: "#60a5fa",
        lineColor: "#6b7280",
        secondaryColor: "#1f2937",
        tertiaryColor: "#374151",
        background: "#111827",
        mainBkg: "#1f2937",
        nodeBorder: "#60a5fa",
        clusterBkg: "#374151",
        clusterBorder: "#4b5563",
        titleColor: "#f3f4f6",
        edgeLabelBackground: "#1f2937",
    },
    flowchart: {
        htmlLabels: true,
        curve: "basis",
    },
    securityLevel: "loose",
});

/**
 * Sanitize mermaid chart syntax so it works with mermaid v11+.
 *
 * LLMs frequently generate mermaid that uses unquoted special characters,
 * HTML entities, or markdown artefacts that choke the parser.
 */
function sanitizeMermaidChart(raw: string): string {
    let s = raw.trim();

    // Strip wrapping ```mermaid / ``` fences the LLM sometimes double-wraps
    s = s.replace(/^```mermaid\s*\n?/i, "").replace(/\n?```\s*$/, "");

    // Remove zero-width spaces, BOM, and non-breaking spaces
    s = s.replace(/[\u200B\uFEFF\u00A0]/g, " ");

    // Replace HTML entities that LLMs sometimes emit
    s = s.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

    // Quote labels inside [...] that contain special chars and aren't already quoted
    s = s.replace(/(\w+)\[([^\]"]+)\]/g, (match, nodeId, label) => {
        if (/[:()|{}#;&]/.test(label)) return `${nodeId}["${label}"]`;
        return match;
    });

    // Quote labels inside (...) that contain special chars and aren't already quoted
    s = s.replace(/(\w+)\(([^)"]+)\)/g, (match, nodeId, label) => {
        // Skip arrow syntax like -->
        if (/^-/.test(nodeId)) return match;
        if (/[:|{}[\]#;&]/.test(label)) return `${nodeId}("${label}")`;
        return match;
    });

    // Quote labels inside {...} that contain special chars and aren't already quoted
    s = s.replace(/(\w+)\{([^}"]+)\}/g, (match, nodeId, label) => {
        if (/[:()|[\]#;&]/.test(label)) return `${nodeId}{"${label}"}`;
        return match;
    });

    // Quote unquoted edge labels: -- text --> or -- text ---
    // Mermaid v11 requires edge labels be quoted when they contain special chars
    s = s.replace(/--\s+([^-|>"'\n][^->\n]*?)\s+(-->|---)/g, (match, label, arrow) => {
        if (label.startsWith('"') || label.startsWith("|")) return match;
        return `-- "${label.trim()}" ${arrow}`;
    });

    // Quote pipe-delimited edge labels that contain special chars: |text|
    s = s.replace(/\|([^|"]+)\|/g, (match, label) => {
        if (/[:()"{}#;&]/.test(label)) return `|"${label}"|`;
        return match;
    });

    return s;
}

export function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const id = useId().replace(/:/g, "_");

    useEffect(() => {
        let cancelled = false;
        const renderDiagram = async () => {
            if (!chart.trim()) {
                setError("Empty diagram");
                return;
            }

            const sanitized = sanitizeMermaidChart(chart);

            try {
                const { svg: renderedSvg } = await mermaid.render(`mermaid-${id}`, sanitized);
                if (!cancelled) { setSvg(renderedSvg); setError(null); }
            } catch {
                // If sanitized version fails, try raw as fallback
                try {
                    const raw = chart.trim()
                        .replace(/^```mermaid\s*\n?/i, "")
                        .replace(/\n?```\s*$/, "");
                    const { svg: renderedSvg } = await mermaid.render(`mermaid-${id}-raw`, raw);
                    if (!cancelled) { setSvg(renderedSvg); setError(null); }
                } catch (err2) {
                    console.warn("Mermaid rendering error:", err2);
                    if (!cancelled) setError(err2 instanceof Error ? err2.message : "Failed to render diagram");
                }
            }
        };

        renderDiagram();
        return () => { cancelled = true; };
    }, [chart, id]);

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
            <div className={`bg-gray-800 rounded-lg p-4 animate-pulse ${className}`}>
                <div className="h-32 flex items-center justify-center text-gray-500">
                    Loading diagram...
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`mermaid-container bg-gray-900/50 rounded-lg p-4 overflow-x-auto ${className}`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

export default MermaidDiagram;

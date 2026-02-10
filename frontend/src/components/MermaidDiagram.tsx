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
 * Sanitize mermaid chart syntax by quoting node labels that contain
 * special characters (colons, parentheses, pipes, etc.) which would
 * otherwise confuse the parser.
 */
function sanitizeMermaidChart(raw: string): string {
    let s = raw;

    // Quote labels inside [...] that contain special chars and aren't already quoted
    s = s.replace(/(\w+)\[([^\]"]+)\]/g, (match, nodeId, label) => {
        if (/[:()|{}]/.test(label)) return `${nodeId}["${label}"]`;
        return match;
    });

    // Quote labels inside (...) that contain special chars and aren't already quoted
    s = s.replace(/(\w+)\(([^)"]+)\)/g, (match, nodeId, label) => {
        // Skip arrow syntax like -->
        if (/^-/.test(nodeId)) return match;
        if (/[:|{}[\]]/.test(label)) return `${nodeId}("${label}")`;
        return match;
    });

    // Quote labels inside {...} that contain special chars and aren't already quoted
    s = s.replace(/(\w+)\{([^}"]+)\}/g, (match, nodeId, label) => {
        if (/[:()|[\]]/.test(label)) return `${nodeId}{"${label}"}`;
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
        const renderDiagram = async () => {
            if (!chart.trim()) {
                setError("Empty diagram");
                return;
            }

            try {
                // Try rendering with sanitized labels first
                const sanitized = sanitizeMermaidChart(chart.trim());
                const { svg: renderedSvg } = await mermaid.render(`mermaid-${id}`, sanitized);
                setSvg(renderedSvg);
                setError(null);
            } catch {
                // If sanitized version fails, try raw as fallback
                try {
                    const { svg: renderedSvg } = await mermaid.render(`mermaid-${id}-raw`, chart.trim());
                    setSvg(renderedSvg);
                    setError(null);
                } catch (err2) {
                    console.error("Mermaid rendering error:", err2);
                    setError(err2 instanceof Error ? err2.message : "Failed to render diagram");
                }
            }
        };

        renderDiagram();
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

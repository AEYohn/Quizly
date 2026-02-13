"use client";

import { cn } from "~/lib/utils";
import type { CalibrationBucket } from "~/lib/api";

interface CalibrationChartProps {
    buckets: CalibrationBucket[];
    brierScore: number;
    overconfidenceIndex: number;
    totalResponses: number;
}

const CHART_W = 280;
const CHART_H = 200;
const PAD = { top: 20, right: 20, bottom: 30, left: 35 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function toX(frac: number) {
    return PAD.left + frac * PLOT_W;
}
function toY(frac: number) {
    return PAD.top + (1 - frac) * PLOT_H;
}

export function CalibrationChart({ buckets, brierScore, overconfidenceIndex, totalResponses }: CalibrationChartProps) {
    // Filter to buckets with data for the student curve
    const dataPoints = buckets.filter((b) => b.count > 0);

    // Build SVG path for student curve
    const pathPoints = dataPoints.map((b) => ({
        x: toX(b.midpoint),
        y: toY(b.accuracy),
    }));
    const pathD = pathPoints.length > 1
        ? `M ${pathPoints.map((p) => `${p.x},${p.y}`).join(" L ")}`
        : "";

    // Overconfidence zone: area below the diagonal (where confidence > accuracy)
    const diagPoints = [
        { x: toX(0), y: toY(0) },
        { x: toX(1), y: toY(1) },
        { x: toX(1), y: toY(0) },
    ];
    const overconfZone = `M ${diagPoints.map((p) => `${p.x},${p.y}`).join(" L ")} Z`;

    // Underconfidence zone: above the diagonal
    const underconfPoints = [
        { x: toX(0), y: toY(0) },
        { x: toX(0), y: toY(1) },
        { x: toX(1), y: toY(1) },
    ];
    const underconfZone = `M ${underconfPoints.map((p) => `${p.x},${p.y}`).join(" L ")} Z`;

    return (
        <div className="space-y-3">
            <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full max-w-[280px] mx-auto"
                style={{ height: "auto" }}
            >
                {/* Background */}
                <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} fill="rgba(255,255,255,0.02)" rx="4" />

                {/* Zones */}
                <path d={underconfZone} fill="rgba(52,211,153,0.04)" />
                <path d={overconfZone} fill="rgba(239,68,68,0.04)" />

                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                    <g key={v}>
                        <line
                            x1={toX(0)} y1={toY(v)} x2={toX(1)} y2={toY(v)}
                            stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"
                        />
                        <line
                            x1={toX(v)} y1={toY(0)} x2={toX(v)} y2={toY(1)}
                            stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"
                        />
                    </g>
                ))}

                {/* Perfect calibration diagonal (dashed) */}
                <line
                    x1={toX(0)} y1={toY(0)} x2={toX(1)} y2={toY(1)}
                    stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 3"
                />

                {/* Student curve */}
                {pathD && (
                    <path
                        d={pathD}
                        fill="none"
                        stroke="#26C6DA"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: "drop-shadow(0 0 4px rgba(167,139,250,0.4))" }}
                    />
                )}

                {/* Data points */}
                {pathPoints.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x} cy={p.y} r="3.5"
                        fill="#26C6DA"
                        stroke="#1e1b2e"
                        strokeWidth="1.5"
                    />
                ))}

                {/* Y-axis labels */}
                {[0, 50, 100].map((v) => (
                    <text key={`y-${v}`} x={PAD.left - 4} y={toY(v / 100) + 3} textAnchor="end" className="text-[9px] fill-gray-600">
                        {v}%
                    </text>
                ))}

                {/* X-axis labels */}
                {[0, 50, 100].map((v) => (
                    <text key={`x-${v}`} x={toX(v / 100)} y={toY(0) + 14} textAnchor="middle" className="text-[9px] fill-gray-600">
                        {v}%
                    </text>
                ))}

                {/* Axis labels */}
                <text x={toX(0.5)} y={CHART_H - 2} textAnchor="middle" className="text-[9px] fill-gray-500 font-medium">
                    Confidence
                </text>
                <text
                    x={8} y={toY(0.5)}
                    textAnchor="middle"
                    className="text-[9px] fill-gray-500 font-medium"
                    transform={`rotate(-90, 8, ${toY(0.5)})`}
                >
                    Accuracy
                </text>
            </svg>

            {/* Summary stats */}
            <div className="flex items-center justify-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    <span className="text-gray-500">Brier</span>
                    <span className={cn(
                        "font-bold tabular-nums",
                        brierScore < 0.15 ? "text-emerald-400" : brierScore < 0.25 ? "text-amber-400" : "text-red-400",
                    )}>
                        {brierScore.toFixed(2)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-gray-500">Overconf.</span>
                    <span className={cn(
                        "font-bold tabular-nums",
                        overconfidenceIndex < 0.1 ? "text-emerald-400" : overconfidenceIndex < 0.2 ? "text-amber-400" : "text-red-400",
                    )}>
                        {overconfidenceIndex.toFixed(2)}
                    </span>
                </div>
                <div className="text-gray-600 tabular-nums">
                    {totalResponses} Qs
                </div>
            </div>
        </div>
    );
}

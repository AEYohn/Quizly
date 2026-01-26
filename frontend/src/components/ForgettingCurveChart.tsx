"use client";

import { useMemo } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import { Brain, Calendar, AlertTriangle, CheckCircle } from "lucide-react";

interface ConceptRetention {
    concept: string;
    lastPracticed: string; // ISO date
    initialAccuracy: number; // 0-1
    stability: number; // days until 50% retention
    practiceCount: number;
}

interface ForgettingCurveChartProps {
    concepts: ConceptRetention[];
    className?: string;
}

// Ebbinghaus forgetting curve: R = e^(-t/S)
function calculateRetention(daysElapsed: number, stability: number, initialAccuracy: number): number {
    if (stability === 0) return initialAccuracy;
    return initialAccuracy * Math.exp(-daysElapsed / stability);
}

// Calculate days until retention drops to target
function daysToReview(stability: number, initialAccuracy: number, targetRetention: number = 0.8): number {
    if (initialAccuracy <= targetRetention || stability === 0) return 0;
    const ratio = targetRetention / initialAccuracy;
    if (ratio <= 0) return 0;
    return Math.max(0, Math.round(-stability * Math.log(ratio)));
}

export function ForgettingCurveChart({ concepts, className = "" }: ForgettingCurveChartProps) {
    const chartData = useMemo(() => {
        // Generate data points for the next 30 days
        const data = [];
        for (let day = 0; day <= 30; day++) {
            const point: Record<string, number | string> = { day };
            concepts.forEach((concept, idx) => {
                const daysElapsed = day;
                const retention = calculateRetention(daysElapsed, concept.stability, concept.initialAccuracy) * 100;
                point[`concept_${idx}`] = Math.round(retention);
            });
            data.push(point);
        }
        return data;
    }, [concepts]);

    const conceptAnalysis = useMemo(() => {
        return concepts.map((concept) => {
            const lastPracticed = new Date(concept.lastPracticed);
            const today = new Date();
            const daysSincePractice = Math.floor((today.getTime() - lastPracticed.getTime()) / (1000 * 60 * 60 * 24));
            const currentRetention = calculateRetention(daysSincePractice, concept.stability, concept.initialAccuracy);
            const reviewDays = daysToReview(concept.stability, concept.initialAccuracy, 0.7);
            const needsReview = daysSincePractice >= reviewDays;

            return {
                ...concept,
                daysSincePractice,
                currentRetention,
                reviewDays,
                needsReview,
            };
        });
    }, [concepts]);

    const colors = [
        { stroke: "#10b981", fill: "#10b981" },
        { stroke: "#8b5cf6", fill: "#8b5cf6" },
        { stroke: "#f59e0b", fill: "#f59e0b" },
        { stroke: "#ef4444", fill: "#ef4444" },
        { stroke: "#3b82f6", fill: "#3b82f6" },
    ];

    if (concepts.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
                <Brain className="h-12 w-12 text-gray-600 mb-3" />
                <p className="text-gray-500">No retention data yet</p>
                <p className="text-sm text-gray-600 mt-1">Practice concepts to track retention over time</p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
                    <p className="text-white font-medium mb-2">Day {label}</p>
                    <div className="space-y-1">
                        {payload.map((entry: any, idx: number) => (
                            <p key={idx} style={{ color: entry.color }} className="text-sm">
                                {concepts[idx]?.concept}: {entry.value}%
                            </p>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={className}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-400" />
                    Memory Retention Forecast
                </h3>
            </div>

            {/* Chart */}
            <div className="h-56 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            {colors.map((color, idx) => (
                                <linearGradient key={idx} id={`gradient_${idx}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color.fill} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={color.fill} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis
                            dataKey="day"
                            tick={{ fill: "#9ca3af", fontSize: 11 }}
                            axisLine={{ stroke: "#374151" }}
                            tickLine={false}
                            label={{ value: "Days from now", position: "insideBottom", offset: -5, fill: "#6b7280", fontSize: 11 }}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fill: "#9ca3af", fontSize: 11 }}
                            axisLine={{ stroke: "#374151" }}
                            tickLine={false}
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Review threshold", fill: "#ef4444", fontSize: 10 }} />
                        {concepts.map((concept, idx) => {
                            const color = colors[idx % colors.length];
                            return (
                                <Area
                                    key={idx}
                                    type="monotone"
                                    dataKey={`concept_${idx}`}
                                    name={concept.concept}
                                    stroke={color?.stroke || "#10b981"}
                                    strokeWidth={2}
                                    fill={`url(#gradient_${idx})`}
                                    dot={false}
                                />
                            );
                        })}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Legend & Status */}
            <div className="space-y-2">
                {conceptAnalysis.map((concept, idx) => {
                    const color = colors[idx % colors.length];
                    return (
                    <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                            concept.needsReview ? "bg-red-500/10 border border-red-500/30" : "bg-gray-800/50"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: color?.stroke || "#10b981" }}
                            />
                            <div>
                                <p className="text-white text-sm font-medium">{concept.concept}</p>
                                <p className="text-xs text-gray-500">
                                    Practiced {concept.daysSincePractice} days ago ({concept.practiceCount} times)
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className={`text-sm font-medium ${
                                    concept.currentRetention > 0.7 ? "text-emerald-400" :
                                    concept.currentRetention > 0.5 ? "text-amber-400" : "text-red-400"
                                }`}>
                                    {Math.round(concept.currentRetention * 100)}%
                                </p>
                                <p className="text-xs text-gray-500">estimated retention</p>
                            </div>
                            {concept.needsReview ? (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
                                    <AlertTriangle className="h-3 w-3" />
                                    Review now
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                                    <CheckCircle className="h-3 w-3" />
                                    Good
                                </div>
                            )}
                        </div>
                    </div>
                    );
                })}
            </div>

            {/* Review Schedule */}
            <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-400">Spaced Repetition Schedule</span>
                </div>
                <p className="text-xs text-gray-400">
                    Based on the Ebbinghaus forgetting curve, concepts are scheduled for review before retention drops below 70%.
                    Regular practice increases stability, extending time between reviews.
                </p>
            </div>
        </div>
    );
}

export default ForgettingCurveChart;

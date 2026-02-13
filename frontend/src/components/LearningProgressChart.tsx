"use client";

import { useMemo } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
    Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface HistoryPoint {
    timestamp: string;
    difficulty: number;
    accuracy: number;
    reason?: string;
}

interface LearningProgressChartProps {
    difficultyHistory: HistoryPoint[];
    className?: string;
}

export function LearningProgressChart({
    difficultyHistory,
    className = "",
}: LearningProgressChartProps) {
    const chartData = useMemo(() => {
        if (!difficultyHistory || difficultyHistory.length === 0) return [];

        return difficultyHistory.map((point, index) => {
            const date = new Date(point.timestamp);
            return {
                index: index + 1,
                date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                accuracy: Math.round(point.accuracy * 100),
                difficulty: Math.round(point.difficulty * 100),
                reason: point.reason || "",
            };
        });
    }, [difficultyHistory]);

    const trend = useMemo(() => {
        if (chartData.length < 2) return "neutral";
        const recent = chartData.slice(-5);
        const avgRecent = recent.reduce((a, b) => a + b.accuracy, 0) / recent.length;
        const older = chartData.slice(0, Math.min(5, chartData.length));
        const avgOlder = older.reduce((a, b) => a + b.accuracy, 0) / older.length;

        if (avgRecent > avgOlder + 5) return "up";
        if (avgRecent < avgOlder - 5) return "down";
        return "neutral";
    }, [chartData]);

    if (chartData.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
                <div className="text-gray-500 text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No learning history yet</p>
                    <p className="text-sm mt-1">Complete quizzes to see your progress over time</p>
                </div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
                    <p className="text-white font-medium mb-1">
                        {data.date} at {data.time}
                    </p>
                    <div className="space-y-1 text-sm">
                        <p className="text-emerald-400">
                            Accuracy: {data.accuracy}%
                        </p>
                        <p className="text-teal-400">
                            Difficulty: {data.difficulty}%
                        </p>
                        {data.reason && (
                            <p className="text-gray-400 text-xs mt-2 max-w-[200px]">
                                {data.reason}
                            </p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={className}>
            {/* Trend Indicator */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Progress Over Time</h3>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${
                    trend === "up"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : trend === "down"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-gray-500/20 text-gray-400"
                }`}>
                    {trend === "up" && <TrendingUp className="h-3.5 w-3.5" />}
                    {trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
                    {trend === "neutral" && <Minus className="h-3.5 w-3.5" />}
                    <span>
                        {trend === "up" ? "Improving" : trend === "down" ? "Needs Focus" : "Steady"}
                    </span>
                </div>
            </div>

            {/* Chart */}
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="difficultyGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00B8D4" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#00B8D4" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis
                            dataKey="index"
                            tick={{ fill: "#9ca3af", fontSize: 12 }}
                            axisLine={{ stroke: "#374151" }}
                            tickLine={false}
                            label={{ value: "Question #", position: "insideBottom", offset: -5, fill: "#6b7280", fontSize: 11 }}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fill: "#9ca3af", fontSize: 12 }}
                            axisLine={{ stroke: "#374151" }}
                            tickLine={false}
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="top"
                            height={36}
                            formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
                        />
                        <Area
                            type="monotone"
                            dataKey="accuracy"
                            name="Accuracy"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="url(#accuracyGradient)"
                            dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5, fill: "#10b981" }}
                        />
                        <Area
                            type="monotone"
                            dataKey="difficulty"
                            name="Difficulty"
                            stroke="#00B8D4"
                            strokeWidth={2}
                            fill="url(#difficultyGradient)"
                            dot={{ fill: "#00B8D4", strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5, fill: "#00B8D4" }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Stats Summary */}
            {chartData.length > 0 && (() => {
                const lastData = chartData[chartData.length - 1];
                return (
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-400">
                            {Math.round(chartData.reduce((a, b) => a + b.accuracy, 0) / chartData.length)}%
                        </p>
                        <p className="text-xs text-gray-500">Avg Accuracy</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-teal-400">
                            {lastData?.difficulty ?? 0}%
                        </p>
                        <p className="text-xs text-gray-500">Current Difficulty</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-sky-400">
                            {chartData.length}
                        </p>
                        <p className="text-xs text-gray-500">Questions</p>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}

export default LearningProgressChart;

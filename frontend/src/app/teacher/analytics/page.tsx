"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Users,
    Brain,
    Target,
    AlertTriangle,
    Clock,
    BarChart3,
    PieChart,
    Activity,
    Lightbulb,
    RefreshCw,
} from "lucide-react";
import { Button, Card, Badge, Progress } from "~/components/ui";

// Local types for this page's analytics data
interface AnalyticsData {
    session_id?: string;
    total_questions: number;
    total_responses: number;
    accuracy_rate: number;
    average_confidence: number;
    confidence_accuracy_correlation: number;
    engagement_score: number;
    misconception_patterns: { concept: string; frequency: number; common_error: string }[];
}

interface MisconceptionClusterData {
    cluster_id: string;
    concept: string;
    misconception_type: string;
    affected_students: string[];
    common_wrong_answers: string[];
    suggested_intervention: string;
    severity: "high" | "medium" | "low";
}

export default function AnalyticsDashboardPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [misconceptions, setMisconceptions] = useState<MisconceptionClusterData[]>([]);
    const [selectedTimeRange, setSelectedTimeRange] = useState<"day" | "week" | "month">("week");

    useEffect(() => {
        loadAnalytics();
    }, [selectedTimeRange]);

    const loadAnalytics = async () => {
        setIsLoading(true);
        
        // In a real app, these would fetch actual data
        // For now, we'll simulate some analytics data
        
        // Simulate loading
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setAnalytics({
            session_id: "overview",
            total_questions: 45,
            total_responses: 234,
            accuracy_rate: 0.68,
            average_confidence: 62,
            confidence_accuracy_correlation: 0.72,
            engagement_score: 0.85,
            misconception_patterns: [
                { concept: "Recursion", frequency: 12, common_error: "Base case confusion" },
                { concept: "Big-O Notation", frequency: 8, common_error: "Constant factors" },
                { concept: "Probability", frequency: 6, common_error: "Independence assumption" },
            ],
            question_analytics: [],
        });

        setMisconceptions([
            {
                cluster_id: "1",
                concept: "Recursion",
                misconception_type: "Base Case Confusion",
                affected_students: ["Alice", "Bob", "Charlie", "Diana"],
                common_wrong_answers: ["B", "D"],
                suggested_intervention: "Review base case examples with visual tree diagrams",
                severity: "high",
            },
            {
                cluster_id: "2", 
                concept: "Big-O Notation",
                misconception_type: "Ignoring Constant Factors",
                affected_students: ["Eve", "Frank"],
                common_wrong_answers: ["A"],
                suggested_intervention: "Clarify that Big-O ignores constants for asymptotic analysis",
                severity: "medium",
            },
            {
                cluster_id: "3",
                concept: "Graph Traversal",
                misconception_type: "BFS vs DFS Confusion",
                affected_students: ["Grace", "Henry", "Ivan"],
                common_wrong_answers: ["C", "D"],
                suggested_intervention: "Use animation to show queue vs stack behavior",
                severity: "medium",
            },
        ]);
        
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <RefreshCw className="mx-auto mb-4 h-12 w-12 animate-spin text-indigo-600" />
                    <p className="text-xl text-gray-600">Loading analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50">
            {/* Header */}
            <header className="border-b bg-white/80 backdrop-blur-sm px-6 py-4">
                <div className="mx-auto max-w-7xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/teacher" className="text-gray-400 hover:text-gray-600">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                            <p className="text-sm text-gray-500">Insights from your teaching sessions</p>
                        </div>
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex rounded-lg bg-gray-100 p-1">
                        {(["day", "week", "month"] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setSelectedTimeRange(range)}
                                className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                                    selectedTimeRange === range
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900"
                                }`}
                            >
                                {range.charAt(0).toUpperCase() + range.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl p-6">
                {/* Overview Stats */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <StatCard
                        icon={<BarChart3 className="h-6 w-6" />}
                        label="Total Questions"
                        value={analytics?.total_questions || 0}
                        trend={+12}
                        color="indigo"
                    />
                    <StatCard
                        icon={<Users className="h-6 w-6" />}
                        label="Total Responses"
                        value={analytics?.total_responses || 0}
                        trend={+8}
                        color="green"
                    />
                    <StatCard
                        icon={<Target className="h-6 w-6" />}
                        label="Accuracy Rate"
                        value={`${Math.round((analytics?.accuracy_rate || 0) * 100)}%`}
                        trend={+5}
                        color="purple"
                    />
                    <StatCard
                        icon={<Activity className="h-6 w-6" />}
                        label="Engagement"
                        value={`${Math.round((analytics?.engagement_score || 0) * 100)}%`}
                        trend={+3}
                        color="amber"
                    />
                </div>

                <div className="grid grid-cols-3 gap-6">
                    {/* Confidence-Accuracy Insight */}
                    <Card className="col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Confidence vs Accuracy Trend</h2>
                            <Badge variant="success">
                                {((analytics?.confidence_accuracy_correlation || 0) * 100).toFixed(0)}% correlated
                            </Badge>
                        </div>

                        {/* Simple bar chart visualization */}
                        <div className="space-y-4">
                            {[
                                { label: "High Confidence + Correct", value: 45, color: "bg-green-500" },
                                { label: "High Confidence + Wrong", value: 15, color: "bg-red-500" },
                                { label: "Low Confidence + Correct", value: 20, color: "bg-blue-500" },
                                { label: "Low Confidence + Wrong", value: 20, color: "bg-gray-400" },
                            ].map((item) => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">{item.label}</span>
                                        <span className="font-medium">{item.value}%</span>
                                    </div>
                                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                            className={`h-full ${item.color} transition-all duration-500`}
                                            style={{ width: `${item.value}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                            <div className="flex items-start gap-3">
                                <Lightbulb className="h-5 w-5 text-indigo-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-indigo-900">Insight</p>
                                    <p className="text-sm text-indigo-700">
                                        15% of students show high confidence but answer incorrectly. 
                                        Consider targeting these misconceptions with peer discussion.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Average Confidence */}
                    <Card>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Confidence Distribution</h2>
                        
                        <div className="relative pt-4">
                            <div className="flex items-end justify-center gap-2 h-40">
                                {[
                                    { range: "0-20", value: 8 },
                                    { range: "20-40", value: 15 },
                                    { range: "40-60", value: 35 },
                                    { range: "60-80", value: 28 },
                                    { range: "80-100", value: 14 },
                                ].map((bar, i) => (
                                    <div key={bar.range} className="flex flex-col items-center flex-1">
                                        <div
                                            className="w-full bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-lg transition-all duration-500"
                                            style={{ height: `${bar.value * 3}px` }}
                                        />
                                        <span className="text-xs text-gray-500 mt-2">{bar.range}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 text-center">
                            <div className="text-3xl font-bold text-gray-900">
                                {analytics?.average_confidence || 0}%
                            </div>
                            <div className="text-sm text-gray-500">Average Confidence</div>
                        </div>
                    </Card>
                </div>

                {/* Misconception Clusters */}
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Misconception Clusters</h2>
                            <p className="text-sm text-gray-500">Common errors and suggested interventions</p>
                        </div>
                        <Badge variant="warning" dot>{misconceptions.length} clusters found</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        {misconceptions.map((cluster) => (
                            <Card 
                                key={cluster.cluster_id}
                                className={`border-l-4 ${
                                    cluster.severity === "high" 
                                        ? "border-l-red-500" 
                                        : cluster.severity === "medium"
                                        ? "border-l-amber-500"
                                        : "border-l-blue-500"
                                }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <Badge 
                                            variant={
                                                cluster.severity === "high" ? "danger" : 
                                                cluster.severity === "medium" ? "warning" : "info"
                                            }
                                        >
                                            {cluster.severity}
                                        </Badge>
                                        <h3 className="mt-2 font-semibold text-gray-900">{cluster.concept}</h3>
                                    </div>
                                    <AlertTriangle className={`h-5 w-5 ${
                                        cluster.severity === "high" ? "text-red-500" : "text-amber-500"
                                    }`} />
                                </div>

                                <p className="text-sm text-gray-600 mb-3">{cluster.misconception_type}</p>

                                <div className="flex items-center gap-2 mb-3">
                                    <Users className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-500">
                                        {cluster.affected_students.length} students affected
                                    </span>
                                </div>

                                <div className="p-3 rounded-lg bg-gray-50 mb-3">
                                    <p className="text-xs font-medium text-gray-500 mb-1">Common wrong answers</p>
                                    <div className="flex gap-2">
                                        {cluster.common_wrong_answers.map((ans) => (
                                            <span key={ans} className="px-2 py-1 rounded bg-red-100 text-red-700 text-sm font-medium">
                                                {ans}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-3 rounded-lg bg-green-50">
                                    <p className="text-xs font-medium text-green-700 mb-1">💡 Suggested Intervention</p>
                                    <p className="text-sm text-green-800">{cluster.suggested_intervention}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Concept Mastery Overview */}
                <div className="mt-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Concept Mastery Overview</h2>
                    
                    <Card>
                        <div className="space-y-4">
                            {[
                                { concept: "Arrays & Loops", mastery: 85, students: 24 },
                                { concept: "Recursion", mastery: 62, students: 24 },
                                { concept: "Big-O Notation", mastery: 71, students: 24 },
                                { concept: "Graph Traversal", mastery: 58, students: 24 },
                                { concept: "Dynamic Programming", mastery: 45, students: 18 },
                            ].map((item) => (
                                <div key={item.concept} className="flex items-center gap-4">
                                    <div className="w-48 font-medium text-gray-700">{item.concept}</div>
                                    <div className="flex-1">
                                        <Progress 
                                            value={item.mastery} 
                                            color={item.mastery >= 70 ? "success" : item.mastery >= 50 ? "warning" : "danger"}
                                            size="lg"
                                            showValue
                                        />
                                    </div>
                                    <div className="w-24 text-right text-sm text-gray-500">
                                        {item.students} students
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Stat card component
function StatCard({
    icon,
    label,
    value,
    trend,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    trend: number;
    color: "indigo" | "green" | "purple" | "amber";
}) {
    const colorClasses = {
        indigo: "bg-indigo-50 text-indigo-600",
        green: "bg-green-50 text-green-600",
        purple: "bg-purple-50 text-purple-600",
        amber: "bg-amber-50 text-amber-600",
    };

    return (
        <Card className="relative overflow-hidden">
            <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                    {icon}
                </div>
                <div className={`flex items-center gap-1 text-sm ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
                    {trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {Math.abs(trend)}%
                </div>
            </div>
            <div className="mt-4">
                <div className="text-3xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-500">{label}</div>
            </div>
        </Card>
    );
}

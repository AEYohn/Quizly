"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    BarChart3,
    Users,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Brain,
    Target,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Download,
    RefreshCw,
    Loader2,
    PieChart,
    Activity
} from "lucide-react";
import { Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface GameAnalytics {
    game_id: string;
    quiz_title: string;
    game_code: string;
    total_players: number;
    class_accuracy: number;
    class_avg_confidence: number;
    calibration_summary: {
        well_calibrated: number;
        overconfident: number;
        underconfident: number;
    };
    misconception_clusters: Array<{
        question_text: string;
        question_index: number;
        wrong_answer: string;
        count: number;
        percentage: number;
        students: string[];
        common_reasoning: string[];
    }>;
    intervention_alerts: Array<{
        type: string;
        severity: "low" | "medium" | "high";
        message: string;
        affected_students: string[];
        suggested_action: string;
    }>;
    question_performance: Array<{
        question_index: number;
        question_text: string;
        correct_rate: number;
        avg_confidence: number;
        avg_time_ms: number;
        answer_distribution: { [key: string]: number };
    }>;
    student_performance: Array<{
        player_id: string;
        nickname: string;
        score: number;
        accuracy: number;
        avg_confidence: number;
        calibration_status: string;
        misconception_count: number;
    }>;
}

function TeacherAnalyticsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const gameId = searchParams.get("game");

    const [games, setGames] = useState<Array<{ id: string; quiz_title: string; game_code: string; status: string }>>([]);
    const [selectedGame, setSelectedGame] = useState<string | null>(gameId);
    const [analytics, setAnalytics] = useState<GameAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "questions" | "students" | "misconceptions">("overview");
    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/sign-in");
            return;
        }
        fetchGames(token);
    }, [router]);

    useEffect(() => {
        if (selectedGame) {
            fetchAnalytics(selectedGame);
        }
    }, [selectedGame]);

    const fetchGames = async (token: string) => {
        try {
            const response = await fetch(`${API_URL}/games`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setGames(data);
                if (data.length > 0 && !selectedGame) {
                    setSelectedGame(data[0].id);
                }
            }
        } catch (err) {
            console.error("Failed to fetch games:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async (gameId: string) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/${gameId}/class-analytics`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (response.ok) {
                const data = await response.json();
                setAnalytics(data);
            } else {
                console.error("Failed to fetch analytics:", response.status);
            }
        } catch (err) {
            console.error("Failed to fetch analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleQuestion = (index: number) => {
        setExpandedQuestions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    if (loading && !analytics) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-sky-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="bg-gray-900 border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <BarChart3 className="h-7 w-7 text-sky-400" />
                            Class Analytics
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Track student performance and identify learning gaps</p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Game Selector */}
                <div className="flex items-center justify-end gap-3 mb-8">
                    <select
                        value={selectedGame || ""}
                        onChange={(e) => setSelectedGame(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        {games.map(game => (
                            <option key={game.id} value={game.id} className="bg-gray-800">
                                {game.quiz_title} ({game.game_code})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => selectedGame && fetchAnalytics(selectedGame)}
                        className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                </div>

                {analytics && (
                    <>
                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <StatCard
                                icon={<Users className="h-6 w-6 text-blue-400" />}
                                label="Total Players"
                                value={analytics.total_players.toString()}
                            />
                            <StatCard
                                icon={<Target className="h-6 w-6 text-green-400" />}
                                label="Class Accuracy"
                                value={`${Math.round(analytics.class_accuracy)}%`}
                                trend={analytics.class_accuracy >= 70 ? "up" : "down"}
                            />
                            <StatCard
                                icon={<Brain className="h-6 w-6 text-purple-400" />}
                                label="Avg Confidence"
                                value={`${Math.round(analytics.class_avg_confidence)}%`}
                            />
                            <StatCard
                                icon={<AlertTriangle className="h-6 w-6 text-orange-400" />}
                                label="Misconceptions"
                                value={analytics.misconception_clusters.length.toString()}
                                alert={analytics.misconception_clusters.length > 3}
                            />
                        </div>

                        {/* Intervention Alerts */}
                        {analytics.intervention_alerts.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-red-400" />
                                    Intervention Alerts
                                </h2>
                                <div className="space-y-3">
                                    {analytics.intervention_alerts.map((alert, idx) => (
                                        <div
                                            key={idx}
                                            className={`rounded-xl p-4 border ${
                                                alert.severity === "high"
                                                    ? "bg-red-500/10 border-red-500/30"
                                                    : alert.severity === "medium"
                                                        ? "bg-yellow-500/10 border-yellow-500/30"
                                                        : "bg-blue-500/10 border-blue-500/30"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium text-white">{alert.message}</p>
                                                    <p className="text-gray-400 text-sm mt-1">
                                                        Affected: {alert.affected_students.join(", ")}
                                                    </p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                    alert.severity === "high" ? "bg-red-500 text-white" :
                                                    alert.severity === "medium" ? "bg-yellow-500 text-black" :
                                                    "bg-blue-500 text-white"
                                                }`}>
                                                    {alert.severity}
                                                </span>
                                            </div>
                                            <p className="text-gray-500 text-sm mt-3">
                                                Suggested: {alert.suggested_action}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                            <TabButton
                                active={activeTab === "overview"}
                                onClick={() => setActiveTab("overview")}
                                label="Overview"
                                darkMode
                            />
                            <TabButton
                                active={activeTab === "questions"}
                                onClick={() => setActiveTab("questions")}
                                label="By Question"
                                darkMode
                            />
                            <TabButton
                                active={activeTab === "students"}
                                onClick={() => setActiveTab("students")}
                                label="By Student"
                                darkMode
                            />
                            <TabButton
                                active={activeTab === "misconceptions"}
                                onClick={() => setActiveTab("misconceptions")}
                                label="Misconceptions"
                                darkMode
                            />
                        </div>

                        {/* Tab Content */}
                        {activeTab === "overview" && (
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Calibration Distribution */}
                                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                                    <h3 className="font-bold text-white mb-4">Student Calibration</h3>
                                    <div className="space-y-3">
                                        <CalibrationBar
                                            label="Well Calibrated"
                                            count={analytics.calibration_summary.well_calibrated}
                                            total={analytics.total_players}
                                            color="green"
                                        />
                                        <CalibrationBar
                                            label="Overconfident"
                                            count={analytics.calibration_summary.overconfident}
                                            total={analytics.total_players}
                                            color="orange"
                                        />
                                        <CalibrationBar
                                            label="Underconfident"
                                            count={analytics.calibration_summary.underconfident}
                                            total={analytics.total_players}
                                            color="blue"
                                        />
                                    </div>
                                </div>

                                {/* Class Performance Summary */}
                                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                                    <h3 className="font-bold text-white mb-4">Performance Summary</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Questions with {"<"}50% correct</span>
                                            <span className="font-bold text-red-400">
                                                {analytics.question_performance.filter(q => q.correct_rate < 50).length}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Students with misconceptions</span>
                                            <span className="font-bold text-orange-400">
                                                {analytics.student_performance.filter(s => s.misconception_count > 0).length}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Students needing attention</span>
                                            <span className="font-bold text-yellow-400">
                                                {analytics.student_performance.filter(s => s.accuracy < 50).length}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "questions" && (
                            <div className="space-y-4">
                                {analytics.question_performance.map((q, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
                                    >
                                        <button
                                            onClick={() => toggleQuestion(idx)}
                                            className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold ${
                                                    q.correct_rate >= 70 ? "bg-green-500/20 text-green-400" :
                                                    q.correct_rate >= 50 ? "bg-yellow-500/20 text-yellow-400" :
                                                    "bg-red-500/20 text-red-400"
                                                }`}>
                                                    {Math.round(q.correct_rate)}%
                                                </span>
                                                <div className="text-left">
                                                    <p className="font-medium text-white">Question {q.question_index + 1}</p>
                                                    <p className="text-gray-400 text-sm truncate max-w-md">
                                                        {q.question_text}
                                                    </p>
                                                </div>
                                            </div>
                                            {expandedQuestions.has(idx) ? (
                                                <ChevronUp className="h-5 w-5 text-gray-500" />
                                            ) : (
                                                <ChevronDown className="h-5 w-5 text-gray-500" />
                                            )}
                                        </button>
                                        {expandedQuestions.has(idx) && (
                                            <div className="p-4 border-t border-gray-800">
                                                <div className="grid md:grid-cols-3 gap-4 mb-4">
                                                    <div className="text-center">
                                                        <p className="text-gray-400 text-sm">Avg Confidence</p>
                                                        <p className="font-bold text-white text-lg">
                                                            {Math.round(q.avg_confidence)}%
                                                        </p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-gray-400 text-sm">Avg Time</p>
                                                        <p className="font-bold text-white text-lg">
                                                            {(q.avg_time_ms / 1000).toFixed(1)}s
                                                        </p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-gray-400 text-sm">Responses</p>
                                                        <p className="font-bold text-white text-lg">
                                                            {Object.values(q.answer_distribution).reduce((a, b) => a + b, 0)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-gray-400 text-sm">Answer Distribution</p>
                                                    {Object.entries(q.answer_distribution).map(([answer, count]) => (
                                                        <div key={answer} className="flex items-center gap-2">
                                                            <span className="w-8 text-white font-medium">{answer}</span>
                                                            <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${
                                                                        answer === "A" ? "bg-green-500" : "bg-sky-500"
                                                                    }`}
                                                                    style={{
                                                                        width: `${(count / analytics.total_players) * 100}%`
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-gray-400 w-8 text-right">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === "students" && (
                            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-800/50">
                                        <tr>
                                            <th className="text-left p-4 text-gray-400 font-medium">Student</th>
                                            <th className="text-center p-4 text-gray-400 font-medium">Score</th>
                                            <th className="text-center p-4 text-gray-400 font-medium">Accuracy</th>
                                            <th className="text-center p-4 text-gray-400 font-medium">Confidence</th>
                                            <th className="text-center p-4 text-gray-400 font-medium">Calibration</th>
                                            <th className="text-center p-4 text-gray-400 font-medium">Misconceptions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.student_performance.map((student, idx) => (
                                            <tr key={idx} className="border-t border-gray-800 hover:bg-gray-800/50">
                                                <td className="p-4 text-white font-medium">{student.nickname}</td>
                                                <td className="p-4 text-center text-white">
                                                    {student.score.toLocaleString()}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-sm ${
                                                        student.accuracy >= 70 ? "bg-green-500/20 text-green-400" :
                                                        student.accuracy >= 50 ? "bg-yellow-500/20 text-yellow-400" :
                                                        "bg-red-500/20 text-red-400"
                                                    }`}>
                                                        {Math.round(student.accuracy)}%
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center text-gray-400">
                                                    {Math.round(student.avg_confidence)}%
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-sm capitalize ${
                                                        student.calibration_status === "well_calibrated"
                                                            ? "bg-green-500/20 text-green-400"
                                                            : student.calibration_status === "overconfident"
                                                                ? "bg-orange-500/20 text-orange-400"
                                                                : "bg-blue-500/20 text-blue-400"
                                                    }`}>
                                                        {student.calibration_status.replace("_", " ")}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {student.misconception_count > 0 ? (
                                                        <span className="px-2 py-1 rounded-full text-sm bg-orange-500/20 text-orange-400">
                                                            {student.misconception_count}
                                                        </span>
                                                    ) : (
                                                        <span className="text-green-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === "misconceptions" && (
                            <div className="space-y-4">
                                {analytics.misconception_clusters.length > 0 ? (
                                    analytics.misconception_clusters.map((cluster, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-orange-500/10 rounded-xl p-5 border border-orange-500/20"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="font-medium text-white">
                                                        Q{cluster.question_index + 1}: {cluster.question_text}
                                                    </p>
                                                    <p className="text-orange-400 text-sm mt-1">
                                                        {cluster.count} students ({cluster.percentage}%) chose "{cluster.wrong_answer}"
                                                    </p>
                                                </div>
                                                <AlertTriangle className="h-6 w-6 text-orange-400" />
                                            </div>
                                            <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                                                <p className="text-gray-400 text-sm">Common Reasoning:</p>
                                                <ul className="text-gray-300 text-sm mt-1 space-y-1">
                                                    {cluster.common_reasoning.map((reason, ridx) => (
                                                        <li key={ridx}>- {reason}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <p className="text-gray-500 text-sm">
                                                Students: {cluster.students.join(", ")}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12">
                                        <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                                        <p className="text-xl font-medium text-white">No Major Misconceptions Detected</p>
                                        <p className="text-gray-400 mt-2">Your class is doing great!</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Export Button */}
                        <div className="mt-8 flex justify-end">
                            <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white hover:bg-gray-700 transition-colors">
                                <Download className="h-5 w-5" />
                                Export Report
                            </button>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

export default function TeacherAnalyticsPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            </div>
        }>
            <TeacherAnalyticsContent />
        </Suspense>
    );
}

function StatCard({
    icon,
    label,
    value,
    trend,
    alert
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    trend?: "up" | "down";
    alert?: boolean;
}) {
    return (
        <div className={`bg-gray-900 rounded-xl p-5 border ${alert ? "border-orange-500/50" : "border-gray-800"}`}>
            <div className="flex items-center justify-between mb-2">
                {icon}
                {trend && (
                    trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-red-400" />
                    )
                )}
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-gray-400 text-sm mt-1">{label}</p>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    label,
    darkMode
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    darkMode?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                active
                    ? darkMode ? "bg-sky-600 text-white" : "bg-white text-purple-600"
                    : darkMode ? "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700" : "bg-white/10 text-white hover:bg-white/20"
            }`}
        >
            {label}
        </button>
    );
}

function CalibrationBar({
    label,
    count,
    total,
    color
}: {
    label: string;
    count: number;
    total: number;
    color: "green" | "orange" | "blue";
}) {
    const percentage = (count / Math.max(1, total)) * 100;
    const colorClasses = {
        green: "bg-green-500",
        orange: "bg-orange-500",
        blue: "bg-blue-500"
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-sm">{label}</span>
                <span className="text-white font-medium">{count} ({Math.round(percentage)}%)</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorClasses[color]} rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}


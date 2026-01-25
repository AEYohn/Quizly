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

export default function TeacherAnalyticsPage() {
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
            router.push("/login");
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
            // For demo, use mock data. In production, fetch from API
            setAnalytics(getMockAnalytics(gameId));
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
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/teacher" className="text-2xl font-bold text-white">
                        Quizly
                    </Link>
                    <nav className="flex items-center gap-4">
                        <Link href="/teacher" className="text-white/70 hover:text-white">
                            Dashboard
                        </Link>
                        <Link
                            href="/teacher/analytics"
                            className="px-4 py-2 rounded-full bg-white/20 text-white font-medium"
                        >
                            Analytics
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Page Title & Game Selector */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <BarChart3 className="h-8 w-8 text-purple-400" />
                            Class Analytics
                        </h1>
                        <p className="text-white/60 mt-1">Track student performance and identify learning gaps</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedGame || ""}
                            onChange={(e) => setSelectedGame(e.target.value)}
                            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {games.map(game => (
                                <option key={game.id} value={game.id} className="bg-slate-800">
                                    {game.quiz_title} ({game.game_code})
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => selectedGame && fetchAnalytics(selectedGame)}
                            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            <RefreshCw className="h-5 w-5" />
                        </button>
                    </div>
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
                                                    ? "bg-red-500/20 border-red-500/30"
                                                    : alert.severity === "medium"
                                                        ? "bg-yellow-500/20 border-yellow-500/30"
                                                        : "bg-blue-500/20 border-blue-500/30"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium text-white">{alert.message}</p>
                                                    <p className="text-white/70 text-sm mt-1">
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
                                            <p className="text-white/60 text-sm mt-3">
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
                            />
                            <TabButton
                                active={activeTab === "questions"}
                                onClick={() => setActiveTab("questions")}
                                label="By Question"
                            />
                            <TabButton
                                active={activeTab === "students"}
                                onClick={() => setActiveTab("students")}
                                label="By Student"
                            />
                            <TabButton
                                active={activeTab === "misconceptions"}
                                onClick={() => setActiveTab("misconceptions")}
                                label="Misconceptions"
                            />
                        </div>

                        {/* Tab Content */}
                        {activeTab === "overview" && (
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Calibration Distribution */}
                                <div className="bg-white/10 rounded-xl p-6 backdrop-blur border border-white/20">
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
                                <div className="bg-white/10 rounded-xl p-6 backdrop-blur border border-white/20">
                                    <h3 className="font-bold text-white mb-4">Performance Summary</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/70">Questions with {"<"}50% correct</span>
                                            <span className="font-bold text-red-400">
                                                {analytics.question_performance.filter(q => q.correct_rate < 50).length}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/70">Students with misconceptions</span>
                                            <span className="font-bold text-orange-400">
                                                {analytics.student_performance.filter(s => s.misconception_count > 0).length}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/70">Students needing attention</span>
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
                                        className="bg-white/10 rounded-xl backdrop-blur border border-white/20 overflow-hidden"
                                    >
                                        <button
                                            onClick={() => toggleQuestion(idx)}
                                            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
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
                                                    <p className="text-white/60 text-sm truncate max-w-md">
                                                        {q.question_text}
                                                    </p>
                                                </div>
                                            </div>
                                            {expandedQuestions.has(idx) ? (
                                                <ChevronUp className="h-5 w-5 text-white/50" />
                                            ) : (
                                                <ChevronDown className="h-5 w-5 text-white/50" />
                                            )}
                                        </button>
                                        {expandedQuestions.has(idx) && (
                                            <div className="p-4 border-t border-white/10">
                                                <div className="grid md:grid-cols-3 gap-4 mb-4">
                                                    <div className="text-center">
                                                        <p className="text-white/60 text-sm">Avg Confidence</p>
                                                        <p className="font-bold text-white text-lg">
                                                            {Math.round(q.avg_confidence)}%
                                                        </p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-white/60 text-sm">Avg Time</p>
                                                        <p className="font-bold text-white text-lg">
                                                            {(q.avg_time_ms / 1000).toFixed(1)}s
                                                        </p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-white/60 text-sm">Responses</p>
                                                        <p className="font-bold text-white text-lg">
                                                            {Object.values(q.answer_distribution).reduce((a, b) => a + b, 0)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-white/60 text-sm">Answer Distribution</p>
                                                    {Object.entries(q.answer_distribution).map(([answer, count]) => (
                                                        <div key={answer} className="flex items-center gap-2">
                                                            <span className="w-8 text-white font-medium">{answer}</span>
                                                            <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${
                                                                        answer === "A" ? "bg-green-500" : "bg-purple-500"
                                                                    }`}
                                                                    style={{
                                                                        width: `${(count / analytics.total_players) * 100}%`
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-white/60 w-8 text-right">{count}</span>
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
                            <div className="bg-white/10 rounded-xl backdrop-blur border border-white/20 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-white/5">
                                        <tr>
                                            <th className="text-left p-4 text-white/70 font-medium">Student</th>
                                            <th className="text-center p-4 text-white/70 font-medium">Score</th>
                                            <th className="text-center p-4 text-white/70 font-medium">Accuracy</th>
                                            <th className="text-center p-4 text-white/70 font-medium">Confidence</th>
                                            <th className="text-center p-4 text-white/70 font-medium">Calibration</th>
                                            <th className="text-center p-4 text-white/70 font-medium">Misconceptions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.student_performance.map((student, idx) => (
                                            <tr key={idx} className="border-t border-white/10 hover:bg-white/5">
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
                                                <td className="p-4 text-center text-white/70">
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
                                            <div className="bg-white/5 rounded-lg p-3 mb-3">
                                                <p className="text-white/70 text-sm">Common Reasoning:</p>
                                                <ul className="text-white/80 text-sm mt-1 space-y-1">
                                                    {cluster.common_reasoning.map((reason, ridx) => (
                                                        <li key={ridx}>- {reason}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <p className="text-white/50 text-sm">
                                                Students: {cluster.students.join(", ")}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12">
                                        <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                                        <p className="text-xl font-medium text-white">No Major Misconceptions Detected</p>
                                        <p className="text-white/60 mt-2">Your class is doing great!</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Export Button */}
                        <div className="mt-8 flex justify-end">
                            <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
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
        <div className={`bg-white/10 rounded-xl p-5 backdrop-blur border ${alert ? "border-orange-500/50" : "border-white/20"}`}>
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
            <p className="text-white/60 text-sm mt-1">{label}</p>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    label
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
                active
                    ? "bg-white text-purple-600"
                    : "bg-white/10 text-white hover:bg-white/20"
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
                <span className="text-white/70 text-sm">{label}</span>
                <span className="text-white font-medium">{count} ({Math.round(percentage)}%)</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorClasses[color]} rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function getMockAnalytics(gameId: string): GameAnalytics {
    return {
        game_id: gameId,
        quiz_title: "Python Basics Quiz",
        game_code: "ABC123",
        total_players: 24,
        class_accuracy: 72,
        class_avg_confidence: 68,
        calibration_summary: {
            well_calibrated: 14,
            overconfident: 7,
            underconfident: 3
        },
        misconception_clusters: [
            {
                question_text: "What is the output of print(type([]))?",
                question_index: 2,
                wrong_answer: "B",
                count: 8,
                percentage: 33,
                students: ["Alex", "Jordan", "Sam", "Casey", "Riley", "Morgan", "Taylor", "Drew"],
                common_reasoning: [
                    "Confused empty list with tuple",
                    "Thought brackets indicate dictionary"
                ]
            },
            {
                question_text: "Which is true about Python variables?",
                question_index: 5,
                wrong_answer: "C",
                count: 6,
                percentage: 25,
                students: ["Alex", "Jordan", "Sam", "Casey", "Riley", "Morgan"],
                common_reasoning: [
                    "Confused with statically typed languages",
                    "Believed explicit type declaration is required"
                ]
            }
        ],
        intervention_alerts: [
            {
                type: "misconception",
                severity: "high",
                message: "33% of class has misconception about Python data types",
                affected_students: ["Alex", "Jordan", "Sam", "Casey", "Riley", "Morgan", "Taylor", "Drew"],
                suggested_action: "Re-teach Python data types with hands-on examples"
            },
            {
                type: "low_performance",
                severity: "medium",
                message: "3 students scoring below 50%",
                affected_students: ["Alex", "Jordan", "Sam"],
                suggested_action: "Consider one-on-one review session"
            }
        ],
        question_performance: [
            {
                question_index: 0,
                question_text: "What is Python?",
                correct_rate: 95,
                avg_confidence: 88,
                avg_time_ms: 4500,
                answer_distribution: { A: 23, B: 0, C: 1, D: 0 }
            },
            {
                question_index: 1,
                question_text: "How do you create a variable in Python?",
                correct_rate: 85,
                avg_confidence: 75,
                avg_time_ms: 6200,
                answer_distribution: { A: 20, B: 2, C: 1, D: 1 }
            },
            {
                question_index: 2,
                question_text: "What is the output of print(type([]))?",
                correct_rate: 58,
                avg_confidence: 72,
                avg_time_ms: 8100,
                answer_distribution: { A: 14, B: 8, C: 1, D: 1 }
            },
            {
                question_index: 3,
                question_text: "What does 'len' function do?",
                correct_rate: 88,
                avg_confidence: 82,
                avg_time_ms: 5400,
                answer_distribution: { A: 21, B: 2, C: 0, D: 1 }
            }
        ],
        student_performance: [
            { player_id: "1", nickname: "Alex", score: 2100, accuracy: 45, avg_confidence: 78, calibration_status: "overconfident", misconception_count: 2 },
            { player_id: "2", nickname: "Jordan", score: 2500, accuracy: 55, avg_confidence: 65, calibration_status: "well_calibrated", misconception_count: 1 },
            { player_id: "3", nickname: "Sam", score: 1800, accuracy: 40, avg_confidence: 82, calibration_status: "overconfident", misconception_count: 3 },
            { player_id: "4", nickname: "Casey", score: 4200, accuracy: 90, avg_confidence: 85, calibration_status: "well_calibrated", misconception_count: 0 },
            { player_id: "5", nickname: "Riley", score: 3800, accuracy: 80, avg_confidence: 72, calibration_status: "well_calibrated", misconception_count: 0 },
            { player_id: "6", nickname: "Morgan", score: 3500, accuracy: 75, avg_confidence: 58, calibration_status: "underconfident", misconception_count: 1 },
            { player_id: "7", nickname: "Taylor", score: 4000, accuracy: 85, avg_confidence: 80, calibration_status: "well_calibrated", misconception_count: 0 },
            { player_id: "8", nickname: "Drew", score: 3200, accuracy: 70, avg_confidence: 68, calibration_status: "well_calibrated", misconception_count: 1 }
        ]
    };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import {
    Brain,
    Lightbulb,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    ArrowLeft,
    Loader2,
    Users,
    BarChart3,
    Target,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    User,
    MessageSquare,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MisconceptionType {
    type: string;
    count: number;
}

interface MisconceptionSummary {
    total_misconceptions: number;
    top_misconception_types: MisconceptionType[];
    category_distribution: Record<string, number>;
    severity_distribution: Record<string, number>;
    remediation_suggestions: string[];
}

interface QuestionMisconception {
    player_id: string;
    player_name: string;
    question_id: string;
    answer: string;
    confidence: number | null;
    reasoning: string | null;
    misconception_type: string;
    category: string;
    severity: string;
    description: string;
    root_cause: string;
    remediation: string;
    evidence: string[];
}

interface QuestionBreakdown {
    question_index: number;
    question_text: string;
    correct_answer: string;
    misconception_count: number;
    top_misconceptions: [string, number][];
    misconceptions: QuestionMisconception[];
}

interface StudentMisconception {
    player_id: string;
    nickname: string;
    misconception_count: number;
    misconceptions: QuestionMisconception[];
}

interface InsightsData {
    game_id: string;
    quiz_title: string;
    total_players: number;
    total_misconceptions: number;
    summary: MisconceptionSummary;
    questions_breakdown: QuestionBreakdown[];
    student_misconceptions: StudentMisconception[];
}

export default function MisconceptionInsightsPage() {
    const params = useParams();
    const router = useRouter();
    const { getToken } = useClerkAuth();
    const gameId = params.id as string;

    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "questions" | "students">("overview");
    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
    const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

    const fetchInsights = useCallback(async () => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/games/${gameId}/insights/misconceptions`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setInsights(data);
            } else {
                const errorData = await response.json().catch(() => ({}));
                setError(errorData.detail || "Failed to load insights");
            }
        } catch (err) {
            console.error("Failed to fetch insights:", err);
            setError("Network error: Unable to connect to server");
        } finally {
            setLoading(false);
        }
    }, [gameId, getToken]);

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    const toggleQuestion = (index: number) => {
        setExpandedQuestions(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const toggleStudent = (playerId: string) => {
        setExpandedStudents(prev => {
            const next = new Set(prev);
            if (next.has(playerId)) {
                next.delete(playerId);
            } else {
                next.add(playerId);
            }
            return next;
        });
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "severe": return "text-red-400 bg-red-500/20 border-red-500/30";
            case "moderate": return "text-orange-400 bg-orange-500/20 border-orange-500/30";
            case "minor": return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
            default: return "text-gray-400 bg-gray-500/20 border-gray-500/30";
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case "conceptual": return <Brain className="h-4 w-4" />;
            case "procedural": return <Target className="h-4 w-4" />;
            case "careless": return <AlertCircle className="h-4 w-4" />;
            case "incomplete": return <HelpCircle className="h-4 w-4" />;
            default: return <Lightbulb className="h-4 w-4" />;
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <div className="text-center">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-sky-400" />
                    <p className="mt-4 text-gray-400">Analyzing misconceptions...</p>
                </div>
            </div>
        );
    }

    if (error || !insights) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
                <AlertTriangle className="mb-4 h-16 w-16 text-yellow-400" />
                <div className="text-xl text-white text-center max-w-md">
                    {error || "No insights available"}
                </div>
                <p className="mt-2 text-gray-400 text-center">
                    Misconception data is collected when students provide reasoning with their answers.
                </p>
                <button
                    onClick={() => router.back()}
                    className="mt-6 rounded-full bg-sky-600 px-6 py-3 font-bold text-white hover:bg-sky-700"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const { summary, questions_breakdown, student_misconceptions } = insights;

    return (
        <div className="min-h-screen bg-gray-950 p-6">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Results
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
                            <Brain className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Misconception Insights</h1>
                            <p className="text-gray-400">{insights.quiz_title}</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Users className="h-4 w-4" />
                            <span className="text-sm">Players</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{insights.total_players}</div>
                    </div>
                    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">Misconceptions</span>
                        </div>
                        <div className="text-2xl font-bold text-orange-400">{summary.total_misconceptions}</div>
                    </div>
                    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <BarChart3 className="h-4 w-4" />
                            <span className="text-sm">Severe</span>
                        </div>
                        <div className="text-2xl font-bold text-red-400">{summary.severity_distribution?.severe || 0}</div>
                    </div>
                    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Brain className="h-4 w-4" />
                            <span className="text-sm">Conceptual</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-400">{summary.category_distribution?.conceptual || 0}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex gap-2">
                    {(["overview", "questions", "students"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-full font-medium transition-colors ${
                                activeTab === tab
                                    ? "bg-sky-600 text-white"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        {/* Top Misconception Types */}
                        {summary.top_misconception_types.length > 0 && (
                            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
                                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                                    <Lightbulb className="h-5 w-5 text-purple-400" />
                                    Top Misconception Types
                                </h2>
                                <div className="space-y-3">
                                    {summary.top_misconception_types.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-white font-medium">
                                                        {item.type.replace(/_/g, " ")}
                                                    </span>
                                                    <span className="text-gray-400">{item.count} students</span>
                                                </div>
                                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                                        style={{
                                                            width: `${Math.min(100, (item.count / insights.total_players) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Category Distribution */}
                        {Object.keys(summary.category_distribution || {}).length > 0 && (
                            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
                                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                                    <BarChart3 className="h-5 w-5 text-sky-400" />
                                    Category Distribution
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(summary.category_distribution).map(([category, count]) => (
                                        <div
                                            key={category}
                                            className="flex items-center gap-3 rounded-xl bg-gray-800 p-4"
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700">
                                                {getCategoryIcon(category)}
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-400 capitalize">{category}</div>
                                                <div className="text-xl font-bold text-white">{count}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Remediation Suggestions */}
                        {summary.remediation_suggestions.length > 0 && (
                            <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-6">
                                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-green-400">
                                    <CheckCircle className="h-5 w-5" />
                                    Suggested Remediation
                                </h2>
                                <ul className="space-y-3">
                                    {summary.remediation_suggestions.map((suggestion, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-green-300">
                                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500/30 text-sm font-bold">
                                                {idx + 1}
                                            </span>
                                            {suggestion}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {summary.total_misconceptions === 0 && (
                            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-8 text-center">
                                <CheckCircle className="mx-auto h-12 w-12 text-green-400 mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">No Misconceptions Detected</h3>
                                <p className="text-gray-400">
                                    Either all students answered correctly, or no reasoning was provided with wrong answers.
                                    Encourage students to explain their thinking for better insights.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "questions" && (
                    <div className="space-y-4">
                        {questions_breakdown.map((q, idx) => (
                            <div key={idx} className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
                                <button
                                    onClick={() => toggleQuestion(idx)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300 font-bold">
                                            {idx + 1}
                                        </span>
                                        <div className="text-left">
                                            <div className="text-white font-medium">{q.question_text}</div>
                                            <div className="text-sm text-gray-400">
                                                Correct: {q.correct_answer} • {q.misconception_count} misconceptions
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {q.misconception_count > 0 && (
                                            <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-sm font-medium">
                                                {q.misconception_count}
                                            </span>
                                        )}
                                        {expandedQuestions.has(idx) ? (
                                            <ChevronUp className="h-5 w-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="h-5 w-5 text-gray-400" />
                                        )}
                                    </div>
                                </button>

                                {expandedQuestions.has(idx) && q.misconceptions.length > 0 && (
                                    <div className="border-t border-gray-800 p-4 space-y-3">
                                        {q.misconceptions.map((m, mIdx) => (
                                            <div key={mIdx} className={`rounded-xl p-4 border ${getSeverityColor(m.severity)}`}>
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        <span className="font-medium">{m.player_name}</span>
                                                        <span className="text-sm opacity-70">answered {m.answer}</span>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getSeverityColor(m.severity)}`}>
                                                        {m.severity}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div>
                                                        <span className="text-sm font-medium opacity-70">Type: </span>
                                                        <span className="text-sm">{m.misconception_type.replace(/_/g, " ")}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-medium opacity-70">Root Cause: </span>
                                                        <span className="text-sm">{m.root_cause}</span>
                                                    </div>
                                                    {m.reasoning && (
                                                        <div className="flex items-start gap-2 mt-2 p-2 rounded bg-black/20">
                                                            <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-70" />
                                                            <span className="text-sm italic">&quot;{m.reasoning}&quot;</span>
                                                        </div>
                                                    )}
                                                    <div className="mt-2 pt-2 border-t border-current/20">
                                                        <span className="text-sm font-medium">Remediation: </span>
                                                        <span className="text-sm">{m.remediation}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {expandedQuestions.has(idx) && q.misconceptions.length === 0 && (
                                    <div className="border-t border-gray-800 p-4 text-center text-gray-400">
                                        No misconceptions recorded for this question
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === "students" && (
                    <div className="space-y-4">
                        {student_misconceptions.length === 0 ? (
                            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-8 text-center">
                                <Users className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                                <p className="text-gray-400">No student misconceptions recorded</p>
                            </div>
                        ) : (
                            student_misconceptions.map((student) => (
                                <div key={student.player_id} className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
                                    <button
                                        onClick={() => toggleStudent(student.player_id)}
                                        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white font-bold">
                                                {student.nickname.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-white font-medium">{student.nickname}</div>
                                                <div className="text-sm text-gray-400">
                                                    {student.misconception_count} misconception{student.misconception_count !== 1 ? "s" : ""} identified
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                student.misconception_count >= 3
                                                    ? "bg-red-500/20 text-red-400"
                                                    : student.misconception_count >= 2
                                                    ? "bg-orange-500/20 text-orange-400"
                                                    : "bg-yellow-500/20 text-yellow-400"
                                            }`}>
                                                {student.misconception_count}
                                            </span>
                                            {expandedStudents.has(student.player_id) ? (
                                                <ChevronUp className="h-5 w-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="h-5 w-5 text-gray-400" />
                                            )}
                                        </div>
                                    </button>

                                    {expandedStudents.has(student.player_id) && (
                                        <div className="border-t border-gray-800 p-4 space-y-3">
                                            {student.misconceptions.map((m, mIdx) => {
                                                const questionNum = questions_breakdown.findIndex(
                                                    q => q.misconceptions.some(qm => qm.question_id === m.question_id)
                                                ) + 1;

                                                return (
                                                    <div key={mIdx} className={`rounded-xl p-4 border ${getSeverityColor(m.severity)}`}>
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium">Q{questionNum}</span>
                                                                <span className="text-sm opacity-70">• answered {m.answer}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {getCategoryIcon(m.category)}
                                                                <span className="text-xs capitalize">{m.category}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-sm mb-2">
                                                            <span className="font-medium">{m.misconception_type.replace(/_/g, " ")}: </span>
                                                            {m.description}
                                                        </div>
                                                        <div className="text-sm mt-2 pt-2 border-t border-current/20">
                                                            <span className="font-medium">Suggestion: </span>
                                                            {m.remediation}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Back Button */}
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={() => router.push(`/teacher/game/${gameId}/results`)}
                        className="flex items-center gap-2 rounded-full bg-sky-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-sky-700"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back to Results
                    </button>
                </div>
            </div>
        </div>
    );
}

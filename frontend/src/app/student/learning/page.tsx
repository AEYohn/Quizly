"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    BookOpen, Target, TrendingUp, Brain, Download,
    ChevronRight, Loader2, BarChart3, Award, AlertTriangle,
    Sparkles, ArrowLeft, LogOut
} from "lucide-react";
import { ExitTicketCard, ExitTicketList } from "@/components/ExitTicketCard";
import { MisconceptionTracker } from "@/components/MisconceptionTracker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StudyNotes {
    key_concepts?: string[];
    common_mistakes?: string[];
    strategies?: string[];
    memory_tips?: string[];
}

interface PracticeQuestion {
    prompt: string;
    options: string[];
    correct_answer: string;
    hint?: string;
    explanation?: string;
    difficulty?: string;
}

interface ExitTicket {
    id: string;
    student_name: string;
    target_concept: string;
    micro_lesson: string;
    encouragement?: string;
    question_prompt: string;
    question_options: string[];
    correct_answer: string;
    hint?: string;
    is_completed: boolean;
    created_at: string;
    student_answer?: string;
    answered_correctly?: boolean;
    // New comprehensive fields
    study_notes?: StudyNotes;
    practice_questions?: PracticeQuestion[];
    flashcards?: { front: string; back: string }[];
    misconceptions?: { type: string; description: string; correction: string }[];
}

interface Misconception {
    id: string;
    student_name: string;
    misconception_type: string;
    category: string;
    severity: string;
    description: string;
    root_cause?: string;
    suggested_remediation?: string;
    is_resolved: boolean;
    created_at: string;
}

interface AdaptiveLearning {
    current_difficulty: number;
    questions_answered: number;
    overall_accuracy: number;
    weak_concepts: string[];
}

interface DashboardData {
    student_name: string;
    exit_tickets: {
        id: string;
        target_concept: string;
        micro_lesson: string;
        is_completed: boolean;
        created_at: string;
    }[];
    misconceptions: Misconception[];
    adaptive_learning: AdaptiveLearning | null;
    summary: {
        total_exit_tickets: number;
        completed_exit_tickets: number;
        active_misconceptions: number;
        concepts_to_review: string[];
    };
}

export default function StudentLearningDashboard() {
    const [studentName, setStudentName] = useState<string>("");
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [exitTickets, setExitTickets] = useState<ExitTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "tickets" | "misconceptions" | "progress">("overview");

    useEffect(() => {
        const name = localStorage.getItem("quizly_student_name") || "Student";
        setStudentName(name);
        fetchDashboard(name);
        fetchExitTickets(name);
    }, []);

    async function fetchDashboard(name: string) {
        try {
            const res = await fetch(
                `${API_URL}/student-learning/dashboard/${encodeURIComponent(name)}`
            );
            if (res.ok) {
                const data = await res.json();
                setDashboardData(data);
            }
        } catch (err) {
            console.error("Error fetching dashboard:", err);
        }
        setIsLoading(false);
    }

    async function fetchExitTickets(name: string) {
        try {
            const res = await fetch(
                `${API_URL}/student-learning/exit-tickets?student_name=${encodeURIComponent(name)}&limit=20`
            );
            if (res.ok) {
                const data = await res.json();
                setExitTickets(data);
            }
        } catch (err) {
            console.error("Error fetching exit tickets:", err);
        }
    }

    async function handleAnswerExitTicket(ticketId: string, answer: string) {
        const res = await fetch(
            `${API_URL}/student-learning/exit-ticket/answer`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticket_id: ticketId, student_answer: answer }),
            }
        );
        if (res.ok) {
            const result = await res.json();
            // Update local state
            setExitTickets(prev =>
                prev.map(t =>
                    t.id === ticketId
                        ? { ...t, is_completed: true, student_answer: answer, answered_correctly: result.is_correct }
                        : t
                )
            );
            return result;
        }
        throw new Error("Failed to submit answer");
    }

    async function handleResolveMisconception(misconceptionId: string) {
        const res = await fetch(
            `${API_URL}/student-learning/misconception/${misconceptionId}/resolve`,
            { method: "POST" }
        );
        if (res.ok) {
            setDashboardData(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    misconceptions: prev.misconceptions.map(m =>
                        m.id === misconceptionId ? { ...m, is_resolved: true } : m
                    ),
                };
            });
        }
    }

    async function handleExportStudyGuide() {
        const res = await fetch(
            `${API_URL}/student-learning/exit-tickets/export?student_name=${encodeURIComponent(studentName)}`
        );
        if (res.ok) {
            const data = await res.json();
            // Download as markdown file
            const blob = new Blob([data.markdown], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `study-guide-${studentName}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
        );
    }

    const summary = dashboardData?.summary;
    const adaptive = dashboardData?.adaptive_learning;

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="mx-auto max-w-6xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/student/dashboard"
                                className="flex items-center gap-2 text-gray-400 hover:text-white"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Link>
                            <div className="h-6 w-px bg-gray-700" />
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
                                    <Brain className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-white">Learning Dashboard</h1>
                                    <p className="text-xs text-gray-400">{studentName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <span className="text-gray-400 text-sm">Exit Tickets</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{summary?.total_exit_tickets || 0}</p>
                        <p className="text-xs text-gray-500">{summary?.completed_exit_tickets || 0} completed</p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <span className="text-gray-400 text-sm">Misconceptions</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{summary?.active_misconceptions || 0}</p>
                        <p className="text-xs text-gray-500">to review</p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <span className="text-gray-400 text-sm">Accuracy</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {adaptive ? `${Math.round(adaptive.overall_accuracy * 100)}%` : "0%"}
                        </p>
                        <p className="text-xs text-gray-500">overall</p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                                <Brain className="h-5 w-5" />
                            </div>
                            <span className="text-gray-400 text-sm">Difficulty</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {adaptive ? `${Math.round(adaptive.current_difficulty * 100)}%` : "50%"}
                        </p>
                        <p className="text-xs text-gray-500">current level</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-800 pb-2">
                    {[
                        { id: "overview", label: "Overview", icon: BarChart3 },
                        { id: "tickets", label: "Exit Tickets", icon: BookOpen },
                        { id: "misconceptions", label: "Misconceptions", icon: AlertTriangle },
                        { id: "progress", label: "Progress", icon: TrendingUp },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? "bg-sky-500 text-white"
                                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                            }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Exit Tickets */}
                        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-sky-400" />
                                    Recent Lessons
                                </h2>
                                <button
                                    onClick={() => setActiveTab("tickets")}
                                    className="text-sm text-sky-400 hover:text-sky-300 flex items-center gap-1"
                                >
                                    View all <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                            {exitTickets.length > 0 ? (
                                <div className="space-y-3">
                                    {exitTickets.slice(0, 3).map((ticket) => (
                                        <ExitTicketCard
                                            key={ticket.id}
                                            ticket={ticket}
                                            onAnswer={handleAnswerExitTicket}
                                            compact
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No exit tickets yet</p>
                            )}
                        </div>

                        {/* Active Misconceptions */}
                        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                                    Areas to Review
                                </h2>
                                <button
                                    onClick={() => setActiveTab("misconceptions")}
                                    className="text-sm text-sky-400 hover:text-sky-300 flex items-center gap-1"
                                >
                                    View all <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                            {dashboardData?.misconceptions && dashboardData.misconceptions.length > 0 ? (
                                <MisconceptionTracker
                                    misconceptions={dashboardData.misconceptions.slice(0, 3)}
                                    onResolve={handleResolveMisconception}
                                    showFilters={false}
                                />
                            ) : (
                                <div className="text-center py-8">
                                    <Award className="h-12 w-12 mx-auto mb-3 text-emerald-400 opacity-50" />
                                    <p className="text-gray-500">No misconceptions to review!</p>
                                </div>
                            )}
                        </div>

                        {/* Concepts to Review */}
                        {summary?.concepts_to_review && summary.concepts_to_review.length > 0 && (
                            <div className="lg:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Target className="h-5 w-5 text-purple-400" />
                                    Concepts to Focus On
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {summary.concepts_to_review.map((concept, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-400 text-sm"
                                        >
                                            {concept}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "tickets" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-white">All Exit Tickets</h2>
                            <button
                                onClick={handleExportStudyGuide}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
                            >
                                <Download className="h-4 w-4" />
                                Export Study Guide
                            </button>
                        </div>
                        <ExitTicketList
                            tickets={exitTickets}
                            onAnswer={handleAnswerExitTicket}
                        />
                    </div>
                )}

                {activeTab === "misconceptions" && (
                    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <MisconceptionTracker
                            misconceptions={dashboardData?.misconceptions || []}
                            onResolve={handleResolveMisconception}
                        />
                    </div>
                )}

                {activeTab === "progress" && (
                    <div className="space-y-6">
                        {/* Adaptive Learning Stats */}
                        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Brain className="h-5 w-5 text-purple-400" />
                                Adaptive Learning Progress
                            </h2>
                            {adaptive ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center">
                                        <div className="relative w-32 h-32 mx-auto mb-3">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    className="stroke-gray-700"
                                                    strokeWidth="12"
                                                    fill="none"
                                                />
                                                <circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    className="stroke-emerald-500"
                                                    strokeWidth="12"
                                                    fill="none"
                                                    strokeDasharray={`${adaptive.overall_accuracy * 352} 352`}
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-2xl font-bold text-white">
                                                    {Math.round(adaptive.overall_accuracy * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-gray-400">Overall Accuracy</p>
                                    </div>

                                    <div className="text-center">
                                        <div className="relative w-32 h-32 mx-auto mb-3">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    className="stroke-gray-700"
                                                    strokeWidth="12"
                                                    fill="none"
                                                />
                                                <circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    className="stroke-purple-500"
                                                    strokeWidth="12"
                                                    fill="none"
                                                    strokeDasharray={`${adaptive.current_difficulty * 352} 352`}
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-2xl font-bold text-white">
                                                    {Math.round(adaptive.current_difficulty * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-gray-400">Difficulty Level</p>
                                    </div>

                                    <div className="flex flex-col justify-center">
                                        <p className="text-4xl font-bold text-white mb-2">{adaptive.questions_answered}</p>
                                        <p className="text-gray-400">Questions Answered</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">
                                    No learning data yet. Complete some quizzes to see your progress!
                                </p>
                            )}
                        </div>

                        {/* Weak Concepts */}
                        {adaptive?.weak_concepts && adaptive.weak_concepts.length > 0 && (
                            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Target className="h-5 w-5 text-orange-400" />
                                    Weak Areas to Practice
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {adaptive.weak_concepts.map((concept, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 text-sm"
                                        >
                                            {concept}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

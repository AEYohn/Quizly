"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Inbox,
    BookOpen,
    Check,
    Clock,
    Loader2,
    MessageSquare,
    ChevronRight,
    AlertCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Assignment {
    id: string;
    student_name: string;
    title: string;
    note: string | null;
    status: string;
    is_read: boolean;
    question_count: number;
    created_at: string;
    completed_at: string | null;
    score: number | null;
    total_questions: number | null;
}

interface InboxData {
    pending: Assignment[];
    completed: Assignment[];
    unread_count: number;
}

export default function StudentInboxPage() {
    const router = useRouter();
    const [studentName, setStudentName] = useState<string | null>(null);
    const [inbox, setInbox] = useState<InboxData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");

    useEffect(() => {
        const stored = localStorage.getItem("quizly_student_name");
        if (!stored) {
            router.push("/student");
            return;
        }
        setStudentName(stored);
        fetchInbox(stored);
    }, [router]);

    const fetchInbox = async (name: string) => {
        try {
            const res = await fetch(
                `${API_URL}/assignments/inbox/${encodeURIComponent(name)}`
            );
            if (res.ok) {
                const data = await res.json();
                setInbox(data);
            } else {
                setError("Failed to load inbox");
            }
        } catch (err) {
            console.error("Error fetching inbox:", err);
            setError("Connection error");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return "Today";
        } else if (days === 1) {
            return "Yesterday";
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-6">
                <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                <p className="text-white text-lg mb-4">{error}</p>
                <button
                    onClick={() => router.push("/student")}
                    className="px-4 py-2 rounded-lg bg-sky-600 text-white"
                >
                    Back to Hub
                </button>
            </div>
        );
    }

    const pendingCount = inbox?.pending.length || 0;
    const completedCount = inbox?.completed.length || 0;

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="mx-auto max-w-2xl px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/student"
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Inbox className="h-6 w-6 text-pink-400" />
                            <h1 className="text-xl font-bold text-white">My Inbox</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-6 py-6">
                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab("pending")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            activeTab === "pending"
                                ? "bg-pink-500 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white"
                        }`}
                    >
                        <Clock className="h-4 w-4" />
                        To Do ({pendingCount})
                    </button>
                    <button
                        onClick={() => setActiveTab("completed")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            activeTab === "completed"
                                ? "bg-emerald-500 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white"
                        }`}
                    >
                        <Check className="h-4 w-4" />
                        Completed ({completedCount})
                    </button>
                </div>

                {/* Assignment List */}
                {activeTab === "pending" && (
                    <div className="space-y-3">
                        {pendingCount === 0 ? (
                            <div className="text-center py-12 rounded-xl bg-gray-900 border border-gray-800">
                                <Inbox className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400">No pending assignments</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    You're all caught up!
                                </p>
                            </div>
                        ) : (
                            inbox?.pending.map((assignment) => (
                                <Link
                                    key={assignment.id}
                                    href={`/student/assignment/${assignment.id}`}
                                    className="block rounded-xl bg-gray-900 border border-gray-800 p-4 hover:border-pink-500/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {!assignment.is_read && (
                                                    <div className="h-2 w-2 rounded-full bg-pink-500" />
                                                )}
                                                <h3 className="font-bold text-white">
                                                    {assignment.title}
                                                </h3>
                                            </div>
                                            {assignment.note && (
                                                <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-gray-800/50">
                                                    <MessageSquare className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
                                                    <p className="text-sm text-gray-300 line-clamp-2">
                                                        {assignment.note}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <BookOpen className="h-4 w-4" />
                                                    {assignment.question_count} questions
                                                </span>
                                                <span>{formatDate(assignment.created_at)}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-600" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}

                {activeTab === "completed" && (
                    <div className="space-y-3">
                        {completedCount === 0 ? (
                            <div className="text-center py-12 rounded-xl bg-gray-900 border border-gray-800">
                                <Check className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400">No completed assignments yet</p>
                            </div>
                        ) : (
                            inbox?.completed.map((assignment) => (
                                <Link
                                    key={assignment.id}
                                    href={`/student/assignment/${assignment.id}`}
                                    className="block rounded-xl bg-gray-900 border border-gray-800 p-4 hover:border-emerald-500/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Check className="h-4 w-4 text-emerald-400" />
                                                <h3 className="font-medium text-white">
                                                    {assignment.title}
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-sm">
                                                <span className={`font-medium ${
                                                    assignment.score !== null && assignment.total_questions !== null
                                                        ? assignment.score / assignment.total_questions >= 0.8
                                                            ? "text-emerald-400"
                                                            : assignment.score / assignment.total_questions >= 0.6
                                                            ? "text-yellow-400"
                                                            : "text-red-400"
                                                        : "text-gray-400"
                                                }`}>
                                                    Score: {assignment.score}/{assignment.total_questions}
                                                </span>
                                                <span className="text-gray-500">
                                                    {assignment.completed_at && formatDate(assignment.completed_at)}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-600" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

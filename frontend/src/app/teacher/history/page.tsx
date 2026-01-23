"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Calendar,
    Users,
    Target,
    Clock,
    ChevronRight,
    Search,
    Filter,
    BarChart3,
    CheckCircle,
    XCircle,
    TrendingUp,
} from "lucide-react";
import { Button, Card, Badge, Progress } from "~/components/ui";

interface SessionHistoryItem {
    id: string;
    topic: string;
    date: string;
    duration: number; // minutes
    students: number;
    questions: number;
    accuracy: number;
    engagement: number;
    status: "completed" | "in-progress" | "cancelled";
}

export default function SessionHistoryPage() {
    const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    useEffect(() => {
        // Simulate loading sessions
        setTimeout(() => {
            setSessions([
                {
                    id: "1",
                    topic: "Introduction to Recursion",
                    date: "2024-01-15T10:00:00",
                    duration: 45,
                    students: 28,
                    questions: 8,
                    accuracy: 72,
                    engagement: 88,
                    status: "completed",
                },
                {
                    id: "2",
                    topic: "Big-O Notation Fundamentals",
                    date: "2024-01-14T14:30:00",
                    duration: 35,
                    students: 24,
                    questions: 6,
                    accuracy: 68,
                    engagement: 82,
                    status: "completed",
                },
                {
                    id: "3",
                    topic: "Graph Algorithms: BFS & DFS",
                    date: "2024-01-13T09:00:00",
                    duration: 50,
                    students: 26,
                    questions: 10,
                    accuracy: 61,
                    engagement: 79,
                    status: "completed",
                },
                {
                    id: "4",
                    topic: "Dynamic Programming Basics",
                    date: "2024-01-12T11:00:00",
                    duration: 40,
                    students: 22,
                    questions: 7,
                    accuracy: 55,
                    engagement: 75,
                    status: "completed",
                },
                {
                    id: "5",
                    topic: "Probability and Counting",
                    date: "2024-01-11T15:00:00",
                    duration: 38,
                    students: 25,
                    questions: 8,
                    accuracy: 64,
                    engagement: 81,
                    status: "completed",
                },
            ]);
            setIsLoading(false);
        }, 500);
    }, []);

    const filteredSessions = sessions.filter((session) => {
        const matchesSearch = session.topic.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === "all" || session.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const averageAccuracy = sessions.length > 0 
        ? Math.round(sessions.reduce((acc, s) => acc + s.accuracy, 0) / sessions.length) 
        : 0;

    const totalStudents = sessions.reduce((acc, s) => acc + s.students, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50">
            {/* Header */}
            <header className="border-b bg-white/80 backdrop-blur-sm px-6 py-4">
                <div className="mx-auto max-w-6xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/teacher" className="text-gray-400 hover:text-gray-600">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Session History</h1>
                            <p className="text-sm text-gray-500">Review and analyze past sessions</p>
                        </div>
                    </div>

                    <Link href="/teacher/analytics">
                        <Button variant="outline">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            View Analytics
                        </Button>
                    </Link>
                </div>
            </header>

            <div className="mx-auto max-w-6xl p-6">
                {/* Overview Stats */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <Card className="text-center">
                        <div className="text-3xl font-bold text-indigo-600">{sessions.length}</div>
                        <div className="text-sm text-gray-500">Total Sessions</div>
                    </Card>
                    <Card className="text-center">
                        <div className="text-3xl font-bold text-green-600">{totalStudents}</div>
                        <div className="text-sm text-gray-500">Student Interactions</div>
                    </Card>
                    <Card className="text-center">
                        <div className="text-3xl font-bold text-purple-600">{averageAccuracy}%</div>
                        <div className="text-sm text-gray-500">Avg Accuracy</div>
                    </Card>
                    <Card className="text-center">
                        <div className="text-3xl font-bold text-amber-600">
                            {sessions.reduce((acc, s) => acc + s.questions, 0)}
                        </div>
                        <div className="text-sm text-gray-500">Questions Asked</div>
                    </Card>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex rounded-xl bg-gray-100 p-1">
                        {["all", "completed", "in-progress"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    filterStatus === status
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900"
                                }`}
                            >
                                {status === "all" ? "All" : status === "completed" ? "Completed" : "In Progress"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sessions List */}
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
                            <p className="text-gray-500">Loading sessions...</p>
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">No sessions found</p>
                        </div>
                    ) : (
                        filteredSessions.map((session) => (
                            <SessionCard key={session.id} session={session} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function SessionCard({ session }: { session: SessionHistoryItem }) {
    const date = new Date(session.date);
    const formattedDate = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });

    return (
        <Card className="hover:shadow-lg transition-all cursor-pointer group">
            <div className="flex items-center gap-6">
                {/* Date Badge */}
                <div className="text-center min-w-[80px]">
                    <div className="text-xs text-gray-500 uppercase">{date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className="text-2xl font-bold text-gray-900">{date.getDate()}</div>
                    <div className="text-xs text-gray-500">{date.toLocaleDateString("en-US", { month: "short" })}</div>
                </div>

                <div className="h-16 w-px bg-gray-200" />

                {/* Main Info */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {session.topic}
                        </h3>
                        <Badge variant={session.status === "completed" ? "success" : "warning"}>
                            {session.status}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formattedTime} • {session.duration} min
                        </span>
                        <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {session.students} students
                        </span>
                        <span className="flex items-center gap-1">
                            <BarChart3 className="h-4 w-4" />
                            {session.questions} questions
                        </span>
                    </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <div className={`text-xl font-bold ${session.accuracy >= 70 ? "text-green-600" : session.accuracy >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {session.accuracy}%
                        </div>
                        <div className="text-xs text-gray-500">Accuracy</div>
                    </div>
                    <div className="text-center">
                        <div className={`text-xl font-bold ${session.engagement >= 80 ? "text-green-600" : "text-amber-600"}`}>
                            {session.engagement}%
                        </div>
                        <div className="text-xs text-gray-500">Engagement</div>
                    </div>
                </div>

                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            </div>
        </Card>
    );
}

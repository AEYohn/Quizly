"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, Search, Filter, Clock, Users, Play, Eye, Settings, Loader2 } from "lucide-react";
import { api } from "~/lib/api";
import type { SessionListItem } from "~/types";

export default function SessionsPage() {
    const [sessions, setSessions] = useState<SessionListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "completed">("all");

    useEffect(() => {
        async function fetchSessions() {
            const result = await api.sessions.getAll();
            if (result.success) {
                setSessions(result.data.sessions);
            }
            setIsLoading(false);
        }
        fetchSessions();
    }, []);

    // Derived state
    const activeSession = sessions.find(s => s.status === "active");

    const filteredSessions = sessions.filter(session => {
        const matchesSearch = session.topic.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || session.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
                    <p className="mt-1 text-gray-500">
                        Manage and launch your quiz sessions
                    </p>
                </div>
                <Link
                    href="/teacher/sessions/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-purple-600 px-5 py-2.5 font-medium text-white shadow-lg shadow-sky-600/30 transition-all hover:shadow-xl"
                >
                    <PlusCircle className="h-4 w-4" />
                    New Session
                </Link>
            </div>

            {/* Active Session Banner */}
            {activeSession && (
                <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                                <div className="h-4 w-4 animate-pulse rounded-full bg-white" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white/80">Live Session In Progress</p>
                                <h2 className="text-xl font-bold">{activeSession.topic}</h2>
                                <p className="text-sm text-white/80">
                                    {activeSession.participant_count || 0} students joined • {activeSession.num_questions} questions
                                </p>
                            </div>
                        </div>
                        <Link
                            href={`/teacher/sessions/${activeSession.session_id}/live`}
                            className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-green-600 shadow-lg transition-all hover:shadow-xl"
                        >
                            <Play className="h-5 w-5" />
                            Open Control Panel
                        </Link>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="mb-6 flex flex-col md:flex-row items-start md:items-center gap-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search topics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border-0 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {(["all", "active", "completed", "draft"] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === filter
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Session Grid */}
            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : filteredSessions.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredSessions.map((session) => (
                        <SessionCard
                            key={session.session_id}
                            session={session}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-center">
                    <p className="text-gray-500">No sessions found matching your filters.</p>
                    {sessions.length === 0 && (
                        <p className="mt-2 text-sm text-gray-400">Create a new session to get started!</p>
                    )}
                </div>
            )}
        </div>
    );
}

function SessionCard({ session }: { session: SessionListItem }) {
    const statusStyles = {
        active: {
            bg: "bg-green-100",
            text: "text-green-700",
            dot: "bg-green-500",
            border: "border-green-200 ring-2 ring-green-500/20"
        },
        completed: {
            bg: "bg-blue-100",
            text: "text-blue-700",
            dot: "bg-blue-500",
            border: "border-gray-100"
        },
        draft: {
            bg: "bg-amber-100",
            text: "text-amber-700",
            dot: "bg-amber-500",
            border: "border-gray-100"
        },
    };

    // Use a compatible key or fallback to draft styling if status is unexpected
    const statusKey = (session.status in statusStyles) ? session.status as keyof typeof statusStyles : 'draft';
    const style = statusStyles[statusKey];

    const formattedDate = new Date(session.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: session.created_at.startsWith(new Date().getFullYear().toString()) ? undefined : 'numeric'
    });

    return (
        <div className={`flex flex-col rounded-2xl border-2 bg-white p-6 shadow-sm transition-all hover:shadow-md ${style.border}`}>
            {/* Status Badge */}
            <div className="mb-4 flex items-center justify-between">
                <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}
                >
                    {session.status === "active" && (
                        <span
                            className={`mr-1.5 h-2 w-2 animate-pulse rounded-full ${style.dot}`}
                        />
                    )}
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {formattedDate}
                </span>
            </div>

            {/* Topic */}
            <h3 className="mb-2 text-lg font-bold text-gray-900 line-clamp-2">{session.topic}</h3>

            {/* Stats */}
            <div className="mb-6 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {session.participant_count > 0 ? `${session.participant_count} students` : "—"}
                </span>
                <span>📝 {session.num_questions} questions</span>
            </div>

            {/* Actions */}
            <div className="mt-auto border-t border-gray-100 pt-4">
                {session.status === "draft" && (
                    <div className="flex gap-2">
                        <Link
                            href={`/teacher/sessions/${session.session_id}/live`}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-purple-600 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
                        >
                            <Play className="h-4 w-4" />
                            Start
                        </Link>
                        <button className="rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                            <Settings className="h-4 w-4" />
                        </button>
                    </div>
                )}
                {session.status === "active" && (
                    <Link
                        href={`/teacher/sessions/${session.session_id}/live`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-green-700"
                    >
                        <Play className="h-4 w-4" />
                        Control Panel
                    </Link>
                )}
                {session.status === "completed" && (
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                        <Eye className="h-4 w-4" />
                        View Results
                    </button>
                )}
            </div>
        </div>
    );
}

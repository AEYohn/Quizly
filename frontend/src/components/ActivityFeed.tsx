"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    BookOpen,
    Trophy,
    ClipboardList,
    ChevronDown,
    ChevronUp,
    Play,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
} from "lucide-react";
import { ExitTicketCard } from "./ExitTicketCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    study_notes?: {
        key_concepts?: string[];
        common_mistakes?: string[];
        strategies?: string[];
        memory_tips?: string[];
    };
    practice_questions?: {
        prompt: string;
        options: string[];
        correct_answer: string;
        hint?: string;
        explanation?: string;
        difficulty?: string;
    }[];
    flashcards?: { front: string; back: string }[];
}

interface CompletedGame {
    game_id: string;
    quiz_title: string;
    score: number;
    total_questions?: number;
    played_at: string;
    nickname?: string;
}

interface PendingAssignment {
    id: string;
    title: string;
    teacher_name: string;
    question_count: number;
    due_date?: string;
    created_at: string;
}

type ActivityItem =
    | { type: "exit_ticket"; data: ExitTicket; date: string }
    | { type: "completed_game"; data: CompletedGame; date: string }
    | { type: "pending_assignment"; data: PendingAssignment; date: string };

interface ActivityFeedProps {
    studentName: string;
    token?: string;
    initialLimit?: number;
}

export function ActivityFeed({ studentName, token, initialLimit = 5 }: ActivityFeedProps) {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);
    const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

    useEffect(() => {
        if (studentName) {
            fetchActivities();
        }
    }, [studentName, token]);

    async function fetchActivities() {
        setLoading(true);
        const allActivities: ActivityItem[] = [];

        try {
            // Fetch exit tickets
            // For authenticated users, use the /mine endpoint which queries by student_id
            // This ensures exit tickets linked during sign-up are returned
            let ticketsRes;
            if (token) {
                ticketsRes = await fetch(
                    `${API_URL}/student-learning/exit-tickets/mine?limit=10`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
            } else {
                // For guests, fall back to student_name-based query
                ticketsRes = await fetch(
                    `${API_URL}/student-learning/exit-tickets?student_name=${encodeURIComponent(studentName)}&limit=10`
                );
            }
            if (ticketsRes.ok) {
                const tickets: ExitTicket[] = await ticketsRes.json();
                tickets.forEach(ticket => {
                    allActivities.push({
                        type: "exit_ticket",
                        data: ticket,
                        date: ticket.created_at,
                    });
                });
            }
        } catch (err) {
            console.error("Error fetching exit tickets:", err);
        }

        try {
            // Fetch completed games
            const gamesRes = await fetch(
                `${API_URL}/games/history/${encodeURIComponent(studentName)}?limit=10`
            );
            if (gamesRes.ok) {
                const games: CompletedGame[] = await gamesRes.json();
                games.forEach(game => {
                    allActivities.push({
                        type: "completed_game",
                        data: game,
                        date: game.played_at,
                    });
                });
            }
        } catch (err) {
            // Games history endpoint may not exist
        }

        try {
            // Fetch pending assignments
            const assignmentsRes = await fetch(
                `${API_URL}/assignments/inbox/${encodeURIComponent(studentName)}`
            );
            if (assignmentsRes.ok) {
                const data = await assignmentsRes.json();
                const assignments: PendingAssignment[] = data.assignments || [];
                assignments.forEach(assignment => {
                    allActivities.push({
                        type: "pending_assignment",
                        data: assignment,
                        date: assignment.created_at,
                    });
                });
            }
        } catch (err) {
            // Assignments endpoint may not exist
        }

        // Sort by date, most recent first
        allActivities.sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setActivities(allActivities);
        setLoading(false);
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
            setActivities(prev =>
                prev.map(activity => {
                    if (activity.type === "exit_ticket" && activity.data.id === ticketId) {
                        return {
                            ...activity,
                            data: {
                                ...activity.data,
                                is_completed: true,
                                student_answer: answer,
                                answered_correctly: result.is_correct,
                            },
                        };
                    }
                    return activity;
                })
            );
            return result;
        }
        throw new Error("Failed to submit answer");
    }

    function formatRelativeTime(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    const displayedActivities = showAll ? activities : activities.slice(0, initialLimit);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-8 text-center">
                <Clock className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No recent activity</h3>
                <p className="text-gray-400">
                    Join a game or practice a quiz to see your activity here
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {displayedActivities.map((activity, index) => {
                if (activity.type === "exit_ticket") {
                    const ticket = activity.data;
                    const isExpanded = expandedTicketId === ticket.id;

                    return (
                        <div key={`ticket-${ticket.id}`} className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800"
                                onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                        ticket.is_completed
                                            ? ticket.answered_correctly
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : "bg-orange-500/20 text-orange-400"
                                            : "bg-sky-500/20 text-sky-400"
                                    }`}>
                                        <BookOpen className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400">
                                                Exit Ticket
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {formatRelativeTime(ticket.created_at)}
                                            </span>
                                        </div>
                                        <h3 className="font-medium text-white mt-1">{ticket.target_concept}</h3>
                                        {!ticket.is_completed && (
                                            <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">
                                                {ticket.micro_lesson.slice(0, 80)}...
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {ticket.is_completed ? (
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            ticket.answered_correctly
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : "bg-orange-500/20 text-orange-400"
                                        }`}>
                                            {ticket.answered_correctly ? "Completed" : "Review"}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedTicketId(ticket.id);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500"
                                        >
                                            Review
                                        </button>
                                    )}
                                    {isExpanded ? (
                                        <ChevronUp className="h-5 w-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="h-5 w-5 text-gray-400" />
                                    )}
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="px-4 pb-4 border-t border-gray-700">
                                    <ExitTicketCard
                                        ticket={ticket}
                                        onAnswer={handleAnswerExitTicket}
                                        compact={false}
                                    />
                                </div>
                            )}
                        </div>
                    );
                }

                if (activity.type === "completed_game") {
                    const game = activity.data;
                    const scorePercent = game.total_questions
                        ? Math.round((game.score / game.total_questions) * 100)
                        : 0;
                    return (
                        <div key={`game-${game.game_id}`} className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                        <Trophy className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                                Game Complete
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {formatRelativeTime(game.played_at)}
                                            </span>
                                        </div>
                                        <h3 className="font-medium text-white mt-1">{game.quiz_title}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                            <span className="text-emerald-400 font-medium">{scorePercent}%</span>
                                            {game.total_questions && (
                                                <span>{game.score}/{game.total_questions} correct</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    href={`/play/${game.game_id}/results`}
                                    className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 hover:text-white"
                                >
                                    View Results
                                </Link>
                            </div>
                        </div>
                    );
                }

                if (activity.type === "pending_assignment") {
                    const assignment = activity.data;
                    return (
                        <div key={`assignment-${assignment.id}`} className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-pink-500/20 text-pink-400">
                                        <ClipboardList className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400">
                                                Assignment
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                from {assignment.teacher_name}
                                            </span>
                                        </div>
                                        <h3 className="font-medium text-white mt-1">{assignment.title}</h3>
                                        <p className="text-sm text-gray-400 mt-0.5">
                                            {assignment.question_count} questions
                                            {assignment.due_date && (
                                                <span className="ml-2 text-orange-400">
                                                    Due: {new Date(assignment.due_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href={`/student/assignment/${assignment.id}`}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-500"
                                >
                                    <Play className="h-4 w-4" />
                                    Start
                                </Link>
                            </div>
                        </div>
                    );
                }

                return null;
            })}

            {activities.length > initialLimit && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full py-3 text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                    {showAll ? (
                        <>
                            <ChevronUp className="h-4 w-4" />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-4 w-4" />
                            Show {activities.length - initialLimit} more
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

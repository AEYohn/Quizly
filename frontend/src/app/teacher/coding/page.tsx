"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Plus,
    Code2,
    Play,
    Users,
    Clock,
    ChevronRight,
    Loader2,
    Sparkles,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CodingProblem {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    subject: string;
    points: number;
    solve_count: number;
    attempt_count: number;
}

export default function CodingPage() {
    const [problems, setProblems] = useState<CodingProblem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProblems();
    }, []);

    const fetchProblems = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/coding`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setProblems(data);
            }
        } catch (error) {
            console.error("Failed to fetch problems:", error);
        } finally {
            setLoading(false);
        }
    };

    const difficultyColor = (difficulty: string) => {
        switch (difficulty.toLowerCase()) {
            case "easy":
                return "bg-green-100 text-green-700";
            case "medium":
                return "bg-yellow-100 text-yellow-700";
            case "hard":
                return "bg-red-100 text-red-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Coding Challenges</h1>
                    <p className="mt-1 text-gray-500">
                        LeetCode-style problems with AI-powered generation
                    </p>
                </div>
                <Link
                    href="/teacher/coding/new"
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-purple-700"
                >
                    <Plus className="h-5 w-5" />
                    Create Problem
                </Link>
            </div>

            {/* AI Generator Card */}
            <Link
                href="/teacher/coding/new"
                className="mb-8 block rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white shadow-lg transition-transform hover:scale-[1.01]"
            >
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20">
                        <Sparkles className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Generate with AI</h3>
                        <p className="text-purple-100">
                            Describe a topic and let Gemini create coding problems with test cases
                        </p>
                    </div>
                    <ChevronRight className="ml-auto h-6 w-6" />
                </div>
            </Link>

            {/* Problems List */}
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
            ) : problems.length === 0 ? (
                <div className="rounded-2xl bg-white p-12 text-center border-2 border-dashed border-gray-200">
                    <Code2 className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-4 text-lg font-semibold text-gray-900">
                        No coding problems yet
                    </h3>
                    <p className="mt-2 text-gray-500">
                        Create your first coding challenge with AI
                    </p>
                    <Link
                        href="/teacher/coding/new"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
                    >
                        <Plus className="h-5 w-5" />
                        Create Problem
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {problems.map((problem) => (
                        <div
                            key={problem.id}
                            className="rounded-xl bg-white p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-medium ${difficultyColor(
                                                problem.difficulty
                                            )}`}
                                        >
                                            {problem.difficulty}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {problem.points} pts
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {problem.title}
                                    </h3>
                                    <p className="mt-1 text-gray-500 line-clamp-2">
                                        {problem.description.replace(/[#*`]/g, "").slice(0, 150)}...
                                    </p>
                                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-4 w-4" />
                                            {problem.solve_count} solved
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Code2 className="h-4 w-4" />
                                            {problem.attempt_count} attempts
                                        </span>
                                    </div>
                                </div>
                                <Link
                                    href={`/play/coding/${problem.id}`}
                                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                                >
                                    <Play className="h-4 w-4" />
                                    Try It
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

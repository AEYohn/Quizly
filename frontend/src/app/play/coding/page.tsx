"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Code2, Search, Filter, Trophy, Users, Check, 
    ChevronRight, Loader2, Tag, BarChart2, Zap
} from "lucide-react";
import { StudentNav } from "@/components/ui/StudentNav";

interface Problem {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    subject: string;
    tags: string[];
    points: number;
    solve_count: number;
    attempt_count: number;
    test_case_count: number;
}

const SUBJECTS = [
    { id: "all", name: "All Subjects", icon: "📚" },
    { id: "programming", name: "Programming", icon: "💻" },
    { id: "math", name: "Mathematics", icon: "🔢" },
    { id: "data-structures", name: "Data Structures", icon: "🏗️" },
    { id: "algorithms", name: "Algorithms", icon: "⚡" },
    { id: "databases", name: "Databases", icon: "🗄️" },
    { id: "science", name: "Science", icon: "🔬" },
];

const DIFFICULTIES = [
    { id: "all", name: "All", color: "bg-gray-700" },
    { id: "easy", name: "Easy", color: "bg-emerald-500" },
    { id: "medium", name: "Medium", color: "bg-amber-500" },
    { id: "hard", name: "Hard", color: "bg-red-500" },
];

const DIFFICULTY_COLORS: Record<string, string> = {
    easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    hard: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function CodingProblemsPage() {
    const [problems, setProblems] = useState<Problem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("all");
    const [selectedDifficulty, setSelectedDifficulty] = useState("all");

    useEffect(() => {
        fetchProblems();
    }, [selectedSubject, selectedDifficulty]);

    async function fetchProblems() {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedSubject !== "all") params.append("subject", selectedSubject);
            if (selectedDifficulty !== "all") params.append("difficulty", selectedDifficulty);
            
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/coding?${params}`
            );
            if (res.ok) {
                const data = await res.json();
                setProblems(data);
            }
        } catch (err) {
            console.error("Error fetching problems:", err);
        }
        setIsLoading(false);
    }

    const filteredProblems = problems.filter(problem =>
        problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        problem.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const stats = {
        total: problems.length,
        easy: problems.filter(p => p.difficulty === "easy").length,
        medium: problems.filter(p => p.difficulty === "medium").length,
        hard: problems.filter(p => p.difficulty === "hard").length,
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <StudentNav />
            
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                <div className="mx-auto max-w-6xl px-6 py-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                            <Code2 className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Coding Challenges</h1>
                            <p className="text-gray-400">LeetCode-style problems for any subject</p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="rounded-xl bg-gray-800/50 p-4">
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-sm text-gray-400">Total Problems</p>
                        </div>
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                            <p className="text-2xl font-bold text-emerald-400">{stats.easy}</p>
                            <p className="text-sm text-emerald-400/70">Easy</p>
                        </div>
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                            <p className="text-2xl font-bold text-amber-400">{stats.medium}</p>
                            <p className="text-sm text-amber-400/70">Medium</p>
                        </div>
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                            <p className="text-2xl font-bold text-red-400">{stats.hard}</p>
                            <p className="text-sm text-red-400/70">Hard</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="border-b border-gray-800 bg-gray-900/30">
                <div className="mx-auto max-w-6xl px-6 py-4">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search problems..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
                            />
                        </div>

                        {/* Subject Filter */}
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                        >
                            {SUBJECTS.map(s => (
                                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                            ))}
                        </select>

                        {/* Difficulty Filter */}
                        <div className="flex gap-1 rounded-lg border border-gray-700 bg-gray-800/50 p-1">
                            {DIFFICULTIES.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => setSelectedDifficulty(d.id)}
                                    className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
                                        selectedDifficulty === d.id
                                            ? `${d.color} text-white`
                                            : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    {d.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Problems List */}
            <div className="mx-auto max-w-6xl px-6 py-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                    </div>
                ) : filteredProblems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Code2 className="mb-4 h-12 w-12 text-gray-700" />
                        <h3 className="text-lg font-medium text-gray-300">No problems found</h3>
                        <p className="mt-1 text-gray-500">Try adjusting your filters or check back later</p>
                        <Link
                            href="/teacher/coding/new"
                            className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500"
                        >
                            Create a Problem
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-800">
                        <table className="w-full">
                            <thead className="bg-gray-900/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Problem</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Subject</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Difficulty</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Points</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Success Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {filteredProblems.map((problem, i) => {
                                    const successRate = problem.attempt_count > 0
                                        ? Math.round((problem.solve_count / problem.attempt_count) * 100)
                                        : 0;
                                    
                                    return (
                                        <tr
                                            key={problem.id}
                                            className="group cursor-pointer transition-colors hover:bg-gray-800/50"
                                        >
                                            <td className="px-4 py-4">
                                                <div className="h-5 w-5 rounded-full border-2 border-gray-700" />
                                            </td>
                                            <td className="px-4 py-4">
                                                <Link href={`/play/coding/${problem.id}`} className="block">
                                                    <p className="font-medium text-white group-hover:text-violet-400">
                                                        {i + 1}. {problem.title}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {problem.tags.slice(0, 3).map((tag, j) => (
                                                            <span
                                                                key={j}
                                                                className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="flex items-center gap-1 text-sm text-gray-400 capitalize">
                                                    <Tag className="h-3 w-3" />
                                                    {problem.subject}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${DIFFICULTY_COLORS[problem.difficulty]}`}>
                                                    {problem.difficulty}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="flex items-center gap-1 text-sm">
                                                    <Trophy className="h-3 w-3 text-amber-500" />
                                                    {problem.points}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-800">
                                                        <div
                                                            className={`h-full rounded-full ${
                                                                successRate > 70 ? "bg-emerald-500" :
                                                                successRate > 40 ? "bg-amber-500" : "bg-red-500"
                                                            }`}
                                                            style={{ width: `${successRate}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500">{successRate}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

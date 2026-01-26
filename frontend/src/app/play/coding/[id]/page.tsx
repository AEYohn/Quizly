"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
    ArrowLeft, Clock, Trophy, Users, Lightbulb, ChevronRight,
    Check, X, Loader2, Code2, Tag, BarChart2
} from "lucide-react";
import { StudentNav } from "@/components/ui/StudentNav";
import { Markdown } from "@/components/ui/Markdown";
import { ResizableDivider } from "@/components/ui/ResizableDivider";

// Dynamic import for Monaco to avoid SSR issues
const CodeEditor = dynamic(
    () => import("~/components/ui/CodeEditor").then(mod => mod.CodeEditor),
    { ssr: false, loading: () => (
        <div className="flex h-full items-center justify-center bg-gray-900 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading code editor...
        </div>
    )}
);

interface TestCase {
    id: string | number;
    input_data: string;
    expected_output: string;
    explanation?: string;
    is_example: boolean;
}

interface Problem {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    subject: string;
    tags: string[];
    hints: string[];
    constraints?: string;
    starter_code: Record<string, string>;
    driver_code: Record<string, string>;
    function_name: string;
    time_limit_seconds: number;
    points: number;
    solve_count: number;
    attempt_count: number;
    test_cases: TestCase[];
    hidden_test_count: number;
}

interface SubmissionResult {
    status: string;
    tests_passed: number;
    tests_total: number;
    score: number;
    max_score: number;
    execution_time_ms?: number;
    test_results: { passed: boolean; time_ms: number; is_hidden: boolean }[];
}

const DIFFICULTY_COLORS: Record<string, string> = {
    easy: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    hard: "bg-red-100 text-red-700",
};

export default function CodingProblemPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [problem, setProblem] = useState<Problem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLanguage, setSelectedLanguage] = useState("python");
    const [showHints, setShowHints] = useState<number[]>([]);
    const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [studentName] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("quizly_student_name") || "Student";
        }
        return "Student";
    });
    const [leftPanelWidth, setLeftPanelWidth] = useState(45); // percentage

    const handleHorizontalResize = useCallback((delta: number) => {
        setLeftPanelWidth(prev => {
            const containerWidth = window.innerWidth;
            const deltaPercent = (delta / containerWidth) * 100;
            const newWidth = prev + deltaPercent;
            // Clamp between 20% and 70%
            return Math.min(70, Math.max(20, newWidth));
        });
    }, []);

    useEffect(() => {
        fetchProblem();
    }, [id]);

    useEffect(() => {
        if (problem && timeRemaining === null) {
            setTimeRemaining(problem.time_limit_seconds);
        }
    }, [problem]);

    useEffect(() => {
        if (timeRemaining === null || timeRemaining <= 0) return;
        
        const timer = setInterval(() => {
            setTimeRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
        }, 1000);
        
        return () => clearInterval(timer);
    }, [timeRemaining]);

    async function fetchProblem() {
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/coding/${id}`
            );
            if (res.ok) {
                const data = await res.json();
                setProblem(data);
            }
        } catch (err) {
            console.error("Error fetching problem:", err);
        }
        setIsLoading(false);
    }

    async function handleSubmit(code: string, language: string) {
        setIsSubmitting(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/coding/${id}/submit`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        code,
                        language,
                        student_name: studentName,
                    }),
                }
            );
            if (res.ok) {
                const result = await res.json();
                setSubmissionResult(result);
            }
        } catch (err) {
            console.error("Error submitting:", err);
        }
        setIsSubmitting(false);
    }

    function toggleHint(index: number) {
        setShowHints(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    }

    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
        );
    }

    if (!problem) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white">
                <Code2 className="mb-4 h-12 w-12 text-gray-600" />
                <p className="text-gray-400">Problem not found</p>
                <Link href="/play/coding" className="mt-4 text-sky-500 hover:underline">
                    Browse Problems
                </Link>
            </div>
        );
    }

    const testCasesForEditor = problem.test_cases.map((tc, i) => ({
        id: i,
        input: tc.input_data,
        expected_output: tc.expected_output,
        is_hidden: false,
    }));

    // Helper to convert escaped newlines to actual newlines for display
    const formatForDisplay = (text: string | undefined): string => {
        if (!text) return "(none)";
        return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    };

    return (
        <div className="flex h-screen bg-gray-950">
            {/* Left Panel: Problem Description */}
            <div
                className="overflow-y-auto"
                style={{ width: `${leftPanelWidth}%` }}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm px-6 py-4">
                    <Link
                        href="/play/coding"
                        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Problems
                    </Link>
                    
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">{problem.title}</h1>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${DIFFICULTY_COLORS[problem.difficulty]}`}>
                                    {problem.difficulty}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Tag className="h-3 w-3" />
                                    {problem.subject}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Trophy className="h-3 w-3" />
                                    {problem.points} pts
                                </span>
                            </div>
                        </div>
                        
                        {/* Timer */}
                        {timeRemaining !== null && (
                            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                                timeRemaining < 60 ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-300"
                            }`}>
                                <Clock className="h-4 w-4" />
                                <span className="font-mono text-sm">{formatTime(timeRemaining)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Description */}
                    <div>
                        <Markdown>{problem.description}</Markdown>
                    </div>

                    {/* Constraints */}
                    {problem.constraints && (
                        <div className="rounded-lg bg-gray-900 p-4">
                            <h3 className="mb-2 text-sm font-semibold text-gray-300">Constraints</h3>
                            <pre className="text-sm text-gray-400">{problem.constraints}</pre>
                        </div>
                    )}

                    {/* Example Test Cases */}
                    <div>
                        <h3 className="mb-3 text-sm font-semibold text-gray-300">Examples</h3>
                        <div className="space-y-3">
                            {problem.test_cases.filter(tc => tc.is_example).map((tc, i) => (
                                <div key={i} className="rounded-lg bg-gray-900 p-4">
                                    <p className="mb-2 text-xs font-medium text-gray-500">Example {i + 1}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="mb-1 text-xs text-gray-500">Input</p>
                                            <pre className="rounded bg-gray-950 p-2 text-sm text-emerald-400 whitespace-pre-wrap">
                                                {formatForDisplay(tc.input_data)}
                                            </pre>
                                        </div>
                                        <div>
                                            <p className="mb-1 text-xs text-gray-500">Output</p>
                                            <pre className="rounded bg-gray-950 p-2 text-sm text-sky-400 whitespace-pre-wrap">
                                                {formatForDisplay(tc.expected_output)}
                                            </pre>
                                        </div>
                                    </div>
                                    {tc.explanation && (
                                        <p className="mt-2 text-xs text-gray-500">{tc.explanation}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hints */}
                    {problem.hints.length > 0 && (
                        <div>
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                                <Lightbulb className="h-4 w-4 text-amber-500" />
                                Hints ({problem.hints.length})
                            </h3>
                            <div className="space-y-2">
                                {problem.hints.map((hint, i) => (
                                    <div key={i} className="rounded-lg bg-gray-900 overflow-hidden">
                                        <button
                                            onClick={() => toggleHint(i)}
                                            className="flex w-full items-center justify-between p-3 text-left hover:bg-gray-800"
                                        >
                                            <span className="text-sm text-gray-400">Hint {i + 1}</span>
                                            <ChevronRight className={`h-4 w-4 text-gray-500 transition-transform ${
                                                showHints.includes(i) ? "rotate-90" : ""
                                            }`} />
                                        </button>
                                        {showHints.includes(i) && (
                                            <div className="border-t border-gray-800 p-3">
                                                <p className="text-sm text-amber-400/80">{hint}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    {problem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {problem.tags.map((tag, i) => (
                                <span
                                    key={i}
                                    className="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-400"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Stats - only show if there's real data */}
                    {problem.attempt_count > 0 && (
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {problem.attempt_count} attempts
                            </span>
                            <span className="flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                {problem.solve_count} solved
                            </span>
                            <span className="flex items-center gap-1">
                                <BarChart2 className="h-3 w-3" />
                                {Math.round((problem.solve_count / problem.attempt_count) * 100)}% success
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Resizable Divider */}
            <ResizableDivider
                direction="horizontal"
                onResize={handleHorizontalResize}
            />

            {/* Right Panel: Code Editor */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Submission Result Banner */}
                {submissionResult && (
                    <div className={`border-b px-4 py-3 ${
                        submissionResult.status === "accepted"
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-red-500/30 bg-red-500/10"
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {submissionResult.status === "accepted" ? (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                                        <Check className="h-5 w-5 text-white" />
                                    </div>
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
                                        <X className="h-5 w-5 text-white" />
                                    </div>
                                )}
                                <div>
                                    <p className={`font-semibold ${
                                        submissionResult.status === "accepted" ? "text-emerald-400" : "text-red-400"
                                    }`}>
                                        {submissionResult.status === "accepted" ? "Accepted!" : "Wrong Answer"}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        {submissionResult.tests_passed}/{submissionResult.tests_total} tests passed
                                        {submissionResult.execution_time_ms && ` • ${submissionResult.execution_time_ms}ms`}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-white">
                                    {submissionResult.score}
                                    <span className="text-sm text-gray-500">/{submissionResult.max_score}</span>
                                </p>
                                <p className="text-xs text-gray-500">points</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Editor */}
                <div className="flex-1 min-h-0">
                    <CodeEditor
                        problemId={parseInt(id)}
                        initialCode={problem.starter_code[selectedLanguage] || ""}
                        language={selectedLanguage}
                        testCases={testCasesForEditor}
                        driverCode={problem.driver_code}
                        functionName={problem.function_name}
                        onSubmit={handleSubmit}
                    />
                </div>
            </div>
        </div>
    );
}

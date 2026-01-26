"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    PlusCircle,
    Users,
    Trophy,
    Sparkles,
    Loader2,
    Gamepad2,
    Pencil,
    Trash2,
    BarChart3,
    Copy,
    Check,
    Share2,
    ExternalLink,
    Code,
    ChevronDown,
    ChevronUp,
    Clock,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Quiz {
    id: string;
    title: string;
    question_count: number;
    times_played: number;
}

interface Game {
    id: string;
    game_code: string;
    quiz_id: string;
    quiz_title: string;
    status: string;
    sync_mode: boolean;
    player_count: number;
    created_at: string;
}

interface CodingProblem {
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
    created_at: string;
}

export default function TeacherDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [allGames, setAllGames] = useState<Game[]>([]);
    const [codingProblems, setCodingProblems] = useState<CodingProblem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [creatingGame, setCreatingGame] = useState<string | null>(null);
    const [deletingQuiz, setDeletingQuiz] = useState<string | null>(null);
    const [deletingProblem, setDeletingProblem] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
            return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        try {
            const [quizzesRes, gamesRes, codingRes] = await Promise.all([
                fetch(`${API_URL}/quizzes/`, { headers }),
                fetch(`${API_URL}/games/`, { headers }),
                fetch(`${API_URL}/coding/my`, { headers })
            ]);

            if (quizzesRes.ok) {
                const quizzesData = await quizzesRes.json();
                setQuizzes(quizzesData);
            }
            if (gamesRes.ok) {
                const gamesData = await gamesRes.json();
                setAllGames(gamesData);
            }
            if (codingRes.ok) {
                setCodingProblems(await codingRes.json());
            }
        } catch (err) {
            console.error("Failed to fetch data:", err);
        }
        setIsLoading(false);
    }

    // Get all games for a quiz, sorted by player count (most players first)
    const getGamesForQuiz = (quizId: string): Game[] => {
        return allGames
            .filter(g => g.quiz_id === quizId)
            .sort((a, b) => b.player_count - a.player_count);
    };

    // Get the best game for a quiz (most players, prefer non-finished)
    const getGameForQuiz = (quizId: string): Game | undefined => {
        const games = getGamesForQuiz(quizId);
        // Prefer non-finished games with players
        const activeWithPlayers = games.filter(g => g.status !== "finished" && g.player_count > 0);
        if (activeWithPlayers.length > 0) return activeWithPlayers[0];
        // Fall back to any non-finished game
        const active = games.filter(g => g.status !== "finished");
        if (active.length > 0) return active[0];
        // Fall back to finished game with most players
        return games[0];
    };

    const createGame = async (quizId: string) => {
        // Check if there's already an existing game - reuse it instead of creating new
        const existingGame = getGameForQuiz(quizId);
        if (existingGame) {
            copyCode(existingGame.game_code);
            return;
        }

        setCreatingGame(quizId);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ quiz_id: quizId, sync_mode: false }),
            });
            if (response.ok) {
                const game = await response.json();
                setAllGames(prev => [...prev, game]);
                copyCode(game.game_code);
            }
        } catch (error) {
            console.error("Failed to create game:", error);
        }
        setCreatingGame(null);
    };

    const deleteQuiz = async (quizId: string) => {
        if (!confirm("Are you sure you want to delete this quiz?")) return;

        setDeletingQuiz(quizId);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/quizzes/${quizId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                setQuizzes(quizzes.filter(q => q.id !== quizId));
            } else {
                alert("Failed to delete quiz");
            }
        } catch (error) {
            console.error("Failed to delete quiz:", error);
            alert("Failed to delete quiz");
        }
        setDeletingQuiz(null);
    };

    const deleteCodingProblem = async (problemId: string) => {
        if (!confirm("Are you sure you want to delete this coding challenge?")) return;

        setDeletingProblem(problemId);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/coding/${problemId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                setCodingProblems(codingProblems.filter(p => p.id !== problemId));
            } else {
                alert("Failed to delete coding challenge");
            }
        } catch (error) {
            console.error("Failed to delete coding challenge:", error);
            alert("Failed to delete coding challenge");
        }
        setDeletingProblem(null);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const getJoinUrl = (code: string) => {
        if (typeof window !== "undefined") {
            return `${window.location.origin}/join?code=${code}`;
        }
        return "";
    };

    const getCodingUrl = (problemId: string) => {
        if (typeof window !== "undefined") {
            return `${window.location.origin}/play/coding/${problemId}`;
        }
        return "";
    };

    const copyCodingLink = (problemId: string) => {
        const url = getCodingUrl(problemId);
        navigator.clipboard.writeText(url);
        setCopiedCode(problemId);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const getDifficultyColor = (difficulty: string) => {
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

    const shareQuiz = async (code: string, title: string) => {
        const url = getJoinUrl(code);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${title} on Quizly`,
                    text: `Use code ${code} to join!`,
                    url: url,
                });
            } catch {
                copyCode(code);
            }
        } else {
            copyCode(code);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900">
                <div className="mx-auto max-w-5xl px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                            <p className="text-gray-400">Create and share quizzes and coding challenges with your students</p>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                href="/teacher/coding/new"
                                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-5 py-2.5 font-medium text-gray-200 hover:bg-gray-700 transition-colors"
                            >
                                <Code className="h-4 w-4" />
                                Create Coding Challenge
                            </Link>
                            <Link
                                href="/teacher/quizzes/new"
                                className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500 transition-colors"
                            >
                                <Sparkles className="h-4 w-4" />
                                Create Quiz
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">
                {/* Quizzes Section */}
                <section>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Gamepad2 className="h-5 w-5 text-sky-400" />
                        Quizzes
                    </h2>
                    {quizzes.length === 0 ? (
                        <div className="rounded-2xl bg-gray-900 p-12 text-center border border-gray-800">
                            <Gamepad2 className="mx-auto h-12 w-12 text-gray-600" />
                            <h3 className="mt-4 text-lg font-semibold text-white">No quizzes yet</h3>
                            <p className="mt-2 text-gray-400 max-w-sm mx-auto">
                                Create your first quiz with AI - just describe what you want
                            </p>
                            <Link
                                href="/teacher/quizzes/new"
                                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500"
                            >
                                <PlusCircle className="h-4 w-4" />
                                Create Quiz
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {quizzes.map((quiz) => {
                            const game = getGameForQuiz(quiz.id);
                            const isCreating = creatingGame === quiz.id;

                            return (
                                <div
                                    key={quiz.id}
                                    className="rounded-xl bg-gray-900 border border-gray-800 p-6 hover:border-gray-700 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Quiz Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-white truncate">
                                                {quiz.title}
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-400">
                                                {quiz.question_count} questions
                                            </p>
                                        </div>

                                        {/* Game Code / Share Section */}
                                        <div className="flex items-center gap-3">
                                            {game ? (
                                                <>
                                                    {/* Code Display */}
                                                    <div className="flex items-center gap-2 rounded-lg bg-sky-500/20 border border-sky-500/30 px-4 py-2">
                                                        <span className="text-sm text-sky-400 font-medium">Code:</span>
                                                        <span className="font-mono text-lg font-bold text-sky-300">
                                                            {game.game_code}
                                                        </span>
                                                        <button
                                                            onClick={() => copyCode(game.game_code)}
                                                            className="p-1 rounded hover:bg-sky-500/30 text-sky-400"
                                                            title="Copy code"
                                                        >
                                                            {copiedCode === game.game_code ? (
                                                                <Check className="h-4 w-4" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>

                                                    {/* Share Button */}
                                                    <button
                                                        onClick={() => shareQuiz(game.game_code, quiz.title)}
                                                        className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500 transition-colors"
                                                    >
                                                        <Share2 className="h-4 w-4" />
                                                        Share
                                                    </button>

                                                    {/* Results */}
                                                    <Link
                                                        href={`/teacher/game/${game.id}/results`}
                                                        className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                                                    >
                                                        <BarChart3 className="h-4 w-4" />
                                                        Results
                                                        {game.player_count > 0 && (
                                                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                                                                {game.player_count}
                                                            </span>
                                                        )}
                                                    </Link>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => createGame(quiz.id)}
                                                    disabled={isCreating}
                                                    className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500 transition-colors disabled:opacity-50"
                                                >
                                                    {isCreating ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Creating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Share2 className="h-4 w-4" />
                                                            Get Share Code
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            {/* Edit/Delete */}
                                            <div className="flex items-center border-l border-gray-700 pl-3 ml-1">
                                                <Link
                                                    href={`/teacher/quizzes/${quiz.id}/edit`}
                                                    className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800"
                                                    title="Edit quiz"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => deleteQuiz(quiz.id)}
                                                    disabled={deletingQuiz === quiz.id}
                                                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                                    title="Delete quiz"
                                                >
                                                    {deletingQuiz === quiz.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Student count for active games */}
                                    {game && game.player_count > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2 text-sm text-gray-400">
                                            <Users className="h-4 w-4" />
                                            <span>{game.player_count} students have joined</span>
                                            <span className="text-emerald-400">● Active</span>
                                        </div>
                                    )}

                                    {/* Show all game sessions if multiple exist */}
                                    {(() => {
                                        const allQuizGames = getGamesForQuiz(quiz.id);
                                        if (allQuizGames.length <= 1) return null;

                                        return (
                                            <div className="mt-4 pt-4 border-t border-gray-800">
                                                <button
                                                    onClick={() => setExpandedQuiz(expandedQuiz === quiz.id ? null : quiz.id)}
                                                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                                                >
                                                    <Clock className="h-4 w-4" />
                                                    <span>{allQuizGames.length} game sessions</span>
                                                    {expandedQuiz === quiz.id ? (
                                                        <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" />
                                                    )}
                                                </button>

                                                {expandedQuiz === quiz.id && (
                                                    <div className="mt-3 space-y-2">
                                                        {allQuizGames.map((g) => (
                                                            <div
                                                                key={g.id}
                                                                className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-mono text-sm text-sky-300">{g.game_code}</span>
                                                                    <span className="text-xs text-gray-500">
                                                                        {new Date(g.created_at).toLocaleDateString()}
                                                                    </span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                                                        g.status === "finished"
                                                                            ? "bg-gray-700 text-gray-400"
                                                                            : "bg-emerald-500/20 text-emerald-400"
                                                                    }`}>
                                                                        {g.status}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm text-gray-400">
                                                                        <Users className="h-4 w-4 inline mr-1" />
                                                                        {g.player_count}
                                                                    </span>
                                                                    <Link
                                                                        href={`/teacher/game/${g.id}/results`}
                                                                        className="text-sm text-sky-400 hover:text-sky-300"
                                                                    >
                                                                        View Results →
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                    </div>
                    )}
                </section>

                {/* Coding Challenges Section */}
                <section>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Code className="h-5 w-5 text-sky-400" />
                        Coding Challenges
                    </h2>
                    {codingProblems.length === 0 ? (
                        <div className="rounded-2xl bg-gray-900 p-12 text-center border border-gray-800">
                            <Code className="mx-auto h-12 w-12 text-gray-600" />
                            <h3 className="mt-4 text-lg font-semibold text-white">No coding challenges yet</h3>
                            <p className="mt-2 text-gray-400 max-w-sm mx-auto">
                                Create LeetCode-style coding problems for your students
                            </p>
                            <Link
                                href="/teacher/coding/new"
                                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500"
                            >
                                <PlusCircle className="h-4 w-4" />
                                Create Coding Challenge
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {codingProblems.map((problem) => (
                                <div
                                    key={problem.id}
                                    className="rounded-xl bg-gray-900 border border-gray-800 p-6 hover:border-gray-700 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Problem Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-semibold text-white truncate">
                                                    {problem.title}
                                                </h3>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(problem.difficulty)}`}>
                                                    {problem.difficulty}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm text-gray-400">
                                                {problem.test_case_count} test cases • {problem.points} points
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-3">
                                            {/* Share Link */}
                                            <button
                                                onClick={() => copyCodingLink(problem.id)}
                                                className="flex items-center gap-2 rounded-lg bg-sky-500/20 border border-sky-500/30 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-500/30 transition-colors"
                                            >
                                                {copiedCode === problem.id ? (
                                                    <>
                                                        <Check className="h-4 w-4" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Share2 className="h-4 w-4" />
                                                        Copy Link
                                                    </>
                                                )}
                                            </button>

                                            {/* Open */}
                                            <Link
                                                href={`/play/coding/${problem.id}`}
                                                target="_blank"
                                                className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                Open
                                            </Link>

                                            {/* Delete */}
                                            <div className="flex items-center border-l border-gray-700 pl-3 ml-1">
                                                <button
                                                    onClick={() => deleteCodingProblem(problem.id)}
                                                    disabled={deletingProblem === problem.id}
                                                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                                    title="Delete coding challenge"
                                                >
                                                    {deletingProblem === problem.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    {(problem.solve_count > 0 || problem.attempt_count > 0) && (
                                        <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-4 text-sm text-gray-400">
                                            <span>{problem.attempt_count} attempts</span>
                                            <span>{problem.solve_count} solved</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

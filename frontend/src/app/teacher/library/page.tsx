"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Plus,
    Search,
    MoreVertical,
    Edit2,
    Trash2,
    Copy,
    FileQuestion,
    Code2,
    Users,
    X,
    LayoutGrid,
    List,
    Share2,
    BarChart3,
    Check,
    ExternalLink,
    Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Quiz {
    id: string;
    title: string;
    description: string | null;
    subject: string | null;
    question_count: number;
    times_played: number;
    created_at: string;
    updated_at: string;
    type: "quiz";
    // Active game info (if exists)
    active_game_id?: string;
    active_game_code?: string;
}

interface CodingChallenge {
    id: string;
    title: string;
    description: string | null;
    difficulty: "easy" | "medium" | "hard";
    language: string;
    times_attempted: number;
    created_at: string;
    updated_at: string;
    type: "coding";
}

type ContentItem = Quiz | CodingChallenge;

export default function LibraryPage() {
    const router = useRouter();
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "quiz" | "coding">("all");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Share modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareQuiz, setShareQuiz] = useState<Quiz | null>(null);
    const [gameCode, setGameCode] = useState<string | null>(null);
    const [gameId, setGameId] = useState<string | null>(null);
    const [creatingGame, setCreatingGame] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchContent();
    }, []);

    const fetchContent = async () => {
        try {
            const token = localStorage.getItem("token");

            // Fetch quizzes
            const quizzesRes = await fetch(`${API_URL}/quizzes/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const quizzes = quizzesRes.ok ? await quizzesRes.json() : [];

            // Fetch coding challenges
            const codingRes = await fetch(`${API_URL}/coding/challenges/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const challenges = codingRes.ok ? await codingRes.json() : [];

            // Merge and sort by updated_at
            const merged: ContentItem[] = [
                ...quizzes.map((q: Quiz) => ({ ...q, type: "quiz" as const })),
                ...challenges.map((c: CodingChallenge) => ({ ...c, type: "coding" as const })),
            ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

            setItems(merged);
        } catch (error) {
            console.error("Failed to fetch content:", error);
        } finally {
            setLoading(false);
        }
    };

    const deleteItem = async (item: ContentItem) => {
        if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return;

        try {
            const token = localStorage.getItem("token");
            const endpoint = item.type === "quiz"
                ? `${API_URL}/quizzes/${item.id}`
                : `${API_URL}/coding/challenges/${item.id}`;

            const response = await fetch(endpoint, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setItems(items.filter((i) => i.id !== item.id));
            }
        } catch (error) {
            console.error("Failed to delete:", error);
        }
        setOpenMenuId(null);
    };

    const duplicateItem = async (item: ContentItem) => {
        alert("Duplicate functionality coming soon!");
        setOpenMenuId(null);
    };

    // Open share modal and create game session if needed
    const openShareModal = async (quiz: Quiz) => {
        setShareQuiz(quiz);
        setShowShareModal(true);
        setCreatingGame(true);
        setCopied(false);

        try {
            const token = localStorage.getItem("token");

            // Create a new game session (async mode by default)
            const response = await fetch(`${API_URL}/games/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    quiz_id: quiz.id,
                    sync_mode: false, // Async-first
                    show_correct_answer: true,
                    show_answer_distribution: true,
                }),
            });

            if (response.ok) {
                const game = await response.json();
                setGameCode(game.game_code);
                setGameId(game.id);
            } else {
                const error = await response.json();
                console.error("Failed to create game:", error);
            }
        } catch (error) {
            console.error("Failed to create game:", error);
        } finally {
            setCreatingGame(false);
        }
    };

    const copyCode = () => {
        if (gameCode) {
            navigator.clipboard.writeText(gameCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const copyJoinLink = () => {
        if (gameId) {
            const link = `${window.location.origin}/join?code=${gameCode}`;
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const filteredItems = items
        .filter((item) => filterType === "all" || item.type === filterType)
        .filter((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const quizCount = items.filter((i) => i.type === "quiz").length;
    const codingCount = items.filter((i) => i.type === "coding").length;

    return (
        <div className="min-h-screen bg-gray-950 p-8">
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Content Library</h1>
                        <p className="mt-1 text-gray-400">
                            All your quizzes and coding challenges in one place
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/teacher/quizzes/new"
                            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700"
                        >
                            <Plus className="h-5 w-5" />
                            Create Quiz
                        </Link>
                        <Link
                            href="/teacher/coding/new"
                            className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 font-medium text-gray-300 hover:bg-gray-800"
                        >
                            <Code2 className="h-5 w-5" />
                            Create Challenge
                        </Link>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search content..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-10 pr-4 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-1">
                        <button
                            onClick={() => setFilterType("all")}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                filterType === "all"
                                    ? "bg-gray-700 text-white"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            All ({items.length})
                        </button>
                        <button
                            onClick={() => setFilterType("quiz")}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                                filterType === "quiz"
                                    ? "bg-sky-500/20 text-sky-400"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            <FileQuestion className="h-4 w-4" />
                            Quizzes ({quizCount})
                        </button>
                        <button
                            onClick={() => setFilterType("coding")}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                                filterType === "coding"
                                    ? "bg-green-500/20 text-green-400"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            <Code2 className="h-4 w-4" />
                            Coding ({codingCount})
                        </button>
                    </div>

                    {/* View Toggle */}
                    <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-1">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded-md transition-colors ${
                                viewMode === "grid" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded-md transition-colors ${
                                viewMode === "list" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Content Grid/List */}
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="text-gray-400">Loading content...</div>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-700 bg-gray-900">
                    <FileQuestion className="mb-4 h-12 w-12 text-gray-500" />
                    <h3 className="mb-2 text-lg font-semibold text-white">
                        {searchQuery ? "No content found" : "No content yet"}
                    </h3>
                    <p className="mb-4 text-gray-400">
                        {searchQuery
                            ? "Try a different search term"
                            : "Create your first quiz or coding challenge"}
                    </p>
                    {!searchQuery && (
                        <div className="flex gap-3">
                            <Link
                                href="/teacher/quizzes/new"
                                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
                            >
                                <Plus className="h-5 w-5" />
                                Create Quiz
                            </Link>
                        </div>
                    )}
                </div>
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className="group relative rounded-xl border border-gray-800 bg-gray-900 p-6 transition-all hover:border-gray-700"
                        >
                            {/* Menu Button */}
                            <div className="absolute right-4 top-4">
                                <button
                                    onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </button>

                                {openMenuId === item.id && (
                                    <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-lg">
                                        <button
                                            onClick={() => {
                                                const path = item.type === "quiz"
                                                    ? `/teacher/quizzes/${item.id}/edit`
                                                    : `/teacher/coding/${item.id}/edit`;
                                                router.push(path);
                                                setOpenMenuId(null);
                                            }}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => duplicateItem(item)}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                                        >
                                            <Copy className="h-4 w-4" />
                                            Duplicate
                                        </button>
                                        <button
                                            onClick={() => deleteItem(item)}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/20"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Content Type Badge */}
                            <div className="mb-4">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                                    item.type === "quiz"
                                        ? "bg-sky-500/20 text-sky-400"
                                        : "bg-green-500/20 text-green-400"
                                }`}>
                                    {item.type === "quiz" ? (
                                        <FileQuestion className="h-3 w-3" />
                                    ) : (
                                        <Code2 className="h-3 w-3" />
                                    )}
                                    {item.type === "quiz" ? "Quiz" : "Coding"}
                                </span>
                                {item.type === "quiz" && (item as Quiz).subject && (
                                    <span className="ml-2 text-xs text-gray-500">
                                        {(item as Quiz).subject}
                                    </span>
                                )}
                                {item.type === "coding" && (
                                    <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                                        (item as CodingChallenge).difficulty === "easy"
                                            ? "bg-green-500/20 text-green-400"
                                            : (item as CodingChallenge).difficulty === "medium"
                                            ? "bg-yellow-500/20 text-yellow-400"
                                            : "bg-red-500/20 text-red-400"
                                    }`}>
                                        {(item as CodingChallenge).difficulty}
                                    </span>
                                )}
                            </div>

                            {/* Title & Description */}
                            <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
                            {item.description && (
                                <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                                    {item.description}
                                </p>
                            )}

                            {/* Stats */}
                            <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
                                {item.type === "quiz" ? (
                                    <>
                                        <span className="flex items-center gap-1">
                                            <FileQuestion className="h-4 w-4" />
                                            {(item as Quiz).question_count} questions
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users className="h-4 w-4" />
                                            {(item as Quiz).times_played || 0} plays
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex items-center gap-1">
                                            <Code2 className="h-4 w-4" />
                                            {(item as CodingChallenge).language}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users className="h-4 w-4" />
                                            {(item as CodingChallenge).times_attempted} attempts
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Actions - Async-first UI */}
                            <div className="mt-4 flex gap-2">
                                {item.type === "quiz" && (
                                    <>
                                        <button
                                            onClick={() => openShareModal(item as Quiz)}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700"
                                        >
                                            <Share2 className="h-4 w-4" />
                                            Share
                                        </button>
                                        {(item as Quiz).times_played > 0 && (item as Quiz).active_game_id ? (
                                            <Link
                                                href={`/teacher/game/${(item as Quiz).active_game_id}/results`}
                                                className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-gray-300 transition-colors hover:bg-gray-800"
                                                title="View results"
                                            >
                                                <BarChart3 className="h-4 w-4" />
                                            </Link>
                                        ) : (
                                            <button
                                                disabled
                                                className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-gray-500 cursor-not-allowed opacity-50"
                                                title="No plays yet"
                                            >
                                                <BarChart3 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </>
                                )}
                                <Link
                                    href={item.type === "quiz" ? `/teacher/quizzes/${item.id}/edit` : `/teacher/coding/${item.id}/edit`}
                                    className="flex items-center justify-center rounded-lg border border-gray-700 px-3 py-2 text-gray-300 transition-colors hover:bg-gray-800"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
                    {filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors"
                        >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                item.type === "quiz" ? "bg-sky-500/20" : "bg-green-500/20"
                            }`}>
                                {item.type === "quiz" ? (
                                    <FileQuestion className="h-5 w-5 text-sky-400" />
                                ) : (
                                    <Code2 className="h-5 w-5 text-green-400" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-white truncate">{item.title}</h3>
                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                    {item.type === "quiz" ? (
                                        <>
                                            <span>{(item as Quiz).question_count} questions</span>
                                            <span>{(item as Quiz).times_played || 0} plays</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{(item as CodingChallenge).language}</span>
                                            <span className={`${
                                                (item as CodingChallenge).difficulty === "easy" ? "text-green-400" :
                                                (item as CodingChallenge).difficulty === "medium" ? "text-yellow-400" : "text-red-400"
                                            }`}>
                                                {(item as CodingChallenge).difficulty}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {item.type === "quiz" && (
                                    <>
                                        <button
                                            onClick={() => openShareModal(item as Quiz)}
                                            className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                                        >
                                            <Share2 className="h-4 w-4" />
                                            Share
                                        </button>
                                        {(item as Quiz).times_played > 0 && (item as Quiz).active_game_id ? (
                                            <Link
                                                href={`/teacher/game/${(item as Quiz).active_game_id}/results`}
                                                className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                                            >
                                                <BarChart3 className="h-4 w-4" />
                                                Results
                                            </Link>
                                        ) : (
                                            <button
                                                disabled
                                                className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-500 cursor-not-allowed opacity-50"
                                                title="No plays yet"
                                            >
                                                <BarChart3 className="h-4 w-4" />
                                                Results
                                            </button>
                                        )}
                                    </>
                                )}
                                <Link
                                    href={item.type === "quiz" ? `/teacher/quizzes/${item.id}/edit` : `/teacher/coding/${item.id}/edit`}
                                    className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                                >
                                    <Edit2 className="h-4 w-4" />
                                    Edit
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Share Modal */}
            {showShareModal && shareQuiz && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Share Quiz</h2>
                            <button
                                onClick={() => {
                                    setShowShareModal(false);
                                    setShareQuiz(null);
                                    setGameCode(null);
                                    setGameId(null);
                                }}
                                className="text-gray-400 hover:text-white"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="text-center">
                            <h3 className="text-lg font-medium text-white mb-2">{shareQuiz.title}</h3>
                            <p className="text-sm text-gray-400 mb-6">
                                Students can join anytime and complete at their own pace
                            </p>

                            {creatingGame ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                                </div>
                            ) : gameCode ? (
                                <>
                                    {/* Game Code */}
                                    <div className="mb-6">
                                        <p className="text-sm text-gray-400 mb-2">Join Code</p>
                                        <div className="flex items-center justify-center gap-3">
                                            <span className="text-4xl font-mono font-bold tracking-widest text-sky-400">
                                                {gameCode}
                                            </span>
                                            <button
                                                onClick={copyCode}
                                                className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                                            >
                                                {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Share Options */}
                                    <div className="space-y-3">
                                        <button
                                            onClick={copyJoinLink}
                                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-700 transition-colors"
                                        >
                                            <ExternalLink className="h-5 w-5" />
                                            Copy Join Link
                                        </button>

                                        <Link
                                            href={`/teacher/game/${gameId}/results`}
                                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-3 font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                                        >
                                            <BarChart3 className="h-5 w-5" />
                                            View Results
                                        </Link>
                                    </div>

                                    <p className="mt-6 text-xs text-gray-500">
                                        Students go to <span className="text-sky-400">quizly.app/join</span> and enter the code
                                    </p>
                                </>
                            ) : (
                                <div className="py-8 text-gray-400">
                                    Failed to create share link. Please try again.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Plus,
    Search,
    MoreVertical,
    Play,
    Edit2,
    Trash2,
    Copy,
    FileQuestion,
    Users,
    Calendar,
    X,
    Zap,
    Clock,
    Settings,
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
}

interface GameSettings {
    sync_mode: boolean;
    show_correct_answer: boolean;
    show_answer_distribution: boolean;
}

export default function QuizLibrary() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    
    // Game settings modal state
    const [showGameSettings, setShowGameSettings] = useState(false);
    const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
    const [gameSettings, setGameSettings] = useState<GameSettings>({
        sync_mode: true,
        show_correct_answer: true,
        show_answer_distribution: true,
    });
    const [startingGame, setStartingGame] = useState(false);

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/quizzes/`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setQuizzes(data);
            }
        } catch (error) {
            console.error("Failed to fetch quizzes:", error);
        } finally {
            setLoading(false);
        }
    };

    const deleteQuiz = async (id: string) => {
        if (!confirm("Are you sure you want to delete this quiz?")) return;
        
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/quizzes/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                setQuizzes(quizzes.filter((q) => q.id !== id));
            }
        } catch (error) {
            console.error("Failed to delete quiz:", error);
        }
        setOpenMenuId(null);
    };

    const duplicateQuiz = async (id: string) => {
        // TODO: Implement duplicate functionality
        alert("Duplicate functionality coming soon!");
        setOpenMenuId(null);
    };

    const openGameSettingsModal = (quizId: string) => {
        setSelectedQuizId(quizId);
        setShowGameSettings(true);
    };

    const startGame = async () => {
        if (!selectedQuizId) return;
        
        setStartingGame(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/games/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ 
                    quiz_id: selectedQuizId,
                    sync_mode: gameSettings.sync_mode,
                    show_correct_answer: gameSettings.show_correct_answer,
                    show_answer_distribution: gameSettings.show_answer_distribution,
                }),
            });
            if (response.ok) {
                const game = await response.json();
                router.push(`/teacher/game/${game.id}/lobby`);
            } else {
                const error = await response.json();
                alert(error.detail || "Failed to start game");
            }
        } catch (error) {
            console.error("Failed to start game:", error);
        } finally {
            setStartingGame(false);
            setShowGameSettings(false);
        }
    };

    const filteredQuizzes = quizzes.filter((quiz) =>
        quiz.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-950 p-8">
            {/* Header */}
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">My Quizzes</h1>
                    <p className="mt-1 text-gray-400">
                        Create and manage your quiz library
                    </p>
                </div>
                <Link
                    href="/teacher/quizzes/new"
                    className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700"
                >
                    <Plus className="h-5 w-5" />
                    Create Quiz
                </Link>
            </header>

            {/* Search */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search quizzes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-10 pr-4 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                </div>
            </div>

            {/* Quiz Grid */}
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="text-gray-400">Loading quizzes...</div>
                </div>
            ) : filteredQuizzes.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-700 bg-gray-900">
                    <FileQuestion className="mb-4 h-12 w-12 text-gray-500" />
                    <h3 className="mb-2 text-lg font-semibold text-white">
                        {searchQuery ? "No quizzes found" : "No quizzes yet"}
                    </h3>
                    <p className="mb-4 text-gray-400">
                        {searchQuery
                            ? "Try a different search term"
                            : "Create your first quiz to get started"}
                    </p>
                    {!searchQuery && (
                        <Link
                            href="/teacher/quizzes/new"
                            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
                        >
                            <Plus className="h-5 w-5" />
                            Create Quiz
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredQuizzes.map((quiz) => (
                        <div
                            key={quiz.id}
                            className="group relative rounded-xl border border-gray-800 bg-gray-900 p-6 transition-all hover:border-gray-700"
                        >
                            {/* Menu Button */}
                            <div className="absolute right-4 top-4">
                                <button
                                    onClick={() =>
                                        setOpenMenuId(openMenuId === quiz.id ? null : quiz.id)
                                    }
                                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </button>

                                {/* Dropdown Menu */}
                                {openMenuId === quiz.id && (
                                    <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-lg">
                                        <button
                                            onClick={() => {
                                                router.push(`/teacher/quizzes/${quiz.id}/edit`);
                                                setOpenMenuId(null);
                                            }}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => duplicateQuiz(quiz.id)}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                                        >
                                            <Copy className="h-4 w-4" />
                                            Duplicate
                                        </button>
                                        <button
                                            onClick={() => deleteQuiz(quiz.id)}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/20"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Quiz Info */}
                            <div className="mb-4">
                                <div className="mb-2 inline-block rounded-full bg-sky-500/20 px-3 py-1 text-xs font-medium text-sky-400">
                                    {quiz.subject || "General"}
                                </div>
                                <h3 className="text-lg font-semibold text-white">
                                    {quiz.title}
                                </h3>
                                {quiz.description && (
                                    <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                                        {quiz.description}
                                    </p>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="mb-4 flex items-center gap-4 text-sm text-gray-400">
                                <span className="flex items-center gap-1">
                                    <FileQuestion className="h-4 w-4" />
                                    {quiz.question_count} questions
                                </span>
                                <span className="flex items-center gap-1">
                                    <Users className="h-4 w-4" />
                                    {quiz.times_played} plays
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openGameSettingsModal(quiz.id)}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                                >
                                    <Play className="h-4 w-4" />
                                    Start Game
                                </button>
                                <Link
                                    href={`/teacher/quizzes/${quiz.id}/edit`}
                                    className="flex items-center justify-center rounded-lg border border-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-800"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Game Settings Modal */}
            {showGameSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-xl">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Game Settings</h2>
                            <button
                                onClick={() => setShowGameSettings(false)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Sync Mode Toggle */}
                            <label className="flex items-start gap-4 rounded-xl border border-gray-700 p-4 cursor-pointer hover:bg-gray-800">
                                <input
                                    type="checkbox"
                                    checked={gameSettings.sync_mode}
                                    onChange={(e) => setGameSettings({ ...gameSettings, sync_mode: e.target.checked })}
                                    className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-sky-500 focus:ring-sky-500"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 font-medium text-white">
                                        <Zap className="h-4 w-4 text-sky-400" />
                                        Live Synchronized Mode
                                    </div>
                                    <p className="mt-1 text-sm text-gray-400">
                                        Everyone sees the same question with a synchronized timer countdown. Like Kahoot!
                                    </p>
                                </div>
                            </label>

                            {/* Show Correct Answer Toggle */}
                            <label className="flex items-start gap-4 rounded-xl border border-gray-700 p-4 cursor-pointer hover:bg-gray-800">
                                <input
                                    type="checkbox"
                                    checked={gameSettings.show_correct_answer}
                                    onChange={(e) => setGameSettings({ ...gameSettings, show_correct_answer: e.target.checked })}
                                    className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-sky-500 focus:ring-sky-500"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-white">
                                        Show Correct Answer
                                    </div>
                                    <p className="mt-1 text-sm text-gray-400">
                                        Reveal the correct answer after each question
                                    </p>
                                </div>
                            </label>

                            {/* Show Distribution Toggle */}
                            <label className="flex items-start gap-4 rounded-xl border border-gray-700 p-4 cursor-pointer hover:bg-gray-800">
                                <input
                                    type="checkbox"
                                    checked={gameSettings.show_answer_distribution}
                                    onChange={(e) => setGameSettings({ ...gameSettings, show_answer_distribution: e.target.checked })}
                                    className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-sky-500 focus:ring-sky-500"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-white">
                                        Show Answer Distribution
                                    </div>
                                    <p className="mt-1 text-sm text-gray-400">
                                        Display how many students chose each option
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setShowGameSettings(false)}
                                className="flex-1 rounded-lg border border-gray-700 px-4 py-3 font-medium text-gray-300 transition-colors hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={startGame}
                                disabled={startingGame}
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                            >
                                {startingGame ? (
                                    <span className="animate-pulse">Starting...</span>
                                ) : (
                                    <>
                                        <Play className="h-5 w-5" />
                                        Start Game
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    Play,
    Users,
    BookOpen,
    Trophy,
    ArrowRight,
    Loader2,
    LogOut,
    Plus,
    GraduationCap,
    Pencil,
    Check,
    X,
    FolderOpen,
    Folder,
    ChevronDown,
    ChevronUp,
    Share2,
    Lock,
    DoorOpen,
    TrendingUp,
    Target,
    BarChart3,
    AlertTriangle,
    Copy,
    Link as LinkIcon,
    Trash2,
    FileText,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth";
import { useUser, useClerk } from "@clerk/nextjs";

// Lazy-load ActivityFeed: below-the-fold, fetches multiple API endpoints,
// renders exit tickets, game history, and assignment cards
const ActivityFeed = dynamic(
    () => import("@/components/ActivityFeed").then((mod) => mod.ActivityFeed),
    {
        ssr: false,
        loading: () => (
            <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-gray-800/50 border border-gray-700" />
                ))}
            </div>
        ),
    },
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StudyQuiz {
    id: string;
    title: string;
    description: string | null;
    subject: string | null;
    question_count: number;
    times_practiced: number;
    best_score: number | null;
    is_public: boolean;
}

interface EnrolledClass {
    id: string;
    name: string;
    description?: string;
    teacher_name: string;
    progress?: number;
    enrolled_at?: string;
}

interface ProgressData {
    total_exit_tickets: number;
    completed_exit_tickets: number;
    overall_accuracy: number;
    concepts_mastered: string[];
    weak_concepts: string[];
    active_misconceptions: {
        id: string;
        type: string;
        description: string;
        severity: string;
    }[];
}

export default function StudentDashboard() {
    const router = useRouter();
    const { user, token, isAuthenticated } = useAuth();
    const { user: clerkUser } = useUser();
    const { signOut } = useClerk();
    const [studentName, setStudentName] = useState("");
    const [studyQuizzes, setStudyQuizzes] = useState<StudyQuiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [joinCode, setJoinCode] = useState("");
    const [joiningGame, setJoiningGame] = useState(false);
    const [joinError, setJoinError] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState("");
    const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());
    const [editingSubject, setEditingSubject] = useState<string | null>(null);
    const [editSubjectValue, setEditSubjectValue] = useState("");
    const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);
    const [showJoinClassModal, setShowJoinClassModal] = useState(false);
    const [classCode, setClassCode] = useState("");
    const [joiningClass, setJoiningClass] = useState(false);
    const [joinClassError, setJoinClassError] = useState("");
    const [progressData, setProgressData] = useState<ProgressData | null>(null);
    const [progressExpanded, setProgressExpanded] = useState(false);
    const [shareToast, setShareToast] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Group quizzes by subject
    const groupQuizzesBySubject = (quizzes: StudyQuiz[]): Map<string, StudyQuiz[]> => {
        const groups = new Map<string, StudyQuiz[]>();
        quizzes.forEach(quiz => {
            const subject = quiz.subject || "Unsorted";
            if (!groups.has(subject)) {
                groups.set(subject, []);
            }
            groups.get(subject)!.push(quiz);
        });
        // Sort: Unsorted goes last
        const sorted = new Map<string, StudyQuiz[]>();
        const keys = Array.from(groups.keys()).sort((a, b) => {
            if (a === "Unsorted") return 1;
            if (b === "Unsorted") return -1;
            return a.localeCompare(b);
        });
        keys.forEach(k => sorted.set(k, groups.get(k)!));
        return sorted;
    };

    const toggleSubject = (subject: string) => {
        setCollapsedSubjects(prev => {
            const next = new Set(prev);
            if (next.has(subject)) {
                next.delete(subject);
            } else {
                next.add(subject);
            }
            return next;
        });
    };

    const startEditingSubject = (subject: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditSubjectValue(subject === "Unsorted" ? "" : subject);
        setEditingSubject(subject);
    };

    const saveSubjectRename = async () => {
        if (!editingSubject || !token) return;

        const newSubject = editSubjectValue.trim() || null;
        const oldSubject = editingSubject === "Unsorted" ? null : editingSubject;

        // Update all quizzes with the old subject to the new subject
        const quizzesToUpdate = studyQuizzes.filter(q =>
            (q.subject || null) === oldSubject
        );

        try {
            for (const quiz of quizzesToUpdate) {
                await fetch(`${API_URL}/student/quizzes/${quiz.id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ subject: newSubject }),
                });
            }

            // Update local state
            setStudyQuizzes(prev => prev.map(q =>
                (q.subject || null) === oldSubject
                    ? { ...q, subject: newSubject }
                    : q
            ));
        } catch (error) {
            console.error("Failed to rename subject:", error);
        }

        setEditingSubject(null);
        setEditSubjectValue("");
    };

    const cancelEditingSubject = () => {
        setEditingSubject(null);
        setEditSubjectValue("");
    };

    const toggleQuizShare = async (quizId: string, currentlyPublic: boolean) => {
        if (!token) return;

        // If already public, copy the share link instead of toggling
        if (currentlyPublic) {
            const shareUrl = `${window.location.origin}/practice/${quizId}`;
            try {
                await navigator.clipboard.writeText(shareUrl);
                setShareToast("Link copied! Anyone can practice this quiz");
                setTimeout(() => setShareToast(null), 3000);
            } catch {
                // Fallback for browsers that don't support clipboard API
                setShareToast(shareUrl);
                setTimeout(() => setShareToast(null), 5000);
            }
            return;
        }

        // Toggle to public
        try {
            const response = await fetch(`${API_URL}/student/quizzes/${quizId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ is_public: true }),
            });

            if (response.ok) {
                setStudyQuizzes(prev => prev.map(q =>
                    q.id === quizId ? { ...q, is_public: true } : q
                ));

                // Copy the share link
                const shareUrl = `${window.location.origin}/practice/${quizId}`;
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    setShareToast("Quiz is now public! Link copied to clipboard");
                } catch {
                    setShareToast("Quiz is now public! Share link: " + shareUrl);
                }
                setTimeout(() => setShareToast(null), 3000);
            }
        } catch (error) {
            console.error("Failed to toggle share:", error);
        }
    };

    const makeQuizPrivate = async (quizId: string) => {
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/student/quizzes/${quizId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ is_public: false }),
            });

            if (response.ok) {
                setStudyQuizzes(prev => prev.map(q =>
                    q.id === quizId ? { ...q, is_public: false } : q
                ));
                setShareToast("Quiz is now private");
                setTimeout(() => setShareToast(null), 2000);
            }
        } catch (error) {
            console.error("Failed to make private:", error);
        }
    };

    // Get profile image from Clerk
    const profileImage = clerkUser?.imageUrl;

    useEffect(() => {
        // Use custom name first, then Clerk, then localStorage
        const customName = localStorage.getItem("quizly_display_name");
        const name = customName || clerkUser?.firstName || clerkUser?.username || user?.name || localStorage.getItem("quizly_student_name");
        if (!name) {
            router.push("/student");
            return;
        }
        setStudentName(name);
        fetchData(name); // Pass name directly to avoid stale state
    }, [router, user, clerkUser]);

    const startEditingName = () => {
        setEditNameValue(studentName);
        setIsEditingName(true);
    };

    const saveName = () => {
        const trimmedName = editNameValue.trim();
        if (trimmedName) {
            setStudentName(trimmedName);
            localStorage.setItem("quizly_display_name", trimmedName);
        }
        setIsEditingName(false);
    };

    const cancelEditingName = () => {
        setIsEditingName(false);
        setEditNameValue("");
    };

    const fetchData = async (name?: string) => {
        const currentName = name || studentName;
        try {
            // Fetch study quizzes if authenticated
            if (token) {
                try {
                    const studyRes = await fetch(`${API_URL}/student/quizzes`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (studyRes.ok) {
                        const data = await studyRes.json();
                        setStudyQuizzes(data); // Get all to group by subject
                    }
                } catch {
                    // Study quizzes endpoint may not be available
                }

                // Fetch enrolled classes
                if (currentName) {
                    try {
                        const classesRes = await fetch(`${API_URL}/courses/enrolled?student_name=${encodeURIComponent(currentName)}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (classesRes.ok) {
                            const data = await classesRes.json();
                            setEnrolledClasses(data.courses || []);
                        }
                    } catch {
                        // Enrolled classes endpoint may not be available
                    }
                }
            }

            // Fetch progress data (works for all students)
            if (currentName) {
                try {
                    const progressRes = await fetch(
                        `${API_URL}/student-learning/dashboard/${encodeURIComponent(currentName)}`
                    );
                    if (progressRes.ok) {
                        const data = await progressRes.json();
                        setProgressData({
                            total_exit_tickets: data.summary?.total_exit_tickets || 0,
                            completed_exit_tickets: data.summary?.completed_exit_tickets || 0,
                            overall_accuracy: data.adaptive_learning?.overall_accuracy || 0,
                            concepts_mastered: [], // Could be derived from exit tickets
                            weak_concepts: data.adaptive_learning?.weak_concepts || [],
                            active_misconceptions: (data.misconceptions || [])
                                .filter((m: { is_resolved: boolean }) => !m.is_resolved)
                                .slice(0, 5)
                                .map((m: { id: string; misconception_type: string; description: string; severity: string }) => ({
                                    id: m.id,
                                    type: m.misconception_type,
                                    description: m.description,
                                    severity: m.severity,
                                })),
                        });
                    }
                } catch {
                    // Progress endpoint may not be available
                }
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            setFetchError("Failed to load dashboard data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!classCode.trim() || !token) return;

        setJoiningClass(true);
        setJoinClassError("");

        try {
            const response = await fetch(`${API_URL}/courses/enroll/${classCode.toUpperCase()}?student_name=${encodeURIComponent(studentName)}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Refresh enrolled classes
                fetchData();
                setShowJoinClassModal(false);
                setClassCode("");
            } else {
                const error = await response.json();
                setJoinClassError(error.detail || "Failed to join class");
            }
        } catch (error) {
            setJoinClassError("Connection failed. Try again!");
        } finally {
            setJoiningClass(false);
        }
    };

    const handleLeaveClass = async (courseId: string, courseName: string) => {
        if (!confirm(`Leave "${courseName}"? You can rejoin later with the class code.`)) {
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/courses/unenroll/${courseId}?student_name=${encodeURIComponent(studentName)}`,
                {
                    method: "DELETE",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                }
            );

            if (response.ok) {
                // Remove from local state
                setEnrolledClasses(prev => prev.filter(c => c.id !== courseId));
            } else {
                const error = await response.json();
                alert(error.detail || "Failed to leave class");
            }
        } catch (error) {
            alert("Connection failed. Try again!");
        }
    };

    const handleJoinWithCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;

        setJoiningGame(true);
        setJoinError("");

        try {
            const response = await fetch(`${API_URL}/games/code/${joinCode.toUpperCase()}`);
            if (response.ok) {
                const game = await response.json();
                if (game.status !== "lobby") {
                    setJoinError("This game has already started!");
                    setJoiningGame(false);
                    return;
                }

                // Join the game using /games/join endpoint with game_code
                const joinRes = await fetch(`${API_URL}/games/join`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        game_code: joinCode.toUpperCase(),
                        nickname: studentName
                    }),
                });

                if (joinRes.ok) {
                    const joinData = await joinRes.json();
                    sessionStorage.setItem("playerId", joinData.player_id);
                    sessionStorage.setItem("nickname", studentName);
                    sessionStorage.setItem("gameId", joinData.game_id);
                    router.push(`/play/${joinData.game_id}`);
                } else {
                    const error = await joinRes.json();
                    setJoinError(error.detail || "Couldn't join the game");
                }
            } else {
                setJoinError("Game not found. Check your code!");
            }
        } catch (error) {
            setJoinError("Connection failed. Try again!");
        } finally {
            setJoiningGame(false);
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem("quizly_student_name");
        localStorage.removeItem("quizly_user");
        sessionStorage.clear();
        if (clerkUser) {
            await signOut();
            router.push("/");
        } else {
            router.push("/student");
        }
    };

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="mx-auto max-w-6xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                                {profileImage ? (
                                    <Image
                                        src={profileImage}
                                        alt={studentName}
                                        width={40}
                                        height={40}
                                        className="h-10 w-10 rounded-xl object-cover"
                                    />
                                ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-lg font-bold text-white">
                                        {studentName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editNameValue}
                                        onChange={(e) => setEditNameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") saveName();
                                            if (e.key === "Escape") cancelEditingName();
                                        }}
                                        className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-white focus:outline-none focus:border-sky-500"
                                        autoFocus
                                    />
                                    <button
                                        onClick={saveName}
                                        className="text-green-400 hover:text-green-300 p-1"
                                        title="Save"
                                    >
                                        <Check className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={cancelEditingName}
                                        className="text-gray-400 hover:text-white p-1"
                                        title="Cancel"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <h1 className="font-bold text-white">Welcome, {studentName}!</h1>
                                        <p className="text-xs text-gray-400">Ready to learn something new?</p>
                                    </div>
                                    <button
                                        onClick={startEditingName}
                                        className="ml-2 text-gray-400 hover:text-white transition-colors"
                                        title="Edit name"
                                    >
                                        <Pencil className="h-5 w-5" />
                                    </button>
                                </>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                        >
                            <LogOut className="h-4 w-4" />
                            Switch User
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-8">
                {/* Join with Code */}
                <div className="mb-8 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 p-6 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold mb-1">Join a Live Game</h2>
                            <p className="text-sky-200">Enter the game code from your teacher</p>
                        </div>
                        <form onSubmit={handleJoinWithCode} className="flex gap-3">
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="ABC123"
                                maxLength={6}
                                className="w-36 rounded-xl bg-white/90 text-sky-700 px-4 py-3 text-center text-lg font-bold tracking-widest placeholder-sky-400/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-white border-2 border-white/50"
                            />
                            <button
                                type="submit"
                                disabled={joiningGame || joinCode.length < 4}
                                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-sky-600 transition-all hover:bg-sky-50 disabled:opacity-50"
                            >
                                {joiningGame ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        Join
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                    {joinError && (
                        <p className="mt-3 text-sm text-red-200">{joinError}</p>
                    )}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
                        <p className="text-gray-400 text-sm">Loading your dashboard...</p>
                    </div>
                ) : fetchError ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-red-400" />
                        </div>
                        <p className="text-white font-medium">Couldn&apos;t load dashboard</p>
                        <p className="text-gray-400 text-sm">{fetchError}</p>
                        <button
                            onClick={() => { setFetchError(null); setLoading(true); fetchData(studentName); }}
                            className="mt-2 px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-500 transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Recent Activity & Study Packets */}
                        <section className="mb-8">
                            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                                <BookOpen className="h-5 w-5 text-sky-400" />
                                Study Packets & Activity
                            </h2>
                            <p className="text-sm text-gray-400 mb-4">Your exit tickets and study materials from quizzes appear here</p>
                            <ActivityFeed studentName={studentName} token={token ?? undefined} initialLimit={5} />
                        </section>

                        {/* My Study Quizzes - Only show for authenticated users */}
                        {isAuthenticated && (
                            <section className="mb-8">
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                                        <GraduationCap className="h-5 w-5 text-emerald-400" />
                                        My Quizzes
                                    </h2>
                                    <Link
                                        href="/student/study/new"
                                        className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Create Quiz
                                    </Link>
                                </div>

                                {studyQuizzes.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-6">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div>
                                                <h3 className="font-semibold text-white mb-1">Create your own study quizzes</h3>
                                                <p className="text-sm text-gray-400">
                                                    Practice any topic with AI-generated questions
                                                </p>
                                            </div>
                                            <Link
                                                href="/student/study/new"
                                                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Create Quiz
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {Array.from(groupQuizzesBySubject(studyQuizzes)).map(([subject, subjectQuizzes]) => {
                                            const isCollapsed = collapsedSubjects.has(subject);
                                            return (
                                                <div key={subject} className="rounded-xl border border-gray-800 overflow-hidden">
                                                    {/* Subject Header */}
                                                    {editingSubject === subject ? (
                                                        <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80">
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <FolderOpen className="h-4 w-4 text-emerald-400" />
                                                                <input
                                                                    type="text"
                                                                    value={editSubjectValue}
                                                                    onChange={(e) => setEditSubjectValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") saveSubjectRename();
                                                                        if (e.key === "Escape") cancelEditingSubject();
                                                                    }}
                                                                    placeholder="Subject name"
                                                                    className="bg-gray-800 border border-emerald-500 rounded px-2 py-1 text-sm text-white focus:outline-none flex-1 max-w-[200px]"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={saveSubjectRename}
                                                                    className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded"
                                                                    title="Save"
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={cancelEditingSubject}
                                                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                                                                    title="Cancel"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/80 hover:bg-gray-900 transition-colors cursor-pointer"
                                                            onClick={() => toggleSubject(subject)}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {isCollapsed ? (
                                                                    <Folder className="h-4 w-4 text-emerald-400" />
                                                                ) : (
                                                                    <FolderOpen className="h-4 w-4 text-emerald-400" />
                                                                )}
                                                                <span className="font-medium text-white">{subject}</span>
                                                                <span className="text-xs text-gray-500">
                                                                    ({subjectQuizzes.length})
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startEditingSubject(subject, e);
                                                                    }}
                                                                    className="text-xs text-gray-500 hover:text-white flex items-center gap-1 p-1 hover:bg-gray-700 rounded"
                                                                    title="Rename"
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </button>
                                                                <Link
                                                                    href={`/student/study/new?subject=${encodeURIComponent(subject === "Unsorted" ? "" : subject)}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                    Add
                                                                </Link>
                                                                {isCollapsed ? (
                                                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                                                ) : (
                                                                    <ChevronUp className="h-4 w-4 text-gray-500" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Quizzes in this subject */}
                                                    {!isCollapsed && (
                                                        <div className="divide-y divide-gray-800/50">
                                                            {subjectQuizzes.map((quiz) => (
                                                                <div
                                                                    key={quiz.id}
                                                                    className="flex items-center justify-between px-4 py-3 bg-gray-900/40 hover:bg-gray-800/50 transition-colors"
                                                                >
                                                                    <Link
                                                                        href={`/student/study/${quiz.id}/practice`}
                                                                        className="flex-1 font-medium text-white hover:text-emerald-300"
                                                                    >
                                                                        {quiz.title}
                                                                    </Link>
                                                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                                                        <span>{quiz.question_count} Q</span>
                                                                        <span className="flex items-center gap-1">
                                                                            <Play className="h-3 w-3" />
                                                                            {quiz.times_practiced}x
                                                                        </span>
                                                                        {quiz.best_score !== null && (
                                                                            <span className="flex items-center gap-1 text-emerald-400">
                                                                                <Trophy className="h-3 w-3" />
                                                                                {quiz.best_score.toFixed(0)}%
                                                                            </span>
                                                                        )}
                                                                        {quiz.is_public ? (
                                                                            <>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        toggleQuizShare(quiz.id, true);
                                                                                    }}
                                                                                    className="p-1.5 rounded transition-colors text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                                                                                    title="Copy share link"
                                                                                >
                                                                                    <LinkIcon className="h-3 w-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        makeQuizPrivate(quiz.id);
                                                                                    }}
                                                                                    className="p-1.5 rounded transition-colors text-gray-500 hover:text-white hover:bg-gray-700"
                                                                                    title="Make private"
                                                                                >
                                                                                    <Lock className="h-3 w-3" />
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleQuizShare(quiz.id, false);
                                                                                }}
                                                                                className="p-1.5 rounded transition-colors text-gray-500 hover:text-white hover:bg-gray-700"
                                                                                title="Share quiz publicly"
                                                                            >
                                                                                <Share2 className="h-3 w-3" />
                                                                            </button>
                                                                        )}
                                                                        <Link
                                                                            href={`/student/study/${quiz.id}/edit`}
                                                                            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded"
                                                                            title="Edit quiz"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </Link>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* My Classes - Enrolled Courses from Teachers */}
                        <section>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                                    <BookOpen className="h-5 w-5 text-sky-400" />
                                    My Classes
                                </h2>
                                <button
                                    onClick={() => setShowJoinClassModal(true)}
                                    className="flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300"
                                >
                                    <Plus className="h-4 w-4" />
                                    Join Class
                                </button>
                            </div>

                            {enrolledClasses.length === 0 ? (
                                <div className="rounded-xl border-2 border-dashed border-gray-700 bg-gray-900 p-8 text-center">
                                    <BookOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-2">No classes yet</h3>
                                    <p className="text-gray-400 mb-4">Join a class using the code from your teacher</p>
                                    <button
                                        onClick={() => setShowJoinClassModal(true)}
                                        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Join a Class
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {enrolledClasses.map((course) => (
                                        <div
                                            key={course.id}
                                            onClick={() => router.push(`/student/class/${course.id}`)}
                                            className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition-all hover:border-sky-500/50 hover:bg-gray-800/50 cursor-pointer"
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="inline-block rounded-full bg-sky-500/20 px-3 py-1 text-xs font-medium text-sky-400">
                                                    Class
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleLeaveClass(course.id, course.name);
                                                    }}
                                                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Leave class"
                                                >
                                                    <DoorOpen className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <h3 className="font-semibold text-white mb-1">{course.name}</h3>
                                            <p className="text-sm text-gray-400 mb-3">by {course.teacher_name}</p>
                                            {course.progress !== undefined && (
                                                <>
                                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                        <span>Progress</span>
                                                        <span>{course.progress}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-sky-500 rounded-full transition-all"
                                                            style={{ width: `${course.progress}%` }}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* My Progress - Collapsible */}
                        <section className="mt-8">
                            <button
                                onClick={() => setProgressExpanded(!progressExpanded)}
                                className="w-full mb-4 flex items-center justify-between text-left"
                            >
                                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                                    <BarChart3 className="h-5 w-5 text-purple-400" />
                                    My Progress
                                </h2>
                                <div className="flex items-center gap-2 text-gray-400">
                                    <span className="text-sm">
                                        {progressExpanded ? "Hide" : "Show"}
                                    </span>
                                    {progressExpanded ? (
                                        <ChevronUp className="h-5 w-5" />
                                    ) : (
                                        <ChevronDown className="h-5 w-5" />
                                    )}
                                </div>
                            </button>

                            {progressExpanded && (
                                <div className="space-y-4">
                                    {/* Stats Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
                                            <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                                <TrendingUp className="h-4 w-4" />
                                                <span className="text-xs font-medium">Accuracy</span>
                                            </div>
                                            <p className="text-2xl font-bold text-white">
                                                {progressData ? `${Math.round(progressData.overall_accuracy * 100)}%` : "0%"}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
                                            <div className="flex items-center gap-2 text-sky-400 mb-1">
                                                <BookOpen className="h-4 w-4" />
                                                <span className="text-xs font-medium">Lessons</span>
                                            </div>
                                            <p className="text-2xl font-bold text-white">
                                                {progressData?.completed_exit_tickets || 0}
                                                <span className="text-sm text-gray-500 font-normal">
                                                    /{progressData?.total_exit_tickets || 0}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
                                            <div className="flex items-center gap-2 text-purple-400 mb-1">
                                                <Trophy className="h-4 w-4" />
                                                <span className="text-xs font-medium">Quizzes</span>
                                            </div>
                                            <p className="text-2xl font-bold text-white">
                                                {studyQuizzes.length}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
                                            <div className="flex items-center gap-2 text-orange-400 mb-1">
                                                <AlertTriangle className="h-4 w-4" />
                                                <span className="text-xs font-medium">To Review</span>
                                            </div>
                                            <p className="text-2xl font-bold text-white">
                                                {progressData?.active_misconceptions.length || 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Weak Concepts */}
                                    {progressData?.weak_concepts && progressData.weak_concepts.length > 0 && (
                                        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
                                            <h3 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
                                                <Target className="h-4 w-4 text-orange-400" />
                                                Areas to Practice
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {progressData.weak_concepts.map((concept, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 text-sm"
                                                    >
                                                        {concept}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Misconceptions */}
                                    {progressData?.active_misconceptions && progressData.active_misconceptions.length > 0 && (
                                        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
                                            <h3 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
                                                <AlertTriangle className="h-4 w-4 text-red-400" />
                                                Misconceptions to Address
                                            </h3>
                                            <div className="space-y-2">
                                                {progressData.active_misconceptions.map((misconception) => (
                                                    <div
                                                        key={misconception.id}
                                                        className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/50"
                                                    >
                                                        <div className={`p-1.5 rounded-full ${
                                                            misconception.severity === "high"
                                                                ? "bg-red-500/20 text-red-400"
                                                                : misconception.severity === "medium"
                                                                ? "bg-orange-500/20 text-orange-400"
                                                                : "bg-yellow-500/20 text-yellow-400"
                                                        }`}>
                                                            <AlertTriangle className="h-3 w-3" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white">{misconception.type}</p>
                                                            <p className="text-xs text-gray-400 line-clamp-2">{misconception.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty State */}
                                    {!progressData?.weak_concepts?.length && !progressData?.active_misconceptions?.length && (
                                        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-6 text-center">
                                            <Trophy className="mx-auto h-10 w-10 text-emerald-400 mb-3" />
                                            <p className="text-white font-medium">Great job!</p>
                                            <p className="text-sm text-gray-400">No areas needing review right now</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {/* Join Class Modal */}
                {showJoinClassModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                        <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Join a Class</h2>
                                <button
                                    onClick={() => {
                                        setShowJoinClassModal(false);
                                        setClassCode("");
                                        setJoinClassError("");
                                    }}
                                    className="text-gray-500 hover:text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <p className="text-gray-400 mb-4">Enter the class code from your teacher</p>

                            <form onSubmit={handleJoinClass} className="space-y-4">
                                <input
                                    type="text"
                                    value={classCode}
                                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                                    placeholder="Enter class code (e.g., ABC123)"
                                    maxLength={6}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-center text-lg font-bold tracking-widest text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none"
                                    autoFocus
                                />

                                {joinClassError && (
                                    <p className="text-sm text-red-400 text-center">{joinClassError}</p>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowJoinClassModal(false);
                                            setClassCode("");
                                            setJoinClassError("");
                                        }}
                                        className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 font-medium text-gray-300 hover:bg-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={classCode.length < 4 || joiningClass}
                                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                                    >
                                        {joiningClass ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Joining...
                                            </>
                                        ) : (
                                            "Join Class"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Share Toast Notification */}
                {shareToast && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 shadow-lg">
                            <div className="p-1.5 rounded-full bg-sky-500/20">
                                <Check className="h-4 w-4 text-sky-400" />
                            </div>
                            <p className="text-sm text-white">{shareToast}</p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    BookOpen,
    Users,
    Copy,
    Check,
    Loader2,
    PlusCircle,
    Trash2,
    ChevronDown,
    ChevronRight,
    Play,
    FileText,
    Video,
    GripVertical,
    X,
    ToggleLeft,
    ToggleRight,
    UserMinus,
    Layers,
    BarChart3,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Target,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ModuleItem {
    id: string;
    title: string;
    item_type: string;
    order_index: number;
    content?: string;
    video_url?: string;
    session_id?: string;
    duration_mins?: number;
    points: number;
    is_published: boolean;
}

interface Module {
    id: string;
    title: string;
    description?: string;
    order_index: number;
    is_published: boolean;
    items: ModuleItem[];
}

interface Course {
    id: string;
    name: string;
    description?: string;
    teacher_name: string;
    teacher_id: string;
    enrollment_code?: string;
    is_published: boolean;
    enrollment_count: number;
    modules: Module[];
    created_at: string;
}

interface Student {
    id: string;
    student_name: string;
    student_id?: string;
    enrolled_at: string;
    role: string;
}

interface Quiz {
    id: string;
    title: string;
    question_count: number;
    subject?: string;
}

interface StudentPerformance {
    nickname: string;
    accuracy: number;
    avg_confidence: number;
    sessions_participated: number;
    total_questions: number;
    overconfident_errors: number;
    needs_support: boolean;
    trend: string;
}

interface ClassAnalytics {
    course_id: string;
    sessions: Array<{
        session_id: string;
        quiz_title: string;
        game_code: string;
        played_at: string;
        player_count: number;
        class_accuracy: number;
    }>;
    student_performance: StudentPerformance[];
    students_needing_support: string[];
    overall_trend: string;
    summary: string;
    class_stats: {
        total_students: number;
        avg_accuracy: number;
        students_struggling: number;
    };
}

export default function ClassroomDetailPage() {
    const router = useRouter();
    const params = useParams();
    const courseId = params.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"content" | "students" | "analytics">("content");

    // UI states
    const [copiedCode, setCopiedCode] = useState(false);
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
    const [togglingEnrollment, setTogglingEnrollment] = useState(false);

    // Modal states
    const [showAddModuleModal, setShowAddModuleModal] = useState(false);
    const [showAddItemModal, setShowAddItemModal] = useState<string | null>(null);
    const [newModuleTitle, setNewModuleTitle] = useState("");
    const [newItemTitle, setNewItemTitle] = useState("");
    const [newItemType, setNewItemType] = useState<"quiz" | "lesson" | "video">("lesson");
    const [selectedQuizId, setSelectedQuizId] = useState("");
    const [creatingModule, setCreatingModule] = useState(false);
    const [creatingItem, setCreatingItem] = useState(false);
    const [deletingModule, setDeletingModule] = useState<string | null>(null);
    const [deletingItem, setDeletingItem] = useState<string | null>(null);
    const [removingStudent, setRemovingStudent] = useState<string | null>(null);

    useEffect(() => {
        fetchCourse();
        fetchStudents();
        fetchQuizzes();
    }, [courseId]);

    async function fetchCourse() {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/courses/${courseId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setCourse(data);
                // Expand all modules by default
                setExpandedModules(new Set(data.modules?.map((m: Module) => m.id) || []));
            } else {
                setError("Classroom not found");
            }
        } catch (err) {
            setError("Failed to load classroom");
        } finally {
            setLoading(false);
        }
    }

    async function fetchStudents() {
        const token = localStorage.getItem("token");
        try {
            const response = await fetch(`${API_URL}/courses/${courseId}/students`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setStudents(data.students || []);
            }
        } catch (err) {
            console.error("Failed to fetch students:", err);
        }
    }

    async function fetchQuizzes() {
        const token = localStorage.getItem("token");
        try {
            const response = await fetch(`${API_URL}/quizzes/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setQuizzes(data);
            }
        } catch (err) {
            console.error("Failed to fetch quizzes:", err);
        }
    }

    async function fetchAnalytics() {
        const token = localStorage.getItem("token");
        if (!token) return;

        setAnalyticsLoading(true);
        try {
            const response = await fetch(`${API_URL}/analytics/course/${courseId}/trends`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAnalytics(data);
            }
        } catch (err) {
            console.error("Failed to fetch analytics:", err);
        }
        setAnalyticsLoading(false);
    }

    useEffect(() => {
        if (activeTab === "analytics" && !analytics) {
            fetchAnalytics();
        }
    }, [activeTab]);

    async function toggleEnrollment() {
        if (!course) return;
        setTogglingEnrollment(true);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${courseId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ is_published: !course.is_published }),
            });

            if (response.ok) {
                setCourse({ ...course, is_published: !course.is_published });
            }
        } catch (err) {
            console.error("Failed to toggle enrollment:", err);
        }
        setTogglingEnrollment(false);
    }

    async function createModule() {
        if (!newModuleTitle.trim()) return;
        setCreatingModule(true);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${courseId}/modules`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ title: newModuleTitle }),
            });

            if (response.ok) {
                const newModule = await response.json();
                setCourse(prev => prev ? {
                    ...prev,
                    modules: [...prev.modules, { ...newModule, items: [] }]
                } : null);
                setExpandedModules(prev => new Set([...prev, newModule.id]));
                setNewModuleTitle("");
                setShowAddModuleModal(false);
            }
        } catch (err) {
            console.error("Failed to create module:", err);
        }
        setCreatingModule(false);
    }

    async function deleteModule(moduleId: string) {
        if (!confirm("Delete this module and all its items?")) return;
        setDeletingModule(moduleId);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${courseId}/modules/${moduleId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setCourse(prev => prev ? {
                    ...prev,
                    modules: prev.modules.filter(m => m.id !== moduleId)
                } : null);
            }
        } catch (err) {
            console.error("Failed to delete module:", err);
        }
        setDeletingModule(null);
    }

    async function createItem(moduleId: string) {
        if (!newItemTitle.trim()) return;
        if (newItemType === "quiz" && !selectedQuizId) return;

        setCreatingItem(true);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${courseId}/modules/${moduleId}/items`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: newItemTitle,
                    item_type: newItemType,
                    session_id: newItemType === "quiz" ? selectedQuizId : undefined,
                    points: newItemType === "quiz" ? 100 : 0,
                }),
            });

            if (response.ok) {
                const newItem = await response.json();
                setCourse(prev => prev ? {
                    ...prev,
                    modules: prev.modules.map(m =>
                        m.id === moduleId
                            ? { ...m, items: [...m.items, newItem] }
                            : m
                    )
                } : null);
                setNewItemTitle("");
                setNewItemType("lesson");
                setSelectedQuizId("");
                setShowAddItemModal(null);
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error("Failed to create item:", response.status, errorData);
                alert(`Failed to add item: ${errorData.detail || response.statusText}`);
            }
        } catch (err) {
            console.error("Failed to create item:", err);
            alert("Failed to add item. Please try again.");
        }
        setCreatingItem(false);
    }

    async function deleteItem(moduleId: string, itemId: string) {
        setDeletingItem(itemId);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${courseId}/modules/${moduleId}/items/${itemId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setCourse(prev => prev ? {
                    ...prev,
                    modules: prev.modules.map(m =>
                        m.id === moduleId
                            ? { ...m, items: m.items.filter(i => i.id !== itemId) }
                            : m
                    )
                } : null);
            }
        } catch (err) {
            console.error("Failed to delete item:", err);
        }
        setDeletingItem(null);
    }

    async function removeStudent(enrollmentId: string) {
        if (!confirm("Remove this student from the classroom?")) return;
        setRemovingStudent(enrollmentId);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${courseId}/students/${enrollmentId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setStudents(students.filter(s => s.id !== enrollmentId));
                if (course) {
                    setCourse({ ...course, enrollment_count: Math.max(0, course.enrollment_count - 1) });
                }
            }
        } catch (err) {
            console.error("Failed to remove student:", err);
        }
        setRemovingStudent(null);
    }

    const copyCode = () => {
        if (course?.enrollment_code) {
            navigator.clipboard.writeText(course.enrollment_code);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev => {
            const next = new Set(prev);
            if (next.has(moduleId)) {
                next.delete(moduleId);
            } else {
                next.add(moduleId);
            }
            return next;
        });
    };

    const getItemIcon = (itemType: string) => {
        switch (itemType) {
            case "quiz": return <Play className="h-4 w-4" />;
            case "video": return <Video className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    const getItemColor = (itemType: string) => {
        switch (itemType) {
            case "quiz": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
            case "video": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
            default: return "bg-sky-500/20 text-sky-400 border-sky-500/30";
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            </div>
        );
    }

    if (error || !course) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-400">{error || "Classroom not found"}</p>
                <button
                    onClick={() => router.push("/teacher/classrooms")}
                    className="text-sky-400 hover:text-sky-300"
                >
                    Back to classrooms
                </button>
            </div>
        );
    }

    const totalItems = course.modules.reduce((sum, m) => sum + m.items.length, 0);

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="mx-auto max-w-5xl px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push("/teacher/classrooms")}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-white">{course.name}</h1>
                            {course.description && (
                                <p className="text-sm text-gray-400 line-clamp-1">{course.description}</p>
                            )}
                        </div>

                        {/* Enrollment Status Badge */}
                        <button
                            onClick={toggleEnrollment}
                            disabled={togglingEnrollment}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                course.is_published
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                                    : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
                            }`}
                        >
                            {togglingEnrollment ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : course.is_published ? (
                                <ToggleRight className="h-5 w-5" />
                            ) : (
                                <ToggleLeft className="h-5 w-5" />
                            )}
                            {course.is_published ? "Open" : "Closed"}
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {/* Enrollment Code Card */}
                    <div className={`rounded-xl p-5 border ${
                        course.is_published
                            ? "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30"
                            : "bg-gray-900 border-gray-800"
                    }`}>
                        <p className="text-sm text-gray-400 mb-1">Join Code</p>
                        <div className="flex items-center gap-3">
                            <span className={`font-mono text-2xl font-bold ${
                                course.is_published ? "text-emerald-400" : "text-gray-500"
                            }`}>
                                {course.enrollment_code}
                            </span>
                            <button
                                onClick={copyCode}
                                disabled={!course.is_published}
                                className={`p-2 rounded-lg transition-colors ${
                                    course.is_published
                                        ? "hover:bg-emerald-500/20 text-emerald-400"
                                        : "text-gray-600 cursor-not-allowed"
                                }`}
                            >
                                {copiedCode ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                            </button>
                        </div>
                        {!course.is_published && (
                            <p className="text-xs text-gray-500 mt-2">Open enrollment to share</p>
                        )}
                    </div>

                    {/* Students Card */}
                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                        <p className="text-sm text-gray-400 mb-1">Students</p>
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-sky-400" />
                            <span className="text-2xl font-bold text-white">{course.enrollment_count}</span>
                        </div>
                    </div>

                    {/* Content Card */}
                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                        <p className="text-sm text-gray-400 mb-1">Content</p>
                        <div className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-purple-400" />
                            <span className="text-2xl font-bold text-white">{course.modules.length}</span>
                            <span className="text-gray-500">modules</span>
                            <span className="text-gray-600">·</span>
                            <span className="text-lg text-gray-400">{totalItems} items</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-gray-800">
                    <button
                        onClick={() => setActiveTab("content")}
                        className={`px-5 py-3 font-medium transition-colors relative ${
                            activeTab === "content"
                                ? "text-white"
                                : "text-gray-500 hover:text-gray-300"
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Content
                        </span>
                        {activeTab === "content" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("students")}
                        className={`px-5 py-3 font-medium transition-colors relative ${
                            activeTab === "students"
                                ? "text-white"
                                : "text-gray-500 hover:text-gray-300"
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Students
                            {students.length > 0 && (
                                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                                    {students.length}
                                </span>
                            )}
                        </span>
                        {activeTab === "students" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("analytics")}
                        className={`px-5 py-3 font-medium transition-colors relative ${
                            activeTab === "analytics"
                                ? "text-white"
                                : "text-gray-500 hover:text-gray-300"
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Analytics
                        </span>
                        {activeTab === "analytics" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />
                        )}
                    </button>
                </div>

                {/* Content Tab */}
                {activeTab === "content" && (
                    <div className="space-y-4">
                        {/* Add Module Button */}
                        <button
                            onClick={() => setShowAddModuleModal(true)}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-700 text-gray-400 hover:border-sky-500/50 hover:text-sky-400 hover:bg-sky-500/5 transition-all"
                        >
                            <PlusCircle className="h-5 w-5" />
                            Add Module
                        </button>

                        {/* Modules List */}
                        {course.modules.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-12 text-center">
                                <BookOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                                <p className="text-gray-400 font-medium">No modules yet</p>
                                <p className="text-sm text-gray-500 mt-1">Create a module to organize your quizzes and lessons</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {course.modules.map((module, index) => {
                                    const isExpanded = expandedModules.has(module.id);

                                    return (
                                        <div
                                            key={module.id}
                                            className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden"
                                        >
                                            {/* Module Header */}
                                            <div className="flex items-center gap-3 px-5 py-4 bg-gray-900/80">
                                                <button
                                                    onClick={() => toggleModule(module.id)}
                                                    className="flex items-center gap-3 flex-1 hover:bg-gray-800/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-semibold text-sm">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <h3 className="font-medium text-white">{module.title}</h3>
                                                        <p className="text-xs text-gray-500">
                                                            {module.items.length} {module.items.length === 1 ? "item" : "items"}
                                                        </p>
                                                    </div>
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-5 w-5 text-gray-500" />
                                                    ) : (
                                                        <ChevronRight className="h-5 w-5 text-gray-500" />
                                                    )}
                                                </button>

                                                <div className="flex items-center gap-1 border-l border-gray-800 pl-3">
                                                    <button
                                                        onClick={() => setShowAddItemModal(module.id)}
                                                        className="p-2 rounded-lg text-gray-500 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                                                        title="Add item"
                                                    >
                                                        <PlusCircle className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteModule(module.id)}
                                                        disabled={deletingModule === module.id}
                                                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                        title="Delete module"
                                                    >
                                                        {deletingModule === module.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Module Items */}
                                            {isExpanded && (
                                                <div className="border-t border-gray-800">
                                                    {module.items.length === 0 ? (
                                                        <div className="px-5 py-6 text-center">
                                                            <p className="text-sm text-gray-500">No items in this module</p>
                                                            <button
                                                                onClick={() => setShowAddItemModal(module.id)}
                                                                className="mt-2 text-sm text-sky-400 hover:text-sky-300"
                                                            >
                                                                Add your first item
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-gray-800/50">
                                                            {module.items.map((item) => (
                                                                <div
                                                                    key={item.id}
                                                                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/30 transition-colors group"
                                                                >
                                                                    <GripVertical className="h-4 w-4 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                                                                    <div className={`p-2 rounded-lg border ${getItemColor(item.item_type)}`}>
                                                                        {getItemIcon(item.item_type)}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="font-medium text-white">{item.title}</p>
                                                                        <p className="text-xs text-gray-500 capitalize">
                                                                            {item.item_type}
                                                                            {item.points > 0 && ` · ${item.points} pts`}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => deleteItem(module.id, item.id)}
                                                                        disabled={deletingItem === item.id}
                                                                        className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                                    >
                                                                        {deletingItem === item.id ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="h-4 w-4" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Students Tab */}
                {activeTab === "students" && (
                    <div>
                        {students.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-12 text-center">
                                <Users className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                                <p className="text-gray-400 font-medium">No students enrolled yet</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Share your join code <span className="font-mono text-sky-400">{course.enrollment_code}</span> with students
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                                <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-800/50 text-sm font-medium text-gray-400 border-b border-gray-800">
                                    <div className="col-span-5">Name</div>
                                    <div className="col-span-3">Enrolled</div>
                                    <div className="col-span-2">Role</div>
                                    <div className="col-span-2 text-right">Actions</div>
                                </div>
                                <div className="divide-y divide-gray-800/50">
                                    {students.map((student) => (
                                        <div key={student.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-800/30 transition-colors group">
                                            <div className="col-span-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                                        {student.student_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-white">{student.student_name}</span>
                                                </div>
                                            </div>
                                            <div className="col-span-3 text-sm text-gray-400">
                                                {student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : "—"}
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400 capitalize">
                                                    {student.role}
                                                </span>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <button
                                                    onClick={() => removeStudent(student.id)}
                                                    disabled={removingStudent === student.id}
                                                    className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Remove student"
                                                >
                                                    {removingStudent === student.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <UserMinus className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Analytics Tab */}
                {activeTab === "analytics" && (
                    <div>
                        {analyticsLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                            </div>
                        ) : !analytics || analytics.sessions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-12 text-center">
                                <BarChart3 className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                                <p className="text-gray-400 font-medium">No quiz data yet</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Host quizzes with this class to see student performance analytics
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Class Stats Overview */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                                        <p className="text-sm text-gray-400 mb-1">Total Students</p>
                                        <p className="text-2xl font-bold text-white">{analytics.class_stats.total_students}</p>
                                    </div>
                                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                                        <p className="text-sm text-gray-400 mb-1">Class Average</p>
                                        <p className="text-2xl font-bold text-emerald-400">{analytics.class_stats.avg_accuracy}%</p>
                                    </div>
                                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                                        <p className="text-sm text-gray-400 mb-1">Quiz Sessions</p>
                                        <p className="text-2xl font-bold text-white">{analytics.sessions.length}</p>
                                    </div>
                                    <div className={`rounded-xl border p-5 ${
                                        analytics.class_stats.students_struggling > 0
                                            ? "bg-red-500/5 border-red-500/30"
                                            : "bg-gray-900 border-gray-800"
                                    }`}>
                                        <p className="text-sm text-gray-400 mb-1">Need Support</p>
                                        <p className={`text-2xl font-bold ${
                                            analytics.class_stats.students_struggling > 0 ? "text-red-400" : "text-white"
                                        }`}>{analytics.class_stats.students_struggling}</p>
                                    </div>
                                </div>

                                {/* Overall Trend */}
                                {analytics.overall_trend !== "insufficient_data" && (
                                    <div className={`rounded-xl border p-4 flex items-center gap-3 ${
                                        analytics.overall_trend === "improving"
                                            ? "bg-emerald-500/5 border-emerald-500/30"
                                            : analytics.overall_trend === "declining"
                                            ? "bg-red-500/5 border-red-500/30"
                                            : "bg-gray-900 border-gray-800"
                                    }`}>
                                        {analytics.overall_trend === "improving" ? (
                                            <TrendingUp className="h-5 w-5 text-emerald-400" />
                                        ) : analytics.overall_trend === "declining" ? (
                                            <TrendingDown className="h-5 w-5 text-red-400" />
                                        ) : (
                                            <Target className="h-5 w-5 text-gray-400" />
                                        )}
                                        <span className={`font-medium ${
                                            analytics.overall_trend === "improving" ? "text-emerald-400" :
                                            analytics.overall_trend === "declining" ? "text-red-400" : "text-gray-400"
                                        }`}>
                                            Class performance is {analytics.overall_trend}
                                        </span>
                                    </div>
                                )}

                                {/* Students Needing Support */}
                                {analytics.students_needing_support.length > 0 && (
                                    <div className="rounded-xl bg-red-500/5 border border-red-500/30 p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertTriangle className="h-5 w-5 text-red-400" />
                                            <h3 className="font-semibold text-red-400">Students Needing Support</h3>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {analytics.students_needing_support.map((name, i) => (
                                                <span key={i} className="px-3 py-1 rounded-full bg-red-500/10 text-red-300 text-sm">
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Student Performance Table */}
                                <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-800">
                                        <h3 className="font-semibold text-white">Student Performance</h3>
                                    </div>
                                    <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-800/50 text-sm font-medium text-gray-400 border-b border-gray-800">
                                        <div className="col-span-3">Student</div>
                                        <div className="col-span-2 text-center">Accuracy</div>
                                        <div className="col-span-2 text-center">Confidence</div>
                                        <div className="col-span-2 text-center">Sessions</div>
                                        <div className="col-span-2 text-center">Trend</div>
                                        <div className="col-span-1 text-center">Status</div>
                                    </div>
                                    <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
                                        {analytics.student_performance.map((student, i) => (
                                            <div key={i} className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-gray-800/30 transition-colors">
                                                <div className="col-span-3 font-medium text-white">{student.nickname}</div>
                                                <div className="col-span-2 text-center">
                                                    <span className={`font-semibold ${
                                                        student.accuracy >= 70 ? "text-emerald-400" :
                                                        student.accuracy >= 50 ? "text-amber-400" : "text-red-400"
                                                    }`}>{student.accuracy}%</span>
                                                </div>
                                                <div className="col-span-2 text-center text-gray-400">{student.avg_confidence}%</div>
                                                <div className="col-span-2 text-center text-gray-400">{student.sessions_participated}</div>
                                                <div className="col-span-2 text-center">
                                                    {student.trend === "improving" ? (
                                                        <span className="text-emerald-400 flex items-center justify-center gap-1">
                                                            <TrendingUp className="h-4 w-4" /> Up
                                                        </span>
                                                    ) : student.trend === "declining" ? (
                                                        <span className="text-red-400 flex items-center justify-center gap-1">
                                                            <TrendingDown className="h-4 w-4" /> Down
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500">—</span>
                                                    )}
                                                </div>
                                                <div className="col-span-1 text-center">
                                                    {student.needs_support ? (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                                            <AlertTriangle className="h-3 w-3 text-red-400" />
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
                                                            <Check className="h-3 w-3 text-emerald-400" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Quiz Sessions */}
                                <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-800">
                                        <h3 className="font-semibold text-white">Recent Quiz Sessions</h3>
                                    </div>
                                    <div className="divide-y divide-gray-800/50">
                                        {analytics.sessions.slice(0, 5).map((session, i) => (
                                            <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                                                <div>
                                                    <p className="font-medium text-white">{session.quiz_title}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {session.played_at ? new Date(session.played_at).toLocaleDateString() : "—"}
                                                        {" · "}{session.player_count} students
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`text-lg font-bold ${
                                                        session.class_accuracy >= 70 ? "text-emerald-400" :
                                                        session.class_accuracy >= 50 ? "text-amber-400" : "text-red-400"
                                                    }`}>{session.class_accuracy}%</span>
                                                    <Link
                                                        href={`/teacher/game/${session.session_id}/results`}
                                                        className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 hover:text-white transition-colors"
                                                    >
                                                        View Details
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Add Module Modal */}
            {showAddModuleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Add Module</h2>
                            <button
                                onClick={() => setShowAddModuleModal(false)}
                                className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Module Title
                            </label>
                            <input
                                type="text"
                                value={newModuleTitle}
                                onChange={(e) => setNewModuleTitle(e.target.value)}
                                placeholder="e.g., Week 1: Introduction"
                                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setShowAddModuleModal(false)}
                                className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createModule}
                                disabled={!newModuleTitle.trim() || creatingModule}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 transition-colors disabled:opacity-50"
                            >
                                {creatingModule ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    "Add Module"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Item Modal */}
            {showAddItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Add Item</h2>
                            <button
                                onClick={() => setShowAddItemModal(null)}
                                className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Item Type Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(["lesson", "quiz", "video"] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setNewItemType(type)}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                                                newItemType === type
                                                    ? type === "quiz"
                                                        ? "border-purple-500 bg-purple-500/20 text-purple-400"
                                                        : type === "video"
                                                        ? "border-rose-500 bg-rose-500/20 text-rose-400"
                                                        : "border-sky-500 bg-sky-500/20 text-sky-400"
                                                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                                            }`}
                                        >
                                            {type === "quiz" && <Play className="h-5 w-5" />}
                                            {type === "lesson" && <FileText className="h-5 w-5" />}
                                            {type === "video" && <Video className="h-5 w-5" />}
                                            <span className="text-sm font-medium capitalize">{type}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={newItemTitle}
                                    onChange={(e) => setNewItemTitle(e.target.value)}
                                    placeholder={`e.g., ${newItemType === "quiz" ? "Chapter 1 Quiz" : newItemType === "video" ? "Introduction Video" : "Lesson 1: Getting Started"}`}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none"
                                />
                            </div>

                            {/* Quiz Selector (only for quiz type) */}
                            {newItemType === "quiz" && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Select Quiz
                                    </label>
                                    {quizzes.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/50 p-4 text-center">
                                            <p className="text-sm text-gray-500">No quizzes available</p>
                                            <Link
                                                href="/teacher/quizzes/new"
                                                className="text-sm text-sky-400 hover:text-sky-300 mt-1 inline-block"
                                            >
                                                Create a quiz first
                                            </Link>
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedQuizId}
                                            onChange={(e) => setSelectedQuizId(e.target.value)}
                                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:border-sky-500 focus:outline-none"
                                        >
                                            <option value="">Select a quiz...</option>
                                            {quizzes.map((quiz) => (
                                                <option key={quiz.id} value={quiz.id}>
                                                    {quiz.title} ({quiz.question_count} questions)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setShowAddItemModal(null)}
                                className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => showAddItemModal && createItem(showAddItemModal)}
                                disabled={!newItemTitle.trim() || (newItemType === "quiz" && !selectedQuizId) || creatingItem}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 transition-colors disabled:opacity-50"
                            >
                                {creatingItem ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    "Add Item"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

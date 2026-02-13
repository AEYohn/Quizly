"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    BookOpen,
    Play,
    FileText,
    Video,
    CheckCircle,
    Circle,
    Loader2,
    Users,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

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
    is_published: boolean;
    modules: Module[];
    created_at: string;
}

export default function StudentClassPage() {
    const router = useRouter();
    const params = useParams();
    const courseId = params.id as string;
    const { token } = useAuth();

    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
    const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchCourse();
    }, [courseId, token]);

    const fetchCourse = async () => {
        try {
            // Get student name for enrollment check
            const studentName = localStorage.getItem("quizly_display_name") || localStorage.getItem("quizly_student_name") || "";
            const url = studentName
                ? `${API_URL}/courses/${courseId}?student_name=${encodeURIComponent(studentName)}`
                : `${API_URL}/courses/${courseId}`;

            const response = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (response.ok) {
                const data = await response.json();
                setCourse(data);
                // Expand first module by default
                if (data.modules?.length > 0) {
                    setExpandedModules(new Set([data.modules[0].id]));
                }
            } else {
                setError("Class not found");
            }
        } catch (err) {
            setError("Failed to load class");
        } finally {
            setLoading(false);
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
            case "quiz":
                return <Play className="h-4 w-4" />;
            case "video":
                return <Video className="h-4 w-4" />;
            case "lesson":
            case "page":
                return <FileText className="h-4 w-4" />;
            default:
                return <BookOpen className="h-4 w-4" />;
        }
    };

    const handleItemClick = (item: ModuleItem) => {
        if (item.item_type === "quiz" && item.session_id) {
            router.push(`/student/study/${item.session_id}/practice`);
        }
        // Mark as completed for demo
        setCompletedItems(prev => new Set([...prev, item.id]));
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
                <p className="text-gray-400">{error || "Class not found"}</p>
                <button
                    onClick={() => router.back()}
                    className="text-sky-400 hover:text-sky-300"
                >
                    Go back
                </button>
            </div>
        );
    }

    const totalItems = course.modules.reduce((sum, m) => sum + m.items.length, 0);
    const completedCount = completedItems.size;
    const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                <div className="mx-auto max-w-4xl px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push("/student/dashboard")}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-white">{course.name}</h1>
                            <p className="text-sm text-gray-400">by {course.teacher_name}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-6 py-8">
                {/* Progress Overview */}
                <div className="mb-8 rounded-xl bg-gray-900 border border-gray-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-white">Your Progress</h2>
                        <span className="text-sky-400 font-medium">{progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-sky-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                        {completedCount} of {totalItems} items completed
                    </p>
                </div>

                {/* Description */}
                {course.description && (
                    <div className="mb-8">
                        <p className="text-gray-400">{course.description}</p>
                    </div>
                )}

                {/* Modules */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-sky-400" />
                        Course Content
                    </h2>

                    {course.modules.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-8 text-center">
                            <BookOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                            <p className="text-gray-400">No content yet</p>
                            <p className="text-sm text-gray-500">Your teacher hasn't added any modules to this class yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {course.modules.map((module, index) => {
                                const isExpanded = expandedModules.has(module.id);
                                const moduleCompleted = module.items.every(item => completedItems.has(item.id));
                                const moduleProgress = module.items.length > 0
                                    ? module.items.filter(item => completedItems.has(item.id)).length / module.items.length
                                    : 0;

                                return (
                                    <div
                                        key={module.id}
                                        className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden"
                                    >
                                        {/* Module Header */}
                                        <button
                                            onClick={() => toggleModule(module.id)}
                                            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-800/50 transition-colors"
                                        >
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                                moduleCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400"
                                            }`}>
                                                {moduleCompleted ? (
                                                    <CheckCircle className="h-5 w-5" />
                                                ) : (
                                                    <span className="text-sm font-medium">{index + 1}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <h3 className="font-medium text-white">{module.title}</h3>
                                                <p className="text-xs text-gray-500">
                                                    {module.items.length} items
                                                    {moduleProgress > 0 && ` - ${Math.round(moduleProgress * 100)}% complete`}
                                                </p>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronDown className="h-5 w-5 text-gray-500" />
                                            ) : (
                                                <ChevronRight className="h-5 w-5 text-gray-500" />
                                            )}
                                        </button>

                                        {/* Module Items */}
                                        {isExpanded && module.items.length > 0 && (
                                            <div className="border-t border-gray-800">
                                                {module.items.map((item) => {
                                                    const isCompleted = completedItems.has(item.id);
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => handleItemClick(item)}
                                                            className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/30 cursor-pointer transition-colors border-b border-gray-800/50 last:border-b-0"
                                                        >
                                                            <div className={`flex-shrink-0 ${
                                                                isCompleted ? "text-emerald-400" : "text-gray-500"
                                                            }`}>
                                                                {isCompleted ? (
                                                                    <CheckCircle className="h-5 w-5" />
                                                                ) : (
                                                                    <Circle className="h-5 w-5" />
                                                                )}
                                                            </div>
                                                            <div className={`p-2 rounded-lg ${
                                                                item.item_type === "quiz"
                                                                    ? "bg-teal-500/20 text-teal-400"
                                                                    : item.item_type === "video"
                                                                    ? "bg-red-500/20 text-red-400"
                                                                    : "bg-sky-500/20 text-sky-400"
                                                            }`}>
                                                                {getItemIcon(item.item_type)}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className={`font-medium ${
                                                                    isCompleted ? "text-gray-400" : "text-white"
                                                                }`}>
                                                                    {item.title}
                                                                </p>
                                                                <p className="text-xs text-gray-500 capitalize">
                                                                    {item.item_type}
                                                                    {item.duration_mins && ` - ${item.duration_mins} min`}
                                                                    {item.points > 0 && ` - ${item.points} pts`}
                                                                </p>
                                                            </div>
                                                            {item.item_type === "quiz" && (
                                                                <span className="text-xs px-2 py-1 rounded-full bg-teal-500/20 text-teal-400">
                                                                    Quiz
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    PlusCircle,
    Users,
    Loader2,
    Copy,
    Check,
    BookOpen,
    Trash2,
    X,
    Pencil,
    ToggleLeft,
    ToggleRight,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Classroom {
    id: string;
    name: string;
    description?: string;
    enrollment_code?: string;
    enrollment_count: number;
    module_count: number;
    item_count: number;
    is_published: boolean;
    created_at: string;
}

export default function ClassroomsPage() {
    const router = useRouter();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
    const [creating, setCreating] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // Form state
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");

    useEffect(() => {
        fetchClassrooms();
    }, []);

    async function fetchClassrooms() {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/courses`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setClassrooms(data.courses || []);
            }
        } catch (err) {
            console.error("Failed to fetch classrooms:", err);
        }
        setIsLoading(false);
    }

    async function createClassroom() {
        if (!newName.trim()) return;

        setCreating(true);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: newName,
                    description: newDescription || null,
                }),
            });

            if (response.ok) {
                const newClassroom = await response.json();
                // New classrooms should be open for enrollment by default
                await toggleEnrollment(newClassroom.id, false);
                fetchClassrooms(); // Refresh to get updated data
                setShowCreateModal(false);
                setNewName("");
                setNewDescription("");
            }
        } catch (err) {
            console.error("Failed to create classroom:", err);
        }
        setCreating(false);
    }

    async function updateClassroom() {
        if (!editingClassroom || !editName.trim()) return;

        setUpdating(true);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${editingClassroom.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: editName,
                    description: editDescription || null,
                }),
            });

            if (response.ok) {
                setClassrooms(classrooms.map(c =>
                    c.id === editingClassroom.id
                        ? { ...c, name: editName, description: editDescription || undefined }
                        : c
                ));
                setShowEditModal(false);
                setEditingClassroom(null);
            }
        } catch (err) {
            console.error("Failed to update classroom:", err);
        }
        setUpdating(false);
    }

    async function toggleEnrollment(id: string, currentState: boolean) {
        setTogglingId(id);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    is_published: !currentState,
                }),
            });

            if (response.ok) {
                setClassrooms(classrooms.map(c =>
                    c.id === id ? { ...c, is_published: !currentState } : c
                ));
            }
        } catch (err) {
            console.error("Failed to toggle enrollment:", err);
        }
        setTogglingId(null);
    }

    async function deleteClassroom(id: string) {
        if (!confirm("Are you sure you want to delete this classroom?")) return;

        setDeletingId(id);
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${API_URL}/courses/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                setClassrooms(classrooms.filter((c) => c.id !== id));
            }
        } catch (err) {
            console.error("Failed to delete classroom:", err);
        }
        setDeletingId(null);
    }

    const openEditModal = (classroom: Classroom) => {
        setEditingClassroom(classroom);
        setEditName(classroom.name);
        setEditDescription(classroom.description || "");
        setShowEditModal(true);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
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
                            <h1 className="text-2xl font-bold text-white">Classrooms</h1>
                            <p className="text-gray-400">
                                Organize your quizzes and track student progress
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500 transition-colors"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Create Classroom
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-6 py-8">
                {classrooms.length === 0 ? (
                    <div className="rounded-2xl bg-gray-900 p-12 text-center border border-gray-800">
                        <Users className="mx-auto h-12 w-12 text-gray-600" />
                        <h3 className="mt-4 text-lg font-semibold text-white">
                            No classrooms yet
                        </h3>
                        <p className="mt-2 text-gray-400 max-w-sm mx-auto">
                            Create a classroom to organize your quizzes and invite students
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Create Classroom
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {classrooms.map((classroom) => (
                            <div
                                key={classroom.id}
                                onClick={() => router.push(`/teacher/classrooms/${classroom.id}`)}
                                className={`rounded-xl bg-gray-900 border p-6 transition-colors cursor-pointer ${
                                    classroom.is_published
                                        ? "border-emerald-500/30 hover:border-emerald-500/50"
                                        : "border-gray-800 hover:border-gray-700"
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-semibold text-white truncate">
                                                {classroom.name}
                                            </h3>
                                            {classroom.is_published && (
                                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                                                    Open
                                                </span>
                                            )}
                                        </div>
                                        {classroom.description && (
                                            <p className="mt-1 text-sm text-gray-400 line-clamp-2">
                                                {classroom.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openEditModal(classroom); }}
                                            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800"
                                            title="Edit classroom"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteClassroom(classroom.id); }}
                                            disabled={deletingId === classroom.id}
                                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                            title="Delete classroom"
                                        >
                                            {deletingId === classroom.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                        <Users className="h-4 w-4" />
                                        <span>{classroom.enrollment_count} students</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <BookOpen className="h-4 w-4" />
                                        <span>{classroom.item_count} quizzes</span>
                                    </div>
                                </div>

                                {/* Enrollment Toggle */}
                                <div className="mt-4 pt-4 border-t border-gray-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-gray-400">
                                            Enrollment
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleEnrollment(classroom.id, classroom.is_published); }}
                                            disabled={togglingId === classroom.id}
                                            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                                                classroom.is_published
                                                    ? "text-emerald-400 hover:text-emerald-300"
                                                    : "text-gray-500 hover:text-white"
                                            }`}
                                        >
                                            {togglingId === classroom.id ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : classroom.is_published ? (
                                                <>
                                                    <ToggleRight className="h-6 w-6" />
                                                    Open
                                                </>
                                            ) : (
                                                <>
                                                    <ToggleLeft className="h-6 w-6" />
                                                    Closed
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Enrollment Code - only show if published */}
                                    {classroom.enrollment_code && (
                                        <div className={`flex items-center justify-between rounded-lg p-3 ${
                                            classroom.is_published
                                                ? "bg-emerald-500/10"
                                                : "bg-gray-800/50"
                                        }`}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500">
                                                    Join Code:
                                                </span>
                                                <span className={`font-mono text-lg font-bold ${
                                                    classroom.is_published
                                                        ? "text-emerald-400"
                                                        : "text-gray-500"
                                                }`}>
                                                    {classroom.enrollment_code}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); copyCode(classroom.enrollment_code!); }}
                                                disabled={!classroom.is_published}
                                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                                    classroom.is_published
                                                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                                        : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                                                }`}
                                            >
                                                {copiedCode === classroom.enrollment_code ? (
                                                    <>
                                                        <Check className="h-3.5 w-3.5" />
                                                        Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3.5 w-3.5" />
                                                        Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {!classroom.is_published && (
                                        <p className="mt-2 text-xs text-gray-500">
                                            Students cannot join until enrollment is open
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">
                                Create Classroom
                            </h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-500 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Classroom Name
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g., AP Biology - Period 3"
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder="Add a brief description..."
                                    rows={3}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createClassroom}
                                disabled={!newName.trim() || creating}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 transition-colors disabled:opacity-50"
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    "Create Classroom"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingClassroom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">
                                Edit Classroom
                            </h2>
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingClassroom(null);
                                }}
                                className="text-gray-500 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Classroom Name
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="e.g., AP Biology - Period 3"
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Add a brief description..."
                                    rows={3}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingClassroom(null);
                                }}
                                className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={updateClassroom}
                                disabled={!editName.trim() || updating}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 transition-colors disabled:opacity-50"
                            >
                                {updating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CreateNotesPage() {
    const router = useRouter();
    const { token } = useAuth();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Please enter a title");
            return;
        }

        try {
            setSaving(true);
            setError("");

            const response = await fetch(`${API_URL}/library/notes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: title.trim(),
                    content_markdown: content
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to save");
            }

            router.push("/student/library");
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/student/create"
                            className="p-2 hover:bg-gray-800 rounded-lg"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-2xl font-bold">Create Study Notes</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                    >
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        Save Notes
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Editor */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg">
                    <input
                        type="text"
                        placeholder="Note Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full text-xl font-semibold bg-transparent border-b border-gray-800 p-4 focus:outline-none"
                    />
                    <textarea
                        placeholder="Start writing your notes... (Markdown supported)"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full min-h-[500px] bg-transparent p-4 focus:outline-none resize-none font-mono text-sm"
                    />
                </div>

                <p className="text-xs text-gray-500 mt-2">
                    Tip: Use Markdown for formatting. **bold**, *italic*, # headings, - lists
                </p>
            </div>
        </div>
    );
}

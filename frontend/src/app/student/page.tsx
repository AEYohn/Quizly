"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { api } from "~/lib/api";

export default function StudentJoinPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // If student already has a name, redirect to join page
        const savedName = localStorage.getItem("quizly_student_name");
        if (savedName) {
            router.push("/join");
        }
    }, [router]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsLoading(true);
        setError(null);

        // Save student name and go to join page
        localStorage.setItem("quizly_student_name", name);
        sessionStorage.setItem("quizly_student_name", name);
        router.push("/join");
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6">
            <div className="w-full max-w-md animate-fade-in rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-100">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-3xl shadow-lg shadow-indigo-600/20">
                        🎒
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome to Quizly!</h1>
                    <p className="mt-2 text-gray-500">
                        Enter your name to join the live quiz
                    </p>
                </div>

                <form onSubmit={handleJoin} className="space-y-6">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            What&apos;s your name?
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Alex Smith"
                            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg outline-none transition-all placeholder:text-gray-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!name.trim() || isLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/40 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <>
                                Get Started
                                <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="flex items-center justify-center gap-2 text-sm text-gray-400">
                        <Sparkles className="h-4 w-4" />
                        Powered by Quizly AI
                    </p>
                </div>
            </div>
        </div>
    );
}

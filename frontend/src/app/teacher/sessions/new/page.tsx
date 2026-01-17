"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Plus, X } from "lucide-react";
import Link from "next/link";

export default function NewSessionPage() {
    const router = useRouter();
    const [topic, setTopic] = useState("");
    const [concepts, setConcepts] = useState<string[]>([]);
    const [conceptInput, setConceptInput] = useState("");
    const [duration, setDuration] = useState(30);
    const [difficulty, setDifficulty] = useState<
        "gradual" | "flat" | "challenging"
    >("gradual");
    const [isGenerating, setIsGenerating] = useState(false);

    const addConcept = () => {
        if (conceptInput.trim() && !concepts.includes(conceptInput.trim())) {
            setConcepts([...concepts, conceptInput.trim()]);
            setConceptInput("");
        }
    };

    const removeConcept = (concept: string) => {
        setConcepts(concepts.filter((c) => c !== concept));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);

        // Simulate AI generation delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Would call API here
        console.log({ topic, concepts, duration, difficulty });

        setIsGenerating(false);
        router.push("/teacher/sessions");
    };

    return (
        <div className="max-w-3xl p-8">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/teacher/sessions"
                    className="mb-4 inline-flex items-center gap-2 text-gray-500 hover:text-gray-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sessions
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Create New Session</h1>
                <p className="mt-1 text-gray-500">
                    Define your topic and let AI generate questions
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Topic */}
                <div>
                    <label
                        htmlFor="topic"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Topic
                    </label>
                    <input
                        id="topic"
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., Newton's Laws of Motion"
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                        required
                    />
                </div>

                {/* Concepts */}
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Key Concepts
                    </label>
                    <div className="mb-3 flex gap-2">
                        <input
                            type="text"
                            value={conceptInput}
                            onChange={(e) => setConceptInput(e.target.value)}
                            onKeyPress={(e) =>
                                e.key === "Enter" && (e.preventDefault(), addConcept())
                            }
                            placeholder="Add a concept..."
                            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                        />
                        <button
                            type="button"
                            onClick={addConcept}
                            className="rounded-lg border border-gray-200 bg-white px-3 transition-colors hover:bg-gray-50"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {concepts.map((concept) => (
                            <span
                                key={concept}
                                className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-700"
                            >
                                {concept}
                                <button
                                    type="button"
                                    onClick={() => removeConcept(concept)}
                                    className="hover:text-sky-900"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </span>
                        ))}
                        {concepts.length === 0 && (
                            <span className="text-sm text-gray-400">
                                No concepts added yet
                            </span>
                        )}
                    </div>
                </div>

                {/* Duration */}
                <div>
                    <label
                        htmlFor="duration"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Session Duration (minutes)
                    </label>
                    <input
                        id="duration"
                        type="range"
                        min={15}
                        max={60}
                        step={5}
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full accent-sky-600"
                    />
                    <div className="mt-1 flex justify-between text-sm text-gray-500">
                        <span>15 min</span>
                        <span className="font-medium text-sky-600">{duration} minutes</span>
                        <span>60 min</span>
                    </div>
                </div>

                {/* Difficulty Curve */}
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Difficulty Curve
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {(["gradual", "flat", "challenging"] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setDifficulty(option)}
                                className={`rounded-lg border-2 p-4 text-center transition-all ${difficulty === option
                                        ? "border-sky-500 bg-sky-50"
                                        : "border-gray-200 hover:border-gray-300"
                                    }`}
                            >
                                <div className="mb-1 text-2xl">
                                    {option === "gradual" && "📈"}
                                    {option === "flat" && "➡️"}
                                    {option === "challenging" && "🚀"}
                                </div>
                                <div className="font-medium capitalize text-gray-900">
                                    {option}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                    {option === "gradual" && "Easy to hard"}
                                    {option === "flat" && "Consistent level"}
                                    {option === "challenging" && "Start hard"}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Submit */}
                <div className="flex gap-4 pt-4">
                    <button
                        type="submit"
                        disabled={!topic || concepts.length === 0 || isGenerating}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 py-3 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                Generating Questions...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                Generate Session
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="rounded-lg border border-gray-200 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}

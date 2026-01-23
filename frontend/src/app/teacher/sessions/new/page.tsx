"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Sparkles,
    Plus,
    X,
    Upload,
    FileText,
    Loader2,
    CheckCircle,
    AlertCircle,
} from "lucide-react";
import { api } from "~/lib/api";
import type { Question } from "~/types";

type Step = "setup" | "generating" | "curating" | "ready";

export default function NewSessionPage() {
    const router = useRouter();

    // Form state
    const [topic, setTopic] = useState("");
    const [concepts, setConcepts] = useState<string[]>([]);
    const [conceptInput, setConceptInput] = useState("");
    const [numQuestions, setNumQuestions] = useState(4);
    const [materialsText, setMaterialsText] = useState("");

    // File upload state
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<{ name: string, status: 'success' | 'error' }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Flow state
    const [step, setStep] = useState<Step>("setup");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [error, setError] = useState<string | null>(null);

    const addConcept = () => {
        if (conceptInput.trim() && !concepts.includes(conceptInput.trim())) {
            setConcepts([...concepts, conceptInput.trim()]);
            setConceptInput("");
        }
    };

    const removeConcept = (concept: string) => {
        setConcepts(concepts.filter((c) => c !== concept));
    };

    const handleGenerate = async () => {
        if (!topic) return;

        setStep("generating");
        setError(null);

        // Try curriculum API if we have materials, otherwise direct generation
        const result = materialsText
            ? await api.curriculum.generateFromCurriculum({
                topic,
                concepts,
                num_questions: numQuestions,
                materials_context: materialsText,
            })
            : await api.ai.generateQuestions(topic, numQuestions, concepts);

        if (!result.success) {
            setError(result.error);
            setStep("setup");
            return;
        }

        // Mark all as pending review
        const questionsWithStatus = result.data.questions.map(q => ({
            ...q,
            status: "pending" as const,
        }));

        setQuestions(questionsWithStatus);
        setStep("curating");
    };

    const approveQuestion = (id: string) => {
        setQuestions(prev =>
            prev.map(q => q.id === id ? { ...q, status: "approved" as const } : q)
        );
    };

    const rejectQuestion = (id: string) => {
        setQuestions(prev =>
            prev.map(q => q.id === id ? { ...q, status: "rejected" as const } : q)
        );
    };

    const approveAll = () => {
        setQuestions(prev =>
            prev.map(q => ({ ...q, status: "approved" as const }))
        );
    };

    const resetAll = () => {
        setQuestions(prev =>
            prev.map(q => ({ ...q, status: "pending" as const }))
        );
    };

    const handleUpdateQuestion = (id: string, updated: Partial<Question>) => {
        setQuestions(prev =>
            prev.map(q => q.id === id ? { ...q, ...updated } : q)
        );
    };

    const handleAddQuestion = () => {
        const newQuestion: Question = {
            id: `manual_${Date.now()}`,
            concept: topic,
            prompt: "New Question",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correct_answer: "A",
            explanation: "Add an explanation here.",
            difficulty: 0.5,
            status: "pending",
            source: "manual"
        };
        setQuestions(prev => [...prev, newQuestion]);
    };

    const handleDeleteQuestion = (id: string) => {
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const approvedCount = questions.filter(q => q.status === "approved").length;

    const handleStartSession = async () => {
        const approvedQuestions = questions.filter(q => q.status === "approved");

        if (approvedQuestions.length === 0) {
            setError("Approve at least one question to start");
            return;
        }

        setStep("ready");

        const result = await api.liveSessions.start({
            topic,
            questions: approvedQuestions,
            objectives: [],
        });

        if (!result.success) {
            setError(result.error);
            setStep("curating");
            return;
        }

        // Navigate to live session control
        router.push(`/teacher/sessions/${result.data.session_id}/live`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
            {/* Header */}
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/teacher/sessions"
                    className="mb-6 inline-flex items-center gap-2 text-gray-500 hover:text-gray-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sessions
                </Link>

                {/* Progress Steps */}
                <div className="mb-8 flex items-center gap-4">
                    <StepIndicator
                        step={1}
                        label="Setup"
                        active={step === "setup"}
                        completed={step !== "setup"}
                    />
                    <div className="h-px flex-1 bg-gray-300" />
                    <StepIndicator
                        step={2}
                        label="Generate"
                        active={step === "generating"}
                        completed={step === "curating" || step === "ready"}
                    />
                    <div className="h-px flex-1 bg-gray-300" />
                    <StepIndicator
                        step={3}
                        label="Curate"
                        active={step === "curating"}
                        completed={step === "ready"}
                    />
                    <div className="h-px flex-1 bg-gray-300" />
                    <StepIndicator
                        step={4}
                        label="Launch"
                        active={step === "ready"}
                        completed={false}
                    />
                </div>

                {error && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        {error}
                    </div>
                )}

                {/* Step 1: Setup */}
                {step === "setup" && (
                    <div className="rounded-2xl bg-white p-8 shadow-lg">
                        <h1 className="mb-2 text-2xl font-bold text-gray-900">
                            🎯 Create New Quiz Session
                        </h1>
                        <p className="mb-8 text-gray-500">
                            Define your topic and let AI generate engaging questions
                        </p>

                        <div className="space-y-6">
                            {/* Topic */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Topic / Learning Objective
                                </label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g., Newton's Laws of Motion"
                                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg outline-none transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20"
                                />
                            </div>

                            {/* Concepts */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Key Concepts (optional)
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
                                        className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2 outline-none transition-all focus:border-sky-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={addConcept}
                                        className="rounded-xl border-2 border-gray-200 bg-white px-4 transition-colors hover:bg-gray-50"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {concepts.map((concept) => (
                                        <span
                                            key={concept}
                                            className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-700"
                                        >
                                            {concept}
                                            <button onClick={() => removeConcept(concept)}>
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Number of Questions */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Number of Questions
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={numQuestions}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 1 && val <= 20) {
                                                setNumQuestions(val);
                                            }
                                        }}
                                        className="w-24 rounded-xl border-2 border-gray-200 px-4 py-3 text-center text-lg font-bold outline-none transition-all focus:border-sky-500"
                                    />
                                    <div className="flex gap-2">
                                        {[3, 5, 8, 10].map((n) => (
                                            <button
                                                key={n}
                                                onClick={() => setNumQuestions(n)}
                                                className={`rounded-xl px-4 py-2 font-medium transition-all ${numQuestions === n
                                                    ? "bg-sky-100 text-sky-700 ring-2 ring-sky-500/20"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Materials (Optional) */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Course Materials (optional)
                                </label>

                                {/* Drop Zone */}
                                <div
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setIsDragging(true);
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault();
                                        setIsDragging(false);
                                    }}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        setIsDragging(false);

                                        const files = Array.from(e.dataTransfer.files);
                                        if (files.length === 0) return;

                                        setIsProcessing(true);
                                        const formData = new FormData();
                                        files.forEach(file => formData.append("files", file));

                                        try {
                                            const result = await api.curriculum.processMaterials(formData);

                                            if (result.success && result.data) {
                                                // Append processed summary to text area
                                                const newContext = `\n\n--- Processed Materials ---\n${result.data.summary}`;
                                                setMaterialsText(prev => prev + newContext);

                                                // Update uploaded files list
                                                setUploadedFiles(prev => [
                                                    ...prev,
                                                    ...files.map(f => ({ name: f.name, status: 'success' as const }))
                                                ]);

                                                // Auto-fill topic if empty
                                                if (!topic && result.data.topic) {
                                                    setTopic(result.data.topic);
                                                }

                                                // Add extracted concepts
                                                if (result.data.concepts && result.data.concepts.length > 0) {
                                                    const newConcepts = result.data.concepts.filter(c => !concepts.includes(c));
                                                    if (newConcepts.length > 0) {
                                                        setConcepts(prev => [...prev, ...newConcepts]);
                                                    }
                                                }
                                            } else {
                                                setError(result.error || "Failed to process files");
                                                setUploadedFiles(prev => [
                                                    ...prev,
                                                    ...files.map(f => ({ name: f.name, status: 'error' as const }))
                                                ]);
                                            }
                                        } catch (err) {
                                            setError("Error uploading files");
                                        } finally {
                                            setIsProcessing(false);
                                        }
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${isDragging
                                        ? "border-sky-500 bg-sky-50"
                                        : "border-gray-200 hover:border-sky-300 hover:bg-gray-50"
                                        }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        multiple
                                        className="hidden"
                                        onChange={async (e) => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length === 0) return;

                                            setIsProcessing(true);
                                            const formData = new FormData();
                                            files.forEach(file => formData.append("files", file));

                                            try {
                                                const result = await api.curriculum.processMaterials(formData);
                                                if (result.success && result.data) {
                                                    const newContext = `\n\n--- Processed Materials ---\n${result.data.summary}`;
                                                    setMaterialsText(prev => prev + newContext);
                                                    setUploadedFiles(prev => [
                                                        ...prev,
                                                        ...files.map(f => ({ name: f.name, status: 'success' as const }))
                                                    ]);
                                                    if (!topic && result.data.topic) setTopic(result.data.topic);
                                                    if (result.data.concepts?.length) {
                                                        const newConcepts = result.data.concepts.filter(c => !concepts.includes(c));
                                                        setConcepts(prev => [...prev, ...newConcepts]);
                                                    }
                                                }
                                            } catch (err) {
                                                setError("Error uploading files");
                                            } finally {
                                                setIsProcessing(false);
                                            }
                                        }}
                                    />

                                    {isProcessing ? (
                                        <div className="flex flex-col items-center">
                                            <Loader2 className="mb-2 h-8 w-8 animate-spin text-sky-600" />
                                            <p className="text-sm font-medium text-sky-700">Processing materials...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className={`mx-auto mb-2 h-8 w-8 ${isDragging ? "text-sky-600" : "text-gray-400"}`} />
                                            <p className="text-sm font-medium text-gray-700">
                                                {isDragging ? "Drop files here" : "Drop PDFs, images, or text files"}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                or click to browse
                                            </p>
                                        </>
                                    )}
                                </div>

                                {/* Uploaded Files List */}
                                {uploadedFiles.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {uploadedFiles.map((file, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                                                {file.status === 'success' ? (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                )}
                                                <span>{file.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <textarea
                                    value={materialsText}
                                    onChange={(e) => setMaterialsText(e.target.value)}
                                    placeholder="Or paste text context here..."
                                    className="mt-3 h-24 w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition-all focus:border-sky-500 text-sm"
                                />
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={!topic}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg shadow-sky-600/30 transition-all hover:shadow-xl hover:shadow-sky-600/40 disabled:opacity-50"
                            >
                                <Sparkles className="h-5 w-5" />
                                Generate Questions with AI
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Generating */}
                {step === "generating" && (
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-16 shadow-lg">
                        <div className="mb-6 animate-spin">
                            <Loader2 className="h-16 w-16 text-sky-600" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">
                            🤖 AI is crafting your questions...
                        </h2>
                        <p className="text-gray-500">
                            Generating {numQuestions} questions about &quot;{topic}&quot;
                        </p>
                    </div>
                )}

                {/* Step 3: Curating */}
                {step === "curating" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    ✅ Review & Curate Questions
                                </h1>
                                <p className="text-gray-500">
                                    {approvedCount} of {questions.length} approved
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={approveAll}
                                    className="flex items-center gap-2 rounded-xl bg-sky-100 px-4 py-2.5 font-medium text-sky-700 transition-all hover:bg-sky-200"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    Approve All
                                </button>
                                <button
                                    onClick={resetAll}
                                    className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 font-medium text-gray-600 transition-all hover:bg-gray-200"
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={handleStartSession}
                                    disabled={approvedCount === 0}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
                                >
                                    🚀 Start Session ({approvedCount})
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {questions.map((q, idx) => (
                                <QuestionCard
                                    key={q.id}
                                    question={q}
                                    index={idx + 1}
                                    onApprove={() => approveQuestion(q.id)}
                                    onReject={() => rejectQuestion(q.id)}
                                    onUpdate={(updated) => handleUpdateQuestion(q.id, updated)}
                                    onDelete={() => handleDeleteQuestion(q.id)}
                                />
                            ))}

                            <button
                                onClick={handleAddQuestion}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-4 text-gray-500 transition-all hover:border-sky-500 hover:text-sky-600"
                            >
                                <Plus className="h-5 w-5" />
                                <span className="font-medium">Add Manual Question</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Ready/Launching */}
                {step === "ready" && (
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-16 shadow-lg">
                        <div className="mb-6 animate-pulse">
                            <div className="h-16 w-16 rounded-full bg-green-100 p-4">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">
                            🚀 Launching Session...
                        </h2>
                        <p className="text-gray-500">
                            Preparing your quiz session
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Step indicator component
function StepIndicator({
    step,
    label,
    active,
    completed
}: {
    step: number;
    label: string;
    active: boolean;
    completed: boolean;
}) {
    return (
        <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${completed ? "bg-green-500 text-white" :
                active ? "bg-sky-600 text-white" :
                    "bg-gray-200 text-gray-500"
                }`}>
                {completed ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            <span className={`hidden text-sm font-medium sm:block ${active ? "text-sky-600" : "text-gray-500"
                }`}>
                {label}
            </span>
        </div>
    );
}

// Question card for curation
function QuestionCard({
    question,
    index,
    onApprove,
    onReject,
    onUpdate,
    onDelete,
}: {
    question: Question;
    index: number;
    onApprove: () => void;
    onReject: () => void;
    onUpdate: (updated: Partial<Question>) => void;
    onDelete: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(question);

    const statusColors = {
        pending: "border-gray-200 bg-white",
        approved: "border-green-300 bg-green-50",
        rejected: "border-red-200 bg-red-50 opacity-60",
    };

    if (isEditing) {
        return (
            <div className="rounded-2xl border-2 border-sky-200 bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                    <span className="font-bold text-sky-600">Editing Question {index}</span>
                    <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Prompt */}
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-500">Question Prompt</label>
                        <textarea
                            value={editForm.prompt}
                            onChange={e => setEditForm(prev => ({ ...prev, prompt: e.target.value }))}
                            className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
                            rows={3}
                        />
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-2 gap-3">
                        {editForm.options.map((opt, i) => (
                            <div key={i}>
                                <label className="mb-1 block text-xs font-semibold text-gray-500">Option {String.fromCharCode(65 + i)}</label>
                                <input
                                    value={opt}
                                    onChange={e => {
                                        const newOpts = [...editForm.options];
                                        newOpts[i] = e.target.value;
                                        setEditForm(prev => ({ ...prev, options: newOpts }));
                                    }}
                                    className={`w-full rounded-lg border p-2 text-sm focus:outline-none ${editForm.correct_answer === String.fromCharCode(65 + i)
                                        ? "border-green-500 bg-green-50"
                                        : "border-gray-200 focus:border-sky-500"
                                        }`}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Correct Answer */}
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-semibold text-gray-700">Correct Answer:</label>
                        <div className="flex gap-2">
                            {["A", "B", "C", "D"].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setEditForm(prev => ({ ...prev, correct_answer: opt }))}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${editForm.correct_answer === opt
                                        ? "bg-green-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Explanation */}
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-500">Explanation</label>
                        <textarea
                            value={editForm.explanation}
                            onChange={e => setEditForm(prev => ({ ...prev, explanation: e.target.value }))}
                            className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-sky-500 focus:outline-none"
                            rows={2}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onUpdate(editForm);
                                setIsEditing(false);
                            }}
                            className="rounded-lg bg-sky-600 px-6 py-2 text-sm font-bold text-white hover:bg-sky-700"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border-2 p-6 transition-all ${statusColors[question.status || "pending"]}`}>
            <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-600">
                        Q{index}
                    </span>
                    <div>
                        <span className="text-sm font-medium text-gray-500">
                            {question.concept || "General"}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${question.difficulty < 0.4 ? "bg-green-100 text-green-700" :
                                question.difficulty < 0.7 ? "bg-amber-100 text-amber-700" :
                                    "bg-red-100 text-red-700"
                                }`}>
                                {question.difficulty < 0.4 ? "Easy" :
                                    question.difficulty < 0.7 ? "Medium" : "Hard"}
                            </span>
                            {question.source === "manual" && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                    Manual
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                        ✏️ Edit
                    </button>
                    <button
                        onClick={onApprove}
                        className={`rounded-lg px-4 py-2 font-medium transition-all ${question.status === "approved"
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700"
                            }`}
                    >
                        ✅ Approve
                    </button>
                    <button
                        onClick={onReject}
                        className={`rounded-lg px-4 py-2 font-medium transition-all ${question.status === "rejected"
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700"
                            }`}
                    >
                        ❌ Reject
                    </button>
                    <button onClick={onDelete} className="text-gray-400 hover:text-red-500">
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <p className="mb-4 text-lg font-medium text-gray-900">{question.prompt}</p>

            <div className="grid grid-cols-2 gap-3">
                {question.options.map((option, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = question.correct_answer === letter;
                    return (
                        <div
                            key={i}
                            className={`rounded-xl border-2 p-3 ${isCorrect
                                ? "border-green-300 bg-green-50"
                                : "border-gray-200 bg-gray-50"
                                }`}
                        >
                            <span className={`mr-2 font-bold ${isCorrect ? "text-green-600" : "text-gray-500"}`}>
                                {letter}.
                            </span>
                            {option.replace(/^[A-D]\.\s*/, "")}
                            {isCorrect && <span className="ml-2">✓</span>}
                        </div>
                    );
                })}
            </div>

            {question.explanation && (
                <div className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
                    <span className="font-medium">💡 Explanation:</span> {question.explanation}
                </div>
            )}
        </div>
    );
}

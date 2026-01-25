"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    ArrowLeft,
    Save,
    Sparkles,
    Loader2,
    Wand2,
    Code2,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Check,
    Upload,
    X,
    FileText,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UploadedFile {
    preview: string;
    base64: string;
    mimeType: string;
    name?: string;
    type: "image" | "pdf";
}

const Editor = dynamic(
    () => import("@monaco-editor/react").then((mod) => mod.default),
    { ssr: false, loading: () => <div className="h-40 bg-gray-100 animate-pulse rounded-lg" /> }
);

interface TestCase {
    input_data: string;
    expected_output: string;
    explanation: string;
    is_hidden: boolean;
    is_example: boolean;
    points: number;
}

interface ProblemData {
    title: string;
    description: string;
    difficulty: string;
    subject: string;
    tags: string[];
    hints: string[];
    constraints: string;
    starter_code: { [key: string]: string };
    solution_code: { [key: string]: string };
    time_limit_seconds: number;
    points: number;
    test_cases: TestCase[];
}

export default function NewCodingProblemPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<"generate" | "edit">("generate");
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);

    // AI Generation inputs
    const [prompt, setPrompt] = useState("");
    const [difficulty, setDifficulty] = useState("medium");
    const [language, setLanguage] = useState("python");
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [dragOver, setDragOver] = useState(false);

    // Clipboard paste support
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (step !== "generate") return;
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) processFile(file);
                }
            }
        };

        document.addEventListener("paste", handlePaste);
        return () => document.removeEventListener("paste", handlePaste);
    }, [step]);

    const processFile = (file: File) => {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        if (!isImage && !isPdf) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setFiles((prev) => [
                ...prev,
                {
                    preview: isImage ? base64 : "",
                    base64,
                    mimeType: file.type,
                    name: file.name,
                    type: isPdf ? "pdf" : "image",
                },
            ]);
        };
        reader.readAsDataURL(file);
    };

    const handleFileUpload = (fileList: FileList | null) => {
        if (!fileList) return;
        Array.from(fileList).forEach(processFile);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFileUpload(e.dataTransfer.files);
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Problem data
    const [problem, setProblem] = useState<ProblemData>({
        title: "",
        description: "",
        difficulty: "medium",
        subject: "programming",
        tags: [],
        hints: [],
        constraints: "",
        starter_code: {},
        solution_code: {},
        time_limit_seconds: 300,
        points: 100,
        test_cases: [],
    });

    const [activeTab, setActiveTab] = useState<"problem" | "tests" | "code">("problem");

    const generateProblem = async () => {
        if (!prompt.trim() && files.length === 0) {
            alert("Please describe the coding problem or upload an image/PDF");
            return;
        }

        setGenerating(true);
        try {
            const token = localStorage.getItem("token");

            // Build the request with multimodal support
            const attachments = files.map((f) => ({
                type: f.type,
                content: f.base64,
                mime_type: f.mimeType,
            }));

            const fileTypes = files.map(f => f.type === "pdf" ? "PDF" : "image").join("/");

            const response = await fetch(`${API_URL}/coding/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    topic: prompt || `Generate a coding problem based on the uploaded ${fileTypes}`,
                    difficulty,
                    language,
                    num_test_cases: 5,
                    attachments: attachments.length > 0 ? attachments : undefined,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setProblem({
                    title: data.title || "Untitled Problem",
                    description: data.description || "",
                    difficulty: data.difficulty || difficulty,
                    subject: "programming",
                    tags: data.tags || [],
                    hints: data.hints || [],
                    constraints: data.constraints || "",
                    starter_code: data.starter_code || { [language]: "" },
                    solution_code: data.solution_code || { [language]: "" },
                    time_limit_seconds: 300,
                    points: difficulty === "easy" ? 50 : difficulty === "hard" ? 150 : 100,
                    test_cases: (data.test_cases || []).map((tc: any, i: number) => ({
                        input_data: tc.input || tc.input_data || "",
                        expected_output: tc.expected_output || tc.output || "",
                        explanation: tc.explanation || "",
                        is_hidden: i >= 2, // First 2 visible, rest hidden
                        is_example: i < 2,
                        points: 20,
                    })),
                });
                setStep("edit");
            } else {
                const error = await response.json();
                alert(error.detail || "Failed to generate problem");
            }
        } catch (error) {
            console.error("Failed to generate:", error);
            alert("Failed to generate problem. Please try again.");
        } finally {
            setGenerating(false);
        }
    };

    const saveProblem = async () => {
        if (!problem.title.trim()) {
            alert("Please enter a problem title");
            return;
        }
        if (problem.test_cases.length === 0) {
            alert("Please add at least one test case");
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_URL}/coding`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(problem),
            });

            if (response.ok) {
                router.push("/teacher/coding");
            } else {
                const error = await response.json();
                alert(error.detail || "Failed to save problem");
            }
        } catch (error) {
            console.error("Failed to save:", error);
            alert("Failed to save problem");
        } finally {
            setSaving(false);
        }
    };

    const updateTestCase = (index: number, field: keyof TestCase, value: any) => {
        const updated = [...problem.test_cases];
        const current = updated[index];
        if (current) {
            updated[index] = { ...current, [field]: value } as TestCase;
            setProblem({ ...problem, test_cases: updated });
        }
    };

    const addTestCase = () => {
        setProblem({
            ...problem,
            test_cases: [
                ...problem.test_cases,
                {
                    input_data: "",
                    expected_output: "",
                    explanation: "",
                    is_hidden: true,
                    is_example: false,
                    points: 20,
                },
            ],
        });
    };

    const removeTestCase = (index: number) => {
        setProblem({
            ...problem,
            test_cases: problem.test_cases.filter((_, i) => i !== index),
        });
    };

    // Step 1: AI Generation
    if (step === "generate") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 p-8">
                <div className="mx-auto max-w-2xl">
                    <button
                        onClick={() => router.back()}
                        className="mb-8 flex items-center gap-2 text-white/80 hover:text-white"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back
                    </button>

                    <div className="rounded-3xl bg-white p-8 shadow-2xl">
                        <div className="mb-8 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
                                <Code2 className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Create Coding Problem
                            </h1>
                            <p className="mt-2 text-gray-500">
                                Describe what you want and AI generates everything
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    What coding problem do you want?
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g., Write a function to find the longest palindrome in a string, or implement a binary search tree, or solve FizzBuzz..."
                                    className="w-full rounded-xl border-2 border-gray-200 p-4 text-lg focus:border-purple-500 focus:outline-none"
                                    rows={4}
                                    autoFocus
                                />
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Or upload files (diagrams, PDFs, whiteboard photos)
                                </label>
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                                        dragOver ? "border-purple-500 bg-purple-50" : "border-gray-300 hover:border-purple-400"
                                    }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,application/pdf"
                                        multiple
                                        onChange={(e) => handleFileUpload(e.target.files)}
                                        className="hidden"
                                    />
                                    <Upload className="mx-auto h-6 w-6 text-gray-400" />
                                    <p className="mt-1 text-sm text-gray-500">Drop, browse, or paste (Cmd/Ctrl+V)</p>
                                    <p className="text-xs text-gray-400">Images and PDFs supported</p>
                                </div>
                                {files.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {files.map((file, index) => (
                                            <div key={index} className="relative">
                                                {file.type === "image" ? (
                                                    <img src={file.preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
                                                ) : (
                                                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-lg bg-red-50 border border-red-200">
                                                        <FileText className="h-6 w-6 text-red-500" />
                                                        <span className="text-xs text-red-600 truncate w-14 text-center">{file.name?.slice(0, 6)}</span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                                    className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Difficulty
                                    </label>
                                    <select
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(e.target.value)}
                                        className="w-full rounded-xl border-2 border-gray-200 p-3 focus:border-purple-500 focus:outline-none"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Language
                                    </label>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="w-full rounded-xl border-2 border-gray-200 p-3 focus:border-purple-500 focus:outline-none"
                                    >
                                        <option value="python">Python</option>
                                        <option value="javascript">JavaScript</option>
                                        <option value="java">Java</option>
                                        <option value="cpp">C++</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={generateProblem}
                                disabled={generating || (!prompt.trim() && files.length === 0)}
                                className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 p-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        {files.length > 0
                                            ? `Analyzing ${files.some(f => f.type === "pdf") ? "documents" : "images"}...`
                                            : "Generating with Gemini..."}
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-6 w-6" />
                                        Generate Problem
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-2 text-white/60">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm">Powered by Gemini AI (Multimodal)</span>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2: Edit Generated Problem
    return (
        <div className="flex h-screen flex-col bg-gray-50">
            {/* Header */}
            <header className="flex items-center justify-between border-b bg-white px-6 py-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setStep("generate")}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <input
                        type="text"
                        placeholder="Problem Title"
                        value={problem.title}
                        onChange={(e) => setProblem({ ...problem, title: e.target.value })}
                        className="text-xl font-bold text-gray-900 focus:outline-none"
                    />
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                            problem.difficulty === "easy"
                                ? "bg-green-100 text-green-700"
                                : problem.difficulty === "hard"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                        }`}
                    >
                        {problem.difficulty}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setStep("generate")}
                        className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
                    >
                        <Sparkles className="h-4 w-4" />
                        Regenerate
                    </button>
                    <button
                        onClick={saveProblem}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                        <Save className="h-5 w-5" />
                        {saving ? "Saving..." : "Save Problem"}
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b bg-white px-6">
                <div className="flex gap-6">
                    {[
                        { id: "problem", label: "Problem" },
                        { id: "tests", label: `Test Cases (${problem.test_cases.length})` },
                        { id: "code", label: "Starter Code" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? "border-purple-600 text-purple-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-4xl">
                    {activeTab === "problem" && (
                        <div className="space-y-6">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Problem Description
                                </label>
                                <textarea
                                    value={problem.description}
                                    onChange={(e) =>
                                        setProblem({ ...problem, description: e.target.value })
                                    }
                                    className="w-full rounded-xl border border-gray-200 p-4 font-mono text-sm focus:border-purple-500 focus:outline-none"
                                    rows={12}
                                    placeholder="Problem description with examples..."
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Constraints
                                </label>
                                <textarea
                                    value={problem.constraints}
                                    onChange={(e) =>
                                        setProblem({ ...problem, constraints: e.target.value })
                                    }
                                    className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-purple-500 focus:outline-none"
                                    rows={3}
                                    placeholder="e.g., 1 <= n <= 10^5"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Hints (one per line)
                                </label>
                                <textarea
                                    value={problem.hints.join("\n")}
                                    onChange={(e) =>
                                        setProblem({
                                            ...problem,
                                            hints: e.target.value.split("\n").filter((h) => h.trim()),
                                        })
                                    }
                                    className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-purple-500 focus:outline-none"
                                    rows={3}
                                    placeholder="Add hints to help students..."
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === "tests" && (
                        <div className="space-y-4">
                            {problem.test_cases.map((tc, index) => (
                                <div
                                    key={index}
                                    className="rounded-xl border border-gray-200 bg-white p-4"
                                >
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="font-medium text-gray-900">
                                            Test Case {index + 1}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() =>
                                                    updateTestCase(index, "is_hidden", !tc.is_hidden)
                                                }
                                                className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium ${
                                                    tc.is_hidden
                                                        ? "bg-gray-100 text-gray-600"
                                                        : "bg-green-100 text-green-700"
                                                }`}
                                            >
                                                {tc.is_hidden ? (
                                                    <>
                                                        <EyeOff className="h-3 w-3" /> Hidden
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="h-3 w-3" /> Visible
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => removeTestCase(index)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="mb-1 block text-xs text-gray-500">
                                                Input
                                            </label>
                                            <textarea
                                                value={tc.input_data}
                                                onChange={(e) =>
                                                    updateTestCase(index, "input_data", e.target.value)
                                                }
                                                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-sm focus:border-purple-500 focus:outline-none"
                                                rows={3}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs text-gray-500">
                                                Expected Output
                                            </label>
                                            <textarea
                                                value={tc.expected_output}
                                                onChange={(e) =>
                                                    updateTestCase(
                                                        index,
                                                        "expected_output",
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-sm focus:border-purple-500 focus:outline-none"
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={addTestCase}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-4 text-gray-500 hover:border-purple-400 hover:text-purple-600"
                            >
                                <Plus className="h-5 w-5" />
                                Add Test Case
                            </button>
                        </div>
                    )}

                    {activeTab === "code" && (
                        <div className="space-y-6">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Starter Code (what students see)
                                </label>
                                <div className="overflow-hidden rounded-xl border border-gray-200">
                                    <Editor
                                        height="200px"
                                        language={language}
                                        value={problem.starter_code[language] || ""}
                                        onChange={(value) =>
                                            setProblem({
                                                ...problem,
                                                starter_code: {
                                                    ...problem.starter_code,
                                                    [language]: value || "",
                                                },
                                            })
                                        }
                                        theme="vs-dark"
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 14,
                                            lineNumbers: "on",
                                            scrollBeyondLastLine: false,
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Solution Code (for reference)
                                </label>
                                <div className="overflow-hidden rounded-xl border border-gray-200">
                                    <Editor
                                        height="300px"
                                        language={language}
                                        value={problem.solution_code[language] || ""}
                                        onChange={(value) =>
                                            setProblem({
                                                ...problem,
                                                solution_code: {
                                                    ...problem.solution_code,
                                                    [language]: value || "",
                                                },
                                            })
                                        }
                                        theme="vs-dark"
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 14,
                                            lineNumbers: "on",
                                            scrollBeyondLastLine: false,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    ArrowLeft,
    Save,
    Sparkles,
    Loader2,
    Code2,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Send,
    X,
    Upload,
    FileText,
    Paperclip,
    PenLine,
    ChevronDown,
    ChevronUp,
    GripVertical,
    Play,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const Editor = dynamic(
    () => import("@monaco-editor/react").then((mod) => mod.default),
    { ssr: false, loading: () => <div className="h-40 bg-gray-800 animate-pulse rounded-lg" /> }
);

interface UploadedFile {
    preview: string;
    base64: string;
    mimeType: string;
    name?: string;
    type: "image" | "pdf";
}

interface ChatMessage {
    id: string;
    role: "user" | "ai";
    content: string;
    files?: UploadedFile[];
    timestamp: Date;
}

interface TestCase {
    input_data: string;
    expected_output: string;
    explanation: string;
    is_hidden: boolean;
    is_example: boolean;
    points: number;
}

interface ProblemData {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    constraints: string;
    hints: string[];
    starter_code: { [key: string]: string };
    solution_code: { [key: string]: string };
    test_cases: TestCase[];
    language: string;
    collapsed: boolean;
}

export default function NewCodingProblemPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const problemsEndRef = useRef<HTMLDivElement>(null);

    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [mode, setMode] = useState<"ai" | "manual">("ai");

    const [problems, setProblems] = useState<ProblemData[]>([]);
    const [difficulty, setDifficulty] = useState("medium");
    const [language, setLanguage] = useState("python");

    const generateId = () => Math.random().toString(36).substr(2, 9);

    // Auto-resize textarea
    useEffect(() => {
        if (chatInputRef.current) {
            chatInputRef.current.style.height = "auto";
            chatInputRef.current.style.height = Math.min(chatInputRef.current.scrollHeight, 150) + "px";
        }
    }, [chatInput]);

    // Scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const processFile = useCallback((file: File) => {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        if (!isImage && !isPdf) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setPendingFiles((prev) => [...prev, {
                preview: isImage ? base64 : "",
                base64: base64,
                mimeType: file.type,
                name: file.name,
                type: isPdf ? "pdf" : "image",
            }]);
        };
        reader.readAsDataURL(file);
    }, []);

    // Clipboard paste support
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (mode !== "ai") return;
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) processFile(file);
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [processFile, mode]);

    const handleSubmit = async () => {
        if (!chatInput.trim() && pendingFiles.length === 0) return;

        const userMessage: ChatMessage = {
            id: generateId(),
            role: "user",
            content: chatInput.trim() || "Generate a coding problem from these files",
            files: pendingFiles.length > 0 ? [...pendingFiles] : undefined,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        const currentInput = chatInput;
        const currentFiles = [...pendingFiles];
        setChatInput("");
        setPendingFiles([]);
        setGenerating(true);

        // Add thinking message
        const thinkingId = generateId();
        setMessages(prev => [...prev, {
            id: thinkingId,
            role: "ai",
            content: currentFiles.length > 0 ? "Analyzing your content..." : "Thinking...",
            timestamp: new Date(),
        }]);

        try {
            const token = localStorage.getItem("token");
            const attachments = currentFiles.map((f, i) => ({
                type: f.type,
                name: f.name || `file_${i}.${f.type === "pdf" ? "pdf" : "jpg"}`,
                content: f.base64,
                mime_type: f.mimeType,
            }));

            const hasFiles = currentFiles.length > 0;
            const fileTypes = currentFiles.map(f => f.type === "pdf" ? "PDF" : "image").join(" and ");

            let prompt = currentInput;
            if (hasFiles && !currentInput) {
                prompt = `Analyze the uploaded ${fileTypes} and generate a ${difficulty} coding problem based on it.`;
            } else if (hasFiles) {
                prompt = `${currentInput}. Use the uploaded ${fileTypes} as reference. Difficulty: ${difficulty}`;
            }

            const response = await fetch(`${API_URL}/coding/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    topic: prompt,
                    difficulty,
                    language,
                    num_test_cases: 5,
                    validate_solution: true,
                    attachments: hasFiles ? attachments : undefined,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const newProblem = parseGeneratedProblem(data);

                if (newProblem) {
                    setProblems(prev => [...prev, newProblem]);

                    // Build validation status message
                    let validationMsg = "";
                    if (data.validated) {
                        validationMsg = " ✓ Test cases validated by running solution.";
                    } else if (data.validation_error) {
                        validationMsg = ` ⚠️ Could not validate: ${data.validation_error}`;
                    } else if (data.validation_message) {
                        validationMsg = ` ⚠️ ${data.validation_message}`;
                    }

                    // Replace thinking message with success
                    setMessages(prev => prev.map(m => m.id === thinkingId ? {
                        ...m,
                        content: `Created "${newProblem.title}"!${validationMsg} You can edit it below or ask me to generate more problems.`
                    } : m));

                    setTimeout(() => problemsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                } else {
                    setMessages(prev => prev.map(m => m.id === thinkingId ? {
                        ...m,
                        content: "I couldn't generate a problem from that. Try being more specific about what kind of coding challenge you want."
                    } : m));
                }
            } else {
                throw new Error("API request failed");
            }
        } catch (error) {
            console.error("Generation failed:", error);
            setMessages(prev => prev.map(m => m.id === thinkingId ? {
                ...m,
                content: "Something went wrong. Please try again."
            } : m));
        } finally {
            setGenerating(false);
        }
    };

    const parseGeneratedProblem = (data: any): ProblemData | null => {
        if (!data.title && !data.description) return null;

        return {
            id: generateId(),
            title: data.title || "Untitled Problem",
            description: data.description || "",
            difficulty: data.difficulty || difficulty,
            constraints: data.constraints || "",
            hints: data.hints || [],
            starter_code: data.starter_code || { [language]: `def solution():\n    # Write your code here\n    pass` },
            solution_code: data.solution_code || { [language]: "" },
            test_cases: (data.test_cases || []).map((tc: any, i: number) => ({
                input_data: tc.input || tc.input_data || "",
                expected_output: tc.expected_output || tc.output || "",
                explanation: tc.explanation || "",
                is_hidden: i >= 2,
                is_example: i < 2,
                points: 20,
            })),
            language: language,
            collapsed: false,
        };
    };

    const addManualProblem = () => {
        const newProblem: ProblemData = {
            id: generateId(),
            title: "",
            description: "",
            difficulty: difficulty,
            constraints: "",
            hints: [],
            starter_code: { [language]: `def solution():\n    # Write your code here\n    pass` },
            solution_code: { [language]: "" },
            test_cases: [
                { input_data: "", expected_output: "", explanation: "", is_hidden: false, is_example: true, points: 20 },
            ],
            language: language,
            collapsed: false,
        };
        setProblems([...problems, newProblem]);
        setTimeout(() => problemsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    const deleteProblem = (id: string) => {
        setProblems(problems.filter(p => p.id !== id));
    };

    const updateProblem = (id: string, updates: Partial<ProblemData>) => {
        setProblems(problems.map(p => p.id === id ? { ...p, ...updates } : p));
    };

    const toggleCollapse = (id: string) => {
        updateProblem(id, { collapsed: !problems.find(p => p.id === id)?.collapsed });
    };

    const updateTestCase = (problemId: string, index: number, field: keyof TestCase, value: any) => {
        const problem = problems.find(p => p.id === problemId);
        if (!problem) return;

        const updated = [...problem.test_cases];
        const current = updated[index];
        if (current) {
            updated[index] = { ...current, [field]: value };
            updateProblem(problemId, { test_cases: updated });
        }
    };

    const addTestCase = (problemId: string) => {
        const problem = problems.find(p => p.id === problemId);
        if (!problem) return;

        updateProblem(problemId, {
            test_cases: [
                ...problem.test_cases,
                { input_data: "", expected_output: "", explanation: "", is_hidden: true, is_example: false, points: 20 },
            ],
        });
    };

    const removeTestCase = (problemId: string, index: number) => {
        const problem = problems.find(p => p.id === problemId);
        if (!problem) return;

        updateProblem(problemId, {
            test_cases: problem.test_cases.filter((_, i) => i !== index),
        });
    };

    const saveProblem = async (problem: ProblemData) => {
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
                body: JSON.stringify({
                    title: problem.title,
                    description: problem.description,
                    difficulty: problem.difficulty,
                    subject: "programming",
                    tags: [],
                    hints: problem.hints,
                    constraints: problem.constraints,
                    starter_code: problem.starter_code,
                    solution_code: problem.solution_code,
                    time_limit_seconds: 300,
                    points: problem.difficulty === "easy" ? 50 : problem.difficulty === "hard" ? 150 : 100,
                    test_cases: problem.test_cases,
                }),
            });

            if (response.ok) {
                // Remove from list after saving
                setProblems(prev => prev.filter(p => p.id !== problem.id));
                if (problems.length === 1) {
                    router.push("/teacher/coding");
                }
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

    const saveAllProblems = async () => {
        for (const problem of problems) {
            await saveProblem(problem);
        }
        router.push("/teacher/coding");
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (mode !== "ai") return;
        Array.from(e.dataTransfer.files).forEach(processFile);
    };

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div
            className="min-h-screen bg-gray-50 flex flex-col"
            onDragOver={(e) => { e.preventDefault(); if (mode === "ai") setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
        >
            {/* Drop overlay */}
            {dragOver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-purple-600/90 backdrop-blur-sm">
                    <div className="text-center text-white">
                        <Upload className="mx-auto h-16 w-16 mb-4 animate-bounce" />
                        <p className="text-2xl font-bold">Drop to add files</p>
                        <p className="text-purple-200 mt-2">Images, PDFs, screenshots</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-40 border-b bg-white">
                <div className="mx-auto max-w-4xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.back()}
                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                                    <Code2 className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-gray-900">Coding Problems</h1>
                                    <p className="text-xs text-gray-500">Create LeetCode-style challenges</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Difficulty & Language */}
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                            >
                                <option value="python">Python</option>
                                <option value="javascript">JavaScript</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                            </select>
                            {/* Mode Toggle */}
                            <div className="flex rounded-lg border border-gray-200 p-1">
                                <button
                                    onClick={() => setMode("ai")}
                                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        mode === "ai" ? "bg-purple-100 text-purple-700" : "text-gray-600 hover:bg-gray-100"
                                    }`}
                                >
                                    <Sparkles className="h-4 w-4" />
                                    AI
                                </button>
                                <button
                                    onClick={() => setMode("manual")}
                                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        mode === "manual" ? "bg-gray-200 text-gray-800" : "text-gray-600 hover:bg-gray-100"
                                    }`}
                                >
                                    <PenLine className="h-4 w-4" />
                                    Manual
                                </button>
                            </div>
                            {problems.length > 0 && (
                                <button
                                    onClick={saveAllProblems}
                                    disabled={saving}
                                    className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white transition-all hover:bg-green-700 disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    {saving ? "Saving..." : `Save All (${problems.length})`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col">
                {/* AI Chat Mode */}
                {mode === "ai" && (
                    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6">
                        {/* Chat Messages */}
                        <div className="flex-1 py-6 space-y-4 overflow-y-auto">
                            {messages.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
                                        <Code2 className="h-8 w-8 text-white" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                        What coding challenge do you want?
                                    </h2>
                                    <p className="text-gray-500 mb-6">
                                        Describe the problem, paste a screenshot, or upload a PDF
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {[
                                            "Two Sum problem",
                                            "Reverse a linked list",
                                            "Binary search tree validation",
                                            "Dynamic programming: coin change",
                                            "Graph traversal: BFS/DFS",
                                        ].map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => setChatInput(suggestion)}
                                                className="rounded-full bg-white px-4 py-2 text-sm text-gray-600 border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className="max-w-[80%]">
                                        {msg.files && msg.files.length > 0 && (
                                            <div className="flex gap-2 mb-2 justify-end">
                                                {msg.files.map((file, i) => (
                                                    <div key={i} className="rounded-lg overflow-hidden border border-gray-200">
                                                        {file.type === "image" ? (
                                                            <img src={file.preview} alt="" className="h-20 w-auto object-cover" />
                                                        ) : (
                                                            <div className="flex items-center gap-2 bg-gray-100 px-3 py-2">
                                                                <FileText className="h-5 w-5 text-red-500" />
                                                                <span className="text-sm text-gray-600">{file.name}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className={`rounded-2xl px-4 py-3 ${
                                            msg.role === "user"
                                                ? "bg-purple-600 text-white"
                                                : "bg-white border border-gray-200 text-gray-800"
                                        }`}>
                                            {msg.content}
                                            {msg.role === "ai" && generating && msg === messages[messages.length - 1] && (
                                                <Loader2 className="inline ml-2 h-4 w-4 animate-spin" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className="sticky bottom-0 pb-6 pt-2 bg-gradient-to-t from-gray-50 via-gray-50">
                            {/* Pending files preview */}
                            {pendingFiles.length > 0 && (
                                <div className="flex gap-2 mb-3 px-1">
                                    {pendingFiles.map((file, i) => (
                                        <div key={i} className="relative">
                                            {file.type === "image" ? (
                                                <img src={file.preview} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                                            ) : (
                                                <div className="h-16 w-16 rounded-lg bg-red-50 border border-red-200 flex flex-col items-center justify-center">
                                                    <FileText className="h-6 w-6 text-red-500" />
                                                    <span className="text-[10px] text-red-600 mt-1">PDF</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removePendingFile(i)}
                                                className="absolute -top-1.5 -right-1.5 rounded-full bg-gray-800 p-0.5 text-white hover:bg-gray-900"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-3 items-end bg-white rounded-2xl border border-gray-200 shadow-lg p-3">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                    title="Attach files"
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    multiple
                                    onChange={(e) => e.target.files && Array.from(e.target.files).forEach(processFile)}
                                    className="hidden"
                                />
                                <textarea
                                    ref={chatInputRef}
                                    placeholder="Describe the coding problem you want... (or paste an image)"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                    className="flex-1 resize-none bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none"
                                    rows={1}
                                />
                                <button
                                    onClick={handleSubmit}
                                    disabled={generating || (!chatInput.trim() && pendingFiles.length === 0)}
                                    className="rounded-xl bg-purple-600 p-2.5 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </div>
                            <p className="text-center text-xs text-gray-400 mt-2">
                                Tip: Paste screenshots with Cmd+V or drag files anywhere
                            </p>
                        </div>
                    </div>
                )}

                {/* Manual Mode */}
                {mode === "manual" && problems.length === 0 && (
                    <div className="flex-1 flex items-center justify-center px-6">
                        <div className="text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-200">
                                <PenLine className="h-8 w-8 text-gray-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                Create problems manually
                            </h2>
                            <p className="text-gray-500 mb-6">
                                Build your coding challenge from scratch
                            </p>
                            <button
                                onClick={addManualProblem}
                                className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 transition-colors mx-auto"
                            >
                                <Plus className="h-5 w-5" />
                                Add Coding Problem
                            </button>
                        </div>
                    </div>
                )}

                {/* Problems List */}
                {problems.length > 0 && (
                    <div className="border-t bg-white">
                        <div className="max-w-4xl mx-auto px-6 py-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Problems ({problems.length})
                                </h3>
                                <button
                                    onClick={addManualProblem}
                                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Problem
                                </button>
                            </div>

                            <div className="space-y-4">
                                {problems.map((problem) => (
                                    <div
                                        key={problem.id}
                                        className="rounded-xl bg-gray-50 border border-gray-200 overflow-hidden"
                                    >
                                        {/* Problem Header */}
                                        <div
                                            className="flex items-center gap-3 p-4 cursor-pointer bg-white"
                                            onClick={() => toggleCollapse(problem.id)}
                                        >
                                            <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                                                problem.difficulty === "easy"
                                                    ? "bg-green-100 text-green-700"
                                                    : problem.difficulty === "hard"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-yellow-100 text-yellow-700"
                                            }`}>
                                                {problem.difficulty}
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="Problem title..."
                                                value={problem.title}
                                                onChange={(e) => { e.stopPropagation(); updateProblem(problem.id, { title: e.target.value }); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex-1 font-medium text-gray-900 bg-transparent focus:outline-none"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); saveProblem(problem); }}
                                                disabled={saving}
                                                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                            >
                                                <Save className="h-3.5 w-3.5" />
                                                Save
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteProblem(problem.id); }}
                                                className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            {problem.collapsed ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronUp className="h-4 w-4 text-gray-400" />}
                                        </div>

                                        {/* Problem Content */}
                                        {!problem.collapsed && (
                                            <div className="p-4 space-y-4 border-t border-gray-200">
                                                {/* Description */}
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Problem Description</label>
                                                    <textarea
                                                        value={problem.description}
                                                        onChange={(e) => updateProblem(problem.id, { description: e.target.value })}
                                                        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 focus:border-purple-400 focus:outline-none resize-none font-mono"
                                                        rows={6}
                                                        placeholder="Describe the problem, include examples..."
                                                    />
                                                </div>

                                                {/* Constraints */}
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Constraints</label>
                                                    <textarea
                                                        value={problem.constraints}
                                                        onChange={(e) => updateProblem(problem.id, { constraints: e.target.value })}
                                                        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 focus:border-purple-400 focus:outline-none resize-none"
                                                        rows={2}
                                                        placeholder="e.g., 1 <= n <= 10^5"
                                                    />
                                                </div>

                                                {/* Starter Code */}
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Starter Code (what students see)</label>
                                                    <div className="rounded-lg overflow-hidden border border-gray-200">
                                                        <Editor
                                                            height="150px"
                                                            language={problem.language}
                                                            value={problem.starter_code[problem.language] || ""}
                                                            onChange={(value) =>
                                                                updateProblem(problem.id, {
                                                                    starter_code: { ...problem.starter_code, [problem.language]: value || "" },
                                                                })
                                                            }
                                                            theme="vs-dark"
                                                            options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: "on", scrollBeyondLastLine: false }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Solution Code */}
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Solution Code (for reference)</label>
                                                    <div className="rounded-lg overflow-hidden border border-gray-200">
                                                        <Editor
                                                            height="200px"
                                                            language={problem.language}
                                                            value={problem.solution_code[problem.language] || ""}
                                                            onChange={(value) =>
                                                                updateProblem(problem.id, {
                                                                    solution_code: { ...problem.solution_code, [problem.language]: value || "" },
                                                                })
                                                            }
                                                            theme="vs-dark"
                                                            options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: "on", scrollBeyondLastLine: false }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Test Cases */}
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 mb-2 block">
                                                        Test Cases ({problem.test_cases.length})
                                                    </label>
                                                    <div className="space-y-2">
                                                        {problem.test_cases.map((tc, index) => (
                                                            <div
                                                                key={index}
                                                                className="rounded-lg border border-gray-200 bg-white p-3"
                                                            >
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-medium text-gray-600">
                                                                        Test {index + 1}
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => updateTestCase(problem.id, index, "is_hidden", !tc.is_hidden)}
                                                                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                                                                                tc.is_hidden
                                                                                    ? "bg-gray-100 text-gray-600"
                                                                                    : "bg-green-100 text-green-700"
                                                                            }`}
                                                                        >
                                                                            {tc.is_hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                                            {tc.is_hidden ? "Hidden" : "Visible"}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => removeTestCase(problem.id, index)}
                                                                            className="text-gray-400 hover:text-red-500"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="text-[10px] text-gray-400 uppercase">Input</label>
                                                                        <textarea
                                                                            value={tc.input_data}
                                                                            onChange={(e) => updateTestCase(problem.id, index, "input_data", e.target.value)}
                                                                            className="w-full rounded border border-gray-200 bg-gray-50 p-2 font-mono text-xs focus:border-purple-400 focus:outline-none resize-none"
                                                                            rows={2}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] text-gray-400 uppercase">Expected Output</label>
                                                                        <textarea
                                                                            value={tc.expected_output}
                                                                            onChange={(e) => updateTestCase(problem.id, index, "expected_output", e.target.value)}
                                                                            className="w-full rounded border border-gray-200 bg-gray-50 p-2 font-mono text-xs focus:border-purple-400 focus:outline-none resize-none"
                                                                            rows={2}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => addTestCase(problem.id)}
                                                            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
                                                        >
                                                            <Plus className="inline h-4 w-4 mr-1" />
                                                            Add Test Case
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div ref={problemsEndRef} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

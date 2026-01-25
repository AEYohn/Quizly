"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    Check,
    Sparkles,
    Loader2,
    Send,
    X,
    Upload,
    FileText,
    Code2,
    ListChecks,
    GripVertical,
    ChevronDown,
    ChevronUp,
    Paperclip,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const Editor = dynamic(
    () => import("@monaco-editor/react").then((mod) => mod.default),
    { ssr: false, loading: () => <div className="h-32 bg-gray-800 animate-pulse rounded-lg" /> }
);

interface QuestionData {
    id: string;
    question_text: string;
    question_type: "multiple_choice" | "coding";
    options: { [key: string]: string };
    correct_answer: string;
    time_limit: number;
    points: number;
    explanation?: string;
    order_index: number;
    starter_code?: string;
    solution_code?: string;
    test_cases?: { input: string; expected_output: string }[];
    language?: string;
    collapsed?: boolean;
}

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

export default function EditQuizPage() {
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
    const [dragOver, setDragOver] = useState(false);

    const [quizData, setQuizData] = useState({
        title: "",
        description: "",
        subject: "",
    });
    const [questions, setQuestions] = useState<QuestionData[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    // Load quiz data
    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch(`${API_URL}/quizzes/${quizId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.ok) {
                    const quiz = await response.json();

                    setQuizData({
                        title: quiz.title || "",
                        description: quiz.description || "",
                        subject: quiz.subject || "",
                    });

                    // Questions are included in the quiz response
                    const questionsData = quiz.questions || [];
                    setQuestions(
                        questionsData.map((q: any) => ({
                            ...q,
                            collapsed: true,
                        }))
                    );
                } else {
                    alert("Failed to load quiz");
                    router.push("/teacher/quizzes");
                }
            } catch (error) {
                console.error("Failed to load quiz:", error);
                alert("Failed to load quiz");
                router.push("/teacher/quizzes");
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId, router]);

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
    }, [processFile]);

    const handleSubmit = async () => {
        if (!chatInput.trim() && pendingFiles.length === 0) return;

        const userMessage: ChatMessage = {
            id: generateId(),
            role: "user",
            content: chatInput.trim() || "Generate questions from these files",
            files: pendingFiles.length > 0 ? [...pendingFiles] : undefined,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        const currentInput = chatInput;
        const currentFiles = [...pendingFiles];
        setChatInput("");
        setPendingFiles([]);
        setGenerating(true);

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
                prompt = `Analyze the uploaded ${fileTypes} and generate quiz questions based on the content. Generate 5 questions.`;
            } else if (hasFiles) {
                prompt = `${currentInput}. Use the uploaded ${fileTypes} as reference material.`;
            } else {
                prompt = `${currentInput}. Generate 5 educational questions on this topic.`;
            }

            const response = await fetch(`${API_URL}/ai/chat-generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: prompt,
                    question_type: "mcq",
                    attachments: hasFiles ? attachments : undefined,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const newQuestions = parseGeneratedQuestions(data);

                if (newQuestions.length > 0) {
                    setQuestions(prev => [...prev, ...newQuestions]);
                    setMessages(prev => prev.map(m => m.id === thinkingId ? {
                        ...m,
                        content: `Added ${newQuestions.length} question${newQuestions.length > 1 ? 's' : ''}! You can edit them below.`
                    } : m));
                } else {
                    setMessages(prev => prev.map(m => m.id === thinkingId ? {
                        ...m,
                        content: data.response || "I couldn't generate questions from that. Try being more specific."
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

    const parseGeneratedQuestions = (data: any): QuestionData[] => {
        const qs = data.questions || [];
        return qs.map((q: any, i: number) => {
            let optionsObj: { [key: string]: string } = { A: "", B: "", C: "", D: "" };
            if (Array.isArray(q.options)) {
                optionsObj = {
                    A: q.options[0] || "",
                    B: q.options[1] || "",
                    C: q.options[2] || "",
                    D: q.options[3] || "",
                };
            } else if (q.options) {
                optionsObj = q.options;
            }

            let correctAnswer = "A";
            if (typeof q.correct_answer === "number") {
                correctAnswer = ["A", "B", "C", "D"][q.correct_answer] || "A";
            } else if (typeof q.correct_answer === "string") {
                correctAnswer = q.correct_answer;
            }

            return {
                id: generateId(),
                question_text: q.question || q.question_text || q.text || "",
                question_type: q.question_type || "multiple_choice" as "multiple_choice" | "coding",
                options: optionsObj,
                correct_answer: correctAnswer,
                time_limit: 20,
                points: 1000,
                explanation: q.explanation || "",
                order_index: questions.length + i,
                collapsed: false,
            };
        });
    };

    const addQuestion = (type: "multiple_choice" | "coding") => {
        const newQuestion: QuestionData = {
            id: generateId(),
            question_text: "",
            question_type: type,
            options: type === "multiple_choice" ? { A: "", B: "", C: "", D: "" } : {},
            correct_answer: "A",
            time_limit: type === "coding" ? 300 : 20,
            points: type === "coding" ? 2000 : 1000,
            order_index: questions.length,
            starter_code: type === "coding" ? "def solution():\n    # Write your code here\n    pass" : "",
            test_cases: type === "coding" ? [{ input: "", expected_output: "" }] : [],
            language: "python",
            collapsed: false,
        };
        setQuestions([...questions, newQuestion]);
    };

    const deleteQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const updateQuestion = (id: string, updates: Partial<QuestionData>) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const toggleCollapse = (id: string) => {
        updateQuestion(id, { collapsed: !questions.find(q => q.id === id)?.collapsed });
    };

    const handleDragStart = (index: number) => setDraggedIndex(index);

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newQuestions = [...questions];
        const removed = newQuestions.splice(draggedIndex, 1)[0];
        if (!removed) return;
        newQuestions.splice(index, 0, removed);
        newQuestions.forEach((q, i) => q.order_index = i);
        setQuestions(newQuestions);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => setDraggedIndex(null);

    const saveQuiz = async () => {
        if (questions.length === 0) {
            alert("Add at least one question");
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem("token");

            // Update quiz metadata
            await fetch(`${API_URL}/quizzes/${quizId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: quizData.title || "Untitled Quiz",
                    description: quizData.description,
                    subject: quizData.subject,
                }),
            });

            // Get current questions from server to know what to delete
            const currentRes = await fetch(`${API_URL}/quizzes/${quizId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const currentQuiz = await currentRes.json();
            const existingQuestions = currentQuiz.questions || [];

            // Delete questions that are no longer in our list
            const currentIds = new Set(questions.map(q => q.id));
            for (const existing of existingQuestions) {
                if (!currentIds.has(existing.id)) {
                    await fetch(`${API_URL}/quizzes/${quizId}/questions/${existing.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                    });
                }
            }

            // Add or update questions
            const existingIds = new Set(existingQuestions.map((q: any) => q.id));
            for (const question of questions) {
                if (existingIds.has(question.id)) {
                    // Update existing question
                    await fetch(`${API_URL}/quizzes/${quizId}/questions/${question.id}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            question_text: question.question_text,
                            question_type: question.question_type,
                            options: question.options,
                            correct_answer: question.correct_answer,
                            time_limit: question.time_limit,
                            points: question.points,
                            explanation: question.explanation,
                            order_index: question.order_index,
                            starter_code: question.starter_code,
                            solution_code: question.solution_code,
                            test_cases: question.test_cases,
                            language: question.language,
                        }),
                    });
                } else {
                    // Add new question
                    await fetch(`${API_URL}/quizzes/${quizId}/questions`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(question),
                    });
                }
            }

            router.push("/teacher/quizzes");
        } catch (error) {
            console.error("Failed to save:", error);
            alert("Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        Array.from(e.dataTransfer.files).forEach(processFile);
    };

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-gray-50 flex flex-col"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
                            <input
                                type="text"
                                placeholder="Quiz title..."
                                value={quizData.title}
                                onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                                className="text-xl font-bold text-gray-900 bg-transparent focus:outline-none placeholder-gray-400"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={saveQuiz}
                                disabled={saving || questions.length === 0}
                                className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white transition-all hover:bg-green-700 disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
                {/* Questions List */}
                <div className="flex-1 px-6 py-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Questions ({questions.length})
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => addQuestion("multiple_choice")}
                                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                <Plus className="h-4 w-4" />
                                MCQ
                            </button>
                            <button
                                onClick={() => addQuestion("coding")}
                                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                <Plus className="h-4 w-4" />
                                Coding
                            </button>
                        </div>
                    </div>

                    {questions.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                            <ListChecks className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No questions yet</h3>
                            <p className="text-gray-500 mb-4">Add questions manually or use AI below</p>
                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => addQuestion("multiple_choice")}
                                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add MCQ
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {questions.map((question, index) => (
                                <div
                                    key={question.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className={`rounded-xl bg-white border transition-all ${
                                        draggedIndex === index ? "opacity-50 border-purple-400" : "border-gray-200"
                                    }`}
                                >
                                    {/* Question Header */}
                                    <div
                                        className="flex items-center gap-3 p-3 cursor-pointer"
                                        onClick={() => toggleCollapse(question.id)}
                                    >
                                        <div className="cursor-grab text-gray-400 hover:text-gray-600" onClick={(e) => e.stopPropagation()}>
                                            <GripVertical className="h-4 w-4" />
                                        </div>
                                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                                            question.question_type === "coding"
                                                ? "bg-blue-100 text-blue-700"
                                                : "bg-purple-100 text-purple-700"
                                        }`}>
                                            {question.question_type === "coding" ? "Coding" : "MCQ"}
                                        </span>
                                        <span className="flex-1 text-sm text-gray-700 truncate">
                                            {question.question_text || "New question..."}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteQuestion(question.id); }}
                                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                        {question.collapsed ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronUp className="h-4 w-4 text-gray-400" />}
                                    </div>

                                    {/* Question Content */}
                                    {!question.collapsed && (
                                        <div className="px-3 pb-3 space-y-3">
                                            <textarea
                                                placeholder="Enter your question..."
                                                value={question.question_text}
                                                onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
                                                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-900 focus:border-purple-400 focus:outline-none resize-none"
                                                rows={2}
                                            />

                                            {question.question_type === "multiple_choice" ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {["A", "B", "C", "D"].map((opt) => {
                                                        const isCorrect = question.correct_answer === opt;
                                                        return (
                                                            <div
                                                                key={opt}
                                                                className={`relative flex items-center rounded-lg border bg-white p-2.5 transition-all ${
                                                                    isCorrect ? "border-green-400 ring-1 ring-green-400" : "border-gray-200"
                                                                }`}
                                                            >
                                                                <span className="mr-2 text-xs font-bold text-gray-400">{opt}</span>
                                                                <input
                                                                    type="text"
                                                                    placeholder={`Option ${opt}`}
                                                                    value={question.options[opt] || ""}
                                                                    onChange={(e) => updateQuestion(question.id, {
                                                                        options: { ...question.options, [opt]: e.target.value }
                                                                    })}
                                                                    className="flex-1 bg-transparent text-sm text-gray-800 focus:outline-none"
                                                                />
                                                                <button
                                                                    onClick={() => updateQuestion(question.id, { correct_answer: opt })}
                                                                    className={`rounded-full p-1 transition-colors ${
                                                                        isCorrect ? "bg-green-500 text-white" : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                                                                    }`}
                                                                >
                                                                    <Check className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-500 mb-1 block">Starter Code</label>
                                                        <div className="rounded-lg overflow-hidden border border-gray-200">
                                                            <Editor
                                                                height="100px"
                                                                language={question.language || "python"}
                                                                value={question.starter_code}
                                                                onChange={(v) => updateQuestion(question.id, { starter_code: v || "" })}
                                                                theme="vs-dark"
                                                                options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: "off", scrollBeyondLastLine: false }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-500 mb-1 block">Test Cases</label>
                                                        <div className="space-y-1.5">
                                                            {(question.test_cases || []).map((tc, tcIndex) => (
                                                                <div key={tcIndex} className="flex gap-2">
                                                                    <input
                                                                        placeholder="Input"
                                                                        value={tc.input}
                                                                        onChange={(e) => {
                                                                            const newCases = [...(question.test_cases || [])];
                                                                            newCases[tcIndex] = { ...tc, input: e.target.value };
                                                                            updateQuestion(question.id, { test_cases: newCases });
                                                                        }}
                                                                        className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none"
                                                                    />
                                                                    <input
                                                                        placeholder="Expected"
                                                                        value={tc.expected_output}
                                                                        onChange={(e) => {
                                                                            const newCases = [...(question.test_cases || [])];
                                                                            newCases[tcIndex] = { ...tc, expected_output: e.target.value };
                                                                            updateQuestion(question.id, { test_cases: newCases });
                                                                        }}
                                                                        className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs bg-white focus:border-blue-400 focus:outline-none"
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            const newCases = (question.test_cases || []).filter((_, i) => i !== tcIndex);
                                                                            updateQuestion(question.id, { test_cases: newCases });
                                                                        }}
                                                                        className="text-gray-400 hover:text-red-500"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <button
                                                                onClick={() => updateQuestion(question.id, {
                                                                    test_cases: [...(question.test_cases || []), { input: "", expected_output: "" }]
                                                                })}
                                                                className="text-xs text-blue-600 hover:text-blue-700"
                                                            >
                                                                + Add test case
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {question.explanation && (
                                                <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200">
                                                    <p className="text-xs text-amber-800">{question.explanation}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI Chat Input */}
                <div className="sticky bottom-0 px-6 pb-6 pt-2 bg-gradient-to-t from-gray-50 via-gray-50">
                    {messages.length > 0 && (
                        <div className="mb-4 max-h-48 overflow-y-auto space-y-2">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                        msg.role === "user"
                                            ? "bg-purple-600 text-white"
                                            : "bg-white border border-gray-200 text-gray-800"
                                    }`}>
                                        {msg.content}
                                        {msg.role === "ai" && generating && msg === messages[messages.length - 1] && (
                                            <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {pendingFiles.length > 0 && (
                        <div className="flex gap-2 mb-3">
                            {pendingFiles.map((file, i) => (
                                <div key={i} className="relative">
                                    {file.type === "image" ? (
                                        <img src={file.preview} alt="" className="h-12 w-12 rounded-lg object-cover border" />
                                    ) : (
                                        <div className="h-12 w-12 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-red-500" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removePendingFile(i)}
                                        className="absolute -top-1 -right-1 rounded-full bg-gray-800 p-0.5 text-white"
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
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
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
                            placeholder="Add more questions with AI... (or paste an image)"
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
                            className="rounded-xl bg-purple-600 p-2.5 text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">
                        <Sparkles className="inline h-3 w-3 mr-1" />
                        Use AI to add more questions
                    </p>
                </div>
            </div>
        </div>
    );
}

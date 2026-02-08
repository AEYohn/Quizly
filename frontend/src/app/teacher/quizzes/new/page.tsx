"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    Image,
    Paperclip,
    PenLine,
    Settings,
    Clock,
    Shuffle,
    RotateCcw,
    MessageCircle,
    Brain,
    Radio,
} from "lucide-react";
import { useAuthToken } from "~/lib/auth";

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
    image_url?: string; // Base64 or URL for question image
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

interface QuizSettings {
    // Timing
    timer_enabled: boolean;
    timer_mode: "per_question" | "total_quiz";
    default_time_limit: number; // seconds per question
    total_quiz_time: number; // minutes for entire quiz
    // Question behavior
    shuffle_questions: boolean;
    shuffle_answers: boolean;
    allow_retries: boolean;
    max_retries: number;
    // Feedback
    show_correct_answer: boolean;
    show_explanation: boolean;
    show_distribution: boolean;
    // AI features
    difficulty_adaptation: boolean;
    peer_discussion_enabled: boolean;
    peer_discussion_trigger: "always" | "high_confidence_wrong" | "never";
    // Live mode
    allow_teacher_intervention: boolean;
    sync_pacing_available: boolean;
}

function NewQuizPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { getFreshToken } = useAuthToken();
    const isStudyMode = searchParams.get("mode") === "study";
    const editId = searchParams.get("editId");
    const [isEditMode, setIsEditMode] = useState(false);
    const [loadingQuiz, setLoadingQuiz] = useState(!!editId);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const questionsEndRef = useRef<HTMLDivElement>(null);

    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
    const [sessionFiles, setSessionFiles] = useState<UploadedFile[]>([]); // All files uploaded this session
    const [dragOver, setDragOver] = useState(false);
    const [mode, setMode] = useState<"ai" | "manual">("ai");

    const [quizData, setQuizData] = useState({
        title: "",
        description: "",
        subject: "",
    });
    const [questions, setQuestions] = useState<QuestionData[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [quizSettings, setQuizSettings] = useState<QuizSettings>({
        // Timing - async-first defaults
        timer_enabled: false,
        timer_mode: "per_question",
        default_time_limit: 30,
        total_quiz_time: 15, // 15 minutes default
        // Question behavior
        shuffle_questions: false,
        shuffle_answers: false,
        allow_retries: true,
        max_retries: 0, // 0 = unlimited
        // Feedback
        show_correct_answer: true,
        show_explanation: true,
        show_distribution: false,
        // AI features
        difficulty_adaptation: true,
        peer_discussion_enabled: true,
        peer_discussion_trigger: "high_confidence_wrong",
        // Live mode
        allow_teacher_intervention: true,
        sync_pacing_available: false,
    });

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

    // Load existing quiz data when editing
    useEffect(() => {
        if (!editId) return;

        const loadQuiz = async () => {
            try {
                const token = await getFreshToken();
                const response = await fetch(`${API_URL}/student/quizzes/${editId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    throw new Error("Failed to load quiz");
                }

                const quiz = await response.json();

                setQuizData({
                    title: quiz.title || "",
                    description: quiz.description || "",
                    subject: quiz.subject || "",
                });

                setQuestions(quiz.questions.map((q: {
                    id: string;
                    question_text: string;
                    question_type: string;
                    options: { [key: string]: string };
                    correct_answer: string;
                    time_limit: number;
                    points: number;
                    explanation?: string;
                    order: number;
                }) => ({
                    id: q.id,
                    question_text: q.question_text,
                    question_type: q.question_type as "multiple_choice" | "coding",
                    options: q.options,
                    correct_answer: q.correct_answer,
                    time_limit: q.time_limit,
                    points: q.points,
                    explanation: q.explanation,
                    order_index: q.order,
                    collapsed: true,
                })));

                setQuizSettings(prev => ({
                    ...prev,
                    shuffle_questions: quiz.shuffle_questions ?? prev.shuffle_questions,
                    shuffle_answers: quiz.shuffle_answers ?? prev.shuffle_answers,
                    show_correct_answer: quiz.show_correct_answer ?? prev.show_correct_answer,
                    show_explanation: quiz.show_explanation ?? prev.show_explanation,
                }));

                setIsEditMode(true);
                setMode("manual"); // Start in manual mode when editing
            } catch (error) {
                console.error("Failed to load quiz:", error);
                alert("Failed to load quiz for editing");
                router.push("/student/dashboard");
            } finally {
                setLoadingQuiz(false);
            }
        };

        loadQuiz();
    }, [editId, router, getFreshToken]);

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

        // Add current files to session files for future requests
        if (currentFiles.length > 0) {
            setSessionFiles(prev => [...prev, ...currentFiles]);
        }

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
            const token = await getFreshToken();
            // Combine current files with all session files for context
            const allSessionFiles = [...sessionFiles, ...currentFiles];
            const attachments = allSessionFiles.map((f, i) => ({
                type: f.type,
                name: f.name || `file_${i}.${f.type === "pdf" ? "pdf" : "jpg"}`,
                content: f.base64,
                mime_type: f.mimeType,
            }));

            const hasFiles = allSessionFiles.length > 0;
            const hasNewFiles = currentFiles.length > 0;
            const fileTypes = currentFiles.map(f => f.type === "pdf" ? "PDF" : "image").join(" and ");

            let prompt = currentInput;
            if (hasNewFiles && !currentInput) {
                prompt = `Analyze the uploaded ${fileTypes} and generate quiz questions based on the content.`;
            } else if (hasNewFiles) {
                prompt = `${currentInput}. Use the uploaded ${fileTypes} as reference material.`;
            }
            // Let the user's intent pass through unchanged - backend will extract question count

            // Build conversation history for context
            const conversationHistory = messages
                .filter(m => m.id !== thinkingId) // Exclude the thinking message we just added
                .map(m => ({
                    role: m.role === "user" ? "user" : "ai",
                    content: m.content,
                }));

            // Build existing questions list
            const existingQuestions = questions.map(q => ({
                question_text: q.question_text,
                options: q.question_type === "multiple_choice"
                    ? Object.values(q.options).filter(Boolean)
                    : undefined,
                correct_answer: q.correct_answer,
                difficulty: undefined, // We don't track difficulty in QuestionData
            }));

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
                    conversation_history: conversationHistory.length > 0 ? conversationHistory : undefined,
                    existing_questions: existingQuestions.length > 0 ? existingQuestions : undefined,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const newQuestions = parseGeneratedQuestions(data);

                if (newQuestions.length > 0) {
                    setQuestions(prev => [...prev, ...newQuestions]);
                    if (!quizData.title && data.title) {
                        setQuizData(prev => ({
                            ...prev,
                            title: data.title,
                            subject: data.subject || "General",
                        }));
                    }

                    // Replace thinking message with success
                    setMessages(prev => prev.map(m => m.id === thinkingId ? {
                        ...m,
                        content: `Added ${newQuestions.length} question${newQuestions.length > 1 ? 's' : ''}! ${
                            newQuestions.filter(q => q.question_type === 'coding').length > 0
                                ? `(${newQuestions.filter(q => q.question_type === 'multiple_choice').length} MCQ, ${newQuestions.filter(q => q.question_type === 'coding').length} coding)`
                                : ''
                        } You can edit them below or ask me to generate more.`
                    } : m));
                } else {
                    setMessages(prev => prev.map(m => m.id === thinkingId ? {
                        ...m,
                        content: data.response || "I couldn't generate questions from that. Try being more specific about the topic, or upload a clearer image."
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
            // API returns options as array, we need object {A, B, C, D}
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

            // API returns correct_answer as index (0-3), we need letter (A-D)
            let correctAnswer = "A";
            if (typeof q.correct_answer === "number") {
                correctAnswer = ["A", "B", "C", "D"][q.correct_answer] || "A";
            } else if (typeof q.correct_answer === "string") {
                correctAnswer = q.correct_answer;
            }

            return {
                id: generateId(),
                question_text: q.question || q.question_text || q.text || "",
                question_type: q.question_type || (q.starter_code ? "coding" : "multiple_choice") as "multiple_choice" | "coding",
                options: optionsObj,
                correct_answer: correctAnswer,
                time_limit: q.question_type === "coding" ? 300 : 20,
                points: q.question_type === "coding" ? 2000 : 1000,
                explanation: q.explanation || "",
                order_index: questions.length + i,
                starter_code: q.starter_code || "",
                solution_code: q.solution_code || "",
                test_cases: q.test_cases || [],
                language: q.language || "python",
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
            solution_code: "",
            test_cases: type === "coding" ? [{ input: "", expected_output: "" }] : [],
            language: "python",
            collapsed: false,
        };
        setQuestions([...questions, newQuestion]);
        setTimeout(() => questionsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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
            const token = await getFreshToken();

            if (isStudyMode || isEditMode) {
                // Student self-study mode - use student quiz endpoint
                const url = isEditMode
                    ? `${API_URL}/student/quizzes/${editId}`
                    : `${API_URL}/student/quizzes`;
                const method = isEditMode ? "PATCH" : "POST";

                const response = await fetch(url, {
                    method,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        title: quizData.title || "Untitled Quiz",
                        description: quizData.description,
                        subject: quizData.subject,
                        questions: questions.map((q) => ({
                            question_text: q.question_text,
                            question_type: q.question_type,
                            options: q.options,
                            correct_answer: q.correct_answer,
                            explanation: q.explanation,
                            time_limit: q.time_limit,
                            points: q.points,
                        })),
                    }),
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.detail || `Failed to ${isEditMode ? "update" : "create"} study quiz`);
                }

                const quiz = await response.json();
                router.push(`/student/study/${quiz.id}/practice`);
            } else {
                // Teacher mode - use regular quiz endpoint
                const finalQuizData = {
                    ...quizData,
                    title: quizData.title || "Untitled Quiz",
                    ...quizSettings, // Include all quiz settings
                };

                const quizResponse = await fetch(`${API_URL}/quizzes/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(finalQuizData),
                });

                if (!quizResponse.ok) throw new Error("Failed to create quiz");
                const quiz = await quizResponse.json();

                for (const question of questions) {
                    const qRes = await fetch(`${API_URL}/quizzes/${quiz.id}/questions`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(question),
                    });
                    if (!qRes.ok) {
                        const err = await qRes.json().catch(() => ({}));
                        throw new Error(err.detail || `Failed to add question: ${qRes.status}`);
                    }
                }

                router.push("/teacher/quizzes");
            }
        } catch (error) {
            console.error("Failed to save:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            alert(`Failed to save: ${message}`);
        } finally {
            setSaving(false);
        }
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

    // Show loading state when loading quiz for editing
    if (loadingQuiz) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-4" />
                    <p className="text-gray-400">Loading quiz...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-gray-950 flex flex-col"
            onDragOver={(e) => { e.preventDefault(); if (mode === "ai") setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
        >
            {/* Drop overlay */}
            {dragOver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-600/90 backdrop-blur-sm">
                    <div className="text-center text-white">
                        <Upload className="mx-auto h-16 w-16 mb-4 animate-bounce" />
                        <p className="text-2xl font-bold">Drop to add files</p>
                        <p className="text-sky-200 mt-2">Images, PDFs, screenshots</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className={`sticky top-0 z-40 border-b bg-gray-900/95 backdrop-blur-sm ${isStudyMode ? "border-emerald-800" : "border-gray-800"}`}>
                <div className="mx-auto max-w-4xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push(isEditMode ? "/student/dashboard" : isStudyMode ? "/student/dashboard" : "/teacher")}
                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            {(isStudyMode || isEditMode) && (
                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                    isEditMode
                                        ? "text-amber-400 bg-amber-500/20"
                                        : "text-emerald-400 bg-emerald-500/20"
                                }`}>
                                    {isEditMode ? "Edit Mode" : "Study Mode"}
                                </span>
                            )}
                            <input
                                type="text"
                                placeholder={isStudyMode ? "Study quiz title..." : "Quiz title..."}
                                value={quizData.title}
                                onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                                className="text-xl font-bold text-white bg-transparent focus:outline-none placeholder-gray-500"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Mode Toggle */}
                            <div className="flex rounded-lg border border-gray-700 p-1 bg-gray-800">
                                <button
                                    onClick={() => setMode("ai")}
                                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        mode === "ai" ? "bg-sky-500/20 text-sky-400" : "text-gray-400 hover:bg-gray-700"
                                    }`}
                                >
                                    <Sparkles className="h-4 w-4" />
                                    AI
                                </button>
                                <button
                                    onClick={() => setMode("manual")}
                                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        mode === "manual" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-700"
                                    }`}
                                >
                                    <PenLine className="h-4 w-4" />
                                    Manual
                                </button>
                            </div>
                            {/* Settings Toggle */}
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors border ${
                                    showSettings
                                        ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                                        : "text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white"
                                }`}
                            >
                                <Settings className="h-4 w-4" />
                                Settings
                            </button>
                            <button
                                onClick={saveQuiz}
                                disabled={saving || questions.length === 0}
                                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium text-white transition-all disabled:opacity-50 ${
                                    isStudyMode ? "bg-emerald-600 hover:bg-emerald-700" : "bg-green-600 hover:bg-green-700"
                                }`}
                            >
                                <Save className="h-4 w-4" />
                                {saving ? "Saving..." : isEditMode ? "Update & Practice" : isStudyMode ? "Save & Practice" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Quiz Settings Panel */}
            {showSettings && (
                <div className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
                    <div className="mx-auto max-w-4xl px-6 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Timing Settings */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-sky-400" />
                                    Timing
                                </h3>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Enable timer</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, timer_enabled: !s.timer_enabled }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.timer_enabled ? "bg-sky-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.timer_enabled ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                {quizSettings.timer_enabled && (
                                    <>
                                        {/* Timer Mode Selection */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-400">Timer mode:</span>
                                            <div className="flex rounded-lg border border-gray-700 p-0.5 bg-gray-800">
                                                <button
                                                    onClick={() => setQuizSettings(s => ({ ...s, timer_mode: "per_question" }))}
                                                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                                        quizSettings.timer_mode === "per_question"
                                                            ? "bg-sky-500 text-white"
                                                            : "text-gray-400 hover:text-white"
                                                    }`}
                                                >
                                                    Per Question
                                                </button>
                                                <button
                                                    onClick={() => setQuizSettings(s => ({ ...s, timer_mode: "total_quiz" }))}
                                                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                                        quizSettings.timer_mode === "total_quiz"
                                                            ? "bg-sky-500 text-white"
                                                            : "text-gray-400 hover:text-white"
                                                    }`}
                                                >
                                                    Total Quiz
                                                </button>
                                            </div>
                                        </div>

                                        {quizSettings.timer_mode === "per_question" ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-400">Time per question:</span>
                                                <select
                                                    value={quizSettings.default_time_limit}
                                                    onChange={(e) => setQuizSettings(s => ({ ...s, default_time_limit: parseInt(e.target.value) }))}
                                                    className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                                                >
                                                    <option value={10}>10 seconds</option>
                                                    <option value={15}>15 seconds</option>
                                                    <option value={20}>20 seconds</option>
                                                    <option value={30}>30 seconds</option>
                                                    <option value={45}>45 seconds</option>
                                                    <option value={60}>1 minute</option>
                                                    <option value={90}>1.5 minutes</option>
                                                    <option value={120}>2 minutes</option>
                                                    <option value={180}>3 minutes</option>
                                                    <option value={300}>5 minutes</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-400">Total quiz time:</span>
                                                <select
                                                    value={quizSettings.total_quiz_time}
                                                    onChange={(e) => setQuizSettings(s => ({ ...s, total_quiz_time: parseInt(e.target.value) }))}
                                                    className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                                                >
                                                    <option value={5}>5 minutes</option>
                                                    <option value={10}>10 minutes</option>
                                                    <option value={15}>15 minutes</option>
                                                    <option value={20}>20 minutes</option>
                                                    <option value={30}>30 minutes</option>
                                                    <option value={45}>45 minutes</option>
                                                    <option value={60}>1 hour</option>
                                                    <option value={90}>1.5 hours</option>
                                                    <option value={120}>2 hours</option>
                                                </select>
                                            </div>
                                        )}

                                        {/* Estimated duration */}
                                        {questions.length > 0 && quizSettings.timer_mode === "per_question" && (
                                            <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
                                                Estimated total: ~{Math.ceil(questions.length * quizSettings.default_time_limit / 60)} min for {questions.length} questions
                                            </div>
                                        )}
                                        {questions.length > 0 && quizSettings.timer_mode === "total_quiz" && (
                                            <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
                                                ~{Math.round(quizSettings.total_quiz_time * 60 / questions.length)} sec per question ({questions.length} questions)
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Question Behavior */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Shuffle className="h-4 w-4 text-purple-400" />
                                    Question Behavior
                                </h3>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Shuffle questions</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, shuffle_questions: !s.shuffle_questions }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.shuffle_questions ? "bg-purple-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.shuffle_questions ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Shuffle answers</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, shuffle_answers: !s.shuffle_answers }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.shuffle_answers ? "bg-purple-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.shuffle_answers ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Allow retries</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, allow_retries: !s.allow_retries }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.allow_retries ? "bg-purple-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.allow_retries ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                {quizSettings.allow_retries && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-400">Max retries:</span>
                                        <select
                                            value={quizSettings.max_retries}
                                            onChange={(e) => setQuizSettings(s => ({ ...s, max_retries: parseInt(e.target.value) }))}
                                            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                                        >
                                            <option value={0}>Unlimited</option>
                                            <option value={1}>1 retry</option>
                                            <option value={2}>2 retries</option>
                                            <option value={3}>3 retries</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Feedback Settings */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <MessageCircle className="h-4 w-4 text-green-400" />
                                    Feedback & Answers
                                </h3>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Show correct answer</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, show_correct_answer: !s.show_correct_answer }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.show_correct_answer ? "bg-green-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.show_correct_answer ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Show explanation</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, show_explanation: !s.show_explanation }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.show_explanation ? "bg-green-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.show_explanation ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Show answer distribution</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, show_distribution: !s.show_distribution }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.show_distribution ? "bg-green-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.show_distribution ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                            </div>

                            {/* AI Features */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Brain className="h-4 w-4 text-amber-400" />
                                    AI Features
                                </h3>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Difficulty adaptation</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, difficulty_adaptation: !s.difficulty_adaptation }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.difficulty_adaptation ? "bg-amber-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.difficulty_adaptation ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Peer discussion</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, peer_discussion_enabled: !s.peer_discussion_enabled }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.peer_discussion_enabled ? "bg-amber-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.peer_discussion_enabled ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                {quizSettings.peer_discussion_enabled && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-400">Trigger:</span>
                                        <select
                                            value={quizSettings.peer_discussion_trigger}
                                            onChange={(e) => setQuizSettings(s => ({ ...s, peer_discussion_trigger: e.target.value as QuizSettings["peer_discussion_trigger"] }))}
                                            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                                        >
                                            <option value="always">Always</option>
                                            <option value="high_confidence_wrong">High confidence wrong</option>
                                            <option value="never">Never</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Live Mode */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Radio className="h-4 w-4 text-red-400" />
                                    Live Mode Options
                                </h3>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Teacher intervention</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, allow_teacher_intervention: !s.allow_teacher_intervention }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.allow_teacher_intervention ? "bg-red-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.allow_teacher_intervention ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">Sync pacing available</span>
                                    <button
                                        onClick={() => setQuizSettings(s => ({ ...s, sync_pacing_available: !s.sync_pacing_available }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            quizSettings.sync_pacing_available ? "bg-red-500" : "bg-gray-600"
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            quizSettings.sync_pacing_available ? "translate-x-6" : "translate-x-1"
                                        }`} />
                                    </button>
                                </label>
                            </div>

                            {/* Async-first indicator */}
                            <div className="space-y-4">
                                <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 p-4">
                                    <p className="text-sm text-sky-300 font-medium mb-1">Async-First Mode</p>
                                    <p className="text-xs text-gray-400">
                                        By default, students can start immediately and work at their own pace.
                                        {quizSettings.timer_enabled
                                            ? " Timer is enabled for each question."
                                            : " No timer pressure."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col">
                {/* AI Chat Mode */}
                {mode === "ai" && (
                    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6">
                        {/* Chat Messages */}
                        <div className="flex-1 py-6 space-y-4 overflow-y-auto">
                            {messages.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500">
                                        <Sparkles className="h-8 w-8 text-white" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-white mb-2">
                                        What would you like to quiz on?
                                    </h2>
                                    <p className="text-gray-400 mb-6">
                                        Type a topic, paste an image, or upload lecture slides
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {[
                                            "Python basics for beginners",
                                            "Machine learning concepts",
                                            "Data structures and algorithms",
                                            "JavaScript fundamentals",
                                        ].map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => setChatInput(suggestion)}
                                                className="rounded-full bg-gray-800 px-4 py-2 text-sm text-gray-300 border border-gray-700 hover:border-sky-500 hover:bg-sky-500/10 transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] ${msg.role === "user" ? "" : ""}`}>
                                        {msg.files && msg.files.length > 0 && (
                                            <div className="flex gap-2 mb-2 justify-end">
                                                {msg.files.map((file, i) => (
                                                    <div key={i} className="rounded-lg overflow-hidden border border-gray-700">
                                                        {file.type === "image" ? (
                                                            <img src={file.preview} alt="" className="h-20 w-auto object-cover" />
                                                        ) : (
                                                            <div className="flex items-center gap-2 bg-gray-800 px-3 py-2">
                                                                <FileText className="h-5 w-5 text-red-400" />
                                                                <span className="text-sm text-gray-300">{file.name}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className={`rounded-2xl px-4 py-3 ${
                                            msg.role === "user"
                                                ? "bg-sky-600 text-white"
                                                : "bg-gray-800 border border-gray-700 text-gray-200"
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
                        <div className="sticky bottom-0 pb-6 pt-2 bg-gradient-to-t from-gray-950 via-gray-950">
                            {/* Pending files preview */}
                            {pendingFiles.length > 0 && (
                                <div className="flex gap-2 mb-3 px-1">
                                    {pendingFiles.map((file, i) => (
                                        <div key={i} className="relative">
                                            {file.type === "image" ? (
                                                <img src={file.preview} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-700" />
                                            ) : (
                                                <div className="h-16 w-16 rounded-lg bg-red-500/20 border border-red-500/30 flex flex-col items-center justify-center">
                                                    <FileText className="h-6 w-6 text-red-400" />
                                                    <span className="text-[10px] text-red-400 mt-1">PDF</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removePendingFile(i)}
                                                className="absolute -top-1.5 -right-1.5 rounded-full bg-gray-700 p-0.5 text-white hover:bg-gray-600"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-3 items-end bg-gray-800 rounded-2xl border border-gray-700 shadow-lg p-3">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
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
                                    placeholder="Describe what you want to quiz on... (or paste an image)"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                    className="flex-1 resize-none bg-transparent text-white placeholder-gray-500 focus:outline-none"
                                    rows={1}
                                />
                                <button
                                    onClick={handleSubmit}
                                    disabled={generating || (!chatInput.trim() && pendingFiles.length === 0)}
                                    className="rounded-xl bg-sky-600 p-2.5 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </div>
                            <p className="text-center text-xs text-gray-500 mt-2">
                                Tip: Paste images with Cmd+V or drag files anywhere
                            </p>
                        </div>
                    </div>
                )}

                {/* Manual Mode */}
                {mode === "manual" && questions.length === 0 && (
                    <div className="flex-1 flex items-center justify-center px-6">
                        <div className="text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800">
                                <PenLine className="h-8 w-8 text-gray-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                Create questions manually
                            </h2>
                            <p className="text-gray-400 mb-6">
                                Choose a question type to get started
                            </p>
                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => addQuestion("multiple_choice")}
                                    className="flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-700 transition-colors"
                                >
                                    <ListChecks className="h-5 w-5" />
                                    Multiple Choice
                                </button>
                                <button
                                    onClick={() => addQuestion("coding")}
                                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition-colors"
                                >
                                    <Code2 className="h-5 w-5" />
                                    Coding Challenge
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Questions List */}
                {questions.length > 0 && (
                    <div className="border-t border-gray-800 bg-gray-900">
                        <div className="max-w-4xl mx-auto px-6 py-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">
                                    Questions ({questions.length})
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => addQuestion("multiple_choice")}
                                        className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                                    >
                                        <Plus className="h-4 w-4" />
                                        MCQ
                                    </button>
                                    <button
                                        onClick={() => addQuestion("coding")}
                                        className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Coding
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {questions.map((question, index) => (
                                    <div
                                        key={question.id}
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`rounded-xl bg-gray-800 border transition-all ${
                                            draggedIndex === index ? "opacity-50 border-sky-500" : "border-gray-700"
                                        }`}
                                    >
                                        {/* Question Header */}
                                        <div
                                            className="flex items-center gap-3 p-3 cursor-pointer"
                                            onClick={() => toggleCollapse(question.id)}
                                        >
                                            <div className="cursor-grab text-gray-500 hover:text-gray-300" onClick={(e) => e.stopPropagation()}>
                                                <GripVertical className="h-4 w-4" />
                                            </div>
                                            <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                                                question.question_type === "coding"
                                                    ? "bg-blue-500/20 text-blue-400"
                                                    : "bg-sky-500/20 text-sky-400"
                                            }`}>
                                                {question.question_type === "coding" ? "Coding" : "MCQ"}
                                            </span>
                                            <span className="flex-1 text-sm text-gray-300 truncate">
                                                {question.question_text || "New question..."}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteQuestion(question.id); }}
                                                className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-red-500/20"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            {question.collapsed ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                                        </div>

                                        {/* Question Content */}
                                        {!question.collapsed && (
                                            <div className="px-3 pb-3 space-y-3">
                                                <div className="space-y-2">
                                                    <textarea
                                                        placeholder="Enter your question..."
                                                        value={question.question_text}
                                                        onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
                                                        className="w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none resize-none"
                                                        rows={2}
                                                    />

                                                    {/* Image Upload */}
                                                    <div className="flex items-center gap-2">
                                                        <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-400 hover:text-white hover:border-gray-600 cursor-pointer transition-colors">
                                                            <Image className="h-4 w-4" />
                                                            <span>{question.image_url ? "Change Image" : "Add Image"}</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        const reader = new FileReader();
                                                                        reader.onload = (ev) => {
                                                                            const base64 = ev.target?.result as string;
                                                                            updateQuestion(question.id, { image_url: base64 });
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                        {question.image_url && (
                                                            <button
                                                                onClick={() => updateQuestion(question.id, { image_url: undefined })}
                                                                className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Image Preview */}
                                                    {question.image_url && (
                                                        <div className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
                                                            <img
                                                                src={question.image_url}
                                                                alt="Question image"
                                                                className="max-h-48 w-full object-contain"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {question.question_type === "multiple_choice" ? (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {["A", "B", "C", "D"].map((opt) => {
                                                            const isCorrect = question.correct_answer === opt;
                                                            return (
                                                                <div
                                                                    key={opt}
                                                                    className={`relative flex items-center rounded-lg border bg-gray-900 p-2.5 transition-all ${
                                                                        isCorrect ? "border-green-500 ring-1 ring-green-500" : "border-gray-700"
                                                                    }`}
                                                                >
                                                                    <span className="mr-2 text-xs font-bold text-gray-500">{opt}</span>
                                                                    <input
                                                                        type="text"
                                                                        placeholder={`Option ${opt}`}
                                                                        value={question.options[opt] || ""}
                                                                        onChange={(e) => updateQuestion(question.id, {
                                                                            options: { ...question.options, [opt]: e.target.value }
                                                                        })}
                                                                        className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
                                                                    />
                                                                    <button
                                                                        onClick={() => updateQuestion(question.id, { correct_answer: opt })}
                                                                        className={`rounded-full p-1 transition-colors ${
                                                                            isCorrect ? "bg-green-500 text-white" : "text-gray-500 hover:bg-gray-700 hover:text-gray-300"
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
                                                            <label className="text-xs font-medium text-gray-400 mb-1 block">Starter Code</label>
                                                            <div className="rounded-lg overflow-hidden border border-gray-700">
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
                                                            <label className="text-xs font-medium text-gray-400 mb-1 block">Test Cases</label>
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
                                                                            className="flex-1 rounded border border-gray-700 px-2 py-1.5 text-xs bg-gray-900 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                        <input
                                                                            placeholder="Expected"
                                                                            value={tc.expected_output}
                                                                            onChange={(e) => {
                                                                                const newCases = [...(question.test_cases || [])];
                                                                                newCases[tcIndex] = { ...tc, expected_output: e.target.value };
                                                                                updateQuestion(question.id, { test_cases: newCases });
                                                                            }}
                                                                            className="flex-1 rounded border border-gray-700 px-2 py-1.5 text-xs bg-gray-900 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const newCases = (question.test_cases || []).filter((_, i) => i !== tcIndex);
                                                                                updateQuestion(question.id, { test_cases: newCases });
                                                                            }}
                                                                            className="text-gray-500 hover:text-red-400"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    onClick={() => updateQuestion(question.id, {
                                                                        test_cases: [...(question.test_cases || []), { input: "", expected_output: "" }]
                                                                    })}
                                                                    className="text-xs text-sky-400 hover:text-sky-300"
                                                                >
                                                                    + Add test case
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {question.explanation && (
                                                    <div className="rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/30">
                                                        <p className="text-xs text-amber-300">{question.explanation}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div ref={questionsEndRef} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Wrap in Suspense for useSearchParams
export default function NewQuizPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
        }>
            <NewQuizPageContent />
        </Suspense>
    );
}

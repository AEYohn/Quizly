"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    Check,
    Sparkles,
    Loader2,
    Wand2,
    X,
    Upload,
    FileText,
    Code2,
    ListChecks,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Monaco editor for coding questions
const Editor = dynamic(
    () => import("@monaco-editor/react").then((mod) => mod.default),
    { ssr: false, loading: () => <div className="h-32 bg-gray-800 animate-pulse rounded-lg" /> }
);

interface QuestionData {
    question_text: string;
    question_type: "multiple_choice" | "coding";
    options: { [key: string]: string };
    correct_answer: string;
    time_limit: number;
    points: number;
    explanation?: string;
    order_index: number;
    // Coding-specific fields
    starter_code?: string;
    solution_code?: string;
    test_cases?: { input: string; expected_output: string }[];
    language?: string;
}

interface UploadedFile {
    preview: string;
    base64: string;
    mimeType: string;
    name?: string;
    type: "image" | "pdf";
}

export default function NewQuizPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<"generate" | "edit">("generate");
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);

    // AI Generation state
    const [topic, setTopic] = useState("");
    const [numQuestions, setNumQuestions] = useState(5);
    const [difficulty, setDifficulty] = useState("medium");
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [dragOver, setDragOver] = useState(false);

    const processFile = useCallback((file: File) => {
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
                    base64: base64,
                    mimeType: file.type,
                    name: file.name,
                    type: isPdf ? "pdf" : "image",
                },
            ]);
        };
        reader.readAsDataURL(file);
    }, []);

    // Clipboard paste support
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (step !== "generate") return;
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
    }, [step, processFile]);

    // Quiz data
    const [quizData, setQuizData] = useState({
        title: "",
        description: "",
        subject: "",
    });
    const [questions, setQuestions] = useState<QuestionData[]>([]);
    const [activeQuestion, setActiveQuestion] = useState(0);

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

    const generateQuestions = async () => {
        if (!topic.trim() && files.length === 0) {
            alert("Please enter a topic or upload an image/PDF");
            return;
        }

        setGenerating(true);
        try {
            const token = localStorage.getItem("token");

            // Use the chat endpoint for multimodal support
            const attachments = files.map((f) => ({
                type: f.type,
                content: f.base64,
                mime_type: f.mimeType,
            }));

            const hasFiles = files.length > 0;
            const fileTypes = files.map(f => f.type === "pdf" ? "PDF" : "image").join("/");

            const prompt = topic.trim()
                ? `Generate ${numQuestions} ${difficulty} difficulty multiple choice quiz questions about: ${topic}. Each question should have 4 options (A, B, C, D) and include an explanation for the correct answer.`
                : `Analyze the uploaded ${fileTypes}(s) and generate ${numQuestions} ${difficulty} difficulty multiple choice quiz questions based on the content. Each question should have 4 options (A, B, C, D) and include an explanation for the correct answer.`;

            const response = await fetch(`${API_URL}/ai/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: prompt,
                    attachments: attachments,
                    context: {
                        num_questions: numQuestions,
                        difficulty: difficulty,
                    },
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const generatedQuestions = (data.questions || []).map(
                    (q: any, i: number) => ({
                        question_text: q.question_text || q.question || q.text || "",
                        question_type: "multiple_choice",
                        options: q.options || {
                            A: q.option_a || q.options?.A || "",
                            B: q.option_b || q.options?.B || "",
                            C: q.option_c || q.options?.C || "",
                            D: q.option_d || q.options?.D || "",
                        },
                        correct_answer: q.correct_answer || q.answer || "A",
                        time_limit: 20,
                        points: 1000,
                        explanation: q.explanation || "",
                        order_index: i,
                    })
                );

                if (generatedQuestions.length === 0) {
                    alert("No questions were generated. Try a different topic or image.");
                    return;
                }

                setQuestions(generatedQuestions);
                setQuizData({
                    title: topic ? `${topic} Quiz` : "Image-Based Quiz",
                    description: `A ${difficulty} quiz${topic ? ` about ${topic}` : " based on uploaded content"}`,
                    subject: topic || "General",
                });
                setStep("edit");
            } else {
                const error = await response.json();
                alert(error.detail || "Failed to generate questions");
            }
        } catch (error) {
            console.error("Failed to generate:", error);
            alert("Failed to generate questions. Please try again.");
        } finally {
            setGenerating(false);
        }
    };

    const addQuestion = () => {
        const newQuestion: QuestionData = {
            question_text: "",
            question_type: "multiple_choice",
            options: { A: "", B: "", C: "", D: "" },
            correct_answer: "A",
            time_limit: 20,
            points: 1000,
            order_index: questions.length,
        };
        setQuestions([...questions, newQuestion]);
        setActiveQuestion(questions.length);
    };

    const deleteQuestion = (index: number) => {
        if (questions.length === 1) {
            alert("Quiz must have at least one question");
            return;
        }
        const newQuestions = questions.filter((_, i) => i !== index);
        newQuestions.forEach((q, i) => (q.order_index = i));
        setQuestions(newQuestions);
        if (activeQuestion >= newQuestions.length) {
            setActiveQuestion(newQuestions.length - 1);
        }
    };

    const updateQuestion = (index: number, field: string, value: any) => {
        const newQuestions = [...questions];
        if (!newQuestions[index]) return;
        if (field.startsWith("options.")) {
            const optionKey = field.split(".")[1];
            if (!optionKey) return;
            newQuestions[index].options = {
                ...newQuestions[index].options,
                [optionKey]: value,
            };
        } else {
            (newQuestions[index] as any)[field] = value;
        }
        setQuestions(newQuestions);
    };

    const saveQuiz = async () => {
        if (!quizData.title.trim()) {
            alert("Please enter a quiz title");
            return;
        }

        const invalidQuestions = questions.filter(
            (q) =>
                !q.question_text.trim() ||
                Object.values(q.options).some((o) => !o.trim())
        );
        if (invalidQuestions.length > 0) {
            alert("Please fill in all question texts and options");
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem("token");

            const quizResponse = await fetch(`${API_URL}/quizzes/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(quizData),
            });

            if (!quizResponse.ok) throw new Error("Failed to create quiz");

            const quiz = await quizResponse.json();

            for (const question of questions) {
                await fetch(`${API_URL}/quizzes/${quiz.id}/questions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(question),
                });
            }

            router.push("/teacher/quizzes");
        } catch (error) {
            console.error("Failed to save quiz:", error);
            alert("Failed to save quiz. Please try again.");
        } finally {
            setSaving(false);
        }
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
                                <Sparkles className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Create Quiz with AI
                            </h1>
                            <p className="mt-2 text-gray-500">
                                Type a topic or drop an image - AI does the rest
                            </p>
                        </div>

                        <div className="space-y-6">
                            {/* Topic Input */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    What topic should the quiz cover?
                                </label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g., Photosynthesis, World War II, Python basics..."
                                    className="w-full rounded-xl border-2 border-gray-200 p-4 text-lg focus:border-purple-500 focus:outline-none"
                                    autoFocus
                                />
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Or upload files (images, PDFs, textbook pages)
                                </label>
                                <div
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOver(true);
                                    }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                                        dragOver
                                            ? "border-purple-500 bg-purple-50"
                                            : "border-gray-300 hover:border-purple-400"
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
                                    <Upload className="mx-auto h-8 w-8 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-500">
                                        Drag & drop, click to browse, or paste (Cmd/Ctrl+V)
                                    </p>
                                    <p className="mt-1 text-xs text-gray-400">
                                        Supports images and PDFs
                                    </p>
                                </div>

                                {/* File Previews */}
                                {files.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        {files.map((file, index) => (
                                            <div key={index} className="relative">
                                                {file.type === "image" ? (
                                                    <img
                                                        src={file.preview}
                                                        alt={`Upload ${index + 1}`}
                                                        className="h-20 w-20 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-20 w-20 flex-col items-center justify-center rounded-lg bg-red-50 border border-red-200">
                                                        <FileText className="h-8 w-8 text-red-500" />
                                                        <span className="mt-1 text-xs text-red-600 truncate w-16 text-center">
                                                            {file.name?.slice(0, 8)}...
                                                        </span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeFile(index);
                                                    }}
                                                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Number of questions
                                    </label>
                                    <select
                                        value={numQuestions}
                                        onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                                        className="w-full rounded-xl border-2 border-gray-200 p-3 focus:border-purple-500 focus:outline-none"
                                    >
                                        <option value={3}>3 questions</option>
                                        <option value={5}>5 questions</option>
                                        <option value={10}>10 questions</option>
                                        <option value={15}>15 questions</option>
                                    </select>
                                </div>
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
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={generateQuestions}
                                disabled={generating || (!topic.trim() && files.length === 0)}
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
                                        Generate Quiz
                                    </>
                                )}
                            </button>

                            {/* Manual option */}
                            <div className="text-center">
                                <button
                                    onClick={() => {
                                        setQuestions([
                                            {
                                                question_text: "",
                                                question_type: "multiple_choice",
                                                options: { A: "", B: "", C: "", D: "" },
                                                correct_answer: "A",
                                                time_limit: 20,
                                                points: 1000,
                                                order_index: 0,
                                            },
                                        ]);
                                        setStep("edit");
                                    }}
                                    className="text-sm text-gray-500 hover:text-purple-600"
                                >
                                    or create manually →
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Powered by */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-white/60">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm">Powered by Gemini AI (Multimodal)</span>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2: Edit Questions
    const currentQuestion = questions[activeQuestion] ?? questions[0];
    if (!currentQuestion) return null;

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
                        placeholder="Quiz Title"
                        value={quizData.title}
                        onChange={(e) =>
                            setQuizData({ ...quizData, title: e.target.value })
                        }
                        className="text-xl font-bold text-gray-900 focus:outline-none"
                    />
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
                        onClick={saveQuiz}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                        <Save className="h-5 w-5" />
                        {saving ? "Saving..." : "Save Quiz"}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Question Sidebar */}
                <div className="w-64 overflow-y-auto border-r bg-white p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">
                            Questions ({questions.length})
                        </span>
                        <button
                            onClick={addQuestion}
                            className="rounded-lg p-1 text-purple-600 hover:bg-purple-50"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {questions.map((q, index) => (
                            <button
                                key={index}
                                onClick={() => setActiveQuestion(index)}
                                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                                    activeQuestion === index
                                        ? "border-purple-500 bg-purple-50"
                                        : "border-gray-200 hover:border-gray-300"
                                }`}
                            >
                                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
                                    {index + 1}
                                </span>
                                <span className="flex-1 truncate text-sm text-gray-700">
                                    {q.question_text || "New question"}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Question Editor */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="mx-auto max-w-3xl">
                        {/* Settings row */}
                        <div className="mb-6 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-500">Time:</label>
                                <select
                                    value={currentQuestion.time_limit}
                                    onChange={(e) =>
                                        updateQuestion(
                                            activeQuestion,
                                            "time_limit",
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                >
                                    <option value={10}>10 sec</option>
                                    <option value={20}>20 sec</option>
                                    <option value={30}>30 sec</option>
                                    <option value={60}>60 sec</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-500">Points:</label>
                                <select
                                    value={currentQuestion.points}
                                    onChange={(e) =>
                                        updateQuestion(
                                            activeQuestion,
                                            "points",
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                >
                                    <option value={500}>500</option>
                                    <option value={1000}>1000</option>
                                    <option value={1500}>1500</option>
                                    <option value={2000}>2000</option>
                                </select>
                            </div>

                            <button
                                onClick={() => deleteQuestion(activeQuestion)}
                                className="ml-auto rounded-lg p-2 text-red-500 hover:bg-red-50"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Question Text */}
                        <div className="mb-6">
                            <textarea
                                placeholder="Type your question here..."
                                value={currentQuestion.question_text}
                                onChange={(e) =>
                                    updateQuestion(
                                        activeQuestion,
                                        "question_text",
                                        e.target.value
                                    )
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white p-6 text-xl font-medium focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                rows={3}
                            />
                        </div>

                        {/* Answer Options */}
                        <div className="grid grid-cols-2 gap-4">
                            {["A", "B", "C", "D"].map((option, index) => {
                                const colors = [
                                    "bg-red-500",
                                    "bg-blue-500",
                                    "bg-yellow-500",
                                    "bg-green-500",
                                ];
                                const isCorrect = currentQuestion.correct_answer === option;

                                return (
                                    <div
                                        key={option}
                                        className={`relative rounded-xl ${colors[index]} p-4 ${
                                            isCorrect
                                                ? "ring-4 ring-white ring-offset-2 ring-offset-gray-50"
                                                : ""
                                        }`}
                                    >
                                        <input
                                            type="text"
                                            placeholder={`Answer ${option}`}
                                            value={currentQuestion.options[option] || ""}
                                            onChange={(e) =>
                                                updateQuestion(
                                                    activeQuestion,
                                                    `options.${option}`,
                                                    e.target.value
                                                )
                                            }
                                            className="w-full bg-transparent text-lg font-medium text-white placeholder-white/70 focus:outline-none"
                                        />
                                        <button
                                            onClick={() =>
                                                updateQuestion(
                                                    activeQuestion,
                                                    "correct_answer",
                                                    option
                                                )
                                            }
                                            className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 transition-colors ${
                                                isCorrect
                                                    ? "bg-white text-green-600"
                                                    : "bg-white/20 text-white hover:bg-white/30"
                                            }`}
                                        >
                                            <Check className="h-5 w-5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Explanation */}
                        {currentQuestion.explanation && (
                            <div className="mt-6">
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    AI Explanation
                                </label>
                                <textarea
                                    value={currentQuestion.explanation}
                                    onChange={(e) =>
                                        updateQuestion(
                                            activeQuestion,
                                            "explanation",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-gray-200 p-4 text-sm focus:border-purple-500 focus:outline-none"
                                    rows={2}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

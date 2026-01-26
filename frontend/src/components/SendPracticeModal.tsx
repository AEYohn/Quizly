"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Send, Check, MessageSquare, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Question {
    prompt: string;
    options: { A: string; B: string; C: string; D: string };
    correct_answer: string;
    explanation: string;
}

interface Misconception {
    question: string;
    wrong_answer: string;
    correct_answer: string;
    count?: number;
}

interface SendPracticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentName: string;
    gameId?: string;
    misconceptions: Misconception[];
    onSent?: () => void;
}

export function SendPracticeModal({
    isOpen,
    onClose,
    studentName,
    gameId,
    misconceptions,
    onSent
}: SendPracticeModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [title, setTitle] = useState("");
    const [note, setNote] = useState("");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Generate preview when modal opens
    useEffect(() => {
        // Only run when modal opens and we haven't loaded yet
        if (!isOpen || hasLoaded) return;

        // If no misconceptions, skip API call
        if (misconceptions.length === 0) {
            setTitle("Practice Questions");
            setQuestions([]);
            setHasLoaded(true);
            return;
        }

        const controller = new AbortController();

        const fetchQuestions = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`${API_URL}/assignments/generate-preview`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        student_name: studentName,
                        game_id: gameId,
                        misconceptions: misconceptions
                    }),
                    signal: controller.signal
                });

                if (response.ok) {
                    const data = await response.json();
                    setTitle(data.title || "Practice Questions");
                    setQuestions(data.suggested_questions || []);
                    // Select all questions by default
                    const qs = data.suggested_questions || [];
                    setSelectedQuestions(new Set(qs.map((_: Question, i: number) => i)));
                } else {
                    setError("Failed to generate questions");
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return; // Cancelled, don't update state
                }
                console.error("Error generating preview:", err);
                setError("Failed to connect to server");
            } finally {
                setIsLoading(false);
                setHasLoaded(true);
            }
        };

        fetchQuestions();

        return () => {
            controller.abort();
        };
    }, [isOpen, hasLoaded, misconceptions, studentName, gameId]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            // Delay reset to allow close animation
            const timer = setTimeout(() => {
                setQuestions([]);
                setTitle("");
                setNote("");
                setError(null);
                setSent(false);
                setSelectedQuestions(new Set());
                setHasLoaded(false);
                setIsLoading(false);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const toggleQuestion = (index: number) => {
        const newSelected = new Set(selectedQuestions);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedQuestions(newSelected);
    };

    const handleSend = async () => {
        if (selectedQuestions.size === 0) {
            setError("Please select at least one question");
            return;
        }

        setIsSending(true);
        setError(null);

        const selectedQs = questions.filter((_, i) => selectedQuestions.has(i));

        try {
            const response = await fetch(`${API_URL}/assignments/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_name: studentName,
                    title: title,
                    note: note || null,
                    questions: selectedQs,
                    game_id: gameId,
                    misconceptions: misconceptions
                })
            });

            if (response.ok) {
                setSent(true);
                setTimeout(() => {
                    onSent?.();
                    onClose();
                }, 1500);
            } else {
                setError("Failed to send assignment");
            }
        } catch (err) {
            console.error("Error sending:", err);
            setError("Failed to connect to server");
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    // No mistakes to base practice on
    const noMistakes = misconceptions.length === 0 && hasLoaded;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            Send Practice to {studentName}
                        </h2>
                        <p className="text-sm text-gray-400">
                            Based on {misconceptions.length} mistake{misconceptions.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-sky-500 mb-4" />
                            <p className="text-gray-400">Generating practice questions...</p>
                        </div>
                    ) : sent ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                                <Check className="h-8 w-8 text-emerald-400" />
                            </div>
                            <p className="text-lg font-medium text-white">Sent to {studentName}!</p>
                            <p className="text-gray-400">They&apos;ll see it in their inbox</p>
                        </div>
                    ) : noMistakes ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                                <AlertCircle className="h-8 w-8 text-amber-400" />
                            </div>
                            <p className="text-lg font-medium text-white">No mistakes to practice</p>
                            <p className="text-gray-400 text-center mt-2">
                                This student doesn&apos;t have any recorded mistakes from this quiz to generate practice questions.
                            </p>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                                    {error}
                                </div>
                            )}

                            {/* Title */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-sky-500 focus:outline-none"
                                />
                            </div>

                            {/* Note */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    <MessageSquare className="inline h-4 w-4 mr-1" />
                                    Personal Note (optional)
                                </label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder={`Hey ${studentName}, here's some extra practice...`}
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none resize-none"
                                />
                            </div>

                            {/* Questions */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Questions ({selectedQuestions.size} selected)
                                </label>
                                {questions.length === 0 && hasLoaded ? (
                                    <p className="text-gray-500 text-sm py-4 text-center">
                                        No questions generated. Try adding more context or misconceptions.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {questions.map((q, i) => (
                                            <div
                                                key={i}
                                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                                    selectedQuestions.has(i)
                                                        ? "bg-sky-500/10 border-sky-500/50"
                                                        : "bg-gray-800 border-gray-700 opacity-60"
                                                }`}
                                                onClick={() => toggleQuestion(i)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 ${
                                                        selectedQuestions.has(i)
                                                            ? "bg-sky-500 border-sky-500"
                                                            : "border-gray-600"
                                                    }`}>
                                                        {selectedQuestions.has(i) && (
                                                            <Check className="h-3 w-3 text-white" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white text-sm">{q.prompt}</p>
                                                        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                                                            {Object.entries(q.options).map(([key, val]) => (
                                                                <div
                                                                    key={key}
                                                                    className={`px-2 py-1 rounded ${
                                                                        key === q.correct_answer
                                                                            ? "bg-emerald-500/20 text-emerald-400"
                                                                            : "bg-gray-700 text-gray-400"
                                                                    }`}
                                                                >
                                                                    {key}: {val}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!isLoading && !sent && !noMistakes && (
                    <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isSending || selectedQuestions.size === 0}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Send to {studentName}
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Footer for no mistakes case */}
                {noMistakes && (
                    <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

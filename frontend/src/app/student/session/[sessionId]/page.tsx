"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, codeApi, type CodeExecutionResult } from "~/lib/api";
import { 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    MessageCircle, 
    Send, 
    Lightbulb,
    ThumbsUp,
    ThumbsDown,
    Sparkles,
    Code,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    List,
    Brain,
} from "lucide-react";
import { Button, Card, Badge, Progress, Alert } from "~/components/ui";
import CodeEditor from "~/components/CodeEditor";
import type { Question, PeerDiscussion } from "~/types";

type SessionPhase = "loading" | "waiting" | "voting" | "discussion" | "revote" | "result" | "completed";

// AI Analysis type
interface CodeAnalysis {
    summary: string;
    issues: string[];
    suggestions: string[];
    hints: string[];
    correct_approach: string;
    complexity_analysis?: string;
}

export default function StudentSessionPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params.sessionId as string;

    // Identity
    const [studentName, setStudentName] = useState<string>("");
    const [needsName, setNeedsName] = useState(false);
    const [nameInput, setNameInput] = useState("");
    
    // Session state
    const [phase, setPhase] = useState<SessionPhase>("loading");
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
    const [totalQuestions, setTotalQuestions] = useState<number>(0);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [showQuestionNav, setShowQuestionNav] = useState(false);
    const [questionStatus, setQuestionStatus] = useState<Record<number, 'pending' | 'attempted' | 'passed'>>({});
    
    // Response state
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [confidence, setConfidence] = useState<number>(50);
    const [reasoning, setReasoning] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    
    // Code question state
    const [codeResult, setCodeResult] = useState<CodeExecutionResult | null>(null);
    const [studentCode, setStudentCode] = useState<string>("");
    
    // AI Analysis state
    const [codeAnalysis, setCodeAnalysis] = useState<CodeAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Discussion state
    const [peerDiscussion, setPeerDiscussion] = useState<PeerDiscussion | null>(null);
    const [discussionMessages, setDiscussionMessages] = useState<{ role: string; content: string }[]>([]);
    const [messageInput, setMessageInput] = useState("");
    const [isLoadingPeer, setIsLoadingPeer] = useState(false);
    
    // Result state
    const [showExplanation, setShowExplanation] = useState(false);
    const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
    
    // Error state
    const [error, setError] = useState<string | null>(null);

    // Check if current question is a code question (check both question_type and presence of starter_code)
    const isCodeQuestion = currentQuestion?.question_type === 'code' || 
        (currentQuestion?.starter_code && currentQuestion.starter_code.length > 0);

    // 1. Check identity
    useEffect(() => {
        const name = sessionStorage.getItem("quizly_student_name") || localStorage.getItem("quizly_student_name");
        if (!name) {
            setNeedsName(true);
            return;
        }
        sessionStorage.setItem("quizly_student_name", name);
        setStudentName(name);
    }, []);

    // Handle name submission
    const handleNameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nameInput.trim()) return;
        
        localStorage.setItem("quizly_student_name", nameInput);
        sessionStorage.setItem("quizly_student_name", nameInput);
        setStudentName(nameInput);
        setNeedsName(false);
    };

    // 2. Poll Status - only for session status, NOT to control question navigation
    // Students can navigate freely between questions
    const pollStatus = useCallback(async () => {
        if (!studentName) return;

        const result = await api.liveSessions.getStatus();

        if (!result.success) {
            if (result.error.includes("404") || result.error.includes("No active")) {
                setPhase("completed");
            }
            return;
        }

        const data = result.data;
        setTotalQuestions(data.total_questions);

        if (data.status === "completed") {
            setPhase("completed");
            return;
        }

        if (data.status === "waiting") {
            setPhase("waiting");
            return;
        }

        // Only auto-load first question if we haven't started yet
        if (data.status === "active" && currentQuestionIndex === -1) {
            const qResult = await api.liveSessions.getQuestion(0);
            if (qResult.success) {
                setCurrentQuestion(qResult.data.question);
                setCurrentQuestionIndex(0);
                setPhase("voting");
            }
        } else if (data.status === "active" && phase === "loading") {
            // Just set phase to voting if we're still loading but have a question
            setPhase("voting");
        }
    }, [studentName, currentQuestionIndex, phase]);

    useEffect(() => {
        if (!studentName) return;
        
        pollStatus();
        const interval = setInterval(pollStatus, 2000);
        return () => clearInterval(interval);
    }, [studentName, pollStatus]);

    // Load AI peer for discussion
    const loadPeerDiscussion = useCallback(async () => {
        if (!currentQuestion) return;
        
        setIsLoadingPeer(true);
        
        const answer = selectedOption !== null ? String.fromCharCode(65 + selectedOption) : "";
        const result = await api.ai.peerDiscussion(currentQuestion, answer, reasoning);
        
        if (result.success) {
            setPeerDiscussion(result.data);
            setDiscussionMessages([
                { 
                    role: "peer", 
                    content: `Hi! I'm ${result.data.peer_name}. ${result.data.peer_reasoning}` 
                }
            ]);
        }
        
        setIsLoadingPeer(false);
    }, [currentQuestion, selectedOption, reasoning]);

    // Submit answer
    const handleSubmit = async () => {
        if (selectedOption === null || !currentQuestion) return;

        setIsSubmitting(true);
        setError(null);

        const answer = String.fromCharCode(65 + selectedOption);

        const result = await api.liveSessions.submit({
            student_name: studentName,
            question_id: currentQuestion.id,
            answer,
            reasoning,
            confidence,
            response_type: "mcq",
        });

        if (result.success) {
            setHasSubmitted(true);
            const isCorrect = answer === currentQuestion.correct_answer;
            setWasCorrect(isCorrect);
            setPhase("discussion");
            loadPeerDiscussion();
        } else {
            setError("Failed to submit. Try again.");
        }
        
        setIsSubmitting(false);
    };

    // Send message in discussion
    const handleSendMessage = async () => {
        if (!messageInput.trim() || !peerDiscussion) return;
        
        const userMessage = messageInput.trim();
        setMessageInput("");
        setDiscussionMessages(prev => [...prev, { role: "student", content: userMessage }]);
        
        setTimeout(() => {
            const responses = [
                "That's an interesting point! Let me think about that...",
                "I see what you mean, but have you considered the edge cases?",
                "Good question! I think the key insight here is understanding the underlying concept.",
                "Hmm, I'm not sure I agree. Here's my perspective...",
            ];
            const response = responses[Math.floor(Math.random() * responses.length)] ?? "";
            setDiscussionMessages(prev => [...prev, { role: "peer", content: response }]);
        }, 1000);
    };

    const handleRevote = () => {
        setPhase("revote");
        setSelectedOption(null);
        setConfidence(50);
        setHasSubmitted(false);
    };

    const handleShowResult = () => {
        setPhase("result");
        setShowExplanation(true);
    };

    // Fetch all questions for navigation (must be before any early returns)
    const loadAllQuestions = useCallback(async () => {
        const questions: Question[] = [];
        for (let i = 0; i < totalQuestions; i++) {
            const result = await api.liveSessions.getQuestion(i);
            if (result.success) {
                questions.push(result.data.question);
            }
        }
        setAllQuestions(questions);
    }, [totalQuestions]);
    
    useEffect(() => {
        if (totalQuestions > 0 && allQuestions.length === 0) {
            loadAllQuestions();
        }
    }, [totalQuestions, allQuestions.length, loadAllQuestions]);
    
    // Navigate to a specific question
    const goToQuestion = useCallback((index: number) => {
        if (index < 0 || index >= totalQuestions || index === currentQuestionIndex) return;
        
        const question = allQuestions[index];
        if (question) {
            setCurrentQuestion(question);
            setCurrentQuestionIndex(index);
            // Reset state for new question
            setSelectedOption(null);
            setConfidence(50);
            setReasoning("");
            setHasSubmitted(false);
            setPeerDiscussion(null);
            setDiscussionMessages([]);
            setShowExplanation(false);
            setWasCorrect(null);
            setCodeResult(null);
            setCodeAnalysis(null);
            setStudentCode("");
            setPhase("voting");
            setShowQuestionNav(false);
        }
    }, [totalQuestions, currentQuestionIndex, allQuestions]);
    
    // Get AI analysis for code
    const getAIAnalysis = useCallback(async () => {
        if (!currentQuestion || !studentCode) return;
        
        setIsAnalyzing(true);
        try {
            const result = await api.ai.analyzeCode({
                problem_description: currentQuestion.prompt,
                student_code: studentCode,
                language: currentQuestion.language || 'python',
                test_results: codeResult?.test_results?.map(t => ({
                    status: t.status,
                    input: t.input,
                    expected_output: t.expected_output,
                    actual_output: t.actual_output,
                })) || [],
                error_message: codeResult?.error_message,
            });
            
            if (result.success) {
                setCodeAnalysis(result.data);
            }
        } catch (err) {
            console.error("AI analysis failed:", err);
        } finally {
            setIsAnalyzing(false);
        }
    }, [currentQuestion, studentCode, codeResult]);

    // Name prompt
    if (needsName) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-100">
                    <div className="mb-8 text-center">
                        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-3xl shadow-lg shadow-indigo-600/20">
                            🎒
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Join Live Session</h1>
                        <p className="mt-2 text-gray-500">
                            Enter your name to join the quiz
                        </p>
                    </div>

                    <form onSubmit={handleNameSubmit} className="space-y-6">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                What&apos;s your name?
                            </label>
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                placeholder="e.g. Alex Smith"
                                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg outline-none transition-all placeholder:text-gray-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!nameInput.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/40 disabled:opacity-50"
                        >
                            Join Session
                            <ArrowRight className="h-5 w-5" />
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

    // Loading
    if (phase === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
            </div>
        );
    }

    // Waiting
    if (phase === "waiting") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 text-center">
                <div className="mb-6 rounded-full bg-white p-6 shadow-xl">
                    <Loader2 className="h-16 w-16 animate-spin text-indigo-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Waiting for Teacher</h1>
                <p className="mt-2 text-gray-600">The session will start soon...</p>
                <Card className="mt-8">
                    <div className="text-center">
                        <span className="text-sm font-medium text-gray-500">Joined as</span>
                        <div className="mt-1 text-xl font-bold text-indigo-600">{studentName}</div>
                    </div>
                </Card>
            </div>
        );
    }

    // Completed
    if (phase === "completed") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 text-center">
                <div className="mb-6 rounded-full bg-green-100 p-6 text-green-600 shadow-lg">
                    <CheckCircle2 className="h-16 w-16" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Session Complete! 🎉</h1>
                <p className="mt-2 text-lg text-gray-600">Great job participating today.</p>
                <Button onClick={() => router.push("/student")} className="mt-8" size="lg">
                    Back to Home
                </Button>
            </div>
        );
    }

    // Main view - use full width for code questions
    const isCodeView = isCodeQuestion && (phase === "voting" || phase === "revote");
    
    // Handle code submission
    const handleCodeSubmit = async () => {
        if (!currentQuestion || !codeResult) return;
        
        setIsSubmitting(true);
        try {
            // Submit the code response using the correct API method
            await api.liveSessions.submit({
                question_id: currentQuestion.id,
                student_name: studentName,
                answer: codeResult.all_passed ? "passed" : "partial",
                confidence: codeResult.score_percent,
                reasoning: `Passed ${codeResult.passed_count}/${codeResult.total_count} tests`,
                response_type: "code",
            });
            
            // Update question status
            setQuestionStatus(prev => ({
                ...prev,
                [currentQuestionIndex]: codeResult.all_passed ? 'passed' : 'attempted'
            }));
            
            setHasSubmitted(true);
            setWasCorrect(codeResult.all_passed);
            setPhase("result");
        } catch (err) {
            console.error("Failed to submit code response:", err);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isCodeView && currentQuestion) {
        // Full-screen LeetCode-style layout for code questions
        return (
            <div className="h-screen w-screen bg-[#0a0a14] flex flex-col overflow-hidden">
                {/* Header with question navigator */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        {/* Question Navigator Toggle */}
                        <button
                            onClick={() => setShowQuestionNav(!showQuestionNav)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                        >
                            <List className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-300">Q{currentQuestionIndex + 1}/{totalQuestions}</span>
                        </button>
                        
                        {/* Prev/Next buttons */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => goToQuestion(currentQuestionIndex - 1)}
                                disabled={currentQuestionIndex === 0}
                                className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="h-4 w-4 text-gray-400" />
                            </button>
                            <button
                                onClick={() => goToQuestion(currentQuestionIndex + 1)}
                                disabled={currentQuestionIndex === totalQuestions - 1}
                                className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>
                        
                        <Badge variant="purple" dot pulse>LIVE</Badge>
                        <Code className="h-4 w-4 text-purple-500" />
                        <span className="text-sm text-purple-400">Coding Problem</span>
                        <span className="text-sm text-gray-500">{currentQuestion.language || 'Python'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Get AI Help button */}
                        {codeResult && !codeResult.all_passed && (
                            <button
                                onClick={getAIAnalysis}
                                disabled={isAnalyzing}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-all"
                            >
                                {isAnalyzing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Brain className="h-4 w-4" />
                                )}
                                {isAnalyzing ? "Analyzing..." : "Get AI Help"}
                            </button>
                        )}
                        
                        {/* Submit button */}
                        {codeResult && (
                            <button
                                onClick={handleCodeSubmit}
                                disabled={isSubmitting}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                    codeResult.all_passed
                                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                        : "bg-amber-600 hover:bg-amber-500 text-white"
                                }`}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ArrowRight className="h-4 w-4" />
                                )}
                                {codeResult.all_passed ? "Submit & Continue" : `Submit (${codeResult.passed_count}/${codeResult.total_count} passed)`}
                            </button>
                        )}
                        <div className="flex items-center gap-2 rounded-full bg-gray-800 px-3 py-1">
                            <span className="text-sm">👤</span>
                            <span className="text-sm font-medium text-gray-300">{studentName}</span>
                        </div>
                    </div>
                </div>
                
                {/* Question Navigator Dropdown */}
                {showQuestionNav && (
                    <div className="absolute top-12 left-4 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 min-w-[280px]">
                        <div className="text-xs text-gray-500 mb-2 px-1">Select a question</div>
                        <div className="grid grid-cols-5 gap-2">
                            {Array.from({ length: totalQuestions }, (_, i) => {
                                const status = questionStatus[i];
                                const isCurrent = i === currentQuestionIndex;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => goToQuestion(i)}
                                        className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                                            isCurrent
                                                ? "bg-purple-600 text-white"
                                                : status === 'passed'
                                                ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/50"
                                                : status === 'attempted'
                                                ? "bg-amber-600/30 text-amber-400 border border-amber-500/50"
                                                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded bg-emerald-600/30 border border-emerald-500/50"></span>
                                Passed
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded bg-amber-600/30 border border-amber-500/50"></span>
                                Attempted
                            </span>
                        </div>
                    </div>
                )}
                
                {/* AI Analysis Panel */}
                {codeAnalysis && (
                    <div className="bg-purple-900/30 border-b border-purple-700/50 px-4 py-3">
                        <div className="flex items-start gap-3 max-w-4xl mx-auto">
                            <Brain className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="text-purple-200 font-medium mb-1">{codeAnalysis.summary}</div>
                                {codeAnalysis.issues.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-xs text-purple-400 mb-1">Issues Found:</div>
                                        <ul className="text-sm text-purple-200/80 space-y-1">
                                            {codeAnalysis.issues.map((issue, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-red-400">•</span>
                                                    {issue}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {codeAnalysis.suggestions.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-xs text-purple-400 mb-1">Suggestions:</div>
                                        <ul className="text-sm text-purple-200/80 space-y-1">
                                            {codeAnalysis.suggestions.map((sug, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-emerald-400">→</span>
                                                    {sug}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <button
                                    onClick={() => setCodeAnalysis(null)}
                                    className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Full-height code editor */}
                <div className="flex-1 p-2 overflow-hidden">
                    <CodeEditor
                        questionId={currentQuestion.id}
                        prompt={currentQuestion.prompt}
                        starterCode={currentQuestion.starter_code || `def solution():\n    # Your code here\n    pass`}
                        testCases={currentQuestion.test_cases?.map(tc => ({
                            input: tc.input,
                            expected_output: tc.expected_output,
                            is_hidden: tc.is_hidden,
                        })) || []}
                        language={currentQuestion.language || 'python'}
                        onSubmit={(result) => {
                            setCodeResult(result);
                        }}
                        onCodeChange={(code) => {
                            setStudentCode(code);
                        }}
                    />
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-4">
            <div className="mx-auto max-w-2xl">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Badge variant="purple" dot pulse>LIVE</Badge>
                        <span className="text-sm text-gray-500">
                            Question {currentQuestionIndex + 1} of {totalQuestions}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full px-3 py-1 bg-white shadow-sm">
                        <span className="text-sm text-gray-500">👤</span>
                        <span className="text-sm font-medium">{studentName}</span>
                    </div>
                </div>

                <Progress value={((currentQuestionIndex + 1) / totalQuestions) * 100} color="purple" size="sm" className="mb-4" />

                {/* Question prompt for MCQ */}
                {currentQuestion && (
                    <Card className="mb-6 shadow-lg">
                        <h2 className="text-xl font-bold text-gray-900 leading-relaxed">{currentQuestion.prompt}</h2>
                    </Card>
                )}

                {/* Voting Phase - MCQ */}
                {(phase === "voting" || phase === "revote") && currentQuestion && (
                    <>
                        <div className="space-y-3 mb-6">
                            {currentQuestion.options.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => !hasSubmitted && setSelectedOption(idx)}
                                    disabled={hasSubmitted}
                                    className={`w-full rounded-2xl p-5 text-left transition-all ${
                                        selectedOption === idx
                                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                                            : "bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md"
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${
                                            selectedOption === idx ? "bg-white/20" : "bg-indigo-100 text-indigo-600"
                                        }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <span className="text-lg">{option.replace(/^[A-D]\.\s*/, "")}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {selectedOption !== null && !hasSubmitted && (
                            <>
                                <Card className="mb-6 animate-fade-in">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="font-medium text-gray-700">How confident are you?</span>
                                        <Badge variant={confidence >= 70 ? "success" : confidence >= 40 ? "warning" : "danger"}>
                                            {confidence}%
                                        </Badge>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={confidence}
                                        onChange={(e) => setConfidence(Number(e.target.value))}
                                        className="w-full h-3 rounded-full appearance-none bg-gray-200 cursor-pointer accent-indigo-600"
                                    />
                                    <div className="mt-2 flex justify-between text-xs text-gray-400">
                                        <span>Just guessing</span>
                                        <span>Absolutely sure</span>
                                    </div>
                                </Card>

                                <Card className="mb-6 animate-fade-in">
                                    <label className="mb-2 block font-medium text-gray-700">
                                        Why did you choose this answer? (optional)
                                    </label>
                                    <textarea
                                        value={reasoning}
                                        onChange={(e) => setReasoning(e.target.value)}
                                        placeholder="Explain your thinking..."
                                        className="w-full rounded-xl border-2 border-gray-200 p-3 text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none"
                                        rows={3}
                                    />
                                </Card>
                            </>
                        )}

                        {!hasSubmitted && (
                            <Button onClick={handleSubmit} disabled={selectedOption === null || isSubmitting} isLoading={isSubmitting} size="lg" className="w-full">
                                {phase === "revote" ? "Submit Final Answer" : "Submit Answer"}
                            </Button>
                        )}

                        {error && <Alert variant="danger" className="mt-4">{error}</Alert>}
                    </>
                )}

                {/* Discussion Phase */}
                {phase === "discussion" && (
                    <div className="space-y-4">
                        <Alert variant="success" icon={<CheckCircle2 className="h-5 w-5" />}>
                            Answer submitted! Now discuss with your AI peer.
                        </Alert>

                        <Card className="shadow-lg">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                    {peerDiscussion?.peer_name?.[0] || "P"}
                                </div>
                                <div>
                                    <div className="font-semibold">{peerDiscussion?.peer_name || "AI Peer"}</div>
                                    <Badge variant="purple" dot pulse>In Discussion</Badge>
                                </div>
                            </div>

                            {isLoadingPeer ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                                        {discussionMessages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}>
                                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                                    msg.role === "student" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"
                                                }`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {peerDiscussion?.discussion_prompt && (
                                        <div className="rounded-xl bg-amber-50 p-3 mb-4">
                                            <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
                                                <Lightbulb className="h-4 w-4" />
                                                Discussion Prompt
                                            </div>
                                            <p className="text-sm text-amber-800">{peerDiscussion.discussion_prompt}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                            placeholder="Type your response..."
                                            className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none"
                                        />
                                        <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                                            <Send className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Card>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={handleRevote} className="flex-1">
                                <ThumbsDown className="h-5 w-5 mr-2" />
                                Change Answer
                            </Button>
                            <Button onClick={handleShowResult} className="flex-1">
                                <ThumbsUp className="h-5 w-5 mr-2" />
                                Keep Answer
                            </Button>
                        </div>
                    </div>
                )}

                {/* Result Phase */}
                {phase === "result" && currentQuestion && (
                    <div className="space-y-4">
                        <Card className={`shadow-lg ${wasCorrect ? "bg-green-50" : "bg-red-50"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${
                                    wasCorrect ? "bg-green-500" : "bg-red-500"
                                } text-white`}>
                                    {wasCorrect ? <CheckCircle2 className="h-10 w-10" /> : <AlertCircle className="h-10 w-10" />}
                                </div>
                                <div>
                                    <div className={`text-2xl font-bold ${wasCorrect ? "text-green-700" : "text-red-700"}`}>
                                        {wasCorrect ? (isCodeQuestion ? "All Tests Passed! 🎉" : "Correct! 🎉") : "Not Quite"}
                                    </div>
                                    {isCodeQuestion ? (
                                        <div className="text-gray-600">
                                            {codeResult && `${codeResult.passed_count}/${codeResult.total_count} test cases passed`}
                                        </div>
                                    ) : (
                                        <div className="text-gray-600">
                                            The correct answer is <strong>{currentQuestion.correct_answer}</strong>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Test Case Results for Code Questions */}
                        {isCodeQuestion && codeResult && codeResult.test_results.length > 0 && (
                            <Card className="shadow-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <Code className="h-5 w-5 text-indigo-600" />
                                    <span className="font-semibold text-gray-900">Test Results</span>
                                </div>
                                <div className="space-y-3">
                                    {codeResult.test_results.map((tr, i) => (
                                        <div key={i} className={`rounded-lg p-3 ${tr.status === 'passed' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-gray-700">Test Case {i + 1}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${tr.status === 'passed' ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                                                    {tr.status === 'passed' ? '✓ Passed' : '✗ Failed'}
                                                </span>
                                            </div>
                                            {!tr.is_hidden && (
                                                <div className="text-sm space-y-1">
                                                    <div><span className="text-gray-500">Input:</span> <code className="bg-gray-100 px-1 rounded">{tr.input}</code></div>
                                                    <div><span className="text-gray-500">Expected:</span> <code className="bg-gray-100 px-1 rounded">{tr.expected_output}</code></div>
                                                    {tr.actual_output && (
                                                        <div><span className="text-gray-500">Your Output:</span> <code className={`px-1 rounded ${tr.status === 'passed' ? 'bg-green-100' : 'bg-red-100'}`}>{tr.actual_output}</code></div>
                                                    )}
                                                    {tr.error_message && (
                                                        <div className="text-red-600 text-xs mt-1">⚠️ {tr.error_message}</div>
                                                    )}
                                                </div>
                                            )}
                                            {tr.is_hidden && (
                                                <div className="text-sm text-gray-500 italic">🔒 Hidden test case</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Compilation/Runtime Error */}
                        {isCodeQuestion && codeResult?.error_message && (
                            <Card className="shadow-lg bg-red-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                    <span className="font-semibold text-red-900">Error Details</span>
                                </div>
                                <pre className="text-sm text-red-800 bg-red-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                                    {codeResult.error_message}
                                </pre>
                            </Card>
                        )}

                        {/* Explanation - always show for code questions */}
                        {currentQuestion.explanation && (
                            <Card className="shadow-lg bg-indigo-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="h-5 w-5 text-indigo-600" />
                                    <span className="font-semibold text-indigo-900">
                                        {isCodeQuestion ? "Solution Approach" : "Explanation"}
                                    </span>
                                </div>
                                <p className="text-indigo-800 leading-relaxed whitespace-pre-wrap">{currentQuestion.explanation}</p>
                            </Card>
                        )}

                        {/* Hint for incorrect code answers */}
                        {isCodeQuestion && !wasCorrect && (
                            <Card className="shadow-lg bg-amber-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="h-5 w-5 text-amber-600" />
                                    <span className="font-semibold text-amber-900">Hints</span>
                                </div>
                                <ul className="text-amber-800 space-y-2 text-sm">
                                    <li>• Check your edge cases (empty arrays, single elements)</li>
                                    <li>• Verify your loop bounds and indices</li>
                                    <li>• Make sure you're returning the correct data type</li>
                                    <li>• Consider the time/space complexity requirements</li>
                                </ul>
                            </Card>
                        )}

                        {peerDiscussion?.insight && (
                            <Card className="bg-purple-50 shadow-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageCircle className="h-5 w-5 text-purple-600" />
                                    <span className="font-semibold text-purple-900">Discussion Insight</span>
                                </div>
                                <p className="text-purple-800">{peerDiscussion.insight}</p>
                            </Card>
                        )}

                        {/* Navigation buttons - let students move freely */}
                        <div className="flex items-center justify-center gap-4 pt-4">
                            <Button
                                onClick={() => goToQuestion(currentQuestionIndex - 1)}
                                disabled={currentQuestionIndex === 0}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-gray-500 text-sm">
                                Question {currentQuestionIndex + 1} of {totalQuestions}
                            </span>
                            <Button
                                onClick={() => goToQuestion(currentQuestionIndex + 1)}
                                disabled={currentQuestionIndex >= totalQuestions - 1}
                                className="flex items-center gap-2"
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

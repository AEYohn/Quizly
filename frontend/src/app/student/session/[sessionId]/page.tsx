"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "~/lib/api";
import { 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    MessageCircle, 
    Send, 
    Lightbulb,
    ThumbsUp,
    ThumbsDown,
    Sparkles
} from "lucide-react";
import { Button, Card, Badge, Progress, Alert } from "~/components/ui";
import type { Question, PeerDiscussion } from "~/types";

type SessionPhase = "loading" | "waiting" | "voting" | "discussion" | "revote" | "result" | "completed";

export default function StudentSessionPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params.sessionId as string;

    // Identity
    const [studentName, setStudentName] = useState<string>("");
    
    // Session state
    const [phase, setPhase] = useState<SessionPhase>("loading");
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
    const [totalQuestions, setTotalQuestions] = useState<number>(0);
    
    // Response state
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [confidence, setConfidence] = useState<number>(50);
    const [reasoning, setReasoning] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    
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

    // 1. Check identity
    useEffect(() => {
        const name = sessionStorage.getItem("quizly_student_name");
        if (!name) {
            router.push("/student");
            return;
        }
        setStudentName(name);
    }, [router]);

    // 2. Poll Status
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

        if (data.status === "active") {
            // Check if new question
            if (data.current_question_index !== currentQuestionIndex) {
                // Fetch new question
                const qResult = await api.liveSessions.getQuestion(data.current_question_index);
                if (qResult.success) {
                    setCurrentQuestion(qResult.data.question);
                    setCurrentQuestionIndex(data.current_question_index);
                    // Reset state for new question
                    setSelectedOption(null);
                    setConfidence(50);
                    setReasoning("");
                    setHasSubmitted(false);
                    setPeerDiscussion(null);
                    setDiscussionMessages([]);
                    setShowExplanation(false);
                    setWasCorrect(null);
                    setPhase("voting");
                }
            }
        }
    }, [studentName, currentQuestionIndex]);

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
            const response = responses[Math.floor(Math.random() * responses.length)];
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

    // Main view
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-6">
            <div className="mx-auto max-w-2xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge variant="purple" dot pulse>LIVE</Badge>
                        <span className="text-sm text-gray-500">
                            Question {currentQuestionIndex + 1} of {totalQuestions}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
                        <span className="text-sm text-gray-500">👤</span>
                        <span className="text-sm font-medium">{studentName}</span>
                    </div>
                </div>

                <Progress value={((currentQuestionIndex + 1) / totalQuestions) * 100} color="purple" size="sm" className="mb-6" />

                {/* Question */}
                {currentQuestion && (
                    <Card className="mb-6 shadow-lg">
                        <h2 className="text-xl font-bold text-gray-900 leading-relaxed">{currentQuestion.prompt}</h2>
                    </Card>
                )}

                {/* Voting Phase */}
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
                                        {wasCorrect ? "Correct! 🎉" : "Not Quite"}
                                    </div>
                                    <div className="text-gray-600">
                                        The correct answer is <strong>{currentQuestion.correct_answer}</strong>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {showExplanation && (
                            <Card className="shadow-lg animate-fade-in">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="h-5 w-5 text-indigo-600" />
                                    <span className="font-semibold text-gray-900">Explanation</span>
                                </div>
                                <p className="text-gray-700 leading-relaxed">{currentQuestion.explanation}</p>
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

                        <p className="text-center text-gray-500 text-sm">Waiting for teacher to advance...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

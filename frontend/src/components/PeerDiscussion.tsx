"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Send, Loader2, Lightbulb, ThumbsUp, RefreshCw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Question {
    question_text: string;
    options: { [key: string]: string };
    correct_answer?: string;
    explanation?: string;
}

interface PeerDiscussionProps {
    question: Question;
    studentAnswer: string;
    studentReasoning?: string;
    correctAnswer: string;
    onComplete?: () => void;
    onInsightGained?: (insight: string) => void;
}

interface PeerMessage {
    role: "peer" | "student";
    content: string;
}

interface PeerDiscussionData {
    peer_name: string;
    peer_answer: string;
    peer_reasoning: string;
    discussion_prompt: string;
    insight: string;
}

export default function PeerDiscussion({
    question,
    studentAnswer,
    studentReasoning,
    correctAnswer,
    onComplete,
    onInsightGained
}: PeerDiscussionProps) {
    const [peerData, setPeerData] = useState<PeerDiscussionData | null>(null);
    const [messages, setMessages] = useState<PeerMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showInsight, setShowInsight] = useState(false);
    const [discussionComplete, setDiscussionComplete] = useState(false);

    // Fetch initial peer discussion data
    const fetchPeerDiscussion = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/ai/peer-discussion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: {
                        id: "temp",
                        concept: "general",
                        prompt: question.question_text,
                        options: Object.values(question.options),
                        correct_answer: correctAnswer,
                        difficulty: 0.5,
                        explanation: question.explanation || ""
                    },
                    student_answer: studentAnswer,
                    student_reasoning: studentReasoning
                })
            });

            if (response.ok) {
                const data: PeerDiscussionData = await response.json();
                setPeerData(data);

                // Start with peer's opening message
                setMessages([{
                    role: "peer",
                    content: `Hi! I'm ${data.peer_name}. I chose "${data.peer_answer}" for this question. ${data.discussion_prompt}`
                }]);
            }
        } catch (error) {
            console.error("Failed to fetch peer discussion:", error);
            // Fallback message
            setMessages([{
                role: "peer",
                content: `Hi! Let's discuss this question together. I noticed you chose "${studentAnswer}" - can you tell me more about why?`
            }]);
        } finally {
            setLoading(false);
        }
    }, [question, studentAnswer, studentReasoning, correctAnswer]);

    useEffect(() => {
        fetchPeerDiscussion();
    }, [fetchPeerDiscussion]);

    const sendMessage = async () => {
        if (!input.trim() || sending) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "student", content: userMessage }]);
        setSending(true);

        try {
            // Simulate AI peer response (in production, this would call an AI endpoint)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Generate contextual response based on the conversation
            let peerResponse = "";

            if (messages.length <= 1) {
                // First response - share peer's reasoning
                peerResponse = peerData?.peer_reasoning ||
                    `That's interesting! I thought about it differently. Let me explain my reasoning...`;
            } else if (messages.length <= 3) {
                // Second exchange - guide toward insight
                peerResponse = `I see your point. But have you considered ${peerData?.insight || "looking at it from another angle"}?`;
            } else {
                // Conclude the discussion
                peerResponse = `Great discussion! The key insight here is: ${peerData?.insight || question.explanation || "understanding the concept deeply."}`;
                setDiscussionComplete(true);
            }

            setMessages(prev => [...prev, { role: "peer", content: peerResponse }]);
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setSending(false);
        }
    };

    const revealInsight = () => {
        setShowInsight(true);
        if (peerData?.insight && onInsightGained) {
            onInsightGained(peerData.insight);
        }
    };

    const handleComplete = () => {
        if (onComplete) {
            onComplete();
        }
    };

    if (loading) {
        return (
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-lg border border-white/20">
                <div className="flex items-center justify-center gap-3 text-white">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Finding a study buddy...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/10 rounded-2xl overflow-hidden backdrop-blur-lg border border-white/20">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500/50 to-purple-500/50 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-white">{peerData?.peer_name || "Study Buddy"}</h3>
                    <p className="text-xs text-white/70">AI Peer Discussion</p>
                </div>
            </div>

            {/* Messages */}
            <div className="p-4 max-h-64 overflow-y-auto space-y-3">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                msg.role === "student"
                                    ? "bg-purple-500 text-white"
                                    : "bg-white/20 text-white"
                            }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}

                {sending && (
                    <div className="flex justify-start">
                        <div className="bg-white/20 rounded-2xl px-4 py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input or Insight reveal */}
            {!discussionComplete ? (
                <div className="p-4 border-t border-white/10">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder="Share your thoughts..."
                            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={sending || !input.trim()}
                            className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="text-xs text-white/50 mt-2 text-center">
                        Discuss with your AI peer to understand the concept better
                    </p>
                </div>
            ) : (
                <div className="p-4 border-t border-white/10 space-y-3">
                    {!showInsight ? (
                        <button
                            onClick={revealInsight}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all"
                        >
                            <Lightbulb className="h-5 w-5" />
                            Reveal Key Insight
                        </button>
                    ) : (
                        <>
                            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-4 border border-yellow-500/30">
                                <div className="flex items-start gap-3">
                                    <Lightbulb className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-medium text-yellow-200 mb-1">Key Insight:</p>
                                        <p className="text-white">{peerData?.insight || question.explanation}</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleComplete}
                                className="w-full flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-all"
                            >
                                <ThumbsUp className="h-5 w-5" />
                                Got it! Continue
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// Simpler version for quick discussions
export function QuickPeerInsight({
    insight,
    explanation,
    onDismiss
}: {
    insight: string;
    explanation?: string;
    onDismiss: () => void;
}) {
    return (
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl p-4 border border-blue-500/30">
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="h-5 w-5 text-white" />
                </div>
                <div>
                    <p className="font-medium text-blue-200 mb-1">Learning Moment:</p>
                    <p className="text-white">{insight}</p>
                    {explanation && (
                        <p className="text-white/70 text-sm mt-2">{explanation}</p>
                    )}
                </div>
            </div>
            <button
                onClick={onDismiss}
                className="w-full flex items-center justify-center gap-2 bg-white/10 text-white font-medium py-2 rounded-xl hover:bg-white/20 transition-all"
            >
                <ThumbsUp className="h-4 w-4" />
                Got it!
            </button>
        </div>
    );
}

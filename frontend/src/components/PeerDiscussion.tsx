"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Send, Loader2, Lightbulb, ThumbsUp, RefreshCw, Users, Bot, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Question {
    question_text: string;
    options: { [key: string]: string };
    correct_answer?: string;
    explanation?: string;
}

interface PeerDiscussionProps {
    gameId: string;
    playerId: string;
    playerName: string;
    question: Question;
    questionIndex: number;
    studentAnswer: string;
    studentReasoning?: string;
    correctAnswer: string;
    isCorrect: boolean;
    confidence: number;
    onComplete?: () => void;
    onInsightGained?: (insight: string) => void;
}

interface PeerMessage {
    id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    timestamp: number;
}

interface PeerMatch {
    status: "waiting" | "matched" | "timeout";
    peer_id?: string;
    peer_name?: string;
    peer_answer?: string;
    room_id?: string;
    use_ai: boolean;
    ai_peer_name?: string;
}

// Simple markdown renderer for AI responses
function renderMarkdown(text: string): React.ReactNode {
    // Split by bold (**text**) and italic (*text*) patterns
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Check for bold first (**)
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Check for italic (*)
        const italicMatch = remaining.match(/\*([^*]+)\*/);

        if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
            // Add text before bold
            if (boldMatch.index! > 0) {
                parts.push(remaining.slice(0, boldMatch.index));
            }
            // Add bold text
            parts.push(<strong key={key++} className="font-bold">{boldMatch[1]}</strong>);
            remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
        } else if (italicMatch) {
            // Add text before italic
            if (italicMatch.index! > 0) {
                parts.push(remaining.slice(0, italicMatch.index));
            }
            // Add italic text
            parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>);
            remaining = remaining.slice(italicMatch.index! + italicMatch[0].length);
        } else {
            // No more matches, add remaining text
            parts.push(remaining);
            break;
        }
    }

    return parts.length > 0 ? parts : text;
}

export default function PeerDiscussion({
    gameId,
    playerId,
    playerName,
    question,
    questionIndex,
    studentAnswer,
    studentReasoning,
    correctAnswer,
    isCorrect,
    confidence,
    onComplete,
    onInsightGained
}: PeerDiscussionProps) {
    const [matchStatus, setMatchStatus] = useState<"searching" | "matched" | "ai_fallback">("searching");
    const [peerMatch, setPeerMatch] = useState<PeerMatch | null>(null);
    const [messages, setMessages] = useState<PeerMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [discussionComplete, setDiscussionComplete] = useState(false);
    const [showInsight, setShowInsight] = useState(false);
    const [showQuestionContext, setShowQuestionContext] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastMessageTimestamp = useRef<number>(0);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Find peer on mount
    useEffect(() => {
        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 10; // 10 attempts * 500ms = 5 seconds

        const findPeer = async () => {
            try {
                const response = await fetch(`${API_URL}/games/${gameId}/peer/find`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        player_id: playerId,
                        player_name: playerName,
                        question_index: questionIndex,
                        player_answer: studentAnswer,
                        is_correct: isCorrect,
                        confidence: confidence
                    })
                });

                if (!response.ok || cancelled) return;

                const match: PeerMatch = await response.json();

                if (match.status === "matched") {
                    setPeerMatch(match);
                    setMatchStatus(match.use_ai ? "ai_fallback" : "matched");

                    if (match.use_ai) {
                        // Start AI conversation
                        startAIConversation(match.ai_peer_name || "Alex");
                    } else {
                        // Start polling for messages
                        startMessagePolling(match.room_id!);
                    }
                } else if (match.status === "waiting") {
                    attempts++;
                    if (attempts < maxAttempts && !cancelled) {
                        setTimeout(findPeer, 500);
                    } else {
                        // Timeout - force AI fallback
                        setMatchStatus("ai_fallback");
                        startAIConversation("Alex");
                    }
                }
            } catch (error) {
                console.error("Failed to find peer:", error);
                // Fallback to AI on error
                setMatchStatus("ai_fallback");
                startAIConversation("Alex");
            }
        };

        findPeer();

        return () => {
            cancelled = true;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [gameId, playerId, playerName, questionIndex, studentAnswer, isCorrect, confidence]);

    const startMessagePolling = (roomId: string) => {
        // Initial fetch
        fetchMessages(roomId);

        // Poll every second for new messages
        pollIntervalRef.current = setInterval(() => {
            fetchMessages(roomId);
        }, 1000);
    };

    const fetchMessages = async (roomId: string) => {
        try {
            const url = lastMessageTimestamp.current > 0
                ? `${API_URL}/games/${gameId}/peer/messages/${roomId}?after=${lastMessageTimestamp.current}`
                : `${API_URL}/games/${gameId}/peer/messages/${roomId}`;

            const response = await fetch(url);
            if (response.ok) {
                const newMessages: PeerMessage[] = await response.json();
                if (newMessages.length > 0) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
                        return [...prev, ...uniqueNew];
                    });
                    lastMessageTimestamp.current = Math.max(...newMessages.map(m => m.timestamp));
                }
            }
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        }
    };

    const startAIConversation = async (aiName: string) => {
        try {
            // Use smart peer API for opening message
            const response = await fetch(`${API_URL}/games/${gameId}/peer/smart-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    player_id: playerId,
                    question_index: questionIndex,
                    message: "", // Empty message triggers opening
                    context: {
                        student_answer: studentAnswer,
                        is_correct: isCorrect,
                        reasoning: studentReasoning,
                        confidence: confidence,
                        question: {
                            question_text: question.question_text,
                            options: question.options,
                            correct_answer: correctAnswer,
                            explanation: question.explanation
                        }
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                setMessages([{
                    id: `ai_${Date.now()}`,
                    sender_id: "ai",
                    sender_name: data.name || aiName,
                    content: data.message,
                    timestamp: Date.now() / 1000
                }]);
                return;
            }
        } catch (error) {
            console.error("Smart peer opening error:", error);
        }

        // Fallback: Generate AI opening message locally
        const studentAnswerText = question.options[studentAnswer] || studentAnswer;

        let aiOpening: string;
        if (isCorrect) {
            aiOpening = `Hey! I'm ${aiName}. Nice work getting this one right! Can you walk me through your thinking? What helped you figure out the right answer?`;
        } else {
            aiOpening = `Hey! I'm ${aiName}. This one tripped me up too at first. I see you went with "${studentAnswerText}" - that's a common choice. What was your reasoning? I'd love to compare our thinking.`;
        }

        setMessages([{
            id: `ai_${Date.now()}`,
            sender_id: "ai",
            sender_name: aiName,
            content: aiOpening,
            timestamp: Date.now() / 1000
        }]);
    };

    const sendMessage = async () => {
        if (!input.trim() || sending) return;

        const userMessage = input.trim();
        setInput("");

        const newMsg: PeerMessage = {
            id: `local_${Date.now()}`,
            sender_id: playerId,
            sender_name: playerName,
            content: userMessage,
            timestamp: Date.now() / 1000
        };

        setMessages(prev => [...prev, newMsg]);
        setSending(true);

        try {
            if (matchStatus === "matched" && peerMatch?.room_id) {
                // Send to real peer
                await fetch(`${API_URL}/games/${gameId}/peer/message/${peerMatch.room_id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sender_id: playerId,
                        sender_name: playerName,
                        content: userMessage
                    })
                });
            } else {
                // AI response
                await generateAIResponse(userMessage);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setSending(false);
        }
    };

    const generateAIResponse = async (userMessage: string) => {
        const aiName = peerMatch?.ai_peer_name || "Alex";

        try {
            // Call the smart peer API
            const response = await fetch(`${API_URL}/games/${gameId}/peer/smart-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    player_id: playerId,
                    question_index: questionIndex,
                    message: userMessage,
                    context: {
                        student_answer: studentAnswer,
                        is_correct: isCorrect,
                        reasoning: studentReasoning,
                        confidence: confidence,
                        question: {
                            question_text: question.question_text,
                            options: question.options,
                            correct_answer: correctAnswer,
                            explanation: question.explanation
                        }
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                const aiMessage = data.message;
                const peerName = data.name || aiName;

                setMessages(prev => [...prev, {
                    id: `ai_${Date.now()}`,
                    sender_id: "ai",
                    sender_name: peerName,
                    content: aiMessage,
                    timestamp: Date.now() / 1000
                }]);

                // Check if discussion should end (no follow-up question means resolved)
                const messageCount = messages.filter(m => m.sender_id === playerId).length;
                if (!data.follow_up_question || messageCount >= 3) {
                    setDiscussionComplete(true);
                }
            } else {
                // Fallback to simple response on API error
                fallbackAIResponse(userMessage, aiName);
            }
        } catch (error) {
            console.error("Smart peer API error:", error);
            fallbackAIResponse(userMessage, aiName);
        }
    };

    const fallbackAIResponse = (userMessage: string, aiName: string) => {
        // Fallback responses when API fails
        const correctAnswerText = question.options[correctAnswer] || correctAnswer;
        const studentAnswerText = question.options[studentAnswer] || studentAnswer;
        const messageCount = messages.filter(m => m.sender_id === playerId).length;

        let response = "";
        if (messageCount === 1) {
            if (isCorrect) {
                response = `That's really helpful, thanks! So the key insight is that "${correctAnswerText}" is correct. Can you help me understand why the other options wouldn't work here?`;
            } else {
                response = `I hear you - "${studentAnswerText}" does seem reasonable at first. But when I looked more carefully, I noticed that "${correctAnswerText}" actually fits better. What do you think is the key difference?`;
            }
        } else {
            response = `Great point! I think we've both learned something here. The distinction between "${studentAnswerText}" and "${correctAnswerText}" is important.`;
            setDiscussionComplete(true);
        }

        setMessages(prev => [...prev, {
            id: `ai_${Date.now()}`,
            sender_id: "ai",
            sender_name: aiName,
            content: response,
            timestamp: Date.now() / 1000
        }]);
    };

    const revealInsight = () => {
        setShowInsight(true);
        const insight = `The correct answer is ${correctAnswer}: ${question.options[correctAnswer] || ""}. ${question.explanation || ""}`;
        onInsightGained?.(insight);
    };

    const handleComplete = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
        onComplete?.();
    };

    // Searching state
    if (matchStatus === "searching") {
        return (
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-center gap-3 text-white">
                    <div className="relative">
                        <Users className="h-8 w-8 text-sky-400" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    <div>
                        <p className="font-medium">Finding a study buddy...</p>
                        <p className="text-sm text-gray-400">Matching you with another student</p>
                    </div>
                    <Loader2 className="h-5 w-5 animate-spin text-sky-400 ml-2" />
                </div>
            </div>
        );
    }

    const isRealPeer = matchStatus === "matched";
    const peerName = peerMatch?.peer_name || peerMatch?.ai_peer_name || "Study Buddy";

    return (
        <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
            {/* Header */}
            <div className={`px-4 py-3 flex items-center gap-3 ${
                isRealPeer
                    ? "bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border-b border-emerald-500/30"
                    : "bg-gradient-to-r from-sky-500/30 to-indigo-500/30 border-b border-sky-500/30"
            }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isRealPeer
                        ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                        : "bg-gradient-to-br from-sky-400 to-indigo-500"
                }`}>
                    {isRealPeer ? (
                        <Users className="h-5 w-5 text-white" />
                    ) : (
                        <Bot className="h-5 w-5 text-white" />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-white">{peerName}</h3>
                    <p className="text-xs text-gray-300">
                        {isRealPeer ? "Real Student • Live Chat" : "AI Study Buddy"}
                    </p>
                </div>
                {isRealPeer && (
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2 py-1 rounded-full">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-xs text-emerald-300 font-medium">LIVE</span>
                    </div>
                )}
            </div>

            {/* Question Context - collapsible */}
            <div className="border-b border-gray-700">
                <button
                    onClick={() => setShowQuestionContext(!showQuestionContext)}
                    className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-400 hover:bg-gray-700/50 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        {showQuestionContext ? "Hide" : "Show"} Question & Options
                    </span>
                    {showQuestionContext ? (
                        <ChevronUp className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </button>
                {showQuestionContext && (
                    <div className="px-4 pb-3 space-y-2">
                        <p className="text-white text-sm font-medium">{question.question_text}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(question.options).map(([key, value]) => (
                                <div
                                    key={key}
                                    className={`text-xs px-2 py-1.5 rounded-lg ${
                                        key === studentAnswer
                                            ? isCorrect
                                                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                                : "bg-red-500/20 text-red-300 border border-red-500/30"
                                            : key === correctAnswer
                                            ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                            : "bg-gray-700 text-gray-300"
                                    }`}
                                >
                                    <span className="font-bold">{key}:</span> {value}
                                    {key === studentAnswer && (
                                        <span className="ml-1 text-[10px] opacity-70">(your answer)</span>
                                    )}
                                    {key === correctAnswer && key !== studentAnswer && (
                                        <span className="ml-1 text-[10px] opacity-70">(correct)</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="p-4 max-h-64 overflow-y-auto space-y-3">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === playerId ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                msg.sender_id === playerId
                                    ? "bg-sky-600 text-white"
                                    : msg.sender_id === "system"
                                    ? "bg-gray-700 text-gray-300 text-sm italic"
                                    : "bg-gray-700 text-white"
                            }`}
                        >
                            {msg.sender_id !== playerId && msg.sender_id !== "system" && (
                                <p className="text-xs text-gray-400 mb-1">{msg.sender_name}</p>
                            )}
                            {renderMarkdown(msg.content)}
                        </div>
                    </div>
                ))}

                {sending && (
                    <div className="flex justify-start">
                        <div className="bg-gray-700 rounded-2xl px-4 py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input or Insight reveal */}
            {!discussionComplete ? (
                <div className="p-4 border-t border-gray-700">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder="Share your thoughts..."
                            className="flex-1 bg-gray-700 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={sending || !input.trim()}
                            className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        {isRealPeer
                            ? "Chat with your peer to understand the concept better"
                            : "Discuss with your AI buddy to learn from each other"
                        }
                    </p>
                </div>
            ) : (
                <div className="p-4 border-t border-gray-700 space-y-3">
                    {!showInsight ? (
                        <button
                            onClick={revealInsight}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all"
                        >
                            <Lightbulb className="h-5 w-5" />
                            Reveal Key Insight
                        </button>
                    ) : (
                        <>
                            <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
                                <div className="flex items-start gap-3">
                                    <Lightbulb className="h-5 w-5 text-amber-400 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-medium text-amber-300 mb-1">Key Insight:</p>
                                        <p className="text-white text-sm">
                                            The correct answer is <strong>{correctAnswer}</strong>: {question.options[correctAnswer] || ""}
                                        </p>
                                        {question.explanation && (
                                            <p className="text-gray-300 text-sm mt-2">{question.explanation}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleComplete}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-all"
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

// Simpler version for quick discussions (unchanged for backward compatibility)
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
        <div className="bg-sky-500/10 rounded-2xl p-4 border border-sky-500/30">
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="h-5 w-5 text-white" />
                </div>
                <div>
                    <p className="font-medium text-sky-300 mb-1">Learning Moment:</p>
                    <p className="text-white">{insight}</p>
                    {explanation && (
                        <p className="text-gray-400 text-sm mt-2">{explanation}</p>
                    )}
                </div>
            </div>
            <button
                onClick={onDismiss}
                className="w-full flex items-center justify-center gap-2 bg-gray-700 text-white font-medium py-2 rounded-xl hover:bg-gray-600 transition-all"
            >
                <ThumbsUp className="h-4 w-4" />
                Got it!
            </button>
        </div>
    );
}

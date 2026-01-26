"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Send, Loader2, Lightbulb, ThumbsUp, RefreshCw, Users, Bot, ChevronDown, ChevronUp, HelpCircle, Paperclip, X, Image, FileText, ChevronRight } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Question {
    question_text: string;
    options: { [key: string]: string };
    correct_answer?: string;
    explanation?: string;
}

interface DiscussionData {
    peer_name: string;
    messages: { sender: string; content: string; has_attachment?: boolean; attachment_type?: string }[];
    key_insights?: string[];
    summary?: string;
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
    onDiscussionComplete?: (data: DiscussionData) => void;
    onCorrectRetry?: () => void; // Called when student answers correctly on retry (no points, just proceed)
    showRetryInChat?: boolean;
}

interface Attachment {
    type: "image" | "pdf";
    name: string;
    data: string; // base64
    previewUrl?: string;
}

interface PeerMessage {
    id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    timestamp: number;
    attachment?: Attachment;
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

// Markdown renderer for AI responses with table support
function renderMarkdown(text: string): React.ReactNode {
    // Check if text contains a markdown table
    const tableMatch = text.match(/\|[^\n]+\|\n\|[-:\s|]+\|\n(\|[^\n]+\|\n?)+/);

    if (tableMatch) {
        const parts: React.ReactNode[] = [];
        let key = 0;

        // Split text around the table
        const tableStart = text.indexOf(tableMatch[0]);
        const beforeTable = text.slice(0, tableStart);
        const afterTable = text.slice(tableStart + tableMatch[0].length);

        // Render text before table
        if (beforeTable.trim()) {
            parts.push(<span key={key++}>{renderInlineMarkdown(beforeTable)}</span>);
        }

        // Parse and render the table
        const tableLines = tableMatch[0].trim().split('\n');
        const headers = tableLines[0]?.split('|').filter(cell => cell.trim()) || [];
        const rows = tableLines.slice(2).map(line =>
            line.split('|').filter(cell => cell.trim())
        );

        parts.push(
            <div key={key++} className="my-2 overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-600/50">
                            {headers.map((h, i) => (
                                <th key={i} className="border border-gray-600 px-2 py-1 text-left font-semibold">
                                    {h.trim()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-gray-700/30' : ''}>
                                {row.map((cell, j) => (
                                    <td key={j} className="border border-gray-600 px-2 py-1">
                                        {cell.trim()}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );

        // Render text after table
        if (afterTable.trim()) {
            parts.push(<span key={key++}>{renderInlineMarkdown(afterTable)}</span>);
        }

        return <>{parts}</>;
    }

    return renderInlineMarkdown(text);
}

// Helper for inline markdown (bold, italic)
function renderInlineMarkdown(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Check for bold first (**)
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Check for italic (*)
        const italicMatch = remaining.match(/\*([^*]+)\*/);

        if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
            if (boldMatch.index! > 0) {
                parts.push(remaining.slice(0, boldMatch.index));
            }
            parts.push(<strong key={key++} className="font-bold">{boldMatch[1]}</strong>);
            remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
        } else if (italicMatch) {
            if (italicMatch.index! > 0) {
                parts.push(remaining.slice(0, italicMatch.index));
            }
            parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>);
            remaining = remaining.slice(italicMatch.index! + italicMatch[0].length);
        } else {
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
    onInsightGained,
    onDiscussionComplete,
    onCorrectRetry,
    showRetryInChat = false
}: PeerDiscussionProps) {
    const [matchStatus, setMatchStatus] = useState<"searching" | "matched" | "ai_fallback">("searching");
    const [peerMatch, setPeerMatch] = useState<PeerMatch | null>(null);
    const [messages, setMessages] = useState<PeerMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [discussionComplete, setDiscussionComplete] = useState(false);
    const [showInsight, setShowInsight] = useState(false);
    const [showQuestionContext, setShowQuestionContext] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showInlineRetry, setShowInlineRetry] = useState(false); // Show answer options inline in chat
    const [discussionSummary, setDiscussionSummary] = useState<{
        summary?: string;
        key_insights?: string[];
        misconceptions_identified?: string[];
    } | null>(null);
    const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
    const [showMasteryCheck, setShowMasteryCheck] = useState(false);
    const [masteryAnswer, setMasteryAnswer] = useState<string | null>(null);
    const [masteryAttempts, setMasteryAttempts] = useState(0);
    const [uploadingFile, setUploadingFile] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastMessageTimestamp = useRef<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Start a peer discussion session in the backend
    const startDiscussionSession = async (peerType: string, peerName: string, peerId?: string) => {
        try {
            const response = await fetch(`${API_URL}/learning/peer-discussion/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_name: playerName,
                    game_id: gameId,
                    player_id: playerId,
                    question_index: questionIndex,
                    question_text: question.question_text,
                    question_options: question.options,
                    correct_answer: correctAnswer,
                    student_answer: studentAnswer,
                    student_confidence: confidence,
                    student_reasoning: studentReasoning,
                    was_correct: isCorrect,
                    peer_type: peerType,
                    peer_name: peerName,
                    peer_id: peerId
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSessionId(data.id);
                return data.id;
            }
        } catch (error) {
            console.error("Failed to start discussion session:", error);
        }
        return null;
    };

    // Save a message to the backend
    const saveMessage = async (sender: string, content: string) => {
        if (!sessionId) return;
        try {
            await fetch(`${API_URL}/learning/peer-discussion/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    sender,
                    content
                })
            });
        } catch (error) {
            console.error("Failed to save message:", error);
        }
    };

    // Complete the discussion and get AI summary
    const completeDiscussionSession = async (revealedAnswer: boolean) => {
        if (!sessionId) return;
        try {
            const response = await fetch(`${API_URL}/learning/peer-discussion/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    revealed_answer: revealedAnswer
                })
            });

            if (response.ok) {
                const data = await response.json();
                setDiscussionSummary({
                    summary: data.summary,
                    key_insights: data.key_insights,
                    misconceptions_identified: data.misconceptions_identified
                });
            }
        } catch (error) {
            console.error("Failed to complete discussion:", error);
        }
    };

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

                    // Start backend session
                    const peerType = match.use_ai ? "ai" : "human";
                    const peerName = match.use_ai ? (match.ai_peer_name || "Alex") : (match.peer_name || "Peer");
                    await startDiscussionSession(peerType, peerName, match.peer_id);

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
                        await startDiscussionSession("ai", "Alex");
                        startAIConversation("Alex");
                    }
                }
            } catch (error) {
                console.error("Failed to find peer:", error);
                // Fallback to AI on error
                setMatchStatus("ai_fallback");
                await startDiscussionSession("ai", "Alex");
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
                const peerName = data.name || aiName;
                setMessages([{
                    id: `ai_${Date.now()}`,
                    sender_id: "ai",
                    sender_name: peerName,
                    content: data.message,
                    timestamp: Date.now() / 1000
                }]);
                // Save AI message to backend
                saveMessage("peer", data.message);
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
        // Save AI message to backend
        saveMessage("peer", aiOpening);
    };

    const sendMessage = async () => {
        if ((!input.trim() && !pendingAttachment) || sending) return;

        const userMessage = input.trim();
        const attachment = pendingAttachment;
        setInput("");
        setPendingAttachment(null);

        const newMsg: PeerMessage = {
            id: `local_${Date.now()}`,
            sender_id: playerId,
            sender_name: playerName,
            content: userMessage || (attachment ? `[Uploaded ${attachment.type}: ${attachment.name}]` : ""),
            timestamp: Date.now() / 1000,
            attachment: attachment || undefined
        };

        setMessages(prev => [...prev, newMsg]);
        setSending(true);

        // Save student message to backend
        saveMessage("student", userMessage || `[Attached ${attachment?.type}: ${attachment?.name}]`);

        try {
            if (matchStatus === "matched" && peerMatch?.room_id) {
                // Send to real peer
                await fetch(`${API_URL}/games/${gameId}/peer/message/${peerMatch.room_id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sender_id: playerId,
                        sender_name: playerName,
                        content: userMessage,
                        attachment: attachment
                    })
                });
            } else {
                // AI response
                await generateAIResponse(userMessage, attachment);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setSending(false);
        }
    };

    const generateAIResponse = async (userMessage: string, attachment?: Attachment | null) => {
        const aiName = peerMatch?.ai_peer_name || "Alex";

        try {
            // Call the smart peer API with optional attachment
            const requestBody: Record<string, unknown> = {
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
            };

            // Include attachment if present
            if (attachment) {
                requestBody.attachment = {
                    type: attachment.type,
                    name: attachment.name,
                    data: attachment.data
                };
            }

            const response = await fetch(`${API_URL}/games/${gameId}/peer/smart-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
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

                // Save AI response to backend
                saveMessage("peer", aiMessage);

                // Check if the AI indicates the student is ready for a mastery check
                // This happens when: student already got it right OR AI signals readiness
                const messageCount = messages.filter(m => m.sender_id === playerId).length;
                if (isCorrect && !data.follow_up_question) {
                    // Student got it right originally, they can move on
                    setDiscussionComplete(true);
                } else if (!isCorrect && data.ready_for_check) {
                    // AI signals student is ready to demonstrate understanding
                    setShowMasteryCheck(true);
                }
                // Otherwise, keep discussing - no auto-complete on message count
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
        const studentAnswerText = question.options[studentAnswer] || studentAnswer;
        const messageCount = messages.filter(m => m.sender_id === playerId).length;

        let response = "";
        if (messageCount === 1) {
            if (isCorrect) {
                response = `That's really helpful, thanks! Can you help me understand why the other options wouldn't work here?`;
                setDiscussionComplete(true); // Correct answers can complete
            } else {
                response = `I hear you - "${studentAnswerText}" does seem reasonable at first. But let me ask you this: what's the core concept this question is testing? That might help us figure it out.`;
            }
        } else if (messageCount < 4) {
            if (isCorrect) {
                response = `Great explanation! I think we've both learned something here.`;
                setDiscussionComplete(true);
            } else {
                response = `Good thinking! Let me give you a hint - try comparing each option to what the question is really asking. Which one addresses the core concept most directly?`;
            }
        } else {
            if (isCorrect) {
                response = `Excellent discussion! Thanks for explaining that.`;
                setDiscussionComplete(true);
            } else {
                response = `I think you're getting closer! Want to try selecting what you think the correct answer is now?`;
                setShowMasteryCheck(true);
            }
        }

        setMessages(prev => [...prev, {
            id: `ai_${Date.now()}`,
            sender_id: "ai",
            sender_name: aiName,
            content: response,
            timestamp: Date.now() / 1000
        }]);

        // Save AI response to backend
        saveMessage("peer", response);
    };

    // Handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file type
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";

        if (!isImage && !isPdf) {
            alert("Please upload an image (PNG, JPG) or PDF file");
            return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert("File size must be less than 10MB");
            return;
        }

        setUploadingFile(true);

        try {
            // Convert to base64
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result as string;
                const attachment: Attachment = {
                    type: isImage ? "image" : "pdf",
                    name: file.name,
                    data: base64,
                    previewUrl: isImage ? base64 : undefined
                };
                setPendingAttachment(attachment);
                setUploadingFile(false);
            };
            reader.onerror = () => {
                alert("Failed to read file");
                setUploadingFile(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("File upload error:", error);
            setUploadingFile(false);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removeAttachment = () => {
        setPendingAttachment(null);
    };

    // Handle clipboard paste (Ctrl+V)
    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                setUploadingFile(true);
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result as string;
                    setPendingAttachment({
                        type: "image",
                        name: `pasted-image-${Date.now()}.png`,
                        data: base64,
                        previewUrl: base64
                    });
                    setUploadingFile(false);
                };
                reader.onerror = () => setUploadingFile(false);
                reader.readAsDataURL(file);
                break;
            }
        }
    };

    const revealInsight = async () => {
        setShowInsight(true);
        const insight = `The correct answer is ${correctAnswer}: ${question.options[correctAnswer] || ""}. ${question.explanation || ""}`;
        onInsightGained?.(insight);

        // Complete the discussion session and generate summary
        await completeDiscussionSession(true);

        // Pass discussion data for exit ticket
        if (onDiscussionComplete) {
            const discussionData: DiscussionData = {
                peer_name: peerMatch?.ai_peer_name || peerMatch?.peer_name || "Study Buddy",
                messages: messages.map(m => ({
                    sender: m.sender_id === playerId ? "student" : "peer",
                    content: m.content,
                    has_attachment: !!m.attachment,
                    attachment_type: m.attachment?.type
                })),
                key_insights: discussionSummary?.key_insights,
                summary: discussionSummary?.summary
            };
            onDiscussionComplete(discussionData);
        }
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
                    <div className="px-4 pb-3 space-y-3">
                        <p className="text-white text-sm font-medium">{question.question_text}</p>
                        <div className="flex flex-col gap-2">
                            {Object.entries(question.options).map(([key, value]) => {
                                const isWrongAnswer = key === studentAnswer && !isCorrect;
                                const isCorrectAnswer = key === correctAnswer;
                                return (
                                    <div
                                        key={key}
                                        className={`flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg border ${
                                            isWrongAnswer
                                                ? "bg-red-500/10 border-red-500/30 text-red-300"
                                                : isCorrectAnswer
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                                : "bg-gray-700/50 border-gray-600 text-gray-300"
                                        }`}
                                    >
                                        <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                            isWrongAnswer
                                                ? "bg-red-500/20"
                                                : isCorrectAnswer
                                                ? "bg-emerald-500/20"
                                                : "bg-gray-600"
                                        }`}>
                                            {key}
                                        </span>
                                        <span className="flex-1">{value}</span>
                                        {isWrongAnswer && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium uppercase">
                                                Your answer
                                            </span>
                                        )}
                                        {isCorrectAnswer && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium uppercase">
                                                Correct
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
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
                            {/* Show attachment if present */}
                            {msg.attachment && (
                                <div className="mb-2">
                                    {msg.attachment.type === "image" && msg.attachment.previewUrl ? (
                                        <img
                                            src={msg.attachment.previewUrl}
                                            alt={msg.attachment.name}
                                            className="max-w-full rounded-lg max-h-48 object-contain"
                                        />
                                    ) : msg.attachment.type === "pdf" ? (
                                        <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
                                            <FileText className="h-5 w-5 text-red-400" />
                                            <span className="text-sm truncate">{msg.attachment.name}</span>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                            {msg.content && !msg.content.startsWith("[Uploaded") && renderMarkdown(msg.content)}
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

                {/* Visual hint to type below - shows when last message is from AI and user hasn't responded */}
                {!sending && messages.length > 0 && messages[messages.length - 1]?.sender_id !== playerId && !showRetryInChat && (
                    <div className="flex justify-center mt-4 animate-bounce">
                        <div className="flex items-center gap-1 text-sky-400 text-xs bg-sky-500/10 px-3 py-1.5 rounded-full">
                            <ChevronDown className="h-3 w-3" />
                            <span>Type your reply below</span>
                            <ChevronDown className="h-3 w-3" />
                        </div>
                    </div>
                )}

                {/* Retry action embedded in chat */}
                {showRetryInChat && onCorrectRetry && messages.length >= 2 && !showInlineRetry && !discussionComplete && (
                    <div className="mt-4 space-y-3">
                        <div className="bg-gray-700/50 rounded-2xl px-4 py-3">
                            <p className="text-sm text-gray-300 mb-3">
                                Ready to try again? You can also keep chatting if you have more questions.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setShowInlineRetry(true)}
                                    className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-sky-500/20"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Try Again
                                </button>
                                <button
                                    onClick={() => setShowMasteryCheck(true)}
                                    className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-medium px-4 py-2.5 rounded-xl transition-colors"
                                >
                                    <Lightbulb className="h-4 w-4" />
                                    Check Understanding
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Inline retry - answer options in chat */}
                {showInlineRetry && !discussionComplete && (
                    <div className="mt-4">
                        <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4">
                            <p className="text-sky-300 text-sm font-medium mb-3">
                                Select your answer:
                            </p>
                            <div className="space-y-2">
                                {Object.entries(question.options).map(([key, value]) => {
                                    const isWrongAnswer = key === studentAnswer;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                if (key === correctAnswer) {
                                                    // Correct! Add success message and proceed
                                                    const peerName = peerMatch?.ai_peer_name || "Quizzy";
                                                    setMessages(prev => [...prev, {
                                                        id: `success_${Date.now()}`,
                                                        sender_id: "ai",
                                                        sender_name: peerName,
                                                        content: `That's right! ${key} is correct. Great job working through this! 🎉`,
                                                        timestamp: Date.now() / 1000
                                                    }]);
                                                    setDiscussionComplete(true);
                                                    setShowInlineRetry(false);
                                                    // Call the callback to proceed (no points)
                                                    setTimeout(() => {
                                                        onCorrectRetry?.();
                                                    }, 1500);
                                                } else {
                                                    // Wrong again - encourage more discussion
                                                    const peerName = peerMatch?.ai_peer_name || "Quizzy";
                                                    setMessages(prev => [...prev, {
                                                        id: `retry_wrong_${Date.now()}`,
                                                        sender_id: "ai",
                                                        sender_name: peerName,
                                                        content: `Not quite! Let's think about this more. Why did you choose "${value.slice(0, 40)}${value.length > 40 ? '...' : ''}"? What's your reasoning?`,
                                                        timestamp: Date.now() / 1000
                                                    }]);
                                                    setShowInlineRetry(false);
                                                }
                                            }}
                                            className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.01] ${
                                                isWrongAnswer
                                                    ? "bg-red-500/10 border-red-500/30 text-red-300 opacity-50"
                                                    : "bg-gray-700/50 border-gray-600 text-white hover:border-sky-500/50 hover:bg-gray-700"
                                            }`}
                                            disabled={isWrongAnswer}
                                        >
                                            <span className="font-bold text-sky-400 mr-2">{key}.</span>
                                            <span>{value}</span>
                                            {isWrongAnswer && (
                                                <span className="ml-2 text-xs text-red-400">(previous answer)</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setShowInlineRetry(false)}
                                className="mt-3 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                ← Keep discussing instead
                            </button>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Mastery Check - Student must prove understanding */}
            {showMasteryCheck && !discussionComplete ? (
                <div className="p-4 border-t border-gray-700">
                    <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="h-5 w-5 text-amber-400" />
                            <span className="font-bold text-amber-300">
                                {masteryAttempts === 0 ? "Let's check your understanding!" : "Not quite - try again!"}
                            </span>
                        </div>
                        <p className="text-white text-sm mb-4">
                            Based on our discussion, what do you think is the correct answer?
                        </p>
                        <div className="space-y-2">
                            {Object.entries(question.options).map(([key, value]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setMasteryAnswer(key);
                                        if (key === correctAnswer) {
                                            // They got it! Complete the discussion
                                            setDiscussionComplete(true);
                                            setShowMasteryCheck(false);
                                            // Add success message
                                            setMessages(prev => [...prev, {
                                                id: `system_${Date.now()}`,
                                                sender_id: "system",
                                                sender_name: "System",
                                                content: `You got it! ${key} is correct.`,
                                                timestamp: Date.now() / 1000
                                            }]);
                                        } else {
                                            // Wrong - encourage them to discuss more
                                            setMasteryAttempts(prev => prev + 1);
                                            setShowMasteryCheck(false);
                                            // Add AI follow-up
                                            const peerName = peerMatch?.ai_peer_name || "Alex";
                                            const wrongText = question.options[key] || key;
                                            setMessages(prev => [...prev, {
                                                id: `ai_${Date.now()}`,
                                                sender_id: "ai",
                                                sender_name: peerName,
                                                content: `Hmm, "${wrongText.slice(0, 50)}..." isn't quite it. Let's think about this more. What specifically makes you think that's the answer? Maybe we can work through it together.`,
                                                timestamp: Date.now() / 1000
                                            }]);
                                        }
                                    }}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                                        masteryAnswer === key
                                            ? key === correctAnswer
                                                ? "bg-emerald-500/20 border-emerald-500"
                                                : "bg-red-500/20 border-red-500"
                                            : "bg-gray-700 border-gray-600 hover:border-amber-500/50"
                                    }`}
                                >
                                    <span className="font-bold text-amber-300 mr-2">{key}:</span>
                                    <span className="text-white">{value}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : !discussionComplete ? (
                <div className="p-4 border-t border-gray-700">
                    {/* Attachment Preview */}
                    {pendingAttachment && (
                        <div className="mb-3 bg-gray-700 rounded-lg p-2 flex items-center gap-2">
                            {pendingAttachment.type === "image" && pendingAttachment.previewUrl ? (
                                <img
                                    src={pendingAttachment.previewUrl}
                                    alt="Preview"
                                    className="h-16 w-16 object-cover rounded"
                                />
                            ) : (
                                <div className="h-16 w-16 bg-gray-600 rounded flex items-center justify-center">
                                    <FileText className="h-8 w-8 text-red-400" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{pendingAttachment.name}</p>
                                <p className="text-xs text-gray-400">
                                    {pendingAttachment.type === "image" ? "Image" : "PDF"} attached
                                </p>
                            </div>
                            <button
                                onClick={removeAttachment}
                                className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2">
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                        />

                        {/* Upload button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingFile || sending}
                            className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 hover:bg-gray-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Upload image or PDF"
                        >
                            {uploadingFile ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Paperclip className="h-5 w-5" />
                            )}
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            onPaste={handlePaste}
                            placeholder={pendingAttachment ? "Add a message..." : messages.length > 0 && messages[messages.length - 1]?.sender_id !== playerId ? `Reply to ${messages[messages.length - 1]?.sender_name || "your peer"}...` : "Share your thoughts..."}
                            className={`flex-1 bg-gray-700 rounded-full px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all ${
                                !sending && messages.length > 0 && messages[messages.length - 1]?.sender_id !== playerId
                                    ? "ring-2 ring-sky-500/40 animate-pulse"
                                    : ""
                            }`}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={sending || (!input.trim() && !pendingAttachment)}
                            className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-500">
                            {messages.length > 0 && messages[messages.length - 1]?.sender_id !== playerId
                                ? "💬 Type in the box above to respond"
                                : isRealPeer
                                    ? "Chat with your peer to understand the concept better"
                                    : "Paste or attach images of your work"
                            }
                        </p>
                        {!isCorrect && messages.filter(m => m.sender_id === playerId).length >= 2 && (
                            <button
                                onClick={() => setShowMasteryCheck(true)}
                                className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                            >
                                I think I understand
                            </button>
                        )}
                    </div>
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

                            {/* Discussion Summary */}
                            {discussionSummary && (
                                <div className="bg-sky-500/10 rounded-xl p-4 border border-sky-500/30 space-y-2">
                                    <p className="font-medium text-sky-300 text-sm">Discussion Summary:</p>
                                    {discussionSummary.summary && (
                                        <p className="text-white text-sm">{discussionSummary.summary}</p>
                                    )}
                                    {discussionSummary.key_insights && discussionSummary.key_insights.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-400 mb-1">Key Insights:</p>
                                            <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                                                {discussionSummary.key_insights.map((insight, i) => (
                                                    <li key={i}>{insight}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleComplete}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-all animate-pulse-glow shadow-lg shadow-emerald-500/30 border-2 border-emerald-400"
                            >
                                <ThumbsUp className="h-5 w-5" />
                                Continue to Next Question
                                <ChevronRight className="h-5 w-5" />
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

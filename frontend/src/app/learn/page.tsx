"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, BookOpen, Zap, BarChart3, Trophy } from "lucide-react";
import Link from "next/link";

import { ChatContainer } from "~/components/chat/ChatContainer";
import { ChatMessage } from "~/components/chat/ChatMessage";
import { ChatInput } from "~/components/chat/ChatInput";
import { AiThinkingIndicator } from "~/components/chat/AiThinkingIndicator";
import { QuestionCard } from "~/components/learning/QuestionCard";
import { MicroLesson } from "~/components/learning/MicroLesson";
import { SessionProgress } from "~/components/learning/SessionProgress";
import { ConfidenceSlider } from "~/components/learning/ConfidenceSlider";
import { DiscussionThread } from "~/components/discussion/DiscussionThread";
import { useLearningSessionStore } from "~/stores/learningSessionStore";
import type { ChatMessage as ChatMsg, QuestionData } from "~/stores/learningSessionStore";
import { learnApi } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";

function generateId() {
    return Math.random().toString(36).slice(2, 10);
}

export default function LearnPage() {
    const auth = useAuth();
    const store = useLearningSessionStore();

    // Local UI state
    const [topicInput, setTopicInput] = useState("");
    const [confidence, setConfidence] = useState(50);
    const [error, setError] = useState<string | null>(null);
    const [showResult, setShowResult] = useState<{
        isCorrect: boolean;
        correctAnswer: string;
        explanation: string;
    } | null>(null);
    const [discussionMessages, setDiscussionMessages] = useState<
        { role: "ai" | "student"; content: string }[]
    >([]);
    const [hintsUsed, setHintsUsed] = useState(0);

    // Reset stale persisted state (e.g. from a previous crashed session)
    useEffect(() => {
        if (store.phase !== "idle" && store.phase !== "ended" && !store.sessionId) {
            store.reset();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ----- START SESSION -----
    const handleStartSession = useCallback(
        async (topic: string) => {
            if (!topic.trim()) return;
            const studentName = getStudentName(auth.user);

            setError(null);
            store.setIsLoading(true);
            store.setIsAiThinking(true);

            try {
                const result = await learnApi.startSession(
                    topic.trim(),
                    studentName,
                    auth.user?.id
                );

                store.setIsAiThinking(false);
                store.setIsLoading(false);

                if (!result.success) {
                    setError(result.error ?? "Failed to start session");
                    return;
                }

                const data = result.data;
                store.startSession(data.session_id, topic.trim());
                store.setPhase(data.phase as typeof store.phase);

                // Add AI messages
                for (const msg of data.messages) {
                    store.addMessage({
                        id: generateId(),
                        role: msg.role as "ai",
                        content: msg.content,
                        timestamp: Date.now(),
                        action: msg.action as ChatMsg["action"],
                        agent: msg.agent,
                    });
                }

                // Set first question
                if (data.question) {
                    store.setCurrentQuestion(data.question as QuestionData);
                }
            } catch (err) {
                console.error("Failed to start learning session:", err);
                store.setIsAiThinking(false);
                store.setIsLoading(false);
                setError(err instanceof Error ? err.message : "Something went wrong");
            }
        },
        [auth.user, store]
    );

    // ----- SUBMIT ANSWER -----
    const handleSubmitAnswer = useCallback(
        async (answer: string) => {
            if (!store.sessionId) return;

            // Show student's answer
            const question = store.currentQuestion;
            const optionText = question?.options.find(
                (o) => o.startsWith(answer + ".") || o.startsWith(answer + ")")
            );
            store.addMessage({
                id: generateId(),
                role: "student",
                content: optionText || answer,
                timestamp: Date.now(),
            });

            store.setIsAiThinking(true);

            const result = await learnApi.submitAnswer(
                store.sessionId,
                answer,
                confidence
            );

            store.setIsAiThinking(false);

            if (!result.success) {
                store.addMessage({
                    id: generateId(),
                    role: "system",
                    content: `Error: ${result.error}`,
                    timestamp: Date.now(),
                });
                return;
            }

            const data = result.data;
            store.recordAnswer(data.assessment.is_correct);

            // Show result on question card
            setShowResult({
                isCorrect: data.assessment.is_correct,
                correctAnswer: data.assessment.correct_answer,
                explanation: data.assessment.explanation,
            });

            // AI response message
            store.addMessage({
                id: generateId(),
                role: "ai",
                content: data.message,
                timestamp: Date.now(),
                action: data.action as ChatMsg["action"],
                agent: data.agent,
            });

            // Update phase
            if (data.phase) {
                store.setPhase(data.phase as typeof store.phase);
            }

            // Handle different actions
            if (data.action === "discuss") {
                store.setIsInDiscussion(true, "probing");
                setDiscussionMessages([
                    { role: "ai", content: data.message },
                ]);
                setHintsUsed(0);
            } else if (data.action === "teach" && data.lesson) {
                store.addMessage({
                    id: generateId(),
                    role: "ai",
                    content: "",
                    timestamp: Date.now(),
                    action: "teach",
                    agent: "teach",
                    lesson: data.lesson,
                });
            }

            // Next question (after a brief pause for reading)
            if (data.question && data.action !== "discuss") {
                setTimeout(() => {
                    setShowResult(null);
                    store.setCurrentQuestion(data.question as QuestionData);
                }, 1500);
            }

            if (data.action === "wrap_up") {
                store.endSession();
            }
        },
        [store, confidence]
    );

    // ----- DISCUSSION MESSAGE -----
    const handleDiscussionMessage = useCallback(
        async (message: string) => {
            if (!store.sessionId) return;

            setDiscussionMessages((prev) => [
                ...prev,
                { role: "student", content: message },
            ]);

            store.setIsAiThinking(true);

            const result = await learnApi.sendMessage(store.sessionId, message);

            store.setIsAiThinking(false);

            if (!result.success) return;

            const data = result.data;
            setDiscussionMessages((prev) => [
                ...prev,
                { role: "ai", content: data.message },
            ]);

            if (data.discussion_phase) {
                store.setIsInDiscussion(true, data.discussion_phase);
            }

            // Discussion complete → next question
            if (data.ready_to_retry && data.question) {
                store.setIsInDiscussion(false);
                setDiscussionMessages([]);
                setShowResult(null);
                store.setCurrentQuestion(data.question as QuestionData);
                store.addMessage({
                    id: generateId(),
                    role: "ai",
                    content: "Let's try a similar question now that we've talked it through.",
                    timestamp: Date.now(),
                    agent: "discuss",
                });
            }
        },
        [store]
    );

    // ----- HINT REQUEST -----
    const handleRequestHint = useCallback(async () => {
        if (!store.sessionId) return;
        setHintsUsed((h) => h + 1);
        await handleDiscussionMessage("Can you give me a hint?");
    }, [store.sessionId, handleDiscussionMessage]);

    // ----- END SESSION -----
    const handleEndSession = useCallback(async () => {
        if (!store.sessionId) return;
        store.setIsAiThinking(true);

        const result = await learnApi.endSession(store.sessionId);

        store.setIsAiThinking(false);

        if (result.success) {
            const data = result.data;
            store.addMessage({
                id: generateId(),
                role: "ai",
                content: data.message,
                timestamp: Date.now(),
                action: "wrap_up",
                agent: "refine",
            });
            store.endSession();
        }
    }, [store]);

    // ----- IDLE STATE: Topic picker -----
    if (store.phase === "idle") {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-lg space-y-8">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center mx-auto mb-4">
                            <Zap className="w-8 h-8 text-sky-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-100">What do you want to learn?</h1>
                        <p className="text-gray-400 text-sm">
                            Tell me a topic and I&apos;ll create a personalized learning session
                        </p>
                    </div>

                    <div className="space-y-3">
                        <input
                            type="text"
                            value={topicInput}
                            onChange={(e) => setTopicInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleStartSession(topicInput)}
                            placeholder="e.g., Photosynthesis, Binary Search, World War II..."
                            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                            autoFocus
                        />
                        <button
                            onClick={() => handleStartSession(topicInput)}
                            disabled={!topicInput.trim() || store.isLoading}
                            className="w-full py-3 rounded-xl bg-sky-600 text-white font-medium hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            {store.isLoading ? "Starting..." : "Start Learning"}
                        </button>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs text-gray-500 text-center">Quick start:</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {["Photosynthesis", "Python Basics", "Calculus", "Cell Biology", "US History"].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => handleStartSession(t)}
                                    className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
                        <Link
                            href="/feed"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                            <Zap className="w-3.5 h-3.5" />
                            TikTok Mode
                        </Link>
                        <Link
                            href="/feed"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                            <Trophy className="w-3.5 h-3.5" />
                            Compete
                        </Link>
                        <Link
                            href="/feed"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            My Progress
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ----- ACTIVE SESSION -----
    return (
        <div className="min-h-screen bg-gray-950 flex flex-col max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
                <button
                    onClick={() => {
                        if (store.phase !== "ended") {
                            handleEndSession();
                        }
                        store.reset();
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                    <h1 className="text-sm font-semibold text-gray-100">{store.topic}</h1>
                </div>
                {store.phase !== "ended" && (
                    <button
                        onClick={handleEndSession}
                        className="px-3 py-1 rounded-lg bg-gray-800 text-xs text-gray-400 hover:bg-gray-700"
                    >
                        End Session
                    </button>
                )}
            </div>

            {/* Progress bar */}
            <SessionProgress
                questionsAnswered={store.questionsAnswered}
                correctCount={store.correctCount}
                phase={store.phase}
            />

            {/* Chat area */}
            <ChatContainer>
                {store.messages.map((msg) => (
                    <div key={msg.id}>
                        <ChatMessage
                            role={msg.role}
                            content={msg.content}
                            agent={msg.agent}
                            timestamp={msg.timestamp}
                        >
                            {/* Inline lesson */}
                            {msg.action === "teach" && msg.lesson && (
                                <div className="mt-3">
                                    <MicroLesson
                                        title={msg.lesson.title}
                                        content={msg.lesson.content}
                                        concept={msg.lesson.concept}
                                    />
                                </div>
                            )}
                        </ChatMessage>
                    </div>
                ))}

                {/* Current question card */}
                {store.currentQuestion && !store.isInDiscussion && (
                    <div className="space-y-3">
                        <QuestionCard
                            question={store.currentQuestion}
                            onAnswer={handleSubmitAnswer}
                            disabled={store.isAiThinking || !!showResult}
                            showResult={showResult ?? undefined}
                        />
                        {!showResult && (
                            <ConfidenceSlider
                                value={confidence}
                                onChange={setConfidence}
                                disabled={store.isAiThinking}
                            />
                        )}
                    </div>
                )}

                {/* Inline discussion */}
                {store.isInDiscussion && (
                    <DiscussionThread
                        messages={discussionMessages}
                        phase={store.discussionPhase}
                        onSendMessage={handleDiscussionMessage}
                        onRequestHint={handleRequestHint}
                        hintsUsed={hintsUsed}
                        disabled={store.isAiThinking}
                    />
                )}

                {/* AI thinking indicator */}
                {store.isAiThinking && <AiThinkingIndicator />}

                {/* Session ended */}
                {store.phase === "ended" && (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                            <BookOpen className="w-6 h-6 text-emerald-400" />
                        </div>
                        <p className="text-gray-400 text-sm">Session complete!</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => store.reset()}
                                className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-500"
                            >
                                Learn Something New
                            </button>
                            <Link
                                href="/feed"
                                className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:bg-gray-700"
                            >
                                View Progress
                            </Link>
                        </div>
                    </div>
                )}
            </ChatContainer>

            {/* Message input for discussion mode */}
            {store.isInDiscussion && (
                <div className="px-2 pb-2">
                    {/* Input is inside DiscussionThread */}
                </div>
            )}
        </div>
    );
}

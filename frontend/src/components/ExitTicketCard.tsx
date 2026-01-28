"use client";

import { useState } from "react";
import { Check, X, Lightbulb, BookOpen, ChevronDown, ChevronUp, Award, MessageCircle, Image, FileText, ClipboardList, Layers } from "lucide-react";
import MathText from "./MathText";

// Helper component that handles both markdown (bold, italic) and math rendering
function MarkdownMath({ text }: { text: string }) {
    if (!text) return null;

    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Check for bold first (**)
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Check for italic (single *)
        const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

        if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
            // Add text before bold
            if (boldMatch.index! > 0) {
                parts.push(<MathText key={key++} text={remaining.slice(0, boldMatch.index)} />);
            }
            // Add bold text (with math support inside)
            parts.push(
                <strong key={key++} className="font-bold">
                    <MathText text={boldMatch[1] || ""} />
                </strong>
            );
            remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
        } else if (italicMatch) {
            // Add text before italic
            if (italicMatch.index! > 0) {
                parts.push(<MathText key={key++} text={remaining.slice(0, italicMatch.index)} />);
            }
            // Add italic text (with math support inside)
            parts.push(
                <em key={key++} className="italic">
                    <MathText text={italicMatch[1] || ""} />
                </em>
            );
            remaining = remaining.slice(italicMatch.index! + italicMatch[0].length);
        } else {
            // No more markdown, render remaining as MathText
            parts.push(<MathText key={key++} text={remaining} />);
            break;
        }
    }

    return <>{parts}</>;
}

interface PeerDiscussionMessage {
    sender: string;
    content: string;
    has_attachment?: boolean;
    attachment_type?: string;
}

interface PeerDiscussion {
    peer_name: string;
    messages: PeerDiscussionMessage[];
    key_insights?: string[];
    summary?: string;
}

interface StudyNotes {
    key_concepts?: string[];
    common_mistakes?: string[];
    strategies?: string[];
    memory_tips?: string[];
}

interface PracticeQuestion {
    prompt: string;
    options: string[];
    correct_answer: string;
    hint?: string;
    explanation?: string;
    difficulty?: string;
}

interface ExitTicket {
    id: string;
    student_name: string;
    target_concept: string;
    micro_lesson: string;
    encouragement?: string;
    question_prompt: string;
    question_options: string[];
    correct_answer: string;
    hint?: string;
    is_completed: boolean;
    created_at: string;
    student_answer?: string;
    answered_correctly?: boolean;
    peer_discussion?: PeerDiscussion;
    // New comprehensive fields
    study_notes?: StudyNotes;
    practice_questions?: PracticeQuestion[];
    flashcards?: { front: string; back: string }[];
    misconceptions?: { type: string; description: string; correction: string }[];
}

interface ExitTicketCardProps {
    ticket: ExitTicket;
    onAnswer?: (ticketId: string, answer: string) => Promise<{is_correct: boolean; correct_answer: string; hint?: string}>;
    compact?: boolean;
}

export function ExitTicketCard({ ticket, onAnswer, compact = false }: ExitTicketCardProps) {
    const [expanded, setExpanded] = useState(!compact);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{is_correct: boolean; hint?: string} | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [activeTab, setActiveTab] = useState<"notes" | "homework" | "flashcards">("notes");
    const [currentFlashcard, setCurrentFlashcard] = useState(0);
    const [showFlashcardBack, setShowFlashcardBack] = useState(false);
    const [homeworkAnswers, setHomeworkAnswers] = useState<Record<number, string>>({});
    const [homeworkResults, setHomeworkResults] = useState<Record<number, boolean>>({});

    const hasStudyPacket = ticket.study_notes || (ticket.practice_questions && ticket.practice_questions.length > 0) || (ticket.flashcards && ticket.flashcards.length > 0);

    const handleSubmit = async () => {
        if (!selectedAnswer || !onAnswer) return;

        setIsSubmitting(true);
        try {
            const response = await onAnswer(ticket.id, selectedAnswer);
            setResult({ is_correct: response.is_correct, hint: response.hint });
        } catch (err) {
            console.error("Error submitting answer:", err);
        }
        setIsSubmitting(false);
    };

    const isAnswered = ticket.is_completed || result !== null;
    const isCorrect = result?.is_correct ?? ticket.answered_correctly;

    return (
        <div className={`rounded-xl border ${
            isAnswered
                ? isCorrect
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5"
                : "border-gray-700 bg-gray-800"
        } overflow-hidden`}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/30"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                        isAnswered
                            ? isCorrect
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            : "bg-sky-500/20 text-sky-400"
                    }`}>
                        {isAnswered ? (
                            isCorrect ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />
                        ) : (
                            <BookOpen className="h-5 w-5" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{ticket.target_concept}</h3>
                        <p className="text-sm text-gray-400">
                            {new Date(ticket.created_at).toLocaleDateString()}
                            {isAnswered && (
                                <span className={`ml-2 ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                                    {isCorrect ? "Completed" : "Review needed"}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-white p-1">
                    {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
            </div>

            {/* Content */}
            {expanded && (
                <div className="px-4 pb-4 space-y-4">
                    {/* Micro Lesson */}
                    <div className="rounded-lg bg-gray-900 p-4">
                        <div className="flex items-center gap-2 mb-2 text-amber-400">
                            <Lightbulb className="h-4 w-4" />
                            <span className="text-sm font-medium">Quick Lesson</span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">
                            <MarkdownMath text={ticket.micro_lesson || ""} />
                        </p>
                        {ticket.encouragement && (
                            <p className="mt-2 text-sky-400 text-sm italic">{ticket.encouragement}</p>
                        )}
                    </div>

                    {/* Study Packet Tabs */}
                    {hasStudyPacket && (
                        <div className="rounded-lg bg-gray-900 overflow-hidden">
                            {/* Tab Navigation */}
                            <div className="flex border-b border-gray-700">
                                <button
                                    onClick={() => setActiveTab("notes")}
                                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                        activeTab === "notes"
                                            ? "bg-sky-600 text-white"
                                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                                    }`}
                                >
                                    <FileText className="h-4 w-4" />
                                    Notes
                                </button>
                                <button
                                    onClick={() => setActiveTab("homework")}
                                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                        activeTab === "homework"
                                            ? "bg-sky-600 text-white"
                                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                                    }`}
                                >
                                    <ClipboardList className="h-4 w-4" />
                                    Revision
                                    {ticket.practice_questions && (
                                        <span className="bg-gray-700 text-xs px-1.5 py-0.5 rounded">
                                            {ticket.practice_questions.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab("flashcards")}
                                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                        activeTab === "flashcards"
                                            ? "bg-sky-600 text-white"
                                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                                    }`}
                                >
                                    <Layers className="h-4 w-4" />
                                    Flashcards
                                    {ticket.flashcards && (
                                        <span className="bg-gray-700 text-xs px-1.5 py-0.5 rounded">
                                            {ticket.flashcards.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="p-4">
                                {/* Notes Tab */}
                                {activeTab === "notes" && ticket.study_notes && (
                                    <div className="space-y-4">
                                        {ticket.study_notes.key_concepts && ticket.study_notes.key_concepts.length > 0 && (
                                            <div>
                                                <h4 className="text-emerald-400 font-medium text-sm mb-2">Key Concepts</h4>
                                                <ul className="space-y-1">
                                                    {ticket.study_notes.key_concepts.map((concept, i) => (
                                                        <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                                            <span className="text-emerald-400 mt-1">•</span>
                                                            <MarkdownMath text={concept || ""} />
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {ticket.study_notes.common_mistakes && ticket.study_notes.common_mistakes.length > 0 && (
                                            <div>
                                                <h4 className="text-red-400 font-medium text-sm mb-2">Common Mistakes to Avoid</h4>
                                                <ul className="space-y-1">
                                                    {ticket.study_notes.common_mistakes.map((mistake, i) => (
                                                        <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                                            <span className="text-red-400 mt-1">✗</span>
                                                            <MarkdownMath text={mistake || ""} />
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {ticket.study_notes.strategies && ticket.study_notes.strategies.length > 0 && (
                                            <div>
                                                <h4 className="text-sky-400 font-medium text-sm mb-2">Problem-Solving Strategies</h4>
                                                <ul className="space-y-1">
                                                    {ticket.study_notes.strategies.map((strategy, i) => (
                                                        <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                                            <span className="text-sky-400 mt-1">{i + 1}.</span>
                                                            <MarkdownMath text={strategy || ""} />
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {ticket.study_notes.memory_tips && ticket.study_notes.memory_tips.length > 0 && (
                                            <div>
                                                <h4 className="text-amber-400 font-medium text-sm mb-2">Memory Tips</h4>
                                                <ul className="space-y-1">
                                                    {ticket.study_notes.memory_tips.map((tip, i) => (
                                                        <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                                            <span className="text-amber-400 mt-1">💡</span>
                                                            <MarkdownMath text={tip || ""} />
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {(!ticket.study_notes.key_concepts?.length && !ticket.study_notes.common_mistakes?.length &&
                                          !ticket.study_notes.strategies?.length && !ticket.study_notes.memory_tips?.length) && (
                                            <p className="text-gray-500 text-sm text-center py-4">No study notes available</p>
                                        )}
                                    </div>
                                )}

                                {/* Homework Tab */}
                                {activeTab === "homework" && (
                                    <div className="space-y-4">
                                        {ticket.practice_questions && ticket.practice_questions.length > 0 ? (
                                            ticket.practice_questions.map((q, qIndex) => (
                                                <div key={qIndex} className="rounded-lg bg-gray-800 p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="bg-sky-600 text-white text-xs px-2 py-0.5 rounded">
                                                            Q{qIndex + 1}
                                                        </span>
                                                        {q.difficulty && (
                                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                                q.difficulty === "easy" ? "bg-emerald-500/20 text-emerald-400" :
                                                                q.difficulty === "medium" ? "bg-amber-500/20 text-amber-400" :
                                                                "bg-red-500/20 text-red-400"
                                                            }`}>
                                                                {q.difficulty}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-white text-sm mb-3">
                                                        <MarkdownMath text={q.prompt || ""} />
                                                    </p>
                                                    <div className="space-y-2">
                                                        {q.options.map((opt, optIndex) => {
                                                            const optLetter = opt.charAt(0);
                                                            const isSelected = homeworkAnswers[qIndex] === optLetter;
                                                            const isAnswered = homeworkResults[qIndex] !== undefined;
                                                            const isCorrectOpt = q.correct_answer === optLetter;

                                                            return (
                                                                <button
                                                                    key={optIndex}
                                                                    onClick={() => {
                                                                        if (!isAnswered) {
                                                                            setHomeworkAnswers(prev => ({ ...prev, [qIndex]: optLetter }));
                                                                            setHomeworkResults(prev => ({ ...prev, [qIndex]: optLetter === q.correct_answer }));
                                                                        }
                                                                    }}
                                                                    disabled={isAnswered}
                                                                    className={`w-full text-left p-2 rounded-lg border text-sm transition-colors ${
                                                                        isAnswered
                                                                            ? isCorrectOpt
                                                                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                                                                : isSelected
                                                                                ? "border-red-500 bg-red-500/10 text-red-400"
                                                                                : "border-gray-700 bg-gray-900 text-gray-400"
                                                                            : isSelected
                                                                            ? "border-sky-500 bg-sky-500/10 text-sky-400"
                                                                            : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
                                                                    }`}
                                                                >
                                                                    <MarkdownMath text={opt || ""} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {homeworkResults[qIndex] !== undefined && q.explanation && (
                                                        <div className="mt-3 p-2 rounded bg-gray-900 border border-gray-700">
                                                            <p className="text-gray-400 text-xs mb-1">Explanation:</p>
                                                            <p className="text-gray-300 text-sm">
                                                                <MarkdownMath text={q.explanation || ""} />
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 text-sm text-center py-4">No revision questions available</p>
                                        )}
                                    </div>
                                )}

                                {/* Flashcards Tab */}
                                {activeTab === "flashcards" && (
                                    <div>
                                        {ticket.flashcards && ticket.flashcards.length > 0 ? (
                                            <div className="space-y-4">
                                                <div
                                                    onClick={() => setShowFlashcardBack(!showFlashcardBack)}
                                                    className="cursor-pointer min-h-[150px] rounded-lg bg-gradient-to-br from-sky-600 to-purple-600 p-6 flex items-center justify-center text-center transition-transform hover:scale-[1.02]"
                                                >
                                                    <div>
                                                        <p className="text-xs text-white/70 mb-2">
                                                            {showFlashcardBack ? "ANSWER" : "QUESTION"} • Tap to flip
                                                        </p>
                                                        <p className="text-white font-medium">
                                                            <MarkdownMath text={
                                                                showFlashcardBack
                                                                    ? ticket.flashcards[currentFlashcard]?.back || ""
                                                                    : ticket.flashcards[currentFlashcard]?.front || ""
                                                            } />
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <button
                                                        onClick={() => {
                                                            setCurrentFlashcard(prev => Math.max(0, prev - 1));
                                                            setShowFlashcardBack(false);
                                                        }}
                                                        disabled={currentFlashcard === 0}
                                                        className="px-4 py-2 rounded-lg bg-gray-800 text-white disabled:opacity-50"
                                                    >
                                                        Previous
                                                    </button>
                                                    <span className="text-gray-400 text-sm">
                                                        {currentFlashcard + 1} / {ticket.flashcards.length}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            setCurrentFlashcard(prev => Math.min(ticket.flashcards!.length - 1, prev + 1));
                                                            setShowFlashcardBack(false);
                                                        }}
                                                        disabled={currentFlashcard === ticket.flashcards.length - 1}
                                                        className="px-4 py-2 rounded-lg bg-gray-800 text-white disabled:opacity-50"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 text-sm text-center py-4">No flashcards available</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Peer Discussion (if available) */}
                    {ticket.peer_discussion && ticket.peer_discussion.messages.length > 0 && (
                        <div className="rounded-lg bg-gray-900 p-4">
                            <div className="flex items-center gap-2 mb-3 text-sky-400">
                                <MessageCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Your Discussion with {ticket.peer_discussion.peer_name}</span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {ticket.peer_discussion.messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                                            msg.sender === 'student'
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-gray-700 text-gray-200'
                                        }`}>
                                            {msg.has_attachment && (
                                                <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                                                    <Image className="h-3 w-3" />
                                                    {msg.attachment_type === 'pdf' ? 'PDF' : 'Image'} attached
                                                </div>
                                            )}
                                            <MarkdownMath text={msg.content || ""} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {ticket.peer_discussion.key_insights && ticket.peer_discussion.key_insights.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-700">
                                    <p className="text-xs text-gray-400 mb-1">Key Insights:</p>
                                    <ul className="text-xs text-gray-300 space-y-1">
                                        {ticket.peer_discussion.key_insights.map((insight, i) => (
                                            <li key={i} className="flex items-start gap-1">
                                                <span className="text-emerald-400">•</span> <MarkdownMath text={insight || ""} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Follow-up Question */}
                    <div className="space-y-3">
                        <p className="text-white font-medium">
                            <MarkdownMath text={ticket.question_prompt || ""} />
                        </p>

                        <div className="space-y-2">
                            {ticket.question_options.map((option, i) => {
                                const optionLetter = option.charAt(0);
                                const isSelected = selectedAnswer === optionLetter || ticket.student_answer === optionLetter;
                                const isCorrectOption = ticket.correct_answer === optionLetter;
                                const showCorrectness = isAnswered && (isSelected || isCorrectOption);

                                return (
                                    <button
                                        key={i}
                                        onClick={() => !isAnswered && setSelectedAnswer(optionLetter)}
                                        disabled={isAnswered}
                                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                            showCorrectness
                                                ? isCorrectOption
                                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                                    : isSelected && !isCorrect
                                                    ? "border-red-500 bg-red-500/10 text-red-400"
                                                    : "border-gray-700 bg-gray-800 text-gray-300"
                                                : isSelected
                                                ? "border-sky-500 bg-sky-500/10 text-sky-400"
                                                : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600"
                                        } ${isAnswered ? "cursor-default" : "cursor-pointer"}`}
                                    >
                                        <span className="text-sm">
                                            <MarkdownMath text={option || ""} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Submit Button or Result */}
                        {!isAnswered && onAnswer && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSubmit}
                                    disabled={!selectedAnswer || isSubmitting}
                                    className="flex-1 py-2 px-4 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? "Checking..." : "Check Answer"}
                                </button>
                                {ticket.hint && (
                                    <button
                                        onClick={() => setShowHint(!showHint)}
                                        className="py-2 px-4 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500"
                                    >
                                        Hint
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Hint */}
                        {(showHint || (result && !result.is_correct)) && ticket.hint && (
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <p className="text-amber-400 text-sm">
                                    <Lightbulb className="inline h-4 w-4 mr-1" />
                                    <MarkdownMath text={ticket.hint || ""} />
                                </p>
                            </div>
                        )}

                        {/* Result */}
                        {result && (
                            <div className={`p-3 rounded-lg flex items-center gap-2 ${
                                result.is_correct
                                    ? "bg-emerald-500/10 border border-emerald-500/30"
                                    : "bg-red-500/10 border border-red-500/30"
                            }`}>
                                {result.is_correct ? (
                                    <>
                                        <Award className="h-5 w-5 text-emerald-400" />
                                        <span className="text-emerald-400 font-medium">Excellent! You got it right!</span>
                                    </>
                                ) : (
                                    <>
                                        <X className="h-5 w-5 text-red-400" />
                                        <span className="text-red-400">Not quite. The correct answer is {ticket.correct_answer}.</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

interface ExitTicketListProps {
    tickets: ExitTicket[];
    onAnswer?: (ticketId: string, answer: string) => Promise<{is_correct: boolean; correct_answer: string; hint?: string}>;
}

export function ExitTicketList({ tickets, onAnswer }: ExitTicketListProps) {
    if (tickets.length === 0) {
        return (
            <div className="text-center py-8 text-gray-400">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No exit tickets yet.</p>
                <p className="text-sm">Complete a quiz to get personalized lessons!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {tickets.map((ticket) => (
                <ExitTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onAnswer={onAnswer}
                    compact={tickets.length > 3}
                />
            ))}
        </div>
    );
}

"use client";

import { useState } from "react";
import { Check, X, Lightbulb, BookOpen, ChevronDown, ChevronUp, Award } from "lucide-react";

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
                        <p className="text-gray-300 text-sm leading-relaxed">{ticket.micro_lesson}</p>
                        {ticket.encouragement && (
                            <p className="mt-2 text-sky-400 text-sm italic">{ticket.encouragement}</p>
                        )}
                    </div>

                    {/* Follow-up Question */}
                    <div className="space-y-3">
                        <p className="text-white font-medium">{ticket.question_prompt}</p>

                        <div className="space-y-2">
                            {ticket.question_options.map((option, i) => {
                                const optionLetter = option[0];
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
                                        <span className="text-sm">{option}</span>
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
                                    {ticket.hint}
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

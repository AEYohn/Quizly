"use client";

import { useState, useCallback, useEffect } from "react";
import { Star, Check, Brain, SkipForward, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";

interface SelfRatingItem {
    concept: string;
    topic_id: string;
    unit_name: string;
}

interface DiagnosticQuestion {
    question: string;
    options: string[];
    concept: string;
}

interface FamiliarityAssessmentProps {
    subject: string;
    phase: "self_rating" | "diagnostic" | "complete";
    selfRatingItems?: SelfRatingItem[];
    diagnosticQuestions?: DiagnosticQuestion[];
    onSubmitSelfRatings?: (ratings: Array<{ concept: string; rating: number }>) => void;
    onSubmitDiagnostic?: (answers: Array<{ concept: string; answer: string }>) => void;
    onSkip?: () => void;
    onComplete?: () => void;
    isLoading?: boolean;
}

const RATING_LABELS: Record<number, string> = {
    1: "Never heard of it",
    2: "Heard of it",
    3: "Can explain basics",
    4: "Can apply it",
    5: "Can teach it",
};

const OPTION_LETTERS = ["A", "B", "C", "D"];

export function FamiliarityAssessment({
    subject,
    phase,
    selfRatingItems = [],
    diagnosticQuestions = [],
    onSubmitSelfRatings,
    onSubmitDiagnostic,
    onSkip,
    onComplete,
    isLoading = false,
}: FamiliarityAssessmentProps) {
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [diagnosticAnswers, setDiagnosticAnswers] = useState<
        Array<{ concept: string; answer: string }>
    >([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const ratedCount = Object.keys(ratings).length;
    const totalConcepts = selfRatingItems.length;
    const allRated = totalConcepts > 0 && ratedCount === totalConcepts;

    const handleRate = useCallback((concept: string, rating: number) => {
        setRatings((prev) => ({ ...prev, [concept]: rating }));
    }, []);

    const handleSubmitRatings = useCallback(() => {
        if (!allRated || !onSubmitSelfRatings) return;
        const ratingsArray = Object.entries(ratings).map(([concept, rating]) => ({
            concept,
            rating,
        }));
        onSubmitSelfRatings(ratingsArray);
    }, [allRated, ratings, onSubmitSelfRatings]);

    const handleSelectDiagnosticOption = useCallback(
        (option: string) => {
            if (selectedOption !== null) return;
            const currentQuestion = diagnosticQuestions[currentQuestionIndex];
            if (!currentQuestion) return;

            setSelectedOption(option);

            const newAnswers = [
                ...diagnosticAnswers,
                { concept: currentQuestion.concept, answer: option },
            ];
            setDiagnosticAnswers(newAnswers);
        },
        [selectedOption, diagnosticQuestions, currentQuestionIndex, diagnosticAnswers]
    );

    // Auto-advance after selecting a diagnostic option
    useEffect(() => {
        if (selectedOption === null) return;

        const timer = setTimeout(() => {
            const nextIndex = currentQuestionIndex + 1;
            if (nextIndex < diagnosticQuestions.length) {
                setCurrentQuestionIndex(nextIndex);
                setSelectedOption(null);
            } else {
                // All questions answered, submit
                const currentQuestion = diagnosticQuestions[currentQuestionIndex];
                if (currentQuestion && onSubmitDiagnostic) {
                    const finalAnswers = [
                        ...diagnosticAnswers.slice(0, -1),
                        ...diagnosticAnswers.slice(-1),
                    ];
                    onSubmitDiagnostic(finalAnswers);
                }
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [
        selectedOption,
        currentQuestionIndex,
        diagnosticQuestions,
        diagnosticAnswers,
        onSubmitDiagnostic,
    ]);

    // Group self-rating items by unit_name
    const groupedByUnit = selfRatingItems.reduce<Record<string, SelfRatingItem[]>>(
        (groups, item) => {
            const key = item.unit_name;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        },
        {}
    );

    // ─── Phase: Self Rating ───────────────────────────────────────────────

    if (phase === "self_rating") {
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0F0F0F] to-[#131313] overflow-y-auto">
                <div className="min-h-full flex flex-col items-center px-4 py-8">
                    {/* Header */}
                    <div className="text-center mb-8 max-w-lg">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-400/20 mb-4">
                            <Brain className="w-7 h-7 text-teal-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            How familiar are you with {subject}?
                        </h1>
                        <p className="text-sm text-teal-300/70">
                            Rate your familiarity with each concept so we can personalize your
                            learning path.
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full max-w-lg mb-6">
                        <div className="flex items-center justify-between text-xs text-teal-300/60 mb-2">
                            <span>
                                {ratedCount} of {totalConcepts} rated
                            </span>
                            <span>
                                {totalConcepts > 0
                                    ? Math.round((ratedCount / totalConcepts) * 100)
                                    : 0}
                                %
                            </span>
                        </div>
                        <div className="h-1.5 bg-neutral-900/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${totalConcepts > 0 ? (ratedCount / totalConcepts) * 100 : 0}%`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Concept Groups */}
                    <div className="w-full max-w-lg space-y-6 mb-8">
                        {Object.entries(groupedByUnit).map(([unitName, items]) => (
                            <div
                                key={unitName}
                                className="bg-neutral-900/50 border border-teal-400/15 rounded-2xl p-5"
                            >
                                <h2 className="text-sm font-semibold text-teal-300 mb-4">
                                    {unitName}
                                </h2>
                                <div className="space-y-4">
                                    {items.map((item) => (
                                        <div key={item.topic_id}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-gray-200 font-medium">
                                                    {item.concept}
                                                </span>
                                                {ratings[item.concept] != null && (
                                                    <span className="text-xs text-teal-400/70">
                                                        {RATING_LABELS[ratings[item.concept]!]}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4, 5].map((level) => (
                                                    <button
                                                        key={level}
                                                        onClick={() =>
                                                            handleRate(item.concept, level)
                                                        }
                                                        className={cn(
                                                            "flex-1 py-2 rounded-lg text-xs font-medium transition-all border",
                                                            ratings[item.concept] === level
                                                                ? "bg-teal-500 text-white border-teal-400 shadow-lg shadow-teal-500/20"
                                                                : "bg-neutral-900/30 text-teal-300/60 border-teal-400/20 hover:border-teal-400/40 hover:text-teal-200"
                                                        )}
                                                        title={RATING_LABELS[level]}
                                                    >
                                                        {level}
                                                    </button>
                                                ))}
                                            </div>
                                            {/* Rating scale labels for first concept in each group */}
                                            {items.indexOf(item) === 0 && (
                                                <div className="flex justify-between mt-1.5 px-1">
                                                    <span className="text-[10px] text-teal-400/40">
                                                        Never heard of it
                                                    </span>
                                                    <span className="text-[10px] text-teal-400/40">
                                                        Can teach it
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="w-full max-w-lg space-y-3">
                        <button
                            onClick={handleSubmitRatings}
                            disabled={!allRated || isLoading}
                            className={cn(
                                "w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                allRated
                                    ? "bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/25"
                                    : "bg-neutral-900/50 text-teal-400/40 border border-teal-400/10 cursor-not-allowed"
                            )}
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Continue to Quiz
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>

                        {onSkip && (
                            <button
                                onClick={onSkip}
                                disabled={isLoading}
                                className="w-full py-2 text-xs text-teal-400/50 hover:text-teal-300 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <SkipForward className="w-3.5 h-3.5" />
                                Skip Assessment
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Phase: Diagnostic ────────────────────────────────────────────────

    if (phase === "diagnostic") {
        const currentQuestion = diagnosticQuestions[currentQuestionIndex];
        const totalQuestions = diagnosticQuestions.length;

        if (!currentQuestion) return null;

        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0F0F0F] to-[#131313] overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
                    {/* Header */}
                    <div className="text-center mb-8 max-w-lg">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-400/20 mb-4">
                            <Star className="w-7 h-7 text-teal-400" />
                        </div>
                        <h1 className="text-xl font-bold text-white mb-1">
                            Quick Diagnostic Quiz
                        </h1>
                        <p className="text-sm text-teal-300/60">
                            Answer a few questions to fine-tune your starting point.
                        </p>
                    </div>

                    {/* Progress Indicator */}
                    <div className="w-full max-w-md mb-6">
                        <div className="flex items-center justify-between text-xs text-teal-300/60 mb-2">
                            <span>
                                Question {currentQuestionIndex + 1} of {totalQuestions}
                            </span>
                            <span className="text-xs text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                                {currentQuestion.concept}
                            </span>
                        </div>
                        <div className="flex gap-1">
                            {diagnosticQuestions.map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex-1 h-1 rounded-full transition-all duration-300",
                                        i < currentQuestionIndex
                                            ? "bg-teal-400"
                                            : i === currentQuestionIndex
                                              ? "bg-teal-500"
                                              : "bg-neutral-900/50"
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Question Card */}
                    <div className="w-full max-w-md bg-neutral-900/50 border border-teal-400/15 rounded-2xl p-6">
                        <p className="text-gray-100 text-sm leading-relaxed font-medium mb-5">
                            {currentQuestion.question}
                        </p>

                        <div className="space-y-2.5">
                            {currentQuestion.options.map((option, optIdx) => {
                                const letter = OPTION_LETTERS[optIdx] ?? String(optIdx);
                                const isSelected = selectedOption === option;

                                return (
                                    <button
                                        key={optIdx}
                                        onClick={() => handleSelectDiagnosticOption(option)}
                                        disabled={selectedOption !== null || isLoading}
                                        className={cn(
                                            "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center gap-3",
                                            isSelected
                                                ? "border-teal-400 bg-teal-500/20 ring-1 ring-teal-400"
                                                : "border-teal-400/20 bg-neutral-900/30 hover:border-teal-400/40 hover:bg-teal-900/30",
                                            selectedOption !== null &&
                                                !isSelected &&
                                                "opacity-40"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border transition-all",
                                                isSelected
                                                    ? "bg-teal-500 text-white border-teal-400"
                                                    : "bg-neutral-900/50 text-teal-300/60 border-teal-400/20"
                                            )}
                                        >
                                            {letter}
                                        </span>
                                        <span className="text-gray-200">{option}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {isLoading && (
                        <div className="mt-6 flex items-center gap-2 text-xs text-teal-300/50">
                            <div className="w-3.5 h-3.5 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
                            Submitting answers...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── Phase: Complete ──────────────────────────────────────────────────

    if (phase === "complete") {
        return (
            <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0F0F0F] to-[#131313] overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
                    <div className="text-center max-w-md">
                        {/* Checkmark Animation */}
                        <div className="relative inline-flex items-center justify-center mb-6">
                            <div className="absolute w-24 h-24 rounded-full bg-emerald-500/10 animate-ping" />
                            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-[scale-in_0.5s_ease-out]">
                                <Check className="w-10 h-10 text-white" strokeWidth={3} />
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-3">
                            Assessment Complete!
                        </h1>
                        <p className="text-sm text-teal-300/70 mb-8 leading-relaxed">
                            We&apos;ve calibrated your starting point for{" "}
                            <span className="text-teal-300 font-medium">{subject}</span>.
                            Your learning path has been personalized based on your responses.
                        </p>

                        <button
                            onClick={onComplete}
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/25"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Start Learning
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

"use client";

import { useState } from "react";
import {
    BookOpen,
    CheckCircle2,
    XCircle,
    ArrowRight,
    SkipForward,
    Sparkles,
    RefreshCw,
    Target,
    Brain,
} from "lucide-react";

interface PracticeQuestion {
    id: string;
    question_text: string;
    options: { [key: string]: string };
    correct_answer: string;
    explanation: string;
    concept: string;
}

interface PracticeRecommendationsProps {
    weakConcepts: string[];
    questions: PracticeQuestion[];
    onComplete: (results: { practiced: number; correct: number }) => void;
    onSkip: () => void;
}

export default function PracticeRecommendations({
    weakConcepts,
    questions,
    onComplete,
    onSkip,
}: PracticeRecommendationsProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [results, setResults] = useState<{ practiced: number; correct: number }>({
        practiced: 0,
        correct: 0,
    });

    const currentQuestion = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;

    const handleAnswerSelect = (answer: string) => {
        if (showResult) return;
        setSelectedAnswer(answer);
    };

    const handleSubmit = () => {
        if (!selectedAnswer || !currentQuestion) return;

        const isCorrect = selectedAnswer === currentQuestion.correct_answer;
        setShowResult(true);
        setResults((prev) => ({
            practiced: prev.practiced + 1,
            correct: prev.correct + (isCorrect ? 1 : 0),
        }));
    };

    const handleNext = () => {
        if (isLastQuestion) {
            onComplete(results);
        } else {
            setCurrentIndex((prev) => prev + 1);
            setSelectedAnswer(null);
            setShowResult(false);
        }
    };

    if (questions.length === 0) {
        return (
            <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Great Job!</h3>
                <p className="text-gray-400 mb-6">No weak areas identified. Keep up the good work!</p>
                <button
                    onClick={() => onComplete({ practiced: 0, correct: 0 })}
                    className="rounded-xl bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-700"
                >
                    Continue
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-teal-500/20 mb-3">
                    <Target className="h-6 w-6 text-teal-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Practice Recommendations</h2>
                <p className="text-sm text-gray-400">
                    Based on your performance, here are some areas to strengthen
                </p>
            </div>

            {/* Weak Concepts Tags */}
            {weakConcepts.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                    {weakConcepts.map((concept, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-3 py-1 text-xs text-orange-400 border border-orange-500/30"
                        >
                            <Brain className="h-3 w-3" />
                            {concept}
                        </span>
                    ))}
                </div>
            )}

            {/* Progress */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>Question {currentIndex + 1} of {questions.length}</span>
                    <span>{results.correct} correct so far</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${((currentIndex + (showResult ? 1 : 0)) / questions.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Question Card */}
            {currentQuestion && (
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 mb-4">
                    <div className="mb-4">
                        <span className="inline-block rounded-full bg-teal-500/20 px-2.5 py-1 text-xs text-teal-400 mb-3">
                            {currentQuestion.concept}
                        </span>
                        <p className="text-white font-medium">{currentQuestion.question_text}</p>
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                        {Object.entries(currentQuestion.options).map(([key, value]) => {
                            const isSelected = selectedAnswer === key;
                            const isCorrect = key === currentQuestion.correct_answer;
                            const showCorrectness = showResult;

                            let bgColor = "bg-gray-800 hover:bg-gray-700";
                            let borderColor = "border-gray-700";
                            let textColor = "text-white";

                            if (showCorrectness) {
                                if (isCorrect) {
                                    bgColor = "bg-green-500/20";
                                    borderColor = "border-green-500";
                                    textColor = "text-green-400";
                                } else if (isSelected && !isCorrect) {
                                    bgColor = "bg-red-500/20";
                                    borderColor = "border-red-500";
                                    textColor = "text-red-400";
                                }
                            } else if (isSelected) {
                                bgColor = "bg-teal-500/20";
                                borderColor = "border-teal-500";
                            }

                            return (
                                <button
                                    key={key}
                                    onClick={() => handleAnswerSelect(key)}
                                    disabled={showResult}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${bgColor} ${borderColor} ${
                                        showResult ? "cursor-default" : "cursor-pointer"
                                    }`}
                                >
                                    <span className={`font-mono font-bold ${textColor}`}>{key}</span>
                                    <span className={`flex-1 text-left text-sm ${textColor}`}>{value}</span>
                                    {showCorrectness && isCorrect && (
                                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                                    )}
                                    {showCorrectness && isSelected && !isCorrect && (
                                        <XCircle className="h-5 w-5 text-red-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Explanation */}
                    {showResult && (
                        <div className="mt-4 p-3 rounded-lg bg-sky-500/10 border border-sky-500/30">
                            <div className="flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-300">{currentQuestion.explanation}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                {!showResult ? (
                    <>
                        <button
                            onClick={onSkip}
                            className="flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-3 text-gray-400 hover:bg-gray-800 transition-colors"
                        >
                            <SkipForward className="h-4 w-4" />
                            Skip Practice
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedAnswer}
                            className="flex-1 rounded-xl bg-teal-600 py-3 font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Check Answer
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleNext}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 font-medium text-white hover:bg-sky-700 transition-colors"
                    >
                        {isLastQuestion ? (
                            <>
                                <CheckCircle2 className="h-5 w-5" />
                                Finish Practice
                            </>
                        ) : (
                            <>
                                Next Question
                                <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Skip Option */}
            {!showResult && (
                <p className="text-center text-xs text-gray-500 mt-4">
                    Practice is optional but recommended for improvement
                </p>
            )}
        </div>
    );
}

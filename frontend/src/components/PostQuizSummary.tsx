"use client";

import { useState, useEffect } from "react";
import {
    Trophy,
    Target,
    Brain,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle2,
    BarChart3,
    Sparkles,
} from "lucide-react";

interface QuadrantData {
    confident_correct: number;
    confident_incorrect: number;
    uncertain_correct: number;
    uncertain_incorrect: number;
}

interface CalibrationData {
    status: "overconfident" | "underconfident" | "well_calibrated";
    gap: number;
    message: string;
}

interface PostQuizSummaryProps {
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    rank?: number;
    totalPlayers?: number;
    accuracy: number;
    avgConfidence?: number;
    quadrants?: QuadrantData;
    calibration?: CalibrationData;
    misconceptionCount?: number;
    onContinue: () => void;
}

export default function PostQuizSummary({
    score,
    totalQuestions,
    correctAnswers,
    rank,
    totalPlayers,
    accuracy,
    avgConfidence = 0,
    quadrants,
    calibration,
    misconceptionCount = 0,
    onContinue,
}: PostQuizSummaryProps) {
    const [animatedScore, setAnimatedScore] = useState(0);
    const [showDetails, setShowDetails] = useState(false);

    // Animate score on mount
    useEffect(() => {
        const duration = 1500;
        const steps = 60;
        const increment = score / steps;
        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= score) {
                setAnimatedScore(score);
                clearInterval(timer);
                setTimeout(() => setShowDetails(true), 300);
            } else {
                setAnimatedScore(Math.floor(current));
            }
        }, duration / steps);
        return () => clearInterval(timer);
    }, [score]);

    const getPerformanceLevel = () => {
        if (accuracy >= 90) return { label: "Excellent!", color: "text-green-400", bg: "bg-green-500" };
        if (accuracy >= 70) return { label: "Great Job!", color: "text-sky-400", bg: "bg-sky-500" };
        if (accuracy >= 50) return { label: "Good Effort!", color: "text-yellow-400", bg: "bg-yellow-500" };
        return { label: "Keep Practicing!", color: "text-orange-400", bg: "bg-orange-500" };
    };

    const performance = getPerformanceLevel();

    const getCalibrationIcon = () => {
        if (!calibration) return null;
        switch (calibration.status) {
            case "overconfident":
                return <TrendingDown className="h-5 w-5 text-orange-400" />;
            case "underconfident":
                return <TrendingUp className="h-5 w-5 text-sky-400" />;
            default:
                return <CheckCircle2 className="h-5 w-5 text-green-400" />;
        }
    };

    return (
        <div className="max-w-lg mx-auto">
            {/* Score Display */}
            <div className="text-center mb-8">
                <div className="mb-4">
                    <Trophy className={`h-16 w-16 mx-auto ${performance.color} animate-bounce`} />
                </div>
                <h2 className={`text-3xl font-bold ${performance.color} mb-2`}>
                    {performance.label}
                </h2>
                <div className="text-6xl font-bold text-white mb-2">
                    {animatedScore.toLocaleString()}
                </div>
                <p className="text-gray-400">points</p>

                {rank && totalPlayers && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2 border border-gray-700">
                        <span className="text-yellow-400 font-bold">#{rank}</span>
                        <span className="text-gray-400">of {totalPlayers} players</span>
                    </div>
                )}
            </div>

            {/* Performance Breakdown */}
            {showDetails && (
                <div className="space-y-4 animate-fadeIn">
                    {/* Accuracy Bar */}
                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400 flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                Accuracy
                            </span>
                            <span className={`font-bold ${performance.color}`}>{accuracy}%</span>
                        </div>
                        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${performance.bg}`}
                                style={{ width: `${accuracy}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {correctAnswers} of {totalQuestions} questions correct
                        </p>
                    </div>

                    {/* Confidence Calibration */}
                    {calibration && (
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                            <div className="flex items-start gap-3">
                                {getCalibrationIcon()}
                                <div className="flex-1">
                                    <h3 className="text-sm font-medium text-white mb-1">
                                        Confidence Calibration
                                    </h3>
                                    <p className="text-xs text-gray-400">{calibration.message}</p>
                                    {avgConfidence > 0 && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Avg Confidence:</span>
                                            <span className="text-xs font-medium text-white">{Math.round(avgConfidence)}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quadrant Summary */}
                    {quadrants && (
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                                <Brain className="h-4 w-4 text-purple-400" />
                                Learning Analysis
                            </h3>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                                    <p className="text-green-400 font-medium">{quadrants.confident_correct}</p>
                                    <p className="text-gray-400">Confident & Correct</p>
                                </div>
                                <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30">
                                    <p className="text-sky-400 font-medium">{quadrants.uncertain_correct}</p>
                                    <p className="text-gray-400">Lucky Guesses</p>
                                </div>
                                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                                    <p className="text-red-400 font-medium">{quadrants.confident_incorrect}</p>
                                    <p className="text-gray-400">Misconceptions</p>
                                </div>
                                <div className="p-2 rounded-lg bg-gray-500/10 border border-gray-500/30">
                                    <p className="text-gray-400 font-medium">{quadrants.uncertain_incorrect}</p>
                                    <p className="text-gray-400">Knowledge Gaps</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Misconception Alert */}
                    {misconceptionCount > 0 && (
                        <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0" />
                                <div>
                                    <h3 className="text-sm font-medium text-orange-400 mb-1">
                                        {misconceptionCount} Misconception{misconceptionCount > 1 ? "s" : ""} Detected
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        You were confident but incorrect on some questions. Let's review these concepts.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Continue Button */}
                    <button
                        onClick={onContinue}
                        className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-purple-500 py-4 font-bold text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                        <Sparkles className="h-5 w-5" />
                        Continue to Exit Ticket
                    </button>
                </div>
            )}

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
}

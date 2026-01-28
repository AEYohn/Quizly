"use client";

import { useState, useEffect } from "react";
import { Trophy, Check, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PostQuizSummaryProps {
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    rank?: number;
    totalPlayers?: number;
    accuracy: number;
    avgConfidence?: number;
    quadrants?: {
        confident_correct: number;
        confident_incorrect: number;
        uncertain_correct: number;
        uncertain_incorrect: number;
    };
    calibration?: {
        status: "overconfident" | "underconfident" | "well_calibrated";
        gap: number;
        message: string;
    };
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
    calibration,
    onContinue,
}: PostQuizSummaryProps) {
    const [animatedScore, setAnimatedScore] = useState(0);
    const [showDetails, setShowDetails] = useState(false);
    const [showTrophy, setShowTrophy] = useState(false);

    // Determine performance level
    const getPerformanceLabel = () => {
        if (accuracy >= 90) return "Excellent!";
        if (accuracy >= 70) return "Good job!";
        if (accuracy >= 50) return "Keep practicing";
        return "Room to grow";
    };

    // Animate score on mount
    useEffect(() => {
        // Show trophy first
        setTimeout(() => setShowTrophy(true), 100);

        const duration = 1000;
        const steps = 40;
        const increment = score / steps;
        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= score) {
                setAnimatedScore(score);
                clearInterval(timer);
                setTimeout(() => setShowDetails(true), 200);
            } else {
                setAnimatedScore(Math.floor(current));
            }
        }, duration / steps);
        return () => clearInterval(timer);
    }, [score]);

    return (
        <div className="w-full max-w-sm mx-auto text-center px-4">
            {/* Trophy Icon with bounce animation */}
            <div className={`mb-6 transition-all duration-500 ${showTrophy ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}>
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                    <Trophy className="h-10 w-10 text-white" />
                </div>
            </div>

            {/* Performance Label */}
            <p className="text-gray-400 text-lg mb-2">{getPerformanceLabel()}</p>

            {/* Score */}
            <div className="mb-8">
                <div className="text-6xl font-bold text-white mb-2">
                    {animatedScore.toLocaleString()}
                </div>
                <p className="text-gray-500">points</p>
            </div>

            {/* Details Section */}
            {showDetails && (
                <div className="space-y-3 animate-fadeIn w-full">
                    {/* Accuracy Card */}
                    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-gray-400">Accuracy</span>
                            <span className="text-xl font-bold text-white">{accuracy}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gray-400 rounded-full transition-all duration-700"
                                style={{ width: `${accuracy}%` }}
                            />
                        </div>
                        <p className="text-sm text-gray-500 mt-4">
                            {correctAnswers} of {totalQuestions} correct
                        </p>
                    </div>

                    {/* Rank Card - only show if rank exists */}
                    {rank && (
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Your Rank</span>
                                <span className="text-xl font-bold text-white">
                                    #{rank}
                                    {totalPlayers && <span className="text-gray-500 text-base font-normal"> of {totalPlayers}</span>}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Calibration Insight - show if available */}
                    {calibration && (
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                            <div className="flex items-center gap-3">
                                {calibration.status === "overconfident" && (
                                    <TrendingDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                )}
                                {calibration.status === "underconfident" && (
                                    <TrendingUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                )}
                                {calibration.status === "well_calibrated" && (
                                    <Minus className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                )}
                                <p className="text-gray-300 text-sm text-left">{calibration.message}</p>
                            </div>
                        </div>
                    )}

                    {/* Continue Button */}
                    <button
                        onClick={onContinue}
                        className="w-full rounded-xl bg-gray-200 text-gray-900 py-4 font-semibold hover:bg-white transition-colors mt-3"
                    >
                        Continue
                    </button>
                </div>
            )}

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
}

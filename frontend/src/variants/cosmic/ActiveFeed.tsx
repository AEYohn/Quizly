"use client";

import { ArrowLeft, BarChart3, Settings2, Zap } from "lucide-react";
import { cn } from "~/lib/utils";
import { SocraticOverlay, AnalyticsOverlay } from "~/components/shared";
import { FlashcardCard } from "~/components/learning/FlashcardCard";
import { InfoCardComponent } from "~/components/learning/InfoCardComponent";
import { ResourceCardComponent } from "~/components/learning/ResourceCardComponent";
import { FeedTuneControls } from "~/components/feed/FeedTuneControls";
import { BottomSheet } from "~/components/feed/BottomSheet";
import { CosmicQuizCard } from "./QuizCard";
import type { ActiveFeedProps } from "~/variants/contracts";

export function ActiveFeed({
    currentCard,
    cards,
    currentIdx,
    stats,
    result,
    analytics,
    flashcardXp,
    infoAcknowledged,
    showHelp,
    sessionId,
    selectedSubject,
    sessionAnalytics,
    showAnalytics,
    showTuneSheet,
    showNotes,
    uploadedFile,
    isProcessingFile,
    onAnswer,
    onNext,
    onSkip,
    onHelp,
    onCloseHelp,
    onFlashcardRate,
    onInfoGotIt,
    onShowAnalytics,
    onCloseAnalytics,
    onOpenTuneSheet,
    onCloseTuneSheet,
    onFileUpload,
    onToggleNotes,
    onReset,
}: ActiveFeedProps) {
    const cardType = currentCard.card_type;
    const totalCards = cards.length;
    const difficultyPercent = Math.round(stats.difficulty * 100);

    return (
        <div className="h-full flex flex-col bg-[#0a0820] relative">
            {/* Subtle star dust background */}
            <div
                className="absolute inset-0 pointer-events-none opacity-50"
                style={{
                    background: `
                        radial-gradient(1px 1px at 15% 20%, rgba(165,180,252,0.3) 50%, transparent 100%),
                        radial-gradient(1px 1px at 45% 60%, rgba(255,255,255,0.15) 50%, transparent 100%),
                        radial-gradient(1px 1px at 75% 35%, rgba(165,180,252,0.2) 50%, transparent 100%),
                        radial-gradient(1px 1px at 90% 80%, rgba(110,231,183,0.15) 50%, transparent 100%)
                    `,
                }}
            />

            {/* Header */}
            <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-3 border-b border-indigo-500/10">
                <button
                    onClick={onReset}
                    className="p-2 -ml-2 rounded-xl hover:bg-indigo-500/10 text-indigo-300 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4">
                    {/* Streak with fire glow */}
                    <div className="flex items-center gap-1">
                        <span
                            className="text-base"
                            style={{
                                textShadow: stats.streak > 0 ? "0 0 8px rgba(251,146,60,0.6)" : "none",
                            }}
                        >
                            {stats.streak > 0 ? "\uD83D\uDD25" : "\u2B50"}
                        </span>
                        <span className="text-sm font-bold text-gray-100">{stats.streak}</span>
                    </div>

                    {/* XP as gold bolt */}
                    <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-amber-400" fill="currentColor" style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,0.5))" }} />
                        <span className="text-sm font-bold text-amber-400">{stats.total_xp}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onShowAnalytics}
                        className="p-2 rounded-xl hover:bg-indigo-500/10 text-indigo-300/60 transition-colors"
                    >
                        <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onOpenTuneSheet}
                        className="p-2 rounded-xl hover:bg-indigo-500/10 text-indigo-300/60 transition-colors"
                    >
                        <Settings2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Card container with indigo vignette */}
            <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
                {/* Indigo vignette edges */}
                <div className="absolute inset-0 pointer-events-none z-20" style={{
                    background: "radial-gradient(ellipse at center, transparent 60%, rgba(49,46,129,0.15) 100%)",
                }} />

                <div className="h-full">
                    {cardType === "flashcard" ? (
                        <FlashcardCard
                            card={currentCard}
                            onRate={onFlashcardRate}
                            onNext={onNext}
                            stats={stats}
                            xpEarned={flashcardXp}
                        />
                    ) : cardType === "info_card" ? (
                        <InfoCardComponent
                            card={currentCard}
                            onGotIt={onInfoGotIt}
                            onNext={onNext}
                            xpAwarded={infoAcknowledged}
                        />
                    ) : cardType === "resource_card" ? (
                        <ResourceCardComponent
                            card={currentCard}
                            onNext={onNext}
                        />
                    ) : (
                        <CosmicQuizCard
                            card={currentCard}
                            onAnswer={onAnswer}
                            onNext={onNext}
                            onHelp={onHelp}
                            result={result}
                            stats={stats}
                            analytics={analytics}
                        />
                    )}
                </div>
            </div>

            {/* Bottom bar: Signal X / Y+ . Frequency Level Z% */}
            <div className="relative z-10 shrink-0 px-5 py-2.5 border-t border-indigo-500/10 flex items-center justify-between">
                <span className="text-[11px] text-indigo-300/40 font-medium">
                    Card {currentIdx + 1} / {totalCards}+
                </span>
                <span className="text-[11px] text-indigo-300/40 font-medium">
                    Level {difficultyPercent}%
                </span>
            </div>

            {/* Socratic help overlay */}
            {showHelp && (
                <SocraticOverlay
                    card={currentCard}
                    sessionId={sessionId}
                    onClose={onCloseHelp}
                />
            )}

            {/* Analytics overlay */}
            {showAnalytics && sessionAnalytics && (
                <AnalyticsOverlay
                    data={sessionAnalytics}
                    onClose={onCloseAnalytics}
                />
            )}

            {/* Tune sheet */}
            <BottomSheet
                open={showTuneSheet}
                onClose={onCloseTuneSheet}
                title="Feed Settings"
            >
                <FeedTuneControls mode="active" />
            </BottomSheet>
        </div>
    );
}

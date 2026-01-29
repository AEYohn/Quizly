"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

// ============================================
// Base Skeleton Component
// ============================================

interface SkeletonBaseProps {
    className?: string;
    children?: ReactNode;
    /**
     * Accessible label for the loading skeleton
     * @default "Loading..."
     */
    "aria-label"?: string;
}

/**
 * Base skeleton component with pulse animation.
 * Use as a building block for other skeleton components.
 * Includes accessibility attributes for screen readers.
 */
export function SkeletonBase({ className, children, "aria-label": ariaLabel = "Loading..." }: SkeletonBaseProps) {
    return (
        <div
            role="status"
            aria-label={ariaLabel}
            className={cn(
                "animate-pulse bg-gray-700/50 rounded",
                className
            )}
        >
            {children}
        </div>
    );
}

// ============================================
// SkeletonText Component
// ============================================

interface SkeletonTextProps {
    /**
     * Number of text lines to render
     * @default 1
     */
    lines?: number;
    /**
     * Width of the last line (as percentage or Tailwind class)
     * @default "w-3/4"
     */
    lastLineWidth?: string;
    /**
     * Height of each line
     * @default "h-4"
     */
    lineHeight?: string;
    /**
     * Gap between lines
     * @default "space-y-2"
     */
    gap?: string;
    className?: string;
}

/**
 * Skeleton for text content with configurable line count.
 */
export function SkeletonText({
    lines = 1,
    lastLineWidth = "w-3/4",
    lineHeight = "h-4",
    gap = "space-y-2",
    className,
}: SkeletonTextProps) {
    return (
        <div className={cn(gap, className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonBase
                    key={i}
                    className={cn(
                        lineHeight,
                        "rounded",
                        i === lines - 1 && lines > 1 ? lastLineWidth : "w-full"
                    )}
                />
            ))}
        </div>
    );
}

// ============================================
// SkeletonCard Component
// ============================================

interface SkeletonCardProps {
    /**
     * Whether to show a header area
     * @default true
     */
    showHeader?: boolean;
    /**
     * Number of body text lines
     * @default 2
     */
    bodyLines?: number;
    /**
     * Whether to show a footer area
     * @default false
     */
    showFooter?: boolean;
    className?: string;
}

/**
 * Skeleton for card placeholders with optional header and footer.
 */
export function SkeletonCard({
    showHeader = true,
    bodyLines = 2,
    showFooter = false,
    className,
}: SkeletonCardProps) {
    return (
        <div
            className={cn(
                "rounded-2xl border border-gray-800 bg-gray-900 p-6",
                className
            )}
        >
            {showHeader && (
                <div className="mb-4 flex items-center justify-between">
                    <SkeletonBase className="h-5 w-32 rounded" />
                    <SkeletonBase className="h-6 w-16 rounded-full" />
                </div>
            )}
            <SkeletonText lines={bodyLines} className="mb-4" />
            {showFooter && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <SkeletonBase className="h-4 w-24 rounded" />
                    <SkeletonBase className="h-8 w-20 rounded-lg" />
                </div>
            )}
        </div>
    );
}

// ============================================
// SkeletonQuizOption Component
// ============================================

interface SkeletonQuizOptionProps {
    /**
     * Option label (A, B, C, D)
     */
    label?: string;
    className?: string;
}

/**
 * Skeleton for quiz answer options.
 */
export function SkeletonQuizOption({ label, className }: SkeletonQuizOptionProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-4 rounded-xl border-2 border-gray-700 bg-gray-800/50 p-4 transition-all",
                className
            )}
        >
            {label && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-700 text-lg font-bold text-gray-400">
                    {label}
                </span>
            )}
            <SkeletonBase className="h-5 flex-1 rounded" />
        </div>
    );
}

/**
 * Skeleton for a full set of quiz options (typically 4).
 */
export function SkeletonQuizOptions({ className }: { className?: string }) {
    const labels = ["A", "B", "C", "D"];
    return (
        <div className={cn("space-y-3", className)}>
            {labels.map((label) => (
                <SkeletonQuizOption key={label} label={label} />
            ))}
        </div>
    );
}

// ============================================
// SkeletonLeaderboardRow Component
// ============================================

interface SkeletonLeaderboardRowProps {
    /**
     * Show rank badge
     * @default true
     */
    showRank?: boolean;
    /**
     * Show score
     * @default true
     */
    showScore?: boolean;
    className?: string;
}

/**
 * Skeleton for leaderboard entries.
 */
export function SkeletonLeaderboardRow({
    showRank = true,
    showScore = true,
    className,
}: SkeletonLeaderboardRowProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-4 rounded-xl bg-gray-800 p-3",
                className
            )}
        >
            {showRank && (
                <SkeletonBase className="h-8 w-8 shrink-0 rounded-full" />
            )}
            <div className="flex items-center gap-3 flex-1">
                <SkeletonBase className="h-10 w-10 shrink-0 rounded-full" />
                <SkeletonBase className="h-4 w-28 rounded" />
            </div>
            {showScore && (
                <SkeletonBase className="h-5 w-16 rounded" />
            )}
        </div>
    );
}

/**
 * Skeleton for a full leaderboard (multiple rows).
 */
export function SkeletonLeaderboard({
    rows = 5,
    className,
}: {
    rows?: number;
    className?: string;
}) {
    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonLeaderboardRow key={i} />
            ))}
        </div>
    );
}

// ============================================
// SkeletonCourseCard Component
// ============================================

interface SkeletonCourseCardProps {
    /**
     * Show progress bar
     * @default true
     */
    showProgress?: boolean;
    className?: string;
}

/**
 * Skeleton for course/class cards.
 */
export function SkeletonCourseCard({
    showProgress = true,
    className,
}: SkeletonCourseCardProps) {
    return (
        <div
            className={cn(
                "rounded-xl border border-gray-800 bg-gray-900 p-5",
                className
            )}
        >
            {/* Badge */}
            <div className="mb-3 flex items-center justify-between">
                <SkeletonBase className="h-6 w-16 rounded-full" />
                <SkeletonBase className="h-6 w-6 rounded" />
            </div>
            {/* Title */}
            <SkeletonBase className="h-5 w-3/4 rounded mb-1" />
            {/* Subtitle/description */}
            <SkeletonBase className="h-4 w-1/2 rounded mb-3" />
            {/* Progress bar */}
            {showProgress && (
                <>
                    <div className="flex justify-between mb-1">
                        <SkeletonBase className="h-3 w-16 rounded" />
                        <SkeletonBase className="h-3 w-8 rounded" />
                    </div>
                    <SkeletonBase className="h-1.5 w-full rounded-full" />
                </>
            )}
        </div>
    );
}

// ============================================
// SkeletonDashboard Component
// ============================================

interface SkeletonDashboardProps {
    className?: string;
}

/**
 * Skeleton for full dashboard layout.
 * Includes header, stats, and content cards.
 */
export function SkeletonDashboard({ className }: SkeletonDashboardProps) {
    return (
        <div className={cn("space-y-8", className)}>
            {/* Header section */}
            <div className="rounded-2xl bg-gradient-to-r from-gray-800 to-gray-700 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                        <SkeletonBase className="h-6 w-48 rounded bg-gray-600/50" />
                        <SkeletonBase className="h-4 w-64 rounded bg-gray-600/50" />
                    </div>
                    <div className="flex gap-3">
                        <SkeletonBase className="h-12 w-32 rounded-xl bg-gray-600/50" />
                        <SkeletonBase className="h-12 w-24 rounded-xl bg-gray-600/50" />
                    </div>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-xl bg-gray-800/50 border border-gray-700 p-4"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <SkeletonBase className="h-4 w-4 rounded" />
                            <SkeletonBase className="h-3 w-16 rounded" />
                        </div>
                        <SkeletonBase className="h-8 w-20 rounded" />
                    </div>
                ))}
            </div>

            {/* Content cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCourseCard key={i} />
                ))}
            </div>
        </div>
    );
}

// ============================================
// SkeletonGameLobby Component
// ============================================

interface SkeletonGameLobbyProps {
    className?: string;
}

/**
 * Skeleton for game lobby layout.
 * Includes game code, player count, and player grid.
 */
export function SkeletonGameLobby({ className }: SkeletonGameLobbyProps) {
    return (
        <div className={cn("max-w-4xl mx-auto space-y-8", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <SkeletonBase className="h-8 w-48 rounded" />
                    <SkeletonBase className="h-6 w-16 rounded-full" />
                </div>
                <SkeletonBase className="h-10 w-24 rounded-lg" />
            </div>

            {/* Join Code Display */}
            <div className="rounded-2xl bg-gray-900 p-8 text-center border border-gray-800">
                <SkeletonBase className="h-4 w-48 mx-auto rounded mb-4 bg-gray-700/30" />
                <div className="flex items-center justify-center gap-4 mb-4">
                    <SkeletonBase className="h-16 w-48 rounded-lg" />
                    <SkeletonBase className="h-12 w-12 rounded-lg" />
                </div>
                <SkeletonBase className="h-3 w-56 mx-auto rounded bg-gray-700/30" />
            </div>

            {/* Player Count & Start Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <SkeletonBase className="h-6 w-6 rounded" />
                    <SkeletonBase className="h-8 w-12 rounded" />
                    <SkeletonBase className="h-6 w-32 rounded" />
                </div>
                <SkeletonBase className="h-14 w-40 rounded-xl" />
            </div>

            {/* Players Grid */}
            <div className="rounded-2xl bg-gray-900 p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <SkeletonBase className="h-5 w-20 rounded" />
                    <SkeletonBase className="h-8 w-8 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 rounded-xl bg-gray-800 p-3"
                        >
                            <SkeletonBase className="h-10 w-10 shrink-0 rounded-full" />
                            <SkeletonBase className="h-4 flex-1 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ============================================
// SkeletonQuizQuestion Component
// ============================================

interface SkeletonQuizQuestionProps {
    /**
     * Number of answer options
     * @default 4
     */
    optionCount?: number;
    /**
     * Show timer area
     * @default true
     */
    showTimer?: boolean;
    /**
     * Show progress indicator
     * @default true
     */
    showProgress?: boolean;
    className?: string;
}

/**
 * Skeleton for quiz question layout.
 * Includes question text, options, timer, and progress.
 */
export function SkeletonQuizQuestion({
    optionCount = 4,
    showTimer = true,
    showProgress = true,
    className,
}: SkeletonQuizQuestionProps) {
    const labels = ["A", "B", "C", "D", "E", "F"].slice(0, optionCount);

    return (
        <div className={cn("max-w-3xl mx-auto space-y-6", className)}>
            {/* Header with progress and timer */}
            {(showProgress || showTimer) && (
                <div className="flex items-center justify-between">
                    {showProgress && (
                        <SkeletonBase className="h-4 w-32 rounded" />
                    )}
                    {showTimer && (
                        <div className="flex items-center gap-2">
                            <SkeletonBase className="h-5 w-5 rounded" />
                            <SkeletonBase className="h-6 w-12 rounded" />
                        </div>
                    )}
                </div>
            )}

            {/* Question card */}
            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
                {/* Question text */}
                <div className="mb-6">
                    <SkeletonText lines={2} lineHeight="h-6" gap="space-y-3" />
                </div>

                {/* Answer options */}
                <div className="space-y-3">
                    {labels.map((label) => (
                        <SkeletonQuizOption key={label} label={label} />
                    ))}
                </div>
            </div>

            {/* Footer with score/actions */}
            <div className="flex items-center justify-between">
                <SkeletonBase className="h-4 w-24 rounded" />
                <SkeletonBase className="h-10 w-28 rounded-lg" />
            </div>
        </div>
    );
}

// ============================================
// SkeletonAvatar Component
// ============================================

interface SkeletonAvatarProps {
    /**
     * Size of the avatar
     * @default "md"
     */
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

const avatarSizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
};

/**
 * Skeleton for avatar/profile images.
 */
export function SkeletonAvatar({ size = "md", className }: SkeletonAvatarProps) {
    return (
        <SkeletonBase
            className={cn(
                "rounded-full shrink-0",
                avatarSizes[size],
                className
            )}
        />
    );
}

// ============================================
// SkeletonButton Component
// ============================================

interface SkeletonButtonProps {
    /**
     * Size of the button
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    className?: string;
}

const buttonSizes = {
    sm: "h-8 w-16",
    md: "h-10 w-24",
    lg: "h-12 w-32",
};

/**
 * Skeleton for button placeholders.
 */
export function SkeletonButton({ size = "md", className }: SkeletonButtonProps) {
    return (
        <SkeletonBase
            className={cn(
                "rounded-lg",
                buttonSizes[size],
                className
            )}
        />
    );
}

// ============================================
// SkeletonTable Component
// ============================================

interface SkeletonTableProps {
    /**
     * Number of rows
     * @default 5
     */
    rows?: number;
    /**
     * Number of columns
     * @default 4
     */
    columns?: number;
    /**
     * Show table header
     * @default true
     */
    showHeader?: boolean;
    className?: string;
}

/**
 * Skeleton for table layouts.
 */
export function SkeletonTable({
    rows = 5,
    columns = 4,
    showHeader = true,
    className,
}: SkeletonTableProps) {
    return (
        <div className={cn("rounded-xl border border-gray-800 overflow-hidden", className)}>
            {showHeader && (
                <div className="flex gap-4 bg-gray-800/50 p-4 border-b border-gray-800">
                    {Array.from({ length: columns }).map((_, i) => (
                        <SkeletonBase
                            key={i}
                            className={cn(
                                "h-4 rounded",
                                i === 0 ? "w-32" : "flex-1"
                            )}
                        />
                    ))}
                </div>
            )}
            <div className="divide-y divide-gray-800">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex gap-4 p-4">
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <SkeletonBase
                                key={colIndex}
                                className={cn(
                                    "h-4 rounded",
                                    colIndex === 0 ? "w-32" : "flex-1"
                                )}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

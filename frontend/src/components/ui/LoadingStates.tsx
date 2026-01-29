"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

// ============================================
// LoadingSpinner Component
// ============================================

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
type SpinnerColor = "default" | "primary" | "white" | "muted";

interface LoadingSpinnerProps {
    /**
     * Size of the spinner
     * @default "md"
     */
    size?: SpinnerSize;
    /**
     * Color variant
     * @default "primary"
     */
    color?: SpinnerColor;
    /**
     * Optional label text shown below spinner
     */
    label?: string;
    /**
     * Center the spinner in its container
     * @default false
     */
    centered?: boolean;
    className?: string;
}

const spinnerSizes: Record<SpinnerSize, string> = {
    xs: "h-3 w-3",
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
};

const spinnerColors: Record<SpinnerColor, { track: string; spinner: string }> = {
    default: {
        track: "text-gray-700",
        spinner: "text-gray-400",
    },
    primary: {
        track: "text-gray-700",
        spinner: "text-sky-400",
    },
    white: {
        track: "text-white/20",
        spinner: "text-white",
    },
    muted: {
        track: "text-gray-600",
        spinner: "text-gray-400",
    },
};

/**
 * Loading spinner for simple loading indicators.
 */
export function LoadingSpinner({
    size = "md",
    color = "primary",
    label,
    centered = false,
    className,
}: LoadingSpinnerProps) {
    const colors = spinnerColors[color];

    const spinner = (
        <div className={cn("relative", spinnerSizes[size], className)}>
            {/* Track (background circle) */}
            <svg
                className={cn("absolute inset-0", colors.track)}
                viewBox="0 0 24 24"
                fill="none"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-25"
                />
            </svg>
            {/* Spinner (animated arc) */}
            <svg
                className={cn("absolute inset-0 animate-spin", colors.spinner)}
                viewBox="0 0 24 24"
                fill="none"
            >
                <path
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    fill="currentColor"
                />
            </svg>
        </div>
    );

    if (label || centered) {
        return (
            <div
                className={cn(
                    "flex flex-col items-center gap-3",
                    centered && "justify-center"
                )}
            >
                {spinner}
                {label && (
                    <span
                        className={cn(
                            "text-sm",
                            color === "white" ? "text-white/80" : "text-gray-400"
                        )}
                    >
                        {label}
                    </span>
                )}
            </div>
        );
    }

    return spinner;
}

// ============================================
// LoadingDots Component
// ============================================

interface LoadingDotsProps {
    /**
     * Size of dots
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    /**
     * Color of dots
     * @default "primary"
     */
    color?: "default" | "primary" | "white";
    className?: string;
}

const dotSizes = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-3 w-3",
};

const dotColors = {
    default: "bg-gray-400",
    primary: "bg-sky-400",
    white: "bg-white",
};

/**
 * Loading dots animation (three bouncing dots).
 */
export function LoadingDots({
    size = "md",
    color = "primary",
    className,
}: LoadingDotsProps) {
    return (
        <div className={cn("flex items-center gap-1", className)}>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className={cn(
                        "rounded-full animate-bounce",
                        dotSizes[size],
                        dotColors[color]
                    )}
                    style={{
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: "0.6s",
                    }}
                />
            ))}
        </div>
    );
}

// ============================================
// LoadingOverlay Component
// ============================================

interface LoadingOverlayProps {
    /**
     * Whether the overlay is visible
     * @default true
     */
    visible?: boolean;
    /**
     * Text to display below spinner
     */
    message?: string;
    /**
     * Whether overlay covers full screen or just parent
     * @default "fullscreen"
     */
    variant?: "fullscreen" | "container";
    /**
     * Background blur amount
     * @default true
     */
    blur?: boolean;
    /**
     * Spinner size
     * @default "xl"
     */
    spinnerSize?: SpinnerSize;
    className?: string;
    children?: ReactNode;
}

/**
 * Full-screen or container loading overlay with spinner.
 */
export function LoadingOverlay({
    visible = true,
    message,
    variant = "fullscreen",
    blur = true,
    spinnerSize = "xl",
    className,
    children,
}: LoadingOverlayProps) {
    if (!visible) return <>{children}</>;

    const overlay = (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-4",
                variant === "fullscreen"
                    ? "fixed inset-0 z-50 bg-gray-950/80"
                    : "absolute inset-0 z-10 bg-gray-900/80",
                blur && "backdrop-blur-sm",
                className
            )}
        >
            <LoadingSpinner size={spinnerSize} color="primary" />
            {message && (
                <p className="text-lg font-medium text-white">{message}</p>
            )}
        </div>
    );

    if (variant === "container" && children) {
        return (
            <div className="relative">
                {children}
                {overlay}
            </div>
        );
    }

    return overlay;
}

// ============================================
// LoadingState Wrapper Component
// ============================================

interface LoadingStateProps {
    /**
     * Whether content is loading
     */
    isLoading: boolean;
    /**
     * Content to show when loading
     */
    skeleton?: ReactNode;
    /**
     * Alternative: use spinner instead of skeleton
     * @default false
     */
    useSpinner?: boolean;
    /**
     * Spinner configuration when useSpinner is true
     */
    spinnerProps?: Omit<LoadingSpinnerProps, "className">;
    /**
     * Message to show with spinner
     */
    loadingMessage?: string;
    /**
     * Minimum height when loading
     */
    minHeight?: string;
    /**
     * Error state
     */
    error?: Error | string | null;
    /**
     * Render function for error state
     */
    errorComponent?: ReactNode;
    /**
     * Retry function for error state
     */
    onRetry?: () => void;
    /**
     * The actual content to show when not loading
     */
    children: ReactNode;
    className?: string;
}

/**
 * Wrapper component for conditional loading states.
 * Handles loading, error, and success states elegantly.
 */
export function LoadingState({
    isLoading,
    skeleton,
    useSpinner = false,
    spinnerProps,
    loadingMessage,
    minHeight = "h-48",
    error,
    errorComponent,
    onRetry,
    children,
    className,
}: LoadingStateProps) {
    // Error state
    if (error) {
        if (errorComponent) {
            return <>{errorComponent}</>;
        }

        const errorMessage =
            error instanceof Error ? error.message : String(error);

        return (
            <div
                className={cn(
                    "flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 p-8",
                    minHeight,
                    className
                )}
            >
                <svg
                    className="mb-4 h-12 w-12 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
                <p className="mb-2 text-lg font-medium text-white">
                    Something went wrong
                </p>
                <p className="mb-4 text-sm text-gray-400 text-center max-w-md">
                    {errorMessage}
                </p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                        Try Again
                    </button>
                )}
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        // Use skeleton if provided
        if (skeleton && !useSpinner) {
            return <>{skeleton}</>;
        }

        // Use spinner
        return (
            <div
                className={cn(
                    "flex items-center justify-center",
                    minHeight,
                    className
                )}
            >
                <LoadingSpinner
                    centered
                    label={loadingMessage}
                    {...spinnerProps}
                />
            </div>
        );
    }

    // Success state - render children
    return <>{children}</>;
}

// ============================================
// LoadingPage Component
// ============================================

interface LoadingPageProps {
    /**
     * Message to display
     */
    message?: string;
    /**
     * Sub-message or description
     */
    description?: string;
    className?: string;
}

/**
 * Full-page loading state for page transitions.
 */
export function LoadingPage({
    message = "Loading...",
    description,
    className,
}: LoadingPageProps) {
    return (
        <div
            className={cn(
                "flex min-h-screen flex-col items-center justify-center bg-gray-950",
                className
            )}
        >
            <LoadingSpinner size="xl" color="primary" />
            {message && (
                <p className="mt-6 text-xl font-medium text-white">{message}</p>
            )}
            {description && (
                <p className="mt-2 text-sm text-gray-400">{description}</p>
            )}
        </div>
    );
}

// ============================================
// LoadingButton Component
// ============================================

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Whether the button is in loading state
     */
    isLoading?: boolean;
    /**
     * Text to show while loading
     */
    loadingText?: string;
    /**
     * Spinner size
     * @default "sm"
     */
    spinnerSize?: SpinnerSize;
    children: ReactNode;
}

/**
 * Button with integrated loading state.
 */
export function LoadingButton({
    isLoading = false,
    loadingText,
    spinnerSize = "sm",
    children,
    disabled,
    className,
    ...props
}: LoadingButtonProps) {
    return (
        <button
            disabled={disabled || isLoading}
            className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                className
            )}
            {...props}
        >
            {isLoading ? (
                <>
                    <LoadingSpinner size={spinnerSize} color="white" />
                    {loadingText || children}
                </>
            ) : (
                children
            )}
        </button>
    );
}

// ============================================
// ProgressLoader Component
// ============================================

interface ProgressLoaderProps {
    /**
     * Progress value (0-100)
     */
    progress: number;
    /**
     * Message to display
     */
    message?: string;
    /**
     * Show percentage
     * @default true
     */
    showPercentage?: boolean;
    className?: string;
}

/**
 * Loading indicator with progress bar.
 */
export function ProgressLoader({
    progress,
    message,
    showPercentage = true,
    className,
}: ProgressLoaderProps) {
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <div className={cn("w-full max-w-md", className)}>
            {(message || showPercentage) && (
                <div className="flex items-center justify-between mb-2">
                    {message && (
                        <span className="text-sm text-gray-400">{message}</span>
                    )}
                    {showPercentage && (
                        <span className="text-sm font-medium text-white">
                            {Math.round(clampedProgress)}%
                        </span>
                    )}
                </div>
            )}
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-300 ease-out"
                    style={{ width: `${clampedProgress}%` }}
                />
            </div>
        </div>
    );
}

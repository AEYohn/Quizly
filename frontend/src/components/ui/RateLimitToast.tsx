"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// RateLimitToast Component
// ============================================

interface RateLimitToastProps {
    /**
     * Number of seconds until the rate limit resets
     */
    retryAfter: number;
    /**
     * Callback when the toast is dismissed
     */
    onDismiss: () => void;
    /**
     * Optional custom message
     */
    message?: string;
}

/**
 * Toast notification that displays a countdown when rate limited.
 * Auto-dismisses when countdown reaches 0.
 */
export function RateLimitToast({
    retryAfter,
    onDismiss,
    message = "Too many requests",
}: RateLimitToastProps) {
    const [secondsRemaining, setSecondsRemaining] = useState(retryAfter);

    useEffect(() => {
        // Update countdown every second
        const interval = setInterval(() => {
            setSecondsRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    // Auto-dismiss when countdown reaches 0
                    setTimeout(onDismiss, 0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [onDismiss]);

    // Format seconds to mm:ss if needed
    const formatTime = (seconds: number): string => {
        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, "0")}`;
        }
        return `${seconds}s`;
    };

    return (
        <div
            className={cn(
                "fixed bottom-4 right-4 z-50",
                "flex items-center gap-3 rounded-xl px-4 py-3",
                "bg-amber-500 text-white shadow-lg",
                "animate-in slide-in-from-bottom-4 duration-300"
            )}
            role="alert"
            aria-live="polite"
        >
            <Clock className="h-5 w-5 flex-shrink-0 text-amber-100" />
            <div className="flex flex-col">
                <span className="text-sm font-medium">{message}</span>
                <span className="text-xs text-amber-100">
                    Retry in {formatTime(secondsRemaining)}
                </span>
            </div>
            <button
                onClick={onDismiss}
                className={cn(
                    "ml-2 rounded-lg p-1.5",
                    "text-amber-100 hover:bg-amber-400 hover:text-white",
                    "transition-colors"
                )}
                aria-label="Dismiss notification"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

// ============================================
// RateLimit Context
// ============================================

interface RateLimitContextValue {
    /**
     * Show a rate limit toast with the specified retry time
     * @param retryAfter - Number of seconds until the rate limit resets
     * @param message - Optional custom message
     */
    showRateLimitToast: (retryAfter: number, message?: string) => void;
    /**
     * Whether a rate limit toast is currently shown
     */
    isRateLimited: boolean;
    /**
     * Number of seconds remaining until rate limit resets (0 if not limited)
     */
    retryAfter: number;
}

const RateLimitContext = createContext<RateLimitContextValue | null>(null);

// ============================================
// RateLimitProvider Component
// ============================================

interface RateLimitProviderProps {
    children: ReactNode;
}

/**
 * Context provider that manages global rate limit toast notifications.
 * Wrap your app with this provider to enable rate limit feedback.
 *
 * @example
 * ```tsx
 * <RateLimitProvider>
 *   <App />
 * </RateLimitProvider>
 * ```
 */
export function RateLimitProvider({ children }: RateLimitProviderProps) {
    const [toastState, setToastState] = useState<{
        visible: boolean;
        retryAfter: number;
        message?: string;
    }>({
        visible: false,
        retryAfter: 0,
    });

    const showRateLimitToast = useCallback(
        (retryAfter: number, message?: string) => {
            setToastState({
                visible: true,
                retryAfter,
                message,
            });
        },
        []
    );

    const handleDismiss = useCallback(() => {
        setToastState((prev) => ({
            ...prev,
            visible: false,
        }));
    }, []);

    const contextValue: RateLimitContextValue = {
        showRateLimitToast,
        isRateLimited: toastState.visible,
        retryAfter: toastState.retryAfter,
    };

    return (
        <RateLimitContext.Provider value={contextValue}>
            {children}
            {toastState.visible && (
                <RateLimitToast
                    retryAfter={toastState.retryAfter}
                    onDismiss={handleDismiss}
                    message={toastState.message}
                />
            )}
        </RateLimitContext.Provider>
    );
}

// ============================================
// useRateLimit Hook
// ============================================

/**
 * Hook to access the rate limit context.
 * Must be used within a RateLimitProvider.
 *
 * @returns The rate limit context with showRateLimitToast function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { showRateLimitToast } = useRateLimit();
 *
 *   const handleApiCall = async () => {
 *     try {
 *       await api.someEndpoint();
 *     } catch (error) {
 *       if (error.status === 429) {
 *         showRateLimitToast(error.retryAfter);
 *       }
 *     }
 *   };
 * }
 * ```
 */
export function useRateLimit(): RateLimitContextValue {
    const context = useContext(RateLimitContext);

    if (!context) {
        throw new Error("useRateLimit must be used within a RateLimitProvider");
    }

    return context;
}

// ============================================
// Exports
// ============================================

export type { RateLimitToastProps, RateLimitContextValue, RateLimitProviderProps };

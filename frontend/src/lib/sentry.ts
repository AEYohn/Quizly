/**
 * Sentry Error Monitoring Configuration for Quizly Frontend.
 *
 * Provides centralized error tracking for the Next.js application.
 */

import * as Sentry from "@sentry/nextjs";

// Track if Sentry has been initialized
let isInitialized = false;

/**
 * Initialize Sentry error monitoring.
 *
 * Checks for NEXT_PUBLIC_SENTRY_DSN environment variable and configures
 * Sentry SDK with appropriate settings.
 *
 * @returns True if Sentry was initialized, false otherwise.
 */
export function initSentry(): boolean {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (!dsn) {
        return false;
    }

    if (isInitialized) {
        return true;
    }

    const environment = process.env.NODE_ENV || "development";

    Sentry.init({
        dsn,
        environment,
        // Sample 10% of transactions in production, all in development
        tracesSampleRate: environment === "production" ? 0.1 : 1.0,
        // Don't send session replays by default
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        // Filter out common noise
        ignoreErrors: [
            // ResizeObserver errors are benign and common
            "ResizeObserver loop limit exceeded",
            "ResizeObserver loop completed with undelivered notifications",
            // Network errors that are expected
            "Network request failed",
            "Failed to fetch",
            "Load failed",
            // User-initiated navigation
            "AbortError",
            // Common browser extension issues
            "Non-Error exception captured",
            "Non-Error promise rejection captured",
        ],
        // Filter out health check and common endpoints from performance monitoring
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        beforeSendTransaction(event: any) {
            const transactionName = event?.transaction || "";
            // Exclude API health checks if they appear
            if (
                transactionName.includes("/health") ||
                transactionName.includes("/metrics")
            ) {
                return null;
            }
            return event;
        },
    });

    isInitialized = true;
    return true;
}

/**
 * Capture an exception and send to Sentry with optional context.
 *
 * @param error - The error to capture.
 * @param context - Optional dictionary of additional context data.
 * @returns The Sentry event ID if captured, undefined if Sentry not configured.
 */
export function captureException(
    error: Error | unknown,
    context?: Record<string, unknown>
): string | undefined {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
        return undefined;
    }

    if (context) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Sentry.withScope((scope: any) => {
            Object.entries(context).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
            Sentry.captureException(error);
        });
        return undefined; // withScope doesn't return event ID
    }

    return Sentry.captureException(error) as string | undefined;
}

/**
 * Set user context for Sentry error reports.
 *
 * @param user - User data to set.
 */
export function setUser(user: {
    id: string;
    email?: string;
    username?: string;
    role?: string;
}): void {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
        return;
    }

    Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
        ...(user.role && { role: user.role }),
    });
}

/**
 * Clear the current user context.
 */
export function clearUser(): void {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        Sentry.setUser(null);
    }
}

/**
 * Add breadcrumb for debugging trail.
 *
 * @param message - Description of the breadcrumb.
 * @param category - Category for grouping (e.g., "navigation", "api").
 * @param data - Optional additional data.
 */
export function addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, unknown>
): void {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
        return;
    }

    Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: "info",
    });
}

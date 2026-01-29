/**
 * Rate-Limit-Aware API Client for Quizly
 *
 * This module provides an API client class that handles 429 (Too Many Requests)
 * responses gracefully by parsing the Retry-After header and calling a
 * configurable rate limit handler.
 */

// ============================================
// Types
// ============================================

/**
 * Custom error class for API errors with additional metadata.
 */
export class ApiError extends Error {
    /** HTTP status code */
    readonly status: number;
    /** Number of seconds to wait before retrying (for 429 errors) */
    readonly retryAfter?: number;
    /** Original response data */
    readonly data?: unknown;

    constructor(
        message: string,
        status: number,
        retryAfter?: number,
        data?: unknown
    ) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.retryAfter = retryAfter;
        this.data = data;
    }

    /**
     * Check if this is a rate limit error
     */
    isRateLimited(): boolean {
        return this.status === 429;
    }
}

/**
 * Handler function called when a rate limit is encountered.
 * @param retryAfter - Number of seconds until the rate limit resets
 */
export type RateLimitHandler = (retryAfter: number) => void;

/**
 * Configuration options for the API client.
 */
export interface ApiClientConfig {
    /** Base URL for all API requests */
    baseUrl: string;
    /** Default headers to include with every request */
    defaultHeaders?: Record<string, string>;
    /** Handler called when a 429 response is received */
    rateLimitHandler?: RateLimitHandler;
    /** Default timeout in milliseconds (default: 30000) */
    timeout?: number;
}

/**
 * Options for individual fetch requests.
 */
export interface FetchOptions extends Omit<RequestInit, "body"> {
    /** Request body (will be JSON stringified if object) */
    body?: unknown;
    /** Request timeout in milliseconds */
    timeout?: number;
    /** Skip calling the rate limit handler for this request */
    skipRateLimitHandler?: boolean;
}

// ============================================
// API Client Class
// ============================================

/**
 * A rate-limit-aware HTTP client for making API requests.
 *
 * Features:
 * - Automatic JSON parsing for requests and responses
 * - 429 (Rate Limited) response handling with Retry-After parsing
 * - Configurable rate limit handler for showing user feedback
 * - TypeScript generics for type-safe responses
 *
 * @example
 * ```tsx
 * // Create client with rate limit handler
 * const api = new ApiClient({
 *   baseUrl: 'http://localhost:8000',
 *   rateLimitHandler: (retryAfter) => {
 *     showRateLimitToast(retryAfter);
 *   }
 * });
 *
 * // Make type-safe requests
 * const user = await api.get<User>('/users/me');
 * ```
 */
export class ApiClient {
    private readonly config: Required<
        Pick<ApiClientConfig, "baseUrl" | "timeout">
    > &
        Omit<ApiClientConfig, "baseUrl" | "timeout">;

    constructor(config: ApiClientConfig) {
        this.config = {
            timeout: 30000,
            ...config,
        };
    }

    /**
     * Set or update the rate limit handler.
     */
    setRateLimitHandler(handler: RateLimitHandler | undefined): void {
        this.config.rateLimitHandler = handler;
    }

    /**
     * Parse the Retry-After header value.
     * Handles both seconds (integer) and HTTP-date formats.
     */
    private parseRetryAfter(header: string | null): number {
        if (!header) {
            // Default to 60 seconds if no header present
            return 60;
        }

        // Try parsing as integer (seconds)
        const seconds = parseInt(header, 10);
        if (!isNaN(seconds)) {
            return Math.max(1, seconds);
        }

        // Try parsing as HTTP-date
        const date = new Date(header);
        if (!isNaN(date.getTime())) {
            const diffMs = date.getTime() - Date.now();
            return Math.max(1, Math.ceil(diffMs / 1000));
        }

        // Fallback
        return 60;
    }

    /**
     * Make a generic fetch request with rate limit handling.
     */
    async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
        const {
            body,
            timeout = this.config.timeout,
            skipRateLimitHandler = false,
            headers: customHeaders,
            ...fetchOptions
        } = options;

        const url = `${this.config.baseUrl}${endpoint}`;

        // Prepare headers
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...this.config.defaultHeaders,
            ...(customHeaders as Record<string, string> | undefined),
        };

        // Prepare request options
        const requestInit: RequestInit = {
            ...fetchOptions,
            headers,
        };

        // Add body if present
        if (body !== undefined) {
            requestInit.body =
                typeof body === "string" ? body : JSON.stringify(body);
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        requestInit.signal = controller.signal;

        try {
            const response = await fetch(url, requestInit);
            clearTimeout(timeoutId);

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = this.parseRetryAfter(
                    response.headers.get("Retry-After")
                );

                // Call rate limit handler if configured and not skipped
                if (this.config.rateLimitHandler && !skipRateLimitHandler) {
                    this.config.rateLimitHandler(retryAfter);
                }

                // Parse error body if available
                let errorData: unknown;
                try {
                    errorData = await response.json();
                } catch {
                    // Ignore parse errors
                }

                const errorMessage =
                    (errorData as { message?: string; detail?: string })
                        ?.message ||
                    (errorData as { detail?: string })?.detail ||
                    "Rate limit exceeded. Please try again later.";

                throw new ApiError(errorMessage, 429, retryAfter, errorData);
            }

            // Handle other errors
            if (!response.ok) {
                let errorData: unknown;
                try {
                    errorData = await response.json();
                } catch {
                    // Ignore parse errors
                }

                const errorMessage =
                    (errorData as { message?: string; detail?: string })
                        ?.message ||
                    (errorData as { detail?: string })?.detail ||
                    `Request failed with status ${response.status}`;

                throw new ApiError(
                    errorMessage,
                    response.status,
                    undefined,
                    errorData
                );
            }

            // Parse successful response
            // Handle 204 No Content
            if (response.status === 204) {
                return undefined as T;
            }

            const data = await response.json();
            return data as T;
        } catch (error) {
            clearTimeout(timeoutId);

            // Re-throw ApiError as-is
            if (error instanceof ApiError) {
                throw error;
            }

            // Handle abort (timeout)
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new ApiError("Request timed out", 408);
            }

            // Handle network errors
            if (error instanceof TypeError) {
                throw new ApiError(
                    "Network error. Please check your connection.",
                    0
                );
            }

            // Unknown error
            throw new ApiError(
                error instanceof Error ? error.message : "Unknown error",
                0
            );
        }
    }

    /**
     * Make a GET request.
     */
    async get<T>(
        endpoint: string,
        options?: Omit<FetchOptions, "method" | "body">
    ): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "GET" });
    }

    /**
     * Make a POST request.
     */
    async post<T>(
        endpoint: string,
        body?: unknown,
        options?: Omit<FetchOptions, "method" | "body">
    ): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "POST", body });
    }

    /**
     * Make a PUT request.
     */
    async put<T>(
        endpoint: string,
        body?: unknown,
        options?: Omit<FetchOptions, "method" | "body">
    ): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "PUT", body });
    }

    /**
     * Make a PATCH request.
     */
    async patch<T>(
        endpoint: string,
        body?: unknown,
        options?: Omit<FetchOptions, "method" | "body">
    ): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "PATCH", body });
    }

    /**
     * Make a DELETE request.
     */
    async delete<T>(
        endpoint: string,
        options?: Omit<FetchOptions, "method">
    ): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "DELETE" });
    }
}

// ============================================
// Default Client Instance
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Default API client instance.
 * Configure the rate limit handler using `setRateLimitHandler`.
 *
 * @example
 * ```tsx
 * // In your app initialization
 * import { apiClient } from '@/lib/apiClient';
 * import { useRateLimit } from '@/components/ui/RateLimitToast';
 *
 * function App() {
 *   const { showRateLimitToast } = useRateLimit();
 *
 *   useEffect(() => {
 *     apiClient.setRateLimitHandler(showRateLimitToast);
 *   }, [showRateLimitToast]);
 * }
 * ```
 */
export const apiClient = new ApiClient({
    baseUrl: API_BASE,
});

// ============================================
// Helper: Create API Client with Rate Limit Hook
// ============================================

/**
 * Create an API client that's automatically connected to the rate limit context.
 * Use this in components that need to make API calls with rate limit feedback.
 *
 * @param rateLimitHandler - Function to call when rate limited
 * @returns Configured ApiClient instance
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { showRateLimitToast } = useRateLimit();
 *   const api = useMemo(
 *     () => createApiClientWithRateLimit(showRateLimitToast),
 *     [showRateLimitToast]
 *   );
 *
 *   const handleClick = async () => {
 *     const data = await api.get('/endpoint');
 *   };
 * }
 * ```
 */
export function createApiClientWithRateLimit(
    rateLimitHandler: RateLimitHandler
): ApiClient {
    return new ApiClient({
        baseUrl: API_BASE,
        rateLimitHandler,
    });
}

export default apiClient;

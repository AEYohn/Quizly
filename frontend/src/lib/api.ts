/**
 * Quizly API Client
 * TypeScript client for the Quizly FastAPI backend
 */

import type {
    Question,
    ActiveSessionInfo,
    LiveSessionStartRequest,
    LiveSessionResponse,
    StudentJoinResponse,
    SessionStatus,
    QuestionResponses,
    MaterialProcessResponse,
    GenerateFromCurriculumRequest,
    AnalyzeResponseRequest,
    AnalyzeResponseResult,
    PeerDiscussion,
    SessionListItem,
    ApiResult,
    DynamicThresholds,
    ConfidenceCorrectnessAnalysis,
    PeerMatchingResult,
    InterventionCheck,
    DiscussionQuality,
    SessionPulse,
    SessionAnalytics,
    MisconceptionCluster,
} from '~/types';

declare global {
    interface Window {
        Clerk?: {
            session?: {
                getToken: () => Promise<string | null>;
            };
        };
    }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================
// Retry Configuration
// ============================================

interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, Rate Limited, Server Errors
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
    return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof TypeError) {
        // Network errors (fetch failed, CORS, etc.)
        return true;
    }
    return false;
}

// ============================================
// Helper Functions
// ============================================

interface FetchApiOptions extends RequestInit {
    retry?: boolean | Partial<RetryConfig>;
}

async function fetchApi<T>(
    endpoint: string,
    options?: FetchApiOptions
): Promise<ApiResult<T>> {
    // Determine retry config
    const shouldRetry = options?.retry !== false;
    const retryConfig: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        ...(typeof options?.retry === 'object' ? options.retry : {}),
    };

    let lastError: string = 'Unknown error';

    for (let attempt = 0; attempt <= (shouldRetry ? retryConfig.maxRetries : 0); attempt++) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers,
                },
            });

            // Check if we should retry based on status code
            if (!response.ok) {
                const shouldRetryStatus = retryConfig.retryableStatuses.includes(response.status);

                if (shouldRetryStatus && attempt < retryConfig.maxRetries) {
                    // Get retry-after header if present (for rate limiting)
                    const retryAfter = response.headers.get('Retry-After');
                    const delay = retryAfter
                        ? parseInt(retryAfter, 10) * 1000
                        : calculateBackoff(attempt, retryConfig);

                    console.warn(`[API] Retrying ${endpoint} after ${Math.round(delay)}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`);
                    await sleep(delay);
                    continue;
                }

                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                // Handle standardized error format from QuizlyException
                // FastAPI validation errors return detail as array of objects
                let errorMessage: string;
                if (typeof error.detail === 'string') {
                    errorMessage = error.detail;
                } else if (Array.isArray(error.detail)) {
                    errorMessage = error.detail.map((e: { msg?: string }) => e.msg ?? 'Validation error').join('; ');
                } else {
                    errorMessage = error.message || `HTTP ${response.status}`;
                }
                return { success: false, error: errorMessage };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            lastError = error instanceof Error ? error.message : 'Network error';

            // Retry on network errors
            if (isRetryableError(error) && attempt < retryConfig.maxRetries) {
                const delay = calculateBackoff(attempt, retryConfig);
                console.warn(`[API] Network error on ${endpoint}, retrying after ${Math.round(delay)}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`);
                await sleep(delay);
                continue;
            }
        }
    }

    // Replace cryptic browser errors with user-friendly messages
    const friendlyError = lastError === 'Failed to fetch'
        ? "Couldn't connect to the server — tap to try again"
        : lastError;
    return { success: false, error: friendlyError };
}

async function fetchApiAuth<T>(
    endpoint: string,
    options?: FetchApiOptions
): Promise<ApiResult<T>> {
    let authHeaders: Record<string, string> = {};
    try {
        // Try to get Clerk session token
        const token = await window.Clerk?.session?.getToken();
        if (token) {
            authHeaders = { Authorization: `Bearer ${token}` };
        }
    } catch {
        // No Clerk session available, proceed without auth
    }
    return fetchApi<T>(endpoint, {
        ...options,
        headers: {
            ...authHeaders,
            ...options?.headers,
        },
    });
}

// ============================================
// Live Sessions API
// ============================================

export const liveSessionsApi = {
    /**
     * Check if there's an active session
     */
    getActive: () =>
        fetchApi<ActiveSessionInfo>('/live-sessions/active'),

    /**
     * Join a live session
     */
    join: (studentName: string) =>
        fetchApi<StudentJoinResponse>('/live-sessions/join', {
            method: 'POST',
            body: JSON.stringify({ student_name: studentName }),
        }),

    /**
     * Start a new live session
     */
    start: (data: LiveSessionStartRequest) =>
        fetchApi<LiveSessionResponse>('/live-sessions/start', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /**
     * Get session status
     */
    getStatus: () =>
        fetchApi<SessionStatus>('/live-sessions/status'),

    /**
     * Get a specific question by index
     */
    getQuestion: (index: number) =>
        fetchApi<{ question_index: number; question: Question }>(
            `/live-sessions/question/${index}`
        ),

    /**
     * Submit a student response
     */
    submit: (data: {
        student_name: string;
        question_id: string;
        answer: string;
        reasoning?: string;
        confidence: number;
        response_type?: string;
    }) =>
        fetchApi<{ message: string; submitted: boolean }>('/live-sessions/submit', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /**
     * Advance to next question
     */
    nextQuestion: () =>
        fetchApi<{ message: string; current_index: number; question: Question | null }>(
            '/live-sessions/next-question',
            { method: 'POST' }
        ),

    /**
     * Get responses for a question
     */
    getResponses: (questionId: string) =>
        fetchApi<QuestionResponses>(`/live-sessions/responses/${questionId}`),

    /**
     * End the session
     */
    end: () =>
        fetchApi<{ message: string; session_id: string; students_participated: number }>(
            '/live-sessions/end',
            { method: 'POST' }
        ),
};

// ============================================
// Sessions Management API
// ============================================

export const sessionsApi = {
    /**
     * Get all sessions
     */
    getAll: () =>
        fetchApi<{ sessions: SessionListItem[] }>('/sessions'),

    /**
     * Get a session by ID
     */
    getById: (sessionId: string) =>
        fetchApi<SessionListItem>(`/sessions/${sessionId}`),
};

// ============================================
// AI Features API
// ============================================

export const aiApi = {
    /**
     * Generate questions for a topic
     */
    generateQuestions: (topic: string, numQuestions = 4, concepts?: string[], format?: 'mcq' | 'code' | 'mixed', language?: string) =>
        fetchApi<{ topic: string; questions: Question[] }>('/ai/generate-questions', {
            method: 'POST',
            body: JSON.stringify({
                topic,
                num_questions: numQuestions,
                concepts: concepts?.map((c, i) => ({ id: `c_${i}`, name: c })) || [],
                format: format || 'mcq',
                language: language || 'python',
            }),
        }),

    /**
     * Analyze a student's response
     */
    analyzeResponse: (data: AnalyzeResponseRequest) =>
        fetchApi<AnalyzeResponseResult>('/ai/analyze-response', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /**
     * Analyze student's code submission with AI
     */
    analyzeCode: (data: {
        problem_description: string;
        student_code: string;
        language: string;
        test_results?: Array<{ status: string; input: string; expected_output: string; actual_output?: string }>;
        error_message?: string;
    }) =>
        fetchApi<{
            summary: string;
            issues: string[];
            suggestions: string[];
            hints: string[];
            correct_approach: string;
            complexity_analysis?: string;
        }>('/ai/analyze-code', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /**
     * Generate peer discussion
     */
    peerDiscussion: (question: Question, studentAnswer: string, reasoning?: string) =>
        fetchApi<PeerDiscussion>('/ai/peer-discussion', {
            method: 'POST',
            body: JSON.stringify({
                question,
                student_answer: studentAnswer,
                student_reasoning: reasoning,
            }),
        }),

    /**
     * Check AI service status
     */
    status: () =>
        fetchApi<{ available: boolean; model: string }>('/ai/status'),
};

// ============================================
// Curriculum API
// ============================================

export const curriculumApi = {
    /**
     * Process uploaded materials (files must be sent as FormData)
     */
    processMaterials: async (formData: FormData): Promise<ApiResult<MaterialProcessResponse>> => {
        try {
            const response = await fetch(`${API_BASE}/curriculum/process-materials`, {
                method: 'POST',
                body: formData, // Don't set Content-Type for FormData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                return { success: false, error: error.detail };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            };
        }
    },

    /**
     * Generate questions from curriculum setup
     */
    generateFromCurriculum: (data: GenerateFromCurriculumRequest) =>
        fetchApi<{ topic: string; questions: Question[] }>(
            '/curriculum/generate-questions',
            {
                method: 'POST',
                body: JSON.stringify(data),
            }
        ),
};

// ============================================
// Health Check
// ============================================

export const healthApi = {
    check: () =>
        fetchApi<{ status: string; database: string; gemini: string }>('/health'),
};

// ============================================
// Analytics API
// ============================================

export const analyticsApi = {
    /**
     * Get comprehensive session analytics
     */
    getSessionAnalytics: (sessionId: string) =>
        fetchApi<SessionAnalytics>(`/analytics/session/${sessionId}`),

    /**
     * Get real-time class pulse
     */
    getSessionPulse: (sessionId: string, questionId?: string) =>
        fetchApi<SessionPulse>(
            `/analytics/session/${sessionId}/pulse${questionId ? `?question_id=${questionId}` : ''}`
        ),

    /**
     * Get misconception clusters for a session
     */
    getMisconceptionClusters: (sessionId: string) =>
        fetchApi<{ session_id: string; clusters: MisconceptionCluster[] }>(
            `/analytics/session/${sessionId}/misconceptions`
        ),
};

// ============================================
// Adaptive Learning API
// ============================================

export const adaptiveApi = {
    /**
     * Get dynamic thresholds based on context
     */
    getDynamicThresholds: (params: {
        topic_difficulty?: number;
        time_elapsed_ratio?: number;
        historical_discussion_success?: number;
        class_size?: number;
    }) =>
        fetchApi<DynamicThresholds>('/adaptive/thresholds/dynamic', {
            method: 'POST',
            body: JSON.stringify(params),
        }),

    /**
     * Get session-specific thresholds
     */
    getSessionThresholds: (sessionId: string) =>
        fetchApi<DynamicThresholds & { session_id: string }>(
            `/adaptive/session/${sessionId}/thresholds`
        ),

    /**
     * Analyze confidence-correctness correlation
     */
    analyzeConfidenceCorrectness: (responses: {
        student_name: string;
        answer: string;
        confidence: number;
        is_correct: boolean;
        reasoning?: string;
    }[]) =>
        fetchApi<ConfidenceCorrectnessAnalysis>('/adaptive/analyze/confidence-correctness', {
            method: 'POST',
            body: JSON.stringify(responses),
        }),

    /**
     * Get confidence analysis for a specific question
     */
    getQuestionConfidenceAnalysis: (sessionId: string, questionIndex: number) =>
        fetchApi<ConfidenceCorrectnessAnalysis & { session_id: string; question_index: number }>(
            `/adaptive/session/${sessionId}/question/${questionIndex}/confidence-analysis`
        ),

    /**
     * Get smart peer pairing suggestions
     */
    getPeerMatching: (responses: {
        student_name: string;
        answer: string;
        confidence: number;
        is_correct?: boolean;
        reasoning?: string;
    }[], question: { correct_answer: string; prompt?: string }) =>
        fetchApi<PeerMatchingResult>('/adaptive/peer-matching', {
            method: 'POST',
            body: JSON.stringify({ responses, question }),
        }),

    /**
     * Get peer pairs for a specific session question
     */
    getSessionPeerPairs: (sessionId: string, questionIndex: number) =>
        fetchApi<PeerMatchingResult & { session_id: string; question_index: number }>(
            `/adaptive/session/${sessionId}/question/${questionIndex}/peer-pairs`
        ),

    /**
     * Check if intervention is needed
     */
    checkIntervention: (params: {
        responses: {
            student_name: string;
            answer: string;
            confidence: number;
            is_correct: boolean;
        }[];
        discussion_duration_seconds?: number;
        previous_discussion_outcomes?: string[];
    }) =>
        fetchApi<InterventionCheck>('/adaptive/intervention/check', {
            method: 'POST',
            body: JSON.stringify(params),
        }),

    /**
     * Analyze discussion quality
     */
    analyzeDiscussionQuality: (messages: { role: string; content: string }[], conceptVocabulary?: string[]) =>
        fetchApi<DiscussionQuality>('/adaptive/discussion/quality', {
            method: 'POST',
            body: JSON.stringify({ messages, concept_vocabulary: conceptVocabulary }),
        }),

    /**
     * Update spaced repetition after review
     */
    updateSpacedRepetition: (params: {
        student_name: string;
        concept: string;
        quality: number;
        question_template?: Record<string, unknown>;
    }) =>
        fetchApi<{
            student_name: string;
            concept: string;
            next_review_at: string;
            interval_days: number;
            ease_factor: number;
        }>('/adaptive/spaced-repetition/review', {
            method: 'POST',
            body: JSON.stringify(params),
        }),

    /**
     * Get due reviews for a student
     */
    getDueReviews: (studentName: string) =>
        fetchApi<{
            student_name: string;
            due_count: number;
            items: { concept: string; next_review_at: string; question_template: Record<string, unknown> }[];
        }>(`/adaptive/spaced-repetition/${studentName}/due`),

    /**
     * Update mastery tracking
     */
    updateMastery: (params: {
        student_name: string;
        concept: string;
        is_correct: boolean;
        confidence?: number;
    }) =>
        fetchApi<{
            student_name: string;
            concept: string;
            mastery_score: number;
            total_attempts: number;
            correct_attempts: number;
        }>('/adaptive/mastery/update', {
            method: 'POST',
            body: JSON.stringify(params),
        }),

    /**
     * Track a misconception
     */
    trackMisconception: (params: {
        student_name: string;
        concept: string;
        misconception: string;
    }) =>
        fetchApi<{
            student_name: string;
            concept: string;
            misconception: string;
            occurrence_count: number;
        }>('/adaptive/misconception/track', {
            method: 'POST',
            body: JSON.stringify(params),
        }),
};

// ============================================
// Default Export
// ============================================

export const api = {
    liveSessions: liveSessionsApi,
    sessions: sessionsApi,
    ai: aiApi,
    curriculum: curriculumApi,
    health: healthApi,
    analytics: analyticsApi,
    adaptive: adaptiveApi,
};

// ============================================
// Auth API (Simplified for MVP)
// ============================================

export const authApi = {
    /**
     * Demo login - no credentials needed!
     * Perfect for quick demos.
     */
    demoLogin: () =>
        fetchApi<{
            access_token: string;
            refresh_token?: string;
            expires_in: number;
            user: { id: string; email: string; name: string; role: string };
        }>('/auth/demo', { method: 'POST' }),

    /**
     * Register a new user
     */
    register: (email: string, password: string, name: string, role: 'teacher' | 'student') =>
        fetchApi<{
            access_token: string;
            refresh_token?: string;
            expires_in: number;
            user: { id: string; email: string; name: string; role: string };
        }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name, role }),
        }),

    /**
     * Login with credentials
     */
    login: (email: string, password: string) =>
        fetchApi<{
            access_token: string;
            refresh_token?: string;
            expires_in: number;
            user: { id: string; email: string; name: string; role: string };
        }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    /**
     * Get current user profile
     */
    me: (token: string) =>
        fetchApi<{ id: string; email: string; name: string; role: string }>('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
        }),
};

// ============================================
// Quiz API
// ============================================

export const quizApi = {
    /**
     * Create a new quiz
     */
    create: (token: string, data: {
        title: string;
        description?: string;
        subject?: string;
        is_public?: boolean;
        questions?: Array<{
            question_text: string;
            question_type?: string;
            options: Record<string, string>;
            correct_answer: string;
            explanation?: string;
            time_limit?: number;
            points?: number;
        }>;
    }) =>
        fetchApi<{ id: string; title: string }>('/quizzes', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(data),
        }),

    /**
     * List user's quizzes
     */
    list: (token: string) =>
        fetchApi<Array<{
            id: string;
            title: string;
            description?: string;
            subject?: string;
            question_count: number;
            created_at: string;
        }>>('/quizzes', {
            headers: { Authorization: `Bearer ${token}` },
        }),

    /**
     * Get quiz details
     */
    get: (token: string, quizId: string) =>
        fetchApi<{
            id: string;
            title: string;
            questions: Array<{
                id: string;
                question_text: string;
                options: Record<string, string>;
                correct_answer: string;
                explanation?: string;
            }>;
        }>(`/quizzes/${quizId}`, {
            headers: { Authorization: `Bearer ${token}` },
        }),

    /**
     * Export quiz in various formats
     * @param format - 'md' (markdown), 'json', or 'study' (student-friendly)
     */
    export: (quizId: string, format: 'md' | 'json' | 'study' = 'md', includeAnswers = true) => {
        const url = `${API_BASE}/quizzes/${quizId}/export?format=${format}&include_answers=${includeAnswers}`;
        return url; // Return URL for download link
    },

    /**
     * Download quiz export
     */
    downloadExport: async (quizId: string, format: 'md' | 'json' | 'study' = 'md', includeAnswers = true) => {
        const response = await fetch(
            `${API_BASE}/quizzes/${quizId}/export?format=${format}&include_answers=${includeAnswers}`
        );
        if (!response.ok) throw new Error('Export failed');
        return response;
    },
};

// ============================================
// Games API (Kahoot-style)
// ============================================

export const gamesApi = {
    /**
     * Create a new game from a quiz
     */
    create: (token: string, quizId: string, options?: {
        sync_mode?: boolean;
        show_leaderboard_after_each?: boolean;
        randomize_questions?: boolean;
    }) =>
        fetchApi<{
            id: string;
            game_code: string;
            quiz_title: string;
            status: string;
        }>('/games', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ quiz_id: quizId, ...options }),
        }),

    /**
     * Join a game (no auth needed - Kahoot style!)
     */
    join: (gameCode: string, nickname: string, avatar?: string) =>
        fetchApi<{
            player_id: string;
            game_id: string;
            nickname: string;
        }>('/games/join', {
            method: 'POST',
            body: JSON.stringify({ game_code: gameCode, nickname, avatar }),
        }),

    /**
     * Get game by code (check if joinable)
     */
    getByCode: (gameCode: string) =>
        fetchApi<{
            game_id: string;
            game_code: string;
            quiz_title: string;
            status: string;
            player_count: number;
        }>(`/games/code/${gameCode}`),

    /**
     * Get game state
     */
    getState: (gameId: string) =>
        fetchApi<{
            id: string;
            game_code: string;
            status: string;
            current_question_index: number;
            total_questions: number;
            players: Array<{ nickname: string; score: number }>;
        }>(`/games/${gameId}`),

    /**
     * Start a game (host only)
     */
    start: (token: string, gameId: string) =>
        fetchApi<{ message: string; status: string }>(`/games/${gameId}/start`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        }),

    /**
     * Advance to next question (host only)
     */
    next: (token: string, gameId: string) =>
        fetchApi<{ message: string; status: string }>(`/games/${gameId}/next`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        }),

    /**
     * Submit an answer (player) with optional confidence and reasoning
     */
    submitAnswer: (gameId: string, playerId: string, answer: string, timeTaken: number, confidence?: number, reasoning?: string) =>
        fetchApi<{ is_correct: boolean; points_earned: number; total_score: number; correct_answer: string }>(`/games/${gameId}/answer`, {
            method: 'POST',
            body: JSON.stringify({
                player_id: playerId,
                answer,
                time_taken: timeTaken,
                confidence,
                reasoning
            }),
        }),

    /**
     * Get player learning analytics for a game
     */
    getPlayerAnalytics: (gameId: string, playerId: string) =>
        fetchApi<{
            player_id: string;
            game_id: string;
            nickname: string;
            total_score: number;
            rank: number;
            accuracy: number;
            avg_confidence: number;
            quadrants: {
                confident_correct: number;
                confident_incorrect: number;
                uncertain_correct: number;
                uncertain_incorrect: number;
            };
            misconceptions: Array<{
                question_text: string;
                student_answer: string;
                correct_answer: string;
                confidence: number;
                severity: string;
            }>;
            calibration: {
                status: string;
                gap: number;
                message: string;
            };
            personalized_tips: string[];
        }>(`/games/${gameId}/players/${playerId}/analytics`),

    /**
     * Export game results
     * @param format - 'md' (markdown), 'json', or 'csv'
     */
    exportResults: (gameId: string, format: 'md' | 'json' | 'csv' = 'md') => {
        const url = `${API_BASE}/games/${gameId}/export?format=${format}`;
        return url;
    },

    /**
     * Download game results export
     */
    downloadResults: async (gameId: string, format: 'md' | 'json' | 'csv' = 'md') => {
        const response = await fetch(`${API_BASE}/games/${gameId}/export?format=${format}`);
        if (!response.ok) throw new Error('Export failed');
        return response;
    },
};

// ============================================
// Code Execution API (LeetCode-style with Judge0)
// ============================================

export interface TestCaseInput {
    input: string;
    expected_output: string;
    is_hidden?: boolean;
}

export interface TestCaseResult {
    test_case_index: number;
    input: string;
    expected_output: string;
    actual_output: string;
    status: 'passed' | 'failed' | 'error' | 'timeout' | 'runtime_error' | 'compilation_error' | 'pending' | 'processing';
    execution_time_ms: number;
    memory_kb?: number;
    error_message?: string;
    is_hidden: boolean;
}

export interface CodeExecutionResult {
    status: 'passed' | 'failed' | 'error' | 'timeout' | 'runtime_error' | 'compilation_error';
    passed_count: number;
    total_count: number;
    test_results: TestCaseResult[];
    overall_time_ms: number;
    error_message?: string;
    all_passed: boolean;
    score_percent: number;
}

export interface CodeHealthCheck {
    status: 'healthy' | 'unhealthy' | 'unknown';
    execution_engine: 'judge0' | 'local';
    api_url?: string;
    details?: {
        status: string;
        judge0?: {
            version?: string;
            homepage?: string;
        };
    };
    warning?: string;
}

export interface LanguageInfo {
    id: string;
    name: string;
    extension: string;
    judge0_id?: number;
    default_template: string;
}

export interface LanguagesResponse {
    languages: LanguageInfo[];
    allowed_languages: string[];
    execution_engine: 'judge0' | 'local';
    total_supported: number;
}

export const codeApi = {
    /**
     * Run code against test cases (sequential execution)
     */
    runCode: (code: string, language: string, testCases: TestCaseInput[], functionName = 'solution', driverCode?: string) =>
        fetchApi<CodeExecutionResult>('/code/run', {
            method: 'POST',
            body: JSON.stringify({
                code,
                language,
                test_cases: testCases,
                function_name: functionName,
                driver_code: driverCode,
            }),
        }),

    /**
     * Run code against test cases (batch execution - faster for multiple tests)
     */
    runCodeBatch: (code: string, language: string, testCases: TestCaseInput[], functionName = 'solution', driverCode?: string) =>
        fetchApi<CodeExecutionResult>('/code/run/batch', {
            method: 'POST',
            body: JSON.stringify({
                code,
                language,
                test_cases: testCases,
                function_name: functionName,
                driver_code: driverCode,
            }),
        }),

    /**
     * Validate code syntax
     */
    validateCode: (code: string, language: string) =>
        fetchApi<{ valid: boolean; error?: string; line?: number }>('/code/validate', {
            method: 'POST',
            body: JSON.stringify({ code, language, test_cases: [] }),
        }),

    /**
     * Get supported languages
     */
    getLanguages: () =>
        fetchApi<LanguagesResponse>('/code/languages'),

    /**
     * Check code execution service health (Judge0 status)
     */
    healthCheck: () =>
        fetchApi<CodeHealthCheck>('/code/health'),

    /**
     * Generate test cases using AI
     */
    generateTestCases: (problem: string, functionSignature: string, numCases = 5) =>
        fetchApi<{ test_cases: Array<TestCaseInput & { description?: string }> }>('/code/generate-test-cases', {
            method: 'POST',
            body: JSON.stringify({ problem, function_signature: functionSignature, num_cases: numCases }),
        }),
};

// ============================================
// Student Learning API
// ============================================

export interface LearningProfile {
    user_id: string;
    name: string;
    total_games_played: number;
    total_questions_answered: number;
    overall_accuracy: number;
    avg_confidence: number;
    calibration_status: string;
    learning_streak: number;
    concepts_mastered: string[];
    concepts_in_progress: string[];
    misconceptions: Array<{
        concept: string;
        description: string;
        occurrence_count: number;
        last_seen: string;
    }>;
    recent_games: Array<{
        game_id: string;
        quiz_title: string;
        score: number;
        rank: number;
        accuracy: number;
        played_at: string;
    }>;
    review_queue: Array<{
        concept: string;
        due_date: string;
        priority: string;
    }>;
    strengths: string[];
    weaknesses: string[];
}

export interface MasteryItem {
    concept: string;
    mastery_score: number;
    total_attempts: number;
    correct_attempts: number;
    last_practiced: string;
}

export interface ReviewQueueItem {
    concept: string;
    due_date: string;
    priority: string;
    interval_days?: number;
    ease_factor?: number;
}

export const studentApi = {
    /**
     * Get student's learning profile
     */
    getProfile: (token: string) =>
        fetchApi<LearningProfile>('/students/profile', {
            headers: { Authorization: `Bearer ${token}` },
        }),

    /**
     * Get student's concept mastery levels
     */
    getMastery: (token: string) =>
        fetchApi<{ user_id: string; mastery: MasteryItem[] }>('/students/mastery', {
            headers: { Authorization: `Bearer ${token}` },
        }),

    /**
     * Get student's spaced repetition review queue
     */
    getReviewQueue: (token: string) =>
        fetchApi<{ user_id: string; due_count: number; items: ReviewQueueItem[] }>('/students/review-queue', {
            headers: { Authorization: `Bearer ${token}` },
        }),

    /**
     * Mark a concept as reviewed with quality rating (SM-2 algorithm)
     */
    completeReview: (token: string, concept: string, quality: number) =>
        fetchApi<{
            concept: string;
            quality: number;
            next_review_at: string;
            interval_days: number;
            ease_factor: number;
        }>(`/students/review-complete?concept=${encodeURIComponent(concept)}&quality=${quality}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        }),
};

// ============================================
// Learn API (Conversational Adaptive Learning)
// ============================================

export interface LearnSessionResponse {
    session_id: string;
    messages: Array<{ role: string; content: string; action?: string; agent?: string }>;
    question?: {
        id: string;
        prompt: string;
        options: string[];
        concept: string;
        difficulty: number;
    };
    plan?: { concepts: string[]; starting_difficulty: number; session_type: string; rationale: string };
    phase: string;
}

export interface LearnAnswerResponse {
    session_id: string;
    assessment: {
        is_correct: boolean;
        correct_answer: string;
        explanation: string;
        quadrant: string;
    };
    action: string;
    message: string;
    agent?: string;
    question?: {
        id: string;
        prompt: string;
        options: string[];
        concept: string;
        difficulty: number;
    };
    lesson?: { title: string; content: string; concept: string };
    phase: string;
    progress: {
        questions_answered: number;
        questions_correct: number;
        accuracy: number;
        current_concept?: string;
        concepts_remaining: number;
    };
}

export interface LearnMessageResponse {
    session_id: string;
    action: string;
    message: string;
    agent?: string;
    discussion_phase?: string;
    ready_to_retry?: boolean;
    question?: {
        id: string;
        prompt: string;
        options: string[];
        concept: string;
        difficulty: number;
    };
}

export interface LearnEndResponse {
    session_id: string;
    action: string;
    message: string;
    summary: {
        questions_answered: number;
        questions_correct: number;
        accuracy: number;
        concepts_covered: string[];
        mastery_updates: Array<{ concept: string; score: number }>;
        duration_minutes: number;
    };
}

export interface PaginationParams {
    limit?: number;
    offset?: number;
}

export interface PaginationMeta {
    offset: number;
    limit: number;
    total: number;
}

export interface LearnProgressResponse {
    student_name: string;
    mastery: Array<{
        concept: string;
        score: number;
        attempts: number;
        correct: number;
        last_seen: string | null;
    }>;
    recent_sessions: Array<{
        id: string;
        topic: string;
        phase: string;
        questions_answered: number;
        questions_correct: number;
        accuracy: number;
        started_at: string | null;
        ended_at: string | null;
    }>;
    summary: {
        total_concepts: number;
        mastered: number;
        in_progress: number;
        needs_work: number;
    };
    pagination?: PaginationMeta;
}

export interface LeaderboardEntry {
    rank: number;
    student_name: string;
    total_xp: number;
    level: number;
    sessions_played: number;
    total_correct: number;
    total_answered: number;
    accuracy: number;
    best_streak: number;
    is_current_user: boolean;
}

export interface LeaderboardResponse {
    period: string;
    entries: LeaderboardEntry[];
    current_user_rank: number | null;
    total_players: number;
    pagination?: PaginationMeta;
}

// ============================================
// Question History Types
// ============================================

export interface QuestionHistoryItem {
    id: string;
    session_id: string;
    prompt: string;
    options: string[];
    correct_answer: string;
    student_answer: string;
    is_correct: boolean;
    confidence: number;
    explanation: string | null;
    concept: string;
    difficulty: number;
    topic: string;
    mode: string;
    answered_at: string;
}

export interface QuestionHistorySessionSummary {
    session_id: string;
    topic: string;
    mode: string;
    questions_answered: number;
    questions_correct: number;
    accuracy: number;
    started_at: string | null;
    ended_at: string | null;
}

export const learnApi = {
    getLeaderboard: (period: "weekly" | "alltime", studentName: string, pagination?: PaginationParams) => {
        const params = new URLSearchParams({ period, student_name: studentName });
        if (pagination?.limit !== undefined) params.set('limit', String(pagination.limit));
        if (pagination?.offset !== undefined) params.set('offset', String(pagination.offset));
        return fetchApiAuth<LeaderboardResponse>(`/learn/leaderboard?${params.toString()}`);
    },

    startSession: (topic: string, studentName: string, studentId?: string) =>
        fetchApiAuth<LearnSessionResponse>('/learn/session/start', {
            method: 'POST',
            body: JSON.stringify({ topic, student_name: studentName, student_id: studentId }),
        }),

    submitAnswer: (sessionId: string, answer: string, confidence: number) =>
        fetchApiAuth<LearnAnswerResponse>(`/learn/session/${sessionId}/answer`, {
            method: 'POST',
            body: JSON.stringify({ answer, confidence }),
        }),

    sendMessage: (sessionId: string, message: string) =>
        fetchApiAuth<LearnMessageResponse>(`/learn/session/${sessionId}/message`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        }),

    endSession: (sessionId: string) =>
        fetchApiAuth<LearnEndResponse>(`/learn/session/${sessionId}/end`, {
            method: 'POST',
        }),

    getReviewQueue: (studentName: string) =>
        fetchApiAuth<{ student_name: string; due_count: number; items: Array<{
            id: string; concept: string; due_at: string; interval_days: number;
            ease_factor: number; question_template: Record<string, unknown>;
        }> }>(`/learn/review-queue?student_name=${encodeURIComponent(studentName)}`),

    getProgress: (studentName: string, pagination?: PaginationParams) => {
        const params = new URLSearchParams({ student_name: studentName });
        if (pagination?.limit !== undefined) params.set('limit', String(pagination.limit));
        if (pagination?.offset !== undefined) params.set('offset', String(pagination.offset));
        return fetchApiAuth<LearnProgressResponse>(`/learn/progress?${params.toString()}`);
    },

    getHistory: (studentName: string, studentId?: string) =>
        fetchApiAuth<LearningHistoryResponse>(`/learn/history?student_name=${encodeURIComponent(studentName)}${studentId ? `&student_id=${encodeURIComponent(studentId)}` : ''}`),

    deleteSubject: (subject: string, studentName: string) =>
        fetchApiAuth<{ ok: boolean; deleted: { sessions: number; syllabi: number; resources: number } }>(
            `/learn/subject/${encodeURIComponent(subject)}?student_name=${encodeURIComponent(studentName)}`,
            { method: 'DELETE' },
        ),

    getCalibration: (studentName: string, subject?: string) =>
        fetchApiAuth<CalibrationResponse>(
            `/learn/scroll/calibration/${encodeURIComponent(studentName)}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`,
        ),

    getQuestionHistory: (studentName: string, filters?: { topic?: string; concept?: string; is_correct?: boolean; mode?: string }, pagination?: PaginationParams) => {
        const params = new URLSearchParams({ student_name: studentName });
        if (filters?.topic) params.set('topic', filters.topic);
        if (filters?.concept) params.set('concept', filters.concept);
        if (filters?.is_correct !== undefined) params.set('is_correct', String(filters.is_correct));
        if (filters?.mode) params.set('mode', filters.mode);
        if (pagination?.limit !== undefined) params.set('limit', String(pagination.limit));
        if (pagination?.offset !== undefined) params.set('offset', String(pagination.offset));
        return fetchApiAuth<{ items: QuestionHistoryItem[]; pagination: PaginationMeta }>(`/learn/question-history?${params.toString()}`);
    },

    getQuestionHistorySessions: (studentName: string, pagination?: PaginationParams) => {
        const params = new URLSearchParams({ student_name: studentName });
        if (pagination?.limit !== undefined) params.set('limit', String(pagination.limit));
        if (pagination?.offset !== undefined) params.set('offset', String(pagination.offset));
        return fetchApiAuth<{ sessions: QuestionHistorySessionSummary[]; pagination: PaginationMeta }>(`/learn/question-history/sessions?${params.toString()}`);
    },

    getSessionQuestions: (sessionId: string) =>
        fetchApiAuth<{ session_id: string; items: QuestionHistoryItem[] }>(`/learn/question-history/session/${sessionId}`),
};

export interface SubjectHistory {
    subject: string;
    total_sessions: number;
    total_questions: number;
    accuracy: number;
    total_xp: number;
    last_studied_at: string | null;
    has_syllabus: boolean;
}

export interface ResumeSessionInfo {
    session_id: string;
    topic: string;
    questions_answered: number;
    questions_correct: number;
    total_xp: number;
    streak: number;
    accuracy: number;
}

export interface LearningHistoryResponse {
    subjects: SubjectHistory[];
    overall: {
        total_subjects: number;
        total_sessions: number;
        total_questions: number;
        total_xp: number;
        concepts_mastered: number;
    };
    active_session?: ResumeSessionInfo;
    suggestions?: string[];
}

export interface CalibrationBucket {
    range: string;
    midpoint: number;
    count: number;
    accuracy: number;
}

export interface DKConcept {
    concept: string;
    avg_confidence: number;
    accuracy: number;
    dk_score: number;
}

export interface CalibrationResponse {
    calibration: {
        buckets: CalibrationBucket[];
        brier_score: number;
        ece: number;
        overconfidence_index: number;
        total_responses: number;
    };
    dk_concepts: DKConcept[];
}

// ============================================
// Scroll (TikTok Mode) API
// ============================================

export interface ScrollCard {
    id: string;
    prompt: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    concept: string;
    difficulty: number;
    card_type: string;
    is_reintroduction: boolean;
    xp_value: number;
    content_item_id?: string;
    // Flashcard-specific
    flashcard_front?: string;
    flashcard_back?: string;
    flashcard_hint?: string;
    // Info card-specific
    info_title?: string;
    info_body?: string;
    info_takeaway?: string;
    // Resource card-specific
    resource_title?: string;
    resource_url?: string;
    resource_type?: string;
    resource_thumbnail?: string;
    resource_description?: string;
    resource_duration?: string;
    resource_channel?: string;
    resource_domain?: string;
}

export interface ScrollStats {
    streak: number;
    best_streak: number;
    total_xp: number;
    difficulty: number;
    cards_shown: number;
}

export interface CalibrationNudge {
    type: string;
    message: string;
    confidence_avg: number;
    accuracy: number;
    gap: number;
}

export interface ScrollAnalytics {
    concept: string;
    concept_accuracy: number;
    concept_attempts: number;
    improvement_areas: string[];
    strengths: string[];
    difficulty_trend: 'harder' | 'easier' | 'stable';
    calibration_nudge?: CalibrationNudge;
}

export interface ScrollSessionAnalytics {
    session_id: string;
    total_questions: number;
    total_correct: number;
    accuracy: number;
    streak: number;
    best_streak: number;
    total_xp: number;
    current_difficulty: number;
    concepts: Array<{
        concept: string;
        attempts: number;
        correct: number;
        accuracy: number;
        status: string;
    }>;
    improvement_areas: string[];
    strengths: string[];
    engagement: {
        cards_shown: number;
        avg_time_ms: number;
        fast_answers: number;
        slow_answers: number;
        reintroductions_queued: number;
    };
}

// ============================================
// Syllabus / Skill Tree API
// ============================================

import type { SyllabusTree } from "~/stores/scrollSessionStore";

export interface BKTMasteryState {
    p_learned: number;
    mastery_pct: number;
    confidence: number;
    total_parameters: {
        p_guess: number;
        p_slip: number;
        p_transit: number;
    };
}

export interface RecommendedPathResponse {
    subject: string;
    student_name: string;
    next: string | null;
    path: string[];
    unlockable: string[];
}

export const syllabusApi = {
    generate: (subject: string, studentId?: string) =>
        fetchApiAuth<SyllabusTree>('/learn/syllabus/generate', {
            method: 'POST',
            body: JSON.stringify({ subject, student_id: studentId }),
        }),

    get: (subject: string, studentId?: string) =>
        fetchApiAuth<SyllabusTree>(
            `/learn/syllabus/${encodeURIComponent(subject)}${studentId ? `?student_id=${encodeURIComponent(studentId)}` : ''}`
        ),

    getPresence: (subject: string) =>
        fetchApiAuth<Record<string, { count: number; names: string[] }>>(
            `/learn/presence/${encodeURIComponent(subject)}`
        ),

    heartbeat: (subject: string, nodeId: string, studentName: string) =>
        fetchApiAuth<{ ok: boolean }>('/learn/presence/heartbeat', {
            method: 'POST',
            body: JSON.stringify({ subject, node_id: nodeId, student_name: studentName }),
        }),

    getMastery: (studentName: string) =>
        fetchApiAuth<{ student_name: string; concepts: Record<string, BKTMasteryState> }>(
            `/learn/mastery/${encodeURIComponent(studentName)}`
        ),

    getRecommendedPath: (subject: string, studentName: string) =>
        fetchApiAuth<RecommendedPathResponse>(
            `/learn/recommended-path/${encodeURIComponent(subject)}?student_name=${encodeURIComponent(studentName)}`
        ),
};

// ============================================
// Resources API (Subject Resource Upload)
// ============================================

export const resourcesApi = {
    upload: async (formData: FormData): Promise<ApiResult<{
        resources: Array<{ id: string | null; file_name: string; concepts_count: number; summary_preview: string }>;
        total_concepts: number;
    }>> => {
        try {
            let authHeaders: Record<string, string> = {};
            try {
                const token = await window.Clerk?.session?.getToken();
                if (token) {
                    authHeaders = { Authorization: `Bearer ${token}` };
                }
            } catch {}
            const response = await fetch(`${API_BASE}/learn/resources/upload`, {
                method: 'POST',
                headers: authHeaders,
                body: formData, // Don't set Content-Type for FormData
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                return { success: false, error: typeof error.detail === 'string' ? error.detail : 'Upload failed' };
            }
            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Network error' };
        }
    },

    list: (subject: string, studentId?: string) =>
        fetchApiAuth<{ resources: Array<{ id: string; file_name: string; file_type: string; concepts_count: number; summary_preview: string; created_at: string }> }>(
            `/learn/resources/${encodeURIComponent(subject)}${studentId ? `?student_id=${studentId}` : ''}`
        ),

    delete: (resourceId: string) =>
        fetchApiAuth<{ ok: boolean }>(`/learn/resources/${resourceId}`, { method: 'DELETE' }),

    regenerateSyllabus: (subject: string, studentId?: string) =>
        fetchApiAuth<SyllabusTree>('/learn/syllabus/regenerate', {
            method: 'POST',
            body: JSON.stringify({ subject, student_id: studentId }),
        }),

    pdfToSyllabus: async (formData: FormData): Promise<ApiResult<{
        subject: string;
        syllabus: SyllabusTree;
        resources: Array<{ id: string | null; file_name: string; concepts_count: number; summary_preview: string }>;
        total_concepts: number;
    }>> => {
        try {
            let authHeaders: Record<string, string> = {};
            try {
                const token = await window.Clerk?.session?.getToken();
                if (token) {
                    authHeaders = { Authorization: `Bearer ${token}` };
                }
            } catch {}
            const response = await fetch(`${API_BASE}/learn/pdf-to-syllabus`, {
                method: 'POST',
                headers: authHeaders,
                body: formData,
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                return { success: false, error: typeof error.detail === 'string' ? error.detail : 'Upload failed' };
            }
            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Network error' };
        }
    },
};

export const scrollApi = {
    resumeFeed: (topic: string, studentName: string) =>
        fetchApiAuth<{
            session_id: string;
            topic: string;
            concepts: string[];
            cards: ScrollCard[];
            stats: ScrollStats;
            resumed: boolean;
        }>('/learn/scroll/resume', {
            method: 'POST',
            body: JSON.stringify({ topic, student_name: studentName }),
            retry: false, // Don't retry 404s
        }),

    startFeed: (
        topic: string,
        studentName: string,
        studentId?: string,
        notes?: string,
        preferences?: {
            difficulty?: number | null;
            content_mix?: { mcq: number; flashcard: number; info_card: number };
            question_style?: string | null;
        },
    ) =>
        fetchApiAuth<{
            session_id: string;
            topic: string;
            concepts: string[];
            cards: ScrollCard[];
            stats: ScrollStats;
        }>('/learn/scroll/start', {
            method: 'POST',
            body: JSON.stringify({ topic, student_name: studentName, student_id: studentId, notes, preferences }),
        }),

    submitAnswer: (sessionId: string, answer: string, timeMs: number, contentItemId?: string, correctAnswer?: string, confidence?: number, cardData?: { prompt?: string; options?: string[]; explanation?: string; concept?: string }) =>
        fetchApiAuth<{
            session_id: string;
            is_correct: boolean;
            xp_earned: number;
            streak: number;
            best_streak: number;
            streak_broken: boolean;
            total_xp: number;
            difficulty: number;
            next_cards: ScrollCard[];
            analytics: ScrollAnalytics;
            stats: ScrollStats;
        }>(`/learn/scroll/${sessionId}/answer`, {
            method: 'POST',
            body: JSON.stringify({ answer, time_ms: timeMs, content_item_id: contentItemId, correct_answer: correctAnswer, confidence, ...cardData }),
        }),

    getNextCards: (sessionId: string, count = 3) =>
        fetchApiAuth<{
            session_id: string;
            cards: ScrollCard[];
            stats: ScrollStats;
        }>(`/learn/scroll/${sessionId}/next?count=${count}`),

    getAnalytics: (sessionId: string) =>
        fetchApiAuth<ScrollSessionAnalytics>(`/learn/scroll/${sessionId}/analytics`),

    skipCard: (sessionId: string, contentItemId: string, reason: string = 'skipped') =>
        fetchApiAuth<{
            session_id: string;
            cards: ScrollCard[];
            stats: ScrollStats;
        }>(`/learn/scroll/${sessionId}/skip`, {
            method: 'POST',
            body: JSON.stringify({ content_item_id: contentItemId, reason }),
        }),

    flipFlashcard: (sessionId: string, contentItemId: string, timeToFlipMs: number, rating: number) =>
        fetchApiAuth<{
            xp_earned: number;
            stats: ScrollStats;
        }>(`/learn/scroll/${sessionId}/flashcard-flip`, {
            method: 'POST',
            body: JSON.stringify({
                content_item_id: contentItemId,
                time_to_flip_ms: timeToFlipMs,
                self_rated_knowledge: rating,
            }),
        }),

    sendHelpMessage: (sessionId: string, message: string, cardContext: object) =>
        fetchApiAuth<{ message: string; phase: string; ready_to_try: boolean }>(
            `/learn/scroll/${sessionId}/help`,
            { method: 'POST', body: JSON.stringify({ message, card_context: cardContext }) },
        ),

    pregenContent: (topic: string, concepts: string[], subject?: string) =>
        fetchApiAuth<{ status: string; total_items?: number }>('/learn/content/pregen', {
            method: 'POST',
            body: JSON.stringify({ topic, concepts, subject }),
            retry: false,
        }),

    getPoolStatus: (topic: string) =>
        fetchApiAuth<{
            topic: string;
            total_items: number;
            by_type: Record<string, number>;
            concepts: string[];
        }>(`/learn/content/pool-status?topic=${encodeURIComponent(topic)}`),
};

// ============================================
// Assessment API
// ============================================

export interface AssessmentSelfRatingItem {
    concept: string;
    topic_id: string;
    topic_name: string;
    unit_name: string;
}

export interface AssessmentStartResponse {
    subject: string;
    student_name: string;
    self_rating_items: AssessmentSelfRatingItem[];
    total_concepts: number;
    instructions: string;
}

export interface AssessmentSelfRatingsResponse {
    assessment_id: string;
    subject: string;
    diagnostic_questions: Array<Record<string, unknown>>;
    total_questions: number;
    concepts_assessed: number;
    initial_familiarity: number;
}

export interface AssessmentDiagnosticResponse {
    assessment_id: string;
    subject: string;
    diagnostic_results: Array<{ concept: string; answer: string; is_correct: boolean; time_ms: number }>;
    diagnostic_accuracy: number;
    total_questions: number;
    correct_count: number;
    overall_familiarity: number;
    completed: boolean;
}

export interface AssessmentResult {
    id: string;
    subject: string;
    student_name: string;
    self_ratings: Array<{ concept: string; rating: number }>;
    diagnostic_results: Array<{ concept: string; answer: string; is_correct: boolean; time_ms: number }> | null;
    overall_familiarity: number;
    diagnostic_accuracy: number | null;
    concepts_assessed: number;
    completed: boolean;
    created_at: string | null;
}

export const assessmentApi = {
    start: (subject: string, studentName: string) =>
        fetchApiAuth<AssessmentStartResponse>('/learn/assessment/start', {
            method: 'POST',
            body: JSON.stringify({ subject, student_name: studentName }),
        }),

    submitSelfRatings: (subject: string, studentName: string, ratings: Array<{ concept: string; rating: number }>) =>
        fetchApiAuth<AssessmentSelfRatingsResponse>('/learn/assessment/self-ratings', {
            method: 'POST',
            body: JSON.stringify({ subject, student_name: studentName, ratings }),
        }),

    submitDiagnostic: (studentName: string, assessmentId: string, answers: Array<{ concept: string; answer: string; correct_answer: string; time_ms: number }>) =>
        fetchApiAuth<AssessmentDiagnosticResponse>('/learn/assessment/diagnostic', {
            method: 'POST',
            body: JSON.stringify({ student_name: studentName, assessment_id: assessmentId, answers }),
        }),

    getAssessment: (subject: string, studentName: string) =>
        fetchApiAuth<AssessmentResult>(`/learn/assessment/${encodeURIComponent(subject)}?student_name=${encodeURIComponent(studentName)}`),
};

// ============================================
// Codebase Analysis API
// ============================================

export interface CodebaseAnalysisResponse {
    analysis_id: string;
    analysis: {
        repo_name: string;
        tech_stack: string[];
        architecture: string;
        key_patterns: string[];
        learning_topics: Array<{ topic: string; description: string; complexity: string; order: number }>;
        estimated_complexity: string;
        learning_path_summary: string;
    };
    tech_stack: string[];
    syllabus?: { subject: string; units: Array<{ id: string; name: string; order: number; icon: string; topics: Array<{ id: string; name: string; order: number; concepts: string[]; prerequisites: string[]; estimated_minutes: number }> }> };
    syllabus_subject: string;
    cached: boolean;
}

export const codebaseApi = {
    analyze: (githubUrl: string, studentId?: string) =>
        fetchApiAuth<CodebaseAnalysisResponse>('/learn/codebase/analyze', {
            method: 'POST',
            body: JSON.stringify({ github_url: githubUrl, student_id: studentId }),
        }),

    getAnalysis: (analysisId: string) =>
        fetchApiAuth<{
            id: string;
            github_url: string;
            repo_name: string;
            analysis: Record<string, unknown>;
            tech_stack: string[];
            syllabus_subject: string;
            created_at: string;
        }>(`/learn/codebase/${analysisId}`),

    getResources: (analysisId: string, technology?: string) =>
        fetchApiAuth<{
            analysis_id: string;
            resources: Array<{ concept: string; title: string; url: string; source_type: string; description: string; external_domain: string }>;
        }>(`/learn/codebase/${analysisId}/resources${technology ? `?technology=${encodeURIComponent(technology)}` : ''}`),
};

// ============================================
// Curated Resources API
// ============================================

export const curatedResourcesApi = {
    list: (subject: string, concept?: string, resourceType?: string, limit = 10) => {
        const params = new URLSearchParams();
        if (concept) params.set('concept', concept);
        if (resourceType) params.set('resource_type', resourceType);
        params.set('limit', String(limit));
        return fetchApiAuth<{
            subject: string;
            resources: Array<{
                id: string;
                concept: string;
                title: string;
                url: string;
                source_type: string;
                thumbnail_url: string;
                description: string;
                duration: string;
                channel: string;
                difficulty_label: string;
                relevance_score: number;
                external_domain: string;
            }>;
        }>(`/learn/resources/curated/${encodeURIComponent(subject)}?${params.toString()}`);
    },

    triggerCuration: (topic: string, concepts: string[]) =>
        fetchApiAuth<{ status: string }>('/learn/resources/curate', {
            method: 'POST',
            body: JSON.stringify({ topic, concepts }),
        }),
};

// ============================================
// Skill Tree Analysis API
// ============================================

export interface SkillTreeAnalysisWeakness {
    concept: string;
    mastery_score: number;
    total_attempts: number;
    active_misconceptions: Array<{ type: string; severity: string; count: number }>;
    is_overdue: boolean;
}

export interface SkillTreeAnalysisResponse {
    overall_mastery_pct: number;
    trend: "improving" | "stable" | "declining";
    summary: {
        mastered: number;
        in_progress: number;
        struggling: number;
        overdue: number;
    };
    weaknesses: SkillTreeAnalysisWeakness[];
    strengths: Array<{ concept: string; mastery_score: number; best_streak: number }>;
    misconceptions_summary: Array<{
        concept: string;
        misconception: string;
        occurrence_count: number;
        severity: string;
        first_seen_at: string | null;
    }>;
    ai_insights: {
        summary: string;
        recommendations: string[];
        overconfidence_alerts: string[];
        pattern_insights: string[];
    };
    mastery_timeline: Array<{ date: string; overall: number }>;
}

export const skillTreeAnalysisApi = {
    get: (subject: string, studentName: string) =>
        fetchApiAuth<SkillTreeAnalysisResponse>(
            `/learn/skill-tree-analysis/${encodeURIComponent(subject)}?student_name=${encodeURIComponent(studentName)}`
        ),
};

export default api;

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================
// Helper Functions
// ============================================

async function fetchApi<T>(
    endpoint: string,
    options?: RequestInit
): Promise<ApiResult<T>> {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            return { success: false, error: error.detail || `HTTP ${response.status}` };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error'
        };
    }
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
     * Submit an answer (player)
     */
    submitAnswer: (gameId: string, playerId: string, answer: string, timeTaken: number) =>
        fetchApi<{ is_correct: boolean; points_earned: number }>(`/games/${gameId}/answer`, {
            method: 'POST',
            body: JSON.stringify({ player_id: playerId, answer, time_taken: timeTaken }),
        }),

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

export default api;

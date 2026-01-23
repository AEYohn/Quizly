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
    generateQuestions: (topic: string, numQuestions = 4, concepts?: string[]) =>
        fetchApi<{ topic: string; questions: Question[] }>('/ai/generate-questions', {
            method: 'POST',
            body: JSON.stringify({
                topic,
                num_questions: numQuestions,
                concepts: concepts?.map((c, i) => ({ id: `c_${i}`, name: c })) || [],
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

export default api;

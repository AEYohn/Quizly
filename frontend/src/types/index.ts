/**
 * Quizly API Types
 * TypeScript interfaces for the Quizly API
 */

// ============================================
// Questions
// ============================================

export interface Question {
    id: string;
    concept: string;
    prompt: string;
    options: string[];
    correct_answer: string;
    difficulty: number;
    explanation: string;
    status?: 'pending' | 'approved' | 'rejected';
    source?: string;
    question_type?: 'conceptual' | 'application' | 'analysis' | 'transfer';
    target_misconception?: string;
    misconception_trap_option?: string;
}

export interface QuestionGenerateRequest {
    topic: string;
    concepts?: ConceptInput[];
    num_questions?: number;
    course_context?: string;
    question_type?: 'conceptual' | 'application' | 'analysis' | 'transfer';
    target_misconception?: string;
}

export interface ConceptInput {
    id: string;
    name: string;
    topics?: string[];
    misconceptions?: string[];
}

// ============================================
// Sessions
// ============================================

export interface ActiveSessionInfo {
    active: boolean;
    session_id?: string;
    topic?: string;
    num_questions: number;
    updated_at?: string;
}

export interface LiveSessionStartRequest {
    topic: string;
    questions: Question[];
    objectives: string[];
}

export interface LiveSessionResponse {
    session_id: string;
    topic: string;
    status: 'active' | 'paused' | 'completed' | 'waiting';
    questions: Question[];
    current_question_index: number;
    student_count: number;
    started_at: string;
    updated_at: string;
}

export interface StudentJoinResponse {
    session_id: string;
    topic: string;
    student_name: string;
    num_questions: number;
    current_question_index: number;
    current_question: Question | null;
}

export interface SessionStatus {
    session_id: string;
    topic: string;
    status: 'active' | 'paused' | 'completed' | 'waiting';
    current_question_index: number;
    total_questions: number;
    students_joined: string[];
    responses_count: number;
    last_updated: string;
}

export interface SessionListItem {
    session_id: string;
    topic: string;
    status: 'draft' | 'active' | 'completed' | 'waiting';
    created_at: string;
    num_questions: number;
    active: boolean;
    participant_count: number;
}

// ============================================
// Responses
// ============================================

export interface StudentSubmission {
    student_name: string;
    question_id: string;
    answer: string;
    reasoning?: string;
    confidence: number;
    response_type: 'mcq' | 'code' | 'image' | 'text';
    code_submission?: string;
    image_description?: string;
}

export interface QuestionResponses {
    question_id: string;
    responses: Record<string, {
        answer: string;
        reasoning?: string;
        confidence: number;
        response_type: string;
        submitted_at: string;
    }>;
    count: number;
}

// ============================================
// AI Analysis
// ============================================

export interface AnalyzeResponseRequest {
    question: Question;
    answer: string;
    reasoning?: string;
    confidence: number;
}

export interface AnalyzeResponseResult {
    is_correct: boolean;
    reasoning_score: number;
    strengths: string[];
    misconceptions: string[];
    tips: string[];
    feedback_message: string;
}

export interface PeerDiscussion {
    peer_name: string;
    peer_answer: string;
    peer_reasoning: string;
    discussion_prompt: string;
    insight: string;
}

// ============================================
// Curriculum
// ============================================

export interface MaterialProcessResponse {
    status: string;
    topic: string;
    concepts: string[];
    objectives: string[];
    extracted_questions: ExtractedQuestion[];
    summary: string;
    documents_processed: number;
}

export interface ExtractedQuestion {
    prompt: string;
    options: string[];
    correct_answer?: string;
    source?: string;
    concept?: string;
}

export interface GenerateFromCurriculumRequest {
    topic: string;
    concepts: string[];
    objectives?: string[];
    num_questions?: number;
    include_extracted?: boolean;
    materials_context?: string;
}

// ============================================
// API Response Wrapper
// ============================================

export interface ApiError {
    detail: string;
}

export type ApiResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

// ============================================
// Adaptive Learning Types
// ============================================

export interface DynamicThresholds {
    low_threshold: number;
    high_threshold: number;
    factors: {
        topic_difficulty: number;
        time_elapsed_ratio: number;
        historical_success: number;
        class_size: number;
    };
}

export interface ConfidenceCorrectnessAnalysis {
    quadrants: {
        high_confidence_correct: number;
        high_confidence_incorrect: number;
        low_confidence_correct: number;
        low_confidence_incorrect: number;
    };
    categories: {
        confident_correct: number;
        confident_incorrect: number;
        uncertain_correct: number;
        uncertain_incorrect: number;
    };
    students_by_category: {
        confident_correct: string[];
        confident_incorrect: string[];
        uncertain_correct: string[];
        uncertain_incorrect: string[];
    };
    misconception_rate: number;
    solid_understanding_rate: number;
    alert_level: 'normal' | 'warning' | 'critical' | 'good';
    recommendation: string;
    message: string;
    avg_confidence_correct: number;
    avg_confidence_incorrect: number;
    insights: string[];
}

export interface PeerPair {
    type: 'misconception_correction' | 'confidence_building';
    priority: 'high' | 'medium' | 'low';
    mentor: string;
    learner: string;
    reason: string;
    mentor_answer: string;
    learner_answer: string;
    discussion_prompt: string;
}

export interface PeerMatchingResult {
    pairs: PeerPair[];
    unpaired_students: string[];
    total_pairs: number;
    pairing_stats: {
        correct_confident: number;
        correct_uncertain: number;
        incorrect_confident: number;
        incorrect_uncertain: number;
    };
}

export interface InterventionCheck {
    needs_intervention: boolean;
    intervention_type: string;
    reason: string;
    suggested_action: string;
    severity: 'none' | 'medium' | 'high';
    triggers: {
        type: string;
        severity: string;
        message: string;
    }[];
    suggestions: string[];
    stats: {
        avg_confidence: number;
        discussion_duration: number;
        response_count: number;
    };
}

export interface DiscussionQuality {
    quality_score: number;
    quality_level: 'low' | 'medium' | 'high';
    reasoning_depth_score: number;
    vocabulary_score: number;
    engagement_score: number;
    learning_signals: {
        asked_why: number;
        gave_example: number;
        self_corrected: number;
        built_on_peer: number;
        expressed_confusion: number;
        expressed_insight: number;
    };
    vocabulary_used: string[];
    total_student_words: number;
    message_count: number;
    insights: string[];
}

export interface SessionPulse {
    session_id: string;
    question_id?: string;
    correctness_rate: number;
    entropy: number;
    avg_confidence: number;
    response_count: number;
    answer_distribution: Record<string, number>;
    recommended_action: 'move_on' | 'peer_discuss' | 'reteach' | 'clarify' | 'waiting';
    action_reason: string;
    engagement_score: number;
    accuracy_trend: number;
    pace_indicator: 'slow' | 'good' | 'fast';
    suggested_action?: string;
    confidence_correctness?: {
        confident_correct: number;
        confident_incorrect: number;
        uncertain_correct: number;
        uncertain_incorrect: number;
    };
    misconception_alert?: {
        level: 'warning' | 'critical';
        message: string;
        count: number;
    } | null;
}

export interface SessionAnalytics {
    session_id: string;
    topic: string;
    total_questions: number;
    total_responses: number;
    unique_students: number;
    avg_correctness: number;
    avg_confidence: number;
    concepts_covered: string[];
    per_question_metrics: QuestionMetrics[];
}

export interface QuestionMetrics {
    question_id: string;
    concept: string;
    prompt: string;
    response_count: number;
    correct_count: number;
    correctness_rate: number;
    avg_confidence: number;
    answer_distribution: Record<string, number>;
    entropy?: number;
}

export interface MisconceptionCluster {
    question_id: string;
    question_prompt: string;
    concept: string;
    clusters: {
        wrong_answer: string;
        count: number;
        percentage: number;
        students: string[];
        common_reasoning: string[];
    }[];
}

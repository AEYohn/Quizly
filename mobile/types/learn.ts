// ============================================
// Scroll Feed Types
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
  difficulty_trend: "harder" | "easier" | "stable";
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
// Learning History Types
// ============================================

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

// ============================================
// Leaderboard Types
// ============================================

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
}

// ============================================
// Feed Preferences
// ============================================

export interface FeedPreferences {
  difficulty: number | null; // null = auto, 0.0-1.0 = manual
  contentMix: {
    mcq: number;
    flashcard: number;
    info_card: number;
    resource_card: number;
  };
  questionStyle: string | null; // "conceptual" | "application" | "analysis" | "transfer" | null
}

export const PRESETS = {
  QUIZ_HEAVY: { mcq: 0.7, flashcard: 0.1, info_card: 0.1, resource_card: 0.1 },
  BALANCED: { mcq: 0.5, flashcard: 0.2, info_card: 0.15, resource_card: 0.15 },
  FLASHCARD_FOCUS: {
    mcq: 0.15,
    flashcard: 0.55,
    info_card: 0.15,
    resource_card: 0.15,
  },
} as const;

export const DEFAULT_PREFERENCES: FeedPreferences = {
  difficulty: null,
  contentMix: { ...PRESETS.BALANCED },
  questionStyle: null,
};

// ============================================
// Syllabus / Skill Tree Types
// ============================================

export interface SyllabusTopic {
  id: string;
  name: string;
  order: number;
  concepts: string[];
  prerequisites: string[];
  estimated_minutes: number;
}

export interface SyllabusUnit {
  id: string;
  name: string;
  order: number;
  icon: string;
  topics: SyllabusTopic[];
}

export interface SyllabusTree {
  subject: string;
  units: SyllabusUnit[];
}

// ============================================
// Learning Session Types (Conversational)
// ============================================

export type SessionAction =
  | "question"
  | "discuss"
  | "teach"
  | "celebrate"
  | "wrap_up"
  | "plan_update"
  | "diagnostic"
  | "waiting";

export type SessionPhase =
  | "idle"
  | "starting"
  | "diagnostic"
  | "learning"
  | "reviewing"
  | "ended";

export interface ChatMessage {
  id: string;
  role: "ai" | "student" | "system";
  content: string;
  timestamp: number;
  action?: SessionAction;
  question?: QuestionData;
  lesson?: LessonData;
  progress?: ProgressUpdate;
  agent?: string;
}

export interface QuestionData {
  id: string;
  prompt: string;
  options: string[];
  concept: string;
  difficulty: number;
}

export interface LessonData {
  title: string;
  content: string;
  concept: string;
}

export interface ProgressUpdate {
  conceptsMastered: string[];
  conceptsInProgress: string[];
  questionsAnswered: number;
  accuracy: number;
}

export interface ConceptMastery {
  concept: string;
  score: number;
  trend: "up" | "down" | "stable";
}

// ============================================
// Assessment Types
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
  diagnostic_results: Array<{
    concept: string;
    answer: string;
    is_correct: boolean;
    time_ms: number;
  }>;
  diagnostic_accuracy: number;
  total_questions: number;
  correct_count: number;
  overall_familiarity: number;
  completed: boolean;
}

// ============================================
// Progress Types
// ============================================

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
}

// ============================================
// BKT Mastery Types
// ============================================

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

// ============================================
// Calibration Types
// ============================================

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
// API Result wrapper
// ============================================

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Learn API Client for mobile
 * Ported from frontend/src/lib/api.ts — scroll, learn, syllabus, resources, assessment namespaces
 */

import { getAuthToken } from "@/lib/authTokenBridge";
import type {
  ApiResult,
  ScrollCard,
  ScrollStats,
  ScrollAnalytics,
  ScrollSessionAnalytics,
  LeaderboardResponse,
  LearningHistoryResponse,
  LearnProgressResponse,
  CalibrationResponse,
  SyllabusTree,
  BKTMasteryState,
  RecommendedPathResponse,
  AssessmentStartResponse,
  AssessmentSelfRatingsResponse,
  AssessmentDiagnosticResponse,
} from "@/types/learn";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || "https://backend-production-33a7.up.railway.app";

// ============================================
// Retry Configuration
// ============================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoff(attempt: number, cfg: RetryConfig): number {
  const exp = cfg.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exp;
  return Math.min(exp + jitter, cfg.maxDelayMs);
}

// ============================================
// Core fetch helpers
// ============================================

interface FetchOptions extends RequestInit {
  retry?: boolean | Partial<RetryConfig>;
}

async function fetchApi<T>(
  endpoint: string,
  options?: FetchOptions,
): Promise<ApiResult<T>> {
  const shouldRetry = options?.retry !== false;
  const cfg: RetryConfig = {
    ...DEFAULT_RETRY,
    ...(typeof options?.retry === "object" ? options.retry : {}),
  };

  let lastError = "Unknown error";

  for (
    let attempt = 0;
    attempt <= (shouldRetry ? cfg.maxRetries : 0);
    attempt++
  ) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (!response.ok) {
        if (
          cfg.retryableStatuses.includes(response.status) &&
          attempt < cfg.maxRetries
        ) {
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : backoff(attempt, cfg);
          await sleep(delay);
          continue;
        }
        const error = await response
          .json()
          .catch(() => ({ detail: "Unknown error" }));
        let errorMessage: string;
        if (typeof error.detail === "string") {
          errorMessage = error.detail;
        } else if (Array.isArray(error.detail)) {
          errorMessage = error.detail
            .map((e: { msg?: string }) => e.msg ?? "Validation error")
            .join("; ");
        } else {
          errorMessage = error.message || `HTTP ${response.status}`;
        }
        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = "Request timed out";
      } else {
        lastError = error instanceof Error ? error.message : "Network error";
      }
      if ((error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError")) && attempt < cfg.maxRetries) {
        await sleep(backoff(attempt, cfg));
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { success: false, error: lastError };
}

async function fetchApiAuth<T>(
  endpoint: string,
  options?: FetchOptions,
): Promise<ApiResult<T>> {
  let authHeaders: Record<string, string> = {};
  const token = await getAuthToken();
  if (token) {
    authHeaders = { Authorization: `Bearer ${token}` };
  }
  return fetchApi<T>(endpoint, {
    ...options,
    headers: {
      ...authHeaders,
      ...options?.headers,
    },
  });
}

/**
 * FormData upload with auth (no Content-Type header — let fetch set multipart boundary)
 */
async function fetchFormDataAuth<T>(
  endpoint: string,
  formData: FormData,
  method = "POST",
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    let authHeaders: Record<string, string> = {};
    const token = await getAuthToken();
    if (token) {
      authHeaders = { Authorization: `Bearer ${token}` };
    }
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      signal: controller.signal,
      headers: authHeaders,
      body: formData,
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Unknown error" }));
      return {
        success: false,
        error:
          typeof error.detail === "string" ? error.detail : "Request failed",
      };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, error: "Upload timed out" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// Scroll (TikTok-style Feed) API
// ============================================

/**
 * Build a query string with student_name for guest auth.
 * Authenticated users don't need this (JWT is used), but it doesn't hurt.
 */
function withStudentName(endpoint: string, studentName: string): string {
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}student_name=${encodeURIComponent(studentName)}`;
}

export const scrollApi = {
  resumeFeed: (topic: string, studentName: string) =>
    fetchApiAuth<{
      session_id: string;
      topic: string;
      concepts: string[];
      cards: ScrollCard[];
      stats: ScrollStats;
      resumed: boolean;
    }>(withStudentName("/learn/scroll/resume", studentName), {
      method: "POST",
      body: JSON.stringify({ topic, student_name: studentName }),
      retry: false,
    }),

  startFeed: (
    topic: string,
    studentName: string,
    studentId?: string,
    notes?: string,
    preferences?: {
      difficulty?: number | null;
      content_mix?: {
        mcq: number;
        flashcard: number;
        info_card: number;
      };
      question_style?: string | null;
    },
  ) =>
    fetchApiAuth<{
      session_id: string;
      topic: string;
      concepts: string[];
      cards: ScrollCard[];
      stats: ScrollStats;
    }>(withStudentName("/learn/scroll/start", studentName), {
      method: "POST",
      body: JSON.stringify({
        topic,
        student_name: studentName,
        student_id: studentId,
        notes,
        preferences,
      }),
    }),

  submitAnswer: (
    sessionId: string,
    answer: string,
    timeMs: number,
    contentItemId?: string,
    correctAnswer?: string,
    confidence?: number,
  ) =>
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
      method: "POST",
      body: JSON.stringify({
        answer,
        time_ms: timeMs,
        content_item_id: contentItemId,
        correct_answer: correctAnswer,
        confidence,
      }),
    }),

  getNextCards: (sessionId: string, count = 3) =>
    fetchApiAuth<{
      session_id: string;
      cards: ScrollCard[];
      stats: ScrollStats;
    }>(`/learn/scroll/${sessionId}/next?count=${count}`),

  getAnalytics: (sessionId: string) =>
    fetchApiAuth<ScrollSessionAnalytics>(
      `/learn/scroll/${sessionId}/analytics`,
    ),

  skipCard: (
    sessionId: string,
    contentItemId: string,
    reason: string = "skipped",
  ) =>
    fetchApiAuth<{
      session_id: string;
      cards: ScrollCard[];
      stats: ScrollStats;
    }>(`/learn/scroll/${sessionId}/skip`, {
      method: "POST",
      body: JSON.stringify({ content_item_id: contentItemId, reason }),
    }),

  flipFlashcard: (
    sessionId: string,
    contentItemId: string,
    timeToFlipMs: number,
    rating: number,
  ) =>
    fetchApiAuth<{
      xp_earned: number;
      stats: ScrollStats;
    }>(`/learn/scroll/${sessionId}/flashcard-flip`, {
      method: "POST",
      body: JSON.stringify({
        content_item_id: contentItemId,
        time_to_flip_ms: timeToFlipMs,
        self_rated_knowledge: rating,
      }),
    }),

  sendHelpMessage: (
    sessionId: string,
    message: string,
    cardContext: object,
  ) =>
    fetchApiAuth<{ message: string; phase: string; ready_to_try: boolean }>(
      `/learn/scroll/${sessionId}/help`,
      {
        method: "POST",
        body: JSON.stringify({ message, card_context: cardContext }),
      },
    ),

  pregenContent: (topic: string, concepts: string[], subject?: string) =>
    fetchApiAuth<{ status: string; total_items?: number }>(
      "/learn/content/pregen",
      {
        method: "POST",
        body: JSON.stringify({ topic, concepts, subject }),
        retry: false,
      },
    ),
};

// ============================================
// Learn API
// ============================================

export const learnApi = {
  getLeaderboard: (
    period: "weekly" | "alltime",
    studentName: string,
  ) => {
    const params = new URLSearchParams({ period, student_name: studentName });
    return fetchApiAuth<LeaderboardResponse>(
      `/learn/leaderboard?${params.toString()}`,
    );
  },

  getProgress: (studentName: string) =>
    fetchApiAuth<LearnProgressResponse>(
      withStudentName("/learn/progress", studentName),
    ),

  getHistory: (studentName: string, studentId?: string) =>
    fetchApiAuth<LearningHistoryResponse>(
      withStudentName(
        `/learn/history${studentId ? `?student_id=${encodeURIComponent(studentId)}` : ""}`,
        studentName,
      ),
    ),

  deleteSubject: (subject: string, studentName: string) =>
    fetchApiAuth<{
      ok: boolean;
      deleted: { sessions: number; syllabi: number; resources: number };
    }>(
      withStudentName(
        `/learn/subject/${encodeURIComponent(subject)}`,
        studentName,
      ),
      { method: "DELETE" },
    ),

  getCalibration: (studentName: string, subject?: string) =>
    fetchApiAuth<CalibrationResponse>(
      withStudentName(
        `/learn/scroll/calibration/${encodeURIComponent(studentName)}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`,
        studentName,
      ),
    ),
};

// ============================================
// Syllabus / Skill Tree API
// ============================================

export const syllabusApi = {
  generate: (subject: string, studentId?: string) =>
    fetchApiAuth<SyllabusTree>("/learn/syllabus/generate", {
      method: "POST",
      body: JSON.stringify({ subject, student_id: studentId }),
    }),

  get: (subject: string, studentId?: string) =>
    fetchApiAuth<SyllabusTree>(
      `/learn/syllabus/${encodeURIComponent(subject)}${studentId ? `?student_id=${encodeURIComponent(studentId)}` : ""}`,
    ),

  getPresence: (subject: string) =>
    fetchApiAuth<Record<string, { count: number; names: string[] }>>(
      `/learn/presence/${encodeURIComponent(subject)}`,
    ),

  heartbeat: (subject: string, nodeId: string, studentName: string) =>
    fetchApiAuth<{ ok: boolean }>(
      withStudentName("/learn/presence/heartbeat", studentName),
      {
        method: "POST",
        body: JSON.stringify({
          subject,
          node_id: nodeId,
          student_name: studentName,
        }),
      },
    ),

  getMastery: (studentName: string) =>
    fetchApiAuth<{
      student_name: string;
      concepts: Record<string, BKTMasteryState>;
    }>(
      withStudentName(
        `/learn/mastery/${encodeURIComponent(studentName)}`,
        studentName,
      ),
    ),

  getRecommendedPath: (subject: string, studentName: string) =>
    fetchApiAuth<RecommendedPathResponse>(
      withStudentName(
        `/learn/recommended-path/${encodeURIComponent(subject)}`,
        studentName,
      ),
    ),
};

// ============================================
// Resources API
// ============================================

export const resourcesApi = {
  upload: (formData: FormData) =>
    fetchFormDataAuth<{
      resources: Array<{
        id: string | null;
        file_name: string;
        concepts_count: number;
        summary_preview: string;
      }>;
      total_concepts: number;
    }>("/learn/resources/upload", formData),

  list: (subject: string, studentId?: string) =>
    fetchApiAuth<{
      resources: Array<{
        id: string;
        file_name: string;
        file_type: string;
        concepts_count: number;
        summary_preview: string;
        created_at: string;
      }>;
    }>(
      `/learn/resources/${encodeURIComponent(subject)}${studentId ? `?student_id=${studentId}` : ""}`,
    ),

  delete: (resourceId: string) =>
    fetchApiAuth<{ ok: boolean }>(`/learn/resources/${resourceId}`, {
      method: "DELETE",
    }),

  regenerateSyllabus: (subject: string, studentId?: string) =>
    fetchApiAuth<SyllabusTree>("/learn/syllabus/regenerate", {
      method: "POST",
      body: JSON.stringify({ subject, student_id: studentId }),
    }),

  pdfToSyllabus: (formData: FormData) =>
    fetchFormDataAuth<{
      subject: string;
      syllabus: SyllabusTree;
      resources: Array<{
        id: string | null;
        file_name: string;
        concepts_count: number;
        summary_preview: string;
      }>;
      total_concepts: number;
    }>("/learn/pdf-to-syllabus", formData),
};

// ============================================
// Assessment API
// ============================================

export const assessmentApi = {
  start: (subject: string, studentName: string) =>
    fetchApiAuth<AssessmentStartResponse>(
      withStudentName("/learn/assessment/start", studentName),
      {
        method: "POST",
        body: JSON.stringify({ subject, student_name: studentName }),
      },
    ),

  submitSelfRatings: (
    subject: string,
    studentName: string,
    ratings: Array<{ concept: string; rating: number }>,
  ) =>
    fetchApiAuth<AssessmentSelfRatingsResponse>(
      withStudentName("/learn/assessment/self-ratings", studentName),
      {
        method: "POST",
        body: JSON.stringify({ subject, student_name: studentName, ratings }),
      },
    ),

  submitDiagnostic: (
    studentName: string,
    assessmentId: string,
    answers: Array<{
      concept: string;
      answer: string;
      correct_answer: string;
      time_ms: number;
    }>,
  ) =>
    fetchApiAuth<AssessmentDiagnosticResponse>(
      withStudentName("/learn/assessment/diagnostic", studentName),
      {
        method: "POST",
        body: JSON.stringify({
          student_name: studentName,
          assessment_id: assessmentId,
          answers,
        }),
      },
    ),
};

// ============================================
// Curated Resources API
// ============================================

export const curatedResourcesApi = {
  list: (
    subject: string,
    concept?: string,
    resourceType?: string,
    limit = 10,
  ) => {
    const params = new URLSearchParams();
    if (concept) params.set("concept", concept);
    if (resourceType) params.set("resource_type", resourceType);
    params.set("limit", String(limit));
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
    }>(
      `/learn/resources/curated/${encodeURIComponent(subject)}?${params.toString()}`,
    );
  },
};

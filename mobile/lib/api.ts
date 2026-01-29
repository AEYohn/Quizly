const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
};

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, token } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.detail || data?.message || `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }

  return data as T;
}

// Game API
export interface JoinGameRequest {
  game_code: string;
  nickname: string;
  avatar?: string;
}

export interface JoinGameResponse {
  game_id: string;
  player_id: string;
  nickname: string;
  avatar: string;
  game_status: string;
  quiz_title: string;
}

export interface SubmitAnswerRequest {
  answer: string;
  response_time_ms: number;
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_answer: string;
  points_earned: number;
  total_score: number;
  current_streak: number;
  explanation?: string;
}

export interface PlayerGameState {
  game_id: string;
  game_code: string;
  status: string;
  current_question_index: number;
  total_questions: number;
  player: {
    id: string;
    nickname: string;
    avatar: string;
    total_score: number;
    correct_answers: number;
    current_streak: number;
    rank?: number;
  };
  current_question?: {
    question_number: number;
    total_questions: number;
    question_text: string;
    question_type: string;
    options: Record<string, string>;
    time_limit: number;
    points: number;
    image_url?: string;
  };
}

export const gameApi = {
  join: (data: JoinGameRequest) =>
    request<JoinGameResponse>("/games/join", {
      method: "POST",
      body: data,
    }),

  submitAnswer: (gameId: string, playerId: string, data: SubmitAnswerRequest, confidenceLevel?: number) =>
    request<SubmitAnswerResponse>(`/games/${gameId}/player/${playerId}/answer`, {
      method: "POST",
      body: { ...data, confidence_level: confidenceLevel },
    }),

  getPlayerState: (gameId: string, playerId: string) =>
    request<PlayerGameState>(`/games/${gameId}/player/${playerId}`),

  checkCode: (code: string) =>
    request<{ valid: boolean; game_id?: string; quiz_title?: string }>(`/games/check/${code}`),
};

// Student Quiz API
export interface StudentQuiz {
  id: string;
  title: string;
  subject?: string;
  description?: string;
  question_count: number;
  is_public: boolean;
  times_practiced: number;
  best_score?: number;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id?: string;
  question_text: string;
  question_type: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation?: string;
  points: number;
  time_limit: number;
  image_url?: string;
  order_index?: number;
}

export interface CreateQuizRequest {
  title: string;
  subject?: string;
  description?: string;
  is_public: boolean;
  timer_enabled: boolean;
  shuffle_questions: boolean;
  questions: QuizQuestion[];
}

export interface PracticeSession {
  id: string;
  quiz_id: string;
  started_at: string;
  current_question_index: number;
  total_questions: number;
}

export interface PracticeAnswerResponse {
  is_correct: boolean;
  correct_answer: string;
  explanation?: string;
  points_earned: number;
  total_score: number;
}

export interface PracticeResult {
  session_id: string;
  quiz_id: string;
  quiz_title: string;
  total_questions: number;
  correct_answers: number;
  total_score: number;
  max_score: number;
  accuracy: number;
  completed_at: string;
  questions: Array<{
    question_text: string;
    your_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation?: string;
  }>;
}

export const studentQuizApi = {
  list: (token: string) =>
    request<StudentQuiz[]>("/student/quizzes", { token }),

  get: (id: string, token: string) =>
    request<StudentQuiz & { questions: QuizQuestion[] }>(`/student/quizzes/${id}`, { token }),

  create: (data: CreateQuizRequest, token: string) =>
    request<StudentQuiz>("/student/quizzes", {
      method: "POST",
      body: data,
      token,
    }),

  update: (id: string, data: Partial<CreateQuizRequest>, token: string) =>
    request<StudentQuiz>(`/student/quizzes/${id}`, {
      method: "PUT",
      body: data,
      token,
    }),

  delete: (id: string, token: string) =>
    request<void>(`/student/quizzes/${id}`, {
      method: "DELETE",
      token,
    }),

  startPractice: (quizId: string, token: string) =>
    request<PracticeSession>(`/student/quizzes/${quizId}/practice`, {
      method: "POST",
      token,
    }),

  submitPracticeAnswer: (
    quizId: string,
    sessionId: string,
    answer: string,
    token: string
  ) =>
    request<PracticeAnswerResponse>(
      `/student/quizzes/${quizId}/practice/${sessionId}/answer`,
      {
        method: "POST",
        body: { answer },
        token,
      }
    ),

  getPracticeResult: (quizId: string, sessionId: string, token: string) =>
    request<PracticeResult>(
      `/student/quizzes/${quizId}/practice/${sessionId}/result`,
      { token }
    ),
};

// AI Generation API
export interface AIGenerateRequest {
  message: string;
  context?: string;
  image_base64?: string;
  pdf_base64?: string;
}

export interface AIGenerateResponse {
  questions: QuizQuestion[];
  message: string;
}

export const aiApi = {
  chatGenerate: (data: AIGenerateRequest, token: string) =>
    request<AIGenerateResponse>("/ai/chat-generate", {
      method: "POST",
      body: data,
      token,
    }),
};

// Auth API
export interface SyncUserRequest {
  clerk_id: string;
  email: string;
  name?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  games_played: number;
  total_score: number;
  accuracy: number;
}

export const authApi = {
  syncUser: (data: SyncUserRequest, token: string) =>
    request<UserProfile>("/auth/clerk/sync", {
      method: "POST",
      body: data,
      token,
    }),

  getProfile: (token: string) =>
    request<UserProfile>("/students/profile", { token }),
};

// Social API Types
import {
  Friend,
  FriendRequest,
  StudyGroup,
  UserPreview,
  ActivityItem,
} from '@/types/social';

export interface SendFriendRequestRequest {
  user_id: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface QuizCommentRequest {
  text: string;
  rating?: number;
}

export interface QuizComment {
  id: string;
  quiz_id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  text: string;
  rating?: number;
  created_at: string;
}

// Social API
export const socialApi = {
  // Friends
  getFriends: (token: string) =>
    request<Friend[]>('/social/friends', { token }),

  searchUsers: (query: string, token: string) =>
    request<UserPreview[]>(`/social/users/search?q=${encodeURIComponent(query)}`, { token }),

  sendFriendRequest: (userId: string, token: string) =>
    request<{ id: string }>('/social/friends/request', {
      method: 'POST',
      body: { user_id: userId },
      token,
    }),

  acceptFriendRequest: (requestId: string, token: string) =>
    request<Friend>(`/social/friends/request/${requestId}/accept`, {
      method: 'POST',
      token,
    }),

  declineFriendRequest: (requestId: string, token: string) =>
    request<void>(`/social/friends/request/${requestId}`, {
      method: 'DELETE',
      token,
    }),

  removeFriend: (userId: string, token: string) =>
    request<void>(`/social/friends/${userId}`, {
      method: 'DELETE',
      token,
    }),

  // Groups
  getGroups: (token: string) =>
    request<StudyGroup[]>('/social/groups', { token }),

  createGroup: (data: CreateGroupRequest, token: string) =>
    request<StudyGroup>('/social/groups', {
      method: 'POST',
      body: data,
      token,
    }),

  getGroup: (groupId: string, token: string) =>
    request<StudyGroup>(`/social/groups/${groupId}`, { token }),

  joinGroup: (groupId: string, token: string) =>
    request<void>(`/social/groups/${groupId}/join`, {
      method: 'POST',
      token,
    }),

  leaveGroup: (groupId: string, token: string) =>
    request<void>(`/social/groups/${groupId}/leave`, {
      method: 'POST',
      token,
    }),

  inviteToGroup: (groupId: string, userId: string, token: string) =>
    request<void>(`/social/groups/${groupId}/invite`, {
      method: 'POST',
      body: { user_id: userId },
      token,
    }),

  shareQuizToGroup: (groupId: string, quizId: string, token: string) =>
    request<void>(`/social/groups/${groupId}/quizzes`, {
      method: 'POST',
      body: { quiz_id: quizId },
      token,
    }),

  // Comments
  getQuizComments: (quizId: string) =>
    request<QuizComment[]>(`/quizzes/${quizId}/comments`),

  addQuizComment: (quizId: string, data: QuizCommentRequest, token: string) =>
    request<QuizComment>(`/quizzes/${quizId}/comments`, {
      method: 'POST',
      body: data,
      token,
    }),

  deleteQuizComment: (quizId: string, commentId: string, token: string) =>
    request<void>(`/quizzes/${quizId}/comments/${commentId}`, {
      method: 'DELETE',
      token,
    }),

  // Activity
  getActivityFeed: (token: string) =>
    request<ActivityItem[]>('/social/activity', { token }),
};

export { API_URL, ApiError };

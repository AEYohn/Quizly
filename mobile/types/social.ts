export interface UserPreview {
  id: string;
  name: string;
  avatar?: string;
  level: number;
  streak: number;
}

export type FriendStatus = 'online' | 'offline' | 'studying';

export interface Friend extends UserPreview {
  addedAt: string;
  status: FriendStatus;
}

export interface FriendRequest {
  id: string;
  user: UserPreview;
  sentAt: string;
  direction: 'incoming' | 'outgoing';
}

export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  members: UserPreview[];
  sharedQuizzes: string[];
  createdBy: string;
  createdAt: string;
  isOwner: boolean;
}

export interface QuizComment {
  id: string;
  quizId: string;
  user: UserPreview;
  text: string;
  rating?: number;
  createdAt: string;
}

export type ActivityType = 'quiz_complete' | 'quiz_created' | 'achievement' | 'streak' | 'level_up';

export interface ActivityItem {
  id: string;
  user: UserPreview;
  type: ActivityType;
  metadata: Record<string, unknown>;
  timestamp: string;
}

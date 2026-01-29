export type XPSource =
  | 'quiz_complete'
  | 'perfect_score'
  | 'daily_login'
  | 'card_review'
  | 'quiz_created'
  | 'streak_bonus'
  | 'achievement';

export interface XPEvent {
  id: string;
  source: XPSource;
  amount: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  unlockedAt?: string;
  progress?: number;
  requirement: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  level: number;
  xp: number;
  isCurrentUser: boolean;
}

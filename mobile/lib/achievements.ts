import { Achievement, AchievementTier } from '@/types/progression';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  requirement: number;
  category: 'learning' | 'mastery' | 'consistency' | 'creation' | 'social' | 'study';
  checkProgress: (stats: AchievementStats) => number;
}

export interface AchievementStats {
  quizzesCompleted: number;
  perfectScores: number;
  currentStreak: number;
  longestStreak: number;
  quizzesCreated: number;
  quizzesShared: number;
  quizUsedByOthers: number;
  cardsReviewed: number;
  cardsMastered: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Learning
  {
    id: 'first_quiz',
    title: 'First Steps',
    description: 'Complete your first quiz',
    icon: 'play',
    tier: 'bronze',
    requirement: 1,
    category: 'learning',
    checkProgress: (s) => Math.min(s.quizzesCompleted, 1),
  },
  {
    id: 'quiz_10',
    title: 'Getting Started',
    description: 'Complete 10 quizzes',
    icon: 'book-open',
    tier: 'silver',
    requirement: 10,
    category: 'learning',
    checkProgress: (s) => Math.min(s.quizzesCompleted, 10),
  },
  {
    id: 'quiz_50',
    title: 'Dedicated Learner',
    description: 'Complete 50 quizzes',
    icon: 'graduation-cap',
    tier: 'gold',
    requirement: 50,
    category: 'learning',
    checkProgress: (s) => Math.min(s.quizzesCompleted, 50),
  },
  {
    id: 'quiz_100',
    title: 'Quiz Master',
    description: 'Complete 100 quizzes',
    icon: 'crown',
    tier: 'platinum',
    requirement: 100,
    category: 'learning',
    checkProgress: (s) => Math.min(s.quizzesCompleted, 100),
  },

  // Mastery
  {
    id: 'perfect_1',
    title: 'Perfectionist',
    description: 'Get a perfect score',
    icon: 'star',
    tier: 'bronze',
    requirement: 1,
    category: 'mastery',
    checkProgress: (s) => Math.min(s.perfectScores, 1),
  },
  {
    id: 'perfect_10',
    title: 'Flawless',
    description: 'Get 10 perfect scores',
    icon: 'stars',
    tier: 'silver',
    requirement: 10,
    category: 'mastery',
    checkProgress: (s) => Math.min(s.perfectScores, 10),
  },
  {
    id: 'perfect_50',
    title: 'Untouchable',
    description: 'Get 50 perfect scores',
    icon: 'trophy',
    tier: 'gold',
    requirement: 50,
    category: 'mastery',
    checkProgress: (s) => Math.min(s.perfectScores, 50),
  },

  // Consistency
  {
    id: 'streak_7',
    title: 'Week Warrior',
    description: '7-day study streak',
    icon: 'flame',
    tier: 'bronze',
    requirement: 7,
    category: 'consistency',
    checkProgress: (s) => Math.min(s.longestStreak, 7),
  },
  {
    id: 'streak_30',
    title: 'Monthly Master',
    description: '30-day study streak',
    icon: 'flame',
    tier: 'silver',
    requirement: 30,
    category: 'consistency',
    checkProgress: (s) => Math.min(s.longestStreak, 30),
  },
  {
    id: 'streak_100',
    title: 'Unstoppable',
    description: '100-day study streak',
    icon: 'flame',
    tier: 'gold',
    requirement: 100,
    category: 'consistency',
    checkProgress: (s) => Math.min(s.longestStreak, 100),
  },
  {
    id: 'streak_365',
    title: 'Legendary',
    description: '365-day study streak',
    icon: 'flame',
    tier: 'platinum',
    requirement: 365,
    category: 'consistency',
    checkProgress: (s) => Math.min(s.longestStreak, 365),
  },

  // Creation
  {
    id: 'create_1',
    title: 'Creator',
    description: 'Create your first quiz',
    icon: 'plus-circle',
    tier: 'bronze',
    requirement: 1,
    category: 'creation',
    checkProgress: (s) => Math.min(s.quizzesCreated, 1),
  },
  {
    id: 'create_10',
    title: 'Prolific',
    description: 'Create 10 quizzes',
    icon: 'layers',
    tier: 'silver',
    requirement: 10,
    category: 'creation',
    checkProgress: (s) => Math.min(s.quizzesCreated, 10),
  },
  {
    id: 'create_25',
    title: 'Content Creator',
    description: 'Create 25 quizzes',
    icon: 'award',
    tier: 'gold',
    requirement: 25,
    category: 'creation',
    checkProgress: (s) => Math.min(s.quizzesCreated, 25),
  },

  // Study (Flashcards)
  {
    id: 'cards_100',
    title: 'Card Shark',
    description: 'Review 100 flashcards',
    icon: 'layers',
    tier: 'bronze',
    requirement: 100,
    category: 'study',
    checkProgress: (s) => Math.min(s.cardsReviewed, 100),
  },
  {
    id: 'cards_500',
    title: 'Memory Builder',
    description: 'Review 500 flashcards',
    icon: 'brain',
    tier: 'silver',
    requirement: 500,
    category: 'study',
    checkProgress: (s) => Math.min(s.cardsReviewed, 500),
  },
  {
    id: 'cards_1000',
    title: 'Memory Master',
    description: 'Review 1000 flashcards',
    icon: 'zap',
    tier: 'gold',
    requirement: 1000,
    category: 'study',
    checkProgress: (s) => Math.min(s.cardsReviewed, 1000),
  },
  {
    id: 'mastered_50',
    title: 'True Understanding',
    description: 'Master 50 cards',
    icon: 'check-circle',
    tier: 'gold',
    requirement: 50,
    category: 'study',
    checkProgress: (s) => Math.min(s.cardsMastered, 50),
  },
];

export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function getAchievementsByCategory(
  category: AchievementDefinition['category']
): AchievementDefinition[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

export function checkAchievements(
  stats: AchievementStats,
  unlockedIds: string[]
): AchievementDefinition[] {
  return ACHIEVEMENTS.filter((achievement) => {
    if (unlockedIds.includes(achievement.id)) return false;
    const progress = achievement.checkProgress(stats);
    return progress >= achievement.requirement;
  });
}

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Achievement, XPEvent, XPSource } from '@/types/progression';
import { eventBus } from '@/lib/events';
import { ACHIEVEMENTS, AchievementStats, checkAchievements } from '@/lib/achievements';

interface ProgressionState {
  // State
  xp: number;
  level: number;
  xpHistory: XPEvent[];
  dailyStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  achievements: Achievement[];

  // Stats for achievement tracking
  stats: AchievementStats;

  // Actions
  addXP: (amount: number, source: XPSource, metadata?: Record<string, unknown>) => void;
  checkAndUpdateStreak: () => { maintained: boolean; newStreak: number };
  unlockAchievement: (id: string) => void;
  checkAndUnlockAchievements: () => Achievement[];
  incrementStat: (stat: keyof AchievementStats, amount?: number) => void;
  getXPProgress: () => number;
  getXPToNextLevel: () => number;
  reset: () => void;
}

function xpRequiredForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const initialStats: AchievementStats = {
  quizzesCompleted: 0,
  perfectScores: 0,
  currentStreak: 0,
  longestStreak: 0,
  quizzesCreated: 0,
  quizzesShared: 0,
  quizUsedByOthers: 0,
  cardsReviewed: 0,
  cardsMastered: 0,
};

const initialState = {
  xp: 0,
  level: 1,
  xpHistory: [] as XPEvent[],
  dailyStreak: 0,
  longestStreak: 0,
  lastActiveDate: null as string | null,
  achievements: ACHIEVEMENTS.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    icon: a.icon,
    tier: a.tier,
    requirement: a.requirement,
    progress: 0,
    unlockedAt: undefined,
  })) as Achievement[],
  stats: initialStats,
};

export const useProgressionStore = create<ProgressionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addXP: (amount: number, source: XPSource, metadata?: Record<string, unknown>) => {
        const event: XPEvent = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source,
          amount,
          timestamp: new Date().toISOString(),
          metadata,
        };

        set((state) => {
          let newXP = state.xp + amount;
          let newLevel = state.level;

          // Check for level up
          while (newXP >= xpRequiredForLevel(newLevel)) {
            newXP -= xpRequiredForLevel(newLevel);
            newLevel++;

            // Emit level up event
            eventBus.emit({
              type: 'LEVEL_UP',
              payload: { newLevel },
            });
          }

          return {
            xp: newXP,
            level: newLevel,
            xpHistory: [...state.xpHistory.slice(-99), event],
          };
        });

        // Check achievements after XP gain
        get().checkAndUnlockAchievements();
      },

      checkAndUpdateStreak: () => {
        const today = getDateString(new Date());
        const yesterday = getDateString(addDays(new Date(), -1));
        const { lastActiveDate, dailyStreak, longestStreak } = get();

        if (lastActiveDate === today) {
          return { maintained: true, newStreak: dailyStreak };
        }

        let newStreak: number;
        let maintained: boolean;

        if (lastActiveDate === yesterday) {
          newStreak = dailyStreak + 1;
          maintained = true;
        } else if (lastActiveDate === null) {
          newStreak = 1;
          maintained = true;
        } else {
          newStreak = 1;
          maintained = false;
        }

        const newLongestStreak = Math.max(longestStreak, newStreak);

        set({
          dailyStreak: newStreak,
          longestStreak: newLongestStreak,
          lastActiveDate: today,
          stats: {
            ...get().stats,
            currentStreak: newStreak,
            longestStreak: newLongestStreak,
          },
        });

        // Award streak bonus XP
        if (maintained && newStreak > 1) {
          get().addXP(10 * newStreak, 'streak_bonus');
        }

        eventBus.emit({
          type: 'STREAK_UPDATED',
          payload: { streak: newStreak, maintained },
        });

        return { maintained, newStreak };
      },

      unlockAchievement: (id: string) => {
        set((state) => {
          const achievements = state.achievements.map((a) =>
            a.id === id && !a.unlockedAt
              ? { ...a, unlockedAt: new Date().toISOString(), progress: a.requirement }
              : a
          );
          return { achievements };
        });

        eventBus.emit({
          type: 'ACHIEVEMENT_UNLOCKED',
          payload: { achievementId: id },
        });
      },

      checkAndUnlockAchievements: () => {
        const { stats, achievements } = get();
        const unlockedIds = achievements.filter((a) => a.unlockedAt).map((a) => a.id);

        const newlyUnlocked = checkAchievements(stats, unlockedIds);

        newlyUnlocked.forEach((achievement) => {
          get().unlockAchievement(achievement.id);
          // Award XP for achievement
          const xpReward =
            achievement.tier === 'bronze' ? 25 :
            achievement.tier === 'silver' ? 50 :
            achievement.tier === 'gold' ? 100 : 200;
          get().addXP(xpReward, 'achievement', { achievementId: achievement.id });
        });

        // Update progress for all achievements
        set((state) => ({
          achievements: state.achievements.map((a) => {
            const def = ACHIEVEMENTS.find((d) => d.id === a.id);
            if (!def || a.unlockedAt) return a;
            return { ...a, progress: def.checkProgress(stats) };
          }),
        }));

        return newlyUnlocked.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          icon: a.icon,
          tier: a.tier,
          requirement: a.requirement,
          unlockedAt: new Date().toISOString(),
        }));
      },

      incrementStat: (stat: keyof AchievementStats, amount = 1) => {
        set((state) => ({
          stats: {
            ...state.stats,
            [stat]: state.stats[stat] + amount,
          },
        }));

        // Check achievements after stat change
        get().checkAndUnlockAchievements();
      },

      getXPProgress: () => {
        const { xp, level } = get();
        const required = xpRequiredForLevel(level);
        return xp / required;
      },

      getXPToNextLevel: () => {
        const { xp, level } = get();
        return xpRequiredForLevel(level) - xp;
      },

      reset: () => set(initialState),
    }),
    {
      name: 'quizly-progression-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Set up event listeners for automatic XP awards
eventBus.on('QUIZ_COMPLETED', (event) => {
  const store = useProgressionStore.getState();
  store.addXP(50, 'quiz_complete', { quizId: event.payload.quizId });
  store.incrementStat('quizzesCompleted');

  if (event.payload.perfect) {
    store.addXP(100, 'perfect_score');
    store.incrementStat('perfectScores');
  }

  store.checkAndUpdateStreak();
});

eventBus.on('CARD_REVIEWED', () => {
  const store = useProgressionStore.getState();
  store.addXP(5, 'card_review');
  store.incrementStat('cardsReviewed');
});

eventBus.on('QUIZ_CREATED', () => {
  const store = useProgressionStore.getState();
  store.addXP(75, 'quiz_created');
  store.incrementStat('quizzesCreated');
});

eventBus.on('DAILY_LOGIN', () => {
  const store = useProgressionStore.getState();
  store.addXP(25, 'daily_login');
  store.checkAndUpdateStreak();
});

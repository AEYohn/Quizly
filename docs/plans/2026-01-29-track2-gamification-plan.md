# Track 2: Gamification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build XP system, levels, achievements, streaks, and leaderboards to drive engagement and retention.

**Architecture:** ProgressionStore (Zustand) manages XP, level, achievements, and streaks. Listens to event bus for QUIZ_COMPLETED and CARD_REVIEWED to award XP. Components display progress and celebrate milestones.

**Tech Stack:** Zustand, react-native-reanimated (for animations), expo-haptics

**Dependencies:** Foundation must be complete (types, events, theme)

---

## Task 1: Create Achievement Definitions

**Files:**
- Create: `mobile/lib/achievements.ts`

**Step 1: Create achievements definition file**

Create `mobile/lib/achievements.ts`:
```typescript
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
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add lib/achievements.ts && git commit -m "feat(gamification): add achievement definitions"
```

---

## Task 2: Create Progression Store

**Files:**
- Create: `mobile/stores/progressionStore.ts`
- Test: `mobile/__tests__/stores/progressionStore.test.ts`

**Step 1: Write the failing test**

Create `mobile/__tests__/stores/progressionStore.test.ts`:
```typescript
import { useProgressionStore } from '@/stores/progressionStore';

describe('progressionStore', () => {
  beforeEach(() => {
    useProgressionStore.getState().reset();
  });

  describe('XP and Levels', () => {
    it('should add XP correctly', () => {
      const { addXP } = useProgressionStore.getState();

      addXP(50, 'quiz_complete');

      const { xp } = useProgressionStore.getState();
      expect(xp).toBe(50);
    });

    it('should level up when XP threshold reached', () => {
      const { addXP } = useProgressionStore.getState();

      // Level 1 requires 100 XP
      addXP(100, 'quiz_complete');

      const { level } = useProgressionStore.getState();
      expect(level).toBe(2);
    });

    it('should calculate XP progress correctly', () => {
      const { addXP, getXPProgress } = useProgressionStore.getState();

      addXP(50, 'quiz_complete');

      const progress = getXPProgress();
      expect(progress).toBe(0.5); // 50/100
    });
  });

  describe('Streaks', () => {
    it('should initialize streak to 1 on first activity', () => {
      const { checkAndUpdateStreak } = useProgressionStore.getState();

      checkAndUpdateStreak();

      const { dailyStreak } = useProgressionStore.getState();
      expect(dailyStreak).toBe(1);
    });

    it('should not increment streak on same day', () => {
      const { checkAndUpdateStreak } = useProgressionStore.getState();

      checkAndUpdateStreak();
      checkAndUpdateStreak();

      const { dailyStreak } = useProgressionStore.getState();
      expect(dailyStreak).toBe(1);
    });
  });

  describe('Achievements', () => {
    it('should unlock achievements when criteria met', () => {
      const { addXP, unlockAchievement, achievements } = useProgressionStore.getState();

      unlockAchievement('first_quiz');

      const state = useProgressionStore.getState();
      const unlocked = state.achievements.find((a) => a.id === 'first_quiz');
      expect(unlocked?.unlockedAt).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/stores/progressionStore.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `mobile/stores/progressionStore.ts`:
```typescript
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
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/stores/progressionStore.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add stores/progressionStore.ts __tests__/stores/progressionStore.test.ts && git commit -m "feat(gamification): add progression store with XP, levels, streaks, achievements"
```

---

## Task 3: Create XP Bar Component

**Files:**
- Create: `mobile/components/progression/XPBar.tsx`

**Step 1: Create the component**

Create `mobile/components/progression/XPBar.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  useEffect,
} from 'react-native-reanimated';
import { useTheme } from '@/providers/ThemeProvider';
import { useProgressionStore } from '@/stores/progressionStore';

interface XPBarProps {
  showLevel?: boolean;
  compact?: boolean;
}

export function XPBar({ showLevel = true, compact = false }: XPBarProps) {
  const { colors, isDark } = useTheme();
  const { xp, level, getXPProgress, getXPToNextLevel } = useProgressionStore();

  const progress = getXPProgress();
  const xpToNext = getXPToNextLevel();

  const animatedWidth = useSharedValue(0);

  React.useEffect(() => {
    animatedWidth.value = withSpring(progress, {
      damping: 15,
      stiffness: 100,
    });
  }, [progress, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.levelBadge, { backgroundColor: colors.brand }]}>
          <Text style={styles.levelText}>{level}</Text>
        </View>
        <View style={styles.compactBarContainer}>
          <View style={[styles.compactBar, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
            <Animated.View
              style={[styles.compactBarFill, { backgroundColor: colors.brand }, animatedStyle]}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {showLevel && (
          <View style={styles.levelContainer}>
            <View style={[styles.levelBadgeLarge, { backgroundColor: colors.brand }]}>
              <Text style={styles.levelTextLarge}>{level}</Text>
            </View>
            <Text style={[styles.levelLabel, { color: colors.textSecondary }]}>Level</Text>
          </View>
        )}
        <View style={styles.xpInfo}>
          <Text style={[styles.xpText, { color: colors.textPrimary }]}>
            {xp} XP
          </Text>
          <Text style={[styles.xpToNext, { color: colors.textMuted }]}>
            {xpToNext} XP to level {level + 1}
          </Text>
        </View>
      </View>

      <View style={[styles.barContainer, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: colors.brand }, animatedStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  levelBadgeLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTextLarge: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  levelLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  xpInfo: {
    flex: 1,
  },
  xpText: {
    fontSize: 18,
    fontWeight: '600',
  },
  xpToNext: {
    fontSize: 12,
    marginTop: 2,
  },
  barContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  levelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  compactBarContainer: {
    flex: 1,
  },
  compactBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  compactBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/progression/XPBar.tsx && git commit -m "feat(gamification): add XPBar component with animations"
```

---

## Task 4: Create Streak Badge Component

**Files:**
- Create: `mobile/components/progression/StreakBadge.tsx`

**Step 1: Create the component**

Create `mobile/components/progression/StreakBadge.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useProgressionStore } from '@/stores/progressionStore';

interface StreakBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StreakBadge({ size = 'md', showLabel = true }: StreakBadgeProps) {
  const { colors, isDark } = useTheme();
  const { dailyStreak } = useProgressionStore();

  const sizes = {
    sm: { container: 32, icon: 16, text: 12 },
    md: { container: 48, icon: 24, text: 16 },
    lg: { container: 64, icon: 32, text: 24 },
  };

  const s = sizes[size];
  const isActive = dailyStreak > 0;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: s.container,
            height: s.container,
            borderRadius: s.container / 2,
            backgroundColor: isActive
              ? '#FEF3C7'
              : isDark
              ? '#374151'
              : '#F3F4F6',
          },
        ]}
      >
        <Flame
          size={s.icon}
          color={isActive ? '#F59E0B' : colors.textMuted}
          fill={isActive ? '#FBBF24' : 'transparent'}
        />
      </View>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text
            style={[
              styles.count,
              { fontSize: s.text, color: isActive ? colors.textPrimary : colors.textMuted },
            ]}
          >
            {dailyStreak}
          </Text>
          {size !== 'sm' && (
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              day{dailyStreak !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  count: {
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
  },
});
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/progression/StreakBadge.tsx && git commit -m "feat(gamification): add StreakBadge component"
```

---

## Task 5: Create Achievement Components

**Files:**
- Create: `mobile/components/progression/AchievementBadge.tsx`
- Create: `mobile/components/progression/AchievementList.tsx`
- Create: `mobile/components/progression/AchievementToast.tsx`

**Step 1: Create AchievementBadge**

Create `mobile/components/progression/AchievementBadge.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Lock, Award, Star, Trophy, Crown, Flame, Zap, CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Achievement, AchievementTier } from '@/types/progression';

interface AchievementBadgeProps {
  achievement: Achievement;
  onPress?: () => void;
}

const tierColors: Record<AchievementTier, { bg: string; border: string; text: string }> = {
  bronze: { bg: '#FEF3C7', border: '#D97706', text: '#92400E' },
  silver: { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' },
  gold: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  platinum: { bg: '#EDE9FE', border: '#7C3AED', text: '#5B21B6' },
};

const iconMap: Record<string, typeof Award> = {
  'play': Award,
  'book-open': Award,
  'graduation-cap': Award,
  'crown': Crown,
  'star': Star,
  'stars': Star,
  'trophy': Trophy,
  'flame': Flame,
  'plus-circle': Award,
  'layers': Award,
  'award': Award,
  'brain': Zap,
  'zap': Zap,
  'check-circle': CheckCircle,
};

export function AchievementBadge({ achievement, onPress }: AchievementBadgeProps) {
  const { colors, isDark } = useTheme();
  const isLocked = !achievement.unlockedAt;
  const tierStyle = tierColors[achievement.tier];
  const Icon = iconMap[achievement.icon] || Award;

  const progress = achievement.progress ?? 0;
  const progressPercent = (progress / achievement.requirement) * 100;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: isLocked
            ? isDark
              ? '#1F2937'
              : '#F9FAFB'
            : tierStyle.bg,
          borderColor: isLocked ? colors.border : tierStyle.border,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        {isLocked ? (
          <Lock size={24} color={colors.textMuted} />
        ) : (
          <Icon size={24} color={tierStyle.border} />
        )}
      </View>

      <Text
        style={[
          styles.title,
          { color: isLocked ? colors.textMuted : tierStyle.text },
        ]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>

      {isLocked && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.brand, width: `${progressPercent}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {progress}/{achievement.requirement}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
});
```

**Step 2: Create AchievementList**

Create `mobile/components/progression/AchievementList.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useProgressionStore } from '@/stores/progressionStore';
import { AchievementBadge } from './AchievementBadge';
import { ACHIEVEMENTS } from '@/lib/achievements';

interface AchievementListProps {
  category?: string;
  showAll?: boolean;
}

export function AchievementList({ category, showAll = true }: AchievementListProps) {
  const { colors } = useTheme();
  const { achievements } = useProgressionStore();

  const filteredAchievements = category
    ? achievements.filter((a) => {
        const def = ACHIEVEMENTS.find((d) => d.id === a.id);
        return def?.category === category;
      })
    : achievements;

  const displayAchievements = showAll
    ? filteredAchievements
    : filteredAchievements.slice(0, 6);

  const unlockedCount = displayAchievements.filter((a) => a.unlockedAt).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Achievements
        </Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {unlockedCount}/{displayAchievements.length}
        </Text>
      </View>

      <View style={styles.grid}>
        {displayAchievements.map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
```

**Step 3: Create AchievementToast**

Create `mobile/components/progression/AchievementToast.tsx`:
```typescript
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { Award } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { Achievement, AchievementTier } from '@/types/progression';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AchievementToastProps {
  achievement: Achievement;
  onDismiss: () => void;
}

const tierColors: Record<AchievementTier, string> = {
  bronze: '#D97706',
  silver: '#6B7280',
  gold: '#F59E0B',
  platinum: '#7C3AED',
};

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  const { colors, isDark } = useTheme();

  const translateY = useSharedValue(-100);
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    translateY.value = withSpring(0, { damping: 12 });
    scale.value = withSpring(1, { damping: 10 });
    opacity.value = withSpring(1);

    // Auto dismiss after 3 seconds
    const timeout = setTimeout(() => {
      translateY.value = withSpring(-100);
      opacity.value = withSpring(0, {}, () => {
        runOnJS(onDismiss)();
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [translateY, scale, opacity, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const tierColor = tierColors[achievement.tier];

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        {
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderColor: tierColor,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${tierColor}20` }]}>
        <Award size={24} color={tierColor} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: tierColor }]}>
          Achievement Unlocked!
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {achievement.title}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {achievement.description}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
});
```

**Step 4: Create index file**

Create `mobile/components/progression/index.ts`:
```typescript
export { XPBar } from './XPBar';
export { StreakBadge } from './StreakBadge';
export { AchievementBadge } from './AchievementBadge';
export { AchievementList } from './AchievementList';
export { AchievementToast } from './AchievementToast';
```

**Step 5: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/progression/ && git commit -m "feat(gamification): add achievement components"
```

---

## Task 6: Create Leaderboard Screen

**Files:**
- Create: `mobile/app/(student)/leaderboard.tsx`
- Create: `mobile/components/progression/LeaderboardRow.tsx`

**Step 1: Create LeaderboardRow**

Create `mobile/components/progression/LeaderboardRow.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { LeaderboardEntry } from '@/types/progression';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

export function LeaderboardRow({ entry }: LeaderboardRowProps) {
  const { colors, isDark } = useTheme();

  const getRankStyle = () => {
    if (entry.rank === 1) return { bg: '#FEF3C7', text: '#D97706' };
    if (entry.rank === 2) return { bg: '#F3F4F6', text: '#6B7280' };
    if (entry.rank === 3) return { bg: '#FED7AA', text: '#C2410C' };
    return { bg: isDark ? '#374151' : '#F9FAFB', text: colors.textSecondary };
  };

  const rankStyle = getRankStyle();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: entry.isCurrentUser
            ? isDark
              ? '#312E81'
              : '#EEF2FF'
            : 'transparent',
        },
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
        <Text style={[styles.rankText, { color: rankStyle.text }]}>
          {entry.rank}
        </Text>
      </View>

      <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
        <Text style={styles.avatarText}>
          {entry.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {entry.name}
          {entry.isCurrentUser && ' (You)'}
        </Text>
        <Text style={[styles.level, { color: colors.textSecondary }]}>
          Level {entry.level}
        </Text>
      </View>

      <Text style={[styles.xp, { color: colors.textPrimary }]}>
        {entry.xp.toLocaleString()} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  level: {
    fontSize: 12,
  },
  xp: {
    fontSize: 14,
    fontWeight: '600',
  },
});
```

**Step 2: Create leaderboard screen**

Create `mobile/app/(student)/leaderboard.tsx`:
```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { Card } from '@/components/ui';
import { LeaderboardRow } from '@/components/progression/LeaderboardRow';
import { Trophy } from 'lucide-react-native';
import { LeaderboardEntry } from '@/types/progression';

// Mock data - in real app, fetch from API
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: '1', name: 'Alex Chen', level: 15, xp: 4250, isCurrentUser: false },
  { rank: 2, userId: '2', name: 'Sarah Kim', level: 14, xp: 3980, isCurrentUser: false },
  { rank: 3, userId: '3', name: 'Mike Johnson', level: 12, xp: 3420, isCurrentUser: false },
  { rank: 4, userId: '4', name: 'You', level: 10, xp: 2850, isCurrentUser: true },
  { rank: 5, userId: '5', name: 'Emma Davis', level: 9, xp: 2540, isCurrentUser: false },
  { rank: 6, userId: '6', name: 'James Wilson', level: 8, xp: 2180, isCurrentUser: false },
  { rank: 7, userId: '7', name: 'Lisa Brown', level: 7, xp: 1920, isCurrentUser: false },
  { rank: 8, userId: '8', name: 'David Lee', level: 6, xp: 1650, isCurrentUser: false },
];

type Tab = 'weekly' | 'allTime' | 'friends';

export default function LeaderboardScreen() {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('weekly');

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'allTime', label: 'All Time' },
    { key: 'friends', label: 'Friends' },
  ];

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View style={styles.header}>
          <Trophy size={28} color={colors.warning} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Leaderboard
          </Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key && {
                  backgroundColor: isDark ? '#374151' : '#FFFFFF',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === tab.key ? colors.textPrimary : colors.textMuted,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Top 3 Podium */}
        <Card variant="elevated" className={`mb-4 ${cardBg}`}>
          <View style={styles.podium}>
            {MOCK_LEADERBOARD.slice(0, 3).map((entry, index) => {
              const positions = [1, 0, 2]; // Silver, Gold, Bronze order
              const position = positions[index];
              const heights = [80, 100, 60];

              return (
                <View
                  key={entry.userId}
                  style={[styles.podiumItem, { order: position }]}
                >
                  <View
                    style={[
                      styles.podiumAvatar,
                      { backgroundColor: colors.brand },
                    ]}
                  >
                    <Text style={styles.podiumAvatarText}>
                      {entry.name.charAt(0)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.podiumName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {entry.name.split(' ')[0]}
                  </Text>
                  <Text style={[styles.podiumXP, { color: colors.textSecondary }]}>
                    {entry.xp.toLocaleString()}
                  </Text>
                  <View
                    style={[
                      styles.podiumBar,
                      {
                        height: heights[index],
                        backgroundColor:
                          index === 0
                            ? '#FCD34D'
                            : index === 1
                            ? '#E5E7EB'
                            : '#FDBA74',
                      },
                    ]}
                  >
                    <Text style={styles.podiumRank}>{entry.rank}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Full List */}
        <Card variant="outline" className={cardBg}>
          {MOCK_LEADERBOARD.map((entry) => (
            <LeaderboardRow key={entry.userId} entry={entry} />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginLeft: 12,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: 16,
  },
  podiumItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  podiumAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  podiumXP: {
    fontSize: 11,
    marginBottom: 8,
  },
  podiumBar: {
    width: 60,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});
```

**Step 3: Update exports**

Add to `mobile/components/progression/index.ts`:
```typescript
export { LeaderboardRow } from './LeaderboardRow';
```

**Step 4: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/progression/LeaderboardRow.tsx app/\(student\)/leaderboard.tsx && git commit -m "feat(gamification): add leaderboard screen with podium"
```

---

## Task 7: Add Gamification to Dashboard

**Files:**
- Modify: `mobile/app/(student)/index.tsx`

**Step 1: Add gamification widgets to dashboard**

This task updates the dashboard to include:
1. XP bar at the top
2. Streak badge
3. Recent achievements

Read the current dashboard file first, then integrate the gamification components.

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add app/\(student\)/index.tsx && git commit -m "feat(gamification): add XP bar and streak to dashboard"
```

---

## Summary

Track 2 (Gamification) is complete when all tasks pass. The following are now available:

- **ProgressionStore:** XP, levels, streaks, achievements with event-driven updates
- **XPBar:** Animated progress bar with level display
- **StreakBadge:** Fire icon with streak count
- **AchievementBadge/List/Toast:** Achievement display and celebration
- **LeaderboardRow:** Leaderboard entry component
- **Leaderboard Screen:** Weekly/All-Time/Friends tabs with podium

The gamification track listens for events from other tracks (QUIZ_COMPLETED, CARD_REVIEWED, QUIZ_CREATED) to automatically award XP.

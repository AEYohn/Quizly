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

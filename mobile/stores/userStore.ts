import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface UserPreferences {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  defaultConfidence: number;
  theme: "light" | "dark" | "system";
}

interface UserStats {
  totalGamesPlayed: number;
  totalScore: number;
  totalCorrectAnswers: number;
  totalQuestionsAnswered: number;
  longestStreak: number;
  quizzesCreated: number;
  quizzesPracticed: number;
}

interface UserState {
  preferences: UserPreferences;
  stats: UserStats;
  lastNickname: string;

  // Actions
  setPreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  updateStats: (updates: Partial<UserStats>) => void;
  incrementStat: (key: keyof UserStats, amount?: number) => void;
  setLastNickname: (nickname: string) => void;
  resetStats: () => void;
}

const defaultPreferences: UserPreferences = {
  soundEnabled: true,
  vibrationEnabled: true,
  defaultConfidence: 2,
  theme: "system",
};

const defaultStats: UserStats = {
  totalGamesPlayed: 0,
  totalScore: 0,
  totalCorrectAnswers: 0,
  totalQuestionsAnswered: 0,
  longestStreak: 0,
  quizzesCreated: 0,
  quizzesPracticed: 0,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      stats: defaultStats,
      lastNickname: "",

      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),

      updateStats: (updates) =>
        set((state) => ({
          stats: { ...state.stats, ...updates },
        })),

      incrementStat: (key, amount = 1) =>
        set((state) => ({
          stats: { ...state.stats, [key]: state.stats[key] + amount },
        })),

      setLastNickname: (nickname) => set({ lastNickname: nickname }),

      resetStats: () => set({ stats: defaultStats }),
    }),
    {
      name: "quizly-user-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

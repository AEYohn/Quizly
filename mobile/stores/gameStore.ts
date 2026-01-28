import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RecentGame {
  id: string;
  gameCode: string;
  quizTitle: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  playedAt: string;
  nickname: string;
}

interface GameState {
  // Current game state
  currentGameId: string | null;
  currentPlayerId: string | null;
  currentNickname: string | null;

  // Recent games
  recentGames: RecentGame[];

  // Actions
  setCurrentGame: (gameId: string, playerId: string, nickname: string) => void;
  clearCurrentGame: () => void;
  addRecentGame: (game: Omit<RecentGame, "playedAt">) => void;
  clearRecentGames: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      currentGameId: null,
      currentPlayerId: null,
      currentNickname: null,
      recentGames: [],

      setCurrentGame: (gameId, playerId, nickname) =>
        set({
          currentGameId: gameId,
          currentPlayerId: playerId,
          currentNickname: nickname,
        }),

      clearCurrentGame: () =>
        set({
          currentGameId: null,
          currentPlayerId: null,
          currentNickname: null,
        }),

      addRecentGame: (game) =>
        set((state) => ({
          recentGames: [
            { ...game, playedAt: new Date().toISOString() },
            ...state.recentGames.slice(0, 9), // Keep last 10 games
          ],
        })),

      clearRecentGames: () => set({ recentGames: [] }),
    }),
    {
      name: "quizly-game-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recentGames: state.recentGames,
      }),
    }
  )
);

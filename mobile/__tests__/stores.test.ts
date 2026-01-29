import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";

// Reset stores between tests
beforeEach(() => {
  useGameStore.setState({
    currentGameId: null,
    currentPlayerId: null,
    currentNickname: null,
    recentGames: [],
  });

  useUserStore.setState({
    preferences: {
      soundEnabled: true,
      vibrationEnabled: true,
      defaultConfidence: 2,
      theme: "system",
    },
    stats: {
      totalGamesPlayed: 0,
      totalScore: 0,
      totalCorrectAnswers: 0,
      totalQuestionsAnswered: 0,
      longestStreak: 0,
      quizzesCreated: 0,
      quizzesPracticed: 0,
    },
    lastNickname: "",
  });
});

describe("gameStore", () => {
  it("should set current game", () => {
    const { setCurrentGame } = useGameStore.getState();

    setCurrentGame("game-123", "player-456", "TestPlayer");

    const state = useGameStore.getState();
    expect(state.currentGameId).toBe("game-123");
    expect(state.currentPlayerId).toBe("player-456");
    expect(state.currentNickname).toBe("TestPlayer");
  });

  it("should clear current game", () => {
    const { setCurrentGame, clearCurrentGame } = useGameStore.getState();

    setCurrentGame("game-123", "player-456", "TestPlayer");
    clearCurrentGame();

    const state = useGameStore.getState();
    expect(state.currentGameId).toBeNull();
    expect(state.currentPlayerId).toBeNull();
    expect(state.currentNickname).toBeNull();
  });

  it("should add recent game", () => {
    const { addRecentGame } = useGameStore.getState();

    addRecentGame({
      id: "game-1",
      gameCode: "ABC123",
      quizTitle: "Math Quiz",
      score: 100,
      correctAnswers: 8,
      totalQuestions: 10,
      nickname: "Player1",
    });

    const state = useGameStore.getState();
    expect(state.recentGames).toHaveLength(1);
    expect(state.recentGames[0].quizTitle).toBe("Math Quiz");
    expect(state.recentGames[0].score).toBe(100);
    expect(state.recentGames[0].playedAt).toBeDefined();
  });

  it("should keep only last 10 games", () => {
    const { addRecentGame } = useGameStore.getState();

    // Add 12 games
    for (let i = 0; i < 12; i++) {
      addRecentGame({
        id: `game-${i}`,
        gameCode: `CODE${i}`,
        quizTitle: `Quiz ${i}`,
        score: i * 10,
        correctAnswers: i,
        totalQuestions: 10,
        nickname: "Player",
      });
    }

    const state = useGameStore.getState();
    expect(state.recentGames).toHaveLength(10);
    // Most recent should be first
    expect(state.recentGames[0].quizTitle).toBe("Quiz 11");
  });

  it("should clear recent games", () => {
    const { addRecentGame, clearRecentGames } = useGameStore.getState();

    addRecentGame({
      id: "game-1",
      gameCode: "ABC123",
      quizTitle: "Quiz",
      score: 100,
      correctAnswers: 8,
      totalQuestions: 10,
      nickname: "Player",
    });

    clearRecentGames();

    const state = useGameStore.getState();
    expect(state.recentGames).toHaveLength(0);
  });
});

describe("userStore", () => {
  it("should set preference", () => {
    const { setPreference } = useUserStore.getState();

    setPreference("soundEnabled", false);
    setPreference("theme", "dark");

    const state = useUserStore.getState();
    expect(state.preferences.soundEnabled).toBe(false);
    expect(state.preferences.theme).toBe("dark");
  });

  it("should update stats", () => {
    const { updateStats } = useUserStore.getState();

    updateStats({
      totalGamesPlayed: 5,
      totalScore: 500,
    });

    const state = useUserStore.getState();
    expect(state.stats.totalGamesPlayed).toBe(5);
    expect(state.stats.totalScore).toBe(500);
    // Other stats should remain default
    expect(state.stats.longestStreak).toBe(0);
  });

  it("should increment stat by 1 by default", () => {
    const { incrementStat } = useUserStore.getState();

    incrementStat("totalGamesPlayed");
    incrementStat("totalGamesPlayed");

    const state = useUserStore.getState();
    expect(state.stats.totalGamesPlayed).toBe(2);
  });

  it("should increment stat by custom amount", () => {
    const { incrementStat } = useUserStore.getState();

    incrementStat("totalScore", 150);

    const state = useUserStore.getState();
    expect(state.stats.totalScore).toBe(150);
  });

  it("should set last nickname", () => {
    const { setLastNickname } = useUserStore.getState();

    setLastNickname("CoolPlayer");

    const state = useUserStore.getState();
    expect(state.lastNickname).toBe("CoolPlayer");
  });

  it("should reset stats", () => {
    const { incrementStat, resetStats } = useUserStore.getState();

    incrementStat("totalGamesPlayed", 10);
    incrementStat("totalScore", 1000);

    resetStats();

    const state = useUserStore.getState();
    expect(state.stats.totalGamesPlayed).toBe(0);
    expect(state.stats.totalScore).toBe(0);
  });
});

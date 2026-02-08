import { useState, useEffect, useCallback } from "react";
import { learnApi } from "@/lib/learnApi";
import type { LeaderboardEntry } from "@/types/learn";
import { useAuth } from "@/providers/AuthProvider";

export function useLeaderboard() {
  const auth = useAuth();
  const [period, setPeriod] = useState<"weekly" | "alltime">("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const studentName = auth.nickname || "Student";

  const fetchLeaderboard = useCallback(
    async (p: "weekly" | "alltime") => {
      setIsLoading(true);
      try {
        const result = await learnApi.getLeaderboard(p, studentName);
        if (result.success && result.data) {
          setEntries(result.data.entries);
          setCurrentUserRank(result.data.current_user_rank);
          setTotalPlayers(result.data.total_players);
        }
      } catch (err) {
        console.warn("Failed to fetch leaderboard:", err);
      }
      setIsLoading(false);
    },
    [studentName],
  );

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period, fetchLeaderboard]);

  const currentUserEntry = entries.find((e) => e.is_current_user) ?? null;

  return {
    period,
    setPeriod,
    entries,
    currentUserRank,
    totalPlayers,
    isLoading,
    currentUserEntry,
  };
}

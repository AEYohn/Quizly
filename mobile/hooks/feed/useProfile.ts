import { useState, useEffect } from "react";
import { learnApi } from "@/lib/learnApi";
import type { LearnProgressResponse } from "@/types/learn";
import { useAuth } from "@/providers/AuthProvider";

export function useProfile() {
  const auth = useAuth();
  const [progress, setProgress] = useState<LearnProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const studentName = auth.nickname || "Student";
  const initial = studentName.charAt(0).toUpperCase();

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await learnApi.getProgress(studentName);
        if (res.success && res.data) {
          setProgress(res.data);
        }
      } catch (err) {
        console.warn("Failed to fetch profile:", err);
      }
      setIsLoading(false);
    }
    load();
  }, [studentName]);

  const totalXp =
    progress?.recent_sessions.reduce(
      (sum, s) => sum + s.questions_correct * 10,
      0,
    ) ?? 0;
  const totalSessions = progress?.recent_sessions.length ?? 0;
  const totalAnswered =
    progress?.recent_sessions.reduce(
      (sum, s) => sum + s.questions_answered,
      0,
    ) ?? 0;
  const totalCorrect =
    progress?.recent_sessions.reduce(
      (sum, s) => sum + s.questions_correct,
      0,
    ) ?? 0;
  const accuracy =
    totalAnswered > 0
      ? Math.round((totalCorrect / totalAnswered) * 100)
      : 0;
  const level = Math.max(1, Math.floor(Math.sqrt(totalXp / 100)));

  return {
    studentName,
    initial,
    progress,
    isLoading,
    totalXp,
    totalSessions,
    accuracy,
    level,
    signOut: auth.signOut,
  };
}

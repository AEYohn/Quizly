import { useState, useEffect, useCallback } from "react";
import { learnApi } from "@/lib/learnApi";
import type {
  LearnProgressResponse,
  CalibrationResponse,
  QuestionHistorySession,
  QuestionHistoryItem,
} from "@/types/learn";
import { useAuth } from "@/providers/AuthProvider";

export function useProfile() {
  const auth = useAuth();
  const [progress, setProgress] = useState<LearnProgressResponse | null>(null);
  const [calibration, setCalibration] = useState<CalibrationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // History tab state
  const [historySessions, setHistorySessions] = useState<QuestionHistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);

  // Weak areas tab state
  const [weakQuestions, setWeakQuestions] = useState<QuestionHistoryItem[]>([]);
  const [weakLoading, setWeakLoading] = useState(false);
  const [weakOffset, setWeakOffset] = useState(0);
  const [weakTotal, setWeakTotal] = useState(0);

  // Session detail state
  const [sessionQuestions, setSessionQuestions] = useState<Record<string, QuestionHistoryItem[]>>({});
  const [sessionQuestionsLoading, setSessionQuestionsLoading] = useState<string | null>(null);

  const studentName = auth.nickname || "Student";
  const initial = studentName.charAt(0).toUpperCase();

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [progressRes, calibrationRes] = await Promise.all([
          learnApi.getProgress(studentName),
          learnApi.getCalibration(studentName),
        ]);
        if (progressRes.success && progressRes.data) {
          setProgress(progressRes.data);
        }
        if (calibrationRes.success && calibrationRes.data) {
          setCalibration(calibrationRes.data);
        }
      } catch (err) {
        console.warn("Failed to fetch profile:", err);
      }
      setIsLoading(false);
    }
    load();
  }, [studentName]);

  const loadHistorySessions = useCallback(
    async (reset = false) => {
      const offset = reset ? 0 : historyOffset;
      setHistoryLoading(true);
      try {
        const res = await learnApi.getQuestionHistorySessions(studentName, 20, offset);
        if (res.success && res.data) {
          setHistorySessions((prev) =>
            reset ? res.data!.sessions : [...prev, ...res.data!.sessions],
          );
          setHistoryTotal(res.data.pagination.total);
          setHistoryOffset(offset + res.data.sessions.length);
        }
      } catch (err) {
        console.warn("Failed to fetch history sessions:", err);
      }
      setHistoryLoading(false);
    },
    [studentName, historyOffset],
  );

  const loadSessionQuestions = useCallback(
    async (sessionId: string) => {
      if (sessionQuestions[sessionId]) return; // Already loaded
      setSessionQuestionsLoading(sessionId);
      try {
        const res = await learnApi.getSessionQuestions(sessionId);
        if (res.success && res.data) {
          setSessionQuestions((prev) => ({
            ...prev,
            [sessionId]: res.data!.items,
          }));
        }
      } catch (err) {
        console.warn("Failed to fetch session questions:", err);
      }
      setSessionQuestionsLoading(null);
    },
    [sessionQuestions],
  );

  const loadWeakQuestions = useCallback(
    async (reset = false) => {
      const offset = reset ? 0 : weakOffset;
      setWeakLoading(true);
      try {
        const res = await learnApi.getQuestionHistory(
          studentName,
          { is_correct: false },
          20,
          offset,
        );
        if (res.success && res.data) {
          setWeakQuestions((prev) =>
            reset ? res.data!.items : [...prev, ...res.data!.items],
          );
          setWeakTotal(res.data.pagination.total);
          setWeakOffset(offset + res.data.items.length);
        }
      } catch (err) {
        console.warn("Failed to fetch weak questions:", err);
      }
      setWeakLoading(false);
    },
    [studentName, weakOffset],
  );

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
    calibration,
    isLoading,
    totalXp,
    totalSessions,
    accuracy,
    level,
    signOut: auth.signOut,
    // History tab
    historySessions,
    historyLoading,
    historyTotal,
    loadHistorySessions,
    loadSessionQuestions,
    sessionQuestions,
    sessionQuestionsLoading,
    // Weak areas tab
    weakQuestions,
    weakLoading,
    weakTotal,
    loadWeakQuestions,
  };
}

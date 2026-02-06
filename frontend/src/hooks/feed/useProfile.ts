"use client";

import { useState, useEffect } from "react";
import { learnApi } from "~/lib/api";
import type { LearnProgressResponse } from "~/lib/api";
import { useAuth } from "~/lib/auth";

export function useProfile() {
    const auth = useAuth();
    const [progress, setProgress] = useState<LearnProgressResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const studentName = auth.user?.name || "Student";
    const initial = studentName.charAt(0).toUpperCase();

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                const res = await learnApi.getProgress(studentName);
                if (res.success) {
                    setProgress(res.data);
                }
            } catch (err) {
                console.warn("Failed to fetch profile:", err);
            }
            setIsLoading(false);
        }
        load();
    }, [studentName]);

    // Compute stats from progress data
    const totalXp = progress?.recent_sessions.reduce((sum, s) => sum + (s.questions_correct * 10), 0) ?? 0;
    const totalSessions = progress?.recent_sessions.length ?? 0;
    const totalAnswered = progress?.recent_sessions.reduce((sum, s) => sum + s.questions_answered, 0) ?? 0;
    const totalCorrect = progress?.recent_sessions.reduce((sum, s) => sum + s.questions_correct, 0) ?? 0;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const level = totalXp > 0 ? Math.floor(Math.sqrt(totalXp / 100)) : 0;

    return {
        studentName,
        initial,
        email: auth.user?.email || "Student",
        progress,
        isLoading,
        totalXp,
        totalSessions,
        accuracy,
        level,
        logout: auth.logout,
        onLogout: auth.logout,
    };
}

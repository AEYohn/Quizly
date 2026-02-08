import { useState, useCallback, useRef, useEffect } from "react";
import { scrollApi, syllabusApi, learnApi, resourcesApi } from "@/lib/learnApi";
import { useAuth } from "@/providers/AuthProvider";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";

export function useHomeScreen() {
  const auth = useAuth();
  const store = useScrollSessionStore();

  const [loadingMessage, setLoadingMessage] = useState("Setting up your feed...");

  const feedStartingRef = useRef(false);
  const answerStartTime = useRef(Date.now());

  const timeAgo = useCallback((iso: string | null) => {
    if (!iso) return "";
    const normalized = /[Z+\-]\d{0,2}:?\d{0,2}$/.test(iso) ? iso : iso + "Z";
    const diff = Date.now() - new Date(normalized).getTime();
    if (diff < 0 || diff < 60000) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  }, []);

  const handleQuickStart = useCallback(
    async (topic: string) => {
      if (feedStartingRef.current || store.isLoading) return;
      feedStartingRef.current = true;
      store.setTopicInput(topic);
      store.setIsLoading(true);
      store.setError(null);
      setLoadingMessage("Resuming...");

      const timeout5s = setTimeout(() => {
        if (feedStartingRef.current)
          setLoadingMessage("Generating questions...");
      }, 5000);
      const timeout15s = setTimeout(() => {
        if (feedStartingRef.current) setLoadingMessage("Almost ready...");
      }, 15000);
      const timeout30s = setTimeout(() => {
        if (feedStartingRef.current)
          setLoadingMessage("This is taking longer than usual...");
      }, 30000);
      const timeout = setTimeout(() => {
        if (feedStartingRef.current) {
          feedStartingRef.current = false;
          store.setIsLoading(false);
          store.setError("Feed took too long to start. Tap to try again.");
          setLoadingMessage("Setting up your feed...");
        }
      }, 60000);

      try {
        const studentName = auth.nickname || "Student";
        const sessionTopic = store.selectedSubject || topic;
        const resumeRes = await scrollApi.resumeFeed(
          sessionTopic,
          studentName,
        );
        if (resumeRes.success && resumeRes.data) {
          store.setSessionId(resumeRes.data.session_id);
          store.setTopic(sessionTopic);
          store.setCards(resumeRes.data.cards);
          store.setCurrentIdx(0);
          store.setStats(resumeRes.data.stats);
          store.clearCardState();
          answerStartTime.current = Date.now();
          return;
        }

        setLoadingMessage("Setting up your feed...");
        const prefs = store.preferences;
        const apiPrefs = {
          difficulty: prefs.difficulty,
          content_mix: prefs.contentMix,
          question_style: prefs.questionStyle,
        };
        const subTopicHint =
          store.selectedSubject && topic !== store.selectedSubject
            ? `Focus on subtopic: ${topic}`
            : undefined;
        const notesWithContext =
          [subTopicHint, store.notesInput.trim()].filter(Boolean).join("\n") ||
          undefined;
        const res = await scrollApi.startFeed(
          sessionTopic,
          studentName,
          auth.userId ?? undefined,
          notesWithContext,
          apiPrefs,
        );
        if (!res.success) {
          store.setError(res.error ?? "Failed to start feed");
          return;
        }
        store.setSessionId(res.data!.session_id);
        store.setTopic(sessionTopic);
        store.setCards(res.data!.cards);
        store.setCurrentIdx(0);
        store.setStats(res.data!.stats);
        store.clearCardState();
        answerStartTime.current = Date.now();
      } catch (err) {
        store.setError(
          err instanceof Error ? err.message : "Something went wrong",
        );
      } finally {
        clearTimeout(timeout5s);
        clearTimeout(timeout15s);
        clearTimeout(timeout30s);
        clearTimeout(timeout);
        feedStartingRef.current = false;
        store.setIsLoading(false);
        setLoadingMessage("Setting up your feed...");
      }
    },
    [store, auth.nickname, auth.userId],
  );

  const handleSubjectSelect = useCallback(
    async (subject: string) => {
      if (
        store.syllabus &&
        store.selectedSubject?.toLowerCase() === subject.toLowerCase()
      ) {
        store.setSyllabusLoading(false);
        return;
      }
      store.setSelectedSubject(subject);
      store.setSyllabusLoading(true);
      store.setError(null);
      try {
        const res = await syllabusApi.generate(
          subject,
          auth.userId ?? undefined,
        );
        if (res.success && res.data) {
          store.setSyllabus(res.data);
          store.setSelectedSubject(res.data.subject);
          const firstTopics = res.data.units
            .flatMap((u) => u.topics)
            .slice(0, 2);
          firstTopics.forEach((t, i) => {
            setTimeout(() => {
              scrollApi
                .pregenContent(t.name, t.concepts, res.data!.subject)
                .catch(() => {});
            }, i * 3000);
          });
          resourcesApi
            .list(res.data.subject, auth.userId ?? undefined)
            .then((rRes) => {
              if (rRes.success && rRes.data) {
                store.setSubjectResources(
                  rRes.data.resources.map((r) => ({
                    id: r.id,
                    file_name: r.file_name,
                    file_type: r.file_type,
                    concepts_count: r.concepts_count,
                  })),
                );
              }
            })
            .catch(() => {});
        } else {
          store.setError(res.error ?? "Failed to generate syllabus");
        }
      } catch (err) {
        store.setError(
          err instanceof Error
            ? err.message
            : "Failed to generate syllabus",
        );
      } finally {
        store.setSyllabusLoading(false);
      }
    },
    [store, auth.userId],
  );

  const handleDeleteSubject = useCallback(
    async (subject: string) => {
      const studentName = auth.nickname || "Student";
      try {
        const res = await learnApi.deleteSubject(subject, studentName);
        if (res.success) {
          const updated = store.history.filter((h) => h.subject !== subject);
          store.setHistory(
            updated,
            store.historyOverall ?? {
              total_subjects: 0,
              total_sessions: 0,
              total_questions: 0,
              total_xp: 0,
              concepts_mastered: 0,
            },
          );
          if (store.selectedSubject === subject) {
            store.clearSyllabus();
          }
        } else {
          store.setError(res.error ?? "Failed to delete subject");
        }
      } catch (err) {
        store.setError(
          err instanceof Error ? err.message : "Failed to delete subject",
        );
      }
    },
    [store, auth.nickname],
  );

  // Fetch learning history on mount and when returning from a session
  useEffect(() => {
    if (store.sessionId) return; // skip while actively in a feed session
    const studentName = auth.nickname || "Student";
    if (!store.history || store.history.length === 0) {
      store.setHistoryLoading(true);
    }
    learnApi
      .getHistory(studentName, auth.userId ?? undefined)
      .then((res) => {
        if (res.success && res.data) {
          store.setHistory(res.data.subjects, res.data.overall);
          store.setSuggestions(res.data.suggestions ?? []);
          store.setActiveSession(res.data.active_session ?? null);
        }
      })
      .finally(() => store.setHistoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sessionId]);

  return {
    loadingMessage,
    timeAgo,
    handleQuickStart,
    handleSubjectSelect,
    handleDeleteSubject,
    answerStartTime,
  };
}

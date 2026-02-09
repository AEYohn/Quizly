"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { scrollApi, syllabusApi, learnApi, resourcesApi, codebaseApi } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";

export function useHomeScreen() {
    const auth = useAuth();
    const store = useScrollSessionStore();

    const [loadingMessage, setLoadingMessage] = useState("Setting up your feed...");

    const feedStartingRef = useRef(false);
    const answerStartTime = useRef(Date.now());

    // Time-relative label
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

    // Quick-start: tap a topic and go
    const handleQuickStart = useCallback(async (topic: string, opts?: { mode?: 'structured' | 'mixed'; topicMeta?: { name: string; concepts: string[] } }) => {
        if (feedStartingRef.current || store.isLoading) return;
        feedStartingRef.current = true;
        store.setTopicInput(topic);
        store.setIsLoading(true);
        store.setError(null);
        setLoadingMessage("Resuming...");

        const timeout5s = setTimeout(() => {
            if (feedStartingRef.current) setLoadingMessage("Generating questions...");
        }, 5000);
        const timeout15s = setTimeout(() => {
            if (feedStartingRef.current) setLoadingMessage("Almost ready...");
        }, 15000);
        const timeout30s = setTimeout(() => {
            if (feedStartingRef.current) setLoadingMessage("This is taking longer than usual...");
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
            const studentName = getStudentName(auth.user);
            // Use parent subject as session topic to avoid "Subject: Subtopic" duplicates in history
            const sessionTopic = store.selectedSubject || topic;
            const resumeRes = await scrollApi.resumeFeed(sessionTopic, studentName);
            if (resumeRes.success) {
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
            // Pass subtopic context via notes so LLM generates domain-appropriate questions
            const subTopicHint = store.selectedSubject && topic !== store.selectedSubject
                ? `Focus on subtopic: ${topic}`
                : undefined;
            const topicMetaHint = opts?.topicMeta?.concepts?.length
                ? `Key concepts: ${opts.topicMeta.concepts.join(', ')}`
                : undefined;
            const notesWithContext = [subTopicHint, topicMetaHint, store.notesInput.trim()].filter(Boolean).join('\n') || undefined;
            const res = await scrollApi.startFeed(
                sessionTopic, studentName, auth.user?.id,
                notesWithContext, apiPrefs, opts?.mode,
            );
            if (!res.success) { store.setError(res.error ?? "Failed to start feed"); return; }
            store.setSessionId(res.data.session_id);
            store.setTopic(sessionTopic);
            store.setCards(res.data.cards);
            store.setCurrentIdx(0);
            store.setStats(res.data.stats);
            store.clearCardState();
            answerStartTime.current = Date.now();
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            clearTimeout(timeout5s);
            clearTimeout(timeout15s);
            clearTimeout(timeout30s);
            clearTimeout(timeout);
            feedStartingRef.current = false;
            store.setIsLoading(false);
            setLoadingMessage("Setting up your feed...");
        }
    }, [store, auth.user]);

    // Subject selection → generate syllabus
    const handleSubjectSelect = useCallback(async (subject: string) => {
        // If we already have this syllabus loaded, just activate it
        if (store.syllabus && store.selectedSubject?.toLowerCase() === subject.toLowerCase()) {
            store.setSyllabusLoading(false);
            return;
        }
        store.setSelectedSubject(subject);
        store.setSyllabusLoading(true);
        store.setError(null);
        try {
            const res = await syllabusApi.generate(subject, auth.user?.id);
            if (res.success) {
                store.setSyllabus(res.data);
                store.setSelectedSubject(res.data.subject);
                const allTopics = res.data.units.flatMap((u) => u.topics);
                allTopics.forEach((t, i) => {
                    setTimeout(() => {
                        scrollApi.pregenContent(t.name, t.concepts, res.data.subject).catch(() => {});
                    }, i * 2000);
                });
                resourcesApi.list(res.data.subject, auth.user?.id).then((rRes) => {
                    if (rRes.success) {
                        store.setSubjectResources(rRes.data.resources.map((r) => ({
                            id: r.id,
                            file_name: r.file_name,
                            file_type: r.file_type,
                            concepts_count: r.concepts_count,
                        })));
                    }
                }).catch(() => {});
            } else {
                store.setError(res.error ?? "Failed to generate syllabus");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to generate syllabus");
        } finally {
            store.setSyllabusLoading(false);
        }
    }, [store, auth.user?.id]);

    // PDF upload → extract topic → generate syllabus
    const handlePdfUpload = useCallback(async (files: FileList) => {
        store.setSyllabusLoading(true);
        store.setError(null);
        try {
            const formData = new FormData();
            Array.from(files).forEach((f) => formData.append("files", f));
            if (auth.user?.id) formData.append("student_id", auth.user.id);

            const res = await resourcesApi.pdfToSyllabus(formData);
            if (!res.success) {
                store.setError(res.error ?? "Failed to process document");
                return;
            }

            store.setSyllabus(res.data.syllabus);
            store.setSelectedSubject(res.data.subject);
            store.setSubjectResources(res.data.resources.filter((r) => r.id).map((r) => ({
                id: r.id!,
                file_name: r.file_name,
                file_type: "pdf",
                concepts_count: r.concepts_count,
            })));

            // Pre-generate content for all topics
            const allPdfTopics = (res.data.syllabus as { units: Array<{ topics: Array<{ name: string; concepts: string[] }> }> }).units
                .flatMap((u) => u.topics);
            allPdfTopics.forEach((t, i) => {
                setTimeout(() => {
                    scrollApi.pregenContent(t.name, t.concepts, res.data.subject).catch(() => {});
                }, i * 2000);
            });
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to process document");
        } finally {
            store.setSyllabusLoading(false);
        }
    }, [store, auth.user?.id]);

    // Delete a subject and all its data
    const handleDeleteSubject = useCallback(async (subject: string) => {
        const studentName = getStudentName(auth.user);
        try {
            const res = await learnApi.deleteSubject(subject, studentName);
            if (res.success) {
                // Remove from history
                const updated = store.history.filter((h) => h.subject !== subject);
                store.setHistory(updated, store.historyOverall ?? { total_subjects: 0, total_sessions: 0, total_questions: 0, total_xp: 0, concepts_mastered: 0 });
                // Clear syllabus if it was the selected one
                if (store.selectedSubject === subject) {
                    store.clearSyllabus();
                }
            } else {
                store.setError(res.error ?? "Failed to delete subject");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to delete subject");
        }
    }, [store, auth.user?.name]);

    // Codebase analysis: "Learn this Project"
    const handleCodebaseAnalyze = useCallback(async (githubUrl: string) => {
        if (!githubUrl.trim()) return;
        store.setCodebaseLoading(true);
        store.setError(null);
        try {
            const res = await codebaseApi.analyze(githubUrl, auth.user?.id);
            if (res.success) {
                store.setCodebaseAnalysis(res.data.analysis);
                if (res.data.syllabus) {
                    store.setSyllabus(res.data.syllabus);
                }
                store.setSelectedSubject(res.data.syllabus_subject);
            } else {
                store.setError(res.error ?? "Failed to analyze repository");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Failed to analyze repository");
        } finally {
            store.setCodebaseLoading(false);
        }
    }, [store, auth.user?.id]);

    // Fetch learning history on mount (for personalized home)
    // Shows cached data instantly, refreshes in background
    useEffect(() => {
        if (store.sessionId || store.syllabus) return;
        const studentName = getStudentName(auth.user);
        // Only show loading skeleton if we have NO cached data
        if (!store.history || store.history.length === 0) {
            store.setHistoryLoading(true);
        }
        // Fetch in background regardless (refresh stale data)
        learnApi.getHistory(studentName, auth.user?.id).then((res) => {
            if (res.success) {
                store.setHistory(res.data.subjects, res.data.overall);
                store.setSuggestions(res.data.suggestions ?? []);
                store.setActiveSession(res.data.active_session ?? null);
            }
        }).finally(() => store.setHistoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.sessionId, store.syllabus]);

    return {
        loadingMessage,
        timeAgo,
        handleQuickStart,
        handleSubjectSelect,
        handlePdfUpload,
        handleDeleteSubject,
        handleCodebaseAnalyze,
        answerStartTime,
    };
}

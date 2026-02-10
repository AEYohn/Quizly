"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { scrollApi, syllabusApi, learnApi, resourcesApi, assessmentApi, curatedResourcesApi } from "~/lib/api";
import { useAuth, getStudentName } from "~/lib/auth";
import { useScrollSessionStore } from "~/stores/scrollSessionStore";
import type { SyllabusTopic } from "~/stores/scrollSessionStore";

export function useSkillTree(handleQuickStart: (topic: string, opts?: { mode?: 'structured' | 'mixed'; topicMeta?: { name: string; concepts: string[] } }) => Promise<void>) {
    const auth = useAuth();
    const store = useScrollSessionStore();

    const [showResourceSheet, setShowResourceSheet] = useState(false);
    const [showRegenBanner, setShowRegenBanner] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [topicResources, setTopicResources] = useState<Record<string, Array<{ title: string; url: string; source_type: string; thumbnail_url?: string }>>>({});
    const [showAssessment, setShowAssessment] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [recentSessions, setRecentSessions] = useState<Array<{ id: string; topic: string; phase: string; questions_answered: number; questions_correct: number; accuracy: number; started_at: string | null; ended_at: string | null }>>([]);
    const curationTriggeredRef = useRef<string | null>(null);

    // Resource upload
    const handleUploadResource = useCallback(async (files: FileList) => {
        if (!store.selectedSubject) return;
        store.setIsUploadingResource(true);
        try {
            const formData = new FormData();
            formData.append("subject", store.selectedSubject);
            if (auth.user?.id) formData.append("student_id", auth.user.id);
            for (const file of Array.from(files)) {
                formData.append("files", file);
            }
            const res = await resourcesApi.upload(formData);
            if (res.success) {
                for (const r of res.data.resources) {
                    if (r.id) {
                        store.addSubjectResource({
                            id: r.id,
                            file_name: r.file_name,
                            file_type: "pdf",
                            concepts_count: r.concepts_count,
                        });
                    }
                }
                // Auto-regenerate the skill tree with new materials
                setIsRegenerating(true);
                try {
                    const regenRes = await resourcesApi.regenerateSyllabus(store.selectedSubject!, auth.user?.id);
                    if (regenRes.success) {
                        store.setSyllabus(regenRes.data);
                        store.setSelectedSubject(regenRes.data.subject);
                    }
                } catch {
                    // Silently handle — tree still works without regen
                } finally {
                    setIsRegenerating(false);
                }
            } else {
                store.setError(res.error ?? "Upload failed");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            store.setIsUploadingResource(false);
        }
    }, [store, auth.user?.id]);

    const handleDeleteResource = useCallback(async (resourceId: string) => {
        const res = await resourcesApi.delete(resourceId);
        if (res.success) {
            store.removeSubjectResource(resourceId);
        }
    }, [store]);

    const handleRegenerateSyllabus = useCallback(async () => {
        if (!store.selectedSubject) return;
        setIsRegenerating(true);
        setShowRegenBanner(false);
        try {
            const res = await resourcesApi.regenerateSyllabus(store.selectedSubject, auth.user?.id);
            if (res.success) {
                store.setSyllabus(res.data);
                store.setSelectedSubject(res.data.subject);
            } else {
                store.setError(res.error ?? "Regeneration failed");
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Regeneration failed");
        } finally {
            setIsRegenerating(false);
        }
    }, [store, auth.user?.id]);

    // Topic node tap → start feed
    const handleNodeTap = useCallback(async (topic: SyllabusTopic) => {
        if (store.isLoading) return;
        store.setActiveSyllabusNode(topic.id);
        store.setTopicInput(topic.name);
        await handleQuickStart(topic.name);
    }, [store, handleQuickStart]);

    // Start learning: structured mode
    const handleStartLearning = useCallback(async (topic: SyllabusTopic) => {
        if (store.isLoading) return;
        store.setActiveSyllabusNode(topic.id);
        store.setTopicInput(topic.name);
        await handleQuickStart(topic.name, { mode: 'structured', topicMeta: topic });
    }, [store, handleQuickStart]);

    // Study notes: fetch and display topic notes
    const handleStudyNotes = useCallback(async (topic: SyllabusTopic) => {
        // Fetch notes via the API — caller (SkillTree) handles display
        const res = await learnApi.getTopicNotes(topic.name, topic.concepts);
        return res;
    }, []);

    // Quiz only: start structured session then skip to quiz phase
    const handleQuizOnly = useCallback(async (topic: SyllabusTopic) => {
        if (store.isLoading) return;
        store.setActiveSyllabusNode(topic.id);
        store.setTopicInput(topic.name);
        await handleQuickStart(topic.name, { mode: 'structured', topicMeta: topic });
        // After session starts, skip to quiz phase
        if (store.sessionId) {
            try {
                const skipRes = await scrollApi.skipPhase(store.sessionId, 'quiz');
                if (skipRes.success) {
                    store.setCards(skipRes.data.cards);
                    store.setCurrentIdx(0);
                    store.setStats(skipRes.data.stats);
                }
            } catch {
                // Session still works, just won't skip phase
            }
        }
    }, [store, handleQuickStart]);

    // Flashcards only: start structured session then skip to flashcards phase
    const handleFlashcardsOnly = useCallback(async (topic: SyllabusTopic) => {
        if (store.isLoading) return;
        store.setActiveSyllabusNode(topic.id);
        store.setTopicInput(topic.name);
        await handleQuickStart(topic.name, { mode: 'structured', topicMeta: topic });
        if (store.sessionId) {
            try {
                const skipRes = await scrollApi.skipPhase(store.sessionId, 'flashcards');
                if (skipRes.success) {
                    store.setCards(skipRes.data.cards);
                    store.setCurrentIdx(0);
                    store.setStats(skipRes.data.stats);
                }
            } catch { }
        }
    }, [store, handleQuickStart]);

    // Mastery fetch + recommended path
    const fetchMastery = useCallback(async () => {
        if (!store.syllabus) return;
        const studentName = getStudentName(auth.user);
        const res = await learnApi.getProgress(studentName);
        if (res.success) {
            const masteryMap: Record<string, number> = {};
            const conceptScores: Record<string, number> = {};
            for (const m of res.data.mastery) {
                conceptScores[m.concept.toLowerCase()] = m.score;
            }
            for (const unit of store.syllabus.units) {
                for (const topic of unit.topics) {
                    const scores = topic.concepts.map(
                        (c) => conceptScores[c.toLowerCase()] ?? 0,
                    );
                    masteryMap[topic.id] =
                        scores.length > 0
                            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                            : 0;
                }
            }
            store.setMastery(masteryMap);
            if (res.data.recent_sessions) {
                setRecentSessions(res.data.recent_sessions);
            }
        }

        if (store.selectedSubject) {
            const pathRes = await syllabusApi.getRecommendedPath(store.selectedSubject, studentName);
            if (pathRes.success) {
                store.setRecommendedNext(pathRes.data.next);
            }
        }
    }, [store, store.syllabus, store.selectedSubject, auth.user?.name]);

    // Presence polling
    useEffect(() => {
        if (!store.selectedSubject || !store.syllabus || store.sessionId) return;
        const poll = async () => {
            const res = await syllabusApi.getPresence(store.selectedSubject!);
            if (res.success) {
                const counts: Record<string, number> = {};
                for (const [nodeId, data] of Object.entries(res.data)) {
                    counts[nodeId] = data.count;
                }
                store.setPresence(counts);
            }
        };
        poll();
        const interval = setInterval(poll, 30000);
        return () => clearInterval(interval);
    }, [store.selectedSubject, store.syllabus, store.sessionId, store]);

    // Heartbeat while in feed
    useEffect(() => {
        if (!store.sessionId || !store.selectedSubject || !store.activeSyllabusNode) return;
        const studentName = getStudentName(auth.user);
        const beat = () => {
            syllabusApi.heartbeat(store.selectedSubject!, store.activeSyllabusNode!, studentName);
        };
        beat();
        const interval = setInterval(beat, 30000);
        return () => clearInterval(interval);
    }, [store.sessionId, store.selectedSubject, store.activeSyllabusNode, auth.user?.name]);

    // Fetch mastery when returning to tree
    useEffect(() => {
        if (!store.sessionId && store.syllabus) {
            fetchMastery();
        }
    }, [store.sessionId, store.syllabus, fetchMastery]);

    // Fetch curated resources for topic nodes
    const fetchCuratedResources = useCallback(() => {
        if (!store.selectedSubject || !store.syllabus) return;
        curatedResourcesApi.list(store.selectedSubject).then((res) => {
            if (res.success && res.data.resources) {
                const byTopic: Record<string, Array<{ title: string; url: string; source_type: string; thumbnail_url?: string }>> = {};
                for (const r of res.data.resources) {
                    const concept = r.concept?.toLowerCase() ?? "";
                    for (const unit of store.syllabus!.units) {
                        for (const topic of unit.topics) {
                            if (topic.concepts.some((c) => c.toLowerCase() === concept)) {
                                if (!byTopic[topic.id]) byTopic[topic.id] = [];
                                if (byTopic[topic.id]!.length < 3) {
                                    byTopic[topic.id]!.push({
                                        title: r.title,
                                        url: r.url,
                                        source_type: r.source_type,
                                        thumbnail_url: r.thumbnail_url,
                                    });
                                }
                            }
                        }
                    }
                }
                setTopicResources(byTopic);
            }
        }).catch(() => {});
    }, [store.selectedSubject, store.syllabus]);

    useEffect(() => {
        fetchCuratedResources();
    }, [fetchCuratedResources]);

    // Trigger AI curation on first visit per subject, then re-fetch after delay
    // NOTE: Disabled until a valid SERPER_API_KEY is configured — failing requests overwhelm the backend
    // useEffect(() => {
    //     if (!store.selectedSubject || !store.syllabus) return;
    //     if (curationTriggeredRef.current === store.selectedSubject) return;
    //     curationTriggeredRef.current = store.selectedSubject;
    //     const allConcepts = store.syllabus.units.flatMap(u => u.topics.flatMap(t => t.concepts)).slice(0, 5);
    //     curatedResourcesApi.triggerCuration(store.selectedSubject, allConcepts).catch(() => {});
    //     const timer = setTimeout(() => fetchCuratedResources(), 8000);
    //     return () => clearTimeout(timer);
    // }, [store.selectedSubject, store.syllabus, fetchCuratedResources]);

    // Generate content from uploaded resources
    const handleGenerateFromResources = useCallback(async () => {
        if (!store.selectedSubject || !store.syllabus) return;
        store.setIsGeneratingContent(true);
        store.setGenerationProgress(null);

        try {
            // Gather all concepts from the syllabus
            const allConcepts = store.syllabus.units
                .flatMap((u) => u.topics.flatMap((t) => t.concepts))
                .slice(0, 15);

            const summary = await resourcesApi.generateFromResourcesStream(
                store.selectedSubject,
                (event) => {
                    store.setGenerationProgress({
                        step: event.step,
                        progress: event.progress,
                        message: event.message,
                    });
                },
                undefined, // topic — let backend use first syllabus topic
                allConcepts,
                auth.user?.id,
            );

            // Clear cached notes so fresh content is fetched on next visit
            // Re-use the clearSyllabus pattern but only for notes
            store.setTopicNotes("__clear_all__", { topic: "", total_notes: 0, notes_by_concept: {} });

            if (summary) {
                store.setGenerationProgress({
                    step: "complete",
                    progress: 1,
                    message: `Generated ${summary.notes} notes, ${summary.flashcards} flashcards, ${summary.quiz} quiz questions`,
                });
            }
        } catch {
            store.setGenerationProgress({
                step: "error",
                progress: 0,
                message: "Content generation failed. Please try again.",
            });
        } finally {
            store.setIsGeneratingContent(false);
        }
    }, [store, auth.user?.id]);

    // Start assessment flow
    const handleStartAssessment = useCallback(async () => {
        if (!store.selectedSubject || !store.syllabus) return;
        const studentName = getStudentName(auth.user);
        store.setAssessmentPhase('self_rating');
        setShowAssessment(true);
        try {
            const res = await assessmentApi.start(store.selectedSubject, studentName);
            if (!res.success) {
                store.setError(res.error ?? "Failed to start assessment");
                store.setAssessmentPhase('none');
                setShowAssessment(false);
            }
        } catch (err) {
            store.setError(err instanceof Error ? err.message : "Assessment failed");
            store.setAssessmentPhase('none');
            setShowAssessment(false);
        }
    }, [store, auth.user?.name]);

    return {
        showResourceSheet,
        setShowResourceSheet,
        showRegenBanner,
        isRegenerating,
        handleUploadResource,
        handleDeleteResource,
        handleRegenerateSyllabus,
        handleNodeTap,
        handleStartLearning,
        handleStudyNotes,
        handleQuizOnly,
        handleFlashcardsOnly,
        recentSessions,
        topicResources,
        showAssessment,
        setShowAssessment,
        handleStartAssessment,
        handleGenerateFromResources,
        showAnalysis,
        setShowAnalysis,
    };
}

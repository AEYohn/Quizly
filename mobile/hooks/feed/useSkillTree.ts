import { useState, useCallback, useEffect } from "react";
import {
  syllabusApi,
  learnApi,
  resourcesApi,
  assessmentApi,
  curatedResourcesApi,
} from "@/lib/learnApi";
import { useAuth } from "@/providers/AuthProvider";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import type { SyllabusTopic } from "@/types/learn";

export function useSkillTree(
  handleQuickStart: (topic: string, opts?: { mode?: "structured" | "mixed"; topicMeta?: SyllabusTopic }) => Promise<void>,
) {
  const auth = useAuth();
  const store = useScrollSessionStore();

  const [showResourceSheet, setShowResourceSheet] = useState(false);
  const [showRegenBanner, setShowRegenBanner] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [topicResources, setTopicResources] = useState<
    Record<
      string,
      Array<{
        title: string;
        url: string;
        source_type: string;
        thumbnail_url?: string;
      }>
    >
  >({});
  const [showAssessment, setShowAssessment] = useState(false);

  // Resource upload (FormData with expo-document-picker result)
  const handleUploadResource = useCallback(
    async (formData: FormData) => {
      if (!store.selectedSubject) return;
      store.setIsUploadingResource(true);
      try {
        const res = await resourcesApi.upload(formData);
        if (res.success && res.data) {
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
          setShowRegenBanner(true);
        } else {
          store.setError(res.error ?? "Upload failed");
        }
      } catch (err) {
        store.setError(
          err instanceof Error ? err.message : "Upload failed",
        );
      } finally {
        store.setIsUploadingResource(false);
      }
    },
    [store],
  );

  const handleDeleteResource = useCallback(
    async (resourceId: string) => {
      const res = await resourcesApi.delete(resourceId);
      if (res.success) {
        store.removeSubjectResource(resourceId);
      }
    },
    [store],
  );

  const handleRegenerateSyllabus = useCallback(async () => {
    if (!store.selectedSubject) return;
    setIsRegenerating(true);
    setShowRegenBanner(false);
    try {
      const res = await resourcesApi.regenerateSyllabus(
        store.selectedSubject,
        auth.userId ?? undefined,
      );
      if (res.success && res.data) {
        store.setSyllabus(res.data);
        store.setSelectedSubject(res.data.subject);
      } else {
        store.setError(res.error ?? "Regeneration failed");
      }
    } catch (err) {
      store.setError(
        err instanceof Error ? err.message : "Regeneration failed",
      );
    } finally {
      setIsRegenerating(false);
    }
  }, [store, auth.userId]);

  // Topic node tap → start feed (structured mode with topic metadata)
  const handleNodeTap = useCallback(
    async (topic: SyllabusTopic) => {
      if (store.isLoading) return;
      store.setActiveSyllabusNode(topic.id);
      store.setTopicInput(topic.name);
      await handleQuickStart(topic.name, { mode: "structured", topicMeta: topic });
    },
    [store, handleQuickStart],
  );

  // Mastery fetch + recommended path
  const fetchMastery = useCallback(async () => {
    if (!store.syllabus) return;
    const studentName = auth.nickname || "Student";
    const res = await learnApi.getProgress(studentName);
    if (res.success && res.data) {
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
              ? Math.round(
                  scores.reduce((a, b) => a + b, 0) / scores.length,
                )
              : 0;
        }
      }
      store.setMastery(masteryMap);
    }

    if (store.selectedSubject) {
      const pathRes = await syllabusApi.getRecommendedPath(
        store.selectedSubject,
        studentName,
      );
      if (pathRes.success && pathRes.data) {
        store.setRecommendedNext(pathRes.data.next);
      }
    }
  }, [store, store.syllabus, store.selectedSubject, auth.nickname]);

  // Presence polling
  useEffect(() => {
    if (!store.selectedSubject || !store.syllabus || store.sessionId) return;
    const poll = async () => {
      const res = await syllabusApi.getPresence(store.selectedSubject!);
      if (res.success && res.data) {
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
    if (
      !store.sessionId ||
      !store.selectedSubject ||
      !store.activeSyllabusNode
    )
      return;
    const studentName = auth.nickname || "Student";
    const beat = () => {
      syllabusApi.heartbeat(
        store.selectedSubject!,
        store.activeSyllabusNode!,
        studentName,
      );
    };
    beat();
    const interval = setInterval(beat, 30000);
    return () => clearInterval(interval);
  }, [
    store.sessionId,
    store.selectedSubject,
    store.activeSyllabusNode,
    auth.nickname,
  ]);

  // Fetch mastery when returning to tree
  useEffect(() => {
    if (!store.sessionId && store.syllabus) {
      fetchMastery();
    }
  }, [store.sessionId, store.syllabus, fetchMastery]);

  // Fetch curated resources
  const fetchCuratedResources = useCallback(() => {
    if (!store.selectedSubject || !store.syllabus) return;
    curatedResourcesApi
      .list(store.selectedSubject)
      .then((res) => {
        if (res.success && res.data?.resources) {
          const byTopic: Record<
            string,
            Array<{
              title: string;
              url: string;
              source_type: string;
              thumbnail_url?: string;
            }>
          > = {};
          for (const r of res.data.resources) {
            const concept = r.concept?.toLowerCase() ?? "";
            for (const unit of store.syllabus!.units) {
              for (const topic of unit.topics) {
                if (
                  topic.concepts.some((c) => c.toLowerCase() === concept)
                ) {
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
      })
      .catch(() => {});
  }, [store.selectedSubject, store.syllabus]);

  useEffect(() => {
    fetchCuratedResources();
  }, [fetchCuratedResources]);

  // Start assessment
  const handleStartAssessment = useCallback(async () => {
    if (!store.selectedSubject || !store.syllabus) return;
    const studentName = auth.nickname || "Student";
    store.setAssessmentPhase("self_rating");
    setShowAssessment(true);
    try {
      const res = await assessmentApi.start(
        store.selectedSubject,
        studentName,
      );
      if (!res.success) {
        store.setError(res.error ?? "Failed to start assessment");
        store.setAssessmentPhase("none");
        setShowAssessment(false);
      }
    } catch (err) {
      store.setError(
        err instanceof Error ? err.message : "Assessment failed",
      );
      store.setAssessmentPhase("none");
      setShowAssessment(false);
    }
  }, [store, auth.nickname]);

  return {
    showResourceSheet,
    setShowResourceSheet,
    showRegenBanner,
    isRegenerating,
    handleUploadResource,
    handleDeleteResource,
    handleRegenerateSyllabus,
    handleNodeTap,
    topicResources,
    showAssessment,
    setShowAssessment,
    handleStartAssessment,
  };
}

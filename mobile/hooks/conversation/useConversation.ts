import { useCallback } from "react";
import { useLearningSessionStore } from "@/stores/learningSessionStore";
import { conversationApi } from "@/lib/learnApi";
import { useAuth } from "@/providers/AuthProvider";
import type { ChatMessage, QuestionData, LessonData } from "@/types/learn";

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function makeMessage(
  role: ChatMessage["role"],
  content: string,
  extras?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: makeId(),
    role,
    content,
    timestamp: Date.now(),
    ...extras,
  };
}

/** Access current store state without re-renders */
function getState() {
  return useLearningSessionStore.getState();
}

export function useConversation() {
  const store = useLearningSessionStore();
  const auth = useAuth();
  const studentName = auth.nickname || "Student";

  const startConversation = useCallback(
    async (topic: string) => {
      getState().setIsLoading(true);
      try {
        const res = await conversationApi.start(topic, studentName);
        if (!res.success || !res.data) {
          throw new Error(res.error || "Failed to start session");
        }

        const { session_id, messages, question, phase } = res.data;
        const s = getState();
        s.startSession(session_id, topic);
        s.setPhase(phase === "diagnostic" ? "diagnostic" : "learning");

        // Add initial messages from backend
        for (const msg of messages) {
          getState().addMessage(
            makeMessage(
              msg.role === "ai" ? "ai" : msg.role === "system" ? "system" : "student",
              msg.content,
              { action: msg.action as ChatMessage["action"] },
            ),
          );
        }

        // Set first question if provided
        if (question) {
          getState().setCurrentQuestion(question as QuestionData);
        }
      } catch (err) {
        console.warn("Failed to start conversation:", err);
        getState().addMessage(
          makeMessage("system", "Failed to start session. Please try again."),
        );
      }
      getState().setIsLoading(false);
    },
    [studentName],
  );

  const submitAnswer = useCallback(async () => {
    const { sessionId, selectedAnswer, confidence, currentQuestion } =
      getState();
    if (!sessionId || !selectedAnswer) return;

    getState().setIsAiThinking(true);

    // Add student's answer as a message
    const matchingOption = currentQuestion?.options.find(
      (o: string) => o.startsWith(selectedAnswer),
    );
    const answerLabel = currentQuestion
      ? `${selectedAnswer}) ${matchingOption?.replace(/^[A-D][.)]\s*/, "") ?? selectedAnswer}`
      : selectedAnswer;
    getState().addMessage(makeMessage("student", answerLabel));

    try {
      const res = await conversationApi.submitAnswer(
        sessionId,
        selectedAnswer,
        confidence,
      );
      if (!res.success || !res.data) {
        throw new Error(res.error || "Failed to submit answer");
      }

      const { assessment, action, message, question, lesson, progress } =
        res.data;

      // Record answer
      getState().recordAnswer(assessment.is_correct);

      // Add AI response message
      getState().addMessage(
        makeMessage("ai", message, {
          action: action as ChatMessage["action"],
          lesson: lesson as LessonData | undefined,
          progress: progress
            ? {
                conceptsMastered: progress.conceptsMastered ?? [],
                conceptsInProgress: progress.conceptsInProgress ?? [],
                questionsAnswered: progress.questionsAnswered ?? 0,
                accuracy: progress.accuracy ?? 0,
              }
            : undefined,
        }),
      );

      // Handle action
      const s = getState();
      if (action === "discuss") {
        s.setIsInDiscussion(true, "probing");
        s.setCurrentQuestion(null);
      } else if (action === "wrap_up") {
        s.endSession();
      } else if (action === "teach") {
        // Lesson display — don't show question card, let MicroLessonCard render
        s.setIsInDiscussion(false);
        s.setCurrentQuestion(null);
      } else {
        // question, celebrate, plan_update, and others — advance to next question if provided
        s.setIsInDiscussion(false);
        if (question) {
          s.setCurrentQuestion(question as QuestionData);
        } else {
          s.setCurrentQuestion(null);
        }
      }
    } catch (err) {
      console.warn("Failed to submit answer:", err);
      getState().addMessage(
        makeMessage("system", "Something went wrong. Please try again."),
      );
      // Clear selection so student can retry
      getState().setSelectedAnswer(null);
    }
    getState().setIsAiThinking(false);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const { sessionId } = getState();
    if (!sessionId || !text.trim()) return;

    // Add student message
    getState().addMessage(makeMessage("student", text));
    getState().setIsAiThinking(true);

    try {
      const res = await conversationApi.sendMessage(sessionId, text);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Failed to send message");
      }

      const { message, discussion_phase, ready_to_retry, question } =
        res.data;

      getState().addMessage(
        makeMessage("ai", message, {
          action: ready_to_retry ? "question" : "discuss",
        }),
      );

      const s = getState();
      s.setIsInDiscussion(!ready_to_retry, discussion_phase);

      if (ready_to_retry && question) {
        s.setCurrentQuestion(question as QuestionData);
      }
    } catch (err) {
      console.warn("Failed to send message:", err);
      getState().addMessage(
        makeMessage("system", "Something went wrong. Please try again."),
      );
    }
    getState().setIsAiThinking(false);
  }, []);

  const endConversation = useCallback(async () => {
    const { sessionId } = getState();
    if (!sessionId) return null;

    getState().setIsLoading(true);
    try {
      const res = await conversationApi.end(sessionId);
      getState().endSession();
      if (res.success && res.data) {
        getState().setIsLoading(false);
        return res.data.summary;
      }
    } catch (err) {
      console.warn("Failed to end conversation:", err);
    }
    getState().setIsLoading(false);
    return null;
  }, []);

  return {
    // State (read from store via hook — triggers re-renders)
    sessionId: store.sessionId,
    topic: store.topic,
    phase: store.phase,
    messages: store.messages,
    currentQuestion: store.currentQuestion,
    selectedAnswer: store.selectedAnswer,
    confidence: store.confidence,
    questionsAnswered: store.questionsAnswered,
    correctCount: store.correctCount,
    isInDiscussion: store.isInDiscussion,
    discussionPhase: store.discussionPhase,
    isLoading: store.isLoading,
    isAiThinking: store.isAiThinking,
    // Actions from store
    setSelectedAnswer: store.setSelectedAnswer,
    setConfidence: store.setConfidence,
    reset: store.reset,
    // Actions from hook
    startConversation,
    submitAnswer,
    sendMessage,
    endConversation,
  };
}

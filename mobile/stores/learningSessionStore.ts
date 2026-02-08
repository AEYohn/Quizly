import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  SessionPhase,
  ChatMessage,
  QuestionData,
  ConceptMastery,
} from "@/types/learn";

interface LearningSessionState {
  // Session identity
  sessionId: string | null;
  topic: string | null;
  phase: SessionPhase;

  // Chat messages
  messages: ChatMessage[];

  // Current question state
  currentQuestion: QuestionData | null;
  selectedAnswer: string | null;
  confidence: number;

  // Session progress
  questionsAnswered: number;
  correctCount: number;
  conceptMastery: ConceptMastery[];

  // Discussion state
  isInDiscussion: boolean;
  discussionPhase: string | null;

  // Loading
  isLoading: boolean;
  isAiThinking: boolean;

  // Actions
  startSession: (sessionId: string, topic: string) => void;
  setPhase: (phase: SessionPhase) => void;
  addMessage: (message: ChatMessage) => void;
  setCurrentQuestion: (question: QuestionData | null) => void;
  setSelectedAnswer: (answer: string | null) => void;
  setConfidence: (confidence: number) => void;
  recordAnswer: (correct: boolean) => void;
  updateMastery: (mastery: ConceptMastery[]) => void;
  setIsInDiscussion: (value: boolean, phase?: string | null) => void;
  setIsLoading: (value: boolean) => void;
  setIsAiThinking: (value: boolean) => void;
  endSession: () => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  topic: null,
  phase: "idle" as SessionPhase,
  messages: [],
  currentQuestion: null,
  selectedAnswer: null,
  confidence: 50,
  questionsAnswered: 0,
  correctCount: 0,
  conceptMastery: [],
  isInDiscussion: false,
  discussionPhase: null,
  isLoading: false,
  isAiThinking: false,
};

export const useLearningSessionStore = create<LearningSessionState>()(
  persist(
    (set) => ({
      ...initialState,

      startSession: (sessionId, topic) =>
        set({
          sessionId,
          topic,
          phase: "starting",
          messages: [],
          questionsAnswered: 0,
          correctCount: 0,
          conceptMastery: [],
        }),

      setPhase: (phase) => set({ phase }),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      setCurrentQuestion: (question) =>
        set({
          currentQuestion: question,
          selectedAnswer: null,
          confidence: 50,
        }),

      setSelectedAnswer: (answer) => set({ selectedAnswer: answer }),

      setConfidence: (confidence) => set({ confidence }),

      recordAnswer: (correct) =>
        set((state) => ({
          questionsAnswered: state.questionsAnswered + 1,
          correctCount: state.correctCount + (correct ? 1 : 0),
        })),

      updateMastery: (mastery) => set({ conceptMastery: mastery }),

      setIsInDiscussion: (value, phase = null) =>
        set({ isInDiscussion: value, discussionPhase: phase }),

      setIsLoading: (value) => set({ isLoading: value }),

      setIsAiThinking: (value) => set({ isAiThinking: value }),

      endSession: () =>
        set({
          phase: "ended",
          currentQuestion: null,
          isInDiscussion: false,
        }),

      reset: () => set(initialState),
    }),
    {
      name: "quizly-learning-session",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted: unknown, version: number) => {
        if (version === 0) return {} as any;
        return persisted as any;
      },
      partialize: (state) => ({
        sessionId: state.sessionId,
        topic: state.topic,
        phase: state.phase,
        messages: state.messages.slice(-50),
        questionsAnswered: state.questionsAnswered,
        correctCount: state.correctCount,
        conceptMastery: state.conceptMastery,
      }),
    },
  ),
);

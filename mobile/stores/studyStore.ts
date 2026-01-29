import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CardReview, DailyStudyStats, StudySession } from '@/types/study';
import { eventBus } from '@/lib/events';

interface StudyState {
  cardReviews: Record<string, CardReview>;
  dailyStats: DailyStudyStats[];
  currentSession: StudySession | null;

  // Actions
  initializeCard: (cardId: string, quizId: string) => void;
  recordReview: (cardId: string, quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
  startSession: (quizId: string) => void;
  endSession: () => DailyStudyStats | null;
  getDueCards: (quizId?: string) => CardReview[];
  getStudyStats: () => {
    dueToday: number;
    dueTomorrow: number;
    mastered: number;
    learning: number;
  };
  reset: () => void;
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function calculateNextReview(
  card: CardReview,
  quality: number
): Partial<CardReview> {
  const today = getDateString(new Date());

  if (quality < 3) {
    // Reset on incorrect
    return {
      repetitions: 0,
      interval: 1,
      lastReviewDate: today,
      nextReviewDate: getDateString(addDays(new Date(), 1)),
    };
  }

  // SM-2 algorithm
  const newEF = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );
  const newReps = card.repetitions + 1;

  let newInterval: number;
  if (newReps === 1) {
    newInterval = 1;
  } else if (newReps === 2) {
    newInterval = 6;
  } else {
    newInterval = Math.round(card.interval * newEF);
  }

  return {
    easeFactor: newEF,
    repetitions: newReps,
    interval: newInterval,
    lastReviewDate: today,
    nextReviewDate: getDateString(addDays(new Date(), newInterval)),
  };
}

const initialState = {
  cardReviews: {} as Record<string, CardReview>,
  dailyStats: [] as DailyStudyStats[],
  currentSession: null as StudySession | null,
};

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      ...initialState,

      initializeCard: (cardId: string, quizId: string) => {
        const today = getDateString(new Date());
        set((state) => ({
          cardReviews: {
            ...state.cardReviews,
            [cardId]: {
              cardId,
              visitorId: quizId,
              easeFactor: 2.5,
              interval: 0,
              repetitions: 0,
              nextReviewDate: today,
              lastReviewDate: today,
            },
          },
        }));
      },

      recordReview: (cardId: string, quality: 0 | 1 | 2 | 3 | 4 | 5) => {
        const card = get().cardReviews[cardId];
        if (!card) return;

        const updates = calculateNextReview(card, quality);

        set((state) => ({
          cardReviews: {
            ...state.cardReviews,
            [cardId]: { ...card, ...updates },
          },
        }));

        // Emit event for gamification track
        eventBus.emit({
          type: 'CARD_REVIEWED',
          payload: { cardId, quality },
        });

        // Update current session if active
        const session = get().currentSession;
        if (session) {
          set((state) => ({
            currentSession: state.currentSession
              ? {
                  ...state.currentSession,
                  cardsReviewed: [...state.currentSession.cardsReviewed, cardId],
                  correctCount:
                    state.currentSession.correctCount + (quality >= 3 ? 1 : 0),
                }
              : null,
          }));
        }
      },

      startSession: (quizId: string) => {
        set({
          currentSession: {
            id: `session-${Date.now()}`,
            quizId,
            startedAt: new Date().toISOString(),
            cardsReviewed: [],
            correctCount: 0,
          },
        });
      },

      endSession: () => {
        const session = get().currentSession;
        if (!session) return null;

        const today = getDateString(new Date());
        const stats: DailyStudyStats = {
          date: today,
          cardsReviewed: session.cardsReviewed.length,
          correctCount: session.correctCount,
          totalTime: Math.floor(
            (Date.now() - new Date(session.startedAt).getTime()) / 1000
          ),
        };

        set((state) => {
          const existingIndex = state.dailyStats.findIndex(
            (s) => s.date === today
          );
          const newStats = [...state.dailyStats];

          if (existingIndex >= 0) {
            newStats[existingIndex] = {
              ...newStats[existingIndex],
              cardsReviewed:
                newStats[existingIndex].cardsReviewed + stats.cardsReviewed,
              correctCount:
                newStats[existingIndex].correctCount + stats.correctCount,
              totalTime: newStats[existingIndex].totalTime + stats.totalTime,
            };
          } else {
            newStats.push(stats);
          }

          return {
            currentSession: null,
            dailyStats: newStats,
          };
        });

        return stats;
      },

      getDueCards: (quizId?: string) => {
        const today = getDateString(new Date());
        const reviews = Object.values(get().cardReviews);

        return reviews.filter((card) => {
          const isDue = card.nextReviewDate <= today;
          const matchesQuiz = quizId ? card.visitorId === quizId : true;
          return isDue && matchesQuiz;
        });
      },

      getStudyStats: () => {
        const today = getDateString(new Date());
        const tomorrow = getDateString(addDays(new Date(), 1));
        const reviews = Object.values(get().cardReviews);

        return {
          dueToday: reviews.filter((c) => c.nextReviewDate <= today).length,
          dueTomorrow: reviews.filter((c) => c.nextReviewDate === tomorrow)
            .length,
          mastered: reviews.filter((c) => c.interval > 30).length,
          learning: reviews.filter((c) => c.interval <= 30 && c.interval > 0)
            .length,
        };
      },

      reset: () => set(initialState),
    }),
    {
      name: 'quizly-study-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

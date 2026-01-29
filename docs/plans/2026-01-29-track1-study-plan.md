# Track 1: Study Effectiveness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build spaced repetition engine, flashcard mode, and study analytics to help users retain knowledge effectively.

**Architecture:** StudyStore (Zustand) manages card review state with SM-2 algorithm. FlashcardDeck component uses gestures for swipe interactions. Analytics screen visualizes study patterns.

**Tech Stack:** Zustand, react-native-reanimated, react-native-gesture-handler, date-fns

**Dependencies:** Foundation must be complete (types, events, theme)

---

## Task 1: Create Study Store

**Files:**
- Create: `mobile/stores/studyStore.ts`
- Test: `mobile/__tests__/stores/studyStore.test.ts`

**Step 1: Write the failing test**

Create `mobile/__tests__/stores/studyStore.test.ts`:
```typescript
import { useStudyStore } from '@/stores/studyStore';
import { act } from '@testing-library/react-native';

describe('studyStore', () => {
  beforeEach(() => {
    useStudyStore.getState().reset();
  });

  describe('SM-2 algorithm', () => {
    it('should create new card review with default values', () => {
      const { initializeCard } = useStudyStore.getState();

      initializeCard('card-1', 'quiz-1');

      const reviews = useStudyStore.getState().cardReviews;
      expect(reviews['card-1']).toBeDefined();
      expect(reviews['card-1'].easeFactor).toBe(2.5);
      expect(reviews['card-1'].interval).toBe(0);
      expect(reviews['card-1'].repetitions).toBe(0);
    });

    it('should reset card on quality < 3', () => {
      const { initializeCard, recordReview } = useStudyStore.getState();

      initializeCard('card-1', 'quiz-1');
      // First make it have some progress
      recordReview('card-1', 4);
      recordReview('card-1', 4);
      // Then fail it
      recordReview('card-1', 2);

      const card = useStudyStore.getState().cardReviews['card-1'];
      expect(card.repetitions).toBe(0);
      expect(card.interval).toBe(1);
    });

    it('should increase interval on quality >= 3', () => {
      const { initializeCard, recordReview } = useStudyStore.getState();

      initializeCard('card-1', 'quiz-1');
      recordReview('card-1', 4);

      const card = useStudyStore.getState().cardReviews['card-1'];
      expect(card.repetitions).toBe(1);
      expect(card.interval).toBe(1);
    });
  });

  describe('getDueCards', () => {
    it('should return cards due for review', () => {
      const { initializeCard, getDueCards } = useStudyStore.getState();

      initializeCard('card-1', 'quiz-1');
      initializeCard('card-2', 'quiz-1');

      const dueCards = getDueCards();
      expect(dueCards.length).toBe(2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/stores/studyStore.test.ts
```

Expected: FAIL - Cannot find module

**Step 3: Write implementation**

Create `mobile/stores/studyStore.ts`:
```typescript
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
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && npm test -- __tests__/stores/studyStore.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add stores/studyStore.ts __tests__/stores/studyStore.test.ts && git commit -m "feat(study): add study store with SM-2 spaced repetition algorithm"
```

---

## Task 2: Create Flashcard Item Component

**Files:**
- Create: `mobile/components/study/FlashcardItem.tsx`

**Step 1: Create the component**

Create `mobile/components/study/FlashcardItem.tsx`:
```typescript
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme } from '@/providers/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = 400;

interface FlashcardItemProps {
  questionText: string;
  answerText: string;
  explanation?: string;
  imageUrl?: string;
  isFlipped?: boolean;
  onFlip?: () => void;
}

export function FlashcardItem({
  questionText,
  answerText,
  explanation,
  isFlipped: controlledFlipped,
  onFlip,
}: FlashcardItemProps) {
  const { colors, isDark } = useTheme();
  const [internalFlipped, setInternalFlipped] = useState(false);

  const isFlipped = controlledFlipped ?? internalFlipped;
  const flipProgress = useSharedValue(0);

  const handleFlip = () => {
    flipProgress.value = withTiming(isFlipped ? 0 : 1, { duration: 300 });
    if (onFlip) {
      onFlip();
    } else {
      setInternalFlipped(!internalFlipped);
    }
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      flipProgress.value,
      [0, 1],
      [0, 180],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      flipProgress.value,
      [0, 1],
      [180, 360],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const cardBg = isDark ? '#1F2937' : '#FFFFFF';
  const borderColor = isDark ? '#374151' : '#E5E7EB';

  return (
    <Pressable onPress={handleFlip} style={styles.container}>
      {/* Front - Question */}
      <Animated.View
        style={[
          styles.card,
          frontAnimatedStyle,
          { backgroundColor: cardBg, borderColor },
        ]}
      >
        <View style={styles.label}>
          <Text style={[styles.labelText, { color: colors.brand }]}>
            QUESTION
          </Text>
        </View>
        <View style={styles.content}>
          <Text
            style={[styles.mainText, { color: colors.textPrimary }]}
            numberOfLines={10}
          >
            {questionText}
          </Text>
        </View>
        <View style={styles.hint}>
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            Tap to reveal answer
          </Text>
        </View>
      </Animated.View>

      {/* Back - Answer */}
      <Animated.View
        style={[
          styles.card,
          styles.cardBack,
          backAnimatedStyle,
          { backgroundColor: cardBg, borderColor },
        ]}
      >
        <View style={styles.label}>
          <Text style={[styles.labelText, { color: colors.success }]}>
            ANSWER
          </Text>
        </View>
        <View style={styles.content}>
          <Text
            style={[styles.mainText, { color: colors.textPrimary }]}
            numberOfLines={6}
          >
            {answerText}
          </Text>
          {explanation && (
            <View style={[styles.explanationBox, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                {explanation}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.hint}>
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            Tap to see question
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardBack: {
    position: 'absolute',
  },
  label: {
    alignSelf: 'flex-start',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  mainText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 32,
    textAlign: 'center',
  },
  explanationBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  hint: {
    alignItems: 'center',
  },
  hintText: {
    fontSize: 12,
  },
});
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/study/FlashcardItem.tsx && git commit -m "feat(study): add FlashcardItem component with flip animation"
```

---

## Task 3: Create Flashcard Deck Component

**Files:**
- Create: `mobile/components/study/FlashcardDeck.tsx`

**Step 1: Create the component**

Create `mobile/components/study/FlashcardDeck.tsx`:
```typescript
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/providers/ThemeProvider';
import { FlashcardItem } from './FlashcardItem';
import { Button } from '@/components/ui';
import { RotateCcw, Check, X, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface Card {
  id: string;
  questionText: string;
  answerText: string;
  explanation?: string;
}

interface FlashcardDeckProps {
  cards: Card[];
  onCardReviewed: (cardId: string, quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
  onDeckComplete: () => void;
}

export function FlashcardDeck({
  cards,
  onCardReviewed,
  onDeckComplete,
}: FlashcardDeckProps) {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);

  const currentCard = cards[currentIndex];
  const progress = `${currentIndex + 1} / ${cards.length}`;

  const handleSwipe = useCallback(
    (direction: 'left' | 'right' | 'up') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let quality: 0 | 1 | 2 | 3 | 4 | 5;
      if (direction === 'left') {
        quality = 1; // Again
      } else if (direction === 'right') {
        quality = 4; // Good
      } else {
        quality = 5; // Easy
      }

      onCardReviewed(currentCard.id, quality);

      if (currentIndex < cards.length - 1) {
        setCurrentIndex((i) => i + 1);
        setIsFlipped(false);
      } else {
        onDeckComplete();
      }
    },
    [currentCard, currentIndex, cards.length, onCardReviewed, onDeckComplete]
  );

  const resetPosition = useCallback(() => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    rotation.value = withSpring(0);
  }, [translateX, translateY, rotation]);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      rotation.value = (event.translationX / SCREEN_WIDTH) * 15;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        // Horizontal swipe
        const direction = event.translationX > 0 ? 'right' : 'left';
        translateX.value = withTiming(
          direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH,
          { duration: 200 },
          () => {
            runOnJS(handleSwipe)(direction);
            translateX.value = 0;
            translateY.value = 0;
            rotation.value = 0;
          }
        );
      } else if (event.translationY < -SWIPE_THRESHOLD) {
        // Swipe up
        translateY.value = withTiming(-500, { duration: 200 }, () => {
          runOnJS(handleSwipe)('up');
          translateX.value = 0;
          translateY.value = 0;
          rotation.value = 0;
        });
      } else {
        runOnJS(resetPosition)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const leftIndicatorStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -50 ? Math.min(1, Math.abs(translateX.value) / 100) : 0,
  }));

  const rightIndicatorStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 50 ? Math.min(1, translateX.value / 100) : 0,
  }));

  const upIndicatorStyle = useAnimatedStyle(() => ({
    opacity: translateY.value < -50 ? Math.min(1, Math.abs(translateY.value) / 100) : 0,
  }));

  if (!currentCard) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.brand,
                width: `${((currentIndex + 1) / cards.length) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {progress}
        </Text>
      </View>

      {/* Swipe Indicators */}
      <Animated.View style={[styles.indicator, styles.leftIndicator, leftIndicatorStyle]}>
        <X size={32} color={colors.error} />
        <Text style={[styles.indicatorText, { color: colors.error }]}>Again</Text>
      </Animated.View>

      <Animated.View style={[styles.indicator, styles.rightIndicator, rightIndicatorStyle]}>
        <Check size={32} color={colors.success} />
        <Text style={[styles.indicatorText, { color: colors.success }]}>Good</Text>
      </Animated.View>

      <Animated.View style={[styles.indicator, styles.upIndicator, upIndicatorStyle]}>
        <Zap size={32} color={colors.warning} />
        <Text style={[styles.indicatorText, { color: colors.warning }]}>Easy</Text>
      </Animated.View>

      {/* Card */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.cardContainer, animatedStyle]}>
          <FlashcardItem
            questionText={currentCard.questionText}
            answerText={currentCard.answerText}
            explanation={currentCard.explanation}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
          />
        </Animated.View>
      </GestureDetector>

      {/* Manual Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          variant="outline"
          size="sm"
          icon={X}
          onPress={() => handleSwipe('left')}
        >
          Again
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={Check}
          onPress={() => handleSwipe('right')}
        >
          Good
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={Zap}
          onPress={() => handleSwipe('up')}
        >
          Easy
        </Button>
      </View>

      {/* Instructions */}
      <Text style={[styles.instructions, { color: colors.textMuted }]}>
        Swipe left (Again) • Swipe right (Good) • Swipe up (Easy)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 100,
  },
  leftIndicator: {
    left: 24,
    top: '45%',
  },
  rightIndicator: {
    right: 24,
    top: '45%',
  },
  upIndicator: {
    top: 80,
    alignSelf: 'center',
  },
  indicatorText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
  instructions: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
});
```

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/study/FlashcardDeck.tsx && git commit -m "feat(study): add FlashcardDeck with swipe gestures"
```

---

## Task 4: Create Study Session Summary Component

**Files:**
- Create: `mobile/components/study/StudySessionSummary.tsx`

**Step 1: Create the component**

Create `mobile/components/study/StudySessionSummary.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, Card } from '@/components/ui';
import { Trophy, Target, Clock, Calendar, ArrowRight, RotateCcw } from 'lucide-react-native';

interface StudySessionSummaryProps {
  cardsReviewed: number;
  correctCount: number;
  timeSpent: number; // seconds
  cardsDueTomorrow: number;
  onContinue: () => void;
  onDone: () => void;
}

export function StudySessionSummary({
  cardsReviewed,
  correctCount,
  timeSpent,
  cardsDueTomorrow,
  onContinue,
  onDone,
}: StudySessionSummaryProps) {
  const { colors, isDark } = useTheme();

  const accuracy = cardsReviewed > 0 ? Math.round((correctCount / cardsReviewed) * 100) : 0;
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;
  const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const getAccuracyColor = () => {
    if (accuracy >= 80) return colors.success;
    if (accuracy >= 60) return colors.warning;
    return colors.error;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Session Complete!
      </Text>

      <Card variant="elevated" className={`mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <View style={styles.statsGrid}>
          {/* Cards Reviewed */}
          <View style={styles.statItem}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
              <Trophy size={24} color={colors.brand} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {cardsReviewed}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Cards Reviewed
            </Text>
          </View>

          {/* Accuracy */}
          <View style={styles.statItem}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#14532D' : '#F0FDF4' }]}>
              <Target size={24} color={getAccuracyColor()} />
            </View>
            <Text style={[styles.statValue, { color: getAccuracyColor() }]}>
              {accuracy}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Accuracy
            </Text>
          </View>

          {/* Time Spent */}
          <View style={styles.statItem}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#78350F' : '#FFFBEB' }]}>
              <Clock size={24} color={colors.warning} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {timeString}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Time Spent
            </Text>
          </View>

          {/* Due Tomorrow */}
          <View style={styles.statItem}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Calendar size={24} color={colors.textSecondary} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {cardsDueTomorrow}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Due Tomorrow
            </Text>
          </View>
        </View>
      </Card>

      {/* Encouragement Message */}
      <View style={[styles.messageBox, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
        <Text style={[styles.messageText, { color: colors.textSecondary }]}>
          {accuracy >= 80
            ? "Excellent work! Your retention is looking great."
            : accuracy >= 60
            ? "Good progress! Keep practicing to improve retention."
            : "Don't give up! Consistent practice leads to mastery."}
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          variant="outline"
          icon={RotateCcw}
          onPress={onContinue}
          fullWidth
          className="mb-3"
        >
          Continue Studying
        </Button>
        <Button
          variant="primary"
          icon={ArrowRight}
          iconPosition="right"
          onPress={onDone}
          fullWidth
        >
          Done
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  messageBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  messageText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 8,
  },
});
```

**Step 2: Export from study components**

Create or update `mobile/components/study/index.ts`:
```typescript
export { FlashcardItem } from './FlashcardItem';
export { FlashcardDeck } from './FlashcardDeck';
export { StudySessionSummary } from './StudySessionSummary';
```

**Step 3: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/study/ && git commit -m "feat(study): add StudySessionSummary component and exports"
```

---

## Task 5: Create Analytics Components

**Files:**
- Create: `mobile/components/analytics/HeatmapCalendar.tsx`
- Create: `mobile/components/analytics/RetentionChart.tsx`
- Create: `mobile/components/analytics/index.ts`

**Step 1: Create HeatmapCalendar**

Create `mobile/components/analytics/HeatmapCalendar.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';

interface DayData {
  date: string;
  count: number;
}

interface HeatmapCalendarProps {
  data: DayData[];
  weeks?: number;
  onDayPress?: (date: string, count: number) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_SIZE = 12;
const CELL_GAP = 3;

export function HeatmapCalendar({
  data,
  weeks = 13,
  onDayPress,
}: HeatmapCalendarProps) {
  const { colors, isDark } = useTheme();

  const dataMap = new Map(data.map((d) => [d.date, d.count]));

  // Generate dates for the past N weeks
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - weeks * 7 + 1);
  // Align to Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= today) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Group by week
  const weekGroups: Date[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weekGroups.push(dates.slice(i, i + 7));
  }

  const getColor = (count: number): string => {
    if (count === 0) return isDark ? '#1F2937' : '#F3F4F6';
    if (count < 5) return isDark ? '#312E81' : '#C7D2FE';
    if (count < 15) return isDark ? '#4338CA' : '#818CF8';
    if (count < 30) return isDark ? '#4F46E5' : '#6366F1';
    return isDark ? '#6366F1' : '#4F46E5';
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  return (
    <View style={styles.container}>
      {/* Day labels */}
      <View style={styles.dayLabels}>
        {DAYS.map((day, i) => (
          <Text
            key={i}
            style={[
              styles.dayLabel,
              { color: colors.textMuted, height: CELL_SIZE + CELL_GAP },
            ]}
          >
            {i % 2 === 1 ? day : ''}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {weekGroups.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {week.map((date, dayIndex) => {
              const dateStr = formatDate(date);
              const count = dataMap.get(dateStr) || 0;
              return (
                <Pressable
                  key={dayIndex}
                  onPress={() => onDayPress?.(dateStr, count)}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: getColor(count),
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: colors.textMuted }]}>Less</Text>
        {[0, 5, 15, 30, 50].map((threshold) => (
          <View
            key={threshold}
            style={[
              styles.legendCell,
              { backgroundColor: getColor(threshold) },
            ]}
          />
        ))}
        <Text style={[styles.legendText, { color: colors.textMuted }]}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayLabels: {
    marginRight: 4,
    justifyContent: 'space-around',
  },
  dayLabel: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: CELL_SIZE + CELL_GAP,
  },
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  week: {
    gap: CELL_GAP,
  },
  cell: {
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    marginLeft: 'auto',
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
  },
});
```

**Step 2: Create RetentionChart**

Create `mobile/components/analytics/RetentionChart.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';

interface RetentionData {
  newCards: number;
  learning: number;
  reviewing: number;
  mastered: number;
}

interface RetentionChartProps {
  data: RetentionData;
}

export function RetentionChart({ data }: RetentionChartProps) {
  const { colors, isDark } = useTheme();

  const total = data.newCards + data.learning + data.reviewing + data.mastered;

  const segments = [
    { label: 'New', count: data.newCards, color: colors.textMuted },
    { label: 'Learning', count: data.learning, color: colors.warning },
    { label: 'Reviewing', count: data.reviewing, color: colors.brand },
    { label: 'Mastered', count: data.mastered, color: colors.success },
  ];

  const getPercentage = (count: number) => {
    if (total === 0) return 0;
    return (count / total) * 100;
  };

  return (
    <View style={styles.container}>
      {/* Bar */}
      <View style={[styles.barContainer, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
        {segments.map((segment, index) => {
          const percentage = getPercentage(segment.count);
          if (percentage === 0) return null;
          return (
            <View
              key={index}
              style={[
                styles.barSegment,
                {
                  backgroundColor: segment.color,
                  width: `${percentage}%`,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {segments.map((segment, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
              {segment.label}
            </Text>
            <Text style={[styles.legendCount, { color: colors.textPrimary }]}>
              {segment.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  barContainer: {
    height: 24,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
  },
  legendCount: {
    fontSize: 12,
    fontWeight: '600',
  },
});
```

**Step 3: Create index file**

Create `mobile/components/analytics/index.ts`:
```typescript
export { HeatmapCalendar } from './HeatmapCalendar';
export { RetentionChart } from './RetentionChart';
```

**Step 4: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add components/analytics/ && git commit -m "feat(study): add HeatmapCalendar and RetentionChart components"
```

---

## Task 6: Create Analytics Screen

**Files:**
- Create: `mobile/app/(student)/analytics/index.tsx`
- Create: `mobile/app/(student)/analytics/_layout.tsx`

**Step 1: Create layout**

Create `mobile/app/(student)/analytics/_layout.tsx`:
```typescript
import { Stack } from 'expo-router';

export default function AnalyticsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
```

**Step 2: Create analytics screen**

Create `mobile/app/(student)/analytics/index.tsx`:
```typescript
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useStudyStore } from '@/stores/studyStore';
import { Card } from '@/components/ui';
import { HeatmapCalendar, RetentionChart } from '@/components/analytics';
import { Flame, BookOpen, Target, Clock } from 'lucide-react-native';

export default function AnalyticsScreen() {
  const { colors, isDark } = useTheme();
  const { dailyStats, cardReviews, getStudyStats } = useStudyStore();

  const stats = getStudyStats();
  const reviews = Object.values(cardReviews);

  // Calculate study streak
  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  const sortedStats = [...dailyStats].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  for (const stat of sortedStats) {
    const diff = Math.floor(
      (new Date(today).getTime() - new Date(stat.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === streak && stat.cardsReviewed > 0) {
      streak++;
    } else {
      break;
    }
  }

  // Calculate total stats
  const totalCardsReviewed = dailyStats.reduce((sum, s) => sum + s.cardsReviewed, 0);
  const totalCorrect = dailyStats.reduce((sum, s) => sum + s.correctCount, 0);
  const totalTime = dailyStats.reduce((sum, s) => sum + s.totalTime, 0);
  const avgAccuracy = totalCardsReviewed > 0
    ? Math.round((totalCorrect / totalCardsReviewed) * 100)
    : 0;

  // Prepare heatmap data
  const heatmapData = dailyStats.map((s) => ({
    date: s.date,
    count: s.cardsReviewed,
  }));

  // Prepare retention data
  const retentionData = {
    newCards: reviews.filter((r) => r.repetitions === 0).length,
    learning: reviews.filter((r) => r.interval > 0 && r.interval < 7).length,
    reviewing: reviews.filter((r) => r.interval >= 7 && r.interval <= 30).length,
    mastered: reviews.filter((r) => r.interval > 30).length,
  };

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Study Analytics
        </Text>

        {/* Streak Banner */}
        <Card variant="elevated" className={`mb-4 ${cardBg}`}>
          <View style={styles.streakBanner}>
            <View style={[styles.streakIcon, { backgroundColor: '#FEF3C7' }]}>
              <Flame size={32} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.streakCount, { color: colors.textPrimary }]}>
                {streak} day streak
              </Text>
              <Text style={[styles.streakSubtext, { color: colors.textSecondary }]}>
                {streak > 0 ? 'Keep it going!' : 'Start studying today!'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <Card variant="outline" className={`flex-1 mr-2 ${cardBg}`}>
            <View style={styles.statItem}>
              <BookOpen size={20} color={colors.brand} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {totalCardsReviewed}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                Total Reviews
              </Text>
            </View>
          </Card>
          <Card variant="outline" className={`flex-1 ml-2 ${cardBg}`}>
            <View style={styles.statItem}>
              <Target size={20} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {avgAccuracy}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                Avg Accuracy
              </Text>
            </View>
          </Card>
        </View>

        {/* Heatmap */}
        <Card variant="outline" className={`mb-4 ${cardBg}`}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Activity
          </Text>
          <HeatmapCalendar
            data={heatmapData}
            weeks={13}
            onDayPress={(date, count) => {
              // Could show a modal with day details
              console.log(`${date}: ${count} cards`);
            }}
          />
        </Card>

        {/* Retention Chart */}
        <Card variant="outline" className={`mb-4 ${cardBg}`}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Card Retention
          </Text>
          <RetentionChart data={retentionData} />
        </Card>

        {/* Due Today */}
        <Card variant="outline" className={cardBg}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Upcoming Reviews
          </Text>
          <View style={styles.dueStats}>
            <View style={styles.dueItem}>
              <Text style={[styles.dueCount, { color: colors.brand }]}>
                {stats.dueToday}
              </Text>
              <Text style={[styles.dueLabel, { color: colors.textSecondary }]}>
                Due Today
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.dueItem}>
              <Text style={[styles.dueCount, { color: colors.textPrimary }]}>
                {stats.dueTomorrow}
              </Text>
              <Text style={[styles.dueLabel, { color: colors.textSecondary }]}>
                Due Tomorrow
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  streakCount: {
    fontSize: 24,
    fontWeight: '700',
  },
  streakSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  dueStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueItem: {
    flex: 1,
    alignItems: 'center',
  },
  dueCount: {
    fontSize: 32,
    fontWeight: '700',
  },
  dueLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 48,
  },
});
```

**Step 3: Add analytics to navigation**

The analytics screen will be accessible from the dashboard. Update tab navigation if needed.

**Step 4: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add app/\(student\)/analytics/ && git commit -m "feat(study): add analytics screen with heatmap and retention chart"
```

---

## Task 7: Integrate Flashcards into Quiz Detail Screen

**Files:**
- Modify: `mobile/app/(student)/study/[id].tsx`

**Step 1: Add flashcard mode to quiz detail**

This task updates the existing quiz detail screen to include a "Flashcards" practice mode option alongside the existing practice mode. The implementation should:

1. Add a "Flashcards" button next to existing practice options
2. When clicked, navigate to a flashcard study session
3. Use the FlashcardDeck component with cards from the quiz
4. Record reviews in the studyStore

The specific implementation depends on the current structure of `[id].tsx`. Read the file first, then add the flashcard mode integration.

**Step 2: Commit**

```bash
cd /Users/noam1/gemini\ hackathon/quizly/mobile && git add app/\(student\)/study/\[id\].tsx && git commit -m "feat(study): integrate flashcard mode into quiz detail screen"
```

---

## Summary

Track 1 (Study) is complete when all tasks pass. The following are now available:

- **StudyStore:** Spaced repetition with SM-2 algorithm
- **FlashcardDeck:** Swipeable flashcard component
- **FlashcardItem:** Individual card with flip animation
- **StudySessionSummary:** Post-session stats display
- **HeatmapCalendar:** GitHub-style activity visualization
- **RetentionChart:** Card mastery breakdown
- **Analytics Screen:** Full study analytics dashboard

The study track emits `CARD_REVIEWED` events for the gamification track to award XP.

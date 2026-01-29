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
        Swipe left (Again) | Swipe right (Good) | Swipe up (Easy)
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

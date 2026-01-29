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

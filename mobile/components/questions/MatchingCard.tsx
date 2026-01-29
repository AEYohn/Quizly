import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { MatchingQuestion } from '@/types/questions';
import { Button } from '@/components/ui';

interface MatchingCardProps {
  question: MatchingQuestion;
  onAnswer: (matches: Record<string, string>) => void;
  showFeedback?: boolean;
  disabled?: boolean;
}

export function MatchingCard({
  question,
  onAnswer,
  showFeedback = false,
  disabled = false,
}: MatchingCardProps) {
  const { colors, isDark } = useTheme();
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});

  // Light color variants (not in theme)
  const successLight = isDark ? '#065F46' : '#D1FAE5';
  const errorLight = isDark ? '#7F1D1D' : '#FEE2E2';
  const brandLight = isDark ? '#312E81' : '#E0E7FF';

  // Shuffle right side options
  const shuffledRight = useMemo(() => {
    const items = question.pairs.map((p) => ({ id: p.id, text: p.right }));
    return items.sort(() => Math.random() - 0.5);
  }, [question.pairs]);

  const handleLeftPress = (id: string) => {
    if (disabled || matches[id]) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLeft(selectedLeft === id ? null : id);
  };

  const handleRightPress = (rightId: string) => {
    if (disabled || !selectedLeft) return;
    if (Object.values(matches).includes(rightId)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newMatches = { ...matches, [selectedLeft]: rightId };
    setMatches(newMatches);
    setSelectedLeft(null);
    onAnswer(newMatches);
  };

  const handleReset = () => {
    setMatches({});
    setSelectedLeft(null);
    onAnswer({});
  };

  const getLeftItemStyle = (id: string) => {
    const isMatched = matches[id];
    const isSelected = selectedLeft === id;
    const isCorrect = showFeedback && matches[id] === id;
    const isIncorrect = showFeedback && matches[id] && matches[id] !== id;

    if (isCorrect) {
      return { bg: successLight, border: colors.success };
    }
    if (isIncorrect) {
      return { bg: errorLight, border: colors.error };
    }
    if (isMatched) {
      return { bg: brandLight, border: colors.brand };
    }
    if (isSelected) {
      return { bg: brandLight, border: colors.brand };
    }
    return {
      bg: isDark ? '#1F2937' : '#FFFFFF',
      border: colors.border,
    };
  };

  const getRightItemStyle = (rightId: string) => {
    const matchedBy = Object.entries(matches).find(([, v]) => v === rightId)?.[0];
    const isCorrect = showFeedback && matchedBy === rightId;
    const isIncorrect = showFeedback && matchedBy && matchedBy !== rightId;

    if (isCorrect) {
      return { bg: successLight, border: colors.success };
    }
    if (isIncorrect) {
      return { bg: errorLight, border: colors.error };
    }
    if (matchedBy) {
      return { bg: brandLight, border: colors.brand };
    }
    return {
      bg: isDark ? '#1F2937' : '#FFFFFF',
      border: colors.border,
    };
  };

  return (
    <View style={styles.container}>
      {question.instruction && (
        <Text style={[styles.instruction, { color: colors.textSecondary }]}>
          {question.instruction}
        </Text>
      )}

      <View style={styles.columns}>
        {/* Left column */}
        <View style={styles.column}>
          {question.pairs.map((pair) => {
            const style = getLeftItemStyle(pair.id);
            return (
              <Pressable
                key={pair.id}
                onPress={() => handleLeftPress(pair.id)}
                style={[
                  styles.item,
                  { backgroundColor: style.bg, borderColor: style.border },
                ]}
              >
                <Text style={[styles.itemText, { color: colors.textPrimary }]}>
                  {pair.left}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Right column */}
        <View style={styles.column}>
          {shuffledRight.map((item) => {
            const style = getRightItemStyle(item.id);
            const isUsed = Object.values(matches).includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => handleRightPress(item.id)}
                disabled={isUsed || !selectedLeft}
                style={[
                  styles.item,
                  { backgroundColor: style.bg, borderColor: style.border },
                  isUsed && !showFeedback && styles.itemUsed,
                ]}
              >
                <Text style={[styles.itemText, { color: colors.textPrimary }]}>
                  {item.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {Object.keys(matches).length > 0 && !disabled && (
        <Button
          variant="ghost"
          size="sm"
          icon={RotateCcw}
          onPress={handleReset}
          className="mt-4"
        >
          Reset
        </Button>
      )}

      {showFeedback && question.explanation && (
        <View
          style={[
            styles.explanation,
            { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
          ]}
        >
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
            {question.explanation}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  instruction: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  columns: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  item: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  itemUsed: {
    opacity: 0.5,
  },
  itemText: {
    fontSize: 14,
    textAlign: 'center',
  },
  explanation: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

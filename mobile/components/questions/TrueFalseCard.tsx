import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { TrueFalseQuestion } from '@/types/questions';

interface TrueFalseCardProps {
  question: TrueFalseQuestion;
  onAnswer: (answer: boolean) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
  selectedAnswer?: boolean | null;
}

export function TrueFalseCard({
  question,
  onAnswer,
  showFeedback = false,
  isCorrect,
  disabled = false,
  selectedAnswer,
}: TrueFalseCardProps) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState<boolean | null>(selectedAnswer ?? null);

  const handleSelect = (value: boolean) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(value);
    onAnswer(value);
  };

  const getButtonStyle = (value: boolean) => {
    const isSelected = selected === value;
    const isCorrectAnswer = question.correct_answer === value;

    // Use inline hex colors for light variants since theme doesn't have them
    const successLight = isDark ? '#065F46' : '#D1FAE5';
    const errorLight = isDark ? '#7F1D1D' : '#FEE2E2';
    const brandLight = isDark ? '#312E81' : '#E0E7FF';

    if (showFeedback) {
      if (isCorrectAnswer) {
        return {
          bg: successLight,
          border: colors.success,
          icon: colors.success,
        };
      }
      if (isSelected && !isCorrectAnswer) {
        return {
          bg: errorLight,
          border: colors.error,
          icon: colors.error,
        };
      }
    }

    if (isSelected) {
      return {
        bg: brandLight,
        border: colors.brand,
        icon: colors.brand,
      };
    }

    return {
      bg: isDark ? '#1F2937' : '#FFFFFF',
      border: colors.border,
      icon: colors.textMuted,
    };
  };

  const trueStyle = getButtonStyle(true);
  const falseStyle = getButtonStyle(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.statement, { color: colors.textPrimary }]}>
        {question.statement}
      </Text>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => handleSelect(true)}
          disabled={disabled}
          style={[
            styles.button,
            {
              backgroundColor: trueStyle.bg,
              borderColor: trueStyle.border,
            },
          ]}
        >
          <Check size={32} color={trueStyle.icon} />
          <Text style={[styles.buttonText, { color: trueStyle.icon }]}>
            TRUE
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSelect(false)}
          disabled={disabled}
          style={[
            styles.button,
            {
              backgroundColor: falseStyle.bg,
              borderColor: falseStyle.border,
            },
          ]}
        >
          <X size={32} color={falseStyle.icon} />
          <Text style={[styles.buttonText, { color: falseStyle.icon }]}>
            FALSE
          </Text>
        </Pressable>
      </View>

      {showFeedback && question.explanation && (
        <View style={[styles.explanation, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
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
  statement: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 32,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 1,
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

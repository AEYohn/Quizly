import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { FillBlankQuestion } from '@/types/questions';

interface FillBlankCardProps {
  question: FillBlankQuestion;
  onAnswer: (answers: string[]) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
}

export function FillBlankCard({
  question,
  onAnswer,
  showFeedback = false,
  disabled = false,
}: FillBlankCardProps) {
  const { colors, isDark } = useTheme();
  const [answers, setAnswers] = useState<string[]>(
    new Array(question.blanks.length).fill('')
  );
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Split text by blanks (marked as ___ or [blank])
  const parts = question.text.split(/___|\[blank\]/gi);

  const handleChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
    onAnswer(newAnswers);
  };

  const handleSubmitEditing = (index: number) => {
    if (index < question.blanks.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const isBlankCorrect = (index: number): boolean => {
    const userAnswer = answers[index];
    const correctAnswer = question.blanks[index];

    const normalize = (s: string) =>
      question.case_sensitive ? s.trim() : s.trim().toLowerCase();

    if (normalize(userAnswer) === normalize(correctAnswer)) return true;

    const alts = question.accept_alternatives?.[index] || [];
    return alts.some((alt) => normalize(userAnswer) === normalize(alt));
  };

  const renderContent = () => {
    const elements: React.ReactNode[] = [];

    parts.forEach((part, partIndex) => {
      // Add text part
      if (part) {
        elements.push(
          <Text
            key={`text-${partIndex}`}
            style={[styles.text, { color: colors.textPrimary }]}
          >
            {part}
          </Text>
        );
      }

      // Add input if not last part
      if (partIndex < parts.length - 1) {
        const blankIndex = partIndex;
        const correct = showFeedback && isBlankCorrect(blankIndex);
        const incorrect = showFeedback && !isBlankCorrect(blankIndex);

        elements.push(
          <TextInput
            key={`input-${blankIndex}`}
            ref={(ref) => { inputRefs.current[blankIndex] = ref; }}
            value={answers[blankIndex]}
            onChangeText={(value) => handleChange(blankIndex, value)}
            onSubmitEditing={() => handleSubmitEditing(blankIndex)}
            editable={!disabled}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#374151' : '#F9FAFB',
                borderColor: correct
                  ? colors.success
                  : incorrect
                  ? colors.error
                  : colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder="..."
            placeholderTextColor={colors.textMuted}
            returnKeyType={
              blankIndex < question.blanks.length - 1 ? 'next' : 'done'
            }
            autoCapitalize="none"
            autoCorrect={false}
          />
        );
      }
    });

    return elements;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderContent()}</View>

      {showFeedback && (
        <View style={styles.answerList}>
          <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>
            Correct answers:
          </Text>
          {question.blanks.map((blank, i) => (
            <Text
              key={i}
              style={[styles.correctAnswer, { color: colors.success }]}
            >
              {i + 1}. {blank}
            </Text>
          ))}
        </View>
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
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    lineHeight: 32,
  },
  input: {
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    fontSize: 16,
    marginHorizontal: 4,
    marginVertical: 4,
    textAlign: 'center',
  },
  answerList: {
    marginTop: 24,
  },
  answerLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  correctAnswer: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  explanation: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

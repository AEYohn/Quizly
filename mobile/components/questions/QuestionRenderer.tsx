import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import {
  Question,
  QuestionAnswer,
  isMultipleChoice,
  isTrueFalse,
  isFillBlank,
  isMatching,
  isOrdering,
  isCode,
} from '@/types/questions';
import { TrueFalseCard } from './TrueFalseCard';
import { FillBlankCard } from './FillBlankCard';
import { MatchingCard } from './MatchingCard';
import { OrderingCard } from './OrderingCard';
import { CodeChallengeCard } from './CodeChallengeCard';

interface QuestionRendererProps {
  question: Question;
  onAnswer: (answer: QuestionAnswer) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
}

export function QuestionRenderer({
  question,
  onAnswer,
  showFeedback = false,
  isCorrect,
  disabled = false,
}: QuestionRendererProps) {
  const { colors, isDark } = useTheme();

  if (isTrueFalse(question)) {
    return (
      <TrueFalseCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        isCorrect={isCorrect}
        disabled={disabled}
      />
    );
  }

  if (isFillBlank(question)) {
    return (
      <FillBlankCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        disabled={disabled}
      />
    );
  }

  if (isMatching(question)) {
    return (
      <MatchingCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        disabled={disabled}
      />
    );
  }

  if (isOrdering(question)) {
    return (
      <OrderingCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        disabled={disabled}
      />
    );
  }

  if (isCode(question)) {
    return (
      <CodeChallengeCard
        question={question}
        onAnswer={onAnswer}
        showFeedback={showFeedback}
        disabled={disabled}
      />
    );
  }

  if (isMultipleChoice(question)) {
    // For multiple choice, we can reuse the existing game QuestionCard
    // or create a dedicated component
    return (
      <View style={[styles.placeholder, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          Use existing QuestionCard for multiple choice
        </Text>
      </View>
    );
  }

  // Fallback for unknown types
  return (
    <View style={[styles.placeholder, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
        Unknown question type: {(question as { question_type: string }).question_type}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    padding: 24,
    borderRadius: 12,
    margin: 16,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

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

  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Session Complete!
      </Text>

      <Card variant="elevated" className={`mb-6 ${cardBg}`}>
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

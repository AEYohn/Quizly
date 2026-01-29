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

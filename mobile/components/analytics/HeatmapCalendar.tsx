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

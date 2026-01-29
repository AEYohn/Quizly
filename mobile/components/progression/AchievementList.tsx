import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useProgressionStore } from '@/stores/progressionStore';
import { AchievementBadge } from './AchievementBadge';
import { ACHIEVEMENTS } from '@/lib/achievements';

interface AchievementListProps {
  category?: string;
  showAll?: boolean;
}

export function AchievementList({ category, showAll = true }: AchievementListProps) {
  const { colors } = useTheme();
  const { achievements } = useProgressionStore();

  const filteredAchievements = category
    ? achievements.filter((a) => {
        const def = ACHIEVEMENTS.find((d) => d.id === a.id);
        return def?.category === category;
      })
    : achievements;

  const displayAchievements = showAll
    ? filteredAchievements
    : filteredAchievements.slice(0, 6);

  const unlockedCount = displayAchievements.filter((a) => a.unlockedAt).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Achievements
        </Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {unlockedCount}/{displayAchievements.length}
        </Text>
      </View>

      <View style={styles.grid}>
        {displayAchievements.map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

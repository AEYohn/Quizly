import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useProgressionStore } from '@/stores/progressionStore';

interface StreakBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StreakBadge({ size = 'md', showLabel = true }: StreakBadgeProps) {
  const { colors, isDark } = useTheme();
  const { dailyStreak } = useProgressionStore();

  const sizes = {
    sm: { container: 32, icon: 16, text: 12 },
    md: { container: 48, icon: 24, text: 16 },
    lg: { container: 64, icon: 32, text: 24 },
  };

  const s = sizes[size];
  const isActive = dailyStreak > 0;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: s.container,
            height: s.container,
            borderRadius: s.container / 2,
            backgroundColor: isActive
              ? '#FEF3C7'
              : isDark
              ? '#374151'
              : '#F3F4F6',
          },
        ]}
      >
        <Flame
          size={s.icon}
          color={isActive ? '#F59E0B' : colors.textMuted}
          fill={isActive ? '#FBBF24' : 'transparent'}
        />
      </View>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text
            style={[
              styles.count,
              { fontSize: s.text, color: isActive ? colors.textPrimary : colors.textMuted },
            ]}
          >
            {dailyStreak}
          </Text>
          {size !== 'sm' && (
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              day{dailyStreak !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  count: {
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
  },
});

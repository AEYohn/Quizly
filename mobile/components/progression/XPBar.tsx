import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useProgressionStore } from '@/stores/progressionStore';

interface XPBarProps {
  showLevel?: boolean;
  compact?: boolean;
}

export function XPBar({ showLevel = true, compact = false }: XPBarProps) {
  const { colors, isDark } = useTheme();
  const { xp, level, getXPProgress, getXPToNextLevel } = useProgressionStore();

  const progress = getXPProgress();
  const xpToNext = getXPToNextLevel();

  const animatedWidth = useSharedValue(0);

  React.useEffect(() => {
    animatedWidth.value = withSpring(progress, {
      damping: 15,
      stiffness: 100,
    });
  }, [progress, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.levelBadge, { backgroundColor: colors.brand }]}>
          <Text style={styles.levelText}>{level}</Text>
        </View>
        <View style={styles.compactBarContainer}>
          <View style={[styles.compactBar, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
            <Animated.View
              style={[styles.compactBarFill, { backgroundColor: colors.brand }, animatedStyle]}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {showLevel && (
          <View style={styles.levelContainer}>
            <View style={[styles.levelBadgeLarge, { backgroundColor: colors.brand }]}>
              <Text style={styles.levelTextLarge}>{level}</Text>
            </View>
            <Text style={[styles.levelLabel, { color: colors.textSecondary }]}>Level</Text>
          </View>
        )}
        <View style={styles.xpInfo}>
          <Text style={[styles.xpText, { color: colors.textPrimary }]}>
            {xp} XP
          </Text>
          <Text style={[styles.xpToNext, { color: colors.textMuted }]}>
            {xpToNext} XP to level {level + 1}
          </Text>
        </View>
      </View>

      <View style={[styles.barContainer, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: colors.brand }, animatedStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  levelBadgeLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTextLarge: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  levelLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  xpInfo: {
    flex: 1,
  },
  xpText: {
    fontSize: 18,
    fontWeight: '600',
  },
  xpToNext: {
    fontSize: 12,
    marginTop: 2,
  },
  barContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  levelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  compactBarContainer: {
    flex: 1,
  },
  compactBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  compactBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});

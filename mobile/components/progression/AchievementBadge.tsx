import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Lock, Award, Star, Trophy, Crown, Flame, Zap, CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Achievement, AchievementTier } from '@/types/progression';

interface AchievementBadgeProps {
  achievement: Achievement;
  onPress?: () => void;
}

const tierColors: Record<AchievementTier, { bg: string; border: string; text: string }> = {
  bronze: { bg: '#FEF3C7', border: '#D97706', text: '#92400E' },
  silver: { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' },
  gold: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  platinum: { bg: '#EDE9FE', border: '#7C3AED', text: '#5B21B6' },
};

const iconMap: Record<string, typeof Award> = {
  'play': Award,
  'book-open': Award,
  'graduation-cap': Award,
  'crown': Crown,
  'star': Star,
  'stars': Star,
  'trophy': Trophy,
  'flame': Flame,
  'plus-circle': Award,
  'layers': Award,
  'award': Award,
  'brain': Zap,
  'zap': Zap,
  'check-circle': CheckCircle,
};

export function AchievementBadge({ achievement, onPress }: AchievementBadgeProps) {
  const { colors, isDark } = useTheme();
  const isLocked = !achievement.unlockedAt;
  const tierStyle = tierColors[achievement.tier];
  const Icon = iconMap[achievement.icon] || Award;

  const progress = achievement.progress ?? 0;
  const progressPercent = (progress / achievement.requirement) * 100;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: isLocked
            ? isDark
              ? '#1F2937'
              : '#F9FAFB'
            : tierStyle.bg,
          borderColor: isLocked ? colors.border : tierStyle.border,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        {isLocked ? (
          <Lock size={24} color={colors.textMuted} />
        ) : (
          <Icon size={24} color={tierStyle.border} />
        )}
      </View>

      <Text
        style={[
          styles.title,
          { color: isLocked ? colors.textMuted : tierStyle.text },
        ]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>

      {isLocked && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.brand, width: `${progressPercent}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {progress}/{achievement.requirement}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
});

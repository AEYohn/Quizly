import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Award } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { Achievement, AchievementTier } from '@/types/progression';

interface AchievementToastProps {
  achievement: Achievement;
  onDismiss: () => void;
}

const tierColors: Record<AchievementTier, string> = {
  bronze: '#D97706',
  silver: '#6B7280',
  gold: '#F59E0B',
  platinum: '#7C3AED',
};

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  const { colors, isDark } = useTheme();

  const translateY = useSharedValue(-100);
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    translateY.value = withSpring(0, { damping: 12 });
    scale.value = withSpring(1, { damping: 10 });
    opacity.value = withSpring(1);

    // Auto dismiss after 3 seconds
    const timeout = setTimeout(() => {
      translateY.value = withSpring(-100);
      opacity.value = withSpring(0, {}, () => {
        runOnJS(onDismiss)();
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [translateY, scale, opacity, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const tierColor = tierColors[achievement.tier];

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        {
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderColor: tierColor,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${tierColor}20` }]}>
        <Award size={24} color={tierColor} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: tierColor }]}>
          Achievement Unlocked!
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {achievement.title}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {achievement.description}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { LeaderboardEntry } from '@/types/progression';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

export function LeaderboardRow({ entry }: LeaderboardRowProps) {
  const { colors, isDark } = useTheme();

  const getRankStyle = () => {
    if (entry.rank === 1) return { bg: '#FEF3C7', text: '#D97706' };
    if (entry.rank === 2) return { bg: '#F3F4F6', text: '#6B7280' };
    if (entry.rank === 3) return { bg: '#FED7AA', text: '#C2410C' };
    return { bg: isDark ? '#374151' : '#F9FAFB', text: colors.textSecondary };
  };

  const rankStyle = getRankStyle();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: entry.isCurrentUser
            ? isDark
              ? '#312E81'
              : '#EEF2FF'
            : 'transparent',
        },
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
        <Text style={[styles.rankText, { color: rankStyle.text }]}>
          {entry.rank}
        </Text>
      </View>

      <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
        <Text style={styles.avatarText}>
          {entry.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {entry.name}
          {entry.isCurrentUser && ' (You)'}
        </Text>
        <Text style={[styles.level, { color: colors.textSecondary }]}>
          Level {entry.level}
        </Text>
      </View>

      <Text style={[styles.xp, { color: colors.textPrimary }]}>
        {entry.xp.toLocaleString()} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  level: {
    fontSize: 12,
  },
  xp: {
    fontSize: 14,
    fontWeight: '600',
  },
});

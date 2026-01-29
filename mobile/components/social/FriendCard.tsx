import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MessageCircle, UserMinus, Flame } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Friend, FriendStatus } from '@/types/social';

interface FriendCardProps {
  friend: Friend;
  onPress?: () => void;
  onMessage?: () => void;
  onRemove?: () => void;
}

const statusColors: Record<FriendStatus, string> = {
  online: '#22C55E',
  studying: '#F59E0B',
  offline: '#9CA3AF',
};

export function FriendCard({ friend, onPress, onMessage, onRemove }: FriendCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
      ]}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
          <Text style={styles.avatarText}>
            {friend.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: statusColors[friend.status] },
          ]}
        />
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {friend.name}
        </Text>
        <View style={styles.stats}>
          <Text style={[styles.level, { color: colors.textSecondary }]}>
            Level {friend.level}
          </Text>
          {friend.streak > 0 && (
            <View style={styles.streak}>
              <Flame size={12} color="#F59E0B" />
              <Text style={[styles.streakText, { color: colors.textSecondary }]}>
                {friend.streak}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {onMessage && (
          <Pressable onPress={onMessage} style={styles.actionButton}>
            <MessageCircle size={20} color={colors.textMuted} />
          </Pressable>
        )}
        {onRemove && (
          <Pressable onPress={onRemove} style={styles.actionButton}>
            <UserMinus size={20} color={colors.error} />
          </Pressable>
        )}
      </View>
    </Pressable>
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
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  level: {
    fontSize: 12,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  streakText: {
    fontSize: 12,
    marginLeft: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
});

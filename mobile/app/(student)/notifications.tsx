import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  UserPlus,
  Trophy,
  Flame,
  Users,
  Share2,
  Check,
} from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, Card } from '@/components/ui';

// Mock notifications
const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    type: 'friend_request',
    title: 'New Friend Request',
    body: 'Alex Chen wants to be your friend',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    type: 'achievement_unlocked',
    title: 'Achievement Unlocked!',
    body: 'You earned "Week Warrior" for a 7-day streak',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: '3',
    type: 'quiz_shared',
    title: 'Quiz Shared',
    body: 'Sarah shared "Biology 101" with Study Group',
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: '4',
    type: 'level_up',
    title: 'Level Up!',
    body: 'Congratulations! You reached Level 10',
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

const iconMap: Record<string, typeof Trophy> = {
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  achievement_unlocked: Trophy,
  streak_reminder: Flame,
  group_invite: Users,
  quiz_shared: Share2,
  level_up: Trophy,
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';

  const formatTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View style={styles.header}>
        <Button variant="ghost" icon={ArrowLeft} onPress={() => router.back()}>
          {' '}
        </Button>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Notifications
        </Text>
        <Button variant="ghost" icon={Check} onPress={() => {}}>
          Mark all
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {MOCK_NOTIFICATIONS.map((notification) => {
          const Icon = iconMap[notification.type] || Trophy;
          return (
            <Pressable
              key={notification.id}
              style={[
                styles.notificationItem,
                {
                  backgroundColor: notification.read
                    ? isDark
                      ? '#1F2937'
                      : '#FFFFFF'
                    : isDark
                    ? '#312E81'
                    : '#EEF2FF',
                },
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
                ]}
              >
                <Icon size={20} color={colors.brand} />
              </View>
              <View style={styles.content}>
                <Text style={[styles.notificationTitle, { color: colors.textPrimary }]}>
                  {notification.title}
                </Text>
                <Text style={[styles.notificationBody, { color: colors.textSecondary }]}>
                  {notification.body}
                </Text>
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {formatTime(notification.timestamp)}
                </Text>
              </View>
              {!notification.read && (
                <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationBody: {
    fontSize: 13,
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});

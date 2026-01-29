import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, UserPlus, UsersRound, Bell } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSocialStore } from '@/stores/socialStore';
import { Card, PressableCard } from '@/components/ui';

export default function SocialHubScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { friends, pendingRequests, groups } = useSocialStore();

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  const incomingRequests = pendingRequests.filter(
    (r) => r.direction === 'incoming'
  ).length;

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Social
        </Text>

        <View style={styles.grid}>
          {/* Friends */}
          <PressableCard
            variant="outline"
            className={`${cardBg}`}
            style={styles.gridItem}
            onPress={() => router.push('/social/friends')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.brandLight }]}>
              <Users size={24} color={colors.brand} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Friends
            </Text>
            <Text style={[styles.cardCount, { color: colors.textSecondary }]}>
              {friends.length}
            </Text>
          </PressableCard>

          {/* Add Friends */}
          <PressableCard
            variant="outline"
            className={cardBg}
            style={styles.gridItem}
            onPress={() => router.push('/social/search')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.successLight }]}>
              <UserPlus size={24} color={colors.success} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Add Friends
            </Text>
            {incomingRequests > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <Text style={styles.badgeText}>{incomingRequests}</Text>
              </View>
            )}
          </PressableCard>

          {/* Groups */}
          <PressableCard
            variant="outline"
            className={cardBg}
            style={styles.gridItem}
            onPress={() => router.push('/social/groups')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.warningLight }]}>
              <UsersRound size={24} color={colors.warning} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Groups
            </Text>
            <Text style={[styles.cardCount, { color: colors.textSecondary }]}>
              {groups.length}
            </Text>
          </PressableCard>

          {/* Notifications */}
          <PressableCard
            variant="outline"
            className={cardBg}
            style={styles.gridItem}
            onPress={() => router.push('/notifications')}
          >
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
              <Bell size={24} color={colors.textMuted} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Notifications
            </Text>
          </PressableCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardCount: {
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

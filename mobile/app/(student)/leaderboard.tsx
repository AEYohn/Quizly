import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui';
import { LeaderboardRow } from '@/components/progression/LeaderboardRow';
import { Trophy } from 'lucide-react-native';
import { LeaderboardEntry } from '@/types/progression';

// Mock data - in real app, fetch from API
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: '1', name: 'Alex Chen', level: 15, xp: 4250, isCurrentUser: false },
  { rank: 2, userId: '2', name: 'Sarah Kim', level: 14, xp: 3980, isCurrentUser: false },
  { rank: 3, userId: '3', name: 'Mike Johnson', level: 12, xp: 3420, isCurrentUser: false },
  { rank: 4, userId: '4', name: 'You', level: 10, xp: 2850, isCurrentUser: true },
  { rank: 5, userId: '5', name: 'Emma Davis', level: 9, xp: 2540, isCurrentUser: false },
  { rank: 6, userId: '6', name: 'James Wilson', level: 8, xp: 2180, isCurrentUser: false },
  { rank: 7, userId: '7', name: 'Lisa Brown', level: 7, xp: 1920, isCurrentUser: false },
  { rank: 8, userId: '8', name: 'David Lee', level: 6, xp: 1650, isCurrentUser: false },
];

type Tab = 'weekly' | 'allTime' | 'friends';

export default function LeaderboardScreen() {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('weekly');

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'allTime', label: 'All Time' },
    { key: 'friends', label: 'Friends' },
  ];

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View style={styles.header}>
          <Trophy size={28} color={colors.warning} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Leaderboard
          </Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key && {
                  backgroundColor: isDark ? '#374151' : '#FFFFFF',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === tab.key ? colors.textPrimary : colors.textMuted,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Top 3 Podium */}
        <Card variant="elevated" className={`mb-4 ${cardBg}`}>
          <View style={styles.podium}>
            {/* Reorder to show: Silver (2nd), Gold (1st), Bronze (3rd) */}
            {[MOCK_LEADERBOARD[1], MOCK_LEADERBOARD[0], MOCK_LEADERBOARD[2]].map((entry, displayIndex) => {
              // displayIndex: 0=Silver, 1=Gold, 2=Bronze
              const heights = [80, 100, 60]; // Silver, Gold, Bronze heights
              const barColors = ['#E5E7EB', '#FCD34D', '#FDBA74']; // Silver, Gold, Bronze colors

              return (
                <View
                  key={entry.userId}
                  style={styles.podiumItem}
                >
                  <View
                    style={[
                      styles.podiumAvatar,
                      { backgroundColor: colors.brand },
                    ]}
                  >
                    <Text style={styles.podiumAvatarText}>
                      {entry.name.charAt(0)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.podiumName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {entry.name.split(' ')[0]}
                  </Text>
                  <Text style={[styles.podiumXP, { color: colors.textSecondary }]}>
                    {entry.xp.toLocaleString()}
                  </Text>
                  <View
                    style={[
                      styles.podiumBar,
                      {
                        height: heights[displayIndex],
                        backgroundColor: barColors[displayIndex],
                      },
                    ]}
                  >
                    <Text style={styles.podiumRank}>{entry.rank}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Full List */}
        <Card variant="outline" className={cardBg}>
          {MOCK_LEADERBOARD.map((entry) => (
            <LeaderboardRow key={entry.userId} entry={entry} />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginLeft: 12,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: 16,
  },
  podiumItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  podiumAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  podiumXP: {
    fontSize: 11,
    marginBottom: 8,
  },
  podiumBar: {
    width: 60,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});

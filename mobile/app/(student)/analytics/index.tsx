import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useStudyStore } from '@/stores/studyStore';
import { Card } from '@/components/ui';
import { HeatmapCalendar, RetentionChart } from '@/components/analytics';
import { Flame, BookOpen, Target, Clock } from 'lucide-react-native';

export default function AnalyticsScreen() {
  const { colors, isDark } = useTheme();
  const { dailyStats, cardReviews, getStudyStats } = useStudyStore();

  const stats = getStudyStats();
  const reviews = Object.values(cardReviews);

  // Calculate study streak
  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  const sortedStats = [...dailyStats].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  for (const stat of sortedStats) {
    const diff = Math.floor(
      (new Date(today).getTime() - new Date(stat.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === streak && stat.cardsReviewed > 0) {
      streak++;
    } else {
      break;
    }
  }

  // Calculate total stats
  const totalCardsReviewed = dailyStats.reduce((sum, s) => sum + s.cardsReviewed, 0);
  const totalCorrect = dailyStats.reduce((sum, s) => sum + s.correctCount, 0);
  const totalTime = dailyStats.reduce((sum, s) => sum + s.totalTime, 0);
  const avgAccuracy = totalCardsReviewed > 0
    ? Math.round((totalCorrect / totalCardsReviewed) * 100)
    : 0;

  // Prepare heatmap data
  const heatmapData = dailyStats.map((s) => ({
    date: s.date,
    count: s.cardsReviewed,
  }));

  // Prepare retention data
  const retentionData = {
    newCards: reviews.filter((r) => r.repetitions === 0).length,
    learning: reviews.filter((r) => r.interval > 0 && r.interval < 7).length,
    reviewing: reviews.filter((r) => r.interval >= 7 && r.interval <= 30).length,
    mastered: reviews.filter((r) => r.interval > 30).length,
  };

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Study Analytics
        </Text>

        {/* Streak Banner */}
        <Card variant="elevated" className={`mb-4 ${cardBg}`}>
          <View style={styles.streakBanner}>
            <View style={[styles.streakIcon, { backgroundColor: '#FEF3C7' }]}>
              <Flame size={32} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.streakCount, { color: colors.textPrimary }]}>
                {streak} day streak
              </Text>
              <Text style={[styles.streakSubtext, { color: colors.textSecondary }]}>
                {streak > 0 ? 'Keep it going!' : 'Start studying today!'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <Card variant="outline" className={`flex-1 mr-2 ${cardBg}`}>
            <View style={styles.statItem}>
              <BookOpen size={20} color={colors.brand} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {totalCardsReviewed}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                Total Reviews
              </Text>
            </View>
          </Card>
          <Card variant="outline" className={`flex-1 ml-2 ${cardBg}`}>
            <View style={styles.statItem}>
              <Target size={20} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {avgAccuracy}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                Avg Accuracy
              </Text>
            </View>
          </Card>
        </View>

        {/* Heatmap */}
        <Card variant="outline" className={`mb-4 ${cardBg}`}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Activity
          </Text>
          <HeatmapCalendar
            data={heatmapData}
            weeks={13}
            onDayPress={(date, count) => {
              // Could show a modal with day details
              console.log(`${date}: ${count} cards`);
            }}
          />
        </Card>

        {/* Retention Chart */}
        <Card variant="outline" className={`mb-4 ${cardBg}`}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Card Retention
          </Text>
          <RetentionChart data={retentionData} />
        </Card>

        {/* Due Today */}
        <Card variant="outline" className={cardBg}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Upcoming Reviews
          </Text>
          <View style={styles.dueStats}>
            <View style={styles.dueItem}>
              <Text style={[styles.dueCount, { color: colors.brand }]}>
                {stats.dueToday}
              </Text>
              <Text style={[styles.dueLabel, { color: colors.textSecondary }]}>
                Due Today
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.dueItem}>
              <Text style={[styles.dueCount, { color: colors.textPrimary }]}>
                {stats.dueTomorrow}
              </Text>
              <Text style={[styles.dueLabel, { color: colors.textSecondary }]}>
                Due Tomorrow
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  streakCount: {
    fontSize: 24,
    fontWeight: '700',
  },
  streakSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  dueStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueItem: {
    flex: 1,
    alignItems: 'center',
  },
  dueCount: {
    fontSize: 32,
    fontWeight: '700',
  },
  dueLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 48,
  },
});

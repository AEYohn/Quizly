import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import { useGameStore, useUserStore } from "@/stores";
import { Card, PressableCard, Button, EmptyState } from "@/components/ui";
import {
  Gamepad2,
  Plus,
  BookOpen,
  TrendingUp,
  Trophy,
  Clock,
  ChevronRight,
} from "lucide-react-native";
import { useState, useCallback } from "react";

export default function DashboardScreen() {
  const router = useRouter();
  const { nickname, isGuest, isSignedIn, guestData } = useAuth();
  const { recentGames } = useGameStore();
  const { stats, lastNickname } = useUserStore();
  const [refreshing, setRefreshing] = useState(false);

  const displayName = nickname || lastNickname || guestData?.nickname || "Student";
  const gamesPlayed = stats.totalGamesPlayed || guestData?.gamesPlayed?.length || 0;
  const totalScore = stats.totalScore || guestData?.totalScore || 0;
  const accuracy =
    stats.totalQuestionsAnswered > 0
      ? Math.round(
          (stats.totalCorrectAnswers / stats.totalQuestionsAnswered) * 100
        )
      : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh data here when connected to API
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">
            Hey, {displayName}! 👋
          </Text>
          <Text className="text-gray-500 mt-1">
            {isGuest ? "Playing as guest" : "Ready to learn?"}
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-4 mb-6">
          <PressableCard
            className="flex-1"
            variant="elevated"
            onPress={() => router.push("/(student)/join")}
          >
            <View className="items-center py-2">
              <View className="w-14 h-14 bg-primary-100 rounded-2xl items-center justify-center mb-3">
                <Gamepad2 size={28} color="#6366F1" />
              </View>
              <Text className="text-base font-semibold text-gray-900">
                Join Game
              </Text>
              <Text className="text-sm text-gray-500 text-center mt-1">
                Enter a code
              </Text>
            </View>
          </PressableCard>

          <PressableCard
            className="flex-1"
            variant="elevated"
            onPress={() => router.push("/(student)/create")}
          >
            <View className="items-center py-2">
              <View className="w-14 h-14 bg-green-100 rounded-2xl items-center justify-center mb-3">
                <Plus size={28} color="#22C55E" />
              </View>
              <Text className="text-base font-semibold text-gray-900">
                Create Quiz
              </Text>
              <Text className="text-sm text-gray-500 text-center mt-1">
                AI-powered
              </Text>
            </View>
          </PressableCard>
        </View>

        {/* Stats */}
        <Card variant="outline" className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Your Progress
          </Text>
          <View className="flex-row">
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center mb-2">
                <Trophy size={20} color="#3B82F6" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                {totalScore}
              </Text>
              <Text className="text-xs text-gray-500">Total Points</Text>
            </View>
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-purple-100 rounded-xl items-center justify-center mb-2">
                <Gamepad2 size={20} color="#8B5CF6" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                {gamesPlayed}
              </Text>
              <Text className="text-xs text-gray-500">Games Played</Text>
            </View>
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-green-100 rounded-xl items-center justify-center mb-2">
                <TrendingUp size={20} color="#22C55E" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                {accuracy}%
              </Text>
              <Text className="text-xs text-gray-500">Accuracy</Text>
            </View>
          </View>
        </Card>

        {/* Recent Games */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Recent Games
          </Text>

          {recentGames.length > 0 ? (
            <View className="gap-2">
              {recentGames.slice(0, 3).map((game) => (
                <Card key={game.id} variant="outline">
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-primary-100 rounded-xl items-center justify-center mr-3">
                      <Gamepad2 size={24} color="#6366F1" />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="font-semibold text-gray-900"
                        numberOfLines={1}
                      >
                        {game.quizTitle}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Trophy size={12} color="#F59E0B" />
                        <Text className="text-sm text-gray-500 ml-1">
                          {game.score} points
                        </Text>
                        <Text className="text-gray-300 mx-2">•</Text>
                        <Clock size={12} color="#9CA3AF" />
                        <Text className="text-sm text-gray-400 ml-1">
                          {formatDate(game.playedAt)}
                        </Text>
                      </View>
                    </View>
                    <View className="bg-primary-50 px-2 py-1 rounded-md">
                      <Text className="text-primary-700 font-medium text-sm">
                        {game.correctAnswers}/{game.totalQuestions}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}

              {recentGames.length > 3 && (
                <Pressable className="py-2 items-center">
                  <Text className="text-primary-600 font-medium">
                    View all games
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Card variant="outline">
              <EmptyState
                icon={Gamepad2}
                title="No games yet"
                description="Join a live game to see your history here"
                actionLabel="Join Game"
                onAction={() => router.push("/(student)/join")}
              />
            </Card>
          )}
        </View>

        {/* Study Materials */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              My Study Quizzes
            </Text>
            <Pressable
              onPress={() => router.push("/(student)/study")}
              className="flex-row items-center"
            >
              <Text className="text-primary-600 font-medium">See all</Text>
              <ChevronRight size={16} color="#6366F1" />
            </Pressable>
          </View>

          <Card variant="outline">
            <EmptyState
              icon={BookOpen}
              title="No quizzes yet"
              description="Create your first study quiz with AI"
              actionLabel="Create Quiz"
              onAction={() => router.push("/(student)/create")}
            />
          </Card>
        </View>

        {/* Guest Banner */}
        {isGuest && (
          <Card className="bg-primary-50 border border-primary-200">
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="text-primary-900 font-semibold mb-1">
                  Save your progress
                </Text>
                <Text className="text-primary-700 text-sm">
                  Create an account to keep your quizzes and scores
                </Text>
              </View>
              <Button
                size="sm"
                onPress={() => router.push("/(auth)/sign-up")}
              >
                Sign Up
              </Button>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

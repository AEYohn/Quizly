import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { StudyPacket } from "@/components/study";
import { useAuth } from "@/providers/AuthProvider";
import { useGameStore, useUserStore } from "@/stores";
import { Trophy, Home, RotateCcw, Target, Zap, BookOpen } from "lucide-react-native";

export default function GameSummaryScreen() {
  const {
    id,
    playerId,
    nickname,
    score,
    correct,
    total,
    quizTitle,
    gameCode,
    streak,
  } = useLocalSearchParams<{
    id: string;
    playerId: string;
    nickname: string;
    score: string;
    correct?: string;
    total?: string;
    quizTitle?: string;
    gameCode?: string;
    streak?: string;
  }>();
  const router = useRouter();
  const { isGuest } = useAuth();
  const { addRecentGame } = useGameStore();
  const { incrementStat, updateStats, setLastNickname } = useUserStore();

  const numericScore = parseInt(score || "0", 10);
  const correctAnswers = parseInt(correct || "0", 10);
  const totalQuestions = parseInt(total || "0", 10);
  const longestStreak = parseInt(streak || "0", 10);
  const accuracy =
    totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  // Save game data on mount
  useEffect(() => {
    // Save to recent games
    addRecentGame({
      id,
      gameCode: gameCode || "",
      quizTitle: quizTitle || "Quiz Game",
      score: numericScore,
      correctAnswers,
      totalQuestions,
      nickname: nickname || "Player",
    });

    // Update user stats
    incrementStat("totalGamesPlayed");
    incrementStat("totalScore", numericScore);
    incrementStat("totalCorrectAnswers", correctAnswers);
    incrementStat("totalQuestionsAnswered", totalQuestions);

    // Update longest streak if this is a new record
    useUserStore.getState().stats.longestStreak < longestStreak &&
      updateStats({ longestStreak });

    // Save nickname for next time
    if (nickname) {
      setLastNickname(nickname);
    }
  }, []);

  const getEmoji = () => {
    if (accuracy >= 90) return "🏆";
    if (accuracy >= 70) return "🎉";
    if (accuracy >= 50) return "👏";
    return "💪";
  };

  const getMessage = () => {
    if (accuracy >= 90) return "Outstanding!";
    if (accuracy >= 70) return "Great job!";
    if (accuracy >= 50) return "Well done!";
    return "Keep practicing!";
  };

  const [showStudyPacket, setShowStudyPacket] = useState(false);
  const missedCount = totalQuestions - correctAnswers;

  // Demo missed questions for the study packet
  // In a real app, these would come from the game session data
  const demoMissedQuestions = missedCount > 0 ? [
    {
      question: "Sample question that was missed",
      yourAnswer: "A",
      correctAnswer: "B",
      explanation: "This is the explanation for why B is correct.",
    },
  ] : [];

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 py-8 items-center"
      >
        {/* Trophy Animation Area */}
        <View className="items-center mb-8">
          <Text className="text-8xl mb-4">{getEmoji()}</Text>
          <Text className="text-white text-3xl font-bold mb-2">
            Game Complete!
          </Text>
          <Text className="text-white/80 text-lg">{getMessage()}</Text>
        </View>

        {/* Score Card */}
        <Card
          variant="elevated"
          className="w-full max-w-sm items-center py-6 mb-6"
        >
          <View className="w-16 h-16 bg-yellow-100 rounded-full items-center justify-center mb-4">
            <Trophy size={32} color="#F59E0B" />
          </View>
          <Text className="text-5xl font-bold text-gray-900 mb-1">
            {numericScore}
          </Text>
          <Text className="text-gray-500 text-lg mb-4">Total Points</Text>

          {/* Stats Row */}
          <View className="flex-row border-t border-gray-100 pt-4 w-full">
            <View className="flex-1 items-center">
              <View className="flex-row items-center mb-1">
                <Target size={16} color="#22C55E" />
                <Text className="text-2xl font-bold text-gray-900 ml-1">
                  {accuracy}%
                </Text>
              </View>
              <Text className="text-xs text-gray-500">Accuracy</Text>
            </View>
            <View className="flex-1 items-center border-x border-gray-100">
              <Text className="text-2xl font-bold text-gray-900 mb-1">
                {correctAnswers}/{totalQuestions}
              </Text>
              <Text className="text-xs text-gray-500">Correct</Text>
            </View>
            {longestStreak > 0 && (
              <View className="flex-1 items-center">
                <View className="flex-row items-center mb-1">
                  <Zap size={16} color="#F59E0B" />
                  <Text className="text-2xl font-bold text-gray-900 ml-1">
                    {longestStreak}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">Best Streak</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Player Info */}
        <Card variant="elevated" className="w-full max-w-sm mb-6">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center mr-3">
              <Text className="text-2xl">🎓</Text>
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-semibold text-lg">
                {nickname}
              </Text>
              {quizTitle && (
                <Text className="text-gray-500 text-sm" numberOfLines={1}>
                  {quizTitle}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Review Mistakes Button */}
        {missedCount > 0 && (
          <Button
            variant="outline"
            size="lg"
            fullWidth
            icon={BookOpen}
            onPress={() => setShowStudyPacket(true)}
            className="w-full max-w-sm mb-6 bg-white"
          >
            Review {missedCount} Missed Question{missedCount > 1 ? "s" : ""}
          </Button>
        )}

        {/* Guest Prompt */}
        {isGuest && (
          <Card className="w-full max-w-sm bg-white/10 border border-white/20 mb-6">
            <Text className="text-white font-semibold mb-2">
              Save your progress!
            </Text>
            <Text className="text-white/70 mb-4">
              Create an account to keep your scores and track your learning
              journey.
            </Text>
            <Button
              variant="secondary"
              fullWidth
              onPress={() => router.push("/(auth)/sign-up")}
            >
              Create Account
            </Button>
          </Card>
        )}

        {/* Actions */}
        <View className="w-full max-w-sm gap-3">
          <Button
            size="lg"
            fullWidth
            icon={RotateCcw}
            onPress={() => router.push(isGuest ? "/(auth)/join" : "/(student)/join")}
          >
            Join Another Game
          </Button>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            icon={Home}
            onPress={() => router.replace(isGuest ? "/(auth)" : "/(student)")}
            className="bg-white"
          >
            {isGuest ? "Back to Welcome" : "Back to Home"}
          </Button>
        </View>

        {/* Study Suggestion - Only for signed in users */}
        {!isGuest && (
          <Card variant="outline" className="w-full max-w-sm mt-8 bg-white">
            <View className="flex-row items-start">
              <Text className="text-2xl mr-3">📚</Text>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900 mb-1">
                  Want to practice more?
                </Text>
                <Text className="text-gray-500 text-sm mb-3">
                  Create your own study quiz on this topic with AI
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => router.push("/(student)/create")}
                >
                  Create Quiz
                </Button>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Study Packet Modal */}
      <StudyPacket
        visible={showStudyPacket}
        onClose={() => setShowStudyPacket(false)}
        quizTitle={quizTitle || "Quiz Game"}
        missedQuestions={demoMissedQuestions}
      />
    </SafeAreaView>
  );
}

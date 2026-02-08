import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trophy, Zap, Flame, Target } from "lucide-react-native";
import { useLeaderboard } from "@/hooks/feed/useLeaderboard";

export default function LeaderboardScreen() {
  const {
    period,
    setPeriod,
    entries,
    currentUserRank,
    totalPlayers,
    isLoading,
    currentUserEntry,
  } = useLeaderboard();

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center gap-3">
          <Trophy size={28} color="#EAB308" />
          <Text className="text-2xl font-bold text-gray-900">
            Leaderboard
          </Text>
        </View>

        {/* Period toggle */}
        <View className="mx-5 mt-2 flex-row bg-gray-100 rounded-xl p-1">
          <Pressable
            onPress={() => setPeriod("weekly")}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              period === "weekly" ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                period === "weekly" ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Weekly
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPeriod("alltime")}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              period === "alltime" ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                period === "alltime" ? "text-gray-900" : "text-gray-500"
              }`}
            >
              All Time
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View className="py-16 items-center">
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : entries.length === 0 ? (
          <View className="py-16 items-center px-6">
            <Trophy size={48} color="#D1D5DB" />
            <Text className="text-base text-gray-500 mt-3 text-center">
              No rankings yet. Start learning to appear on the leaderboard!
            </Text>
          </View>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length >= 3 && (
              <View className="flex-row justify-center items-end mt-6 mb-4 px-5">
                {/* 2nd place */}
                <View className="items-center flex-1">
                  <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mb-2">
                    <Text className="text-lg font-bold text-gray-600">
                      {top3[1].student_name.charAt(0)}
                    </Text>
                  </View>
                  <Text
                    className="text-xs font-medium text-gray-700 mb-1"
                    numberOfLines={1}
                  >
                    {top3[1].student_name.split(" ")[0]}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {top3[1].total_xp} XP
                  </Text>
                  <View className="w-16 h-20 bg-gray-200 rounded-t-lg mt-2 items-center justify-center">
                    <Text className="text-xl font-bold text-gray-500">2</Text>
                  </View>
                </View>

                {/* 1st place */}
                <View className="items-center flex-1">
                  <View className="w-14 h-14 rounded-full bg-amber-200 items-center justify-center mb-2">
                    <Text className="text-xl font-bold text-amber-700">
                      {top3[0].student_name.charAt(0)}
                    </Text>
                  </View>
                  <Text
                    className="text-xs font-semibold text-gray-900 mb-1"
                    numberOfLines={1}
                  >
                    {top3[0].student_name.split(" ")[0]}
                  </Text>
                  <Text className="text-xs text-indigo-600 font-medium">
                    {top3[0].total_xp} XP
                  </Text>
                  <View className="w-16 h-28 bg-amber-200 rounded-t-lg mt-2 items-center justify-center">
                    <Text className="text-2xl font-bold text-amber-700">1</Text>
                  </View>
                </View>

                {/* 3rd place */}
                <View className="items-center flex-1">
                  <View className="w-12 h-12 rounded-full bg-orange-100 items-center justify-center mb-2">
                    <Text className="text-lg font-bold text-orange-600">
                      {top3[2].student_name.charAt(0)}
                    </Text>
                  </View>
                  <Text
                    className="text-xs font-medium text-gray-700 mb-1"
                    numberOfLines={1}
                  >
                    {top3[2].student_name.split(" ")[0]}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {top3[2].total_xp} XP
                  </Text>
                  <View className="w-16 h-14 bg-orange-100 rounded-t-lg mt-2 items-center justify-center">
                    <Text className="text-xl font-bold text-orange-500">3</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Full list */}
            <View className="px-5 mt-2">
              {rest.map((entry) => (
                <View
                  key={entry.rank}
                  className={`flex-row items-center py-3 border-b border-gray-100 ${
                    entry.is_current_user ? "bg-indigo-50 -mx-3 px-3 rounded-lg" : ""
                  }`}
                >
                  <Text className="w-8 text-sm font-semibold text-gray-500 text-center">
                    {entry.rank}
                  </Text>
                  <View className="w-9 h-9 rounded-full bg-indigo-100 items-center justify-center mx-2">
                    <Text className="text-sm font-semibold text-indigo-600">
                      {entry.student_name.charAt(0)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-sm font-medium ${
                        entry.is_current_user
                          ? "text-indigo-700"
                          : "text-gray-900"
                      }`}
                    >
                      {entry.student_name}
                      {entry.is_current_user ? " (You)" : ""}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Lvl {entry.level} · {entry.accuracy}% accuracy
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Zap size={14} color="#6366F1" />
                    <Text className="text-sm font-semibold text-indigo-600">
                      {entry.total_xp}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Current user card at bottom */}
            {currentUserEntry && currentUserRank && currentUserRank > 3 && (
              <View className="mx-5 mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex-row items-center">
                <Text className="text-sm font-semibold text-gray-500 w-8 text-center">
                  #{currentUserRank}
                </Text>
                <View className="flex-1 ml-2">
                  <Text className="text-sm font-semibold text-indigo-700">
                    Your Ranking
                  </Text>
                  <Text className="text-xs text-gray-500">
                    out of {totalPlayers} learners
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Zap size={16} color="#6366F1" />
                  <Text className="text-base font-bold text-indigo-600">
                    {currentUserEntry.total_xp}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  User,
  LogOut,
  Zap,
  Target,
  BookOpen,
  BarChart3,
  Settings,
  ChevronRight,
} from "lucide-react-native";
import { useProfile } from "@/hooks/feed/useProfile";

export default function ProfileScreen() {
  const router = useRouter();
  const {
    studentName,
    initial,
    progress,
    isLoading,
    totalXp,
    totalSessions,
    accuracy,
    level,
    signOut,
  } = useProfile();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name */}
        <View className="items-center pt-6 pb-4">
          <View className="w-20 h-20 rounded-full bg-indigo-100 items-center justify-center mb-3">
            <Text className="text-3xl font-bold text-indigo-600">
              {initial}
            </Text>
          </View>
          <Text className="text-xl font-bold text-gray-900">
            {studentName}
          </Text>
          <View className="flex-row items-center gap-1 mt-1">
            <View className="bg-indigo-100 px-2.5 py-0.5 rounded-full">
              <Text className="text-xs font-semibold text-indigo-600">
                Level {level}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        {isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <>
            <View className="flex-row px-5 gap-3 mt-2">
              <View className="flex-1 bg-indigo-50 rounded-xl p-4 items-center">
                <Zap size={20} color="#6366F1" />
                <Text className="text-xl font-bold text-gray-900 mt-1">
                  {totalXp}
                </Text>
                <Text className="text-xs text-gray-500">Total XP</Text>
              </View>
              <View className="flex-1 bg-emerald-50 rounded-xl p-4 items-center">
                <Target size={20} color="#10B981" />
                <Text className="text-xl font-bold text-gray-900 mt-1">
                  {accuracy}%
                </Text>
                <Text className="text-xs text-gray-500">Accuracy</Text>
              </View>
              <View className="flex-1 bg-amber-50 rounded-xl p-4 items-center">
                <BookOpen size={20} color="#D97706" />
                <Text className="text-xl font-bold text-gray-900 mt-1">
                  {totalSessions}
                </Text>
                <Text className="text-xs text-gray-500">Sessions</Text>
              </View>
            </View>

            {/* Mastery breakdown */}
            {progress && progress.summary && (
              <View className="px-5 mt-6">
                <Text className="text-base font-semibold text-gray-900 mb-3">
                  Mastery Breakdown
                </Text>
                <View className="gap-2">
                  <View className="flex-row items-center justify-between bg-emerald-50 rounded-xl p-3">
                    <Text className="text-sm text-emerald-700">Mastered</Text>
                    <Text className="text-sm font-semibold text-emerald-700">
                      {progress.summary.mastered}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between bg-yellow-50 rounded-xl p-3">
                    <Text className="text-sm text-yellow-700">In Progress</Text>
                    <Text className="text-sm font-semibold text-yellow-700">
                      {progress.summary.in_progress}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between bg-red-50 rounded-xl p-3">
                    <Text className="text-sm text-red-700">Needs Work</Text>
                    <Text className="text-sm font-semibold text-red-700">
                      {progress.summary.needs_work}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Recent sessions */}
            {progress &&
              progress.recent_sessions &&
              progress.recent_sessions.length > 0 && (
                <View className="px-5 mt-6">
                  <Text className="text-base font-semibold text-gray-900 mb-3">
                    Recent Sessions
                  </Text>
                  <View className="gap-2">
                    {progress.recent_sessions.slice(0, 5).map((session) => (
                      <View
                        key={session.id}
                        className="bg-gray-50 rounded-xl p-3 flex-row items-center justify-between"
                      >
                        <View className="flex-1">
                          <Text
                            className="text-sm font-medium text-gray-900"
                            numberOfLines={1}
                          >
                            {session.topic}
                          </Text>
                          <Text className="text-xs text-gray-500 mt-0.5">
                            {session.questions_answered} questions ·{" "}
                            {session.accuracy}% accuracy
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <Zap size={12} color="#6366F1" />
                          <Text className="text-xs font-semibold text-indigo-600">
                            {session.questions_correct * 10} XP
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
          </>
        )}

        {/* Settings + Logout */}
        <View className="px-5 mt-8">
          <Pressable
            onPress={() => router.push("/(student)/settings")}
            className="flex-row items-center py-3 border-b border-gray-100"
          >
            <Settings size={20} color="#6B7280" />
            <Text className="text-base text-gray-700 ml-3 flex-1">
              Settings
            </Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>

          <Pressable
            onPress={handleLogout}
            className="flex-row items-center py-3"
          >
            <LogOut size={20} color="#EF4444" />
            <Text className="text-base text-red-600 ml-3">Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

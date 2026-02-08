import { View, Text, Pressable, ScrollView, RefreshControl, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Search,
  Play,
  BookOpen,
  ChevronRight,
  Zap,
  Trophy,
  FileUp,
  Sparkles,
} from "lucide-react-native";
import { useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useHomeScreen } from "@/hooks/feed/useHomeScreen";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { StreakBadge } from "@/components/progression";

export default function HomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const store = useScrollSessionStore();
  const {
    loadingMessage,
    timeAgo,
    handleQuickStart,
    handleSubjectSelect,
    handleDeleteSubject,
    answerStartTime,
  } = useHomeScreen();

  const [quickInput, setQuickInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, run] = useAsyncAction();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    store.setHistoryLoading(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [store]);

  const handleQuickStartSubmit = () =>
    run(async () => {
      const topic = quickInput.trim();
      if (!topic) return;
      await handleSubjectSelect(topic);
      router.push("/(student)/skill-tree");
    });

  const handleSubjectTap = (subject: string) =>
    run(async () => {
      await handleSubjectSelect(subject);
      router.push("/(student)/skill-tree");
    });

  const handleResumeTap = () =>
    run(async () => {
      if (!store.activeSession) return;
      await handleQuickStart(store.activeSession.topic);
      if (store.sessionId) {
        router.push("/(student)/feed");
      }
    });

  // Loading overlay when feed is starting
  if (store.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <View className="items-center gap-4">
          <View className="w-12 h-12 rounded-full bg-indigo-100 items-center justify-center">
            <Sparkles size={24} color="#6366F1" />
          </View>
          <Text className="text-base text-gray-600">{loadingMessage}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Hey, {auth.nickname || "Student"}
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              Ready to learn something new?
            </Text>
          </View>
          <StreakBadge size="md" />
        </View>

        {/* Resume banner */}
        {store.activeSession && (
          <Pressable
            onPress={handleResumeTap}
            disabled={busy}
            className={`mx-5 mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex-row items-center active:bg-indigo-100 ${busy ? "opacity-50" : ""}`}
          >
            <View className="flex-1">
              <Text className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-0.5">
                Continue Learning
              </Text>
              <Text className="text-base font-semibold text-gray-900">
                {store.activeSession.topic}
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                {store.activeSession.questions_answered} questions ·{" "}
                {store.activeSession.total_xp} XP
              </Text>
            </View>
            <View className="bg-indigo-600 rounded-full p-2.5">
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
              )}
            </View>
          </Pressable>
        )}

        {/* Quick start */}
        <View className="px-5 mt-5">
          <Text className="text-base font-semibold text-gray-900 mb-2">
            Start Learning
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3">
              <Search size={18} color="#9CA3AF" />
              <TextInput
                value={quickInput}
                onChangeText={setQuickInput}
                placeholder="Enter any topic..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 py-3 px-2 text-sm text-gray-900"
                onSubmitEditing={handleQuickStartSubmit}
                returnKeyType="go"
              />
            </View>
            <Pressable
              onPress={handleQuickStartSubmit}
              disabled={!quickInput.trim() || busy}
              className={`rounded-xl px-4 items-center justify-center ${
                quickInput.trim() && !busy ? "bg-indigo-600 active:bg-indigo-700" : "bg-gray-200"
              }`}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  className={`font-semibold text-sm ${
                    quickInput.trim() ? "text-white" : "text-gray-400"
                  }`}
                >
                  Go
                </Text>
              )}
            </Pressable>
          </View>

          {/* PDF upload CTA */}
          <Pressable
            onPress={() => router.push("/(student)/pdf-upload")}
            className="flex-row items-center gap-2 mt-3 py-2"
          >
            <FileUp size={14} color="#6366F1" />
            <Text className="text-sm text-indigo-600 font-medium">
              Or upload a PDF / study material
            </Text>
          </Pressable>
        </View>

        {/* Suggestions */}
        {store.suggestions.length > 0 && (
          <View className="mt-4">
            <Text className="px-5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Suggestions
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {store.suggestions.map((s, idx) => (
                <Pressable
                  key={idx}
                  disabled={busy}
                  onPress={() => handleSubjectTap(s)}
                  className={`bg-gray-50 border border-gray-200 rounded-full px-4 py-2 active:bg-gray-100 ${busy ? "opacity-50" : ""}`}
                >
                  <Text className="text-sm text-gray-700">{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Subject history */}
        <View className="mt-6 px-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-gray-900">
              Your Subjects
            </Text>
            {store.history.length > 0 && (
              <Pressable
                onPress={() => router.push("/(student)/subject-select")}
              >
                <Text className="text-sm text-indigo-600 font-medium">
                  See all
                </Text>
              </Pressable>
            )}
          </View>

          {store.historyLoading && store.history.length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-sm text-gray-400">
                Loading subjects...
              </Text>
            </View>
          ) : store.history.length === 0 ? (
            <View className="bg-gray-50 rounded-xl p-6 items-center">
              <BookOpen size={32} color="#D1D5DB" />
              <Text className="text-sm text-gray-500 mt-2 text-center">
                No subjects yet. Start learning above!
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {store.history.slice(0, 5).map((subject) => (
                <Pressable
                  key={subject.subject}
                  onPress={() => handleSubjectTap(subject.subject)}
                  disabled={busy}
                  className={`bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50 ${busy ? "opacity-50" : ""}`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text
                        className="text-base font-medium text-gray-900"
                        numberOfLines={1}
                      >
                        {subject.subject}
                      </Text>
                      <View className="flex-row items-center gap-3 mt-1">
                        <Text className="text-xs text-gray-500">
                          {subject.accuracy}% accuracy
                        </Text>
                        <View className="flex-row items-center gap-0.5">
                          <Zap size={10} color="#6366F1" />
                          <Text className="text-xs text-indigo-600 font-medium">
                            {subject.total_xp} XP
                          </Text>
                        </View>
                        {subject.last_studied_at && (
                          <Text className="text-xs text-gray-400">
                            {timeAgo(subject.last_studied_at)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <View className="w-10 h-10 rounded-full bg-indigo-50 items-center justify-center">
                        <Text className="text-xs font-semibold text-indigo-600">
                          {subject.accuracy}%
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View className="bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
                    <View
                      className="bg-indigo-500 h-full rounded-full"
                      style={{
                        width: `${Math.min(subject.accuracy, 100)}%`,
                      }}
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Overall stats */}
        {store.historyOverall &&
          store.historyOverall.total_sessions > 0 && (
            <View className="mt-6 px-5">
              <Text className="text-base font-semibold text-gray-900 mb-3">
                Overall Progress
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1 bg-indigo-50 rounded-xl p-3 items-center">
                  <Zap size={18} color="#6366F1" />
                  <Text className="text-lg font-bold text-gray-900 mt-1">
                    {store.historyOverall.total_xp}
                  </Text>
                  <Text className="text-xs text-gray-500">Total XP</Text>
                </View>
                <View className="flex-1 bg-emerald-50 rounded-xl p-3 items-center">
                  <Trophy size={18} color="#10B981" />
                  <Text className="text-lg font-bold text-gray-900 mt-1">
                    {store.historyOverall.concepts_mastered}
                  </Text>
                  <Text className="text-xs text-gray-500">Mastered</Text>
                </View>
                <View className="flex-1 bg-amber-50 rounded-xl p-3 items-center">
                  <BookOpen size={18} color="#D97706" />
                  <Text className="text-lg font-bold text-gray-900 mt-1">
                    {store.historyOverall.total_sessions}
                  </Text>
                  <Text className="text-xs text-gray-500">Sessions</Text>
                </View>
              </View>
            </View>
          )}

        {/* Error */}
        {store.error && (
          <View className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-sm text-red-700">{store.error}</Text>
            <Pressable
              onPress={() => store.setError(null)}
              className="mt-1"
            >
              <Text className="text-xs text-red-500 font-medium">
                Dismiss
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

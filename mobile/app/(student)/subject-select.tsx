import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Search, BookOpen, ChevronRight, Trash2 } from "lucide-react-native";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { useHomeScreen } from "@/hooks/feed/useHomeScreen";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export default function SubjectSelectScreen() {
  const router = useRouter();
  const store = useScrollSessionStore();
  const { handleSubjectSelect, handleDeleteSubject, timeAgo } = useHomeScreen();
  const [search, setSearch] = useState("");
  const [busy, run] = useAsyncAction();
  const [tappedSubject, setTappedSubject] = useState<string | null>(null);

  const filtered = store.history.filter((h) =>
    h.subject.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (subject: string) =>
    run(async () => {
      setTappedSubject(subject);
      try {
        await handleSubjectSelect(subject);
        router.push("/(student)/skill-tree");
      } finally {
        setTappedSubject(null);
      }
    });

  const handleNew = () => {
    const topic = search.trim();
    if (!topic) return;
    return run(async () => {
      setTappedSubject(topic);
      try {
        await handleSubjectSelect(topic);
        router.push("/(student)/skill-tree");
      } finally {
        setTappedSubject(null);
      }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <Pressable onPress={() => router.navigate("/(student)")} className="p-2 mr-2">
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900">
          Choose a Subject
        </Text>
      </View>

      {/* Search */}
      <View className="px-5 py-3">
        <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3">
          <Search size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search or enter a new topic..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 py-3 px-2 text-sm text-gray-900"
            onSubmitEditing={handleNew}
            returnKeyType="go"
            autoFocus
          />
        </View>

        {/* New topic hint */}
        {search.trim() &&
          !filtered.some(
            (h) => h.subject.toLowerCase() === search.trim().toLowerCase(),
          ) && (
            <Pressable
              onPress={handleNew}
              disabled={busy}
              className={`flex-row items-center gap-2 mt-2 bg-indigo-50 border border-indigo-200 rounded-xl p-3 active:bg-indigo-100 ${busy ? "opacity-50" : ""}`}
            >
              <BookOpen size={16} color="#6366F1" />
              <Text className="text-sm text-indigo-700 font-medium flex-1">
                Start learning "{search.trim()}"
              </Text>
              {tappedSubject === search.trim() ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <ChevronRight size={16} color="#6366F1" />
              )}
            </Pressable>
          )}
      </View>

      {/* Subject list */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Suggestions */}
        {store.suggestions.length > 0 && !search.trim() && (
          <View className="mb-4">
            <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Suggestions
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {store.suggestions.map((s, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSelect(s)}
                  disabled={busy}
                  className={`bg-gray-50 border border-gray-200 rounded-full px-4 py-2 active:bg-gray-100 ${busy ? "opacity-50" : ""}`}
                >
                  <Text className="text-sm text-gray-700">{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* History */}
        {filtered.length > 0 && (
          <View>
            <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {search.trim() ? "Matching Subjects" : "Your Subjects"}
            </Text>
            <View className="gap-2">
              {filtered.map((subject) => (
                <Pressable
                  key={subject.subject}
                  onPress={() => handleSelect(subject.subject)}
                  disabled={busy}
                  className={`flex-row items-center bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50 ${busy ? "opacity-50" : ""}`}
                >
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900">
                      {subject.subject}
                    </Text>
                    <View className="flex-row items-center gap-3 mt-1">
                      <Text className="text-xs text-gray-500">
                        {subject.accuracy}% accuracy
                      </Text>
                      <Text className="text-xs text-indigo-600 font-medium">
                        {subject.total_xp} XP
                      </Text>
                      {subject.last_studied_at && (
                        <Text className="text-xs text-gray-400">
                          {timeAgo(subject.last_studied_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => run(() => handleDeleteSubject(subject.subject))}
                      disabled={busy}
                      className="p-2"
                      hitSlop={8}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                    {tappedSubject === subject.subject ? (
                      <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                      <ChevronRight size={16} color="#9CA3AF" />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

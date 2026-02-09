import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react-native";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { scrollApi } from "@/lib/learnApi";
import { MathText } from "@/components/common/MathText";

interface Note {
  id: string;
  concept: string;
  title: string;
  body_markdown: string;
  key_takeaway: string;
  style: string;
}

export default function TopicNotesScreen() {
  const router = useRouter();
  const { topicId, topicName } = useLocalSearchParams<{
    topicId: string;
    topicName: string;
  }>();
  const store = useScrollSessionStore();

  const [notesByConcept, setNotesByConcept] = useState<Record<string, Note[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Look up concepts from syllabus
  const concepts: string[] = (() => {
    if (!store.syllabus || !topicId) return [];
    for (const unit of store.syllabus.units) {
      for (const topic of unit.topics) {
        if (topic.id === topicId) return topic.concepts;
      }
    }
    return [];
  })();

  useEffect(() => {
    if (!topicName) return;

    const fetchNotes = async () => {
      setLoading(true);
      setError(null);
      const res = await scrollApi.getTopicNotes(topicName, concepts);
      if (res.success && res.data) {
        setNotesByConcept(res.data.notes_by_concept);
      } else {
        setError(res.error ?? "Failed to load notes");
      }
      setLoading(false);
    };

    fetchNotes();
  }, [topicName]);

  const conceptEntries = Object.entries(notesByConcept);
  const isEmpty = !loading && !error && conceptEntries.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="p-2 mr-2"
        >
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <View className="flex-1">
          <Text
            className="text-lg font-semibold text-gray-900"
            numberOfLines={1}
          >
            {topicName || "Study Notes"}
          </Text>
          <Text className="text-xs text-gray-500">Study Notes</Text>
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="text-sm text-gray-500 mt-3">Loading notes...</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm text-red-600 text-center">{error}</Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 bg-indigo-600 rounded-xl px-6 py-3"
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {isEmpty && (
        <View className="flex-1 items-center justify-center px-6">
          <BookOpen size={40} color="#D1D5DB" />
          <Text className="text-base font-medium text-gray-500 mt-3 text-center">
            No notes available yet
          </Text>
          <Text className="text-sm text-gray-400 mt-1 text-center">
            Start a learning session on this topic to generate study notes.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-5 bg-indigo-600 rounded-xl px-6 py-3"
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </Pressable>
        </View>
      )}

      {/* Notes content */}
      {!loading && !error && conceptEntries.length > 0 && (
        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {conceptEntries.map(([concept, notes]) => (
            <View key={concept} className="mb-6">
              {/* Concept header */}
              <View className="flex-row items-center gap-2 mb-3">
                <BookOpen size={16} color="#6366F1" />
                <Text className="text-base font-semibold text-gray-900">
                  {concept}
                </Text>
                <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                  <Text className="text-xs text-gray-500">
                    {notes.length} {notes.length === 1 ? "note" : "notes"}
                  </Text>
                </View>
              </View>

              {/* Note cards */}
              <View className="gap-3">
                {notes.map((note) => (
                  <View
                    key={note.id}
                    className="bg-gray-50 rounded-xl p-4"
                  >
                    {note.title && (
                      <MathText
                        text={note.title}
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#111827",
                          marginBottom: 8,
                        }}
                      />
                    )}

                    <MathText
                      text={note.body_markdown}
                      style={{
                        fontSize: 15,
                        color: "#374151",
                        lineHeight: 22,
                      }}
                    />

                    {note.key_takeaway ? (
                      <View className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                        <View className="flex-row items-center gap-1.5 mb-1">
                          <Sparkles size={12} color="#D97706" />
                          <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                            Key Takeaway
                          </Text>
                        </View>
                        <MathText
                          text={note.key_takeaway}
                          style={{
                            fontSize: 13,
                            color: "#92400E",
                            lineHeight: 18,
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

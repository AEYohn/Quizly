import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  FileUp,
  RefreshCw,
  Users,
  Zap,
  Lock,
  CheckCircle2,
  Circle,
  Sparkles,
  Play,
} from "lucide-react-native";
import { useState } from "react";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { useHomeScreen } from "@/hooks/feed/useHomeScreen";
import { useSkillTree } from "@/hooks/feed/useSkillTree";
import { useHaptics } from "@/hooks/useHaptics";

function MasteryRing({ mastery, size = 40 }: { mastery: number; size?: number }) {
  const color =
    mastery >= 80
      ? "#10B981"
      : mastery >= 40
        ? "#EAB308"
        : mastery > 0
          ? "#6366F1"
          : "#D1D5DB";

  return (
    <View
      style={{ width: size, height: size }}
      className="rounded-full items-center justify-center"
    >
      {/* Background ring */}
      <View
        style={{ width: size, height: size, borderColor: "#E5E7EB", borderWidth: 3 }}
        className="rounded-full absolute"
      />
      {/* Progress ring (simplified — colored border) */}
      <View
        style={{
          width: size,
          height: size,
          borderColor: color,
          borderWidth: 3,
          borderTopColor: mastery < 100 ? "#E5E7EB" : color,
          borderRightColor: mastery < 75 ? "#E5E7EB" : color,
          borderBottomColor: mastery < 50 ? "#E5E7EB" : color,
          borderLeftColor: mastery < 25 ? "#E5E7EB" : color,
        }}
        className="rounded-full absolute"
      />
      <Text style={{ color, fontSize: size * 0.28 }} className="font-bold">
        {mastery}%
      </Text>
    </View>
  );
}

export default function SkillTreeScreen() {
  const router = useRouter();
  const store = useScrollSessionStore();
  const haptics = useHaptics();
  const { handleQuickStart } = useHomeScreen();
  const {
    showRegenBanner,
    isRegenerating,
    handleNodeTap,
    handleRegenerateSyllabus,
    handleStartAssessment,
    topicResources,
  } = useSkillTree(handleQuickStart);

  const [tappedNodeId, setTappedNodeId] = useState<string | null>(null);

  // Navigate to feed when session starts
  const handleNodePress = async (topic: any) => {
    if (tappedNodeId || store.isLoading) return;
    haptics.medium();
    setTappedNodeId(topic.id);
    try {
      await handleNodeTap(topic);
      if (useScrollSessionStore.getState().sessionId) {
        router.push("/(student)/feed");
      }
    } finally {
      setTappedNodeId(null);
    }
  };

  if (store.syllabusLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-sm text-gray-500 mt-3">
          Generating skill tree...
        </Text>
        <Pressable
          onPress={() => {
            store.setSyllabusLoading(false);
            router.navigate("/(student)");
          }}
          className="mt-6 px-5 py-2.5 rounded-xl border border-gray-200 active:bg-gray-50"
        >
          <Text className="text-sm text-gray-600 font-medium">Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!store.syllabus) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-gray-500 text-center">
          No syllabus loaded. Go back and select a subject.
        </Text>
        <Pressable
          onPress={() => router.navigate("/(student)")}
          className="mt-4 bg-indigo-600 rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.navigate("/(student)")} className="p-2 mr-2">
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <View>
            <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
              {store.syllabus.subject}
            </Text>
            <Text className="text-xs text-gray-500">
              {store.syllabus.units.reduce(
                (sum, u) => sum + u.topics.length,
                0,
              )}{" "}
              topics
            </Text>
          </View>
        </View>

        <View className="flex-row gap-1">
          <Pressable
            onPress={() => router.push("/(student)/pdf-upload")}
            className="p-2 rounded-full active:bg-gray-100"
          >
            <FileUp size={20} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={handleStartAssessment}
            className="p-2 rounded-full active:bg-gray-100"
          >
            <Sparkles size={20} color="#6366F1" />
          </Pressable>
        </View>
      </View>

      {/* Regen banner */}
      {showRegenBanner && (
        <Pressable
          onPress={handleRegenerateSyllabus}
          disabled={isRegenerating}
          className={`mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row items-center gap-2 ${isRegenerating ? "opacity-50" : ""}`}
        >
          <RefreshCw size={16} color="#D97706" />
          <Text className="text-sm text-amber-700 flex-1">
            New resources added — regenerate skill tree?
          </Text>
          {isRegenerating && <ActivityIndicator size="small" color="#D97706" />}
        </Pressable>
      )}

      {/* Skill tree */}
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {store.syllabus.units.map((unit, unitIdx) => (
          <View key={unit.id} className="mb-6">
            {/* Unit header */}
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="text-lg">{unit.icon}</Text>
              <Text className="text-base font-semibold text-gray-900 flex-1">
                {unit.name}
              </Text>
            </View>

            {/* Topics */}
            <View className="gap-2 ml-3 border-l-2 border-gray-200 pl-4">
              {unit.topics.map((topic) => {
                const mastery = store.mastery[topic.id] ?? 0;
                const presence = store.presence[topic.id] ?? 0;
                const isRecommended = store.recommendedNext === topic.id;
                const isActive = store.activeSyllabusNode === topic.id;
                const isLocked = false; // Could check prerequisites

                const statusColor =
                  mastery >= 80
                    ? "border-emerald-300 bg-emerald-50"
                    : mastery >= 40
                      ? "border-yellow-300 bg-yellow-50"
                      : mastery > 0
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-gray-200 bg-white";

                const isTapped = tappedNodeId === topic.id;
                const anyNodeLoading = !!tappedNodeId;

                return (
                  <Pressable
                    key={topic.id}
                    onPress={() => handleNodePress(topic)}
                    disabled={isLocked || store.isLoading || anyNodeLoading}
                    className={`border rounded-xl p-3 active:scale-[0.98] ${statusColor} ${
                      isRecommended ? "border-2 border-indigo-400" : ""
                    } ${anyNodeLoading && !isTapped ? "opacity-60" : ""}`}
                  >
                    <View className="flex-row items-center">
                      <MasteryRing mastery={mastery} size={36} />
                      <View className="flex-1 ml-3">
                        <View className="flex-row items-center gap-1.5">
                          <Text
                            className="text-sm font-medium text-gray-900 flex-1"
                            numberOfLines={1}
                          >
                            {topic.name}
                          </Text>
                          {isRecommended && (
                            <View className="bg-indigo-100 px-1.5 py-0.5 rounded">
                              <Text className="text-[10px] text-indigo-600 font-semibold">
                                NEXT
                              </Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-row items-center gap-2 mt-0.5">
                          <Text className="text-xs text-gray-500">
                            {topic.concepts.length} concepts · ~
                            {topic.estimated_minutes}m
                          </Text>
                          {presence > 0 && (
                            <View className="flex-row items-center gap-0.5">
                              <Users size={10} color="#6366F1" />
                              <Text className="text-xs text-indigo-600">
                                {presence}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {isTapped ? (
                        <ActivityIndicator size="small" color="#6366F1" />
                      ) : (
                        <Play size={16} color="#6366F1" />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Error */}
      {store.error && (
        <View className="absolute bottom-24 left-5 right-5 bg-red-50 border border-red-200 rounded-xl p-3">
          <Text className="text-sm text-red-700">{store.error}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

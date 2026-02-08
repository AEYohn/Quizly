import { View, Text, Pressable, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { useUserStore } from "@/stores/userStore";
import { PRESETS } from "@/types/learn";

const DIFFICULTY_OPTIONS = [
  { label: "Auto", value: null },
  { label: "Easy", value: 0.2 },
  { label: "Medium", value: 0.5 },
  { label: "Hard", value: 0.8 },
];

const STYLE_OPTIONS = [
  { label: "Mixed", value: null },
  { label: "Conceptual", value: "conceptual" },
  { label: "Application", value: "application" },
  { label: "Analysis", value: "analysis" },
];

const MIX_PRESETS = [
  { label: "Balanced", value: PRESETS.BALANCED },
  { label: "Quiz Heavy", value: PRESETS.QUIZ_HEAVY },
  { label: "Flashcard Focus", value: PRESETS.FLASHCARD_FOCUS },
];

export default function SettingsScreen() {
  const router = useRouter();
  const scrollStore = useScrollSessionStore();
  const userStore = useUserStore();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900">Settings</Text>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Difficulty */}
        <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Difficulty
        </Text>
        <View className="flex-row gap-2 mb-6">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.label}
              onPress={() =>
                scrollStore.setPreferences({ difficulty: opt.value })
              }
              className={`flex-1 py-2.5 rounded-xl items-center border ${
                scrollStore.preferences.difficulty === opt.value
                  ? "bg-indigo-50 border-indigo-300"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  scrollStore.preferences.difficulty === opt.value
                    ? "text-indigo-600"
                    : "text-gray-600"
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content Mix */}
        <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Content Mix
        </Text>
        <View className="gap-2 mb-6">
          {MIX_PRESETS.map((preset) => {
            const isActive =
              JSON.stringify(scrollStore.preferences.contentMix) ===
              JSON.stringify(preset.value);
            return (
              <Pressable
                key={preset.label}
                onPress={() =>
                  scrollStore.setPreferences({
                    contentMix: { ...preset.value },
                  })
                }
                className={`py-3 px-4 rounded-xl border ${
                  isActive
                    ? "bg-indigo-50 border-indigo-300"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isActive ? "text-indigo-600" : "text-gray-700"
                  }`}
                >
                  {preset.label}
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  MCQ {Math.round(preset.value.mcq * 100)}% · Flashcard{" "}
                  {Math.round(preset.value.flashcard * 100)}% · Info{" "}
                  {Math.round(preset.value.info_card * 100)}%
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Question Style */}
        <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Question Style
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {STYLE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.label}
              onPress={() =>
                scrollStore.setPreferences({ questionStyle: opt.value })
              }
              className={`px-4 py-2.5 rounded-xl border ${
                scrollStore.preferences.questionStyle === opt.value
                  ? "bg-indigo-50 border-indigo-300"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  scrollStore.preferences.questionStyle === opt.value
                    ? "text-indigo-600"
                    : "text-gray-600"
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Sound & Haptics */}
        <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Feedback
        </Text>
        <View className="bg-gray-50 rounded-xl overflow-hidden mb-6">
          <View className="flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <Text className="text-sm text-gray-700">Sound Effects</Text>
            <Switch
              value={userStore.preferences.soundEnabled}
              onValueChange={(v) => userStore.setPreference("soundEnabled", v)}
              trackColor={{ false: "#D1D5DB", true: "#818CF8" }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View className="flex-row items-center justify-between py-3 px-4">
            <Text className="text-sm text-gray-700">Haptic Feedback</Text>
            <Switch
              value={userStore.preferences.vibrationEnabled}
              onValueChange={(v) =>
                userStore.setPreference("vibrationEnabled", v)
              }
              trackColor={{ false: "#D1D5DB", true: "#818CF8" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

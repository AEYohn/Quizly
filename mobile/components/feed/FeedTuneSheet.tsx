import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  Pressable,
  PanResponder,
  LayoutChangeEvent,
} from "react-native";
import { X } from "lucide-react-native";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { PRESETS, DEFAULT_PREFERENCES } from "@/types/learn";
import type { FeedPreferences } from "@/types/learn";

type PresetKey = "QUIZ_HEAVY" | "BALANCED" | "FLASHCARD_FOCUS" | "CUSTOM";

const PRESET_LABELS: Record<PresetKey, string> = {
  QUIZ_HEAVY: "Quiz Heavy",
  BALANCED: "Balanced",
  FLASHCARD_FOCUS: "Flashcard Focus",
  CUSTOM: "Custom",
};

const QUESTION_STYLES = [
  { value: null, label: "Any" },
  { value: "conceptual", label: "Conceptual" },
  { value: "application", label: "Application" },
  { value: "analysis", label: "Analysis" },
  { value: "transfer", label: "Transfer" },
] as const;

const SLIDER_ITEMS = [
  { key: "mcq" as const, label: "Quiz Questions", color: "#8B5CF6" },
  { key: "flashcard" as const, label: "Flashcards", color: "#F59E0B" },
  { key: "info_card" as const, label: "Info Cards", color: "#0EA5E9" },
];

const DIFFICULTY_STEPS = [
  { value: 0.2, label: "Easy" },
  { value: 0.4, label: "Medium" },
  { value: 0.6, label: "Hard" },
  { value: 0.8, label: "Expert" },
];

function getActivePreset(mix: FeedPreferences["contentMix"]): PresetKey {
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (
      Math.abs(mix.mcq - preset.mcq) < 0.01 &&
      Math.abs(mix.flashcard - preset.flashcard) < 0.01 &&
      Math.abs(mix.info_card - preset.info_card) < 0.01
    ) {
      return key as PresetKey;
    }
  }
  return "CUSTOM";
}

/** Simple track-bar slider using PanResponder */
function TrackSlider({
  value,
  onValueChange,
  color,
}: {
  value: number;
  onValueChange: (v: number) => void;
  color: string;
}) {
  const trackWidth = useRef(0);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          const ratio = clamp(x / trackWidth.current);
          onValueChange(Math.round(ratio * 100) / 100);
        }
      },
      onPanResponderMove: (evt) => {
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          const ratio = clamp(x / trackWidth.current);
          onValueChange(Math.round(ratio * 100) / 100);
        }
      },
    }),
  ).current;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  }, []);

  const pct = Math.round(clamp(value) * 100);

  return (
    <View
      onLayout={onLayout}
      className="h-8 justify-center"
      {...panResponder.panHandlers}
    >
      <View className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

interface FeedTuneSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function FeedTuneSheet({ visible, onClose }: FeedTuneSheetProps) {
  const { preferences, setPreferences } = useScrollSessionStore();
  const [showCustomSliders, setShowCustomSliders] = useState(false);

  const activePreset = getActivePreset(preferences.contentMix);
  const isAutoMode = preferences.difficulty === null;

  const isNonDefault =
    preferences.difficulty !== null ||
    activePreset !== "BALANCED" ||
    preferences.questionStyle !== null;

  const handlePresetSelect = (key: PresetKey) => {
    if (key === "CUSTOM") {
      setShowCustomSliders(true);
      return;
    }
    setShowCustomSliders(false);
    setPreferences({
      contentMix: {
        ...PRESETS[key],
        resource_card: preferences.contentMix.resource_card,
      },
    });
  };

  const handleSliderChange = (
    type: "mcq" | "flashcard" | "info_card",
    value: number,
  ) => {
    const current = { ...preferences.contentMix };
    const oldValue = current[type];
    const delta = value - oldValue;

    const otherTypes = (["mcq", "flashcard", "info_card"] as const).filter(
      (t) => t !== type,
    );
    const otherSum = otherTypes.reduce((sum, t) => sum + current[t], 0);

    if (otherSum === 0) return;

    for (const ot of otherTypes) {
      const proportion = current[ot] / otherSum;
      current[ot] = Math.max(
        0,
        Math.round((current[ot] - delta * proportion) * 100) / 100,
      );
    }
    current[type] = value;

    const total = current.mcq + current.flashcard + current.info_card;
    if (total > 0) {
      current.mcq = Math.round((current.mcq / total) * 100) / 100;
      current.flashcard =
        Math.round((current.flashcard / total) * 100) / 100;
      current.info_card =
        Math.round((1 - current.mcq - current.flashcard) * 100) / 100;
    }

    setPreferences({ contentMix: current });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <Text className="text-base font-semibold text-gray-900">
            Tune Your Feed
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <X size={20} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-4 py-4"
          showsVerticalScrollIndicator={false}
        >
          {/* Difficulty */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Difficulty
              </Text>
              <Pressable
                onPress={() =>
                  setPreferences({
                    difficulty: isAutoMode ? 0.5 : null,
                  })
                }
                className={`px-2.5 py-1 rounded-full border ${
                  isAutoMode
                    ? "bg-violet-50 border-violet-200"
                    : "bg-gray-100 border-gray-200"
                }`}
              >
                <Text
                  className={`text-[11px] font-medium ${
                    isAutoMode ? "text-violet-600" : "text-gray-500"
                  }`}
                >
                  {isAutoMode ? "Auto" : "Manual"}
                </Text>
              </Pressable>
            </View>

            {!isAutoMode && (
              <View className="flex-row flex-wrap gap-2 mt-1">
                {DIFFICULTY_STEPS.map(({ value, label }) => {
                  const isActive =
                    Math.abs((preferences.difficulty ?? 0.5) - value) < 0.1;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setPreferences({ difficulty: value })}
                      className={`flex-1 py-2 rounded-xl border items-center ${
                        isActive
                          ? "bg-violet-50 border-violet-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          isActive ? "text-violet-600" : "text-gray-500"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Content Mix */}
          <View className="mb-6">
            <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Content Mix
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => {
                const isActive =
                  (activePreset === key && key !== "CUSTOM") ||
                  (key === "CUSTOM" && showCustomSliders);
                return (
                  <Pressable
                    key={key}
                    onPress={() => handlePresetSelect(key)}
                    className={`px-3.5 py-2 rounded-xl border ${
                      isActive
                        ? "bg-violet-50 border-violet-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isActive ? "text-violet-600" : "text-gray-500"
                      }`}
                    >
                      {PRESET_LABELS[key]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom sliders */}
            {(showCustomSliders || activePreset === "CUSTOM") && (
              <View className="mt-4 gap-3">
                {SLIDER_ITEMS.map(({ key, label, color }) => (
                  <View key={key}>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-[11px] text-gray-500">
                        {label}
                      </Text>
                      <Text className="text-[11px] text-gray-500 tabular-nums">
                        {Math.round(preferences.contentMix[key] * 100)}%
                      </Text>
                    </View>
                    <TrackSlider
                      value={preferences.contentMix[key]}
                      onValueChange={(v) => handleSliderChange(key, v)}
                      color={color}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Question Style */}
          <View className="mb-6">
            <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Question Style
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {QUESTION_STYLES.map(({ value, label }) => {
                const isActive = preferences.questionStyle === value;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setPreferences({ questionStyle: value })}
                    className={`px-3.5 py-2 rounded-xl border ${
                      isActive
                        ? "bg-violet-50 border-violet-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isActive ? "text-violet-600" : "text-gray-500"
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Reset */}
          {isNonDefault && (
            <Pressable
              onPress={() => setPreferences({ ...DEFAULT_PREFERENCES })}
              className="mb-8"
            >
              <Text className="text-xs text-gray-400">Reset to defaults</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

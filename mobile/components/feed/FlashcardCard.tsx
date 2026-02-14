import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { Zap, RotateCcw } from "lucide-react-native";
import { useHaptics } from "@/hooks/useHaptics";
import { MathText } from "@/components/common/MathText";
import type { ScrollCard } from "@/types/learn";

const RATINGS = [
  { value: 1, label: "No idea", color: "#EF4444", bg: "bg-red-50 border-red-200" },
  { value: 2, label: "Vaguely", color: "#F97316", bg: "bg-orange-50 border-orange-200" },
  { value: 3, label: "Kinda", color: "#EAB308", bg: "bg-yellow-50 border-yellow-200" },
  { value: 4, label: "Mostly", color: "#10B981", bg: "bg-emerald-50 border-emerald-200" },
  { value: 5, label: "Knew it", color: "#06B6D4", bg: "bg-cyan-50 border-cyan-200" },
];

interface FlashcardCardProps {
  card: ScrollCard;
  xpEarned: number | null;
  onRate: (rating: number) => void;
  onNext: () => void;
}

export function FlashcardCard({
  card,
  xpEarned,
  onRate,
  onNext,
}: FlashcardCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const haptics = useHaptics();

  const flipProgress = useSharedValue(0);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
    ],
    backfaceVisibility: "hidden" as const,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
    ],
    backfaceVisibility: "hidden" as const,
  }));

  const handleFlip = () => {
    if (isFlipped) return;
    haptics.medium();
    setIsFlipped(true);
    flipProgress.value = withTiming(1, { duration: 400 });
  };

  const handleRate = (rating: number) => {
    haptics.light();
    setHasRated(true);
    onRate(rating);
  };

  return (
    <View className="flex-1 bg-white px-5 pt-4 pb-6">
      {/* Concept badge */}
      <View className="flex-row items-center gap-2 mb-3">
        <View className="bg-violet-50 px-3 py-1 rounded-full">
          <Text className="text-xs font-medium text-violet-600">
            {card.concept}
          </Text>
        </View>
        <View className="bg-gray-100 px-2 py-1 rounded-full">
          <Text className="text-xs text-gray-500">Flashcard</Text>
        </View>
      </View>

      {/* Card area */}
      <Pressable onPress={handleFlip} className="flex-1 mb-4">
        <View className="flex-1 relative">
          {/* Front */}
          <Animated.View
            style={[frontStyle, { position: "absolute", width: "100%", height: "100%" }]}
          >
            <View className="flex-1 bg-indigo-50 border border-indigo-200 rounded-2xl p-6 items-center justify-center">
              <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
                showsVerticalScrollIndicator={false}
              >
                <MathText
                  text={card.flashcard_front || card.prompt}
                  style={{ fontSize: 18, fontWeight: "500", color: "#111827", textAlign: "center", lineHeight: 28 }}
                />
                {card.flashcard_hint && (
                  <MathText
                    text={`Hint: ${card.flashcard_hint}`}
                    style={{ fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 12 }}
                  />
                )}
              </ScrollView>
              {!isFlipped && (
                <View className="flex-row items-center gap-1.5 mt-4">
                  <RotateCcw size={14} color="#9CA3AF" />
                  <Text className="text-xs text-gray-400">Tap to flip</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Back */}
          <Animated.View
            style={[backStyle, { position: "absolute", width: "100%", height: "100%" }]}
          >
            <View className="flex-1 bg-emerald-50 border border-emerald-200 rounded-2xl p-6 items-center justify-center">
              <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
                showsVerticalScrollIndicator={false}
              >
                <MathText
                  text={card.flashcard_back || card.explanation}
                  style={{ fontSize: 18, fontWeight: "500", color: "#111827", textAlign: "center", lineHeight: 28 }}
                />
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </Pressable>

      {/* Rating buttons (show after flip) */}
      {isFlipped && !hasRated && (
        <View>
          <Text className="text-xs text-gray-500 text-center mb-2">
            How well did you know this?
          </Text>
          <View className="flex-row gap-2">
            {RATINGS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => handleRate(r.value)}
                className={`flex-1 items-center py-2.5 rounded-xl border ${r.bg}`}
              >
                <Text
                  style={{ color: r.color }}
                  className="text-xs font-semibold"
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Loading state between rating and XP response */}
      {hasRated && xpEarned === null && (
        <View className="items-center py-4">
          <ActivityIndicator size="small" color="#6366F1" />
          <Text className="text-xs text-gray-400 mt-2">Saving...</Text>
        </View>
      )}

      {/* XP + Continue (show after rating) */}
      {hasRated && xpEarned !== null && (
        <View>
          <View className="flex-row items-center justify-center gap-1 mb-3">
            <Zap size={16} color="#6366F1" />
            <Text className="text-sm font-semibold text-indigo-600">
              +{xpEarned} XP
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.medium();
              onNext();
            }}
            className="bg-indigo-600 rounded-xl py-3 items-center active:bg-indigo-700"
          >
            <Text className="text-white font-semibold">Continue</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

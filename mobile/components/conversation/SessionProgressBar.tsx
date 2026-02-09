import { View, Text, ScrollView } from "react-native";
import type { SessionPhase } from "@/types/learn";

interface SessionProgressBarProps {
  questionsAnswered: number;
  correctCount: number;
  currentConcept?: string;
  phase?: SessionPhase;
}

function getAccuracyColor(accuracy: number) {
  if (accuracy >= 70) return "text-emerald-600";
  if (accuracy >= 40) return "text-amber-600";
  return "text-red-600";
}

function getPhaseBadge(phase?: SessionPhase) {
  switch (phase) {
    case "diagnostic":
      return { label: "Diagnosing", bg: "bg-amber-100", text: "text-amber-700" };
    case "learning":
    case "reviewing":
      return { label: "Learning", bg: "bg-sky-100", text: "text-sky-700" };
    case "ended":
      return { label: "Ended", bg: "bg-emerald-100", text: "text-emerald-700" };
    default:
      return null;
  }
}

export function SessionProgressBar({
  questionsAnswered,
  correctCount,
  currentConcept,
  phase,
}: SessionProgressBarProps) {
  if (questionsAnswered === 0 && !currentConcept && !phase) return null;

  const accuracy =
    questionsAnswered > 0
      ? Math.round((correctCount / questionsAnswered) * 100)
      : 0;

  const phaseBadge = getPhaseBadge(phase);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="border-b border-gray-100"
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
    >
      {questionsAnswered > 0 && (
        <View className="bg-gray-100 rounded-full px-3 py-1">
          <Text className="text-xs font-medium text-gray-600">
            Questions: {questionsAnswered}
          </Text>
        </View>
      )}

      {questionsAnswered > 0 && (
        <View className="bg-gray-100 rounded-full px-3 py-1">
          <Text className={`text-xs font-medium ${getAccuracyColor(accuracy)}`}>
            Accuracy: {accuracy}%
          </Text>
        </View>
      )}

      {currentConcept && (
        <View className="bg-indigo-50 rounded-full px-3 py-1">
          <Text className="text-xs font-medium text-indigo-600" numberOfLines={1}>
            {currentConcept}
          </Text>
        </View>
      )}

      {phaseBadge && (
        <View className={`${phaseBadge.bg} rounded-full px-3 py-1`}>
          <Text className={`text-xs font-medium ${phaseBadge.text}`}>
            {phaseBadge.label}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

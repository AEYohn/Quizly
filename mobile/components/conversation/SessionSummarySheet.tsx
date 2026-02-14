import { View, Text, Pressable, ScrollView } from "react-native";
import { Trophy, Target, BookOpen, Clock, ArrowLeft } from "lucide-react-native";

interface SessionSummary {
  questions_answered: number;
  accuracy: number;
  concepts_covered: string[];
  mastery_updates: Array<{
    concept: string;
    score: number;
    trend: string;
  }>;
  duration_minutes: number;
}

interface SessionSummarySheetProps {
  summary: SessionSummary;
  onClose: () => void;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <Text className="text-emerald-600 text-sm">+</Text>;
  if (trend === "down") return <Text className="text-red-600 text-sm">-</Text>;
  return <Text className="text-gray-400 text-sm">=</Text>;
}

export function SessionSummarySheet({
  summary,
  onClose,
}: SessionSummarySheetProps) {
  return (
    <View className="absolute inset-0 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center mb-6 px-5">
          <View className="w-16 h-16 rounded-full bg-indigo-100 items-center justify-center mb-3">
            <Trophy size={32} color="#6366F1" />
          </View>
          <Text className="text-2xl font-bold text-gray-900">
            Session Complete!
          </Text>
        </View>

        {/* Stats */}
        <View className="flex-row px-5 gap-3 mb-6">
          <View className="flex-1 bg-indigo-50 rounded-xl p-3 items-center">
            <Target size={18} color="#6366F1" />
            <Text className="text-xl font-bold text-gray-900 mt-1">
              {summary.accuracy}%
            </Text>
            <Text className="text-xs text-gray-500">Accuracy</Text>
          </View>
          <View className="flex-1 bg-emerald-50 rounded-xl p-3 items-center">
            <BookOpen size={18} color="#10B981" />
            <Text className="text-xl font-bold text-gray-900 mt-1">
              {summary.questions_answered}
            </Text>
            <Text className="text-xs text-gray-500">Questions</Text>
          </View>
          <View className="flex-1 bg-amber-50 rounded-xl p-3 items-center">
            <Clock size={18} color="#D97706" />
            <Text className="text-xl font-bold text-gray-900 mt-1">
              {summary.duration_minutes}m
            </Text>
            <Text className="text-xs text-gray-500">Duration</Text>
          </View>
        </View>

        {/* Concepts covered */}
        {summary.concepts_covered.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-base font-semibold text-gray-900 mb-2">
              Concepts Covered
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {summary.concepts_covered.map((concept) => (
                <View
                  key={concept}
                  className="bg-gray-100 px-3 py-1 rounded-full"
                >
                  <Text className="text-xs font-medium text-gray-600">
                    {concept}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Mastery updates */}
        {summary.mastery_updates.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-base font-semibold text-gray-900 mb-2">
              Mastery Updates
            </Text>
            <View className="gap-2">
              {summary.mastery_updates.map((update) => (
                <View
                  key={update.concept}
                  className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3"
                >
                  <Text className="text-sm text-gray-700 flex-1">
                    {update.concept}
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    <TrendIcon trend={update.trend} />
                    <View className="bg-gray-200 h-1.5 w-20 rounded-full overflow-hidden">
                      <View
                        className="bg-indigo-500 h-full rounded-full"
                        style={{ width: `${Math.min(update.score * 100, 100)}%` }}
                      />
                    </View>
                    <Text className="text-xs font-medium text-gray-500 w-8 text-right">
                      {Math.round(update.score * 100)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Back button */}
        <View className="px-5">
          <Pressable
            onPress={onClose}
            className="bg-indigo-600 rounded-xl py-3.5 items-center flex-row justify-center gap-2 active:bg-indigo-700"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
            <Text className="text-white font-semibold text-base">
              Back to Home
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

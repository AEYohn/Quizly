import { View, Text, ScrollView, Modal, Pressable } from "react-native";
import { X, Target } from "lucide-react-native";
import type { ScrollSessionAnalytics } from "@/types/learn";

interface SessionAnalyticsSheetProps {
  visible: boolean;
  analytics: ScrollSessionAnalytics;
  onClose: () => void;
}

function getAccuracyBarColor(accuracy: number) {
  if (accuracy >= 80) return "#10B981";
  if (accuracy >= 50) return "#F59E0B";
  return "#EF4444";
}

export function SessionAnalyticsSheet({
  visible,
  analytics,
  onClose,
}: SessionAnalyticsSheetProps) {
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
            Session Stats
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <X size={20} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
          {/* Stat grid */}
          <View className="flex-row gap-3 mb-6">
            {[
              { label: "Accuracy", value: `${analytics.accuracy}%`, color: "#1F2937" },
              { label: "Total XP", value: `${analytics.total_xp}`, color: "#F59E0B" },
              { label: "Best Streak", value: `${analytics.best_streak}`, color: "#EA580C" },
            ].map(({ label, value, color }) => (
              <View
                key={label}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-4 items-center"
              >
                <Text style={{ color }} className="text-2xl font-bold">
                  {value}
                </Text>
                <Text className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide">
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Improvement areas */}
          {analytics.improvement_areas.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center gap-1.5 mb-3">
                <Target size={14} color="#EF4444" />
                <Text className="text-xs font-semibold text-red-500 uppercase tracking-wide">
                  Needs Work
                </Text>
              </View>
              <View className="gap-2">
                {analytics.improvement_areas.map((area) => {
                  const concept = analytics.concepts.find(
                    (c) => c.concept === area,
                  );
                  return (
                    <View
                      key={area}
                      className="flex-row items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                    >
                      <Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>
                        {area}
                      </Text>
                      <Text className="text-xs font-medium text-red-500 ml-2">
                        {concept?.accuracy ?? 0}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Strengths */}
          {analytics.strengths.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center gap-1.5 mb-3">
                <Target size={14} color="#10B981" />
                <Text className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">
                  Strengths
                </Text>
              </View>
              <View className="gap-2">
                {analytics.strengths.map((area) => {
                  const concept = analytics.concepts.find(
                    (c) => c.concept === area,
                  );
                  return (
                    <View
                      key={area}
                      className="flex-row items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3"
                    >
                      <Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>
                        {area}
                      </Text>
                      <Text className="text-xs font-medium text-emerald-500 ml-2">
                        {concept?.accuracy ?? 0}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* All concepts */}
          <View className="mb-8">
            <Text className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
              All Concepts
            </Text>
            <View className="gap-2">
              {analytics.concepts.map((c) => (
                <View
                  key={c.concept}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>
                      {c.concept}
                    </Text>
                    <Text className="text-xs text-gray-500 ml-2">
                      {c.attempts} Qs
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${c.accuracy}%`,
                          backgroundColor: getAccuracyBarColor(c.accuracy),
                        }}
                      />
                    </View>
                    <Text className="text-xs font-medium text-gray-500 w-10 text-right">
                      {c.accuracy}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

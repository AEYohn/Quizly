import { View, Text, Pressable, ScrollView } from "react-native";
import { Sparkles, Zap } from "lucide-react-native";
import { useHaptics } from "@/hooks/useHaptics";
import type { ScrollCard } from "@/types/learn";

interface InfoCardProps {
  card: ScrollCard;
  acknowledged: boolean;
  onGotIt: () => void;
  onNext: () => void;
}

export function InfoCard({ card, acknowledged, onGotIt, onNext }: InfoCardProps) {
  const haptics = useHaptics();

  return (
    <View className="flex-1 bg-white px-5 pt-4 pb-6">
      {/* Concept badge */}
      <View className="flex-row items-center gap-2 mb-3">
        <View className="bg-blue-50 px-3 py-1 rounded-full">
          <Text className="text-xs font-medium text-blue-600">
            {card.concept}
          </Text>
        </View>
        <View className="bg-gray-100 px-2 py-1 rounded-full">
          <Text className="text-xs text-gray-500">Learn</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title */}
        {card.info_title && (
          <Text className="text-xl font-semibold text-gray-900 mb-3">
            {card.info_title}
          </Text>
        )}

        {/* Body */}
        <View className="bg-gray-50 rounded-xl p-4 mb-4">
          <Text className="text-base text-gray-700 leading-6">
            {card.info_body || card.prompt}
          </Text>
        </View>

        {/* Takeaway */}
        {card.info_takeaway && (
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <View className="flex-row items-center gap-1.5 mb-1.5">
              <Sparkles size={14} color="#D97706" />
              <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Key Takeaway
              </Text>
            </View>
            <Text className="text-sm text-amber-800 leading-5">
              {card.info_takeaway}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action buttons */}
      {!acknowledged ? (
        <Pressable
          onPress={() => {
            haptics.light();
            onGotIt();
          }}
          className="bg-indigo-600 rounded-xl py-3 items-center active:bg-indigo-700"
        >
          <Text className="text-white font-semibold">Got it</Text>
        </Pressable>
      ) : (
        <View>
          <View className="flex-row items-center justify-center gap-1 mb-3">
            <Zap size={16} color="#6366F1" />
            <Text className="text-sm font-semibold text-indigo-600">
              +{card.xp_value} XP
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

import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import {
  Sparkles,
  Zap,
  BookOpen,
  Calculator,
  Lightbulb,
  ArrowLeftRight,
} from "lucide-react-native";
import { useHaptics } from "@/hooks/useHaptics";
import { MathText } from "@/components/common/MathText";
import type { ScrollCard } from "@/types/learn";

interface InfoCardProps {
  card: ScrollCard;
  acknowledged: boolean;
  onGotIt: () => void;
  onNext: () => void;
}

export function InfoCard({ card, acknowledged, onGotIt, onNext }: InfoCardProps) {
  const haptics = useHaptics();
  const [isSaving, setIsSaving] = useState(false);

  // Clear isSaving when acknowledged changes
  useEffect(() => {
    if (acknowledged) setIsSaving(false);
  }, [acknowledged]);

  const handleGotIt = () => {
    setIsSaving(true);
    onGotIt();
  };

  return (
    <View className="flex-1 bg-white px-5 pt-4 pb-6">
      {/* Concept badge */}
      <View className="flex-row items-center gap-2 mb-3">
        <View className="bg-blue-50 px-3 py-1 rounded-full">
          <Text className="text-xs font-medium text-blue-600">
            {card.concept}
          </Text>
        </View>
        <View className="bg-gray-100 px-2 py-1 rounded-full flex-row items-center gap-1">
          {card.info_style === "summary" ? (
            <BookOpen size={10} color="#6B7280" />
          ) : card.info_style === "key_formula" ? (
            <Calculator size={10} color="#6B7280" />
          ) : card.info_style === "example" ? (
            <Lightbulb size={10} color="#6B7280" />
          ) : card.info_style === "comparison" ? (
            <ArrowLeftRight size={10} color="#6B7280" />
          ) : null}
          <Text className="text-xs text-gray-500">
            {card.info_style === "summary"
              ? "Summary"
              : card.info_style === "key_formula"
                ? "Key Formula"
                : card.info_style === "example"
                  ? "Worked Example"
                  : card.info_style === "comparison"
                    ? "Comparison"
                    : "Learn"}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title */}
        {card.info_title && (
          <MathText
            text={card.info_title}
            style={{ fontSize: 20, fontWeight: "600", color: "#111827", marginBottom: 12 }}
          />
        )}

        {/* Body */}
        <View className="bg-gray-50 rounded-xl p-4 mb-4">
          <MathText
            text={card.info_body || card.prompt}
            style={{ fontSize: 16, color: "#374151", lineHeight: 24 }}
          />
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
            <MathText
              text={card.info_takeaway}
              style={{ fontSize: 14, color: "#92400E", lineHeight: 20 }}
            />
          </View>
        )}
      </ScrollView>

      {/* Action buttons */}
      {!acknowledged ? (
        <Pressable
          onPress={() => {
            haptics.light();
            handleGotIt();
          }}
          disabled={isSaving}
          className={`rounded-xl py-3 items-center flex-row justify-center gap-2 ${
            isSaving ? "bg-indigo-400" : "bg-indigo-600 active:bg-indigo-700"
          }`}
        >
          {isSaving ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text className="text-white font-semibold">Saving...</Text>
            </>
          ) : (
            <Text className="text-white font-semibold">Got it</Text>
          )}
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

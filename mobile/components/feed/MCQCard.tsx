import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  AlertTriangle,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  ArrowRight,
} from "lucide-react-native";
import { useHaptics } from "@/hooks/useHaptics";
import { MathText } from "@/components/common/MathText";
import type { ScrollCard, ScrollAnalytics } from "@/types/learn";

interface MCQCardProps {
  card: ScrollCard;
  result: { isCorrect: boolean; xpEarned: number; streakBroken: boolean } | null;
  analytics: ScrollAnalytics | null;
  onAnswer: (answer: string, confidence: number) => void;
  onNext: () => void;
  onHelp: () => void;
}

const CONFIDENCE_LEVELS = [
  { label: "Guessing", value: 25, border: "border-red-400", bg: "bg-red-50", text: "text-red-700" },
  { label: "Not sure", value: 50, border: "border-orange-400", bg: "bg-orange-50", text: "text-orange-700" },
  { label: "Pretty sure", value: 75, border: "border-yellow-400", bg: "bg-yellow-50", text: "text-yellow-700" },
  { label: "Certain", value: 100, border: "border-green-400", bg: "bg-green-50", text: "text-green-700" },
] as const;

export function MCQCard({ card, result, analytics, onAnswer, onNext, onHelp }: MCQCardProps) {
  const haptics = useHaptics();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear isSubmitting when result arrives
  useEffect(() => {
    if (result) setIsSubmitting(false);
  }, [result]);

  const handleOptionPress = (option: string) => {
    if (result) return;
    haptics.light();
    // Extract the letter from the option (e.g., "A) Answer text" → "A")
    const letter = option.match(/^([A-D])[.)]\s*/)?.[1] ?? option;
    setSelectedOption(letter);
  };

  const handleCheckAnswer = () => {
    if (!selectedOption || result) return;
    haptics.medium();
    setIsSubmitting(true);
    onAnswer(selectedOption, confidence);
  };

  return (
    <View className="flex-1 bg-white px-5 pt-4 pb-6">
      {/* Concept badge */}
      <View className="flex-row items-center gap-2 mb-3">
        <View className="bg-indigo-50 px-3 py-1 rounded-full">
          <Text className="text-xs font-medium text-indigo-600">
            {card.concept}
          </Text>
        </View>
        {card.is_reintroduction && (
          <View className="bg-amber-50 px-2 py-1 rounded-full">
            <Text className="text-xs text-amber-600">Review</Text>
          </View>
        )}
      </View>

      {/* Question */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <MathText
          text={card.prompt}
          style={{ fontSize: 18, fontWeight: "500", color: "#111827", lineHeight: 28 }}
          containerStyle={{ marginBottom: 20 }}
          inline
        />

        {/* Options */}
        <View className="gap-3">
          {card.options.map((option, idx) => {
            const letter = option.match(/^([A-D])[.)]\s*/)?.[1] ?? String.fromCharCode(65 + idx);
            const text = option.replace(/^[A-D][.)]\s*/, "");
            const isCorrectOption = result && letter.toUpperCase() === card.correct_answer.trim().toUpperCase();
            const isSelected = selectedOption === letter;
            const isWrongSelected = result && isSelected && !isCorrectOption;

            let borderColor = "border-gray-200";
            let bgColor = "bg-white";
            if (result) {
              if (isCorrectOption) {
                borderColor = "border-emerald-400";
                bgColor = "bg-emerald-50";
              } else if (isWrongSelected) {
                borderColor = "border-red-300";
                bgColor = "bg-red-50";
              } else {
                bgColor = "bg-gray-50";
              }
            } else if (isSelected) {
              borderColor = "border-indigo-300";
              bgColor = "bg-indigo-50";
            }

            return (
              <Pressable
                key={idx}
                onPress={() => handleOptionPress(option)}
                disabled={!!result}
                className={`flex-row items-center border rounded-xl p-4 ${borderColor} ${bgColor} active:bg-indigo-50 active:border-indigo-300`}
              >
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                  isCorrectOption ? "bg-emerald-100" : isWrongSelected ? "bg-red-100" : "bg-gray-100"
                }`}>
                  <Text className={`text-sm font-semibold ${
                    isCorrectOption ? "text-emerald-600" : isWrongSelected ? "text-red-600" : "text-gray-500"
                  }`}>
                    {letter}
                  </Text>
                </View>
                <MathText
                  text={text}
                  style={{
                    fontSize: 16,
                    color: result && !isCorrectOption ? "#9CA3AF" : "#1F2937",
                  }}
                  containerStyle={{ flex: 1 }}
                  inline
                />
                {result && isCorrectOption && (
                  <CheckCircle2 size={20} color="#10B981" />
                )}
                {isWrongSelected && (
                  <XCircle size={20} color="#EF4444" />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Confidence slider + Check Answer (pre-submit) */}
        {selectedOption && !result && (
          <View className="mt-5">
            {/* Confidence level selector */}
            <Text className="text-sm font-medium text-gray-600 mb-2">
              How confident are you?
            </Text>
            <View className="flex-row gap-2 mb-4">
              {CONFIDENCE_LEVELS.map((level) => (
                <Pressable
                  key={level.value}
                  onPress={() => {
                    haptics.light();
                    setConfidence(level.value);
                  }}
                  className={`flex-1 items-center py-2 px-1 rounded-lg border ${
                    confidence === level.value
                      ? `${level.border} ${level.bg}`
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      confidence === level.value ? level.text : "text-gray-500"
                    }`}
                  >
                    {level.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Check Answer button */}
            <Pressable
              onPress={handleCheckAnswer}
              disabled={!selectedOption || isSubmitting}
              className={`w-full rounded-xl py-3.5 items-center flex-row justify-center gap-2 mb-3 ${
                selectedOption && !isSubmitting
                  ? "bg-indigo-600 active:bg-indigo-700"
                  : !selectedOption
                    ? "bg-gray-200"
                    : "bg-indigo-400"
              }`}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white font-semibold">Checking...</Text>
                </>
              ) : (
                <>
                  <Text className={`font-semibold ${selectedOption ? "text-white" : "text-gray-400"}`}>
                    Check Answer
                  </Text>
                  {selectedOption && <ArrowRight size={16} color="#FFFFFF" />}
                </>
              )}
            </Pressable>

            {/* Help me think button */}
            <Pressable onPress={onHelp} className="items-center py-2">
              <Text className="text-sm text-gray-500">
                I don't know — help me think
              </Text>
            </Pressable>
          </View>
        )}

        {/* Result feedback */}
        {result && (
          <View className="mt-5">
            {/* Streak broken message */}
            {result.streakBroken && (
              <View className="flex-row items-center gap-2 px-4 py-3 rounded-xl mb-3 bg-orange-50">
                <Flame size={16} color="#EA580C" />
                <Text className="text-sm text-orange-700 flex-1">
                  Streak lost — this question will come back later
                </Text>
              </View>
            )}

            {/* Correct/Incorrect banner */}
            <View className={`flex-row items-center gap-2 px-4 py-3 rounded-xl mb-3 ${
              result.isCorrect ? "bg-emerald-50" : "bg-red-50"
            }`}>
              {result.isCorrect ? (
                <CheckCircle2 size={20} color="#10B981" />
              ) : (
                <XCircle size={20} color="#EF4444" />
              )}
              <Text className={`font-semibold ${
                result.isCorrect ? "text-emerald-700" : "text-red-700"
              }`}>
                {result.isCorrect ? "Correct!" : "Not quite"}
              </Text>
              {result.xpEarned > 0 && (
                <View className="flex-row items-center ml-auto bg-indigo-100 px-2 py-0.5 rounded-full">
                  <Zap size={12} color="#6366F1" />
                  <Text className="text-xs font-semibold text-indigo-600 ml-0.5">
                    +{result.xpEarned} XP
                  </Text>
                </View>
              )}
            </View>

            {/* Explanation */}
            {card.explanation && (
              <View className="bg-gray-50 rounded-xl p-4 mb-4">
                <MathText
                  text={card.explanation}
                  style={{ fontSize: 14, color: "#374151", lineHeight: 20 }}
                />
              </View>
            )}

            {/* Analytics feedback */}
            {analytics && (
              <View className="mb-4 gap-2">
                {/* Calibration nudge */}
                {!result.isCorrect && analytics.calibration_nudge && (
                  <View className="flex-row items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertTriangle size={16} color="#D97706" style={{ marginTop: 2 }} />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-amber-800 mb-0.5">
                        Calibration Check
                      </Text>
                      <Text className="text-sm text-amber-700">
                        {analytics.calibration_nudge.message}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Concept accuracy */}
                <View className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50">
                  <Target size={16} color="#6366F1" />
                  <Text className="text-sm text-gray-700">
                    {analytics.concept}: {analytics.concept_accuracy}%
                  </Text>
                </View>

                {/* Difficulty trend */}
                <View className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50">
                  {analytics.difficulty_trend === "harder" ? (
                    <TrendingUp size={16} color="#6366F1" />
                  ) : analytics.difficulty_trend === "easier" ? (
                    <TrendingDown size={16} color="#6366F1" />
                  ) : (
                    <Minus size={16} color="#6366F1" />
                  )}
                  <Text className="text-sm text-gray-700">
                    Getting {analytics.difficulty_trend}
                  </Text>
                </View>
              </View>
            )}

            {/* Next + Help */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={onHelp}
                className="flex-row items-center justify-center border border-gray-200 rounded-xl py-3 px-4"
              >
                <HelpCircle size={16} color="#6B7280" />
                <Text className="text-sm font-medium text-gray-600 ml-1.5">
                  Help
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptics.medium();
                  onNext();
                }}
                className="flex-1 bg-indigo-600 rounded-xl py-3 items-center active:bg-indigo-700"
              >
                <Text className="text-white font-semibold">Continue</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

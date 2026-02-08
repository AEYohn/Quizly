import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { CheckCircle2, XCircle, HelpCircle, Zap } from "lucide-react-native";
import { useHaptics } from "@/hooks/useHaptics";
import type { ScrollCard } from "@/types/learn";

interface MCQCardProps {
  card: ScrollCard;
  result: { isCorrect: boolean; xpEarned: number; streakBroken: boolean } | null;
  onAnswer: (answer: string) => void;
  onNext: () => void;
  onHelp: () => void;
}

export function MCQCard({ card, result, onAnswer, onNext, onHelp }: MCQCardProps) {
  const haptics = useHaptics();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleOptionPress = (option: string) => {
    if (result || selectedOption) return;
    haptics.light();
    // Extract the letter from the option (e.g., "A) Answer text" → "A")
    const letter = option.match(/^([A-D])[.)]\s*/)?.[1] ?? option;
    setSelectedOption(letter);
    onAnswer(letter);
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
        <Text className="text-lg font-medium text-gray-900 mb-5 leading-7">
          {card.prompt}
        </Text>

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
                disabled={!!result || !!selectedOption}
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
                <Text className={`flex-1 text-base ${
                  result && !isCorrectOption ? "text-gray-400" : "text-gray-800"
                }`}>
                  {text}
                </Text>
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

        {/* Result feedback */}
        {result && (
          <View className="mt-5">
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
                <Text className="text-sm text-gray-700 leading-5">
                  {card.explanation}
                </Text>
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

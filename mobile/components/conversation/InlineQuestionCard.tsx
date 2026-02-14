import { View, Text, Pressable } from "react-native";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { MathText } from "@/components/common/MathText";
import type { QuestionData } from "@/types/learn";

interface InlineQuestionCardProps {
  question: QuestionData;
  selectedAnswer: string | null;
  result: { isCorrect: boolean; correctAnswer: string } | null;
  onSelect: (answer: string) => void;
  disabled?: boolean;
}

export function InlineQuestionCard({
  question,
  selectedAnswer,
  result,
  onSelect,
  disabled = false,
}: InlineQuestionCardProps) {
  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-4 my-2 self-stretch">
      {/* Concept badge */}
      <View className="flex-row items-center mb-3">
        <View className="bg-indigo-50 px-2.5 py-0.5 rounded-full">
          <Text className="text-xs font-medium text-indigo-600">
            {question.concept}
          </Text>
        </View>
      </View>

      {/* Question prompt */}
      <MathText
        text={question.prompt}
        style={{ fontSize: 15, fontWeight: "500", color: "#111827", lineHeight: 22 }}
        containerStyle={{ marginBottom: 12 }}
        inline
      />

      {/* Options */}
      <View className="gap-2">
        {question.options.map((option, idx) => {
          const letter = option.match(/^([A-D])[.)]\s*/)?.[1] ?? String.fromCharCode(65 + idx);
          const text = option.replace(/^[A-D][.)]\s*/, "");
          const isSelected = selectedAnswer === letter;
          const isCorrect = result && letter.toUpperCase() === result.correctAnswer.trim().toUpperCase();
          const isWrongSelected = result && isSelected && !isCorrect;

          let borderClass = "border-gray-200";
          let bgClass = "bg-white";
          if (result) {
            if (isCorrect) {
              borderClass = "border-emerald-400";
              bgClass = "bg-emerald-50";
            } else if (isWrongSelected) {
              borderClass = "border-red-300";
              bgClass = "bg-red-50";
            } else {
              bgClass = "bg-gray-50";
            }
          } else if (isSelected) {
            borderClass = "border-indigo-300";
            bgClass = "bg-indigo-50";
          }

          return (
            <Pressable
              key={idx}
              onPress={() => onSelect(letter)}
              disabled={disabled || !!result}
              className={`flex-row items-center border rounded-xl p-3 ${borderClass} ${bgClass}`}
            >
              <View
                className={`w-7 h-7 rounded-full items-center justify-center mr-2.5 ${
                  isCorrect ? "bg-emerald-100" : isWrongSelected ? "bg-red-100" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isCorrect ? "text-emerald-600" : isWrongSelected ? "text-red-600" : "text-gray-500"
                  }`}
                >
                  {letter}
                </Text>
              </View>
              <MathText
                text={text}
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: result && !isCorrect && !isWrongSelected ? "#9CA3AF" : "#1F2937",
                }}
              />
              {result && isCorrect && <CheckCircle2 size={16} color="#10B981" />}
              {isWrongSelected && <XCircle size={16} color="#EF4444" />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

import { View, Text, Pressable, ScrollView, Modal } from "react-native";
import { X, CheckCircle2, XCircle } from "lucide-react-native";
import { MathText } from "@/components/common/MathText";
import type { QuestionHistoryItem } from "@/types/learn";

interface QuestionDetailModalProps {
  question: QuestionHistoryItem | null;
  onClose: () => void;
}

export function QuestionDetailModal({
  question,
  onClose,
}: QuestionDetailModalProps) {
  if (!question) return null;

  return (
    <Modal
      visible={!!question}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">
            Question Detail
          </Text>
          <Pressable onPress={onClose} className="p-1">
            <X size={22} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Concept + Result badge */}
          <View className="flex-row items-center gap-2 mb-4">
            <View className="bg-indigo-50 px-3 py-1 rounded-full">
              <Text className="text-xs font-medium text-indigo-600">
                {question.concept}
              </Text>
            </View>
            <View
              className={`px-3 py-1 rounded-full ${
                question.is_correct ? "bg-emerald-50" : "bg-red-50"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  question.is_correct ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {question.is_correct ? "Correct" : "Incorrect"}
              </Text>
            </View>
          </View>

          {/* Question prompt */}
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <MathText
              text={question.prompt}
              style={{ fontSize: 16, color: "#111827", lineHeight: 24 }}
            />
          </View>

          {/* Options if available */}
          {question.options && question.options.length > 0 && (
            <View className="gap-2 mb-4">
              {question.options.map((option, idx) => {
                const letter = option.match(/^([A-D])[.)]\s*/)?.[1] ?? String.fromCharCode(65 + idx);
                const text = option.replace(/^[A-D][.)]\s*/, "");
                const isCorrect = letter.toUpperCase() === (question.correct_answer ?? "").trim().toUpperCase();
                const isStudentAnswer = letter.toUpperCase() === (question.student_answer ?? "").trim().toUpperCase();
                const isWrongSelected = isStudentAnswer && !isCorrect;

                return (
                  <View
                    key={idx}
                    className={`flex-row items-center border rounded-xl p-3 ${
                      isCorrect
                        ? "border-emerald-400 bg-emerald-50"
                        : isWrongSelected
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200 bg-white"
                    }`}
                  >
                    <View
                      className={`w-7 h-7 rounded-full items-center justify-center mr-2.5 ${
                        isCorrect
                          ? "bg-emerald-100"
                          : isWrongSelected
                            ? "bg-red-100"
                            : "bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isCorrect
                            ? "text-emerald-600"
                            : isWrongSelected
                              ? "text-red-600"
                              : "text-gray-500"
                        }`}
                      >
                        {letter}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <MathText
                        text={text}
                        style={{
                          fontSize: 14,
                          color: isCorrect ? "#065F46" : isWrongSelected ? "#991B1B" : "#374151",
                        }}
                      />
                    </View>
                    {isCorrect && <CheckCircle2 size={18} color="#10B981" />}
                    {isWrongSelected && <XCircle size={18} color="#EF4444" />}
                  </View>
                );
              })}
            </View>
          )}

          {/* Your answer vs correct answer (fallback if no options) */}
          {(!question.options || question.options.length === 0) && (
            <View className="gap-2 mb-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-medium text-gray-500 w-24">
                  Your answer:
                </Text>
                <View
                  className={`flex-1 rounded-lg p-2 ${
                    question.is_correct ? "bg-emerald-50" : "bg-red-50"
                  }`}
                >
                  <MathText
                    text={question.student_answer}
                    style={{
                      fontSize: 14,
                      color: question.is_correct ? "#065F46" : "#991B1B",
                    }}
                  />
                </View>
              </View>
              {!question.is_correct && (
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-medium text-gray-500 w-24">
                    Correct:
                  </Text>
                  <View className="flex-1 rounded-lg p-2 bg-emerald-50">
                    <MathText
                      text={question.correct_answer}
                      style={{ fontSize: 14, color: "#065F46" }}
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Explanation */}
          {question.explanation && (
            <View className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Text className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                Explanation
              </Text>
              <MathText
                text={question.explanation}
                style={{ fontSize: 14, color: "#1E3A5F", lineHeight: 20 }}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

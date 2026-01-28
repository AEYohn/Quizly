import { View, Text, ScrollView, Pressable } from "react-native";
import { useState, useEffect } from "react";
import { Input, Card, Button } from "@/components/ui";
import { Check, X, Plus, Trash2 } from "lucide-react-native";

interface QuestionData {
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation?: string;
  points: number;
  time_limit: number;
}

interface QuestionEditorProps {
  initialData?: Partial<QuestionData>;
  onSave: (data: QuestionData) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const OPTION_KEYS = ["A", "B", "C", "D"];
const OPTION_COLORS: Record<string, string> = {
  A: "bg-red-500",
  B: "bg-blue-500",
  C: "bg-yellow-500",
  D: "bg-green-500",
};

export function QuestionEditor({
  initialData,
  onSave,
  onCancel,
  isEditing = false,
}: QuestionEditorProps) {
  const [questionText, setQuestionText] = useState(
    initialData?.question_text || ""
  );
  const [options, setOptions] = useState<Record<string, string>>(
    initialData?.options || { A: "", B: "", C: "", D: "" }
  );
  const [correctAnswer, setCorrectAnswer] = useState(
    initialData?.correct_answer || ""
  );
  const [explanation, setExplanation] = useState(
    initialData?.explanation || ""
  );
  const [points, setPoints] = useState(initialData?.points || 100);
  const [timeLimit, setTimeLimit] = useState(initialData?.time_limit || 30);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!questionText.trim()) {
      newErrors.question = "Question text is required";
    }

    const filledOptions = OPTION_KEYS.filter((key) => options[key]?.trim());
    if (filledOptions.length < 2) {
      newErrors.options = "At least 2 options are required";
    }

    if (!correctAnswer) {
      newErrors.answer = "Please select the correct answer";
    } else if (!options[correctAnswer]?.trim()) {
      newErrors.answer = "Correct answer option cannot be empty";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    // Filter out empty options
    const filteredOptions: Record<string, string> = {};
    OPTION_KEYS.forEach((key) => {
      if (options[key]?.trim()) {
        filteredOptions[key] = options[key].trim();
      }
    });

    onSave({
      question_text: questionText.trim(),
      options: filteredOptions,
      correct_answer: correctAnswer,
      explanation: explanation.trim() || undefined,
      points,
      time_limit: timeLimit,
    });
  };

  const handleOptionChange = (key: string, value: string) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    if (errors.options) {
      setErrors((prev) => ({ ...prev, options: "" }));
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        {/* Question Text */}
        <Card variant="elevated" className="mb-4">
          <Text className="font-semibold text-gray-900 mb-3">Question</Text>
          <Input
            placeholder="Enter your question..."
            value={questionText}
            onChangeText={(text) => {
              setQuestionText(text);
              if (errors.question) {
                setErrors((prev) => ({ ...prev, question: "" }));
              }
            }}
            multiline
            numberOfLines={3}
            error={errors.question}
          />
        </Card>

        {/* Options */}
        <Card variant="elevated" className="mb-4">
          <Text className="font-semibold text-gray-900 mb-3">
            Answer Options
          </Text>
          <Text className="text-gray-500 text-sm mb-4">
            Tap the circle to mark the correct answer
          </Text>

          {errors.options && (
            <Text className="text-error-500 text-sm mb-3">{errors.options}</Text>
          )}
          {errors.answer && (
            <Text className="text-error-500 text-sm mb-3">{errors.answer}</Text>
          )}

          <View className="gap-3">
            {OPTION_KEYS.map((key) => (
              <View key={key} className="flex-row items-center">
                {/* Correct Answer Selector */}
                <Pressable
                  onPress={() => setCorrectAnswer(key)}
                  className={`
                    w-10 h-10 rounded-full items-center justify-center mr-3
                    ${correctAnswer === key ? OPTION_COLORS[key] : "bg-gray-200"}
                  `}
                >
                  {correctAnswer === key ? (
                    <Check size={20} color="#fff" />
                  ) : (
                    <Text className="font-bold text-gray-500">{key}</Text>
                  )}
                </Pressable>

                {/* Option Input */}
                <View className="flex-1">
                  <Input
                    placeholder={`Option ${key}`}
                    value={options[key]}
                    onChangeText={(value) => handleOptionChange(key, value)}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Explanation */}
        <Card variant="elevated" className="mb-4">
          <Text className="font-semibold text-gray-900 mb-1">
            Explanation (Optional)
          </Text>
          <Text className="text-gray-500 text-sm mb-3">
            Shown after answering to help with learning
          </Text>
          <Input
            placeholder="Why is this the correct answer?"
            value={explanation}
            onChangeText={setExplanation}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Settings */}
        <Card variant="elevated" className="mb-4">
          <Text className="font-semibold text-gray-900 mb-3">Settings</Text>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-sm text-gray-600 mb-2">Points</Text>
              <View className="flex-row gap-2">
                {[50, 100, 200].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPoints(p)}
                    className={`
                      flex-1 py-2 rounded-lg items-center
                      ${points === p ? "bg-primary-500" : "bg-gray-100"}
                    `}
                  >
                    <Text
                      className={`font-medium ${
                        points === p ? "text-white" : "text-gray-700"
                      }`}
                    >
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="flex-1">
              <Text className="text-sm text-gray-600 mb-2">Time Limit</Text>
              <View className="flex-row gap-2">
                {[20, 30, 60].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTimeLimit(t)}
                    className={`
                      flex-1 py-2 rounded-lg items-center
                      ${timeLimit === t ? "bg-primary-500" : "bg-gray-100"}
                    `}
                  >
                    <Text
                      className={`font-medium ${
                        timeLimit === t ? "text-white" : "text-gray-700"
                      }`}
                    >
                      {t}s
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Card>

        {/* Actions */}
        <View className="flex-row gap-3 mt-2 mb-8">
          <Button variant="outline" className="flex-1" onPress={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" onPress={handleSave}>
            {isEditing ? "Update" : "Add Question"}
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

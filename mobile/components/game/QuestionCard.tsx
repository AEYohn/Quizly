import { View, Text, Pressable, Image } from "react-native";

interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  options: Record<string, string>;
  selectedAnswer: string | null;
  correctAnswer?: string | null; // Shown after answering
  onSelectAnswer: (answer: string) => void;
  disabled?: boolean;
  showResults?: boolean;
  imageUrl?: string;
}

const OPTION_COLORS = {
  A: { bg: "bg-red-500", selectedBg: "bg-red-600", text: "text-white" },
  B: { bg: "bg-blue-500", selectedBg: "bg-blue-600", text: "text-white" },
  C: { bg: "bg-yellow-500", selectedBg: "bg-yellow-600", text: "text-white" },
  D: { bg: "bg-green-500", selectedBg: "bg-green-600", text: "text-white" },
};

export function QuestionCard({
  questionNumber,
  totalQuestions,
  questionText,
  options,
  selectedAnswer,
  correctAnswer,
  onSelectAnswer,
  disabled = false,
  showResults = false,
  imageUrl,
}: QuestionCardProps) {
  const getOptionStyle = (key: string) => {
    const colors = OPTION_COLORS[key as keyof typeof OPTION_COLORS] || OPTION_COLORS.A;
    const isSelected = selectedAnswer === key;
    const isCorrect = showResults && correctAnswer === key;
    const isWrong = showResults && selectedAnswer === key && correctAnswer !== key;

    if (isCorrect) {
      return "bg-green-500 border-4 border-green-300";
    }
    if (isWrong) {
      return "bg-red-500 border-4 border-red-300";
    }
    if (isSelected) {
      return `${colors.selectedBg} border-4 border-white`;
    }
    return colors.bg;
  };

  return (
    <View className="flex-1">
      {/* Question Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-gray-500 font-medium">
          Question {questionNumber} of {totalQuestions}
        </Text>
      </View>

      {/* Question Text */}
      <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <Text className="text-xl font-semibold text-gray-900 text-center leading-7">
          {questionText}
        </Text>
      </View>

      {/* Question Image */}
      {imageUrl && (
        <View className="mb-4 rounded-xl overflow-hidden">
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-48"
            resizeMode="contain"
          />
        </View>
      )}

      {/* Options Grid */}
      <View className="flex-row flex-wrap gap-3">
        {Object.entries(options).map(([key, value]) => {
          const colors = OPTION_COLORS[key as keyof typeof OPTION_COLORS] || OPTION_COLORS.A;

          return (
            <Pressable
              key={key}
              onPress={() => !disabled && onSelectAnswer(key)}
              disabled={disabled}
              className={`
                flex-1 min-w-[45%] p-4 rounded-xl
                ${getOptionStyle(key)}
                ${disabled ? "opacity-80" : "active:scale-[0.98]"}
              `}
            >
              <View className="flex-row items-start">
                <View className="w-8 h-8 rounded-full bg-white/30 items-center justify-center mr-3">
                  <Text className={`font-bold ${colors.text}`}>{key}</Text>
                </View>
                <Text
                  className={`flex-1 text-base font-medium ${colors.text}`}
                  numberOfLines={3}
                >
                  {value}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Results Feedback */}
      {showResults && selectedAnswer && (
        <View
          className={`
            mt-4 p-4 rounded-xl
            ${selectedAnswer === correctAnswer ? "bg-green-100" : "bg-red-100"}
          `}
        >
          <Text
            className={`
              text-center font-semibold text-lg
              ${selectedAnswer === correctAnswer ? "text-green-700" : "text-red-700"}
            `}
          >
            {selectedAnswer === correctAnswer ? "Correct! 🎉" : "Incorrect 😔"}
          </Text>
          {selectedAnswer !== correctAnswer && correctAnswer && (
            <Text className="text-center text-gray-600 mt-1">
              The correct answer was {correctAnswer}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

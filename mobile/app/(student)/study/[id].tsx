import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card } from "@/components/ui";
import { QuestionCard, ConfidenceSlider } from "@/components/game";
import { useAuth } from "@/providers/AuthProvider";
import { studentQuizApi, QuizQuestion } from "@/lib/api";
import { ArrowLeft, Play, RotateCcw, Check, X } from "lucide-react-native";

type PracticeState = "idle" | "playing" | "result";

interface AnswerResult {
  questionIndex: number;
  selectedAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

export default function QuizDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [practiceState, setPracticeState] = useState<PracticeState>("idle");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [score, setScore] = useState(0);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return studentQuizApi.get(id, token);
    },
  });

  const currentQuestion = quiz?.questions?.[currentQuestionIndex];
  const totalQuestions = quiz?.questions?.length || 0;

  const handleStartPractice = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnswers([]);
    setScore(0);
    setPracticeState("playing");
  };

  const handleSelectAnswer = (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !currentQuestion) return;

    const isCorrect = selectedAnswer === currentQuestion.correct_answer;

    setAnswers((prev) => [
      ...prev,
      {
        questionIndex: currentQuestionIndex,
        selectedAnswer,
        isCorrect,
        correctAnswer: currentQuestion.correct_answer,
      },
    ]);

    if (isCorrect) {
      setScore((prev) => prev + currentQuestion.points);
    }

    setShowResult(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setPracticeState("result");
    }
  };

  const renderIdle = () => (
    <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
      {/* Quiz Info */}
      <Card variant="elevated" className="mb-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">
          {quiz?.title}
        </Text>
        {quiz?.subject && (
          <Text className="text-gray-500 mb-4">{quiz.subject}</Text>
        )}
        <View className="flex-row">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-primary-600">
              {totalQuestions}
            </Text>
            <Text className="text-sm text-gray-500">Questions</Text>
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-green-600">
              {quiz?.times_practiced || 0}
            </Text>
            <Text className="text-sm text-gray-500">Times Practiced</Text>
          </View>
          {quiz?.best_score !== undefined && (
            <View className="flex-1">
              <Text className="text-2xl font-bold text-yellow-600">
                {quiz.best_score}%
              </Text>
              <Text className="text-sm text-gray-500">Best Score</Text>
            </View>
          )}
        </View>
      </Card>

      {/* Start Button */}
      <Button
        size="lg"
        fullWidth
        icon={Play}
        onPress={handleStartPractice}
        className="mb-6"
      >
        Start Practice
      </Button>

      {/* Questions Preview */}
      <Text className="text-lg font-semibold text-gray-900 mb-3">
        Questions Preview
      </Text>
      {quiz?.questions?.map((question, index) => (
        <Card key={index} variant="outline" className="mb-2">
          <View className="flex-row items-start">
            <View className="w-8 h-8 bg-primary-100 rounded-lg items-center justify-center mr-3">
              <Text className="text-primary-700 font-bold">{index + 1}</Text>
            </View>
            <Text className="flex-1 text-gray-800" numberOfLines={2}>
              {question.question_text}
            </Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );

  const renderPlaying = () => (
    <View className="flex-1 px-4">
      {currentQuestion && (
        <>
          <QuestionCard
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={totalQuestions}
            questionText={currentQuestion.question_text}
            options={currentQuestion.options}
            selectedAnswer={selectedAnswer}
            correctAnswer={showResult ? currentQuestion.correct_answer : null}
            onSelectAnswer={handleSelectAnswer}
            disabled={showResult}
            showResults={showResult}
            imageUrl={currentQuestion.image_url}
          />

          {/* Explanation */}
          {showResult && currentQuestion.explanation && (
            <Card className="mt-4 bg-blue-50 border border-blue-200">
              <Text className="text-blue-800 font-medium mb-1">
                Explanation
              </Text>
              <Text className="text-blue-700">
                {currentQuestion.explanation}
              </Text>
            </Card>
          )}

          {/* Action Button */}
          <View className="mt-4 mb-6">
            {!showResult ? (
              <Button
                size="lg"
                fullWidth
                onPress={handleSubmitAnswer}
                disabled={!selectedAnswer}
              >
                Submit Answer
              </Button>
            ) : (
              <Button size="lg" fullWidth onPress={handleNextQuestion}>
                {currentQuestionIndex < totalQuestions - 1
                  ? "Next Question"
                  : "See Results"}
              </Button>
            )}
          </View>
        </>
      )}
    </View>
  );

  const renderResult = () => {
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);

    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-4 items-center"
      >
        {/* Score Card */}
        <Card variant="elevated" className="w-full items-center py-8 mb-6">
          <Text className="text-6xl mb-4">
            {percentage >= 80 ? "🎉" : percentage >= 60 ? "👍" : "📚"}
          </Text>
          <Text className="text-4xl font-bold text-gray-900 mb-2">
            {percentage}%
          </Text>
          <Text className="text-gray-500 text-lg">
            {correctCount} of {totalQuestions} correct
          </Text>
          <Text className="text-primary-600 font-semibold mt-2">
            +{score} points
          </Text>
        </Card>

        {/* Action Buttons */}
        <View className="flex-row gap-3 w-full mb-6">
          <Button
            variant="outline"
            className="flex-1"
            icon={RotateCcw}
            onPress={handleStartPractice}
          >
            Try Again
          </Button>
          <Button
            className="flex-1"
            onPress={() => setPracticeState("idle")}
          >
            Done
          </Button>
        </View>

        {/* Answer Review */}
        <Text className="text-lg font-semibold text-gray-900 mb-3 self-start">
          Review Answers
        </Text>
        {answers.map((answer, index) => {
          const question = quiz?.questions?.[answer.questionIndex];
          return (
            <Card
              key={index}
              variant="outline"
              className={`w-full mb-2 ${
                answer.isCorrect ? "bg-green-50" : "bg-red-50"
              }`}
            >
              <View className="flex-row items-start">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                    answer.isCorrect ? "bg-green-500" : "bg-red-500"
                  }`}
                >
                  {answer.isCorrect ? (
                    <Check size={18} color="#fff" />
                  ) : (
                    <X size={18} color="#fff" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-gray-800 font-medium mb-1">
                    {question?.question_text}
                  </Text>
                  <Text className="text-sm text-gray-600">
                    Your answer: {answer.selectedAnswer}
                    {!answer.isCorrect && ` (Correct: ${answer.correctAnswer})`}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center border-b border-gray-100 bg-white">
        <Button
          variant="ghost"
          icon={ArrowLeft}
          onPress={() => {
            if (practiceState === "playing") {
              Alert.alert(
                "Exit Practice?",
                "Your progress will be lost.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Exit",
                    style: "destructive",
                    onPress: () => setPracticeState("idle"),
                  },
                ]
              );
            } else {
              router.back();
            }
          }}
        >
          {practiceState === "idle" ? "Back" : ""}
        </Button>
        <Text className="flex-1 text-center text-lg font-semibold text-gray-900">
          {practiceState === "playing"
            ? `${currentQuestionIndex + 1}/${totalQuestions}`
            : practiceState === "result"
            ? "Results"
            : ""}
        </Text>
        <View className="w-16" />
      </View>

      {practiceState === "idle" && renderIdle()}
      {practiceState === "playing" && renderPlaying()}
      {practiceState === "result" && renderResult()}
    </SafeAreaView>
  );
}

import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { Button, Card } from "@/components/ui";
import { QuestionCard } from "@/components/game";
import { Flashcard } from "@/components/study";
import { useAuth } from "@/providers/AuthProvider";
import { useHaptics } from "@/hooks";
import { studentQuizApi, QuizQuestion } from "@/lib/api";
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Check,
  X,
  Layers,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

type StudyMode = "overview" | "practice" | "flashcards";
type PracticeState = "playing" | "result";

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
  const haptics = useHaptics();

  const [mode, setMode] = useState<StudyMode>("overview");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [score, setScore] = useState(0);
  const [practiceState, setPracticeState] = useState<PracticeState>("playing");

  // Flashcard swipe animation
  const translateX = useSharedValue(0);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return studentQuizApi.get(id, token);
    },
  });

  const questions = quiz?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  // Practice mode handlers
  const handleStartPractice = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnswers([]);
    setScore(0);
    setPracticeState("playing");
    setMode("practice");
    haptics.medium();
  };

  const handleStartFlashcards = () => {
    setCurrentQuestionIndex(0);
    setMode("flashcards");
    haptics.medium();
  };

  const handleSelectAnswer = (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
    haptics.selection();
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
      haptics.success();
    } else {
      haptics.error();
    }

    setShowResult(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      haptics.light();
    } else {
      setPracticeState("result");
      haptics.success();
    }
  };

  // Flashcard navigation
  const goToNextCard = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      haptics.light();
    }
  };

  const goToPrevCard = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      haptics.light();
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD && currentQuestionIndex < totalQuestions - 1) {
        translateX.value = withSpring(0);
        runOnJS(goToNextCard)();
      } else if (event.translationX > SWIPE_THRESHOLD && currentQuestionIndex > 0) {
        translateX.value = withSpring(0);
        runOnJS(goToPrevCard)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleBackPress = () => {
    if (mode === "overview") {
      router.back();
    } else if (mode === "practice" && practiceState === "playing") {
      Alert.alert("Exit Practice?", "Your progress will be lost.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit",
          style: "destructive",
          onPress: () => setMode("overview"),
        },
      ]);
    } else {
      setMode("overview");
    }
  };

  // Overview Mode
  const renderOverview = () => (
    <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
      {/* Quiz Info */}
      <Card variant="elevated" className="mb-6">
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
            <Text className="text-sm text-gray-500">Practiced</Text>
          </View>
          {quiz?.best_score !== undefined && (
            <View className="flex-1">
              <Text className="text-2xl font-bold text-yellow-600">
                {quiz.best_score}%
              </Text>
              <Text className="text-sm text-gray-500">Best</Text>
            </View>
          )}
        </View>
      </Card>

      {/* Study Mode Selection */}
      <Text className="text-lg font-semibold text-gray-900 mb-3">
        Choose Study Mode
      </Text>

      <View className="flex-row gap-3 mb-6">
        <Pressable
          onPress={handleStartPractice}
          className="flex-1 bg-primary-500 p-4 rounded-2xl active:bg-primary-600"
        >
          <View className="items-center">
            <View className="w-12 h-12 bg-white/20 rounded-xl items-center justify-center mb-2">
              <Play size={24} color="#fff" />
            </View>
            <Text className="text-white font-semibold text-base">Practice</Text>
            <Text className="text-white/70 text-xs text-center mt-1">
              Test your knowledge
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={handleStartFlashcards}
          className="flex-1 bg-green-500 p-4 rounded-2xl active:bg-green-600"
        >
          <View className="items-center">
            <View className="w-12 h-12 bg-white/20 rounded-xl items-center justify-center mb-2">
              <Layers size={24} color="#fff" />
            </View>
            <Text className="text-white font-semibold text-base">
              Flashcards
            </Text>
            <Text className="text-white/70 text-xs text-center mt-1">
              Review & memorize
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Questions Preview */}
      <Text className="text-lg font-semibold text-gray-900 mb-3">
        Questions
      </Text>
      {questions.map((question, index) => (
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

  // Practice Mode
  const renderPractice = () => {
    if (practiceState === "result") {
      return renderPracticeResult();
    }

    return (
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
  };

  // Practice Results
  const renderPracticeResult = () => {
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);

    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-4 items-center"
      >
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

        <View className="flex-row gap-3 w-full mb-6">
          <Button
            variant="outline"
            className="flex-1"
            icon={RotateCcw}
            onPress={handleStartPractice}
          >
            Try Again
          </Button>
          <Button className="flex-1" onPress={() => setMode("overview")}>
            Done
          </Button>
        </View>

        <Text className="text-lg font-semibold text-gray-900 mb-3 self-start">
          Review Answers
        </Text>
        {answers.map((answer, index) => {
          const question = questions[answer.questionIndex];
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

  // Flashcard Mode
  const renderFlashcards = () => {
    if (!currentQuestion) return null;

    return (
      <GestureHandlerRootView className="flex-1">
        <View className="flex-1 justify-center items-center px-4">
          {/* Progress */}
          <View className="w-full mb-6">
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-500">
                Card {currentQuestionIndex + 1} of {totalQuestions}
              </Text>
              <Text className="text-primary-600 font-medium">
                {Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100)}%
              </Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary-500 rounded-full"
                style={{
                  width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                }}
              />
            </View>
          </View>

          {/* Swipeable Flashcard */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={animatedCardStyle}>
              <Flashcard
                question={currentQuestion.question_text}
                answer={
                  currentQuestion.options[currentQuestion.correct_answer] ||
                  currentQuestion.correct_answer
                }
                explanation={currentQuestion.explanation}
              />
            </Animated.View>
          </GestureDetector>

          {/* Navigation Buttons */}
          <View className="flex-row items-center justify-between w-full mt-8 px-4">
            <Pressable
              onPress={goToPrevCard}
              disabled={currentQuestionIndex === 0}
              className={`w-14 h-14 rounded-full items-center justify-center ${
                currentQuestionIndex === 0 ? "bg-gray-100" : "bg-gray-200 active:bg-gray-300"
              }`}
            >
              <ChevronLeft
                size={28}
                color={currentQuestionIndex === 0 ? "#D1D5DB" : "#374151"}
              />
            </Pressable>

            <Text className="text-gray-500">Swipe to navigate</Text>

            <Pressable
              onPress={goToNextCard}
              disabled={currentQuestionIndex === totalQuestions - 1}
              className={`w-14 h-14 rounded-full items-center justify-center ${
                currentQuestionIndex === totalQuestions - 1
                  ? "bg-gray-100"
                  : "bg-gray-200 active:bg-gray-300"
              }`}
            >
              <ChevronRight
                size={28}
                color={
                  currentQuestionIndex === totalQuestions - 1
                    ? "#D1D5DB"
                    : "#374151"
                }
              />
            </Pressable>
          </View>

          {/* Done Button */}
          {currentQuestionIndex === totalQuestions - 1 && (
            <Button
              className="mt-8"
              size="lg"
              onPress={() => {
                setMode("overview");
                haptics.success();
              }}
            >
              Finish Review
            </Button>
          )}
        </View>
      </GestureHandlerRootView>
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
        <Pressable
          onPress={handleBackPress}
          className="flex-row items-center active:opacity-70"
        >
          <ArrowLeft size={24} color="#374151" />
          <Text className="text-gray-700 font-medium ml-2">
            {mode === "overview" ? "Back" : ""}
          </Text>
        </Pressable>
        <Text className="flex-1 text-center text-lg font-semibold text-gray-900">
          {mode === "practice"
            ? `${currentQuestionIndex + 1}/${totalQuestions}`
            : mode === "flashcards"
            ? "Flashcards"
            : ""}
        </Text>
        <View className="w-16" />
      </View>

      {mode === "overview" && renderOverview()}
      {mode === "practice" && renderPractice()}
      {mode === "flashcards" && renderFlashcards()}
    </SafeAreaView>
  );
}

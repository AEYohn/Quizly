import { View, Text, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback, useRef } from "react";
import {
  useGameSocket,
  QuestionStartMessage,
  ResultsMessage,
  ScoreUpdateMessage,
} from "@/hooks/useGameSocket";
import { gameApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { QuestionCard, ConfidenceSlider, TimerBar } from "@/components/game";
import { Button, Card } from "@/components/ui";
import { Trophy, Zap } from "lucide-react-native";

type GamePhase = "waiting" | "question" | "submitted" | "results";

interface PlayerScore {
  totalScore: number;
  currentStreak: number;
  maxStreak: number;
  correctAnswers: number;
  lastPointsEarned: number;
  lastIsCorrect: boolean;
}

export default function GamePlayScreen() {
  const { id, playerId, nickname } = useLocalSearchParams<{
    id: string;
    playerId: string;
    nickname: string;
  }>();
  const router = useRouter();
  const { addGuestGame, isGuest } = useAuth();

  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [currentQuestion, setCurrentQuestion] = useState<QuestionStartMessage | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confidenceLevel, setConfidenceLevel] = useState(2);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [playerScore, setPlayerScore] = useState<PlayerScore>({
    totalScore: 0,
    currentStreak: 0,
    maxStreak: 0,
    correctAnswers: 0,
    lastPointsEarned: 0,
    lastIsCorrect: false,
  });
  const [quizTitle, setQuizTitle] = useState("");

  const answerStartTime = useRef<number>(0);

  const handleQuestionStart = useCallback((data: QuestionStartMessage) => {
    setCurrentQuestion(data);
    setSelectedAnswer(null);
    setConfidenceLevel(2);
    setCorrectAnswer(null);
    setExplanation(null);
    setTimeRemaining(data.time_limit);
    setPhase("question");
    answerStartTime.current = Date.now();
  }, []);

  const handleResults = useCallback((data: ResultsMessage) => {
    setCorrectAnswer(data.correct_answer || null);
    setExplanation(data.explanation || null);
    setPhase("results");
  }, []);

  const handleScoreUpdate = useCallback((data: ScoreUpdateMessage) => {
    if (data.player_id === playerId) {
      setPlayerScore((prev) => ({
        totalScore: data.total_score,
        currentStreak: data.current_streak,
        maxStreak: Math.max(prev.maxStreak, data.current_streak),
        correctAnswers: prev.correctAnswers + (data.is_correct ? 1 : 0),
        lastPointsEarned: data.points_earned,
        lastIsCorrect: data.is_correct,
      }));
    }
  }, [playerId]);

  const handleGameEnd = useCallback(() => {
    // Save game for guest
    if (isGuest) {
      addGuestGame(id, playerScore.totalScore);
    }

    router.replace({
      pathname: "/game/[id]/summary",
      params: {
        id,
        playerId,
        nickname,
        score: playerScore.totalScore.toString(),
        correct: playerScore.correctAnswers.toString(),
        total: totalQuestions.toString(),
        quizTitle,
        streak: playerScore.maxStreak.toString(),
      },
    });
  }, [id, playerId, nickname, playerScore, totalQuestions, quizTitle, isGuest, addGuestGame, router]);

  const { isConnected, disconnect } = useGameSocket({
    gameId: id,
    playerId,
    enabled: !!playerId,
    onGameStarted: (data) => {
      setTotalQuestions(data.total_questions);
    },
    onQuestionStart: handleQuestionStart,
    onTimerTick: (data) => {
      setTimeRemaining(data.time_remaining);
    },
    onQuestionEnd: () => {
      // Auto-submit if not submitted
      if (phase === "question" && selectedAnswer) {
        handleSubmitAnswer();
      }
    },
    onResults: handleResults,
    onScoreUpdate: handleScoreUpdate,
    onGameEnd: handleGameEnd,
    onHostDisconnected: () => {
      Alert.alert(
        "Host Disconnected",
        "The game host has left the game.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(student)"),
          },
        ]
      );
    },
    onError: (err) => {
      console.error("Game error:", err);
    },
  });

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || submitting || phase !== "question") return;

    setSubmitting(true);
    setPhase("submitted");

    try {
      const responseTime = Date.now() - answerStartTime.current;

      await gameApi.submitAnswer(
        id,
        playerId!,
        {
          answer: selectedAnswer,
          response_time_ms: responseTime,
        },
        confidenceLevel
      );
    } catch (err) {
      console.error("Failed to submit answer:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimeUp = () => {
    if (phase === "question") {
      // Auto-submit if answer selected, otherwise mark as no answer
      if (selectedAnswer) {
        handleSubmitAnswer();
      } else {
        setPhase("submitted");
      }
    }
  };

  const renderWaiting = () => (
    <View className="flex-1 items-center justify-center">
      <Text className="text-6xl mb-4">⏳</Text>
      <Text className="text-white text-2xl font-bold mb-2">Get Ready!</Text>
      <Text className="text-white/70">First question coming up...</Text>
    </View>
  );

  const renderQuestion = () => (
    <View className="flex-1 px-4">
      {/* Timer */}
      <View className="mb-4">
        <TimerBar
          timeRemaining={timeRemaining}
          totalTime={currentQuestion?.time_limit || 30}
          onTimeUp={handleTimeUp}
        />
      </View>

      {/* Score Display */}
      <View className="flex-row justify-between mb-4">
        <View className="flex-row items-center bg-white/10 px-3 py-2 rounded-full">
          <Trophy size={16} color="#FFD700" />
          <Text className="text-white font-bold ml-2">
            {playerScore.totalScore}
          </Text>
        </View>
        {playerScore.currentStreak >= 2 && (
          <View className="flex-row items-center bg-orange-500 px-3 py-2 rounded-full">
            <Zap size={16} color="#fff" />
            <Text className="text-white font-bold ml-1">
              {playerScore.currentStreak}x streak!
            </Text>
          </View>
        )}
      </View>

      {/* Question */}
      {currentQuestion && (
        <QuestionCard
          questionNumber={currentQuestion.question_index + 1}
          totalQuestions={totalQuestions}
          questionText={currentQuestion.question_text}
          options={currentQuestion.options}
          selectedAnswer={selectedAnswer}
          onSelectAnswer={setSelectedAnswer}
          disabled={phase !== "question"}
        />
      )}

      {/* Confidence Slider */}
      {selectedAnswer && phase === "question" && (
        <View className="mt-4">
          <ConfidenceSlider
            value={confidenceLevel}
            onChange={setConfidenceLevel}
          />
        </View>
      )}

      {/* Submit Button */}
      {phase === "question" && (
        <View className="mt-4 mb-6">
          <Button
            size="lg"
            fullWidth
            onPress={handleSubmitAnswer}
            disabled={!selectedAnswer}
            loading={submitting}
          >
            Submit Answer
          </Button>
        </View>
      )}
    </View>
  );

  const renderSubmitted = () => (
    <View className="flex-1 px-4">
      {/* Question Display */}
      {currentQuestion && (
        <QuestionCard
          questionNumber={currentQuestion.question_index + 1}
          totalQuestions={totalQuestions}
          questionText={currentQuestion.question_text}
          options={currentQuestion.options}
          selectedAnswer={selectedAnswer}
          onSelectAnswer={() => {}}
          disabled
        />
      )}

      {/* Waiting for results */}
      <Card variant="elevated" className="mt-6 items-center py-6">
        <Text className="text-2xl mb-2">✓</Text>
        <Text className="text-lg font-semibold text-gray-900">
          Answer Submitted!
        </Text>
        <Text className="text-gray-500">Waiting for results...</Text>
      </Card>
    </View>
  );

  const renderResults = () => (
    <View className="flex-1 px-4">
      {/* Question with correct answer */}
      {currentQuestion && (
        <QuestionCard
          questionNumber={currentQuestion.question_index + 1}
          totalQuestions={totalQuestions}
          questionText={currentQuestion.question_text}
          options={currentQuestion.options}
          selectedAnswer={selectedAnswer}
          correctAnswer={correctAnswer}
          onSelectAnswer={() => {}}
          disabled
          showResults
        />
      )}

      {/* Points Earned */}
      <Card
        variant="elevated"
        className={`mt-4 items-center py-4 ${
          playerScore.lastIsCorrect ? "bg-green-50" : "bg-red-50"
        }`}
      >
        <Text className="text-4xl mb-2">
          {playerScore.lastIsCorrect ? "🎉" : "😔"}
        </Text>
        <Text
          className={`text-xl font-bold ${
            playerScore.lastIsCorrect ? "text-green-600" : "text-red-600"
          }`}
        >
          {playerScore.lastIsCorrect
            ? `+${playerScore.lastPointsEarned} points!`
            : "Better luck next time!"}
        </Text>
        {playerScore.currentStreak >= 2 && playerScore.lastIsCorrect && (
          <View className="flex-row items-center mt-2">
            <Zap size={18} color="#F59E0B" />
            <Text className="text-yellow-600 font-semibold ml-1">
              {playerScore.currentStreak}x streak bonus!
            </Text>
          </View>
        )}
      </Card>

      {/* Explanation */}
      {explanation && (
        <Card className="mt-4 bg-blue-50 border border-blue-200">
          <Text className="text-blue-800 font-medium mb-1">Explanation</Text>
          <Text className="text-blue-700">{explanation}</Text>
        </Card>
      )}

      {/* Next question info */}
      <View className="mt-6 items-center">
        <Text className="text-white/60">Next question coming up...</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-primary-600">
      {/* Header */}
      <View className="px-4 py-2 flex-row items-center justify-between">
        <View>
          <Text className="text-white/60 text-sm">Playing as</Text>
          <Text className="text-white font-bold">{nickname}</Text>
        </View>
        <View
          className={`px-3 py-1 rounded-full ${
            isConnected ? "bg-green-500/30" : "bg-red-500/30"
          }`}
        >
          <Text className={isConnected ? "text-green-200" : "text-red-200"}>
            {isConnected ? "Live" : "Reconnecting..."}
          </Text>
        </View>
      </View>

      {phase === "waiting" && renderWaiting()}
      {phase === "question" && renderQuestion()}
      {phase === "submitted" && renderSubmitted()}
      {phase === "results" && renderResults()}
    </SafeAreaView>
  );
}

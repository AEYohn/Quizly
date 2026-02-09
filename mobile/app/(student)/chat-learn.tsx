import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, X } from "lucide-react-native";
import { useConversation } from "@/hooks/conversation/useConversation";
import { ChatBubble } from "@/components/conversation/ChatBubble";
import { InlineQuestionCard } from "@/components/conversation/InlineQuestionCard";
import { ConfidenceSlider } from "@/components/conversation/ConfidenceSlider";
import { MicroLessonCard } from "@/components/conversation/MicroLessonCard";
import { AiThinkingDots } from "@/components/conversation/AiThinkingDots";
import { DiscussionInput } from "@/components/conversation/DiscussionInput";
import { SessionSummarySheet } from "@/components/conversation/SessionSummarySheet";
import { PhaseIndicator } from "@/components/conversation/PhaseIndicator";
import { HintButton } from "@/components/conversation/HintButton";
import { SessionProgressBar } from "@/components/conversation/SessionProgressBar";
import type { ChatMessage } from "@/types/learn";

export default function ChatLearnScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ topic?: string }>();
  const topicParam = Array.isArray(rawParams.topic) ? rawParams.topic[0] : rawParams.topic;
  const {
    sessionId,
    topic,
    phase,
    messages,
    currentQuestion,
    selectedAnswer,
    confidence,
    questionsAnswered,
    correctCount,
    isInDiscussion,
    discussionPhase,
    isLoading,
    isAiThinking,
    setSelectedAnswer,
    setConfidence,
    startConversation,
    submitAnswer,
    sendMessage,
    endConversation,
    reset,
  } = useConversation();

  const flatListRef = useRef<FlatList>(null);
  const [topicInput, setTopicInput] = useState(topicParam || "");
  const [summary, setSummary] = useState<{
    questions_answered: number;
    accuracy: number;
    concepts_covered: string[];
    mastery_updates: Array<{ concept: string; score: number; trend: string }>;
    duration_minutes: number;
  } | null>(null);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
  } | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Setting up your session...");

  // Auto-start if topic provided and no active session
  useEffect(() => {
    if (topicParam && !sessionId && phase === "idle") {
      startConversation(topicParam);
    }
  }, [topicParam]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isAiThinking]);

  // Progressive loading messages during session start
  useEffect(() => {
    if (!isLoading || messages.length > 0) {
      setLoadingMessage("Setting up your session...");
      return;
    }

    const timers = [
      setTimeout(() => setLoadingMessage("Generating your first question..."), 3000),
      setTimeout(() => setLoadingMessage("Almost ready..."), 8000),
      setTimeout(() => setLoadingMessage("Building your learning plan..."), 14000),
      setTimeout(() => setLoadingMessage("This is taking a moment — hang tight!"), 22000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isLoading, messages.length]);

  // Reset hints when a new question arrives
  useEffect(() => {
    setHintsUsed(0);
  }, [currentQuestion?.id]);

  const handleHint = () => {
    if (hintsUsed >= 3) return;
    setHintsUsed((prev) => prev + 1);
    sendMessage("Can you give me a hint?");
  };

  const handleStart = () => {
    const t = topicInput.trim();
    if (!t) return;
    startConversation(t);
  };

  const handleSelectAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    setAnswerResult(null);
  };

  const handleSubmitAnswer = async () => {
    await submitAnswer();
    // The result comes through via store messages — we need to check the last AI message
    // for assessment info. The hook handles this internally.
  };

  const handleEnd = () => {
    Alert.alert("End Session", "End this learning session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: async () => {
          const result = await endConversation();
          if (result) {
            setSummary(result);
          } else {
            router.back();
          }
        },
      },
    ]);
  };

  const handleSummaryClose = () => {
    setSummary(null);
    reset();
    router.back();
  };

  // Pre-session: topic input
  if (!sessionId && phase === "idle" && !isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="p-1 mr-3">
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900">
            AI Tutor
          </Text>
        </View>
        <View className="flex-1 justify-center px-6">
          <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
            What do you want to learn?
          </Text>
          <Text className="text-sm text-gray-500 text-center mb-6">
            Enter any topic and I'll guide you through it with questions and explanations.
          </Text>
          <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
            <TextInput
              value={topicInput}
              onChangeText={setTopicInput}
              placeholder="e.g., Calculus derivatives, Quantum physics..."
              placeholderTextColor="#9CA3AF"
              className="text-base text-gray-900"
              onSubmitEditing={handleStart}
              returnKeyType="go"
              autoFocus
            />
          </View>
          <Pressable
            onPress={handleStart}
            disabled={!topicInput.trim()}
            className={`rounded-xl py-3.5 items-center ${
              topicInput.trim()
                ? "bg-indigo-600 active:bg-indigo-700"
                : "bg-gray-200"
            }`}
          >
            <Text
              className={`font-semibold text-base ${
                topicInput.trim() ? "text-white" : "text-gray-400"
              }`}
            >
              Start Learning
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading && messages.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="text-sm text-gray-500 mt-3">
          {loadingMessage}
        </Text>
      </SafeAreaView>
    );
  }

  // Render a message item
  const renderItem = ({ item }: { item: ChatMessage }) => {
    // If AI message has a lesson, render MicroLesson
    if (item.role === "ai" && item.lesson) {
      return (
        <View>
          <ChatBubble message={item} />
          <MicroLessonCard lesson={item.lesson} onDismiss={() => {}} />
        </View>
      );
    }

    return <ChatBubble message={item} />;
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Summary overlay */}
      {summary && (
        <SessionSummarySheet summary={summary} onClose={handleSummaryClose} />
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <View className="flex-row items-center flex-1">
            <Pressable onPress={() => router.back()} className="p-1 mr-3">
              <ArrowLeft size={22} color="#374151" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                {topic || "AI Tutor"}
              </Text>
              {questionsAnswered > 0 && (
                <Text className="text-xs text-gray-500">
                  {correctCount}/{questionsAnswered} correct
                </Text>
              )}
            </View>
          </View>
          <Pressable onPress={handleEnd} className="p-1.5 bg-gray-100 rounded-full">
            <X size={18} color="#6B7280" />
          </Pressable>
        </View>

        {/* Session progress bar */}
        <SessionProgressBar
          questionsAnswered={questionsAnswered}
          correctCount={correctCount}
          currentConcept={currentQuestion?.concept}
          phase={phase}
        />

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <>
              {/* Inline question card */}
              {currentQuestion && !isInDiscussion && (
                <InlineQuestionCard
                  question={currentQuestion}
                  selectedAnswer={selectedAnswer}
                  result={answerResult}
                  onSelect={handleSelectAnswer}
                />
              )}
              {/* AI thinking dots */}
              {isAiThinking && (
                <AiThinkingDots
                  message={
                    !sessionId ? "Starting session..." :
                    isInDiscussion ? "Preparing a hint..." :
                    currentQuestion && selectedAnswer ? "Checking your answer..." :
                    "Preparing next question..."
                  }
                />
              )}
            </>
          }
        />

        {/* Bottom input area */}
        {phase !== "ended" && (
          <View className="border-t border-gray-100">
            {/* If question mode: confidence slider + submit */}
            {currentQuestion && selectedAnswer && !isInDiscussion && !isAiThinking && (
              <ConfidenceSlider
                value={confidence}
                onChange={setConfidence}
                onSubmit={handleSubmitAnswer}
                disabled={isAiThinking}
              />
            )}

            {/* If discussion mode: phase indicator + hint + text input */}
            {isInDiscussion && !isAiThinking && (
              <View className="border-t border-gray-100">
                {/* Phase indicator + hint */}
                <View className="flex-row items-center justify-between px-4 pt-2">
                  <PhaseIndicator phase={discussionPhase ?? null} />
                  <HintButton
                    onPress={handleHint}
                    hintsUsed={hintsUsed}
                    disabled={isAiThinking}
                  />
                </View>
                <DiscussionInput
                  onSend={sendMessage}
                  disabled={isAiThinking}
                  placeholder="Share your thinking..."
                />
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { View, Text, Pressable, FlatList, Dimensions, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Sparkles } from "lucide-react-native";
import { useRef, useCallback, useState } from "react";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { useHomeScreen } from "@/hooks/feed/useHomeScreen";
import { useActiveFeed } from "@/hooks/feed/useActiveFeed";
import { useHaptics } from "@/hooks/useHaptics";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { CardRenderer } from "@/components/feed/CardRenderer";
import { SocraticHelpSheet } from "@/components/feed/SocraticHelpSheet";
import { SkeletonCard } from "@/components/feed/SkeletonCard";

const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function FeedScreen() {
  const router = useRouter();
  const store = useScrollSessionStore();
  const haptics = useHaptics();
  const { answerStartTime } = useHomeScreen();
  const {
    isPrefetching,
    handleAnswer,
    handleNext,
    handleSkip,
    handleFlashcardRate,
    handleInfoGotIt,
    handleShowAnalytics,
    handleSkipPhase,
    showTuneSheet,
    setShowTuneSheet,
  } = useActiveFeed(answerStartTime);

  const flatListRef = useRef<FlatList>(null);
  const [skipping, runSkip] = useAsyncAction();
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const handleAnalyticsTap = async () => {
    setAnalyticsLoading(true);
    try {
      await handleShowAnalytics();
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const currentCard = store.cards[store.currentIdx];

  // Go back to home / skill tree
  const handleBack = () => {
    store.reset();
    router.navigate("/(student)");
  };

  // Handle help
  const handleHelp = () => {
    haptics.light();
    store.setShowHelp(true);
  };

  // Auto-advance FlatList when card index changes
  const handleNextAndScroll = useCallback(() => {
    handleNext();
    // FlatList will re-render with new card
  }, [handleNext]);

  // No session — shouldn't happen normally
  if (!store.sessionId) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500 mb-4">No active session</Text>
        <Pressable
          onPress={() => router.replace("/(student)")}
          className="bg-indigo-600 rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold">Go Home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Loading state
  if (store.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <View className="items-center gap-4">
          <View className="w-12 h-12 rounded-full bg-indigo-100 items-center justify-center">
            <Sparkles size={24} color="#6366F1" />
          </View>
          <Text className="text-base text-gray-600">
            Loading cards...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Out of cards — show skeleton when prefetching, celebration when truly done
  if (!currentCard) {
    if (store.isLoading || isPrefetching) {
      return (
        <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
          <View className="flex-row items-center px-2">
            <Pressable
              onPress={handleBack}
              className="p-2 rounded-full active:bg-gray-100"
            >
              <ArrowLeft size={22} color="#374151" />
            </Pressable>
            <View className="flex-1">
              <FeedHeader
                stats={store.stats}
                topic={store.topic}
                onSettingsTap={() => setShowTuneSheet(true)}
                onAnalyticsTap={handleAnalyticsTap}
                analyticsLoading={analyticsLoading}
                onSkipPhase={handleSkipPhase}
              />
            </View>
          </View>
          <SkeletonCard />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <View className="items-center gap-4">
          <Text className="text-5xl">🎉</Text>
          <Text className="text-xl font-bold text-gray-900 text-center">
            Great session!
          </Text>
          <Text className="text-sm text-gray-500 text-center">
            You've completed all available cards.{"\n"}
            {store.stats.total_xp} XP earned · {store.stats.best_streak}{" "}
            best streak
          </Text>
          <Pressable
            onPress={handleBack}
            className="bg-indigo-600 rounded-xl px-8 py-3 mt-2 active:bg-indigo-700"
          >
            <Text className="text-white font-semibold">Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Top bar */}
      <View className="flex-row items-center px-2">
        <Pressable
          onPress={handleBack}
          className="p-2 rounded-full active:bg-gray-100"
        >
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <View className="flex-1">
          <FeedHeader
            stats={store.stats}
            topic={store.topic}
            onSettingsTap={() => setShowTuneSheet(true)}
            onAnalyticsTap={handleAnalyticsTap}
            analyticsLoading={analyticsLoading}
          />
        </View>
      </View>

      {/* Card area */}
      <View className="flex-1">
        <CardRenderer
          card={currentCard}
          result={store.result}
          analytics={store.analytics}
          flashcardXp={store.flashcardXp}
          infoAcknowledged={store.infoAcknowledged}
          onAnswer={handleAnswer}
          onNext={handleNextAndScroll}
          onHelp={handleHelp}
          onFlashcardRate={handleFlashcardRate}
          onInfoGotIt={handleInfoGotIt}
        />
      </View>

      {/* Card counter */}
      <View className="px-5 py-2 border-t border-gray-100">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-gray-400">
            Card {store.currentIdx + 1} of {store.cards.length}
          </Text>
          <Pressable
            disabled={skipping}
            onPress={() => runSkip(() => handleSkip())}
          >
            {skipping ? (
              <ActivityIndicator size="small" color="#9CA3AF" />
            ) : (
              <Text className="text-xs text-gray-400 font-medium">Skip</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Socratic Help Sheet */}
      {store.showHelp && currentCard && store.sessionId && (
        <SocraticHelpSheet
          visible={store.showHelp}
          card={currentCard}
          sessionId={store.sessionId}
          onClose={() => store.setShowHelp(false)}
        />
      )}
    </SafeAreaView>
  );
}

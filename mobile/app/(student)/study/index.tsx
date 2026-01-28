import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, PressableCard } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { studentQuizApi, StudentQuiz } from "@/lib/api";
import { BookOpen, Plus, Play, BarChart3 } from "lucide-react-native";

export default function StudyListScreen() {
  const router = useRouter();
  const { getToken, isSignedIn, isGuest } = useAuth();

  const {
    data: quizzes,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["studentQuizzes"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return studentQuizApi.list(token);
    },
    enabled: isSignedIn,
  });

  const handleQuizPress = (quiz: StudentQuiz) => {
    router.push({
      pathname: "/(student)/study/[id]",
      params: { id: quiz.id },
    });
  };

  if (!isSignedIn) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-6">
            <BookOpen size={40} color="#9CA3AF" />
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Sign in to save quizzes
          </Text>
          <Text className="text-gray-500 text-center mb-6">
            Create an account to save your study quizzes and track progress
          </Text>
          <Button onPress={() => router.push("/(auth)/sign-up")}>
            Get Started
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-gray-900">My Quizzes</Text>
        <Button
          size="sm"
          icon={Plus}
          onPress={() => router.push("/(student)/create")}
        >
          Create
        </Button>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-4"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        >
          {quizzes && quizzes.length > 0 ? (
            quizzes.map((quiz) => (
              <PressableCard
                key={quiz.id}
                variant="elevated"
                className="mb-3"
                onPress={() => handleQuizPress(quiz)}
              >
                <View className="flex-row items-start">
                  <View className="w-12 h-12 bg-primary-100 rounded-xl items-center justify-center mr-4">
                    <BookOpen size={24} color="#6366F1" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 mb-1">
                      {quiz.title}
                    </Text>
                    <Text className="text-sm text-gray-500 mb-2">
                      {quiz.question_count} questions
                      {quiz.subject && ` · ${quiz.subject}`}
                    </Text>
                    <View className="flex-row items-center gap-4">
                      <View className="flex-row items-center">
                        <Play size={14} color="#9CA3AF" />
                        <Text className="text-xs text-gray-400 ml-1">
                          {quiz.times_practiced}x practiced
                        </Text>
                      </View>
                      {quiz.best_score !== undefined && (
                        <View className="flex-row items-center">
                          <BarChart3 size={14} color="#9CA3AF" />
                          <Text className="text-xs text-gray-400 ml-1">
                            Best: {quiz.best_score}%
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </PressableCard>
            ))
          ) : (
            <View className="items-center py-12">
              <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
                <BookOpen size={32} color="#9CA3AF" />
              </View>
              <Text className="text-gray-600 font-medium mb-1">
                No quizzes yet
              </Text>
              <Text className="text-gray-400 text-sm text-center mb-4">
                Create your first study quiz with AI
              </Text>
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onPress={() => router.push("/(student)/create")}
              >
                Create Quiz
              </Button>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

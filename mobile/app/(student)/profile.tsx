import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  LogOut,
  Zap,
  Target,
  BookOpen,
  Settings,
  ChevronRight,
  XCircle,
} from "lucide-react-native";
import { useProfile } from "@/hooks/feed/useProfile";
import { CalibrationBadge } from "@/components/profile/CalibrationBadge";
import { CalibrationChart } from "@/components/profile/CalibrationChart";
import { SessionHistoryItem } from "@/components/profile/SessionHistoryItem";
import { QuestionDetailModal } from "@/components/profile/QuestionDetailModal";
import { MathText } from "@/components/common/MathText";
import type { QuestionHistoryItem } from "@/types/learn";

type ProfileTab = "overview" | "history" | "weak";

export default function ProfileScreen() {
  const router = useRouter();
  const {
    studentName,
    initial,
    progress,
    calibration,
    isLoading,
    totalXp,
    totalSessions,
    accuracy,
    level,
    signOut,
    // History
    historySessions,
    historyLoading,
    historyTotal,
    loadHistorySessions,
    loadSessionQuestions,
    sessionQuestions,
    sessionQuestionsLoading,
    // Weak areas
    weakQuestions,
    weakLoading,
    weakTotal,
    loadWeakQuestions,
  } = useProfile();

  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionHistoryItem | null>(null);

  // Load tab data on first switch
  useEffect(() => {
    if (activeTab === "history" && historySessions.length === 0 && !historyLoading) {
      loadHistorySessions(true);
    }
    if (activeTab === "weak" && weakQuestions.length === 0 && !weakLoading) {
      loadWeakQuestions(true);
    }
  }, [activeTab]);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/" as never);
        },
      },
    ]);
  };

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "history", label: "History" },
    { key: "weak", label: "Weak Areas" },
  ];

  // Group weak questions by concept
  const weakByConcept = weakQuestions.reduce(
    (acc, q) => {
      const key = q.concept || "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(q);
      return acc;
    },
    {} as Record<string, QuestionHistoryItem[]>,
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header section — always visible */}
      <View className="items-center pt-6 pb-3 px-5">
        <View className="w-20 h-20 rounded-full bg-indigo-100 items-center justify-center mb-3">
          <Text className="text-3xl font-bold text-indigo-600">
            {initial}
          </Text>
        </View>
        <Text className="text-xl font-bold text-gray-900">
          {studentName}
        </Text>
        <View className="flex-row items-center gap-1 mt-1">
          <View className="bg-indigo-100 px-2.5 py-0.5 rounded-full">
            <Text className="text-xs font-semibold text-indigo-600">
              Level {level}
            </Text>
          </View>
        </View>
        <CalibrationBadge calibration={calibration} />
      </View>

      {/* Stats row */}
      {isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <View className="flex-row px-5 gap-3 mt-1 mb-3">
          <View className="flex-1 bg-indigo-50 rounded-xl p-3 items-center">
            <Zap size={18} color="#6366F1" />
            <Text className="text-lg font-bold text-gray-900 mt-0.5">
              {totalXp}
            </Text>
            <Text className="text-xs text-gray-500">XP</Text>
          </View>
          <View className="flex-1 bg-emerald-50 rounded-xl p-3 items-center">
            <Target size={18} color="#10B981" />
            <Text className="text-lg font-bold text-gray-900 mt-0.5">
              {accuracy}%
            </Text>
            <Text className="text-xs text-gray-500">Accuracy</Text>
          </View>
          <View className="flex-1 bg-amber-50 rounded-xl p-3 items-center">
            <BookOpen size={18} color="#D97706" />
            <Text className="text-lg font-bold text-gray-900 mt-0.5">
              {totalSessions}
            </Text>
            <Text className="text-xs text-gray-500">Sessions</Text>
          </View>
        </View>
      )}

      {/* Tab bar */}
      <View className="flex-row px-5 border-b border-gray-200">
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 items-center py-2.5 ${
              activeTab === tab.key ? "border-b-2 border-indigo-600" : ""
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.key ? "text-indigo-600" : "text-gray-500"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === "overview" && (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 32, paddingTop: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Mastery breakdown */}
            {progress && progress.summary && (
              <View className="px-5 mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-3">
                  Mastery Breakdown
                </Text>
                <View className="gap-2">
                  <View className="flex-row items-center justify-between bg-emerald-50 rounded-xl p-3">
                    <Text className="text-sm text-emerald-700">Mastered</Text>
                    <Text className="text-sm font-semibold text-emerald-700">
                      {progress.summary.mastered}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between bg-yellow-50 rounded-xl p-3">
                    <Text className="text-sm text-yellow-700">In Progress</Text>
                    <Text className="text-sm font-semibold text-yellow-700">
                      {progress.summary.in_progress}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between bg-red-50 rounded-xl p-3">
                    <Text className="text-sm text-red-700">Needs Work</Text>
                    <Text className="text-sm font-semibold text-red-700">
                      {progress.summary.needs_work}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Recent sessions */}
            {progress &&
              progress.recent_sessions &&
              progress.recent_sessions.length > 0 && (
                <View className="px-5">
                  <Text className="text-base font-semibold text-gray-900 mb-3">
                    Recent Sessions
                  </Text>
                  <View className="gap-2">
                    {progress.recent_sessions.slice(0, 5).map((session) => (
                      <View
                        key={session.id}
                        className="bg-gray-50 rounded-xl p-3 flex-row items-center justify-between"
                      >
                        <View className="flex-1">
                          <Text
                            className="text-sm font-medium text-gray-900"
                            numberOfLines={1}
                          >
                            {session.topic}
                          </Text>
                          <Text className="text-xs text-gray-500 mt-0.5">
                            {session.questions_answered} questions ·{" "}
                            {session.accuracy}% accuracy
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <Zap size={12} color="#6366F1" />
                          <Text className="text-xs font-semibold text-indigo-600">
                            {session.questions_correct * 10} XP
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

            {/* Calibration Chart */}
            {calibration?.calibration?.buckets &&
              calibration.calibration.buckets.length > 0 && (
                <View className="mx-5 bg-white rounded-2xl p-4 mb-4 border border-gray-100">
                  <Text className="text-sm font-semibold text-gray-900 mb-3">
                    Confidence Calibration
                  </Text>
                  <CalibrationChart
                    buckets={calibration.calibration.buckets}
                    brierScore={calibration.calibration.brier_score}
                    overconfidenceIndex={
                      calibration.calibration.overconfidence_index
                    }
                    totalResponses={calibration.calibration.total_responses}
                  />
                </View>
              )}

            {/* DK Concepts (from calibration) */}
            {calibration &&
              calibration.dk_concepts.length > 0 && (
                <View className="px-5 mt-6">
                  <Text className="text-base font-semibold text-gray-900 mb-1">
                    Dunning-Kruger Alerts
                  </Text>
                  <Text className="text-xs text-gray-500 mb-3">
                    Concepts where confidence exceeds accuracy
                  </Text>
                  <View className="gap-2">
                    {calibration.dk_concepts.slice(0, 5).map((dk) => (
                      <View
                        key={dk.concept}
                        className="bg-orange-50 border border-orange-200 rounded-xl p-3"
                      >
                        <Text className="text-sm font-medium text-orange-800">
                          {dk.concept}
                        </Text>
                        <Text className="text-xs text-orange-600 mt-0.5">
                          Confidence: {Math.round(dk.avg_confidence * 100)}% · Accuracy: {Math.round(dk.accuracy * 100)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

            {/* Settings + Logout */}
            <View className="px-5 mt-8">
              <Pressable
                onPress={() => router.push("/(student)/settings")}
                className="flex-row items-center py-3 border-b border-gray-100"
              >
                <Settings size={20} color="#6B7280" />
                <Text className="text-base text-gray-700 ml-3 flex-1">
                  Settings
                </Text>
                <ChevronRight size={18} color="#9CA3AF" />
              </Pressable>

              <Pressable
                onPress={handleLogout}
                className="flex-row items-center py-3"
              >
                <LogOut size={20} color="#EF4444" />
                <Text className="text-base text-red-600 ml-3">Sign Out</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {activeTab === "history" && (
          <FlatList
            data={historySessions}
            keyExtractor={(item) => item.session_id}
            contentContainerStyle={{ padding: 20 }}
            renderItem={({ item }) => (
              <SessionHistoryItem
                session={item}
                questions={sessionQuestions[item.session_id]}
                isLoadingQuestions={sessionQuestionsLoading === item.session_id}
                onExpand={loadSessionQuestions}
                onQuestionTap={setSelectedQuestion}
              />
            )}
            onEndReached={() => {
              if (
                !historyLoading &&
                historySessions.length < historyTotal
              ) {
                loadHistorySessions(false);
              }
            }}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              historyLoading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="large" color="#6366F1" />
                </View>
              ) : (
                <View className="py-8 items-center">
                  <Text className="text-sm text-gray-400">
                    No question history yet
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              historyLoading && historySessions.length > 0 ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#6366F1" />
                </View>
              ) : null
            }
          />
        )}

        {activeTab === "weak" && (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {weakLoading && weakQuestions.length === 0 ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="large" color="#6366F1" />
              </View>
            ) : weakQuestions.length === 0 ? (
              <View className="py-8 items-center">
                <Text className="text-sm text-gray-400">
                  No incorrect answers yet — keep it up!
                </Text>
              </View>
            ) : (
              Object.entries(weakByConcept).map(([concept, questions]) => (
                <View key={concept} className="mb-5">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="bg-red-50 px-2.5 py-0.5 rounded-full">
                      <Text className="text-xs font-medium text-red-600">
                        {concept}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-400">
                      {questions.length} wrong
                    </Text>
                  </View>
                  <View className="gap-1.5">
                    {questions.map((q) => (
                      <Pressable
                        key={q.id}
                        onPress={() => setSelectedQuestion(q)}
                        className="flex-row items-center bg-gray-50 rounded-lg p-3 active:bg-gray-100"
                      >
                        <XCircle size={14} color="#EF4444" />
                        <View className="flex-1 ml-2">
                          <MathText
                            text={q.prompt}
                            style={{ fontSize: 13, color: "#374151" }}
                          />
                        </View>
                        <ChevronRight size={14} color="#D1D5DB" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))
            )}
            {weakQuestions.length > 0 &&
              weakQuestions.length < weakTotal &&
              !weakLoading && (
                <Pressable
                  onPress={() => loadWeakQuestions(false)}
                  className="bg-gray-100 rounded-xl py-3 items-center mt-2"
                >
                  <Text className="text-sm font-medium text-gray-600">
                    Load more
                  </Text>
                </Pressable>
              )}
            {weakLoading && weakQuestions.length > 0 && (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Question detail modal */}
      <QuestionDetailModal
        question={selectedQuestion}
        onClose={() => setSelectedQuestion(null)}
      />
    </SafeAreaView>
  );
}

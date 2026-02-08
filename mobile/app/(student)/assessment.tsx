import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, Zap } from "lucide-react-native";
import { assessmentApi } from "@/lib/learnApi";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { useAuth } from "@/providers/AuthProvider";
import type {
  AssessmentStartResponse,
  AssessmentSelfRatingsResponse,
} from "@/types/learn";
import { useHaptics } from "@/hooks/useHaptics";

const RATING_LABELS = [
  { value: 1, label: "Never heard of it", color: "bg-red-50 border-red-200" },
  { value: 2, label: "Heard of it", color: "bg-orange-50 border-orange-200" },
  { value: 3, label: "Somewhat familiar", color: "bg-yellow-50 border-yellow-200" },
  { value: 4, label: "Can explain it", color: "bg-emerald-50 border-emerald-200" },
  { value: 5, label: "Can teach it", color: "bg-cyan-50 border-cyan-200" },
];

export default function AssessmentScreen() {
  const router = useRouter();
  const store = useScrollSessionStore();
  const auth = useAuth();
  const haptics = useHaptics();

  const [phase, setPhase] = useState<"loading" | "self_rating" | "diagnostic" | "complete">("loading");
  const [assessmentData, setAssessmentData] = useState<AssessmentStartResponse | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [diagnosticData, setDiagnosticData] = useState<AssessmentSelfRatingsResponse | null>(null);
  const [currentDiagIdx, setCurrentDiagIdx] = useState(0);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Array<{ concept: string; answer: string; correct_answer: string; time_ms: number }>>([]);
  const [diagStartTime, setDiagStartTime] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  const studentName = auth.nickname || "Student";
  const subject = store.selectedSubject;

  // Start assessment
  useEffect(() => {
    if (!subject) return;
    assessmentApi.start(subject, studentName).then((res) => {
      if (res.success && res.data) {
        setAssessmentData(res.data);
        setPhase("self_rating");
      } else {
        setError(res.error ?? "Failed to start assessment");
      }
    });
  }, [subject, studentName]);

  const handleRate = (concept: string, rating: number) => {
    haptics.light();
    setRatings((prev) => ({ ...prev, [concept]: rating }));
  };

  const handleSubmitRatings = async () => {
    if (!subject || !assessmentData) return;
    const ratingArray = assessmentData.self_rating_items.map((item) => ({
      concept: item.concept,
      rating: ratings[item.concept] ?? 3,
    }));

    const res = await assessmentApi.submitSelfRatings(subject, studentName, ratingArray);
    if (res.success && res.data) {
      if (res.data.diagnostic_questions.length > 0) {
        setDiagnosticData(res.data);
        setDiagStartTime(Date.now());
        setPhase("diagnostic");
      } else {
        setPhase("complete");
      }
    } else {
      setError(res.error ?? "Failed to submit ratings");
    }
  };

  const handleDiagnosticAnswer = async (answer: string) => {
    if (!diagnosticData) return;
    haptics.light();
    const q = diagnosticData.diagnostic_questions[currentDiagIdx] as any;
    const timeMs = Date.now() - diagStartTime;
    const newAnswer = {
      concept: q.concept || "",
      answer,
      correct_answer: q.correct_answer || "",
      time_ms: timeMs,
    };
    const updatedAnswers = [...diagnosticAnswers, newAnswer];
    setDiagnosticAnswers(updatedAnswers);

    if (currentDiagIdx + 1 < diagnosticData.diagnostic_questions.length) {
      setCurrentDiagIdx((prev) => prev + 1);
      setDiagStartTime(Date.now());
    } else {
      // Submit all answers
      const res = await assessmentApi.submitDiagnostic(
        studentName,
        diagnosticData.assessment_id,
        updatedAnswers,
      );
      if (res.success) {
        store.setAssessmentPhase("complete");
        setPhase("complete");
      } else {
        setError(res.error ?? "Failed to submit diagnostic");
      }
    }
  };

  if (phase === "loading") {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        {error ? (
          <View className="items-center gap-4 px-6">
            <Text className="text-red-600 text-center">{error}</Text>
            <Pressable onPress={() => router.navigate("/(student)/skill-tree")} className="bg-indigo-600 rounded-xl px-6 py-3">
              <Text className="text-white font-semibold">Go Back</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator size="large" color="#6366F1" />
        )}
      </SafeAreaView>
    );
  }

  if (phase === "complete") {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <CheckCircle2 size={48} color="#10B981" />
        <Text className="text-xl font-bold text-gray-900 mt-4">
          Assessment Complete!
        </Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          Your mastery map has been updated based on your responses.
        </Text>
        <Pressable
          onPress={() => router.navigate("/(student)/skill-tree")}
          className="bg-indigo-600 rounded-xl px-8 py-3 mt-6 active:bg-indigo-700"
        >
          <Text className="text-white font-semibold">Back to Skill Tree</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === "self_rating" && assessmentData) {
    const allRated = assessmentData.self_rating_items.every(
      (item) => ratings[item.concept] !== undefined,
    );

    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <Pressable onPress={() => router.navigate("/(student)/skill-tree")} className="p-2 mr-2">
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <View>
            <Text className="text-lg font-semibold text-gray-900">
              Self Assessment
            </Text>
            <Text className="text-xs text-gray-500">
              Rate your familiarity with each concept
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          {assessmentData.self_rating_items.map((item, idx) => (
            <View key={item.concept} className="mb-4">
              <Text className="text-sm font-medium text-gray-900 mb-2">
                {item.concept}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {RATING_LABELS.map((r) => (
                  <Pressable
                    key={r.value}
                    onPress={() => handleRate(item.concept, r.value)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      ratings[item.concept] === r.value
                        ? r.color
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <Text className="text-xs font-medium text-gray-700">
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          <Pressable
            onPress={handleSubmitRatings}
            disabled={!allRated}
            className={`rounded-xl py-3 items-center mb-8 ${
              allRated ? "bg-indigo-600 active:bg-indigo-700" : "bg-gray-200"
            }`}
          >
            <Text className={`font-semibold ${allRated ? "text-white" : "text-gray-400"}`}>
              Continue
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "diagnostic" && diagnosticData) {
    const q = diagnosticData.diagnostic_questions[currentDiagIdx] as any;
    if (!q) return null;

    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <Pressable onPress={() => router.navigate("/(student)/skill-tree")} className="p-2 mr-2">
            <ArrowLeft size={22} color="#374151" />
          </Pressable>
          <View>
            <Text className="text-lg font-semibold text-gray-900">
              Diagnostic
            </Text>
            <Text className="text-xs text-gray-500">
              Question {currentDiagIdx + 1} of{" "}
              {diagnosticData.diagnostic_questions.length}
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          <Text className="text-base font-medium text-gray-900 mb-4 leading-6">
            {q.prompt || q.question}
          </Text>
          <View className="gap-2">
            {(q.options as string[])?.map((option: string, idx: number) => {
              const letter = option.match(/^([A-D])[.)]\s*/)?.[1] ?? String.fromCharCode(65 + idx);
              const text = option.replace(/^[A-D][.)]\s*/, "");
              return (
                <Pressable
                  key={idx}
                  onPress={() => handleDiagnosticAnswer(letter)}
                  className="flex-row items-center border border-gray-200 rounded-xl p-4 active:bg-indigo-50 active:border-indigo-300"
                >
                  <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3">
                    <Text className="text-sm font-semibold text-gray-500">
                      {letter}
                    </Text>
                  </View>
                  <Text className="flex-1 text-base text-gray-800">
                    {text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Progress bar */}
        <View className="px-5 py-3 border-t border-gray-100">
          <View className="bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <View
              className="bg-indigo-500 h-full rounded-full"
              style={{
                width: `${((currentDiagIdx + 1) / diagnosticData.diagnostic_questions.length) * 100}%`,
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

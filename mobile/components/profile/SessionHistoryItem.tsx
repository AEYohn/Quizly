import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react-native";
import { MathText } from "@/components/common/MathText";
import type { QuestionHistorySession, QuestionHistoryItem } from "@/types/learn";

interface SessionHistoryItemProps {
  session: QuestionHistorySession;
  questions: QuestionHistoryItem[] | undefined;
  isLoadingQuestions: boolean;
  onExpand: (sessionId: string) => void;
  onQuestionTap: (question: QuestionHistoryItem) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionHistoryItem({
  session,
  questions,
  isLoadingQuestions,
  onExpand,
  onQuestionTap,
}: SessionHistoryItemProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    if (!expanded && !questions) {
      onExpand(session.session_id);
    }
    setExpanded((prev) => !prev);
  };

  return (
    <View className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      <Pressable
        onPress={handleToggle}
        className="flex-row items-center p-3 active:bg-gray-50"
      >
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
            {session.topic}
          </Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <Text className="text-xs text-gray-500">
              {session.questions_answered} Qs
            </Text>
            <Text className="text-xs text-gray-400">·</Text>
            <Text
              className={`text-xs font-medium ${
                session.accuracy >= 70 ? "text-emerald-600" : session.accuracy >= 40 ? "text-amber-600" : "text-red-600"
              }`}
            >
              {session.accuracy}%
            </Text>
            <Text className="text-xs text-gray-400">·</Text>
            <Text className="text-xs text-gray-400">
              {formatDate(session.started_at)}
            </Text>
          </View>
        </View>
        {expanded ? (
          <ChevronUp size={18} color="#9CA3AF" />
        ) : (
          <ChevronDown size={18} color="#9CA3AF" />
        )}
      </Pressable>

      {expanded && (
        <View className="border-t border-gray-100 px-3 pb-2">
          {isLoadingQuestions ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          ) : questions && questions.length > 0 ? (
            questions.map((q) => (
              <Pressable
                key={q.id}
                onPress={() => onQuestionTap(q)}
                className="flex-row items-center py-2.5 border-b border-gray-50 active:bg-gray-50"
              >
                {q.is_correct ? (
                  <CheckCircle2 size={16} color="#10B981" />
                ) : (
                  <XCircle size={16} color="#EF4444" />
                )}
                <View className="flex-1 ml-2">
                  <MathText
                    text={q.prompt}
                    style={{ fontSize: 13, color: "#374151" }}
                  />
                </View>
              </Pressable>
            ))
          ) : (
            <Text className="text-xs text-gray-400 py-3 text-center">
              No questions recorded
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

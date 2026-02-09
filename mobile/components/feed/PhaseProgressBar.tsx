import { View, Text, Pressable } from "react-native";
import { BookOpen, Layers, Brain, Check, ChevronRight } from "lucide-react-native";

interface PhaseProgressBarProps {
  phase: "learn" | "flashcards" | "quiz" | "mixed";
  progress?: { current: number; total: number; label: string };
  onSkip?: (targetPhase: string) => void;
}

const PHASES = [
  { key: "learn", label: "Learn", Icon: BookOpen },
  { key: "flashcards", label: "Memorize", Icon: Layers },
  { key: "quiz", label: "Quiz", Icon: Brain },
] as const;

export function PhaseProgressBar({ phase, progress, onSkip }: PhaseProgressBarProps) {
  const currentIdx = PHASES.findIndex((p) => p.key === phase);
  const progressPct = progress ? Math.min(100, Math.round((progress.current / Math.max(1, progress.total)) * 100)) : 0;

  return (
    <View className="px-4 py-2 bg-white border-b border-gray-100">
      {/* Phase segments */}
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-row items-center gap-1 flex-1">
          {PHASES.map((p, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const Icon = p.Icon;

            return (
              <View key={p.key} className="flex-row items-center">
                <View
                  className={`flex-row items-center gap-1 px-2 py-1 rounded-full ${
                    isCurrent
                      ? "bg-indigo-100"
                      : isCompleted
                        ? "bg-emerald-50"
                        : "bg-gray-50"
                  }`}
                >
                  {isCompleted ? (
                    <Check size={12} color="#10B981" />
                  ) : (
                    <Icon
                      size={12}
                      color={isCurrent ? "#6366F1" : "#9CA3AF"}
                    />
                  )}
                  <Text
                    className={`text-[10px] font-semibold ${
                      isCurrent
                        ? "text-indigo-600"
                        : isCompleted
                          ? "text-emerald-600"
                          : "text-gray-400"
                    }`}
                  >
                    {p.label}
                  </Text>
                </View>
                {idx < PHASES.length - 1 && (
                  <ChevronRight size={10} color="#D1D5DB" style={{ marginHorizontal: 2 }} />
                )}
              </View>
            );
          })}
        </View>

        {/* Skip button */}
        {onSkip && phase !== "quiz" && (
          <Pressable
            onPress={() => onSkip(phase === "learn" ? "flashcards" : "quiz")}
            className="px-2 py-1 active:opacity-60"
          >
            <Text className="text-[10px] font-medium text-indigo-500">
              Skip {phase === "learn" ? "to Quiz" : "to Quiz"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Progress bar within current segment */}
      {progress && (
        <View className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </View>
      )}
    </View>
  );
}

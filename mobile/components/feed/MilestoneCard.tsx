import { View, Text, Pressable } from "react-native";
import { Trophy, Flame, ArrowRight, BookOpen, Layers, Brain } from "lucide-react-native";
import { useHaptics } from "@/hooks/useHaptics";
import type { ScrollCard } from "@/types/learn";

interface MilestoneCardProps {
  card: ScrollCard;
  onNext: () => void;
}

const PHASE_ICONS = {
  learn: { Icon: BookOpen, color: "#6366F1", bg: "bg-indigo-100" },
  flashcards: { Icon: Layers, color: "#8B5CF6", bg: "bg-violet-100" },
  quiz: { Icon: Brain, color: "#EC4899", bg: "bg-pink-100" },
} as const;

export function MilestoneCard({ card, onNext }: MilestoneCardProps) {
  const haptics = useHaptics();
  const isMastery = card.milestone_type === "concept_mastered";
  const isPhaseTransition = card.milestone_type === "phase_transition";
  const stats = card.milestone_stats;

  const accuracyMessage = () => {
    const acc = stats?.accuracy ?? 0;
    if (acc >= 80) return "great work!";
    if (acc >= 60) return "keep it up!";
    return "you're getting there!";
  };

  // Phase transition variant
  if (isPhaseTransition) {
    const toPhase = (card.to_phase ?? "quiz") as keyof typeof PHASE_ICONS;
    const phaseInfo = PHASE_ICONS[toPhase] ?? PHASE_ICONS.quiz;
    const PhaseIcon = phaseInfo.Icon;
    const ctaLabels: Record<string, string> = {
      flashcards: "Start Flashcards",
      quiz: "Start Quiz",
    };

    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className={`w-16 h-16 rounded-2xl items-center justify-center mb-5 ${phaseInfo.bg}`}>
          <PhaseIcon size={32} color={phaseInfo.color} />
        </View>

        <Text className="text-xl font-bold text-gray-900 text-center mb-2">
          {card.milestone_message || "Phase complete!"}
        </Text>

        <Text className="text-sm text-gray-500 text-center mb-6 max-w-[260px]">
          Great progress! Ready for the next step.
        </Text>

        <Pressable
          onPress={() => {
            haptics.medium();
            onNext();
          }}
          className={`flex-row items-center gap-2 px-6 py-3 rounded-xl ${phaseInfo.bg} active:opacity-80`}
        >
          <Text className="font-semibold text-sm" style={{ color: phaseInfo.color }}>
            {ctaLabels[toPhase] ?? "Continue"}
          </Text>
          <ArrowRight size={16} color={phaseInfo.color} />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-6">
      {/* Icon */}
      <View
        className={`w-16 h-16 rounded-2xl items-center justify-center mb-5 ${
          isMastery ? "bg-amber-100" : "bg-violet-100"
        }`}
      >
        {isMastery ? (
          <Trophy size={32} color="#F59E0B" />
        ) : (
          <Flame size={32} color="#8B5CF6" />
        )}
      </View>

      {/* Headline */}
      <Text className="text-xl font-bold text-gray-900 text-center mb-2">
        {isMastery
          ? `You mastered ${card.milestone_concept}!`
          : `${stats?.cards_answered ?? 0} cards done!`}
      </Text>

      {/* Subtext */}
      <Text className="text-sm text-gray-500 text-center mb-6 max-w-[260px]">
        {isMastery
          ? `${stats?.concepts_mastered ?? 0} of ${stats?.total_concepts ?? 0} concepts mastered`
          : stats?.accuracy !== undefined
            ? `${stats.accuracy}% accuracy — ${accuracyMessage()}`
            : "Keep going!"}
      </Text>

      {/* CTA */}
      <Pressable
        onPress={() => {
          haptics.medium();
          onNext();
        }}
        className={`flex-row items-center gap-2 px-6 py-3 rounded-xl ${
          isMastery ? "bg-amber-100" : "bg-violet-100"
        } active:opacity-80`}
      >
        <Text
          className={`font-semibold text-sm ${
            isMastery ? "text-amber-700" : "text-violet-700"
          }`}
        >
          Keep Going
        </Text>
        <ArrowRight size={16} color={isMastery ? "#B45309" : "#6D28D9"} />
      </Pressable>
    </View>
  );
}

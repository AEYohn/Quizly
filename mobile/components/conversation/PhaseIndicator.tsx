import { View, Text } from "react-native";

interface PhaseIndicatorProps {
  phase: string | null;
}

const phases: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  probing: { label: "Exploring your thinking", dotColor: "#38BDF8", bgColor: "bg-sky-50", textColor: "text-sky-600" },
  hinting: { label: "Giving hints", dotColor: "#FBBF24", bgColor: "bg-amber-50", textColor: "text-amber-600" },
  guiding: { label: "Guiding you", dotColor: "#A78BFA", bgColor: "bg-violet-50", textColor: "text-violet-600" },
  targeted: { label: "Addressing misconception", dotColor: "#FB923C", bgColor: "bg-orange-50", textColor: "text-orange-600" },
  explaining: { label: "Explaining", dotColor: "#34D399", bgColor: "bg-emerald-50", textColor: "text-emerald-600" },
  clarifying: { label: "Clarifying", dotColor: "#60A5FA", bgColor: "bg-blue-50", textColor: "text-blue-600" },
};

export function PhaseIndicator({ phase }: PhaseIndicatorProps) {
  if (!phase) return null;
  const info = phases[phase] ?? { label: phase, dotColor: "#9CA3AF", bgColor: "bg-gray-50", textColor: "text-gray-600" };

  return (
    <View className={`flex-row items-center px-2.5 py-1 rounded-full ${info.bgColor}`}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: info.dotColor, marginRight: 6 }} />
      <Text className={`text-xs font-medium ${info.textColor}`}>{info.label}</Text>
    </View>
  );
}

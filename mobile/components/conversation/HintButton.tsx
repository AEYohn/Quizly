import { Text, Pressable } from "react-native";
import { Lightbulb } from "lucide-react-native";

interface HintButtonProps {
  onPress: () => void;
  hintsUsed: number;
  maxHints?: number;
  disabled?: boolean;
}

export function HintButton({ onPress, hintsUsed, maxHints = 3, disabled }: HintButtonProps) {
  const remaining = maxHints - hintsUsed;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || remaining <= 0}
      className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg border ${
        remaining > 0 && !disabled
          ? "bg-amber-50 border-amber-200 active:bg-amber-100"
          : "bg-gray-50 border-gray-200 opacity-40"
      }`}
    >
      <Lightbulb size={14} color={remaining > 0 ? "#D97706" : "#9CA3AF"} />
      <Text className={`text-xs font-medium ${remaining > 0 ? "text-amber-700" : "text-gray-400"}`}>
        Hint ({remaining} left)
      </Text>
    </Pressable>
  );
}

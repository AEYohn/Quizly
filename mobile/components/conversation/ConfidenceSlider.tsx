import { View, Text, Pressable } from "react-native";

interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const LEVELS = [
  { value: 20, label: "Guessing", color: "#EF4444" },
  { value: 40, label: "Unsure", color: "#F97316" },
  { value: 60, label: "Somewhat", color: "#EAB308" },
  { value: 80, label: "Pretty Sure", color: "#10B981" },
  { value: 100, label: "Very Sure", color: "#06B6D4" },
];

export function ConfidenceSlider({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: ConfidenceSliderProps) {
  const selectedLevel = LEVELS.reduce((closest, level) =>
    Math.abs(level.value - value) < Math.abs(closest.value - value)
      ? level
      : closest,
  );

  return (
    <View className="px-4 pb-2">
      <Text className="text-xs text-gray-500 text-center mb-2">
        How confident are you?
      </Text>

      {/* Confidence buttons */}
      <View className="flex-row gap-1.5 mb-3">
        {LEVELS.map((level) => {
          const isSelected = level.value === selectedLevel.value;
          return (
            <Pressable
              key={level.value}
              onPress={() => onChange(level.value)}
              disabled={disabled}
              className={`flex-1 items-center py-2 rounded-lg border ${
                isSelected ? "border-2" : "border"
              }`}
              style={{
                borderColor: isSelected ? level.color : "#E5E7EB",
                backgroundColor: isSelected ? level.color + "15" : "#FFFFFF",
              }}
            >
              <Text
                style={{ color: isSelected ? level.color : "#6B7280" }}
                className="text-xs font-medium"
              >
                {level.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Submit button */}
      <Pressable
        onPress={onSubmit}
        disabled={disabled}
        className={`rounded-xl py-3 items-center ${
          disabled ? "bg-gray-200" : "bg-indigo-600 active:bg-indigo-700"
        }`}
      >
        <Text
          className={`font-semibold ${disabled ? "text-gray-400" : "text-white"}`}
        >
          Submit Answer
        </Text>
      </Pressable>
    </View>
  );
}

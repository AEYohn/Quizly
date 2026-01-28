import { View, Text, Pressable } from "react-native";
import { useState } from "react";

interface ConfidenceSliderProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
}

const CONFIDENCE_LEVELS = [
  { level: 1, label: "Guessing", emoji: "🤷", color: "bg-gray-400" },
  { level: 2, label: "Not sure", emoji: "🤔", color: "bg-yellow-400" },
  { level: 3, label: "Pretty sure", emoji: "😊", color: "bg-blue-400" },
  { level: 4, label: "Certain", emoji: "😎", color: "bg-green-500" },
];

export function ConfidenceSlider({
  value,
  onChange,
  disabled = false,
}: ConfidenceSliderProps) {
  const selectedLevel = CONFIDENCE_LEVELS.find((l) => l.level === value);

  return (
    <View className="w-full">
      <Text className="text-center text-gray-600 text-sm mb-3">
        How confident are you?
      </Text>

      <View className="flex-row justify-between gap-2">
        {CONFIDENCE_LEVELS.map((level) => {
          const isSelected = value === level.level;

          return (
            <Pressable
              key={level.level}
              onPress={() => !disabled && onChange(level.level)}
              className={`
                flex-1 py-3 rounded-xl items-center justify-center
                ${isSelected ? level.color : "bg-gray-100"}
                ${disabled ? "opacity-50" : "active:scale-95"}
              `}
            >
              <Text className="text-2xl mb-1">{level.emoji}</Text>
              <Text
                className={`
                  text-xs font-medium
                  ${isSelected ? "text-white" : "text-gray-600"}
                `}
              >
                {level.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedLevel && (
        <View className="mt-3 items-center">
          <View className={`px-4 py-2 rounded-full ${selectedLevel.color}`}>
            <Text className="text-white font-semibold">
              {selectedLevel.emoji} {selectedLevel.label}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

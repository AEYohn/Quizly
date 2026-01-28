import { View, Text } from "react-native";
import { useEffect, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface TimerBarProps {
  timeRemaining: number;
  totalTime: number;
  onTimeUp?: () => void;
}

export function TimerBar({ timeRemaining, totalTime, onTimeUp }: TimerBarProps) {
  const progress = useSharedValue(timeRemaining / totalTime);
  const [displayTime, setDisplayTime] = useState(timeRemaining);

  useEffect(() => {
    setDisplayTime(timeRemaining);
    progress.value = withTiming(timeRemaining / totalTime, {
      duration: 100,
      easing: Easing.linear,
    });

    if (timeRemaining <= 0) {
      onTimeUp?.();
    }
  }, [timeRemaining, totalTime, onTimeUp, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  const getColor = () => {
    const ratio = timeRemaining / totalTime;
    if (ratio > 0.5) return "bg-green-500";
    if (ratio > 0.25) return "bg-yellow-500";
    return "bg-red-500";
  };

  const isUrgent = timeRemaining <= 5;

  return (
    <View className="w-full">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-gray-600 font-medium">Time</Text>
        <View
          className={`
            px-3 py-1 rounded-full
            ${isUrgent ? "bg-red-100" : "bg-gray-100"}
          `}
        >
          <Text
            className={`
              font-bold text-lg
              ${isUrgent ? "text-red-600" : "text-gray-800"}
            `}
          >
            {displayTime}s
          </Text>
        </View>
      </View>
      <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <Animated.View
          style={animatedStyle}
          className={`h-full rounded-full ${getColor()}`}
        />
      </View>
    </View>
  );
}

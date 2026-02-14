import { View, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

interface AiThinkingDotsProps {
  message?: string;
}

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#9CA3AF", marginHorizontal: 2 }, style]}
    />
  );
}

export function AiThinkingDots({ message = "Thinking..." }: AiThinkingDotsProps) {
  return (
    <View className="self-start ml-2 mb-3">
      <View className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <View className="flex-row items-center">
          <Dot delay={0} />
          <Dot delay={150} />
          <Dot delay={300} />
        </View>
      </View>
      <Text className="text-xs text-gray-400 mt-1 ml-1">{message}</Text>
    </View>
  );
}

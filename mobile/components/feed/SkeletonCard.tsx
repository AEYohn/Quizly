import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

function Shimmer({ style }: { style?: object }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[{ backgroundColor: "#E5E7EB", borderRadius: 8 }, style, animStyle]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View className="flex-1 bg-white px-5 pt-4 pb-6">
      {/* Concept badge placeholder */}
      <View className="flex-row items-center gap-2 mb-4">
        <Shimmer style={{ width: 80, height: 24, borderRadius: 12 }} />
      </View>

      {/* Question text placeholder */}
      <View className="mb-6">
        <Shimmer style={{ width: "100%", height: 20, marginBottom: 8 }} />
        <Shimmer style={{ width: "85%", height: 20, marginBottom: 8 }} />
        <Shimmer style={{ width: "70%", height: 20 }} />
      </View>

      {/* Option placeholders */}
      <View className="gap-3">
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className="flex-row items-center border border-gray-100 rounded-xl p-4"
          >
            <Shimmer
              style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12 }}
            />
            <Shimmer style={{ flex: 1, height: 18 }} />
          </View>
        ))}
      </View>

      {/* Button placeholder */}
      <View className="mt-5">
        <Shimmer style={{ width: "100%", height: 48, borderRadius: 12 }} />
      </View>
    </View>
  );
}

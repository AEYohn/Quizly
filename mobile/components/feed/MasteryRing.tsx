import { View, Text } from "react-native";

export function MasteryRing({ mastery, size = 40 }: { mastery: number; size?: number }) {
  const color =
    mastery >= 80
      ? "#10B981"
      : mastery >= 40
        ? "#EAB308"
        : mastery > 0
          ? "#6366F1"
          : "#D1D5DB";

  return (
    <View
      style={{ width: size, height: size }}
      className="rounded-full items-center justify-center"
    >
      {/* Background ring */}
      <View
        style={{ width: size, height: size, borderColor: "#E5E7EB", borderWidth: 3 }}
        className="rounded-full absolute"
      />
      {/* Progress ring (simplified — colored border) */}
      <View
        style={{
          width: size,
          height: size,
          borderColor: color,
          borderWidth: 3,
          borderTopColor: mastery < 100 ? "#E5E7EB" : color,
          borderRightColor: mastery < 75 ? "#E5E7EB" : color,
          borderBottomColor: mastery < 50 ? "#E5E7EB" : color,
          borderLeftColor: mastery < 25 ? "#E5E7EB" : color,
        }}
        className="rounded-full absolute"
      />
      <Text style={{ color, fontSize: size * 0.28 }} className="font-bold">
        {mastery}%
      </Text>
    </View>
  );
}

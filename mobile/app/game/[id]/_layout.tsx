import { Stack } from "expo-router";

export default function GameLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="lobby" />
      <Stack.Screen name="play" />
      <Stack.Screen name="summary" />
    </Stack>
  );
}

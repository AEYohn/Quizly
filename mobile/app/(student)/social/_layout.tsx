import { Stack } from 'expo-router';

export default function SocialLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="search" />
      <Stack.Screen name="groups" />
    </Stack>
  );
}

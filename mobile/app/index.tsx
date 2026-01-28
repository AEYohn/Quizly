import { Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Only signed-in users go to student dashboard
  if (isSignedIn) {
    return <Redirect href="/(student)" />;
  }

  // Guests and unauthenticated users go to auth flow
  return <Redirect href="/(auth)" />;
}

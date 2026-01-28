import { Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { isLoaded, isSignedIn, isGuest } = useAuth();

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // If signed in or guest, go to student dashboard
  if (isSignedIn || isGuest) {
    return <Redirect href="/(student)" />;
  }

  // Otherwise, go to auth flow
  return <Redirect href="/(auth)" />;
}

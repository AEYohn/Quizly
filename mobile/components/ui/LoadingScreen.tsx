import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({
  message = "Loading...",
  fullScreen = true,
}: LoadingScreenProps) {
  const Container = fullScreen ? SafeAreaView : View;

  return (
    <Container className="flex-1 bg-white items-center justify-center">
      <ActivityIndicator size="large" color="#6366F1" />
      <Text className="text-gray-500 mt-4 font-medium">{message}</Text>
    </Container>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/50 items-center justify-center z-50">
      <View className="bg-white rounded-2xl p-6 items-center mx-8">
        <ActivityIndicator size="large" color="#6366F1" />
        {message && (
          <Text className="text-gray-700 mt-4 font-medium text-center">
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}

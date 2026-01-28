import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertCircle, RefreshCw, Home } from "lucide-react-native";
import { Button } from "./Button";

interface ErrorScreenProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  fullScreen?: boolean;
}

export function ErrorScreen({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  onGoHome,
  fullScreen = true,
}: ErrorScreenProps) {
  const Container = fullScreen ? SafeAreaView : View;

  return (
    <Container className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-20 h-20 bg-error-50 rounded-full items-center justify-center mb-6">
        <AlertCircle size={40} color="#EF4444" />
      </View>

      <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
        {title}
      </Text>

      <Text className="text-gray-500 text-center mb-8 max-w-sm">{message}</Text>

      <View className="w-full max-w-xs gap-3">
        {onRetry && (
          <Button fullWidth icon={RefreshCw} onPress={onRetry}>
            Try Again
          </Button>
        )}

        {onGoHome && (
          <Button
            fullWidth
            variant={onRetry ? "outline" : "primary"}
            icon={Home}
            onPress={onGoHome}
          >
            Go Home
          </Button>
        )}
      </View>
    </Container>
  );
}

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <View className="bg-error-50 border border-error-200 rounded-xl p-4 mx-4 my-2">
      <View className="flex-row items-start">
        <AlertCircle size={20} color="#EF4444" />
        <View className="flex-1 ml-3">
          <Text className="text-error-700 font-medium">{message}</Text>
          {(onRetry || onDismiss) && (
            <View className="flex-row mt-2 gap-4">
              {onRetry && (
                <Text
                  className="text-error-600 font-semibold"
                  onPress={onRetry}
                >
                  Retry
                </Text>
              )}
              {onDismiss && (
                <Text
                  className="text-gray-500 font-medium"
                  onPress={onDismiss}
                >
                  Dismiss
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

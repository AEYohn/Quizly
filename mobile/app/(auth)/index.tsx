import { View, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { Gamepad2, BookOpen, Sparkles } from "lucide-react-native";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-between py-8">
        {/* Logo & Welcome */}
        <View className="items-center mt-8">
          <View className="w-24 h-24 bg-primary-500 rounded-3xl items-center justify-center mb-6">
            <Text className="text-5xl">📚</Text>
          </View>
          <Text className="text-4xl font-bold text-gray-900 mb-2">
            Quizly
          </Text>
          <Text className="text-lg text-gray-500 text-center">
            Learn smarter, play harder
          </Text>
        </View>

        {/* Features */}
        <View className="gap-4">
          <View className="flex-row items-center bg-primary-50 p-4 rounded-xl">
            <View className="w-12 h-12 bg-primary-100 rounded-xl items-center justify-center mr-4">
              <Gamepad2 size={24} color="#6366F1" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                Join Live Games
              </Text>
              <Text className="text-sm text-gray-500">
                Enter a code to play with your class
              </Text>
            </View>
          </View>

          <View className="flex-row items-center bg-success-50 p-4 rounded-xl">
            <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center mr-4">
              <BookOpen size={24} color="#22C55E" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                Create Study Quizzes
              </Text>
              <Text className="text-sm text-gray-500">
                Use AI to generate from any topic
              </Text>
            </View>
          </View>

          <View className="flex-row items-center bg-warning-50 p-4 rounded-xl">
            <View className="w-12 h-12 bg-yellow-100 rounded-xl items-center justify-center mr-4">
              <Sparkles size={24} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                Practice & Review
              </Text>
              <Text className="text-sm text-gray-500">
                Master topics at your own pace
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View className="gap-3">
          <Button
            onPress={() => router.push("/(auth)/sign-in")}
            fullWidth
            size="lg"
          >
            Sign In
          </Button>
          <Button
            onPress={() => router.push("/(auth)/sign-up")}
            variant="outline"
            fullWidth
            size="lg"
          >
            Create Account
          </Button>
          <View className="flex-row items-center my-2">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-gray-400 text-sm mx-4">or</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>
          <Button
            onPress={() => router.push("/(auth)/join")}
            variant="ghost"
            fullWidth
            size="lg"
          >
            Join a Game
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

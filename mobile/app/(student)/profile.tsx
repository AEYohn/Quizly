import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Card, PressableCard } from "@/components/ui";
import {
  User,
  LogOut,
  Trophy,
  Gamepad2,
  Target,
  ChevronRight,
  Settings,
  HelpCircle,
  Bell,
} from "lucide-react-native";

export default function ProfileScreen() {
  const router = useRouter();
  const { isSignedIn, isGuest, nickname, guestData, signOut } = useAuth();

  const displayName = nickname || guestData?.nickname || "Guest";
  const gamesPlayed = guestData?.gamesPlayed?.length || 0;
  const totalScore = guestData?.totalScore || 0;

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerClassName="px-4 py-6">
        {/* Profile Header */}
        <Card variant="elevated" className="items-center py-6 mb-6">
          <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-4">
            <User size={40} color="#6366F1" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-1">
            {displayName}
          </Text>
          <Text className="text-gray-500">
            {isSignedIn ? "Student Account" : "Guest Account"}
          </Text>

          {isGuest && (
            <Button
              className="mt-4"
              size="sm"
              onPress={() => router.push("/(auth)/sign-up")}
            >
              Create Account
            </Button>
          )}
        </Card>

        {/* Stats */}
        <Card variant="outline" className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Statistics
          </Text>
          <View className="flex-row">
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-yellow-100 rounded-xl items-center justify-center mb-2">
                <Trophy size={20} color="#F59E0B" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                {totalScore}
              </Text>
              <Text className="text-xs text-gray-500">Total Points</Text>
            </View>
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-purple-100 rounded-xl items-center justify-center mb-2">
                <Gamepad2 size={20} color="#8B5CF6" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                {gamesPlayed}
              </Text>
              <Text className="text-xs text-gray-500">Games Played</Text>
            </View>
            <View className="flex-1 items-center">
              <View className="w-10 h-10 bg-green-100 rounded-xl items-center justify-center mb-2">
                <Target size={20} color="#22C55E" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">0%</Text>
              <Text className="text-xs text-gray-500">Accuracy</Text>
            </View>
          </View>
        </Card>

        {/* Settings Menu */}
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Settings
        </Text>

        <Card variant="outline" padding="none" className="mb-6">
          <PressableCard
            padding="md"
            className="flex-row items-center justify-between border-b border-gray-100"
            onPress={() => {}}
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center mr-3">
                <Bell size={20} color="#6B7280" />
              </View>
              <Text className="text-gray-900 font-medium">Notifications</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </PressableCard>

          <PressableCard
            padding="md"
            className="flex-row items-center justify-between border-b border-gray-100"
            onPress={() => {}}
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center mr-3">
                <Settings size={20} color="#6B7280" />
              </View>
              <Text className="text-gray-900 font-medium">Preferences</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </PressableCard>

          <PressableCard
            padding="md"
            className="flex-row items-center justify-between"
            onPress={() => {}}
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center mr-3">
                <HelpCircle size={20} color="#6B7280" />
              </View>
              <Text className="text-gray-900 font-medium">Help & Support</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </PressableCard>
        </Card>

        {/* Sign Out */}
        {isSignedIn && (
          <Button
            variant="danger"
            fullWidth
            icon={LogOut}
            onPress={handleSignOut}
          >
            Sign Out
          </Button>
        )}

        {/* Version */}
        <Text className="text-center text-gray-400 text-sm mt-6">
          Quizly v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

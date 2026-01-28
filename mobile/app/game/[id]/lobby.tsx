import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { useGameSocket } from "@/hooks/useGameSocket";
import { Card, Button } from "@/components/ui";
import { Users, Wifi, WifiOff } from "lucide-react-native";

export default function GameLobbyScreen() {
  const { id, playerId, nickname } = useLocalSearchParams<{
    id: string;
    playerId: string;
    nickname: string;
  }>();
  const router = useRouter();

  const [quizTitle, setQuizTitle] = useState("");
  const [error, setError] = useState("");

  const {
    isConnected,
    playerCount,
    disconnect,
  } = useGameSocket({
    gameId: id,
    playerId,
    enabled: !!playerId,
    onConnected: (data) => {
      console.log("Connected to game:", data);
    },
    onGameStarted: (data) => {
      console.log("Game started:", data);
      router.replace({
        pathname: "/game/[id]/play",
        params: { id, playerId, nickname },
      });
    },
    onHostDisconnected: () => {
      setError("The host has disconnected");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleLeave = () => {
    disconnect();
    router.replace("/(student)");
  };

  return (
    <SafeAreaView className="flex-1 bg-primary-500">
      <View className="flex-1 px-6 justify-center items-center">
        {/* Connection Status */}
        <View className="absolute top-4 right-4">
          <View
            className={`flex-row items-center px-3 py-2 rounded-full ${
              isConnected ? "bg-green-500/20" : "bg-red-500/20"
            }`}
          >
            {isConnected ? (
              <Wifi size={16} color="#22C55E" />
            ) : (
              <WifiOff size={16} color="#EF4444" />
            )}
            <Text
              className={`ml-2 text-sm font-medium ${
                isConnected ? "text-green-100" : "text-red-100"
              }`}
            >
              {isConnected ? "Connected" : "Connecting..."}
            </Text>
          </View>
        </View>

        {/* Main Content */}
        <View className="items-center mb-8">
          <Text className="text-6xl mb-4">🎮</Text>
          <Text className="text-white text-3xl font-bold mb-2">
            Get Ready!
          </Text>
          <Text className="text-white/80 text-lg text-center">
            Waiting for the host to start...
          </Text>
        </View>

        {/* Player Card */}
        <Card variant="elevated" className="w-full max-w-sm mb-8">
          <View className="items-center py-4">
            <View className="w-16 h-16 bg-primary-100 rounded-full items-center justify-center mb-3">
              <Text className="text-3xl">🎓</Text>
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-1">
              {nickname}
            </Text>
            <Text className="text-gray-500">You're in the game!</Text>
          </View>

          <View className="border-t border-gray-100 pt-4 mt-2">
            <View className="flex-row items-center justify-center">
              <Users size={20} color="#6366F1" />
              <Text className="text-primary-600 font-semibold ml-2 text-lg">
                {playerCount} {playerCount === 1 ? "player" : "players"} waiting
              </Text>
            </View>
          </View>
        </Card>

        {/* Waiting Animation */}
        <View className="flex-row items-center mb-8">
          <ActivityIndicator color="#fff" size="small" />
          <Text className="text-white/60 ml-3">
            The game will start automatically
          </Text>
        </View>

        {/* Error */}
        {error && (
          <View className="bg-red-500/20 px-4 py-3 rounded-xl mb-4 w-full max-w-sm">
            <Text className="text-white text-center">{error}</Text>
          </View>
        )}

        {/* Leave Button */}
        <Button
          variant="ghost"
          onPress={handleLeave}
          className="absolute bottom-8"
        >
          <Text className="text-white/60">Leave Game</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

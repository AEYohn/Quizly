import { View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { GameCodeInput } from "@/components/game";
import { gameApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { Gamepad2, ArrowLeft } from "lucide-react-native";
import { Pressable } from "react-native";

type JoinStep = "code" | "nickname";

export default function GuestJoinScreen() {
  const router = useRouter();
  const { setGuestNickname, guestData } = useAuth();

  const [step, setStep] = useState<JoinStep>("code");
  const [gameCode, setGameCode] = useState("");
  const [nickname, setNickname] = useState(guestData?.nickname || "");
  const [quizTitle, setQuizTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCodeSubmit = async () => {
    if (gameCode.length !== 6) return;

    setLoading(true);
    setError("");

    try {
      const result = await gameApi.checkCode(gameCode);
      if (result.valid && result.quiz_title) {
        setQuizTitle(result.quiz_title);
        setStep("nickname");
      } else {
        setError("Invalid game code. Please check and try again.");
      }
    } catch (err) {
      setError("Game not found. Make sure the code is correct.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!nickname.trim()) return;

    setLoading(true);
    setError("");

    try {
      const result = await gameApi.join({
        game_code: gameCode,
        nickname: nickname.trim(),
      });

      // Save nickname for guest
      await setGuestNickname(nickname.trim());

      // Navigate to game lobby
      router.push({
        pathname: "/game/[id]/lobby",
        params: {
          id: result.game_id,
          playerId: result.player_id,
          nickname: result.nickname,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to join game";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Back button */}
        <View className="px-4 pt-2">
          <Pressable
            onPress={() => step === "nickname" ? setStep("code") : router.back()}
            className="flex-row items-center py-2"
          >
            <ArrowLeft size={24} color="#6B7280" />
            <Text className="text-gray-500 ml-2">Back</Text>
          </Pressable>
        </View>

        <View className="flex-1 px-6 justify-center">
          {/* Header */}
          <View className="items-center mb-12">
            <View className="w-20 h-20 bg-primary-100 rounded-3xl items-center justify-center mb-6">
              <Gamepad2 size={40} color="#6366F1" />
            </View>
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              {step === "code" ? "Join a Game" : "Enter Your Name"}
            </Text>
            <Text className="text-gray-500 text-center">
              {step === "code"
                ? "Enter the 6-character code from your teacher"
                : `Joining: ${quizTitle}`}
            </Text>
          </View>

          {/* Content */}
          {step === "code" ? (
            <View className="items-center">
              <GameCodeInput
                value={gameCode}
                onChange={setGameCode}
                error={error}
                autoFocus
              />

              <View className="w-full mt-8">
                <Button
                  onPress={handleCodeSubmit}
                  loading={loading}
                  disabled={gameCode.length !== 6}
                  fullWidth
                  size="lg"
                >
                  Continue
                </Button>
              </View>
            </View>
          ) : (
            <View>
              <Input
                placeholder="Your nickname"
                value={nickname}
                onChangeText={setNickname}
                autoFocus
                maxLength={20}
                size="lg"
                containerClassName="mb-2"
              />
              <Text className="text-gray-400 text-sm text-center mb-6">
                This is how other players will see you
              </Text>

              {error && (
                <View className="bg-error-50 p-3 rounded-xl mb-4">
                  <Text className="text-error-600 text-center">{error}</Text>
                </View>
              )}

              <Button
                onPress={handleJoinGame}
                loading={loading}
                disabled={!nickname.trim()}
                fullWidth
                size="lg"
              >
                Join Game
              </Button>
            </View>
          )}

          {/* Sign up prompt */}
          <View className="mt-8 items-center">
            <Text className="text-gray-400 text-sm">
              Want to save your progress?
            </Text>
            <Pressable onPress={() => router.push("/(auth)/sign-up")}>
              <Text className="text-primary-600 font-medium mt-1">
                Create an account
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

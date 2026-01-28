import { View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignIn } from "@clerk/clerk-expo";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { ArrowLeft, Mail, Lock } from "lucide-react-native";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(student)");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign in failed";
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
        <View className="flex-1 px-6">
          {/* Header */}
          <View className="flex-row items-center py-4">
            <Button
              variant="ghost"
              onPress={() => router.back()}
              icon={ArrowLeft}
            >
              Back
            </Button>
          </View>

          {/* Title */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back
            </Text>
            <Text className="text-gray-500 text-base">
              Sign in to continue learning
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4 mb-6">
            <Input
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              icon={Mail}
            />
            <Input
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon={Lock}
            />
          </View>

          {/* Error */}
          {error && (
            <View className="bg-error-50 p-3 rounded-xl mb-4">
              <Text className="text-error-600 text-center">{error}</Text>
            </View>
          )}

          {/* Submit */}
          <Button
            onPress={handleSignIn}
            loading={loading}
            disabled={!email || !password}
            fullWidth
            size="lg"
          >
            Sign In
          </Button>

          {/* Sign up link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">Don't have an account? </Text>
            <Text
              className="text-primary-600 font-semibold"
              onPress={() => router.replace("/(auth)/sign-up")}
            >
              Sign Up
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

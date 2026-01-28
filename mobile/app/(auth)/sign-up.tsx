import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignUp } from "@clerk/clerk-expo";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { ArrowLeft, Mail, Lock, User } from "lucide-react-native";

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  const handleSignUp = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError("");

    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName: name,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError("");

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(student)");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 px-6">
          {/* Header */}
          <View className="flex-row items-center py-4">
            <Button
              variant="ghost"
              onPress={() => setPendingVerification(false)}
              icon={ArrowLeft}
            >
              Back
            </Button>
          </View>

          {/* Title */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900 mb-2">
              Verify your email
            </Text>
            <Text className="text-gray-500 text-base">
              We sent a code to {email}
            </Text>
          </View>

          {/* Code Input */}
          <Input
            label="Verification Code"
            placeholder="Enter 6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            containerClassName="mb-6"
          />

          {/* Error */}
          {error && (
            <View className="bg-error-50 p-3 rounded-xl mb-4">
              <Text className="text-error-600 text-center">{error}</Text>
            </View>
          )}

          {/* Submit */}
          <Button
            onPress={handleVerify}
            loading={loading}
            disabled={code.length !== 6}
            fullWidth
            size="lg"
          >
            Verify Email
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1" contentContainerClassName="px-6 pb-8">
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
              Create account
            </Text>
            <Text className="text-gray-500 text-base">
              Start your learning journey
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4 mb-6">
            <Input
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              icon={User}
            />
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
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon={Lock}
              hint="At least 8 characters"
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
            onPress={handleSignUp}
            loading={loading}
            disabled={!name || !email || !password || password.length < 8}
            fullWidth
            size="lg"
          >
            Create Account
          </Button>

          {/* Sign in link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">Already have an account? </Text>
            <Text
              className="text-primary-600 font-semibold"
              onPress={() => router.replace("/(auth)/sign-in")}
            >
              Sign In
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import {
  View,
  Text,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Button, Card, Input } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { aiApi, studentQuizApi, QuizQuestion } from "@/lib/api";
import {
  Send,
  Camera,
  Image as ImageIcon,
  FileText,
  Sparkles,
  X,
  Check,
  Edit3,
  Trash2,
} from "lucide-react-native";

interface GeneratedQuestion extends QuizQuestion {
  id: string;
}

type CreateStep = "chat" | "review" | "settings";

export default function CreateQuizScreen() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<CreateStep>("chat");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [error, setError] = useState("");

  // Chat state
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // Questions state
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

  // Quiz settings
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim() && !attachedImage) return;

    const userMessage = message.trim();
    setMessage("");

    // Add user message to history
    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: userMessage || "[Image attached]" },
    ]);

    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      // For now, show a demo response if not signed in
      if (!token) {
        // Simulate AI response with demo questions
        setTimeout(() => {
          const demoQuestions: GeneratedQuestion[] = [
            {
              id: "1",
              question_text: "What is the capital of France?",
              question_type: "multiple_choice",
              options: { A: "London", B: "Paris", C: "Berlin", D: "Madrid" },
              correct_answer: "B",
              explanation: "Paris is the capital and largest city of France.",
              points: 100,
              time_limit: 30,
            },
            {
              id: "2",
              question_text: "Which planet is known as the Red Planet?",
              question_type: "multiple_choice",
              options: { A: "Venus", B: "Jupiter", C: "Mars", D: "Saturn" },
              correct_answer: "C",
              explanation: "Mars appears red due to iron oxide on its surface.",
              points: 100,
              time_limit: 30,
            },
          ];

          setChatHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `I've generated ${demoQuestions.length} questions based on your request. You can review and edit them before saving.`,
            },
          ]);

          setQuestions(demoQuestions);
          setLoading(false);
        }, 1500);
        return;
      }

      const response = await aiApi.chatGenerate(
        {
          message: userMessage,
          image_base64: attachedImage || undefined,
        },
        token
      );

      // Add AI response to history
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: response.message },
      ]);

      // Add generated questions
      if (response.questions.length > 0) {
        const newQuestions = response.questions.map((q, i) => ({
          ...q,
          id: `${Date.now()}-${i}`,
        }));
        setQuestions((prev) => [...prev, ...newQuestions]);
      }

      setAttachedImage(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate";
      setError(errorMessage);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${errorMessage}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (source: "camera" | "gallery") => {
    try {
      let result;

      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission needed", "Camera access is required");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          base64: true,
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission needed", "Photo library access is required");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          base64: true,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0].base64) {
        setAttachedImage(result.assets[0].base64);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const file = result.assets[0];

      // Check file size (limit to 50MB)
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      if (fileInfo.exists && 'size' in fileInfo && fileInfo.size && fileInfo.size > 50 * 1024 * 1024) {
        Alert.alert("File Too Large", "Please select a PDF under 50MB");
        return;
      }

      setIsProcessingPDF(true);

      // Add a message to chat history
      setChatHistory((prev) => [
        ...prev,
        { role: "user", content: `[PDF uploaded: ${file.name}]` },
      ]);

      try {
        const token = await getToken();

        if (!token) {
          // Demo mode - generate sample questions
          setTimeout(() => {
            const demoQuestions: GeneratedQuestion[] = [
              {
                id: `pdf-${Date.now()}-1`,
                question_text: "Based on the document, what is the main topic discussed?",
                question_type: "multiple_choice",
                options: { A: "Option A", B: "Option B", C: "Option C", D: "Option D" },
                correct_answer: "A",
                explanation: "This is a demo question generated from the PDF.",
                points: 100,
                time_limit: 30,
              },
              {
                id: `pdf-${Date.now()}-2`,
                question_text: "What key concept is explained in the document?",
                question_type: "multiple_choice",
                options: { A: "Concept 1", B: "Concept 2", C: "Concept 3", D: "Concept 4" },
                correct_answer: "B",
                explanation: "This is a demo question generated from the PDF.",
                points: 100,
                time_limit: 30,
              },
            ];

            setChatHistory((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `I've analyzed the PDF and generated ${demoQuestions.length} questions. You can review and edit them before saving.`,
              },
            ]);

            setQuestions((prev) => [...prev, ...demoQuestions]);
            setIsProcessingPDF(false);
          }, 2000);
          return;
        }

        // Read the PDF file as base64
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const response = await aiApi.chatGenerate(
          {
            message: "Generate quiz questions from this PDF document",
            pdf_base64: base64,
          },
          token
        );

        // Add AI response to history
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: response.message },
        ]);

        // Add generated questions
        if (response.questions.length > 0) {
          const newQuestions = response.questions.map((q, i) => ({
            ...q,
            id: `pdf-${Date.now()}-${i}`,
          }));
          setQuestions((prev) => [...prev, ...newQuestions]);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to process PDF";
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: `Error processing PDF: ${errorMessage}` },
        ]);
        Alert.alert("Error", "Failed to process PDF. Please try again.");
      } finally {
        setIsProcessingPDF(false);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please enter a title for your quiz");
      return;
    }

    if (questions.length === 0) {
      Alert.alert("No Questions", "Add at least one question to save");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        Alert.alert(
          "Sign In Required",
          "Create an account to save your quizzes",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign Up",
              onPress: () => router.push("/(auth)/sign-up"),
            },
          ]
        );
        setLoading(false);
        return;
      }

      await studentQuizApi.create(
        {
          title: title.trim(),
          subject: subject.trim() || undefined,
          is_public: isPublic,
          timer_enabled: true,
          shuffle_questions: false,
          questions: questions.map(({ id, ...q }) => q),
        },
        token
      );

      Alert.alert("Success", "Quiz saved successfully!", [
        {
          text: "OK",
          onPress: () => router.push("/(student)/study"),
        },
      ]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderChatStep = () => (
    <>
      {/* Chat Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerClassName="py-4"
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {/* Welcome Message */}
        {chatHistory.length === 0 && (
          <View className="items-center py-8">
            <View className="w-16 h-16 bg-primary-100 rounded-2xl items-center justify-center mb-4">
              <Sparkles size={32} color="#6366F1" />
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
              AI Quiz Generator
            </Text>
            <Text className="text-gray-500 text-center mb-6">
              Describe what you want to study, or upload an image/document
            </Text>

            {/* Quick Prompts */}
            <View className="gap-2 w-full">
              {[
                "Generate 5 questions about photosynthesis",
                "Quiz me on World War II events",
                "Create math problems about fractions",
              ].map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => setMessage(prompt)}
                  className="bg-gray-50 p-3 rounded-xl active:bg-gray-100"
                >
                  <Text className="text-gray-700">{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Chat History */}
        {chatHistory.map((msg, index) => (
          <View
            key={index}
            className={`mb-3 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <View
              className={`max-w-[85%] p-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-primary-500 rounded-br-sm"
                  : "bg-gray-100 rounded-bl-sm"
              }`}
            >
              <Text
                className={
                  msg.role === "user" ? "text-white" : "text-gray-900"
                }
              >
                {msg.content}
              </Text>
            </View>
          </View>
        ))}

        {/* Loading */}
        {loading && (
          <View className="items-start mb-3">
            <View className="bg-gray-100 p-3 rounded-2xl rounded-bl-sm">
              <Text className="text-gray-500">Generating questions...</Text>
            </View>
          </View>
        )}

        {/* PDF Processing */}
        {isProcessingPDF && (
          <View className="items-start mb-3">
            <View className="bg-gray-100 p-3 rounded-2xl rounded-bl-sm flex-row items-center">
              <ActivityIndicator size="small" color="#6366F1" />
              <Text className="text-gray-500 ml-2">Processing PDF...</Text>
            </View>
          </View>
        )}

        {/* Generated Questions Preview */}
        {questions.length > 0 && (
          <Card variant="outline" className="mt-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-semibold text-gray-900">
                {questions.length} Questions Generated
              </Text>
              <Button
                size="sm"
                onPress={() => setStep("review")}
              >
                Review
              </Button>
            </View>
            <Text className="text-gray-500 text-sm">
              Tap "Review" to edit questions before saving
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Attached Image Preview */}
      {attachedImage && (
        <View className="px-4 py-2 bg-gray-50">
          <View className="flex-row items-center">
            <Image
              source={{ uri: `data:image/jpeg;base64,${attachedImage}` }}
              className="w-16 h-16 rounded-lg"
            />
            <Text className="flex-1 mx-3 text-gray-600">Image attached</Text>
            <Pressable onPress={() => setAttachedImage(null)}>
              <X size={20} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Input Area */}
      <View className="px-4 py-3 bg-white border-t border-gray-100">
        <View className="flex-row gap-2 mb-3">
          <Pressable
            onPress={() => handlePickImage("camera")}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center active:bg-gray-200"
          >
            <Camera size={20} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={() => handlePickImage("gallery")}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center active:bg-gray-200"
          >
            <ImageIcon size={20} color="#6B7280" />
          </Pressable>
          <Pressable
            onPress={handlePickDocument}
            disabled={isProcessingPDF}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              isProcessingPDF ? "bg-primary-100" : "bg-gray-100 active:bg-gray-200"
            }`}
          >
            {isProcessingPDF ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <FileText size={20} color="#6B7280" />
            )}
          </Pressable>
        </View>

        <View className="flex-row items-end gap-2">
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-base max-h-32"
            placeholder="Describe what you want to study..."
            value={message}
            onChangeText={setMessage}
            multiline
            editable={!loading}
          />
          <Pressable
            onPress={handleSendMessage}
            disabled={loading || (!message.trim() && !attachedImage)}
            className={`w-12 h-12 rounded-full items-center justify-center ${
              loading || (!message.trim() && !attachedImage)
                ? "bg-gray-200"
                : "bg-primary-500 active:bg-primary-600"
            }`}
          >
            <Send
              size={20}
              color={
                loading || (!message.trim() && !attachedImage)
                  ? "#9CA3AF"
                  : "#fff"
              }
            />
          </Pressable>
        </View>
      </View>
    </>
  );

  const renderReviewStep = () => (
    <ScrollView className="flex-1 px-4" contentContainerClassName="py-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-xl font-bold text-gray-900">
          Review Questions
        </Text>
        <Button variant="ghost" size="sm" onPress={() => setStep("chat")}>
          Back to Chat
        </Button>
      </View>

      {questions.map((question, index) => (
        <Card key={question.id} variant="outline" className="mb-3">
          <View className="flex-row justify-between items-start mb-3">
            <Text className="text-sm font-medium text-gray-500">
              Question {index + 1}
            </Text>
            <Pressable onPress={() => handleDeleteQuestion(question.id)}>
              <Trash2 size={18} color="#EF4444" />
            </Pressable>
          </View>

          <Text className="text-base font-medium text-gray-900 mb-3">
            {question.question_text}
          </Text>

          <View className="gap-2">
            {Object.entries(question.options).map(([key, value]) => (
              <View
                key={key}
                className={`flex-row items-center p-2 rounded-lg ${
                  key === question.correct_answer
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50"
                }`}
              >
                <Text
                  className={`font-medium mr-2 ${
                    key === question.correct_answer
                      ? "text-green-600"
                      : "text-gray-600"
                  }`}
                >
                  {key}.
                </Text>
                <Text
                  className={
                    key === question.correct_answer
                      ? "text-green-700"
                      : "text-gray-700"
                  }
                >
                  {value}
                </Text>
                {key === question.correct_answer && (
                  <Check size={16} color="#22C55E" style={{ marginLeft: 8 }} />
                )}
              </View>
            ))}
          </View>

          {question.explanation && (
            <View className="mt-3 p-2 bg-blue-50 rounded-lg">
              <Text className="text-sm text-blue-700">
                {question.explanation}
              </Text>
            </View>
          )}
        </Card>
      ))}

      {questions.length > 0 && (
        <Button
          size="lg"
          fullWidth
          onPress={() => setStep("settings")}
          className="mt-4"
        >
          Continue to Settings
        </Button>
      )}
    </ScrollView>
  );

  const renderSettingsStep = () => (
    <ScrollView className="flex-1 px-4" contentContainerClassName="py-4">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-xl font-bold text-gray-900">Quiz Settings</Text>
        <Button variant="ghost" size="sm" onPress={() => setStep("review")}>
          Back
        </Button>
      </View>

      <View className="gap-4">
        <Input
          label="Quiz Title"
          placeholder="e.g., Biology Chapter 5"
          value={title}
          onChangeText={setTitle}
        />

        <Input
          label="Subject (optional)"
          placeholder="e.g., Biology"
          value={subject}
          onChangeText={setSubject}
        />

        <Pressable
          onPress={() => setIsPublic(!isPublic)}
          className="flex-row items-center justify-between bg-gray-50 p-4 rounded-xl"
        >
          <View>
            <Text className="font-medium text-gray-900">Make Public</Text>
            <Text className="text-sm text-gray-500">
              Others can discover and practice your quiz
            </Text>
          </View>
          <View
            className={`w-12 h-7 rounded-full p-1 ${
              isPublic ? "bg-primary-500" : "bg-gray-300"
            }`}
          >
            <View
              className={`w-5 h-5 bg-white rounded-full ${
                isPublic ? "self-end" : "self-start"
              }`}
            />
          </View>
        </Pressable>
      </View>

      <View className="mt-8">
        <Button
          size="lg"
          fullWidth
          onPress={handleSaveQuiz}
          loading={loading}
          disabled={!title.trim()}
        >
          Save Quiz ({questions.length} questions)
        </Button>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">
            {step === "chat"
              ? "Create Quiz"
              : step === "review"
              ? "Review"
              : "Settings"}
          </Text>
          {questions.length > 0 && step === "chat" && (
            <View className="bg-primary-100 px-3 py-1 rounded-full">
              <Text className="text-primary-700 font-medium">
                {questions.length} Q
              </Text>
            </View>
          )}
        </View>

        {step === "chat" && renderChatStep()}
        {step === "review" && renderReviewStep()}
        {step === "settings" && renderSettingsStep()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

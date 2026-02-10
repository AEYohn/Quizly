import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, FileUp, CheckCircle2, AlertCircle } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { resourcesApi } from "@/lib/learnApi";
import { useScrollSessionStore } from "@/stores/scrollSessionStore";
import { useAuth } from "@/providers/AuthProvider";

export default function PdfUploadScreen() {
  const router = useRouter();
  const store = useScrollSessionStore();
  const auth = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;

      setFileName(file.name);
      setIsUploading(true);
      setError(null);
      setSuccess(false);

      const formData = new FormData();
      formData.append("files", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/pdf",
      } as any);
      if (auth.userId) {
        formData.append("student_id", auth.userId);
      }

      const res = await resourcesApi.pdfToSyllabus(formData);

      if (!res.success) {
        setError(res.error ?? "Failed to process PDF");
        setIsUploading(false);
        return;
      }

      // Set syllabus in store
      store.setSyllabus(res.data!.syllabus);
      store.setSelectedSubject(res.data!.subject);
      store.setSubjectResources(
        res.data!.resources
          .filter((r) => r.id)
          .map((r) => ({
            id: r.id!,
            file_name: r.file_name,
            file_type: "pdf",
            concepts_count: r.concepts_count,
          })),
      );

      setSuccess(true);
      setIsUploading(false);

      // Navigate to skill tree after a brief delay
      setTimeout(() => {
        router.push("/(student)/skill-tree");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload");
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <Pressable onPress={() => router.navigate("/(student)")} className="p-2 mr-2">
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900">
          Upload Study Material
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {isUploading ? (
          <View className="items-center gap-4">
            <ActivityIndicator size="large" color="#6366F1" />
            <Text className="text-base text-gray-600">
              Processing {fileName}...
            </Text>
            <Text className="text-sm text-gray-400 text-center">
              Extracting topics and generating your skill tree
            </Text>
          </View>
        ) : success ? (
          <View className="items-center gap-4">
            <CheckCircle2 size={48} color="#10B981" />
            <Text className="text-xl font-semibold text-gray-900">
              Skill tree generated!
            </Text>
            <Text className="text-sm text-gray-500">
              Redirecting to skill tree...
            </Text>
          </View>
        ) : (
          <View className="items-center gap-4 w-full">
            <Pressable
              onPress={handlePick}
              className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-10 items-center active:border-indigo-400 active:bg-indigo-50"
            >
              <FileUp size={48} color="#6366F1" />
              <Text className="text-lg font-semibold text-gray-900 mt-4">
                Choose a PDF
              </Text>
              <Text className="text-sm text-gray-500 mt-1 text-center">
                Upload lecture notes, textbooks, or study guides
              </Text>
            </Pressable>

            {error && (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 w-full">
                <AlertCircle size={18} color="#EF4444" />
                <Text className="text-sm text-red-700 flex-1">{error}</Text>
              </View>
            )}

            <Text className="text-xs text-gray-400 text-center mt-2">
              PDF files up to 50MB supported.{"\n"}
              Your material will be analyzed to create a personalized skill
              tree.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

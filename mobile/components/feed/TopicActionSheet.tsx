import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import {
  X,
  BookOpen,
  FileText,
  Brain,
  ExternalLink,
  Clock,
  Layers,
} from "lucide-react-native";
import type { SyllabusTopic } from "@/types/learn";
import { MasteryRing } from "@/components/feed/MasteryRing";

interface TopicResource {
  title: string;
  url: string;
  source_type: string;
  thumbnail_url?: string;
}

interface TopicActionSheetProps {
  visible: boolean;
  topic: SyllabusTopic;
  mastery: number;
  resources: TopicResource[];
  onClose: () => void;
  onStartLearning: () => void;
  onStudyNotes: () => void;
  onQuizOnly: () => void;
  isLoading: boolean;
}

export function TopicActionSheet({
  visible,
  topic,
  mastery,
  resources,
  onClose,
  onStartLearning,
  onStudyNotes,
  onQuizOnly,
  isLoading,
}: TopicActionSheetProps) {
  const handleOpenResource = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Can't open link", "This URL doesn't appear to be valid.");
      }
    } catch {
      Alert.alert("Can't open link", "Something went wrong trying to open this resource.");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <Text
            className="text-lg font-semibold text-gray-900 flex-1 mr-3"
            numberOfLines={2}
          >
            {topic.name}
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <X size={20} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {/* Topic info */}
          <View className="items-center mb-5">
            <MasteryRing mastery={mastery} size={64} />
            <View className="flex-row items-center gap-4 mt-3">
              <View className="flex-row items-center gap-1">
                <Layers size={14} color="#6B7280" />
                <Text className="text-sm text-gray-500">
                  {topic.concepts.length} concepts
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#6B7280" />
                <Text className="text-sm text-gray-500">
                  ~{topic.estimated_minutes}m
                </Text>
              </View>
            </View>
          </View>

          {/* Concept chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
            contentContainerStyle={{ gap: 6 }}
          >
            {topic.concepts.map((concept) => (
              <View
                key={concept}
                className="bg-indigo-50 px-3 py-1.5 rounded-full"
              >
                <Text className="text-xs font-medium text-indigo-600">
                  {concept}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Action buttons */}
          <View className="gap-3 mb-6">
            <Pressable
              onPress={onStartLearning}
              disabled={isLoading}
              className="flex-row items-center bg-indigo-600 rounded-xl p-4 gap-3 active:bg-indigo-700"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <BookOpen size={20} color="#FFFFFF" />
              )}
              <View className="flex-1">
                <Text className="text-white font-semibold">Start Learning</Text>
                <Text className="text-indigo-200 text-xs mt-0.5">
                  Full flow: learn, flashcards, then quiz
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onStudyNotes}
              disabled={isLoading}
              className="flex-row items-center bg-white border border-gray-200 rounded-xl p-4 gap-3 active:bg-gray-50"
            >
              <FileText size={20} color="#6366F1" />
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold">Study Notes</Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  Read AI-generated notes by concept
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onQuizOnly}
              disabled={isLoading}
              className="flex-row items-center bg-white border border-gray-200 rounded-xl p-4 gap-3 active:bg-gray-50"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <Brain size={20} color="#6366F1" />
              )}
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold">Quiz Only</Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  Jump straight to quiz questions
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Resources section */}
          {resources.length > 0 && (
            <View>
              <Text className="text-sm font-semibold text-gray-900 mb-2">
                Resources
              </Text>
              <View className="gap-2">
                {resources.map((resource, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => handleOpenResource(resource.url)}
                    className="flex-row items-center bg-gray-50 rounded-xl p-3 gap-3 active:bg-gray-100"
                  >
                    <ExternalLink size={16} color="#6366F1" />
                    <Text
                      className="flex-1 text-sm text-gray-700"
                      numberOfLines={1}
                    >
                      {resource.title}
                    </Text>
                    <Text className="text-xs text-gray-400 capitalize">
                      {resource.source_type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

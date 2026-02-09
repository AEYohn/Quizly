import { View, Text, Pressable } from "react-native";
import { BookOpen, Clock, ArrowRight } from "lucide-react-native";
import type { SyllabusTopic } from "@/types/learn";

interface TopicOverviewCardProps {
  topic: SyllabusTopic;
  onStart: () => void;
}

export function TopicOverviewCard({ topic, onStart }: TopicOverviewCardProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      {/* Icon */}
      <View className="w-16 h-16 rounded-2xl bg-indigo-100 items-center justify-center mb-5">
        <BookOpen size={32} color="#6366F1" />
      </View>

      {/* Topic name */}
      <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
        {topic.name}
      </Text>

      {/* Meta row */}
      <View className="flex-row items-center gap-3 mb-4">
        <View className="flex-row items-center gap-1">
          <BookOpen size={14} color="#6B7280" />
          <Text className="text-xs text-gray-500">
            {topic.concepts.length} concepts
          </Text>
        </View>
        {topic.estimated_minutes > 0 && (
          <View className="flex-row items-center gap-1">
            <Clock size={14} color="#6B7280" />
            <Text className="text-xs text-gray-500">
              ~{topic.estimated_minutes} min
            </Text>
          </View>
        )}
      </View>

      {/* Concept chips */}
      <View className="flex-row flex-wrap justify-center gap-1.5 mb-5 max-w-[300px]">
        {topic.concepts.map((concept) => (
          <View key={concept} className="bg-gray-100 px-2.5 py-1 rounded-full">
            <Text className="text-[11px] text-gray-600">{concept}</Text>
          </View>
        ))}
      </View>

      {/* Prerequisites */}
      {topic.prerequisites.length > 0 && (
        <Text className="text-xs text-gray-400 text-center mb-4 max-w-[260px]">
          Prerequisites: {topic.prerequisites.join(", ")}
        </Text>
      )}

      {/* Start button */}
      <Pressable
        onPress={onStart}
        className="flex-row items-center gap-2 bg-indigo-500 px-6 py-3 rounded-xl active:opacity-80"
      >
        <Text className="font-semibold text-sm text-white">Start Learning</Text>
        <ArrowRight size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

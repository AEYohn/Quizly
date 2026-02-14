import { View, Text, Pressable } from "react-native";
import { BookOpen } from "lucide-react-native";
import { MathText } from "@/components/common/MathText";
import type { LessonData } from "@/types/learn";

interface MicroLessonCardProps {
  lesson: LessonData;
  onDismiss: () => void;
}

export function MicroLessonCard({ lesson, onDismiss }: MicroLessonCardProps) {
  return (
    <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 my-2 self-stretch">
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-2">
        <BookOpen size={16} color="#2563EB" />
        <Text className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
          Micro Lesson
        </Text>
      </View>

      {/* Title */}
      <Text className="text-base font-semibold text-gray-900 mb-2">
        {lesson.title}
      </Text>

      {/* Content */}
      <MathText
        text={lesson.content}
        style={{ fontSize: 14, color: "#374151", lineHeight: 20 }}
        containerStyle={{ marginBottom: 12 }}
        inline
      />

      {/* Concept tag */}
      <View className="flex-row items-center justify-between">
        <View className="bg-blue-100 px-2.5 py-0.5 rounded-full">
          <Text className="text-xs font-medium text-blue-600">
            {lesson.concept}
          </Text>
        </View>

        <Pressable
          onPress={onDismiss}
          className="bg-blue-600 rounded-lg px-4 py-1.5 active:bg-blue-700"
        >
          <Text className="text-xs font-semibold text-white">Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

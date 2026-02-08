import { View, Text, Pressable, Linking, Image } from "react-native";
import { ExternalLink, Play, FileText, Globe } from "lucide-react-native";
import { useHaptics } from "@/hooks/useHaptics";
import type { ScrollCard } from "@/types/learn";

interface ResourceCardProps {
  card: ScrollCard;
  onNext: () => void;
}

export function ResourceCard({ card, onNext }: ResourceCardProps) {
  const haptics = useHaptics();

  const handleOpen = () => {
    if (card.resource_url) {
      haptics.light();
      Linking.openURL(card.resource_url);
    }
  };

  const typeIcon = () => {
    switch (card.resource_type) {
      case "video":
        return <Play size={16} color="#6366F1" />;
      case "article":
        return <FileText size={16} color="#6366F1" />;
      default:
        return <Globe size={16} color="#6366F1" />;
    }
  };

  return (
    <View className="flex-1 bg-white px-5 pt-4 pb-6">
      {/* Concept badge */}
      <View className="flex-row items-center gap-2 mb-3">
        <View className="bg-purple-50 px-3 py-1 rounded-full">
          <Text className="text-xs font-medium text-purple-600">
            {card.concept}
          </Text>
        </View>
        <View className="bg-gray-100 px-2 py-1 rounded-full">
          <Text className="text-xs text-gray-500">Resource</Text>
        </View>
      </View>

      <View className="flex-1 justify-center">
        {/* Thumbnail */}
        {card.resource_thumbnail && (
          <View className="bg-gray-100 rounded-xl overflow-hidden mb-4 aspect-video">
            <Image
              source={{ uri: card.resource_thumbnail }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        )}

        {/* Resource info */}
        <View className="bg-gray-50 rounded-xl p-4 mb-4">
          <View className="flex-row items-center gap-2 mb-2">
            {typeIcon()}
            <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.resource_type || "Resource"}
            </Text>
            {card.resource_duration && (
              <Text className="text-xs text-gray-400">
                {card.resource_duration}
              </Text>
            )}
          </View>

          <Text className="text-lg font-semibold text-gray-900 mb-1">
            {card.resource_title || card.prompt}
          </Text>

          {card.resource_channel && (
            <Text className="text-sm text-gray-500 mb-2">
              {card.resource_channel}
            </Text>
          )}

          {card.resource_description && (
            <Text className="text-sm text-gray-600 leading-5">
              {card.resource_description}
            </Text>
          )}

          {card.resource_domain && (
            <Text className="text-xs text-gray-400 mt-2">
              {card.resource_domain}
            </Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={handleOpen}
          className="flex-1 flex-row items-center justify-center bg-indigo-600 rounded-xl py-3 gap-2 active:bg-indigo-700"
        >
          <ExternalLink size={16} color="#FFFFFF" />
          <Text className="text-white font-semibold">Open</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.medium();
            onNext();
          }}
          className="flex-row items-center justify-center border border-gray-200 rounded-xl py-3 px-6"
        >
          <Text className="text-gray-600 font-medium">Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

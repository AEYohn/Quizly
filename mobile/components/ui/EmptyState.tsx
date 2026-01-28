import { View, Text } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  iconColor?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  iconColor = "#9CA3AF",
}: EmptyStateProps) {
  return (
    <View className="items-center py-12 px-6">
      <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
        <Icon size={32} color={iconColor} />
      </View>

      <Text className="text-gray-600 font-semibold text-lg mb-1 text-center">
        {title}
      </Text>

      {description && (
        <Text className="text-gray-400 text-sm text-center mb-4 max-w-xs">
          {description}
        </Text>
      )}

      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

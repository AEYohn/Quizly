import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Settings, Zap, Flame, BarChart3 } from "lucide-react-native";
import type { ScrollStats } from "@/types/learn";
import { PhaseProgressBar } from "./PhaseProgressBar";

interface FeedHeaderProps {
  stats: ScrollStats;
  topic: string | null;
  onSettingsTap?: () => void;
  onAnalyticsTap?: () => void;
  analyticsLoading?: boolean;
  onSkipPhase?: (targetPhase: string) => void;
}

export function FeedHeader({
  stats,
  topic,
  onSettingsTap,
  onAnalyticsTap,
  analyticsLoading,
  onSkipPhase,
}: FeedHeaderProps) {
  const difficultyLabel =
    stats.difficulty < 0.3
      ? "Easy"
      : stats.difficulty < 0.6
        ? "Medium"
        : "Hard";

  return (
    <View className="bg-white border-b border-gray-100">
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center gap-3">
          {/* XP */}
          <View className="flex-row items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-full">
            <Zap size={14} color="#6366F1" />
            <Text className="text-xs font-semibold text-indigo-600">
              {stats.total_xp} XP
            </Text>
          </View>

          {/* Streak */}
          {stats.streak > 0 && (
            <View className="flex-row items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-full">
              <Flame size={14} color="#EA580C" />
              <Text className="text-xs font-semibold text-orange-600">
                {stats.streak}
              </Text>
            </View>
          )}

          {/* Difficulty */}
          <View className="bg-gray-100 px-2.5 py-1 rounded-full">
            <Text className="text-xs font-medium text-gray-500">
              {difficultyLabel}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {onAnalyticsTap && (
            <Pressable
              onPress={onAnalyticsTap}
              disabled={analyticsLoading}
              className={`p-2 rounded-full active:bg-gray-100 ${analyticsLoading ? "opacity-50" : ""}`}
            >
              {analyticsLoading ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <BarChart3 size={20} color="#6B7280" />
              )}
            </Pressable>
          )}
          {onSettingsTap && (
            <Pressable
              onPress={onSettingsTap}
              className="p-2 rounded-full active:bg-gray-100"
            >
              <Settings size={20} color="#6B7280" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Phase progress bar for structured mode */}
      {stats.feed_phase && stats.feed_phase !== "mixed" && (
        <PhaseProgressBar
          phase={stats.feed_phase}
          progress={stats.phase_progress}
          onSkip={onSkipPhase}
        />
      )}
    </View>
  );
}

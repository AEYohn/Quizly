import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useUserStore } from "@/stores";

export function useHaptics() {
  const { preferences } = useUserStore();
  const enabled = preferences.vibrationEnabled && Platform.OS !== "web";

  const light = () => {
    if (enabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const medium = () => {
    if (enabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const heavy = () => {
    if (enabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  const success = () => {
    if (enabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const warning = () => {
    if (enabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const error = () => {
    if (enabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const selection = () => {
    if (enabled) {
      Haptics.selectionAsync();
    }
  };

  return {
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
  };
}

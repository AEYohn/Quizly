import { View, Text } from "react-native";
import type { CalibrationResponse } from "@/types/learn";

interface CalibrationBadgeProps {
  calibration: CalibrationResponse | null;
}

function getCalibrationLabel(overconfidenceIndex: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (overconfidenceIndex <= 0.1) {
    return { label: "Well Calibrated", color: "#059669", bg: "#ECFDF5" };
  }
  if (overconfidenceIndex <= 0.25) {
    return { label: "Slightly Overconfident", color: "#D97706", bg: "#FFFBEB" };
  }
  if (overconfidenceIndex <= 0.5) {
    return { label: "Overconfident", color: "#EA580C", bg: "#FFF7ED" };
  }
  return { label: "Very Overconfident", color: "#DC2626", bg: "#FEF2F2" };
}

export function CalibrationBadge({ calibration }: CalibrationBadgeProps) {
  if (!calibration || calibration.calibration.total_responses < 5) return null;

  const { label, color, bg } = getCalibrationLabel(
    calibration.calibration.overconfidence_index,
  );

  return (
    <View style={{ backgroundColor: bg }} className="px-3 py-1 rounded-full mt-1.5">
      <Text style={{ color }} className="text-xs font-medium">
        {label}
      </Text>
    </View>
  );
}

import { View, Text } from "react-native";
import Svg, {
  Rect,
  Line,
  Path,
  Circle,
  Text as SvgText,
  G,
} from "react-native-svg";
import type { CalibrationBucket } from "@/types/learn";

interface CalibrationChartProps {
  buckets: CalibrationBucket[];
  brierScore: number;
  overconfidenceIndex: number;
  totalResponses: number;
}

const CHART_W = 280;
const CHART_H = 200;
const PAD = { top: 20, right: 20, bottom: 30, left: 35 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function toX(frac: number) {
  return PAD.left + frac * PLOT_W;
}
function toY(frac: number) {
  return PAD.top + (1 - frac) * PLOT_H;
}

export function CalibrationChart({
  buckets,
  brierScore,
  overconfidenceIndex,
  totalResponses,
}: CalibrationChartProps) {
  const dataPoints = buckets.filter((b) => b.count > 0);

  const pathPoints = dataPoints.map((b) => ({
    x: toX(b.midpoint),
    y: toY(b.accuracy),
  }));
  const pathD =
    pathPoints.length > 1
      ? `M ${pathPoints.map((p) => `${p.x},${p.y}`).join(" L ")}`
      : "";

  // Overconfidence zone (below diagonal)
  const overconfZone = `M ${toX(0)},${toY(0)} L ${toX(1)},${toY(1)} L ${toX(1)},${toY(0)} Z`;
  // Underconfidence zone (above diagonal)
  const underconfZone = `M ${toX(0)},${toY(0)} L ${toX(0)},${toY(1)} L ${toX(1)},${toY(1)} Z`;

  const brierColor =
    brierScore < 0.15 ? "#10B981" : brierScore < 0.25 ? "#F59E0B" : "#EF4444";
  const overconfColor =
    overconfidenceIndex < 0.1
      ? "#10B981"
      : overconfidenceIndex < 0.2
        ? "#F59E0B"
        : "#EF4444";

  return (
    <View>
      <Svg
        width="100%"
        height={CHART_H}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      >
        {/* Background */}
        <Rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="rgba(0,0,0,0.02)"
          rx={4}
        />

        {/* Zones */}
        <Path d={underconfZone} fill="rgba(16,185,129,0.06)" />
        <Path d={overconfZone} fill="rgba(239,68,68,0.06)" />

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <G key={v}>
            <Line
              x1={toX(0)}
              y1={toY(v)}
              x2={toX(1)}
              y2={toY(v)}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={0.5}
            />
            <Line
              x1={toX(v)}
              y1={toY(0)}
              x2={toX(v)}
              y2={toY(1)}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={0.5}
            />
          </G>
        ))}

        {/* Diagonal (perfect calibration) */}
        <Line
          x1={toX(0)}
          y1={toY(0)}
          x2={toX(1)}
          y2={toY(1)}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* Student curve */}
        {pathD ? (
          <Path
            d={pathD}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Data points */}
        {pathPoints.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="#8B5CF6"
            stroke="#FFFFFF"
            strokeWidth={1.5}
          />
        ))}

        {/* Y-axis labels */}
        {[0, 50, 100].map((v) => (
          <SvgText
            key={`y-${v}`}
            x={PAD.left - 4}
            y={toY(v / 100) + 3}
            textAnchor="end"
            fontSize={9}
            fill="#9CA3AF"
          >
            {v}%
          </SvgText>
        ))}

        {/* X-axis labels */}
        {[0, 50, 100].map((v) => (
          <SvgText
            key={`x-${v}`}
            x={toX(v / 100)}
            y={toY(0) + 14}
            textAnchor="middle"
            fontSize={9}
            fill="#9CA3AF"
          >
            {v}%
          </SvgText>
        ))}

        {/* Axis labels */}
        <SvgText
          x={toX(0.5)}
          y={CHART_H - 2}
          textAnchor="middle"
          fontSize={9}
          fill="#6B7280"
          fontWeight="500"
        >
          Confidence
        </SvgText>
        <SvgText
          x={8}
          y={toY(0.5)}
          textAnchor="middle"
          fontSize={9}
          fill="#6B7280"
          fontWeight="500"
          rotation={-90}
          origin={`8, ${toY(0.5)}`}
        >
          Accuracy
        </SvgText>
      </Svg>

      {/* Summary stats */}
      <View className="flex-row items-center justify-center gap-4 mt-2">
        <View className="flex-row items-center gap-1.5">
          <View className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <Text className="text-xs text-gray-400">Brier</Text>
          <Text className="text-xs font-bold" style={{ color: brierColor }}>
            {brierScore.toFixed(2)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <Text className="text-xs text-gray-400">Overconf.</Text>
          <Text className="text-xs font-bold" style={{ color: overconfColor }}>
            {overconfidenceIndex.toFixed(2)}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">{totalResponses} Qs</Text>
      </View>
    </View>
  );
}

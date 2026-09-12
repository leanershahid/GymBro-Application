import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { RevenueTrendPoint } from '../types/dashboard';

interface RevenueSparklineProps {
  data: RevenueTrendPoint[];
  height?: number;
}

/**
 * Bar dimensions are computed from the data length, so this is one of the
 * few spots that uses inline style/props instead of NativeWind classes —
 * the same SVG-geometry exception used for the Ring/DoubleRing components.
 */
export default function RevenueSparkline({ data, height = 56 }: RevenueSparklineProps) {
  if (!data.length) return null;

  const max = Math.max(...data.map((point) => point.value));
  const barGap = 6;
  const barWidth = 10;
  const chartWidth = data.length * barWidth + (data.length - 1) * barGap;

  return (
    <View style={{ width: chartWidth, height }}>
      <Svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        <Defs>
          <LinearGradient id="sparklineFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7ED321" stopOpacity="1" />
            <Stop offset="1" stopColor="#7ED321" stopOpacity="0.35" />
          </LinearGradient>
        </Defs>
        {data.map((point, index) => {
          const barHeight = Math.max((point.value / max) * height, 4);
          const x = index * (barWidth + barGap);
          const y = height - barHeight;
          const isLast = index === data.length - 1;
          return (
            <Rect
              key={point.label}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={3}
              fill={isLast ? '#7ED321' : 'url(#sparklineFade)'}
              opacity={isLast ? 1 : 0.85}
            />
          );
        })}
      </Svg>
    </View>
  );
}
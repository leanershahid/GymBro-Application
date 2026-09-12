import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { T } from '../../trainers/components/theme';

interface DonutRingProps {
  pct: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

/**
 * Same svg-geometry exception as Revenuesparkline — ring dimensions are
 * computed from props, so this uses inline style/props instead of NativeWind.
 */
export default function DonutRing({ pct, size = 64, strokeWidth = 7, color = T.brand, label }: DonutRingProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={T.line}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ color: T.text, fontSize: size >= 60 ? 15 : 12, fontWeight: '800' }}>
        {label ?? `${Math.round(clamped)}%`}
      </Text>
    </View>
  );
}

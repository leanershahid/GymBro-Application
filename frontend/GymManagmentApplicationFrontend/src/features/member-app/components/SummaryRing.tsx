import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { T } from '../../trainers/components/theme';

interface SummaryRingProps {
  pct: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

/**
 * Same svg-geometry exception as DonutRing/AreaChart — dimensions are
 * computed from props, so this uses inline style/props instead of NativeWind.
 */
export default function SummaryRing({ pct, size = 120, strokeWidth = 12, label, sublabel }: SummaryRingProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={T.brand} />
            <Stop offset="1" stopColor={T.brandGold} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={T.line} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ color: T.text, fontSize: size >= 100 ? 30 : 20, fontWeight: '800', letterSpacing: -0.5 }}>
        {label ?? `${Math.round(clamped)}%`}
      </Text>
      {sublabel && (
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 }}>
          {sublabel}
        </Text>
      )}
    </View>
  );
}

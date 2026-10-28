import React, { useId } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { T, withAlpha } from '../../../../theme';

interface Props {
  /** 0–1 */
  progress: number;
  size?: number;
  stroke?: number;
  /** Solid colour; defaults to the brand green→gold gradient. */
  color?: string;
  /** Big centre text, e.g. "64%". */
  label?: string;
  /** Small text under the label. */
  caption?: string;
  accessibilityLabel?: string;
}

/** Circular progress (goals, occupancy, completion). */
export default function ProgressRing({ progress, size = 72, stroke = 7, color, label, caption, accessibilityLabel }: Props) {
  const gid = `ring-${useId().replace(/:/g, '')}`;
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color ?? T.brandGradient[0]} />
            <Stop offset="1" stopColor={color ?? T.brandGradient[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={withAlpha(T.text, 0.08)} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={`url(#${gid})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)}
        />
      </Svg>
      {label && <Text style={{ color: T.text, fontSize: size > 64 ? 16 : 13, fontWeight: '800' }}>{label}</Text>}
      {caption && <Text style={{ color: T.textSub, fontSize: 11, marginTop: 1 }}>{caption}</Text>}
    </View>
  );
}

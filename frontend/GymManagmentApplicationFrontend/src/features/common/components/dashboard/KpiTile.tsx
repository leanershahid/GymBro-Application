import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../../theme';
import Sparkline from './Sparkline';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  icon: FeatherIconName;
  label: string;
  value: string;
  /** e.g. "+8.1%"; colour follows `positive`. */
  delta?: { label: string; positive: boolean };
  /** Small secondary line, e.g. "4 of 5 active". */
  hint?: string;
  trend?: number[];
  accent?: string;
  width: number;
  onPress?: () => void;
}

/** Compact KPI card: icon, value, delta and an optional sparkline. */
export default function KpiTile({ icon, label, value, delta, hint, trend, accent = T.brand, width, onPress }: Props) {
  const [innerW, setInnerW] = useState(0);
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{
          width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
          backgroundColor: withAlpha(accent, 0.12), borderWidth: 1, borderColor: withAlpha(accent, 0.25),
        }}>
          <Feather name={icon} size={15} color={accent} />
        </View>
        {delta && (
          <Text style={{ color: delta.positive ? T.brand : T.err, fontSize: 11, fontWeight: '700' }}>{delta.label}</Text>
        )}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: T.text, fontSize: 22, fontWeight: '800', marginTop: 12, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{label}</Text>
      {hint && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>{hint}</Text>}
      {trend && trend.length > 1 && (
        <View style={{ marginTop: 10 }} onLayout={e => setInnerW(e.nativeEvent.layout.width)}>
          <Sparkline values={trend} width={innerW} height={28} color={accent} endDot={false} />
        </View>
      )}
    </>
  );

  const style = {
    width, padding: 14, borderRadius: R.lg,
    backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line,
  } as const;

  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${delta ? `, ${delta.label}` : ''}`}
      style={({ pressed }) => [style, pressed && { backgroundColor: T.bgInputActive }]}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}: ${value}${delta ? `, ${delta.label}` : ''}`} style={style}>{body}</View>
  );
}

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import ProgressRing from '../../common/components/dashboard/ProgressRing';
import type { HealthToday } from '../types/member-app.types';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  health: HealthToday | null | undefined;
  /** Width of the card's content box — used to size the rings. */
  width: number;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onPress?: () => void;
}

const RING_META = [
  { key: 'move',  label: 'Move',  unit: 'steps', color: undefined as string | undefined },
  { key: 'train', label: 'Train', unit: 'min',   color: T.brandGold },
  { key: 'stand', label: 'Stand', unit: 'hr',    color: T.sky },
] as const;

const ratio = (c: number, g: number) => Math.max(0, Math.min(1, c / Math.max(1, g)));

/** "Today" card: three activity rings (move / train / stand) with a compact vitals strip below. */
export default function ActivityRingsCard({ health, width, loading, error, onRetry, onPress }: Props) {
  const inner = width - 32; // card padding
  const ringSize = Math.max(60, Math.min(84, Math.floor((inner - 24) / 3) - 6));
  const rings = health?.rings;
  const overall = rings
    ? Math.round(((ratio(rings.move.current, rings.move.goal) + ratio(rings.train.current, rings.train.goal)
        + ratio(rings.stand.current, rings.stand.goal)) / 3) * 100)
    : null;

  const stats: { icon: FeatherIconName; value: string; label: string; color: string }[] = [
    { icon: 'heart',   value: health?.stats.bpm != null ? `${health.stats.bpm}` : '--',              label: 'BPM',    color: T.rose },
    { icon: 'droplet', value: health?.stats.waterLiters != null ? `${health.stats.waterLiters}L` : '--', label: 'Water',  color: T.sky },
    { icon: 'moon',    value: health?.stats.sleepHours != null ? `${health.stats.sleepHours}h` : '--',   label: 'Sleep',  color: T.violet },
    { icon: 'zap',     value: health?.stats.energyPct != null ? `${health.stats.energyPct}%` : '--',     label: 'Energy', color: T.brandGold },
  ];

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '800' }}>Today</Text>
      {overall != null && (
        <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600' }}>
          <Text style={{ color: T.brand, fontWeight: '800' }}>{overall}%</Text> of daily goals
        </Text>
      )}
      {onPress && overall == null && <Feather name="chevron-right" size={18} color={T.textFaint} />}
    </View>
  );

  let body: React.ReactNode;
  if (loading && !health) {
    body = (
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }} accessibilityLabel="Loading activity">
        {RING_META.map(m => (
          <View key={m.key} style={{ width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 7, borderColor: T.bgInputActive }} />
        ))}
      </View>
    );
  } else if (error && !health) {
    body = (
      <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Feather name="alert-circle" size={16} color={T.err} />
        <Text style={{ flex: 1, color: T.textSub, fontSize: 13 }}>Couldn't load today's activity.</Text>
        {onRetry && (
          <Pressable onPress={onRetry} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retry loading activity">
            <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        )}
      </View>
    );
  } else {
    body = (
      <>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          {RING_META.map(m => {
            const r = rings?.[m.key] ?? null;
            const p = r ? ratio(r.current, r.goal) : 0;
            return (
              <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
                <ProgressRing
                  progress={p}
                  size={ringSize}
                  stroke={7}
                  color={m.color}
                  label={r ? `${Math.round(p * 100)}%` : '—'}
                  accessibilityLabel={r ? `${m.label}: ${r.current} of ${r.goal} ${m.unit}` : `${m.label}: no data`}
                />
                <Text style={{ color: T.text, fontSize: 13, fontWeight: '700', marginTop: 8 }}>{m.label}</Text>
                <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 11, marginTop: 1 }}>
                  {r ? `${r.current.toLocaleString()}/${r.goal.toLocaleString()} ${m.unit}` : '—'}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.line }}>
          {stats.map((s, i) => (
            <View
              key={s.label}
              accessible
              accessibilityLabel={`${s.label}: ${s.value === '--' ? 'no data' : s.value}`}
              style={{
                flex: 1, alignItems: 'center', gap: 3,
                borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: T.lineSubtle,
              }}
            >
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(s.color, 0.12) }}>
                <Feather name={s.icon} size={13} color={s.color} />
              </View>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{s.value}</Text>
              <Text style={{ color: T.textSub, fontSize: 11 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </>
    );
  }

  const style = { padding: 16, borderRadius: R.xl, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line } as const;
  return onPress && !error ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Opens your stats"
      style={({ pressed }) => [style, pressed && { backgroundColor: T.bgInputActive }]}
    >
      {header}{body}
    </Pressable>
  ) : (
    <View style={style}>{header}{body}</View>
  );
}

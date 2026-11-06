import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import type { HoursDay, OpenStatus } from '../types/operations.types';
import { normalizeTime, openStateColor } from '../utils/hours';

/** Small building blocks shared by the operations screens. */

/** "● Open · closes 10pm" in the state colour. */
export function OpenStatusBadge({ status, size = 'md' }: { status: OpenStatus; size?: 'sm' | 'md' }) {
  const c = openStateColor(status.state);
  const fs = size === 'sm' ? 12 : 14;
  return (
    <View accessibilityLabel={status.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
      <Text numberOfLines={1} style={{ color: c, fontSize: fs, fontWeight: '700', flexShrink: 1 }}>{status.label}</Text>
    </View>
  );
}

/** The next 7 days, today highlighted; exceptions show their note. */
export function HoursList({ days }: { days: HoursDay[] }) {
  return (
    <View accessibilityRole="list" style={{ gap: 2 }}>
      {days.map(d => (
        <View
          key={d.date}
          accessibilityLabel={`${d.dayLabel}: ${d.isClosed ? 'closed' : d.intervals.join(', ')}${d.note ? `. ${d.note}` : ''}`}
          style={{
            flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: SP.md, borderRadius: R.md,
            backgroundColor: d.isToday ? withAlpha(T.brand, 0.08) : 'transparent',
          }}
        >
          <Text style={{ width: 92, color: d.isToday ? T.text : T.textSub, fontSize: 14, fontWeight: d.isToday ? '700' : '500' }}>
            {d.dayLabel}
          </Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {d.isClosed
              ? <Text style={{ color: T.err, fontSize: 14, fontWeight: '600' }}>Closed</Text>
              : d.intervals.map(i => (
                <Text key={i} style={{ color: d.isToday ? T.text : T.textSub, fontSize: 14, fontVariant: ['tabular-nums'] }}>{i}</Text>
              ))}
            {d.note && (
              <Text style={{ color: d.isException ? T.brandGold : T.textFaint, fontSize: 12, marginTop: 2, textAlign: 'right' }}>{d.note}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Card surface used across the feature. */
export function Card({ children, tint, style }: { children: React.ReactNode; tint?: string; style?: object }) {
  return (
    <View
      style={[{
        backgroundColor: tint ? withAlpha(tint, 0.08) : T.bgInput, borderRadius: R.lg, padding: SP.lg,
        borderWidth: 1, borderColor: tint ? withAlpha(tint, 0.28) : T.line,
      }, style]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.md }}>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
      {right}
    </View>
  );
}

/** Very light markdown: paragraphs, "- " bullets, **bold**. Keeps member-facing notes readable without a renderer. */
export function RichText({ text, color = T.textSub, size = 14 }: { text: string; color?: string; size?: number }) {
  const lines = text.split(/\r?\n/);
  const inline = (s: string, key: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4
        ? <Text key={`${key}-${i}`} style={{ fontWeight: '700', color: T.text }}>{part.slice(2, -2)}</Text>
        : <Text key={`${key}-${i}`}>{part}</Text>);
  return (
    <View style={{ gap: 6 }}>
      {lines.map((raw, idx) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={idx} style={{ height: 4 }} />;
        const bullet = /^\s*[-*•]\s+/.exec(line);
        if (bullet) {
          return (
            <View key={idx} style={{ flexDirection: 'row', gap: 8, paddingLeft: 2 }}>
              <Text style={{ color: T.brand, fontSize: size, lineHeight: size * 1.45 }}>•</Text>
              <Text style={{ flex: 1, color, fontSize: size, lineHeight: size * 1.45 }}>{inline(line.slice(bullet[0].length), `l${idx}`)}</Text>
            </View>
          );
        }
        const heading = /^#{1,3}\s+/.exec(line);
        if (heading) {
          return <Text key={idx} style={{ color: T.text, fontSize: size + 2, fontWeight: '700', marginTop: 4 }}>{line.slice(heading[0].length)}</Text>;
        }
        return <Text key={idx} style={{ color, fontSize: size, lineHeight: size * 1.45 }}>{inline(line, `l${idx}`)}</Text>;
      })}
    </View>
  );
}

/** Compact "HH:mm" input: accepts 6, 0600, 6:00, 18.30 and tidies on blur. Large enough to tap. */
export function TimeField({ value, onChange, label, invalid }: { value: string; onChange: (v: string) => void; label: string; invalid?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); const n = normalizeTime(value); if (n) onChange(n); }}
      placeholder="06:00"
      placeholderTextColor={T.textFaint}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      accessibilityLabel={label}
      accessibilityHint="Time in 24-hour format, for example 06:00 or 22:30"
      style={{
        width: 76, minHeight: 44, textAlign: 'center', color: T.text, fontSize: 15, fontVariant: ['tabular-nums'],
        backgroundColor: focused ? T.bgInputActive : T.bg, borderRadius: R.md, borderWidth: 1,
        borderColor: invalid ? T.err : focused ? T.textDisabled : T.line,
      }}
    />
  );
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** Round 44×44 icon button (meets the minimum tap target). */
export function IconButton({ icon, label, onPress, tone = T.text, disabled }: { icon: FeatherName; label: string; onPress: () => void; tone?: string; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: T.line, opacity: disabled ? 0.4 : 1,
      })}
    >
      <Feather name={icon} size={18} color={tone} />
    </Pressable>
  );
}

/** A full-width row link: icon · label · value · chevron. */
export function LinkRow({ icon, label, value, onPress, hint }: { icon: FeatherName; label: string; value?: string | null; onPress?: () => void; hint?: string }) {
  const content = (
    <>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(T.brand, 0.1), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={T.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '600', marginTop: 2 }}>{value || '—'}</Text>
      </View>
      {onPress && <Feather name="chevron-right" size={18} color={T.textFaint} />}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SP.md, minHeight: 56, paddingVertical: SP.sm };
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${label}: ${value ?? ''}`} accessibilityHint={hint}
      style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}>
      {content}
    </Pressable>
  ) : <View style={style} accessibilityLabel={`${label}: ${value ?? ''}`}>{content}</View>;
}

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export interface ActionItem {
  key: string;
  icon: FeatherIconName;
  title: string;
  subtitle?: string;
  /** Count/urgency chip on the right, e.g. "3" or "Today". */
  badge?: string;
  tone?: 'brand' | 'warn' | 'err' | 'info';
  onPress?: () => void;
}

const TONE = { brand: T.brand, warn: T.brandGold, err: T.err, info: T.sky };

/** "Today" list — the things that need doing, shown before any statistics. */
export default function ActionList({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}>
      {items.map((it, i) => {
        const c = TONE[it.tone ?? 'brand'];
        const row = (
          <>
            <View style={{
              width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: withAlpha(c, 0.12),
            }}>
              <Feather name={it.icon} size={16} color={c} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{it.title}</Text>
              {it.subtitle && <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 1 }}>{it.subtitle}</Text>}
            </View>
            {it.badge && (
              <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: withAlpha(c, 0.15) }}>
                <Text style={{ color: c, fontSize: 11, fontWeight: '800' }}>{it.badge}</Text>
              </View>
            )}
            {it.onPress && <Feather name="chevron-right" size={18} color={T.textFaint} />}
          </>
        );
        const style = {
          flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 14, minHeight: 60,
          borderTopWidth: i === 0 ? 0 : 1, borderTopColor: T.lineSubtle,
        };
        return it.onPress ? (
          <Pressable
            key={it.key}
            onPress={it.onPress}
            accessibilityRole="button"
            accessibilityLabel={[it.title, it.subtitle, it.badge].filter(Boolean).join(', ')}
            style={({ pressed }) => [style, pressed && { backgroundColor: T.bgInputActive }]}
          >
            {row}
          </Pressable>
        ) : (
          <View key={it.key} accessible accessibilityLabel={[it.title, it.subtitle, it.badge].filter(Boolean).join(', ')} style={style}>
            {row}
          </View>
        );
      })}
    </View>
  );
}

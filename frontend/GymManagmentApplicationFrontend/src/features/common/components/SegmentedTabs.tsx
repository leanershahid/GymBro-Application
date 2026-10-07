import React from 'react';
import { View, Pressable, Text, StyleProp, ViewStyle } from 'react-native';
import { T } from '../../../theme';

interface Tab<K extends string> { key: K; label: string }

interface Props<K extends string> {
  tabs: Tab<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
}

/** Pill-style segmented control, exposed to screen readers as a tab list. */
export default function SegmentedTabs<K extends string>({ tabs, value, onChange, style }: Props<K>) {
  return (
    <View
      accessibilityRole="tablist"
      style={[{ flexDirection: 'row', backgroundColor: T.bgInput, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: T.line }, style]}
    >
      {tabs.map(t => {
        const selected = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 8, backgroundColor: selected ? T.brand : 'transparent',
            }}
          >
            <Text numberOfLines={1} style={{ color: selected ? T.onBrand : T.textSub, fontSize: 13, fontWeight: '700' }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

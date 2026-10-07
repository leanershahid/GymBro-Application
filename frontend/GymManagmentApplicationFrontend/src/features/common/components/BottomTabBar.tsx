import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, withAlpha } from '../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export interface TabItem { key: string; label: string; icon: FeatherIconName }

interface Props {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * The one bottom navigation bar (spec: #111 background, outline icons, small green dot under
 * the active tab). Respects the device's bottom inset and exposes proper tab semantics.
 */
export default function BottomTabBar({ tabs, active, onChange }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row', backgroundColor: T.bgNav,
        borderTopWidth: 1, borderTopColor: T.lineSubtle,
        paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), paddingHorizontal: 8,
      }}
    >
      {tabs.map(tab => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 }}
          >
            <View
              style={{
                width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: selected ? withAlpha(T.brand, 0.10) : 'transparent',
              }}
            >
              <Feather name={tab.icon} size={20} color={selected ? T.brand : T.textFaint} />
            </View>
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: selected ? '700' : '500', color: selected ? T.text : T.textFaint }}>
              {tab.label}
            </Text>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: selected ? T.brand : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}

import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import { TabItem } from '../../common/components/BottomTabBar';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import { moduleIcon, normalizeRoute, useMenu } from '../context/AccessContext';
import { AccessModule } from '../types/access.types';

export const MORE_TAB = 'more';
const MAX_TABS = 6;

/**
 * The bottom tab bar, built from the granted main-menu modules. `always` tabs (Profile) are added
 * when the list doesn't hold them, so there is always somewhere to sign out. When there are more
 * than fit, the last slot becomes "More", listing the rest (see {@link MoreMenuScreen}).
 */
export function useRailTabs(always: TabItem[]) {
  const { rail } = useMenu();
  return useMemo(() => {
    const items: TabItem[] = rail.map(m => ({ key: normalizeRoute(m), label: m.name, icon: moduleIcon(m.icon) }));
    for (const a of always) if (!items.some(i => i.key === a.key)) items.push(a);

    if (items.length <= MAX_TABS) return { tabs: items, overflow: [] as AccessModule[] };
    const shown = items.slice(0, MAX_TABS - 1);
    const overflow = rail.filter(m => !shown.some(s => s.key === normalizeRoute(m)));
    return { tabs: [...shown, { key: MORE_TAB, label: 'More', icon: 'menu' as const }], overflow };
  }, [rail, always]);
}

/** The main-menu modules that didn't fit in the tab bar. */
export function MoreMenuScreen({ items, onOpen }: { items: AccessModule[]; onOpen: (route: string) => void }) {
  return (
    <Screen>
      <ScreenHeader eyebrow="Menu" title="More" />
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 48, gap: 10 }}>
        {items.map(m => (
          <Pressable
            key={m.key}
            onPress={() => onOpen(normalizeRoute(m))}
            accessibilityRole="button"
            accessibilityLabel={m.name}
            style={({ pressed }) => ({
              minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16,
              borderRadius: 16, borderWidth: 1, borderColor: T.line,
              backgroundColor: pressed ? withAlpha(T.brand, 0.08) : T.bgPanel,
            })}
          >
            <Feather name={moduleIcon(m.icon)} size={20} color={T.brand} />
            <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '600' }}>{m.name}</Text>
            <Feather name="chevron-right" size={18} color={T.textFaint} />
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

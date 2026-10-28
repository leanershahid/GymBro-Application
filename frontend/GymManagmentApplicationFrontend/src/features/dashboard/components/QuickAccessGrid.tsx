import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { AdminAction } from '../adminActions';

/**
 * Lightweight shortcut grid (icon + label, no card chrome) — sits low on the home screen,
 * below the data, so it doesn't compete with the hero and KPIs.
 */
export default function QuickAccessGrid({ actions, onPress }: { actions: AdminAction[]; onPress: (screen: string) => void }) {
  const { contentW, tileW, tileCols } = useLayout();
  const cols = contentW >= 320 ? Math.max(4, tileCols) : 3;
  const w = tileW(cols, 8);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 14 }}>
      {actions.map(a => (
        <Pressable
          key={a.screen}
          onPress={() => onPress(a.screen)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={{ width: w, alignItems: 'center', gap: 6, paddingVertical: 2 }}
        >
          {({ pressed }) => (
            <>
              <View style={{
                width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                backgroundColor: pressed ? T.brandDim : T.bgInput,
                borderWidth: 1, borderColor: pressed ? T.brandBorder : T.lineSubtle,
              }}>
                <Feather name={a.icon} size={18} color={pressed ? T.brand : T.textSub} />
              </View>
              <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 11, fontWeight: '600', maxWidth: w }}>{a.label}</Text>
            </>
          )}
        </Pressable>
      ))}
    </View>
  );
}

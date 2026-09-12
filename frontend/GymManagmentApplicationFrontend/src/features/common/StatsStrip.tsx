import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Shadow } from '../trainers/components/theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export interface StatStripItem {
  icon: FeatherIconName;
  label: string;
  value: string;
  accent: string;
}

interface StatsStripProps {
  items: StatStripItem[];
  /** When true, renders as a plain inline row with no card background/border/shadow. */
  bare?: boolean;
}

/**
 * A horizontal summary strip that shows icon + value + label for each item.
 * Used across Admin Dashboard, Module Hub, Branches, etc.
 */
export default function StatsStrip({ items, bare = false }: StatsStripProps) {
  return (
    <View
      style={
        bare
          ? { flexDirection: 'row', paddingHorizontal: 4 }
          : [
              {
                flexDirection: 'row',
                backgroundColor: T.bgInput,
                borderWidth: 1,
                borderColor: T.line,
                borderRadius: 20,
                paddingVertical: 16,
                paddingHorizontal: 8,
              },
              Shadow.sm,
            ]
      }
    >
      {items.map((s, i) => (
        <View
          key={s.label}
          style={{
            flex: 1,
            alignItems: 'center',
            borderRightWidth: bare ? 0 : i < items.length - 1 ? 1 : 0,
            borderRightColor: T.line,
            gap: 6,
          }}
        >
          {/* Icon badge */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: s.accent + '18',
              borderWidth: 1,
              borderColor: s.accent + '30',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name={s.icon} size={16} color={s.accent} />
          </View>

          {/* Value */}
          <Text style={{ color: s.accent, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>
            {s.value}
          </Text>

          {/* Label */}
          <Text style={{ color: T.textSub, fontSize: 11, marginTop: -2 }}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

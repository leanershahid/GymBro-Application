import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface EmptyStateProps {
  icon: FeatherIconName;
  title: string;
  subtitle?: string;
  /** 'error' uses the danger colour — use it for failed loads with a Retry action. */
  tone?: 'default' | 'error';
  action?: { label: string; onPress: () => void };
}

/** Empty and error states for lists and screens. */
export default function EmptyState({ icon, title, subtitle, tone = 'default', action }: EmptyStateProps) {
  const c = tone === 'error' ? T.err : T.brand;
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 20 }}
    >
      <View
        style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: withAlpha(c, 0.10), borderWidth: 1, borderColor: withAlpha(c, 0.25),
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}
      >
        <Feather name={icon} size={26} color={c} />
      </View>
      <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {subtitle && (
        <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center', marginTop: 4, maxWidth: 280 }}>
          {subtitle}
        </Text>
      )}
      {action && (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => ({
            marginTop: 16, minHeight: 44, paddingHorizontal: 20, borderRadius: 999,
            alignItems: 'center', justifyContent: 'center', borderWidth: 1,
            borderColor: withAlpha(c, 0.35), backgroundColor: pressed ? withAlpha(c, 0.15) : withAlpha(c, 0.08),
          })}
        >
          <Text style={{ color: c, fontSize: 14, fontWeight: '700' }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

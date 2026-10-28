import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { T } from '../../../theme';

interface Props {
  title: string;
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  trailing?: React.ReactNode;
}

/** Section title row used on the member home screen. */
export default function HomeSectionHeader({ title, action, trailing }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, color: T.text, fontSize: 17, fontWeight: '800' }}>
        {title}
      </Text>
      {trailing}
      {action && (
        <Pressable onPress={action.onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={action.accessibilityLabel ?? action.label}>
          <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

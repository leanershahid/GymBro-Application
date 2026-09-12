import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

interface SectionHeaderProps {
  title: string;
  onPressAction?: () => void;
  actionLabel?: string;
}

export default function SectionHeader({ title, onPressAction, actionLabel = 'View all' }: SectionHeaderProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <Text style={{ color: T.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
      {onPressAction && (
        <Pressable
          onPress={onPressAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: T.brand,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Feather name="arrow-up-right" size={18} color={T.onBrand} />
        </Pressable>
      )}
    </View>
  );
}

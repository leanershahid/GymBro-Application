import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface QuickActionButtonProps {
  icon: FeatherIconName;
  label: string;
  onPress?: () => void;
}

export default function QuickActionButton({ icon, label, onPress }: QuickActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{ alignItems: 'center', flex: 1 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: T.bgInputActive,
        borderWidth: 1, borderColor: T.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Feather name={icon} size={18} color={T.text} />
      </View>
      <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

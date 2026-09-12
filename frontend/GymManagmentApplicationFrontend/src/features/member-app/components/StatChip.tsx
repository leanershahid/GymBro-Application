import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface StatChipProps {
  icon: FeatherIconName;
  value: string;
  label: string;
  color: string;
}

export default function StatChip({ icon, value, label, color }: StatChipProps) {
  return (
    <View
      style={{
        flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12,
        backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: T.line,
      }}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Feather name={icon} size={16} color={color} />
      <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: T.textSub, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

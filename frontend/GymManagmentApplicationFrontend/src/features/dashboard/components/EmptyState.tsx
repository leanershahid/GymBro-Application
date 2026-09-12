import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface EmptyStateProps {
  icon: FeatherIconName;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
      <View
        style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder,
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}
      >
        <Feather name={icon} size={26} color={T.brand} />
      </View>
      <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {subtitle && (
        <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center', marginTop: 4, maxWidth: 260 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

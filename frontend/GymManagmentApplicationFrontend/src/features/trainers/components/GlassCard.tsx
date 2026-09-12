import React from 'react';
import { View, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  neonBorder?: boolean;
  elevated?: boolean;
  variant?: 'default' | 'raised' | 'brand';
}

export default function GlassCard({ children, style, neonBorder, elevated, variant = 'default' }: Props) {
  const v = neonBorder ? 'brand' : elevated ? 'raised' : variant;

  const cls = {
    default: 'bg-surface border-line',
    raised:  'bg-elevated border-line',
    brand:   'bg-[rgba(126,211,33,0.10)] border-[rgba(126,211,33,0.25)]',
  }[v];

  return (
    <View className={`rounded-2xl border overflow-hidden ${cls}`} style={style}>
      {children}
    </View>
  );
}

import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { T } from '../../../theme';

interface Props {
  /** Fill the screen (true) or sit inline in a list area (false). */
  fullScreen?: boolean;
  label?: string;
}

/** Standard spinner for loading screens and sections. */
export default function LoadingState({ fullScreen = false, label }: Props) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      style={fullScreen
        ? { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }
        : { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 12 }}
    >
      <ActivityIndicator color={T.brand} size="large" />
      {label && <Text style={{ color: T.textSub, fontSize: 13 }}>{label}</Text>}
    </View>
  );
}

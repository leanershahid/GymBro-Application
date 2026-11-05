import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';

export interface DetailRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  /** Smaller icon tile and text (profile sheet). */
  compact?: boolean;
  /** Clamp the value; omit to let it wrap freely. */
  numberOfLines?: number;
}

/** Icon tile + uppercase label + value row used on detail pages and profile sheets (ARCH-062). */
export default function DetailRow({ icon, label, value, compact, numberOfLines }: DetailRowProps) {
  const tile = compact ? 36 : 40;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md }}>
      <View style={{
        width: tile, height: tile, borderRadius: R.md, backgroundColor: T.bgInputActive,
        alignItems: 'center', justifyContent: 'center', marginRight: SP.md,
      }}>
        <Feather name={icon} size={compact ? 16 : 17} color={T.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ color: T.text, fontSize: compact ? 14 : 15, fontWeight: '600' }} numberOfLines={numberOfLines}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export { DetailRow };

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';

export interface QuickAction {
  key: string;
  label: string;
  hint: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
}

/** The "+" sheet: the front desk's everyday actions, one tap from anywhere on Home. */
export default function QuickCreateSheet({ visible, actions, onClose }: { visible: boolean; actions: QuickAction[]; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Quick actions">
      <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 8 }}>
        {actions.map(a => (
          <Pressable
            key={a.key}
            onPress={() => { onClose(); a.onPress(); }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityHint={a.hint}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 14, borderRadius: 14,
              borderWidth: 1, borderColor: T.line, backgroundColor: pressed ? withAlpha(T.brand, 0.1) : T.bgInput,
            })}
          >
            <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder }}>
              <Feather name={a.icon} size={18} color={T.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{a.label}</Text>
              <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{a.hint}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';

interface Props {
  greeting: string;
  firstName: string;
  branchName?: string | null;
}

/** Compact greeting row: avatar initial, "Good morning, Name", branch chip. */
export default function TrainerHomeHeader({ greeting, firstName, branchName }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
          backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 1.5, borderColor: withAlpha(T.brand, 0.5),
        }}
      >
        <Text style={{ color: T.brand, fontSize: 17, fontWeight: '800' }}>{firstName[0]?.toUpperCase() ?? 'C'}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{greeting}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 }}>
          <Text accessibilityRole="header" numberOfLines={1} style={{ color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 }}>
            {firstName}
          </Text>
          {!!branchName && (
            <View
              accessibilityLabel={`Branch ${branchName}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1,
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill,
                backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line,
              }}
            >
              <Feather name="map-pin" size={11} color={T.textSub} />
              <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 11, fontWeight: '600', flexShrink: 1 }}>{branchName}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

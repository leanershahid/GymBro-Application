import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Shadow } from '../../trainers/components/theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface StatTileProps {
  icon: FeatherIconName;
  label: string;
  value: string;
  deltaLabel?: string;
  deltaPositive?: boolean;
}

const glass = {
  backgroundColor: T.bgInput,
  borderWidth: 1,
  borderColor: T.line,
  ...Shadow.sm,
};

export default function StatTile({ icon, label, value, deltaLabel, deltaPositive = true }: StatTileProps) {
  return (
    <View style={[glass, { borderRadius: 20, padding: 16, width: '47%' }]}>
      {/* Icon badge */}
      <View style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: T.brandDim,
        borderWidth: 1, borderColor: T.brandBorder,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <Feather name={icon} size={18} color={T.brand} />
      </View>

      <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: T.textSub, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
        {label}
      </Text>

      {deltaLabel && (
        <View style={{
          alignSelf: 'flex-start', marginTop: 8,
          backgroundColor: deltaPositive ? 'rgba(126,211,33,0.10)' : 'rgba(255,77,77,0.10)',
          borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: deltaPositive ? T.brand : T.err }}>
            {deltaLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

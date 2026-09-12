import React from 'react';
import { View, Text, ImageBackground, ImageSourcePropType } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface StatCardImageProps {
  icon: FeatherIconName;
  label: string;
  value: string;
  image: ImageSourcePropType;
  deltaLabel?: string;
}

export default function StatCardImage({ icon, label, value, image, deltaLabel }: StatCardImageProps) {
  return (
    <View
      style={{
        borderRadius: 20, overflow: 'hidden', width: '47%',
        borderWidth: 1, borderColor: T.line,
      }}
      accessibilityRole="image"
      accessibilityLabel={`${label}: ${value}`}
    >
      <ImageBackground source={image} style={{ width: '100%' }} imageStyle={{ opacity: 0.5 }} resizeMode="cover">
        <View style={{ backgroundColor: 'rgba(10,15,10,0.55)', padding: 16 }}>
          <View
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder,
              alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}
          >
            <Feather name={icon} size={18} color={T.brand} />
          </View>

          <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1}>
            {value}
          </Text>
          <Text style={{ color: T.textSub, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
            {label}
          </Text>

          {deltaLabel && (
            <View
              style={{
                alignSelf: 'flex-start', marginTop: 8,
                backgroundColor: T.brandDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
                borderWidth: 1, borderColor: T.brandBorder,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: T.brand }}>{deltaLabel}</Text>
            </View>
          )}
        </View>
      </ImageBackground>
    </View>
  );
}

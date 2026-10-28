import React from 'react';
import { View, Text, ImageBackground, ImageSourcePropType, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  image: ImageSourcePropType;
  eyebrow?: string;
  title: string;
  /** The one number this screen is about, e.g. "₹12.4L". */
  value?: string;
  valueCaption?: string;
  /** Growth/delta chip, e.g. "+12.4%" (positive = green, negative = red). */
  delta?: { label: string; positive: boolean };
  cta?: { label: string; icon?: FeatherIconName; onPress: () => void };
  /** Anything extra under the value (e.g. a Sparkline or rings). */
  children?: React.ReactNode;
  height?: number;
}

/**
 * Photo-backed hero card (spec: moody gym photography under a dark gradient). Holds the
 * screen's single most important number so the hierarchy is obvious at a glance.
 */
export default function PhotoHero({ image, eyebrow, title, value, valueCaption, delta, cta, children, height }: Props) {
  const { height: screenH } = useWindowDimensions();
  const h = height ?? Math.max(220, Math.min(300, screenH * 0.32));

  return (
    <View style={{ height: h, borderRadius: R.xl, overflow: 'hidden', backgroundColor: T.bgInput }}>
      {/* imageStyle sizes the photo to the card: on web a require()'d image otherwise renders at
          its intrinsic pixel size (e.g. 1024×1024) and only its top-left corner shows. */}
      <ImageBackground
        source={image}
        resizeMode="cover"
        style={{ flex: 1 }}
        imageStyle={{ width: '100%', height: '100%' }}
        accessibilityIgnoresInvertColors
      >
        <LinearGradient
          colors={[withAlpha(T.black, 0.15), withAlpha(T.black, 0.55), withAlpha(T.bg, 0.96)]}
          locations={[0, 0.45, 1]}
          style={{ flex: 1, padding: 18, justifyContent: 'flex-end' }}
        >
          {eyebrow && (
            <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
              {eyebrow}
            </Text>
          )}
          <Text numberOfLines={2} style={{ color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{title}</Text>

          {(value || delta) && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {value && (
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: T.text, fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>
                  {value}
                </Text>
              )}
              {delta && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6,
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                  backgroundColor: withAlpha(delta.positive ? T.brand : T.err, 0.18),
                }}>
                  <Feather name={delta.positive ? 'trending-up' : 'trending-down'} size={12} color={delta.positive ? T.brand : T.err} />
                  <Text style={{ color: delta.positive ? T.brand : T.err, fontSize: 12, fontWeight: '700' }}>{delta.label}</Text>
                </View>
              )}
            </View>
          )}
          {valueCaption && <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{valueCaption}</Text>}
          {children && <View style={{ marginTop: 12 }}>{children}</View>}

          {cta && (
            <Pressable
              onPress={cta.onPress}
              accessibilityRole="button"
              accessibilityLabel={cta.label}
              style={({ pressed }) => ({
                position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
                minHeight: 40, paddingHorizontal: 14, borderRadius: 999,
                backgroundColor: pressed ? T.brandDark : T.brand,
              })}
            >
              {cta.icon && <Feather name={cta.icon} size={15} color={T.onBrand} />}
              <Text style={{ color: T.onBrand, fontSize: 13, fontWeight: '800' }}>{cta.label}</Text>
            </Pressable>
          )}
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

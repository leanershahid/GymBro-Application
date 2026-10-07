import React from 'react';
import { View, Text, Pressable, ImageBackground, ImageSourcePropType, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';

interface LiveCoachCardProps {
  name: string;
  specialty: string;
  rating: number;
  image: ImageSourcePropType;
  onPress?: () => void;
}

/**
 * Trainer name/specialty/rating come from real TrainerProfile data — the
 * "LIVE" badge is a static placeholder, since there's no real-time
 * presence/streaming infrastructure behind this yet.
 */
export default function LiveCoachCard({ name, specialty, rating, image, onPress }: LiveCoachCardProps) {
  const { width: winW } = useWindowDimensions();
  // ~36% of the window, clamped, keeping the original 140×176 aspect ratio.
  const cardW = Math.round(Math.min(200, Math.max(130, winW * 0.36)));
  const cardH = Math.round(cardW * (176 / 140));
  return (
    <Pressable onPress={onPress} style={{ width: cardW }} accessibilityRole="button" accessibilityLabel={`${name}, ${specialty}`}>
      <View style={{ width: cardW, height: cardH, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
        <ImageBackground source={image} style={{ flex: 1 }} resizeMode="cover">
          <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: T.err, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: T.text }} />
              <Text style={{ color: T.text, fontSize: 11, fontWeight: '800' }}>LIVE</Text>
            </View>

            <View style={{ alignSelf: 'flex-end', backgroundColor: withAlpha(T.black, 0.6), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="award" size={10} color={T.brandGold} />
              <Text style={{ color: T.text, fontSize: 11, fontWeight: '700' }}>{rating.toFixed(1)}</Text>
            </View>
          </View>
        </ImageBackground>
      </View>
      <Text style={{ color: T.text, fontSize: 13, fontWeight: '700', marginTop: 8 }} numberOfLines={1}>{name}</Text>
      <Text style={{ color: T.textSub, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{specialty}</Text>
    </Pressable>
  );
}

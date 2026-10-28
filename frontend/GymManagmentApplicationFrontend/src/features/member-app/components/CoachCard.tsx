import React from 'react';
import { View, Text, Pressable, Image, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';

interface CoachCardProps {
  name: string;
  /** First real specialization; the line is omitted when null. */
  specialty: string | null;
  /** Real rating; the badge is omitted when null. */
  rating: number | null;
  /** TrainerSummary.profileImage; falls back to an initials avatar when null. */
  imageUrl: string | null;
  onPress?: () => void;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

/** A gym coach in the horizontal "Coaches" rail. Every value shown comes from the trainer record. */
export default function CoachCard({ name, specialty, rating, imageUrl, onPress }: CoachCardProps) {
  const { width: winW } = useWindowDimensions();
  // ~36% of the window, clamped, keeping a 140×176 aspect ratio.
  const cardW = Math.round(Math.min(200, Math.max(130, winW * 0.36)));
  const cardH = Math.round(cardW * (176 / 140));
  const initials = initialsOf(name);
  const label = [name, specialty, rating != null ? `rated ${rating.toFixed(1)}` : null].filter(Boolean).join(', ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ width: cardW }}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
    >
      <View style={{ width: cardW, height: cardH, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: T.line, backgroundColor: withAlpha(T.brand, 0.12) }}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: Math.round(cardW * 0.46), height: Math.round(cardW * 0.46), borderRadius: R.full,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: withAlpha(T.brand, 0.18), borderWidth: 1.5, borderColor: withAlpha(T.brand, 0.4),
            }}>
              {initials
                ? <Text style={{ color: T.brand, fontSize: Math.round(cardW * 0.16), fontWeight: '800' }}>{initials}</Text>
                : <Feather name="user" size={Math.round(cardW * 0.18)} color={T.brand} />}
            </View>
          </View>
        )}

        {rating != null && (
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: withAlpha(T.black, 0.6), borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="award" size={10} color={T.brandGold} />
            <Text style={{ color: T.text, fontSize: 11, fontWeight: '700' }}>{rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: T.text, fontSize: 13, fontWeight: '700', marginTop: 8 }} numberOfLines={1}>{name}</Text>
      {!!specialty && (
        <Text style={{ color: T.textSub, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{specialty}</Text>
      )}
    </Pressable>
  );
}

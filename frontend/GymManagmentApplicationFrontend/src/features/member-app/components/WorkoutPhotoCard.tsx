import React from 'react';
import { View, Text, Pressable, ImageBackground, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';

interface Props {
  title: string;
  durationMin: number | null;
  difficulty: string | null;
  exercisesCount: number;
  image: ImageSourcePropType;
  width: number;
  onPress: () => void;
}

/** Photo-led card for the horizontal "More workouts" rail. */
export default function WorkoutPhotoCard({ title, durationMin, difficulty, exercisesCount, image, width, onPress }: Props) {
  const height = Math.round(width * 0.78);
  const meta = [difficulty, `${exercisesCount} exercises`].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, durationMin != null ? `${durationMin} minutes` : null, meta].filter(Boolean).join(', ')}
      style={({ pressed }) => ({ width, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ width, height, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: T.line, backgroundColor: T.bgInput }}>
        <ImageBackground source={image} resizeMode="cover" style={{ flex: 1 }} accessibilityIgnoresInvertColors>
          <LinearGradient
            colors={[withAlpha(T.black, 0.05), withAlpha(T.black, 0.45), withAlpha(T.bg, 0.95)]}
            locations={[0, 0.5, 1]}
            style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}
          >
            {durationMin != null ? (
            <View style={{
              alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: T.overlay,
            }}>
              <Feather name="clock" size={11} color={T.brand} />
              <Text style={{ color: T.text, fontSize: 11, fontWeight: '700' }}>{durationMin} min</Text>
            </View>
            ) : <View />}
            <View>
              <Text numberOfLines={2} style={{ color: T.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
              <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>{meta}</Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    </Pressable>
  );
}

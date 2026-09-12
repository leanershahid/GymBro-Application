import React from 'react';
import { View, Text, Pressable, ImageBackground, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';

interface FeaturedWorkoutCardProps {
  category: string;
  title: string;
  dayLabel?: string;
  exercisesCount: number;
  durationMin: number;
  calories?: number;
  image: ImageSourcePropType;
  onPress: () => void;
  onExpand?: () => void;
}

export default function FeaturedWorkoutCard({
  category, title, dayLabel, exercisesCount, durationMin, calories, image, onPress, onExpand,
}: FeaturedWorkoutCardProps) {
  return (
    <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: T.line }}>
      <ImageBackground source={image} style={{ width: '100%' }} resizeMode="cover">
        <View style={{ backgroundColor: 'rgba(10,15,10,0.35)', padding: 16 }}>
          {/* Top row: pills + expand */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 220 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ color: T.onBrand, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {category}
                </Text>
              </View>
              {dayLabel && (
                <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
                  <Text style={{ color: T.text, fontSize: 11, fontWeight: '700' }}>{dayLabel}</Text>
                </View>
              )}
            </View>

            {onExpand && (
              <Pressable
                onPress={onExpand} hitSlop={10}
                accessibilityRole="button" accessibilityLabel="Expand workout"
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="arrow-up-right" size={16} color={T.text} />
              </Pressable>
            )}
          </View>

          {/* Bottom content over gradient scrim */}
          <LinearGradient
            colors={['rgba(10,15,10,0)', 'rgba(10,15,10,0.94)']}
            style={{ marginHorizontal: -16, marginBottom: -16, paddingHorizontal: 16, paddingTop: 40, paddingBottom: 18 }}
          >
            <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              {category}
            </Text>
            <Text style={{ color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 29, marginBottom: 10 }}>
              {title}
            </Text>

            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather name="activity" size={13} color={T.textSub} />
                <Text style={{ color: T.textSub, fontSize: 12 }}>{exercisesCount} exercises</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather name="calendar" size={13} color={T.textSub} />
                <Text style={{ color: T.textSub, fontSize: 12 }}>{durationMin} min</Text>
              </View>
              {calories !== undefined && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="zap" size={13} color={T.textSub} />
                  <Text style={{ color: T.textSub, fontSize: 12 }}>{calories} kcal</Text>
                </View>
              )}
            </View>

            <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Start ${title}`}>
              <LinearGradient
                colors={T.brandGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <Feather name="play" size={15} color={T.onBrand} />
                <Text style={{ color: T.onBrand, fontSize: 15, fontWeight: '800' }}>Start Workout</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      </ImageBackground>
    </View>
  );
}

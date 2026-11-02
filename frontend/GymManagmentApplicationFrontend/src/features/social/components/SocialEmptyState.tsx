import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';

interface Props {
  /** 'feed' = nobody has posted yet; 'error' = the feed failed to load. */
  kind: 'feed' | 'error';
  onCreate?: () => void;
  onRetry?: () => void;
  message?: string;
}

/** Friendly empty and error states for the feed. */
export default function SocialEmptyState({ kind, onCreate, onRetry, message }: Props) {
  const error = kind === 'error';
  const c = error ? T.err : T.brand;
  return (
    <View accessibilityRole={error ? 'alert' : undefined} style={{ alignItems: 'center', paddingVertical: 56, paddingHorizontal: SP.xl }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(c, 0.1), borderWidth: 1, borderColor: withAlpha(c, 0.28), marginBottom: SP.lg }}>
        <Feather name={error ? 'wifi-off' : 'camera'} size={34} color={c} />
      </View>
      <Text style={{ color: T.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
        {error ? 'Couldn’t load the feed' : 'No posts yet'}
      </Text>
      <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 300 }}>
        {message ?? (error ? 'Check your connection and try again.' : 'Be the first to share a workout, a meal or a win with your gym.')}
      </Text>
      {(error ? onRetry : onCreate) && (
        <Pressable
          onPress={error ? onRetry : onCreate}
          accessibilityRole="button"
          style={({ pressed }) => ({ marginTop: SP.lg, height: 46, paddingHorizontal: 24, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pressed ? T.brandDark : T.brand })}
        >
          <Feather name={error ? 'refresh-cw' : 'plus'} size={16} color={T.onBrand} />
          <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '800' }}>{error ? 'Try again' : 'Create the first post'}</Text>
        </Pressable>
      )}
    </View>
  );
}

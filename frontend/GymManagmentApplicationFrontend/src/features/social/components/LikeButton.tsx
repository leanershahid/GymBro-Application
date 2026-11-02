import React, { useEffect, useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../../theme';

interface Props {
  liked: boolean;
  onPress: () => void;
  size?: number;
}

/** Heart that springs when it flips to liked. The state itself lives in the feed cache (optimistic). */
export default function LikeButton({ liked, onPress, size = 26 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!liked) return;
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [liked, scale]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
      accessibilityState={{ selected: liked }}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={size} color={liked ? T.rose : T.text} />
      </Animated.View>
    </Pressable>
  );
}

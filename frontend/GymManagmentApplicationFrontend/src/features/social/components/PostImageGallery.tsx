import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { SocialImage } from '../api/social.types';

/** An image that fades in once loaded (lazy: the host only mounts it when its slide is near). */
function FadeImage({ uri, label }: { uri: string; label: string }) {
  const op = useRef(new Animated.Value(0)).current;
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={34} color={T.textFaint} /></View>;
  }
  return (
    <Animated.Image
      source={{ uri }}
      accessibilityLabel={label}
      accessibilityIgnoresInvertColors
      resizeMode="cover"
      onError={() => setFailed(true)}
      onLoad={() => Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }).start()}
      style={{ width: '100%', height: '100%', opacity: op }}
    />
  );
}

interface Props {
  images: SocialImage[];
  caption?: string | null;
  /** Double-tap on the picture: the Instagram "like". */
  onDoubleTap?: () => void;
}

/** 4:5 swipeable gallery with page dots, a counter badge and a double-tap heart. */
export default function PostImageGallery({ images, caption, onDoubleTap }: Props) {
  const [w, setW] = useState(0);
  const [index, setIndex] = useState(0);
  const heart = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const h = Math.round(w * 1.25);

  useEffect(() => { setIndex(0); }, [images.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    setIndex(Math.max(0, Math.min(images.length - 1, Math.round(e.nativeEvent.contentOffset.x / w))));
  };

  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320 && onDoubleTap) {
      onDoubleTap();
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.delay(380),
        Animated.timing(heart, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
    lastTap.current = now;
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))} style={{ width: '100%', backgroundColor: T.bgInputActive }}>
      {w > 0 && (
        <View style={{ height: h }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            scrollEnabled={images.length > 1}
          >
            {images.map((img, i) => (
              <Pressable key={img.id} onPress={tap} accessibilityRole="image" accessibilityLabel={`${caption ? `${caption}. ` : ''}Photo ${i + 1} of ${images.length}`} style={{ width: w, height: h }}>
                {Math.abs(i - index) <= 1 ? <FadeImage uri={img.thumbUrl || img.url} label={`Photo ${i + 1}`} /> : null}
              </Pressable>
            ))}
          </ScrollView>

          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) }] }}
          >
            <Ionicons name="heart" size={96} color={T.rose} />
          </Animated.View>

          {images.length > 1 && (
            <>
              <View style={{ position: 'absolute', top: SP.md, right: SP.md, paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill, backgroundColor: withAlpha(T.black, 0.6) }}>
                <Text style={{ color: T.text, fontSize: 12, fontWeight: '700' }}>{index + 1}/{images.length}</Text>
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', bottom: SP.md, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                {images.map((img, i) => (
                  <View key={img.id} style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? T.brand : withAlpha(T.text, 0.55) }} />
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

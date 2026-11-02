import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Image, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP, withAlpha } from '../../../theme';
import { IconButton, ProductImage } from './ui';

function Dots({ count, index, onPick }: { count: number; index: number; onPick?: (i: number) => void }) {
  if (count < 2) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      {Array.from({ length: count }, (_, i) => (
        <Pressable
          key={i}
          onPress={() => onPick?.(i)}
          accessibilityRole="button"
          accessibilityLabel={`Photo ${i + 1} of ${count}`}
          accessibilityState={{ selected: i === index }}
          style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: i === index ? 16 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? T.brand : withAlpha(T.text, 0.35) }} />
        </Pressable>
      ))}
    </View>
  );
}

/** Swipeable product photos with dots; tap opens a full-screen viewer. */
export default function Gallery({ images, name, soldOut }: { images: string[]; name: string; soldOut?: boolean }) {
  const [w, setW] = useState(0);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const ref = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== index) setIndex(i);
  };
  const goTo = (i: number) => { ref.current?.scrollTo({ x: i * w, animated: true }); setIndex(i); };

  if (!images.length) {
    return <ProductImage uri={null} style={{ width: '100%', aspectRatio: 1, borderRadius: 20 }} iconSize={56} />;
  }

  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)}>
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {images.map((uri, i) => (
            <Pressable
              key={uri + i}
              onPress={() => setViewer(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${name}, photo ${i + 1} of ${images.length}. Open full screen`}
            >
              <ProductImage uri={uri} style={{ width: w || 1, aspectRatio: 1, opacity: soldOut ? 0.6 : 1 }} iconSize={56} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ marginTop: SP.sm }}>
        <Dots count={images.length} index={index} onPick={goTo} />
      </View>
      <Viewer visible={viewer} onClose={() => setViewer(false)} images={images} start={index} name={name} />
    </View>
  );
}

function Viewer({ visible, onClose, images, start, name }: { visible: boolean; onClose: () => void; images: string[]; start: number; name: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);
  const ref = useRef<ScrollView>(null);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent={false} onShow={() => {
      setIndex(start);
      ref.current?.scrollTo({ x: start * width, animated: false });
    }}>
      <View style={{ flex: 1, backgroundColor: T.black }}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: start * width, y: 0 }}
          onScroll={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={16}
        >
          {images.map((uri, i) => (
            <View key={uri + i} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri }} resizeMode="contain" accessibilityLabel={`${name}, photo ${i + 1}`} style={{ width, height: height * 0.8 }} />
            </View>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', top: insets.top + SP.md, left: SP.lg, right: SP.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{index + 1} / {images.length}</Text>
          <IconButton icon="x" label="Close photo viewer" onPress={onClose} />
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + SP.xl, left: 0, right: 0 }}>
          <Dots count={images.length} index={index} onPick={i => { ref.current?.scrollTo({ x: i * width, animated: true }); setIndex(i); }} />
        </View>
      </View>
    </Modal>
  );
}

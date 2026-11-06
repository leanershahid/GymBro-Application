import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';

/**
 * Scrollable step content + a sticky footer that clears the home indicator and the keyboard.
 * Content is width-capped so it reads well on web / tablets too.
 */
export default function StepLayout({ children, footer, onScroll, onContentSizeChange, onLayout, scrollRef }: {
  children: React.ReactNode;
  footer: React.ReactNode;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange?: (w: number, h: number) => void;
  onLayout?: (h: number) => void;
  scrollRef?: React.Ref<ScrollView>;
}) {
  const insets = useSafeAreaInsets();
  const { hPad } = useLayout();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: SP.md, paddingBottom: SP.xxl, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        onScroll={onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={onContentSizeChange}
        onLayout={e => onLayout?.(e.nativeEvent.layout.height)}
      >
        {children}
      </ScrollView>
      <View style={{
        paddingHorizontal: hPad, paddingTop: SP.md, paddingBottom: Math.max(insets.bottom, SP.lg),
        borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bg,
      }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: SP.sm }}>{footer}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

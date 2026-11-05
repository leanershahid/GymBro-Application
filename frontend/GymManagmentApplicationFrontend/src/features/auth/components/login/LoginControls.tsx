import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rs } from '../../../../utils/scale';
import { T, Shadow } from '../../../../theme';
import { styles } from './loginStyles';

// ─── CTA Button ───────────────────────────────────────────────────────────────
export function CTAButton({
  label,
  onPress,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.ctaButton, loading && { backgroundColor: T.brandDark }]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={loading}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        {loading
          ? <ActivityIndicator color={T.onBrand} />
          : <Text style={styles.ctaText}>{label}</Text>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
export function InputField({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  rightElement,
  accessibilityLabel,
  textContentType,
  autoComplete,
  inputRef,
  returnKeyType,
  onSubmitEditing,
}: {
  accessibilityLabel: string;
  inputRef?: React.Ref<TextInput>;
  returnKeyType?: 'next' | 'go';
  onSubmitEditing?: () => void;
  textContentType?: 'username' | 'password' | 'oneTimeCode' | 'newPassword';
  autoComplete?: 'email' | 'password' | 'one-time-code' | 'new-password';
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [T.line, T.brand],
  });

  return (
    <Animated.View style={[styles.inputWrapper, { borderColor }]}>
      <TextInput
        ref={inputRef}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={returnKeyType !== 'next'}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor={T.textFaint}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        underlineColorAndroid="transparent"
        accessibilityLabel={accessibilityLabel}
        textContentType={textContentType}
        autoComplete={autoComplete}
      />
      {rightElement}
    </Animated.View>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
/** Inline form error: left accent bar + icon, shakes and fades in on each new message. */
export function ErrorBanner({ message }: { message: string }) {
  const shake = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    shake.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.6, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]),
    ]).start();
  }, [message]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  return (
    <Animated.View
      style={[styles.errorBanner, Shadow.sm, { opacity: fade, transform: [{ translateX }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.errorAccent} />
      <View style={styles.errorIconWrap}>
        <Ionicons name="alert-circle" size={rs(18)} color={T.err} />
      </View>
      <Text style={styles.errorText}>{message}</Text>
    </Animated.View>
  );
}

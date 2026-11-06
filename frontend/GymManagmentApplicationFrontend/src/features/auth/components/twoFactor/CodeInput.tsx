import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { T, withAlpha } from '../../../../theme';
import { CODE_LENGTH, sanitizeCode } from '../../utils/twoFactor';

/**
 * Six code boxes backed by ONE real TextInput laid invisibly over them. A single input is what
 * makes OS autofill work (iOS "From Messages"/password manager, Android SMS suggestions, Chrome's
 * one-time-code) and paste of the whole code; the boxes are just a picture of its value.
 * Calls onComplete once when the sixth digit arrives (auto-submit).
 */
export default function CodeInput({
  value, onChange, onComplete, error = false, disabled = false, autoFocus = true, accessibilityLabel = 'Six-digit code',
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (code: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const lastCompleted = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === CODE_LENGTH && lastCompleted.current !== value) {
      lastCompleted.current = value;
      onComplete?.(value);
    }
    if (value.length < CODE_LENGTH) lastCompleted.current = null;
  }, [value, onComplete]);

  const active = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessible={false}
      style={{ alignSelf: 'stretch' }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = value[i] ?? '';
          const isActive = focused && i === active;
          return (
            <View
              key={i}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={{
                flex: 1, maxWidth: 56, aspectRatio: 0.85, borderRadius: 14, borderWidth: isActive ? 2 : 1,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: digit ? T.bgInputActive : T.bgInput,
                borderColor: error ? T.err : isActive ? T.brand : digit ? withAlpha(T.brand, 0.3) : T.line,
              }}
            >
              <Text style={{ color: T.text, fontSize: 24, fontWeight: '700' }}>{digit}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(sanitizeCode(v))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={CODE_LENGTH}
        caretHidden
        selectionColor="transparent"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Enter or paste the 6-digit code. It is submitted automatically."
        accessibilityState={{ disabled }}
        style={[
          // Covers the boxes so a tap/long-press (paste) lands on the real input; text is invisible.
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: 'transparent', fontSize: 1, opacity: Platform.OS === 'web' ? 0.011 : 0.02 },
          Platform.OS === 'web' ? ({ outlineStyle: 'none', cursor: 'text' } as object) : null,
        ]}
      />
    </Pressable>
  );
}

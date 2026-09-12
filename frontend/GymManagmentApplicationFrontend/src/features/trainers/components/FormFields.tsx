import React, { useState } from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  KeyboardTypeOptions,
} from 'react-native';
import { T } from './theme';

/* ─── Field ──────────────────────────────────────────────────────── */
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  secureTextEntry?: boolean;
  rightElement?: React.ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  error?: string;
}

export function Field({
  label, value, onChangeText, placeholder, keyboardType,
  multiline, secureTextEntry, rightElement, autoCapitalize, autoCorrect, error,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  return (
    <View className="mb-4">
      <Text className="text-[13px] font-normal text-sub mb-[7px]">{label}</Text>
      {rightElement ? (
        <View
          className="flex-row items-center bg-input border rounded-xl overflow-hidden"
          style={
            hasError    ? { borderColor: '#EF4444' } :
            focused     ? { borderColor: '#444444', backgroundColor: '#1C211C' } :
            undefined
          }
        >
          <TextInput
            className="flex-1 px-4 py-[14px] text-[15px] text-white"
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder ?? ''}
            placeholderTextColor={T.textFaint}
            keyboardType={keyboardType ?? 'default'}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize ?? 'sentences'}
            autoCorrect={autoCorrect ?? true}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {rightElement}
        </View>
      ) : (
        <TextInput
          className={[
            'bg-input border rounded-xl px-4 text-[15px] text-white',
            multiline ? 'h-[90px] pt-3' : 'py-[14px]',
          ].join(' ')}
          style={
            hasError    ? { borderColor: '#EF4444' } :
            focused     ? { borderColor: '#444444', backgroundColor: '#1C211C' } :
            { borderColor: T.line }
          }
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? ''}
          placeholderTextColor={T.textFaint}
          keyboardType={keyboardType ?? 'default'}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          textAlignVertical={multiline ? 'top' : 'center'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={autoCorrect ?? true}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
      {hasError && (
        <Text className="text-[12px] mt-1" style={{ color: '#EF4444' }}>{error}</Text>
      )}
    </View>
  );
}

/* ─── SwitchRow ──────────────────────────────────────────────────── */
export function SwitchRow({
  label, value, onValueChange, description,
}: {
  label: string; value: boolean; onValueChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <TouchableOpacity
      className={`flex-row items-center justify-between px-4 py-[14px] mb-4 rounded-xl border ${
        value ? 'border-[rgba(126,211,33,0.25)] bg-[rgba(126,211,33,0.10)]' : 'border-line bg-input'
      }`}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.7}
    >
      <View className="flex-1 mr-3">
        <Text className={`text-[15px] font-normal ${value ? 'text-white' : 'text-sub'}`}>
          {label}
        </Text>
        {description && (
          <Text className="text-[12px] text-faint mt-[3px]">{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#2A2A2A', true: T.brand }}
        thumbColor={value ? T.onBrand : '#FFFFFF'}
        ios_backgroundColor="#2A2A2A"
      />
    </TouchableOpacity>
  );
}

/* ─── RowGrid / GridCell ─────────────────────────────────────────── */
export function RowGrid({ children }: { children: React.ReactNode }) {
  return <View className="flex-row gap-3">{children}</View>;
}
export function GridCell({ children }: { children: React.ReactNode }) {
  return <View className="flex-1">{children}</View>;
}

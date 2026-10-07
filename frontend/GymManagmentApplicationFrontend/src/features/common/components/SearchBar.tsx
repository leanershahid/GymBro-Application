import React from 'react';
import { View, TextInput, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../theme';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Read by screen readers; defaults to the placeholder. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Standard 48px search field with a labelled clear button. */
export default function SearchBar({ value, onChangeText, placeholder = 'Search…', label, style }: Props) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 16, paddingHorizontal: 14,
          backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line },
        style,
      ]}
    >
      <Feather name="search" size={18} color={T.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.textFaint}
        accessibilityLabel={label ?? placeholder}
        returnKeyType="search"
        autoCorrect={false}
        style={{ flex: 1, color: T.text, fontSize: 15, marginLeft: 10, paddingVertical: 0 }}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="x" size={18} color={T.textSub} />
        </Pressable>
      )}
    </View>
  );
}

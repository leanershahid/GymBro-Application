import React from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import { T, SP } from '../../../theme';

interface Props {
  eyebrow: string;
  title: string;
  onBack: () => void;
  submitLabel: string;
  onSubmit: () => void;
  submitting?: boolean;
  children: React.ReactNode;
}

/** Single-page create form: header, scrolling body, sticky submit button. */
export default function FormPage({ eyebrow, title, onBack, submitLabel, onSubmit, submitting, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader eyebrow={eyebrow} title={title} onBack={onBack} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        <View style={{
          paddingHorizontal: SP.xl, paddingTop: SP.md, paddingBottom: Math.max(insets.bottom, SP.lg),
          borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bg,
        }}>
          <PrimaryButton label={submitLabel} icon="check" onPress={onSubmit} loading={submitting} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

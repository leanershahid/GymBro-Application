import React from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP } from '../../../theme';
import Screen from './Screen';
import BackButton from './BackButton';
import PrimaryButton from './PrimaryButton';

interface Props {
  /** Wizard name, e.g. "Add Branch" — shown beside the back button with the step counter. */
  title: string;
  /** Step definitions (only the count and titles are used). */
  steps: { title: string; sub?: string }[];
  /** Zero-based current step. */
  step: number;
  /** Leave the wizard (used on the first step). */
  onBack?: () => void;
  /** Go to the previous step. */
  onPrev: () => void;
  /** Continue / submit. */
  onNext: () => void;
  /** Label of the primary button (e.g. "Continue", "Create Branch"). */
  nextLabel: string;
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * Shared shell for multi-step create flows (trainer / branch / tenant): safe-area screen,
 * back button, keyboard-aware step content, progress bar and a Previous / Continue footer
 * that clears the home indicator.
 */
export default function WizardScaffold({
  title, steps, step, onBack, onPrev, onNext, nextLabel, loading = false, children,
}: Props) {
  const insets = useSafeAreaInsets();
  const backHandler = step > 0 ? onPrev : onBack;
  const current = steps[step];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Top nav bar ─────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: SP.xl, paddingTop: SP.lg, paddingBottom: SP.sm }}>
          {backHandler ? (
            <BackButton
              onPress={backHandler}
              label={step > 0 ? 'Previous step' : 'Go back'}
            />
          ) : (
            <View style={{ width: 40, height: 40, marginRight: 12 }} />
          )}
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: T.textSub, fontSize: 13, fontWeight: '600' }}
            accessibilityLabel={`${title}, step ${step + 1} of ${steps.length}${current ? `: ${current.title}` : ''}`}
          >
            {title} · {step + 1}/{steps.length}
          </Text>
        </View>

        {/* ── Step content ────────────────────────────────────── */}
        <View style={{ flex: 1 }}>{children}</View>

        {/* ── Footer ──────────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: SP.xl, paddingTop: SP.md,
            paddingBottom: Math.max(insets.bottom, SP.lg),
            backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.line,
          }}
        >
          {/* Progress bar */}
          <View
            style={{ flexDirection: 'row', gap: 4, marginBottom: SP.lg }}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }}
          >
            {steps.map((_, i) => (
              <View
                key={i}
                style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? T.brand : T.line }}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: SP.md }}>
            {step > 0 && (
              <PrimaryButton label="Previous" variant="secondary" onPress={onPrev} disabled={loading} style={{ flex: 1 }} />
            )}
            <PrimaryButton label={nextLabel} onPress={onNext} loading={loading} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

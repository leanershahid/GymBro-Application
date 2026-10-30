import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { Field } from '../components/FormFields';
import { useTrainer, useUpdateTrainer } from '../api/trainerQueries';
import { UpdateTrainerPayload } from '../types/trainer.types';
import { isValidEmail } from '../../../utils/validation';
import { describeApiError, fieldErrorsFrom } from '../../../api/apiError';

/**
 * PUT /trainers/{id} (backend UpdateTrainerRequest) only accepts displayName, bio, phone, email,
 * profileImage and isAvailable. Code, branch, employment, pay, schedule etc. are set at creation
 * and can't be changed through this endpoint, so the Add wizard's steps are not reused here —
 * showing those fields would imply they save when they don't. Availability is managed by the
 * Activate/Deactivate action (which also handles sign-in), and the photo needs an upload
 * endpoint first, so neither is on this form.
 */
type FormState = { displayName: string; email: string; phone: string; bio: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState): FormErrors {
  const errs: FormErrors = {};
  // Same rules as AddTrainerPage's basic-info step, plus the update validator's length limits.
  if (!f.displayName.trim()) errs.displayName = 'Display name is required';
  else if (f.displayName.trim().length > 200) errs.displayName = 'Keep it under 200 characters';

  const email = f.email.trim();
  if (!email) errs.email = 'Email is required';
  else if (!isValidEmail(email)) errs.email = 'Enter a valid email address';

  if (f.phone.trim() && !/^[+\d][\d\s-]{6,19}$/.test(f.phone.trim())) errs.phone = 'Enter a valid phone number';
  if (f.bio.length > 2000) errs.bio = 'Keep the bio under 2000 characters';
  return errs;
}

/** Same behaviour as AddTrainerPage: blank strings are omitted (the API treats omitted as "unchanged"). */
function stripBlanks<V extends object>(value: V): Partial<V> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out as Partial<V>;
}

interface EditTrainerPageProps {
  trainerId: number;
  onBack: () => void;
  onSaved?: () => void;
}

export default function EditTrainerPage({ trainerId, onBack, onSaved }: EditTrainerPageProps) {
  const { data: trainer, isLoading, isError, refetch } = useTrainer(trainerId);
  const { mutate, isPending } = useUpdateTrainer();
  const { show: showToast } = useToast();

  const [form, setForm]       = useState<FormState | null>(null);
  const [errors, setErrors]   = useState<FormErrors>({});

  // Pre-fill once, when the trainer first loads — later refetches must not wipe the user's edits.
  useEffect(() => {
    if (trainer && !form) {
      setForm({
        displayName: trainer.displayName ?? '',
        email:       trainer.email ?? '',
        phone:       trainer.phone ?? '',
        bio:         trainer.bio ?? '',
      });
    }
  }, [trainer, form]);

  const update = (fields: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...fields } : prev));
    setErrors((prev) => {
      const next = { ...prev };
      (Object.keys(fields) as (keyof FormState)[]).forEach((k) => delete next[k]);
      return next;
    });
  };

  const handleSave = () => {
    if (!form || !trainer) return;
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Only send what actually changed, and only fields the update DTO accepts.
    const original: FormState = {
      displayName: trainer.displayName ?? '', email: trainer.email ?? '',
      phone: trainer.phone ?? '', bio: trainer.bio ?? '',
    };
    const changed: UpdateTrainerPayload = {};
    (Object.keys(form) as (keyof FormState)[]).forEach((k) => {
      if (form[k].trim() !== original[k].trim()) changed[k] = form[k];
    });
    const payload = stripBlanks(changed);

    if (Object.keys(payload).length === 0) {
      showToast({ type: 'success', message: 'No changes to save.' });
      return;
    }

    mutate({ id: trainerId, payload }, {
      onSuccess: (res) => {
        if (!res.success) {
          showToast({ type: 'error', message: res.message ?? 'Could not update trainer.' });
          return;
        }
        showToast({ type: 'success', message: res.message && res.message !== 'Success' ? res.message : 'Trainer updated.' });
        (onSaved ?? onBack)();
      },
      onError: (err) => {
        const { message, errors: list } = describeApiError(err);
        const fieldErrs = fieldErrorsFrom(list, {
          'display name': 'displayName', 'email': 'email', 'phone': 'phone', 'bio': 'bio',
        }) as FormErrors;
        if (Object.keys(fieldErrs).length) setErrors(fieldErrs);
        showToast({ type: 'error', message: list.length ? `${message} ${list.join(', ')}` : message });
      },
    });
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Trainer" title="Edit Trainer" onBack={onBack} />

      {isLoading && !trainer && <LoadingState label="Loading trainer" />}

      {isError && !trainer && (
        <EmptyState
          icon="alert-triangle"
          tone="error"
          title="Couldn't load trainer"
          subtitle="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      )}

      {trainer && form && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: SP.xl, paddingTop: SP.lg, paddingBottom: SP.xxl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600', marginBottom: SP.md }}>Identity</Text>
            <Field
              label="Display Name *"
              value={form.displayName}
              onChangeText={(v) => update({ displayName: v })}
              error={errors.displayName}
            />
            <Field
              label="Trainer Code"
              value={trainer.trainerCode ?? ''}
              onChangeText={() => {}}
              editable={false}
            />
            <Text style={{ color: T.textFaint, fontSize: 12, marginTop: -SP.sm, marginBottom: SP.lg }}>
              Trainer code, branch, employment and pay details can't be changed after creation.
            </Text>

            <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600', marginBottom: SP.md }}>Contact</Text>
            <Field
              label="Email *"
              value={form.email}
              onChangeText={(v) => update({ email: v })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChangeText={(v) => update({ phone: v })}
              keyboardType="phone-pad"
              error={errors.phone}
            />

            <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600', marginBottom: SP.md }}>Profile</Text>
            <Field
              label="Bio"
              value={form.bio}
              onChangeText={(v) => update({ bio: v })}
              multiline
              error={errors.bio}
            />

            <View style={{ marginTop: SP.lg }}>
              <PrimaryButton label="Save changes" icon="check" onPress={handleSave} loading={isPending} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

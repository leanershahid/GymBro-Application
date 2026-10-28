import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateMember } from '../api/memberQueries';
import { MemberPayload, MemberGender } from '../types/member.types';
import { isValidEmail } from '../../../utils/validation';
import BranchDropdown from '../../branches/components/BranchDropdown';
import TrainerDropdown from '../../trainers/components/TrainerDropdown';
import { currentTenantId, getSession } from '../../../api/session';
import { T, withAlpha, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import { Field } from '../../trainers/components/FormFields';
import { DateField } from '../../trainers/components/DatePicker';
import { describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import { useToast } from '../../common/components/Toast';

const GENDERS: { label: string; value: MemberGender }[] = [
  { label: 'Male',   value: 'male'   },
  { label: 'Female', value: 'female' },
  { label: 'Other',  value: 'other'  },
];

interface Props { onBack?: () => void; }

export default function AddMemberPage({ onBack }: Props) {
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '',
    phone: '', dob: '', notes: '',
    trainerId: '', branchId: getSession()?.branchId ? String(getSession()!.branchId) : '',
  });
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [gender, setGender] = useState<MemberGender | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate, isPending } = useCreateMember();
  const { show: showToast } = useToast();
  const insets = useSafeAreaInsets();

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim())  e.lastName  = 'Last name is required';
    if (!form.email.trim())     e.email     = 'Email is required';
    else if (!isValidEmail(form.email)) e.email = 'Invalid email';
    if (form.phone.trim() && !/^[+\d][\d\s-]{6,19}$/.test(form.phone.trim()))
      e.phone = 'Enter a valid phone number';
    if (form.dob && form.dob >= new Date().toISOString().slice(0, 10))
      e.dob = 'Date of birth must be in the past';

    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    const payload: MemberPayload = {
      tenantId:  currentTenantId(),
      email:     form.email.trim(),
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      phone:     form.phone.trim() || undefined,
      gender,
      dob:       form.dob       || undefined,
      notes:     form.notes.trim() || undefined,
      trainerId: form.trainerId ? Number(form.trainerId) : undefined,
      branchId:  form.branchId  ? Number(form.branchId)  : undefined,
    };

    mutate(payload, {
      onSuccess: (res) => {
        if (!res.success) {
          showToast({ type: 'error', message: res.message ?? 'Something went wrong.' });
          return;
        }
        const assigned = res.data?.trainerId
          ? ` ${trainerName ?? 'The selected trainer'} has been assigned.`
          : '';
        const pwd = (res.data as { defaultPassword?: string } | undefined)?.defaultPassword;
        if (pwd) {
          // A one-time secret needs an explicit acknowledgment, not an auto-dismissing toast —
          // redirect only once the admin has seen and dismissed it.
          Alert.alert(
            'Member created',
            `${res.message ?? 'Member created.'}${assigned}\n\nTemporary password: ${pwd}\nShare it with the member — it is shown only once.`,
            [{ text: 'OK', onPress: () => onBack?.() }],
          );
        } else {
          showToast({ type: 'success', message: (res.message ?? 'Member created.') + assigned });
          onBack?.();
        }
      },
      onError: (err) => {
        // Show the server's reasons under the matching fields, plus a summary.
        const { message, errors: list } = describeApiError(err);
        setErrors(fieldErrorsFrom(list, {
          'first name': 'firstName', 'last name': 'lastName', 'email': 'email',
          'phone': 'phone', 'dob': 'dob', 'date of birth': 'dob', 'branch id': 'branchId',
        }));
        showToast({ type: 'error', message: list.length ? `${message} ${list.join(', ')}` : message });
      },
    });
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Members" title="Add Member" onBack={onBack} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: SP.sm, paddingBottom: 48 }}
        >

          {/* Personal */}
          <Text className="text-sub text-[13px] font-semibold uppercase tracking-widest mb-3">Personal Info</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="First Name *" value={form.firstName} onChangeText={v => update('firstName', v)} autoCorrect={false} error={errors.firstName} />
            </View>
            <View className="flex-1">
              <Field label="Last Name *" value={form.lastName} onChangeText={v => update('lastName', v)} autoCorrect={false} error={errors.lastName} />
            </View>
          </View>
          <Field label="Email *" value={form.email} onChangeText={v => update('email', v)} placeholder="member@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors.email} />
          <Field label="Phone" value={form.phone ?? ''} onChangeText={v => update('phone', v)} placeholder="+91..." keyboardType="phone-pad" autoCorrect={false} error={errors.phone} />
          <DateField label="Date of Birth" value={form.dob ?? ''} onChange={v => update('dob', v)} maxYear={new Date().getFullYear()} error={errors.dob} />

          {/* Gender picker */}
          <Text className="text-sub text-[13px] mb-1.5">Gender</Text>
          <View className="flex-row gap-2 mb-4" accessibilityRole="radiogroup" accessibilityLabel="Gender">
            {GENDERS.map(g => {
              const sel = gender === g.value;
              return (
                <Pressable key={g.value} onPress={() => setGender(g.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={g.label}
                  accessibilityState={{ checked: sel }}
                  style={{ flex: 1, minHeight: 44, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: sel ? withAlpha(T.brand, 0.12) : T.bgInputActive,
                    borderColor: sel ? withAlpha(T.brand, 0.50) : T.line }}>
                  <Text style={{ color: sel ? T.brand : T.textSub, fontSize: 13, fontWeight: '700' }}>{g.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Trainer assignment (optional) */}
          <Text className="text-sub text-[13px] font-semibold uppercase tracking-widest mb-3 mt-2">
            Trainer Assignment
          </Text>

          {/* Info note */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: withAlpha(T.brand, 0.07), borderWidth: 1, borderColor: withAlpha(T.brand, 0.20), borderRadius: 14, padding: 12, marginBottom: 16, gap: 10 }}>
            <Feather name="info" size={15} color={T.brand} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, color: T.textSub, fontSize: 12, lineHeight: 18 }}>
              Pick the member's home branch. Optionally pick a trainer to assign them right after creation — the branch then defaults to the trainer's.
            </Text>
          </View>

          <TrainerDropdown
            label="Trainer (optional)"
            value={form.trainerId ? Number(form.trainerId) : null}
            onChange={t => { update('trainerId', t ? String(t.id) : ''); setTrainerName(t?.displayName ?? null); }}
          />

          <BranchDropdown
            label="Home branch (optional)"
            value={form.branchId ? Number(form.branchId) : null}
            onChange={b => update('branchId', String(b.id))}
            error={errors.branchId}
          />

          {/* Notes */}
          <Field
            label="Notes (optional)"
            value={form.notes ?? ''}
            onChangeText={v => update('notes', v)}
            placeholder="Internal admin notes…"
            multiline
          />
        </ScrollView>

        {/* Bottom CTA */}
        <View
          className="px-5 pt-3 bg-bg border-t border-line"
          style={{ paddingBottom: Math.max(insets.bottom, SP.lg) }}
        >
          <PrimaryButton label="Create Member" onPress={handleSubmit} loading={isPending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

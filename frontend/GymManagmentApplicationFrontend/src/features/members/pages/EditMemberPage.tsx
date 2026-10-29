import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMember, useUpdateMember, useUploadMemberPhoto } from '../api/memberQueries';
import { MemberDetail, MemberGender, UpdateMemberPayload } from '../types/member.types';
import BranchDropdown from '../../branches/components/BranchDropdown';
import { getSession, isAdminRole, isDelegatedRole } from '../../../api/session';
import { T, withAlpha, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field } from '../../trainers/components/FormFields';
import { DateField } from '../../trainers/components/DatePicker';
import { describeApiError, fieldErrorsFrom, apiErrorText } from '../../../api/apiError';
import { useToast } from '../../common/components/Toast';

const GENDERS: { label: string; value: MemberGender }[] = [
  { label: 'Male',   value: 'male'   },
  { label: 'Female', value: 'female' },
  { label: 'Other',  value: 'other'  },
];

interface FormState {
  firstName: string; lastName: string; phone: string; dob: string; notes: string; branchId: string;
}

const toForm = (m: MemberDetail): FormState => ({
  firstName: m.firstName ?? '',
  lastName:  m.lastName ?? '',
  phone:     m.phone ?? '',
  dob:       m.dob ? m.dob.slice(0, 10) : '',
  notes:     m.notes ?? '',
  branchId:  m.branchId ? String(m.branchId) : '',
});

const toGender = (g: string | null): MemberGender | undefined => {
  const v = (g ?? '').toLowerCase();
  return v === 'male' || v === 'female' || v === 'other' ? v : undefined;
};

interface Props {
  memberId: number;
  onBack: () => void;
  onSaved?: () => void;
}

export default function EditMemberPage({ memberId, onBack, onSaved }: Props) {
  const { data: member, isLoading, isError, error, refetch } = useMember(memberId);
  const [form, setForm] = useState<FormState | null>(null);
  const [gender, setGender] = useState<MemberGender | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate, isPending } = useUpdateMember();
  const photo = useUploadMemberPhoto();
  const { show: showToast } = useToast();
  const insets = useSafeAreaInsets();

  // Only admins / delegated staff may move a member between branches (enforced by the API too).
  const role = getSession()?.role;
  const canMoveBranch = isAdminRole(role) || isDelegatedRole(role);

  // Seed the form once the member has loaded.
  useEffect(() => {
    if (member && !form) { setForm(toForm(member)); setGender(toGender(member.gender)); }
  }, [member, form]);

  if (isLoading || (member && !form)) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Members" title="Edit Member" onBack={onBack} />
        <LoadingState label="Loading member" />
      </Screen>
    );
  }

  if (isError || !member || !form) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Members" title="Edit Member" onBack={onBack} />
        <EmptyState
          icon="alert-triangle" tone="error" title="Couldn't load member"
          subtitle={isError ? describeApiError(error).message : 'This member was not found.'}
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      </Screen>
    );
  }

  const update = (k: keyof FormState, v: string) => setForm(p => (p ? { ...p, [k]: v } : p));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    else if (form.firstName.trim().length > 100) e.firstName = 'Max 100 characters';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    else if (form.lastName.trim().length > 100) e.lastName = 'Max 100 characters';
    if (form.phone.trim() && !/^[+\d][\d\s-]{6,19}$/.test(form.phone.trim()))
      e.phone = 'Enter a valid phone number';
    if (form.dob && form.dob >= new Date().toISOString().slice(0, 10))
      e.dob = 'Date of birth must be in the past';
    if (!form.dob && member.dob)
      e.dob = 'Date of birth can’t be cleared once set';
    if (form.notes.length > 2000) e.notes = 'Max 2000 characters';
    return e;
  };

  /**
   * The API treats null as "leave unchanged", so blanks become null — except phone/notes that
   * had a value and were emptied, which are sent as "" so they actually clear.
   */
  const clearable = (value: string, original: string | null) => {
    const v = value.trim();
    if (v) return v;
    return original ? '' : null;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    const branchId = form.branchId ? Number(form.branchId) : null;
    const payload: UpdateMemberPayload = {
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      phone:     clearable(form.phone, member.phone),
      gender:    gender ?? null,
      dob:       form.dob || null,
      notes:     clearable(form.notes, member.notes),
      branchId:  canMoveBranch && branchId !== member.branchId ? branchId : null,
    };

    mutate({ id: memberId, payload }, {
      onSuccess: (res) => {
        if (!res.success) {
          showToast({ type: 'error', message: res.message ?? 'Something went wrong.' });
          return;
        }
        showToast({ type: 'success', message: 'Member updated.' });
        onSaved ? onSaved() : onBack();
      },
      onError: (err) => {
        const { message, errors: list } = describeApiError(err);
        setErrors(fieldErrorsFrom(list, {
          'first name': 'firstName', 'last name': 'lastName', 'phone': 'phone',
          'dob': 'dob', 'date of birth': 'dob', 'notes': 'notes', 'branch id': 'branchId', 'branch': 'branchId',
        }));
        showToast({ type: 'error', message: list.length ? `${message} ${list.join(', ')}` : message });
      },
    });
  };

  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    photo.mutate(
      { id: memberId, file: { uri: a.uri, mimeType: a.mimeType, fileName: a.fileName } },
      {
        onSuccess: (r) => showToast({ type: r.success ? 'success' : 'error', message: r.success ? 'Photo updated.' : r.message }),
        onError: (e) => Alert.alert('Upload failed', apiErrorText(e)),
      },
    );
  };

  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase();

  return (
    <Screen>
      <ScreenHeader eyebrow="Members" title="Edit Member" onBack={onBack} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: SP.sm, paddingBottom: 48 }}
        >
          {/* Photo */}
          <View style={{ alignItems: 'center', marginBottom: SP.xl }}>
            <Pressable
              onPress={changePhoto}
              disabled={photo.isPending}
              accessibilityRole="button"
              accessibilityLabel="Change photo"
              style={{ alignItems: 'center' }}
            >
              {member.avatarUrl ? (
                <Image source={{ uri: member.avatarUrl }} style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: withAlpha(T.brand, 0.4) }} />
              ) : (
                <View style={{
                  width: 84, height: 84, borderRadius: 42, backgroundColor: withAlpha(T.brand, 0.12),
                  borderWidth: 2, borderColor: withAlpha(T.brand, 0.4), alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: T.brand, fontSize: 26, fontWeight: '800' }}>{initials}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.sm }}>
                {photo.isPending
                  ? <ActivityIndicator size="small" color={T.brand} />
                  : <Feather name="camera" size={13} color={T.brand} />}
                <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>
                  {photo.isPending ? 'Uploading…' : 'Change photo'}
                </Text>
              </View>
            </Pressable>
          </View>

          <Text className="text-sub text-[13px] font-semibold uppercase tracking-widest mb-3">Personal Info</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="First Name *" value={form.firstName} onChangeText={v => update('firstName', v)} autoCorrect={false} error={errors.firstName} />
            </View>
            <View className="flex-1">
              <Field label="Last Name *" value={form.lastName} onChangeText={v => update('lastName', v)} autoCorrect={false} error={errors.lastName} />
            </View>
          </View>
          <Field label="Email (can't be changed)" value={member.email} onChangeText={() => {}} editable={false} />
          <Field label="Phone" value={form.phone} onChangeText={v => update('phone', v)} placeholder="+91..." keyboardType="phone-pad" autoCorrect={false} error={errors.phone} />
          <DateField label="Date of Birth" value={form.dob} onChange={v => update('dob', v)} maxYear={new Date().getFullYear()} error={errors.dob} />

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

          {canMoveBranch && (
            <>
              <Text className="text-sub text-[13px] font-semibold uppercase tracking-widest mb-3 mt-2">Home Branch</Text>
              <BranchDropdown
                label="Branch"
                value={form.branchId ? Number(form.branchId) : null}
                onChange={b => update('branchId', String(b.id))}
                error={errors.branchId}
              />
            </>
          )}

          <Field
            label="Notes (optional)"
            value={form.notes}
            onChangeText={v => update('notes', v)}
            placeholder="Internal admin notes…"
            multiline
            error={errors.notes}
          />
        </ScrollView>

        <View
          className="px-5 pt-3 bg-bg border-t border-line"
          style={{ paddingBottom: Math.max(insets.bottom, SP.lg) }}
        >
          <PrimaryButton label="Save Changes" onPress={handleSubmit} loading={isPending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

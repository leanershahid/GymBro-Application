import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCreateMember } from '../api/memberQueries';
import { MemberPayload, MemberGender } from '../types/member.types';
import { isValidEmail } from '../../../utils/validation';

const GENDERS: { label: string; value: MemberGender }[] = [
  { label: 'Male',   value: 'male'   },
  { label: 'Female', value: 'female' },
  { label: 'Other',  value: 'other'  },
];

function Field({ label, value, onChange, placeholder, keyboardType, autoCapitalize, error }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; error?: string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sub text-[13px] mb-1.5">{label}</Text>
      <TextInput
        className="bg-elevated border border-line rounded-2xl px-4 py-[14px] text-[15px] text-white"
        style={error ? { borderColor: '#EF4444' } : undefined}
        value={value} onChangeText={onChange}
        placeholder={placeholder ?? ''} placeholderTextColor="#555"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
      />
      {!!error && <Text className="text-red-400 text-xs mt-1 ml-1">{error}</Text>}
    </View>
  );
}

interface Props { onBack?: () => void; }

export default function AddMemberPage({ onBack }: Props) {
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '',
    phone: '', dob: '', notes: '',
    trainerId: '', branchId: '',
  });
  const [gender, setGender] = useState<MemberGender | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate, isPending } = useCreateMember();

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim())  e.lastName  = 'Last name is required';
    if (!form.email.trim())     e.email     = 'Email is required';
    else if (!isValidEmail(form.email)) e.email = 'Invalid email';
    // If trainerId given, branchId is strongly recommended
    if (form.trainerId && !form.branchId) e.branchId = 'Branch ID is required when assigning a trainer';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    const payload: MemberPayload = {
      tenantId:  1,
      email:     form.email.trim(),
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      phone:     form.phone     || undefined,
      gender,
      dob:       form.dob       || undefined,
      notes:     form.notes     || undefined,
      trainerId: form.trainerId ? Number(form.trainerId) : undefined,
      branchId:  form.branchId  ? Number(form.branchId)  : undefined,
    };

    mutate(payload, {
      onSuccess: (res) => {
        if (res.success) {
          const assigned = res.data?.trainerId
            ? `\nTrainer #${res.data.trainerId} assigned automatically.`
            : '';
          Alert.alert('Success 🎉', (res.message ?? 'Member created.') + assigned);
        } else {
          Alert.alert('Error', res.message ?? 'Something went wrong.');
        }
      },
      onError: () => Alert.alert('Error', 'Failed to connect to server.'),
    });
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      {/* Nav */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable onPress={onBack} className="w-9 h-9 rounded-full bg-surface border border-line items-center justify-center mr-3">
          <Text className="text-white text-[18px]">←</Text>
        </Pressable>
        <View>
          <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest">Members</Text>
          <Text className="text-white text-[22px] font-extrabold tracking-tight">Add Member</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}>

        {/* Personal */}
        <Text className="text-sub text-[13px] font-semibold uppercase tracking-widest mb-3">Personal Info</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="First Name" value={form.firstName} onChange={v => update('firstName', v)} error={errors.firstName} />
          </View>
          <View className="flex-1">
            <Field label="Last Name" value={form.lastName} onChange={v => update('lastName', v)} error={errors.lastName} />
          </View>
        </View>
        <Field label="Email" value={form.email} onChange={v => update('email', v)} placeholder="member@email.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <Field label="Phone" value={form.phone ?? ''} onChange={v => update('phone', v)} placeholder="+91..." keyboardType="phone-pad" />
        <Field label="Date of Birth" value={form.dob ?? ''} onChange={v => update('dob', v)} placeholder="YYYY-MM-DD" />

        {/* Gender picker */}
        <Text className="text-sub text-[13px] mb-1.5">Gender</Text>
        <View className="flex-row gap-2 mb-4">
          {GENDERS.map(g => {
            const sel = gender === g.value;
            return (
              <Pressable key={g.value} onPress={() => setGender(g.value)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, alignItems: 'center',
                  backgroundColor: sel ? 'rgba(126,211,33,0.12)' : '#1C211C',
                  borderColor: sel ? 'rgba(126,211,33,0.50)' : '#242B24' }}>
                <Text style={{ color: sel ? '#7ED321' : '#AAAAAA', fontSize: 13, fontWeight: '700' }}>{g.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Trainer assignment (optional) */}
        <Text className="text-sub text-[13px] font-semibold uppercase tracking-widest mb-3 mt-2">
          Trainer Assignment
        </Text>

        {/* Info note */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(126,211,33,0.07)', borderWidth: 1, borderColor: 'rgba(126,211,33,0.20)', borderRadius: 14, padding: 12, marginBottom: 16, gap: 10 }}>
          <Feather name="info" size={15} color="#7ED321" style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: '#AAAAAA', fontSize: 12, lineHeight: 18 }}>
            Optional — enter a Trainer ID and Branch ID to automatically assign the new member to a trainer right after creation.
          </Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="Trainer ID (optional)"
              value={form.trainerId}
              onChange={v => update('trainerId', v.replace(/\D/g, ''))}
              placeholder="e.g. 5"
              keyboardType="numeric"
              error={undefined}
            />
          </View>
          <View className="flex-1">
            <Field
              label="Branch ID (optional)"
              value={form.branchId}
              onChange={v => update('branchId', v.replace(/\D/g, ''))}
              placeholder="e.g. 1"
              keyboardType="numeric"
              error={errors.branchId}
            />
          </View>
        </View>

        {/* Notes */}
        <Text className="text-sub text-[13px] mb-1.5">Notes (optional)</Text>
        <TextInput
          className="bg-elevated border border-line rounded-2xl px-4 pt-3 text-[15px] text-white mb-4"
          style={{ height: 88, textAlignVertical: 'top' }}
          value={form.notes ?? ''} onChangeText={v => update('notes', v)}
          placeholder="Internal admin notes…" placeholderTextColor="#555"
          multiline
        />
      </ScrollView>

      {/* Bottom CTA */}
      <View className="px-5 pt-3 pb-8 bg-bg border-t border-line">
        <Pressable
          onPress={handleSubmit} disabled={isPending}
          className={`h-14 rounded-full items-center justify-center ${isPending ? 'bg-brandDark' : 'bg-brand'}`}>
          {isPending ? <ActivityIndicator color="#000" /> : <Text className="text-black text-base font-bold">Create Member</Text>}
        </Pressable>
      </View>
    </View>
  );
}

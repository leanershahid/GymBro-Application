import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { TrainerPayload } from '../types/trainer.types';
import { Field, RowGrid, GridCell } from './FormFields';
import { DateField } from './DatePicker';
import { BasicInfoErrors } from '../pages/AddTrainerPage';
import { T } from './theme';
import BranchDropdown from '../../branches/components/BranchDropdown';
import { Branch } from '../../branches/types/branch.types';

interface Props {
  data: Partial<TrainerPayload>;
  onChange: (fields: Partial<TrainerPayload>) => void;
  errors?: BasicInfoErrors;
  selectedBranchId?: number | null;
  onBranchSelect?: (branch: Branch) => void;
  branchError?: string;
}

function ProfileImagePicker({ value, onChange }: { value: string; onChange: (uri: string) => void }) {
  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <View className="items-center mb-6">
      <TouchableOpacity onPress={pick} activeOpacity={0.8}>
        {value ? (
          <Image
            source={{ uri: value }}
            className="w-24 h-24 rounded-full"
            style={{ borderWidth: 2, borderColor: 'rgba(126,211,33,0.35)' }}
          />
        ) : (
          <View
            className="w-24 h-24 rounded-full bg-input items-center justify-center"
            style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <Text className="text-3xl">📷</Text>
          </View>
        )}
        <View
          className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand items-center justify-center"
          style={{ borderWidth: 2, borderColor: '#09090B' }}
        >
          <Text className="text-white text-xs font-bold">+</Text>
        </View>
      </TouchableOpacity>
      <Text className="text-xs text-sub mt-2">
        {value ? 'Tap to change photo' : 'Tap to add photo'}
      </Text>
    </View>
  );
}

function Section({ title }: { title: string }) {
  return <Text className="text-[13px] font-semibold text-sub mb-3 mt-1">{title}</Text>;
}

function GenderPills({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <View className="mb-4">
      <Text className="text-[13px] font-normal text-sub mb-[7px]">Gender</Text>
      <View className="flex-row gap-[10px]">
        {['Male', 'Female', 'Other'].map((o) => (
          <TouchableOpacity
            key={o}
            className={`flex-1 py-[14px] items-center rounded-xl border ${
              value === o
                ? 'border-[rgba(126,211,33,0.25)] bg-[rgba(126,211,33,0.10)]'
                : error
                ? 'border-[#EF4444] bg-input'
                : 'border-line bg-input'
            }`}
            onPress={() => onChange(o)}
            activeOpacity={0.75}
          >
            <Text className={`text-[14px] font-medium ${value === o ? 'text-brand font-semibold' : 'text-sub'}`}>
              {o}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error && <Text className="text-[12px] mt-1" style={{ color: '#EF4444' }}>{error}</Text>}
    </View>
  );
}

function TagInput({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (a: string[]) => void; placeholder?: string;
}) {
  const [txt, setTxt] = useState('');
  const add = () => {
    const t = txt.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setTxt('');
  };
  return (
    <View className="mb-1">
      {value.length > 0 && (
        <View className="flex-row flex-wrap gap-[6px] mb-2">
          {value.map((v) => (
            <TouchableOpacity
              key={v}
              className="flex-row items-center gap-[5px] bg-[rgba(126,211,33,0.10)] border border-[rgba(126,211,33,0.25)] rounded-full px-[10px] py-[5px]"
              onPress={() => onChange(value.filter((x) => x !== v))}
            >
              <Text className="text-[12px] font-semibold text-brand">{v}</Text>
              <Text className="text-[14px] text-brand" style={{ lineHeight: 17 }}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View className="flex-row items-end gap-[10px]">
        <View className="flex-1">
          <Field
            label={label}
            value={txt}
            onChangeText={setTxt}
            placeholder={placeholder ?? 'Type and press add…'}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <TouchableOpacity
          className="px-[18px] py-[14px] rounded-xl bg-brand mb-4"
          onPress={add}
          activeOpacity={0.8}
        >
          <Text className="text-[14px] font-bold text-black">Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function StepBasicInfo({ data, onChange, errors = {}, selectedBranchId, onBranchSelect, branchError }: Props) {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text className="text-[30px] font-extrabold text-white mb-[6px]" style={{ letterSpacing: -0.5 }}>Basic Info</Text>
      <Text className="text-[14px] font-normal text-sub mb-7" style={{ lineHeight: 20 }}>Personal details and contact information</Text>

      {/* Branch — first field */}
      {onBranchSelect && (
        <View className="mb-6">
          <BranchDropdown
            value={selectedBranchId ?? null}
            onChange={onBranchSelect}
            error={branchError}
            label="Branch"
          />
        </View>
      )}

      <Section title="Identity" />
      <Field label="Display Name" value={data.displayName ?? ''} onChangeText={(v) => onChange({ displayName: v })} error={errors.displayName} />
      <Field label="Trainer Code" value={data.trainerCode ?? ''} onChangeText={(v) => onChange({ trainerCode: v })} error={errors.trainerCode} />
      <GenderPills value={data.gender ?? ''} onChange={(v) => onChange({ gender: v })} error={errors.gender} />
      <RowGrid>
        <GridCell>
          <DateField label="Date of Birth" value={data.dateOfBirth ?? ''} onChange={(v) => onChange({ dateOfBirth: v })} maxYear={new Date().getFullYear()} error={errors.dateOfBirth} />
        </GridCell>
        <GridCell>
          <Field label="Exp. Years" value={String(data.experienceYears ?? '')} onChangeText={(v) => onChange({ experienceYears: Number(v) })} keyboardType="numeric" error={errors.experienceYears} />
        </GridCell>
      </RowGrid>

      <Section title="Contact" />
      <Field label="Email"   value={data.email ?? ''}   onChangeText={(v) => onChange({ email: v })}   keyboardType="email-address" autoCapitalize="none" error={errors.email} />
      <Field label="Phone"   value={data.phone ?? ''}   onChangeText={(v) => onChange({ phone: v })}   keyboardType="phone-pad" error={errors.phone} />
      <Field label="Address" value={data.address ?? ''} onChangeText={(v) => onChange({ address: v })} error={errors.address} />

      <Section title="Profile" />
      <ProfileImagePicker value={data.profileImage ?? ''} onChange={(uri) => onChange({ profileImage: uri })} />
      <Field label="Bio" value={data.bio ?? ''} onChangeText={(v) => onChange({ bio: v })} multiline error={errors.bio} />
      <TagInput label="Specializations" value={data.specializations ?? []} onChange={(arr) => onChange({ specializations: arr })} placeholder="e.g. Yoga, CrossFit…" />
      <TagInput label="Languages Known"  value={data.languagesKnown ?? []}  onChange={(arr) => onChange({ languagesKnown: arr })}  placeholder="e.g. English, Hindi…" />
    </ScrollView>
  );
}

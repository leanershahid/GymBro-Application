import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { useCreateBranch } from '../api/branchQueries';
import { BranchPayload } from '../types/branch.types';
import StepBranchBasicInfo, { BranchBasicInfoErrors } from '../components/StepBranchBasicInfo';
import StepBranchLocation, { BranchLocationErrors } from '../components/StepBranchLocation';
import StepBranchSettings, { BranchSettingsErrors } from '../components/StepBranchSettings';
import { T } from '../../trainers/components/theme';
import { isValidEmail } from '../../../utils/validation';

// ─── Steps ────────────────────────────────────────────────────────
const STEPS = [
  { title: 'Basic Info', sub: 'Branch identity and contact details' },
  { title: 'Location',   sub: 'Physical address and region' },
  { title: 'Settings',   sub: 'Capacity, timezone and tenant' },
];

// ─── Default values ───────────────────────────────────────────────
const DEFAULT_VALUES: BranchPayload = {
  tenantId:  0,
  name:      '',
  code:      '',
  address:   '',
  city:      '',
  state:     '',
  country:   '',
  zip:       '',
  phone:     '',
  email:     '',
  timezone:  '',
  capacity:  0,
  logoUrl:   '',
};

// ─── Validation ───────────────────────────────────────────────────
function validateBasicInfo(d: Partial<BranchPayload>): BranchBasicInfoErrors {
  const e: BranchBasicInfoErrors = {};
  if (!d.name?.trim())  e.name  = 'Branch name is required';
  if (!d.code?.trim())  e.code  = 'Branch code is required';
  if (!d.phone?.trim()) e.phone = 'Phone is required';
  const email = d.email?.trim() ?? '';
  if (!email)                                     e.email = 'Email is required';
  else if (!isValidEmail(email)) e.email = 'Enter a valid email';
  return e;
}

function validateLocation(d: Partial<BranchPayload>): BranchLocationErrors {
  const e: BranchLocationErrors = {};
  if (!d.address?.trim()) e.address = 'Address is required';
  if (!d.city?.trim())    e.city    = 'City is required';
  if (!d.state?.trim())   e.state   = 'State is required';
  if (!d.country?.trim()) e.country = 'Country is required';
  if (!d.zip?.trim())     e.zip     = 'ZIP is required';
  return e;
}

function validateSettings(d: Partial<BranchPayload>): BranchSettingsErrors {
  const e: BranchSettingsErrors = {};
  if (!d.timezone?.trim())       e.timezone = 'Timezone is required';
  if (!d.capacity || d.capacity < 1) e.capacity = 'Capacity must be at least 1';
  if (!d.tenantId || d.tenantId < 1) e.tenantId = 'Tenant ID is required';
  return e;
}

// ─── Component ────────────────────────────────────────────────────
interface AddBranchPageProps {
  onBack?: () => void;
}

export default function AddBranchPage({ onBack }: AddBranchPageProps) {
  const [step, setStep]       = useState(0);
  const [formData, setFormData] = useState<BranchPayload>({ ...DEFAULT_VALUES });
  const [basicErrors, setBasicErrors]     = useState<BranchBasicInfoErrors>({});
  const [locationErrors, setLocationErrors] = useState<BranchLocationErrors>({});
  const [settingsErrors, setSettingsErrors] = useState<BranchSettingsErrors>({});

  const { mutate, isPending } = useCreateBranch();
  const isLast = step === STEPS.length - 1;

  const updateForm = (fields: Partial<BranchPayload>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleNext = () => {
    if (step === 0) {
      const errs = validateBasicInfo(formData);
      if (Object.keys(errs).length > 0) { setBasicErrors(errs); return; }
      setBasicErrors({});
    }
    if (step === 1) {
      const errs = validateLocation(formData);
      if (Object.keys(errs).length > 0) { setLocationErrors(errs); return; }
      setLocationErrors({});
    }
    setStep((p) => p + 1);
  };

  const handleSubmit = () => {
    const errs = validateSettings(formData);
    if (Object.keys(errs).length > 0) { setSettingsErrors(errs); return; }
    setSettingsErrors({});

    mutate(formData, {
      onSuccess: (res) =>
        Alert.alert(res.success ? 'Success 🎉' : 'Error', res.message ?? 'Something went wrong.'),
      onError: () =>
        Alert.alert('Error', 'Failed to connect to server.'),
    });
  };

  const stepViews = [
    <StepBranchBasicInfo key={0} data={formData} onChange={updateForm} errors={basicErrors} />,
    <StepBranchLocation  key={1} data={formData} onChange={updateForm} errors={locationErrors} />,
    <StepBranchSettings  key={2} data={formData} onChange={updateForm} errors={settingsErrors} />,
  ];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: T.bg,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0,
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      {/* ── Top nav bar ────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <TouchableOpacity
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: T.bgInputActive,
            borderWidth: 1, borderColor: T.border,
            alignItems: 'center', justifyContent: 'center',
            opacity: step === 0 && !onBack ? 0 : 1,
          }}
          onPress={step > 0 ? () => setStep((p) => p - 1) : onBack}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18, color: T.text, lineHeight: 22 }}>←</Text>
        </TouchableOpacity>
      </View>

      {/* ── Step content ─────────────────────────────────── */}
      <View style={{ flex: 1 }}>{stepViews[step]}</View>

      {/* ── Bottom bar ───────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: 20, paddingTop: 12,
          backgroundColor: T.bg,
          borderTopWidth: 1, borderTopColor: T.line,
          paddingBottom: Platform.OS === 'ios' ? 32 : 20,
        }}
      >
        {/* Progress bar */}
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                backgroundColor: i <= step ? T.brand : T.line,
              }}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {step > 0 && (
            <TouchableOpacity
              style={{
                flex: 1, paddingVertical: 17, borderRadius: 999,
                borderWidth: 1.5, borderColor: T.line,
                alignItems: 'center', justifyContent: 'center',
              }}
              onPress={() => setStep((p) => p - 1)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: T.text }}>Previous</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{
              flex: 1, paddingVertical: 17, borderRadius: 999,
              backgroundColor: T.brand,
              alignItems: 'center', justifyContent: 'center',
              opacity: isPending ? 0.6 : 1,
            }}
            onPress={isLast ? handleSubmit : handleNext}
            disabled={isPending}
            activeOpacity={0.85}
          >
            {isPending ? (
              <ActivityIndicator color={T.onBrand} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.onBrand }}>
                {isLast ? 'Create Branch' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

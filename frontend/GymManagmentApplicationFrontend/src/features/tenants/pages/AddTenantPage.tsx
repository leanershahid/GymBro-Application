import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { useCreateTenant } from '../api/tenantQueries';
import { TenantPayload, TenantPlan } from '../types/tenant.types';
import StepTenantBasicInfo, { TenantBasicInfoErrors } from '../components/StepTenantBasicInfo';
import StepTenantLocale,    { TenantLocaleErrors }    from '../components/StepTenantLocale';
import StepTenantPlan,      { TenantPlanErrors }      from '../components/StepTenantPlan';
import { T } from '../../trainers/components/theme';

// ─── Steps ────────────────────────────────────────────────────────
const STEPS = [
  { title: 'Basic Info', sub: 'Organisation name and identity' },
  { title: 'Locale',     sub: 'Regional settings and custom domain' },
  { title: 'Plan',       sub: 'Subscription plan and trial period' },
];

// ─── Default values ───────────────────────────────────────────────
const DEFAULT_VALUES: TenantPayload = {
  name:         '',
  slug:         '',
  plan:         TenantPlan.Starter,
  logoUrl:      '',
  primaryColor: '',
  timezone:     '',
  locale:       '',
  currency:     '',
  customDomain: '',
  trialEndsAt:  '',
};

// ─── Validation ───────────────────────────────────────────────────
function validateBasicInfo(d: Partial<TenantPayload>): TenantBasicInfoErrors {
  const e: TenantBasicInfoErrors = {};
  if (!d.name?.trim()) e.name = 'Tenant name is required';
  if (!d.slug?.trim()) e.slug = 'Slug is required';
  else if (!/^[a-z0-9-]+$/.test(d.slug)) e.slug = 'Slug can only contain lowercase letters, numbers and hyphens';
  return e;
}

function validateLocale(d: Partial<TenantPayload>): TenantLocaleErrors {
  const e: TenantLocaleErrors = {};
  if (!d.timezone?.trim()) e.timezone = 'Timezone is required';
  if (!d.locale?.trim())   e.locale   = 'Locale is required';
  if (!d.currency?.trim()) e.currency = 'Currency is required';
  return e;
}

function validatePlan(d: Partial<TenantPayload>): TenantPlanErrors {
  const e: TenantPlanErrors = {};
  if (d.plan === undefined || d.plan === null) e.plan = 'Please select a plan';
  if (!d.trialEndsAt?.trim()) e.trialEndsAt = 'Trial end date is required';
  else if (isNaN(Date.parse(d.trialEndsAt))) e.trialEndsAt = 'Enter a valid ISO date';
  return e;
}

// ─── Component ────────────────────────────────────────────────────
interface AddTenantPageProps {
  onBack?: () => void;
}

export default function AddTenantPage({ onBack }: AddTenantPageProps) {
  const [step, setStep]       = useState(0);
  const [formData, setFormData] = useState<TenantPayload>({ ...DEFAULT_VALUES });
  const [basicErrors,  setBasicErrors]  = useState<TenantBasicInfoErrors>({});
  const [localeErrors, setLocaleErrors] = useState<TenantLocaleErrors>({});
  const [planErrors,   setPlanErrors]   = useState<TenantPlanErrors>({});

  const { mutate, isPending } = useCreateTenant();
  const isLast = step === STEPS.length - 1;

  const updateForm = (fields: Partial<TenantPayload>) =>
    setFormData((prev) => ({ ...prev, ...fields }));

  const handleNext = () => {
    if (step === 0) {
      const errs = validateBasicInfo(formData);
      if (Object.keys(errs).length > 0) { setBasicErrors(errs); return; }
      setBasicErrors({});
    }
    if (step === 1) {
      const errs = validateLocale(formData);
      if (Object.keys(errs).length > 0) { setLocaleErrors(errs); return; }
      setLocaleErrors({});
    }
    setStep((p) => p + 1);
  };

  const handleSubmit = () => {
    const errs = validatePlan(formData);
    if (Object.keys(errs).length > 0) { setPlanErrors(errs); return; }
    setPlanErrors({});

    mutate(formData, {
      onSuccess: (res) =>
        Alert.alert(res.success ? 'Success 🎉' : 'Error', res.message ?? 'Something went wrong.'),
      onError: () =>
        Alert.alert('Error', 'Failed to connect to server.'),
    });
  };

  const stepViews = [
    <StepTenantBasicInfo key={0} data={formData} onChange={updateForm} errors={basicErrors} />,
    <StepTenantLocale    key={1} data={formData} onChange={updateForm} errors={localeErrors} />,
    <StepTenantPlan      key={2} data={formData} onChange={updateForm} errors={planErrors}   />,
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

      {/* ── Top nav bar ──────────────────────────────────────── */}
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

      {/* ── Step content ─────────────────────────────────────── */}
      <View style={{ flex: 1 }}>{stepViews[step]}</View>

      {/* ── Bottom bar ───────────────────────────────────────── */}
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
                {isLast ? 'Create Tenant' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

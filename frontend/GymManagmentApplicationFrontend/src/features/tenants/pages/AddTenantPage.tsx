import React, { useState } from 'react';
import { Alert } from 'react-native';
import WizardScaffold from '../../common/components/WizardScaffold';
import { useCreateTenant } from '../api/tenantQueries';
import { TenantPayload, TenantPlan } from '../types/tenant.types';
import StepTenantBasicInfo, { TenantBasicInfoErrors } from '../components/StepTenantBasicInfo';
import StepTenantLocale,    { TenantLocaleErrors }    from '../components/StepTenantLocale';
import StepTenantPlan,      { TenantPlanErrors }      from '../components/StepTenantPlan';

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
    <WizardScaffold
      title="Add Tenant"
      steps={STEPS}
      step={step}
      onBack={onBack}
      onPrev={() => setStep((p) => p - 1)}
      onNext={isLast ? handleSubmit : handleNext}
      nextLabel={isLast ? 'Create Tenant' : 'Continue'}
      loading={isPending}
    >
      {stepViews[step]}
    </WizardScaffold>
  );
}

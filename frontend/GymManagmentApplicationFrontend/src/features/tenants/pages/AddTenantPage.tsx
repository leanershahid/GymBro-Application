import React, { useState } from 'react';
import WizardScaffold from '../../common/components/WizardScaffold';
import { useToast } from '../../common/components/Toast';
import { useCreateTenant } from '../api/tenantQueries';
import { TenantPayload, TenantPlan } from '../types/tenant.types';
import StepTenantBasicInfo, { TenantBasicInfoErrors } from '../components/StepTenantBasicInfo';
import StepTenantLocale,    { TenantLocaleErrors }    from '../components/StepTenantLocale';
import StepTenantPlan,      { TenantPlanErrors }      from '../components/StepTenantPlan';
import { validateBasicInfo, validateLocale, validatePlan } from '../utils/tenantValidation';

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
  const { show: showToast } = useToast();
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
      onSuccess: (res) => {
        if (res.success) {
          showToast({ type: 'success', message: res.message ?? 'Tenant created.' });
          onBack?.();
        } else {
          showToast({ type: 'error', message: res.message ?? 'Something went wrong.' });
        }
      },
      onError: () =>
        showToast({ type: 'error', message: 'Failed to connect to server.' }),
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

import React, { useEffect, useState } from 'react';
import WizardScaffold from '../../common/components/WizardScaffold';
import LoadingState from '../../common/components/LoadingState';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import { getSession, isSuperAdmin } from '../../../api/session';
import { useTenant, useUpdateTenant } from '../api/tenantQueries';
import { Tenant, TenantPayload, TenantUpdatePayload, tenantPlanFromName } from '../types/tenant.types';
import StepTenantBasicInfo, { TenantBasicInfoErrors } from '../components/StepTenantBasicInfo';
import StepTenantLocale,    { TenantLocaleErrors }    from '../components/StepTenantLocale';
import StepTenantPlan,      { TenantPlanErrors }      from '../components/StepTenantPlan';
import { validateBasicInfo, validateLocale, validatePlan } from '../utils/tenantValidation';

const BASE_STEPS = [
  { title: 'Basic Info', sub: 'Organisation name and identity' },
  { title: 'Locale',     sub: 'Regional settings and custom domain' },
];
// Plan / trial are commercial settings the server only applies for a super admin.
const PLAN_STEP = { title: 'Plan', sub: 'Subscription plan and trial period' };

// Server field label (see ValidationResponses.FieldLabel) → form key.
const SERVER_LABELS: Record<string, keyof TenantPayload> = {
  name: 'name', 'logo url': 'logoUrl', 'primary color': 'primaryColor',
  timezone: 'timezone', locale: 'locale', currency: 'currency', 'custom domain': 'customDomain',
  plan: 'plan', 'trial ends at': 'trialEndsAt',
};
const BASIC_KEYS  = ['name', 'slug', 'logoUrl', 'primaryColor'];
const LOCALE_KEYS = ['timezone', 'locale', 'currency', 'customDomain'];
const PLAN_KEYS   = ['plan', 'trialEndsAt'];

const clean = (v: string | null | undefined) => (v && v !== 'string' ? v : '');

function toForm(t: Tenant): TenantPayload {
  return {
    name:         clean(t.name),
    slug:         clean(t.slug),
    plan:         tenantPlanFromName(t.plan),
    logoUrl:      clean(t.logoUrl),
    primaryColor: clean(t.primaryColor),
    timezone:     clean(t.timezone),
    locale:       clean(t.locale),
    currency:     clean(t.currency),
    customDomain: clean(t.customDomain),
    trialEndsAt:  clean(t.trialEndsAt),
  };
}

/** Only what PUT /tenants/{id} accepts (UpdateTenantRequest) — slug is fixed after creation. */
function toUpdatePayload(f: TenantPayload, includePlan: boolean): TenantUpdatePayload {
  const payload: TenantUpdatePayload = {
    name:         f.name.trim(),
    logoUrl:      f.logoUrl.trim(),
    primaryColor: f.primaryColor.trim(),
    timezone:     f.timezone.trim(),
    locale:       f.locale.trim(),
    currency:     f.currency.trim(),
    customDomain: f.customDomain.trim(),
  };
  if (includePlan) {
    payload.plan = f.plan;
    if (f.trialEndsAt.trim()) payload.trialEndsAt = f.trialEndsAt.trim();
  }
  return payload;
}

const pick = <E extends object>(all: Record<string, string>, keys: string[]) =>
  Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k))) as E;

interface EditTenantPageProps {
  tenantId: number;
  onBack: () => void;
  onSaved?: () => void;
}

export default function EditTenantPage({ tenantId, onBack, onSaved }: EditTenantPageProps) {
  const { data: tenant, isLoading, isError, refetch } = useTenant(tenantId);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<TenantPayload | null>(null);
  const [basicErrors,  setBasicErrors]  = useState<TenantBasicInfoErrors>({});
  const [localeErrors, setLocaleErrors] = useState<TenantLocaleErrors>({});
  const [planErrors,   setPlanErrors]   = useState<TenantPlanErrors>({});

  const { mutate, isPending } = useUpdateTenant();
  const { show: showToast } = useToast();
  const canEditPlan = isSuperAdmin(getSession()?.role);
  const steps = canEditPlan ? [...BASE_STEPS, PLAN_STEP] : BASE_STEPS;
  const isLast = step === steps.length - 1;

  // Pre-fill once the tenant arrives; don't clobber edits on a background refetch.
  useEffect(() => {
    if (tenant && !formData) setFormData(toForm(tenant));
  }, [tenant, formData]);

  if (isLoading || (tenant && !formData)) {
    return <LoadingState fullScreen label="Loading tenant…" />;
  }

  if (isError || !tenant || !formData) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Organisations" title="Edit Tenant" onBack={onBack} />
        <EmptyState
          icon="alert-circle"
          tone="error"
          title="Couldn't load this tenant"
          subtitle="Check your connection and try again."
          action={{ label: 'Retry', onPress: () => refetch() }}
        />
      </Screen>
    );
  }

  const updateForm = (fields: Partial<TenantPayload>) =>
    setFormData((prev) => (prev ? { ...prev, ...fields } : prev));

  const validateStep = (i: number): boolean => {
    if (i === 0) {
      const errs = validateBasicInfo(formData);
      setBasicErrors(errs);
      return Object.keys(errs).length === 0;
    }
    if (i === 1) {
      const errs = validateLocale(formData);
      setLocaleErrors(errs);
      return Object.keys(errs).length === 0;
    }
    const errs = validatePlan(formData, { requireTrial: false });
    setPlanErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep((p) => p + 1);
  };

  const showServerErrors = (message: string, errors: string[]) => {
    const fieldErrs = fieldErrorsFrom(errors, SERVER_LABELS);
    const basic  = pick<TenantBasicInfoErrors>(fieldErrs, BASIC_KEYS);
    const locale = pick<TenantLocaleErrors>(fieldErrs, LOCALE_KEYS);
    const plan   = pick<TenantPlanErrors>(fieldErrs, PLAN_KEYS);
    setBasicErrors(basic); setLocaleErrors(locale); setPlanErrors(plan);
    if (Object.keys(basic).length) setStep(0);
    else if (Object.keys(locale).length) setStep(1);
    const unmapped = errors.length - Object.keys(fieldErrs).length;
    showToast({
      type: 'error',
      message: unmapped > 0 ? `${message}\n• ${errors.join('\n• ')}` : message,
    });
  };

  const handleSubmit = () => {
    if (!validateStep(step)) return;

    mutate(
      { id: tenantId, payload: toUpdatePayload(formData, canEditPlan) },
      {
        onSuccess: (res) => {
          if (res.success) {
            showToast({ type: 'success', message: res.message || 'Tenant updated.' });
            onSaved?.();
            onBack();
          } else {
            showServerErrors(res.message || 'Could not update tenant.', res.errors ?? []);
          }
        },
        onError: (e) => {
          const { message, errors } = describeApiError(e);
          showServerErrors(message, errors);
        },
      },
    );
  };

  const stepViews = [
    <StepTenantBasicInfo key={0} data={formData} onChange={updateForm} errors={basicErrors} slugLocked />,
    <StepTenantLocale    key={1} data={formData} onChange={updateForm} errors={localeErrors} />,
    <StepTenantPlan      key={2} data={formData} onChange={updateForm} errors={planErrors} />,
  ];

  return (
    <WizardScaffold
      title="Edit Tenant"
      steps={steps}
      step={step}
      onBack={onBack}
      onPrev={() => setStep((p) => p - 1)}
      onNext={isLast ? handleSubmit : handleNext}
      nextLabel={isLast ? 'Save Changes' : 'Continue'}
      loading={isPending}
    >
      {stepViews[step]}
    </WizardScaffold>
  );
}

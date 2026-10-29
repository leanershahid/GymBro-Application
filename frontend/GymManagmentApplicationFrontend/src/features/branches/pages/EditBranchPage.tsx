import React, { useEffect, useState } from 'react';
import WizardScaffold from '../../common/components/WizardScaffold';
import LoadingState from '../../common/components/LoadingState';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { describeApiError, fieldErrorsFrom } from '../../../api/apiError';
import { useBranch, useUpdateBranch } from '../api/branchQueries';
import { Branch, BranchPayload, BranchUpdatePayload } from '../types/branch.types';
import StepBranchBasicInfo, { BranchBasicInfoErrors } from '../components/StepBranchBasicInfo';
import StepBranchLocation, { BranchLocationErrors } from '../components/StepBranchLocation';
import StepBranchSettings, { BranchSettingsErrors } from '../components/StepBranchSettings';
import { validateBasicInfo, validateLocation, validateSettings } from '../utils/branchValidation';

const STEPS = [
  { title: 'Basic Info', sub: 'Branch identity and contact details' },
  { title: 'Location',   sub: 'Physical address and region' },
  { title: 'Settings',   sub: 'Capacity and timezone' },
];

// Server field label (see ValidationResponses.FieldLabel) → form key.
const SERVER_LABELS: Record<string, keyof BranchPayload> = {
  name: 'name', phone: 'phone', email: 'email', 'logo url': 'logoUrl',
  address: 'address', city: 'city', state: 'state', country: 'country', zip: 'zip',
  timezone: 'timezone', capacity: 'capacity',
};
const BASIC_KEYS    = ['name', 'code', 'phone', 'email', 'logoUrl'];
const LOCATION_KEYS = ['address', 'city', 'state', 'country', 'zip'];
const SETTINGS_KEYS = ['timezone', 'capacity'];

const clean = (v: string | null | undefined) => (v && v !== 'string' ? v : '');

function toForm(b: Branch): BranchPayload {
  return {
    tenantId: b.tenantId,
    name:     clean(b.name),
    code:     clean(b.code),
    address:  clean(b.address),
    city:     clean(b.city),
    state:    clean(b.state),
    country:  clean(b.country),
    zip:      clean(b.zip),
    phone:    clean(b.phone),
    email:    clean(b.email),
    timezone: clean(b.timezone),
    capacity: b.capacity ?? 0,
    logoUrl:  clean(b.logoUrl),
  };
}

/** Only what PUT /branches/{id} accepts (UpdateBranchRequest) — no code, tenant or status. */
function toUpdatePayload(f: BranchPayload): BranchUpdatePayload {
  return {
    name:     f.name.trim(),
    address:  f.address.trim(),
    city:     f.city.trim(),
    state:    f.state.trim(),
    country:  f.country.trim(),
    zip:      f.zip.trim(),
    phone:    f.phone.trim(),
    email:    f.email.trim(),
    timezone: f.timezone.trim(),
    capacity: f.capacity,
    logoUrl:  f.logoUrl.trim(),
  };
}

const pick = <E extends object>(all: Record<string, string>, keys: string[]) =>
  Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k))) as E;

interface EditBranchPageProps {
  branchId: number;
  onBack: () => void;
  onSaved?: () => void;
}

export default function EditBranchPage({ branchId, onBack, onSaved }: EditBranchPageProps) {
  const { data: branch, isLoading, isError, refetch } = useBranch(branchId);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<BranchPayload | null>(null);
  const [basicErrors, setBasicErrors]       = useState<BranchBasicInfoErrors>({});
  const [locationErrors, setLocationErrors] = useState<BranchLocationErrors>({});
  const [settingsErrors, setSettingsErrors] = useState<BranchSettingsErrors>({});

  const { mutate, isPending } = useUpdateBranch();
  const { show: showToast } = useToast();
  const isLast = step === STEPS.length - 1;

  // Pre-fill once the branch arrives; don't clobber edits on a background refetch.
  useEffect(() => {
    if (branch && !formData) setFormData(toForm(branch));
  }, [branch, formData]);

  if (isLoading || (branch && !formData)) {
    return <LoadingState fullScreen label="Loading branch…" />;
  }

  if (isError || !branch || !formData) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Locations" title="Edit Branch" onBack={onBack} />
        <EmptyState
          icon="alert-circle"
          tone="error"
          title="Couldn't load this branch"
          subtitle="Check your connection and try again."
          action={{ label: 'Retry', onPress: () => refetch() }}
        />
      </Screen>
    );
  }

  const updateForm = (fields: Partial<BranchPayload>) =>
    setFormData((prev) => (prev ? { ...prev, ...fields } : prev));

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

  const showServerErrors = (message: string, errors: string[]) => {
    const fieldErrs = fieldErrorsFrom(errors, SERVER_LABELS);
    const basic = pick<BranchBasicInfoErrors>(fieldErrs, BASIC_KEYS);
    const loc   = pick<BranchLocationErrors>(fieldErrs, LOCATION_KEYS);
    const set   = pick<BranchSettingsErrors>(fieldErrs, SETTINGS_KEYS);
    setBasicErrors(basic); setLocationErrors(loc); setSettingsErrors(set);
    if (Object.keys(basic).length) setStep(0);
    else if (Object.keys(loc).length) setStep(1);
    const unmapped = errors.length - Object.keys(fieldErrs).length;
    showToast({
      type: 'error',
      message: unmapped > 0 && errors.length ? `${message}\n• ${errors.join('\n• ')}` : message,
    });
  };

  const handleSubmit = () => {
    const errs = validateSettings(formData);
    if (Object.keys(errs).length > 0) { setSettingsErrors(errs); return; }
    setSettingsErrors({});

    mutate(
      { id: branchId, payload: toUpdatePayload(formData) },
      {
        onSuccess: (res) => {
          if (res.success) {
            showToast({ type: 'success', message: res.message || 'Branch updated.' });
            onSaved?.();
            onBack();
          } else {
            showServerErrors(res.message || 'Could not update branch.', res.errors ?? []);
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
    <StepBranchBasicInfo key={0} data={formData} onChange={updateForm} errors={basicErrors} codeLocked />,
    <StepBranchLocation  key={1} data={formData} onChange={updateForm} errors={locationErrors} />,
    <StepBranchSettings  key={2} data={formData} onChange={updateForm} errors={settingsErrors} hideTenant />,
  ];

  return (
    <WizardScaffold
      title="Edit Branch"
      steps={STEPS}
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

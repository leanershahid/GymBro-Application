import React, { useState } from 'react';
import { currentTenantId } from '../../../api/session';
import WizardScaffold from '../../common/components/WizardScaffold';
import { useToast } from '../../common/components/Toast';
import { useCreateBranch } from '../api/branchQueries';
import { BranchPayload } from '../types/branch.types';
import StepBranchBasicInfo, { BranchBasicInfoErrors } from '../components/StepBranchBasicInfo';
import StepBranchLocation, { BranchLocationErrors } from '../components/StepBranchLocation';
import StepBranchSettings, { BranchSettingsErrors } from '../components/StepBranchSettings';
import { isValidEmail } from '../../../utils/validation';

// ─── Steps ────────────────────────────────────────────────────────
const STEPS = [
  { title: 'Basic Info', sub: 'Branch identity and contact details' },
  { title: 'Location',   sub: 'Physical address and region' },
  { title: 'Settings',   sub: 'Capacity, timezone and tenant' },
];

// ─── Default values ───────────────────────────────────────────────
// tenantId is read from the session at mount (see the useState initializer), not at module load.
const DEFAULT_VALUES: Omit<BranchPayload, 'tenantId'> = {
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

  return e;
}

// ─── Component ────────────────────────────────────────────────────
interface AddBranchPageProps {
  onBack?: () => void;
}

export default function AddBranchPage({ onBack }: AddBranchPageProps) {
  const [step, setStep]       = useState(0);
  const [formData, setFormData] = useState<BranchPayload>(() => ({ ...DEFAULT_VALUES, tenantId: currentTenantId() }));
  const [basicErrors, setBasicErrors]     = useState<BranchBasicInfoErrors>({});
  const [locationErrors, setLocationErrors] = useState<BranchLocationErrors>({});
  const [settingsErrors, setSettingsErrors] = useState<BranchSettingsErrors>({});

  const { mutate, isPending } = useCreateBranch();
  const { show: showToast } = useToast();
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
      onSuccess: (res) => {
        if (res.success) {
          showToast({ type: 'success', message: res.message ?? 'Branch created.' });
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
    <StepBranchBasicInfo key={0} data={formData} onChange={updateForm} errors={basicErrors} />,
    <StepBranchLocation  key={1} data={formData} onChange={updateForm} errors={locationErrors} />,
    <StepBranchSettings  key={2} data={formData} onChange={updateForm} errors={settingsErrors} />,
  ];

  return (
    <WizardScaffold
      title="Add Branch"
      steps={STEPS}
      step={step}
      onBack={onBack}
      onPrev={() => setStep((p) => p - 1)}
      onNext={isLast ? handleSubmit : handleNext}
      nextLabel={isLast ? 'Create Branch' : 'Continue'}
      loading={isPending}
    >
      {stepViews[step]}
    </WizardScaffold>
  );
}

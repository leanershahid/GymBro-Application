import React, { useState } from 'react';
import { Alert } from 'react-native';
import WizardScaffold from '../../common/components/WizardScaffold';
import { useCreateTrainer } from '../api/trainerQueries';
import { defaultTrainerValues } from '../hooks/useTrainerDefaults';
import { TrainerPayload } from '../types/trainer.types';
import StepBasicInfo from '../components/StepBasicInfo';
import StepEmployment from '../components/StepEmployment';
import StepSalary from '../components/StepSalary';
import StepPaymentDetails from '../components/StepPaymentDetails';
import StepAvailability from '../components/StepAvailability';
import StepBookingCommission from '../components/StepBookingCommission';
import StepCertDocuments from '../components/StepCertDocuments';
import StepMiscellaneous from '../components/StepMiscellaneous';
import { Branch } from '../../branches/types/branch.types';
import { isValidEmail } from '../../../utils/validation';
import { describeApiError, fieldErrorsFrom } from '../../../api/apiError';

// ─── Steps ────────────────────────────────────────────────────────
const STEPS = [
  { title: 'Basic Info',    sub: 'Personal details and contact information' },
  { title: 'Employment',    sub: 'Role, department and contract dates' },
  { title: 'Salary',        sub: 'Pay structure, rates and commission' },
  { title: 'Payment',       sub: 'Bank details and payment method' },
  { title: 'Availability',  sub: 'Set the weekly working schedule' },
  { title: 'Booking',       sub: 'Session types, limits and commissions' },
  { title: 'Certs & Docs',  sub: 'Certifications and identity documents' },
  { title: 'Miscellaneous', sub: 'Emergency contact, social links and notes' },
];

// ─── Validation types ─────────────────────────────────────────────
export type BasicInfoErrors = {
  trainerCode?: string;
  displayName?: string;
  profileImage?: string;
  bio?: string;
  experienceYears?: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  address?: string;
};

function validateBasicInfo(data: TrainerPayload): BasicInfoErrors {
  const errs: BasicInfoErrors = {};
  // Required by the API: branch (checked separately), trainer code and email.
  // Display name becomes the trainer's name on their account, so it's required too.
  // Everything else is optional, but must be valid when filled in.
  if (!data.trainerCode?.trim())  errs.trainerCode  = 'Trainer code is required';
  if (!data.displayName?.trim())  errs.displayName  = 'Display name is required';
  if (data.dateOfBirth && data.dateOfBirth >= new Date().toISOString().slice(0, 10))
    errs.dateOfBirth = 'Date of birth must be in the past';
  if (data.phone?.trim() && !/^[+\d][\d\s-]{6,19}$/.test(data.phone.trim()))
    errs.phone = 'Enter a valid phone number';
  if (data.experienceYears != null && (Number.isNaN(data.experienceYears) || data.experienceYears < 0 || data.experienceYears > 60))
    errs.experienceYears = 'Enter years between 0 and 60';

  const email = data.email?.trim() ?? '';
  if (!email)
    errs.email = 'Email is required';
  else if (!isValidEmail(email))
    errs.email = 'Enter a valid email address';

  return errs;
}

/** Deep copy with "" strings removed, so optional blanks are sent as absent, not as invalid values. */
function stripBlanks<V>(value: V): V {
  if (Array.isArray(value)) return value.map(stripBlanks) as unknown as V;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim() === '') continue;
      out[k] = stripBlanks(v);
    }
    return out as V;
  }
  return value;
}

// ─── Component ────────────────────────────────────────────────────
interface AddTrainerPageProps {
  onBack?: () => void;
}

export default function AddTrainerPage({ onBack }: AddTrainerPageProps) {
  const [step, setStep]           = useState(0);
  const [formData, setFormData]   = useState<TrainerPayload>({ ...defaultTrainerValues });
  const [errors, setErrors]       = useState<BasicInfoErrors>({});
  const [branchError, setBranchError] = useState('');
  const { mutate, isPending }     = useCreateTrainer();

  const selectedBranchId: number | null = formData.branchId || null;

  const updateForm = (fields: Partial<TrainerPayload>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
    // clear field-level errors as user types
    const cleared = { ...errors };
    (Object.keys(fields) as (keyof BasicInfoErrors)[]).forEach((k) => delete cleared[k]);
    setErrors(cleared);
  };

  const handleBranchSelect = (branch: Branch) => {
    setFormData((prev) => ({ ...prev, branchId: branch.id }));
    setBranchError('');
  };

  const handleNext = () => {
    // branch must always be selected before advancing from any step
    if (!selectedBranchId) {
      setBranchError('Please select a branch first');
      return;
    }
    if (step === 0) {
      const errs = validateBasicInfo(formData);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
      setErrors({});
    }
    setStep((p) => p + 1);
  };

  const handleSubmit = () => {
    if (!selectedBranchId) {
      setBranchError('Please select a branch first');
      return;
    }
    // Blank optional fields go to the API as "not provided" rather than empty strings.
    mutate(stripBlanks(formData), {
      onSuccess: (res) => {
        const pwd = (res.data as { temporaryPassword?: string } | undefined)?.temporaryPassword;
        Alert.alert(
          res.success ? 'Success' : 'Error',
          (res.message ?? 'Something went wrong.') +
            (res.success && pwd ? `\n\nTemporary password: ${pwd}\nShare it with the trainer — it is shown only once.` : ''),
        );
      },
      onError: (err) => {
        const { message, errors: list } = describeApiError(err);
        const fieldErrs = fieldErrorsFrom(list, {
          'trainer code': 'trainerCode', 'display name': 'displayName', 'email': 'email', 'phone': 'phone',
          'date of birth': 'dateOfBirth', 'experience years': 'experienceYears', 'address': 'address', 'bio': 'bio',
        });
        if (Object.keys(fieldErrs).length) { setErrors(fieldErrs); setStep(0); }
        if (list.some(l => l.toLowerCase().startsWith('branch'))) setBranchError('Please select a branch');
        Alert.alert('Could not create trainer', list.length ? `${message}\n\n• ${list.join('\n• ')}` : message);
      },
    });
  };

  const isLast = step === STEPS.length - 1;

  const stepViews = [
    <StepBasicInfo
      key={0}
      data={formData}
      onChange={updateForm}
      errors={errors}
      selectedBranchId={selectedBranchId}
      onBranchSelect={handleBranchSelect}
      branchError={branchError}
    />,
    <StepEmployment        key={1} data={formData} onChange={updateForm} />,
    <StepSalary            key={2} data={formData} onChange={updateForm} />,
    <StepPaymentDetails    key={3} data={formData} onChange={updateForm} />,
    <StepAvailability      key={4} data={formData} onChange={updateForm} />,
    <StepBookingCommission key={5} data={formData} onChange={updateForm} />,
    <StepCertDocuments     key={6} data={formData} onChange={updateForm} />,
    <StepMiscellaneous     key={7} data={formData} onChange={updateForm} />,
  ];

  return (
    <WizardScaffold
      title="Add Trainer"
      steps={STEPS}
      step={step}
      onBack={onBack}
      onPrev={() => setStep((p) => p - 1)}
      onNext={isLast ? handleSubmit : handleNext}
      nextLabel={isLast ? 'Submit' : 'Continue'}
      loading={isPending}
    >
      {stepViews[step]}
    </WizardScaffold>
  );
}

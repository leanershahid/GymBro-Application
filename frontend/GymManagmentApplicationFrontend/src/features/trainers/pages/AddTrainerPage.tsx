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
  if (!data.trainerCode?.trim())  errs.trainerCode  = 'Trainer code is required';
  if (!data.displayName?.trim())  errs.displayName  = 'Display name is required';
  if (!data.bio?.trim())          errs.bio          = 'Bio is required';
  if (!data.gender?.trim())       errs.gender       = 'Please select a gender';
  if (!data.dateOfBirth?.trim())  errs.dateOfBirth  = 'Date of birth is required';
  if (!data.phone?.trim())        errs.phone        = 'Phone number is required';
  if (!data.address?.trim())      errs.address      = 'Address is required';
  if (!data.experienceYears)      errs.experienceYears = 'Experience years is required';

  const email = data.email?.trim() ?? '';
  if (!email)
    errs.email = 'Email is required';
  else if (!isValidEmail(email))
    errs.email = 'Enter a valid email address';

  return errs;
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
    mutate(formData, {
      onSuccess: (res) => {
        const pwd = (res.data as { temporaryPassword?: string } | undefined)?.temporaryPassword;
        Alert.alert(
          res.success ? 'Success' : 'Error',
          (res.message ?? 'Something went wrong.') +
            (res.success && pwd ? `\n\nTemporary password: ${pwd}\nShare it with the trainer — it is shown only once.` : ''),
        );
      },
      onError:   ()    => Alert.alert('Error', 'Failed to connect to server.'),
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

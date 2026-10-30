import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useCreateLead, useLeadSources } from '../api/leadQueries';
import { LEAD_SOURCE_PRESETS, LeadPayload } from '../types/lead.types';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';
import ChipSelect, { humanize } from '../../exercises/components/ChipSelect';
import FormPage from '../../exercises/components/FormPage';
import BranchDropdown from '../../branches/components/BranchDropdown';
import { currentTenantId, getSession, isAdminRole } from '../../../api/session';
import { apiErrorText } from '../../../api/apiError';
import { isValidEmail } from '../../../utils/validation';
import { useToast } from '../../common/components/Toast';

interface Props { onBack: () => void; onCreated?: () => void }

type Errors = { firstName?: string; lastName?: string; email?: string; phone?: string; source?: string };

export default function AddLeadPage({ onBack, onCreated }: Props) {
  const toast = useToast();
  const { mutate: create, isPending } = useCreateLead();
  const isAdmin = isAdminRole(getSession()?.role);
  // The sources breakdown is admin-only; for others the presets are enough.
  const { data: usedSources = [] } = useLeadSources(isAdmin);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [source, setSource]       = useState('walk-in');
  const [notes, setNotes]         = useState('');
  const [branchId, setBranchId]   = useState<number | null>(getSession()?.branchId ?? null);
  const [errors, setErrors]       = useState<Errors>({});

  const sourceOptions = useMemo(() => {
    const all = new Set<string>(LEAD_SOURCE_PRESETS);
    for (const s of usedSources) if (s.source && s.source !== 'Unknown') all.add(s.source);
    return [...all].map(s => ({ value: s, label: humanize(s) }));
  }, [usedSources]);

  const submit = () => {
    const errs: Errors = {};
    const em = email.trim();
    const ph = phone.trim();
    if (!firstName.trim() && !ph && !em) errs.firstName = 'Enter a name, phone or email';
    if (firstName.trim().length > 100) errs.firstName = 'First name must be 100 characters or fewer';
    if (lastName.trim().length > 100) errs.lastName = 'Last name must be 100 characters or fewer';
    if (em && !isValidEmail(em)) errs.email = 'Enter a valid email address';
    if (ph && !/^[+\d][\d\s-]{6,19}$/.test(ph)) errs.phone = 'Enter a valid phone number';
    if (source.trim().length > 100) errs.source = 'Source must be 100 characters or fewer';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload: LeadPayload = {
      tenantId: currentTenantId(),
      branchId: branchId ?? undefined,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      email: em || undefined,
      phone: ph || undefined,
      source: source.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    create(payload, {
      onSuccess: () => {
        toast.show({ type: 'success', message: 'Lead added.' });
        onCreated?.();
        onBack();
      },
      onError: (e) => Alert.alert('Could not add lead', apiErrorText(e)),
    });
  };

  return (
    <FormPage eyebrow="Pipeline" title="New Lead" onBack={onBack} submitLabel="Add Lead" onSubmit={submit} submitting={isPending}>
      <RowGrid>
        <GridCell>
          <Field label="First name" value={firstName} onChangeText={setFirstName} error={errors.firstName} autoCapitalize="words" />
        </GridCell>
        <GridCell>
          <Field label="Last name" value={lastName} onChangeText={setLastName} error={errors.lastName} autoCapitalize="words" />
        </GridCell>
      </RowGrid>
      <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" error={errors.phone} />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors.email} />

      <ChipSelect label="Source" value={source} onChange={setSource} options={sourceOptions} />
      <Field label="Custom source" value={source} onChangeText={setSource} placeholder="Or type your own" autoCapitalize="none" error={errors.source} />

      {isAdmin && (
        <BranchDropdown label="Branch (optional)" value={branchId} onChange={(b) => setBranchId(b.id)} />
      )}

      <Field label="Interest / notes" value={notes} onChangeText={setNotes} placeholder="What they're interested in, best time to call…" multiline />
    </FormPage>
  );
}

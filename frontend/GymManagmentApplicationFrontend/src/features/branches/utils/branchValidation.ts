import { BranchPayload } from '../types/branch.types';
import { BranchBasicInfoErrors } from '../components/StepBranchBasicInfo';
import { BranchLocationErrors } from '../components/StepBranchLocation';
import { BranchSettingsErrors } from '../components/StepBranchSettings';
import { isValidEmail } from '../../../utils/validation';

// Shared by AddBranchPage and EditBranchPage so both forms enforce the same rules.
// ─── Validation ───────────────────────────────────────────────────
export function validateBasicInfo(d: Partial<BranchPayload>): BranchBasicInfoErrors {
  const e: BranchBasicInfoErrors = {};
  if (!d.name?.trim())  e.name  = 'Branch name is required';
  if (!d.code?.trim())  e.code  = 'Branch code is required';
  if (!d.phone?.trim()) e.phone = 'Phone is required';
  const email = d.email?.trim() ?? '';
  if (!email)                                     e.email = 'Email is required';
  else if (!isValidEmail(email)) e.email = 'Enter a valid email';
  return e;
}

export function validateLocation(d: Partial<BranchPayload>): BranchLocationErrors {
  const e: BranchLocationErrors = {};
  if (!d.address?.trim()) e.address = 'Address is required';
  if (!d.city?.trim())    e.city    = 'City is required';
  if (!d.state?.trim())   e.state   = 'State is required';
  if (!d.country?.trim()) e.country = 'Country is required';
  if (!d.zip?.trim())     e.zip     = 'ZIP is required';
  return e;
}

export function validateSettings(d: Partial<BranchPayload>): BranchSettingsErrors {
  const e: BranchSettingsErrors = {};
  if (!d.timezone?.trim())       e.timezone = 'Timezone is required';
  if (!d.capacity || d.capacity < 1) e.capacity = 'Capacity must be at least 1';

  return e;
}


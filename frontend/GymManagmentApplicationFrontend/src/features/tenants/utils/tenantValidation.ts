import { TenantPayload } from '../types/tenant.types';
import { TenantBasicInfoErrors } from '../components/StepTenantBasicInfo';
import { TenantLocaleErrors } from '../components/StepTenantLocale';
import { TenantPlanErrors } from '../components/StepTenantPlan';

// Shared by AddTenantPage and EditTenantPage so both forms enforce the same rules.
// ─── Validation ───────────────────────────────────────────────────
export function validateBasicInfo(d: Partial<TenantPayload>): TenantBasicInfoErrors {
  const e: TenantBasicInfoErrors = {};
  if (!d.name?.trim()) e.name = 'Tenant name is required';
  if (!d.slug?.trim()) e.slug = 'Slug is required';
  else if (!/^[a-z0-9-]+$/.test(d.slug)) e.slug = 'Slug can only contain lowercase letters, numbers and hyphens';
  return e;
}

export function validateLocale(d: Partial<TenantPayload>): TenantLocaleErrors {
  const e: TenantLocaleErrors = {};
  if (!d.timezone?.trim()) e.timezone = 'Timezone is required';
  if (!d.locale?.trim())   e.locale   = 'Locale is required';
  if (!d.currency?.trim()) e.currency = 'Currency is required';
  return e;
}

export function validatePlan(d: Partial<TenantPayload>, { requireTrial = true } = {}): TenantPlanErrors {
  const e: TenantPlanErrors = {};
  if (d.plan === undefined || d.plan === null) e.plan = 'Please select a plan';
  if (!d.trialEndsAt?.trim()) { if (requireTrial) e.trialEndsAt = 'Trial end date is required'; }
  else if (isNaN(Date.parse(d.trialEndsAt))) e.trialEndsAt = 'Enter a valid ISO date';
  return e;
}


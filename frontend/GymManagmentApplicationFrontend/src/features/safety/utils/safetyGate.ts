import { isAxiosError } from 'axios';
import { SafetyMissing, SafetyStep } from '../api/safety.types';

/**
 * The booking / self check-in gate. When a member isn't cleared to train the API answers
 * 422 { success: false, code: 'SAFETY_REQUIRED', message, data: { missing, context } }.
 *
 * Usage in any booking / check-in error handler:
 *   onError: e => { if (handleSafetyGateError(e)) return; showAlert('Could not book', apiErrorText(e)); }
 * which opens the waiver / health flow in <SafetyGateHost /> (mount it once in the member area).
 */
export const SAFETY_REQUIRED = 'SAFETY_REQUIRED';

export interface SafetyGateInfo { message: string; missing: SafetyMissing[]; context: string | null }

export function safetyGateFrom(e: unknown): SafetyGateInfo | null {
  if (!isAxiosError(e) || e.response?.status !== 422) return null;
  const body = e.response.data as { code?: string; message?: string; data?: { missing?: SafetyMissing[]; context?: string } } | undefined;
  if (body?.code !== SAFETY_REQUIRED) return null;
  return { message: body.message ?? 'Please complete your safety checks first.', missing: body.data?.missing ?? [], context: body.data?.context ?? null };
}

export const isSafetyGateError = (e: unknown): boolean => safetyGateFrom(e) !== null;

/** First step to show for what is missing. */
export function firstStepFor(missing: readonly SafetyMissing[]): SafetyStep {
  if (missing.includes('waiver')) return 'waiver';
  if (missing.includes('health') || missing.includes('health_expired') || missing.includes('clearance')) return 'health';
  if (missing.includes('emergency_contact')) return 'emergency';
  return 'waiver';
}

// ── Tiny event bus: anything can ask the host to open the flow ─────────────

export interface SafetyFlowRequest { start?: SafetyStep; only?: SafetyStep; reason?: string }
type Listener = (r: SafetyFlowRequest) => void;
const listeners = new Set<Listener>();

/** Registered by SafetyGateHost. */
export function onSafetyFlowRequest(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Opens the safety flow (no-op when no SafetyGateHost is mounted). Returns whether a host took it. */
export function openSafetyFlow(r: SafetyFlowRequest = {}): boolean {
  listeners.forEach(l => l(r));
  return listeners.size > 0;
}

/** True (and the flow opens) when `e` is the SAFETY_REQUIRED gate; false for any other error. */
export function handleSafetyGateError(e: unknown): boolean {
  const info = safetyGateFrom(e);
  if (!info) return false;
  return openSafetyFlow({ start: firstStepFor(info.missing), reason: info.message });
}

export const MISSING_LABEL: Record<SafetyMissing, string> = {
  waiver: 'Waiver not signed',
  health: 'Health check missing',
  health_expired: 'Health check expired',
  clearance: 'Medical clearance pending',
  emergency_contact: 'No emergency contact',
};

export const fmtDay = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

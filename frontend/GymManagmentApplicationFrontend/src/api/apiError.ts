import { isAxiosError } from 'axios';
import { ApiResponse } from './types';

/**
 * Turns a failed request into something a person can act on. The API answers validation
 * problems with 400 { message, errors: ["Field: what's wrong", ...] }; network failures have
 * no response at all. Never shows "Failed to connect" for a request the server rejected.
 */
export function describeApiError(e: unknown): { message: string; errors: string[] } {
  if (isAxiosError(e)) {
    const body = e.response?.data as Partial<ApiResponse<unknown>> | undefined;
    if (!e.response) return { message: 'Could not reach the server. Check your connection and try again.', errors: [] };
    if (body && (body.message || body.errors?.length))
      return { message: body.message || 'Request failed.', errors: body.errors ?? [] };
    if (e.response.status === 401) return { message: 'Your session has expired. Please sign in again.', errors: [] };
    if (e.response.status === 403) return { message: 'You don’t have permission to do this.', errors: [] };
    return { message: `Request failed (${e.response.status}).`, errors: [] };
  }
  return { message: e instanceof Error ? e.message : 'Something went wrong.', errors: [] };
}

/** Message + bullet list, ready for an Alert. */
export function apiErrorText(e: unknown): string {
  const { message, errors } = describeApiError(e);
  return errors.length ? `${message}\n\n• ${errors.join('\n• ')}` : message;
}

/**
 * Maps server field errors ("Last name: …", "Employment › Joining date: …") onto form keys,
 * so they can be shown under the right input. `labels` maps the server's label → form key.
 */
export function fieldErrorsFrom(errors: string[], labels: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of errors) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const label = line.slice(0, idx).trim().toLowerCase();
    const key = labels[label];
    if (key && !out[key]) out[key] = line.slice(idx + 1).trim();
  }
  return out;
}

import { ApiResponse } from './types';

/**
 * The one way to read the `{ success, message, data, errors }` envelope (ARCH-061).
 *
 * A 200 with `success: false` is a failure everywhere: it throws an ApiError, so React Query
 * reports it as an error. `message` is display-ready (server message plus a bullet list of the
 * field errors); `serverMessage` / `errors` keep the parts apart for forms (see apiError.ts).
 */
export class ApiError extends Error {
  readonly serverMessage: string;
  readonly errors: string[];

  constructor(serverMessage: string, errors: string[] = []) {
    super(errors.length ? `${serverMessage}\n\n• ${errors.join('\n• ')}` : serverMessage);
    this.name = 'ApiError';
    this.serverMessage = serverMessage;
    this.errors = errors;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** An axios response, or anything else carrying the envelope in `data`. */
type Enveloped<T> = { data: ApiResponse<T> };

function check<T>(res: ApiResponse<T>): void {
  if (!res || typeof res !== 'object') throw new ApiError('Unexpected response from the server.');
  if (!res.success) throw new ApiError(res.message || 'Request failed.', res.errors ?? []);
}

/**
 * Returns the envelope's `data` (or `fallback` when it is null), throwing ApiError when
 * `success` is false. Accepts the envelope itself.
 */
export function unwrap<T>(res: ApiResponse<T>, fallback?: T): T {
  check(res);
  return (res.data ?? fallback ?? res.data) as T;
}

/** Like unwrap, but also throws when a successful envelope carries no data and no fallback was given. */
export function unwrapRequired<T>(res: ApiResponse<T>, fallback?: T): T {
  check(res);
  if (res.data == null) {
    if (fallback !== undefined) return fallback;
    throw new ApiError(res.message || 'Empty response.');
  }
  return res.data;
}

/** unwrap for an axios response (`.then(unwrapResponse)`). */
export const unwrapResponse = <T,>(res: Enveloped<T>): T => unwrap(res.data);

/** The envelope's success message (e.g. "4 classes scheduled."), after checking it succeeded. */
export function messageOf(res: Enveloped<unknown> | ApiResponse<unknown>): string {
  const env = ('success' in res ? res : res.data) as ApiResponse<unknown>;
  check(env);
  return env.message;
}

import { describe, expect, it } from '@jest/globals';
import { ApiError, unwrap, unwrapRequired, unwrapResponse, messageOf } from '../http';
import { describeApiError, apiErrorText, fieldErrorsFrom } from '../apiError';
import { ApiResponse } from '../types';

const ok = <T,>(data: T | null, message = 'OK'): ApiResponse<T> => ({ success: true, message, data, errors: null });
const fail = (message: string, errors: string[] | null = null): ApiResponse<never> =>
  ({ success: false, message, data: null, errors });

describe('unwrap', () => {
  it('returns data on success', () => {
    expect(unwrap(ok({ id: 1 }))).toEqual({ id: 1 });
  });

  it('returns the fallback when data is null', () => {
    expect(unwrap(ok<number[]>(null), [])).toEqual([]);
    expect(unwrap(ok<number>(null))).toBeNull();
  });

  it('throws ApiError with message and field errors on success:false', () => {
    let caught: unknown;
    try { unwrap(fail('Invalid', ['Name: required', 'Price: too low'])); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ApiError);
    const e = caught as ApiError;
    expect(e.serverMessage).toBe('Invalid');
    expect(e.errors).toEqual(['Name: required', 'Price: too low']);
    expect(e.message).toBe('Invalid\n\n• Name: required\n• Price: too low');
  });

  it('uses a default message when the server sent none', () => {
    expect(() => unwrap(fail(''))).toThrow('Request failed.');
  });
});

describe('unwrapRequired', () => {
  it('throws on a successful but empty envelope without fallback', () => {
    expect(() => unwrapRequired(ok<number>(null, 'Nothing here'))).toThrow('Nothing here');
  });
  it('returns the fallback for an empty envelope', () => {
    expect(unwrapRequired(ok<string[]>(null), ['x'])).toEqual(['x']);
  });
});

describe('unwrapResponse / messageOf', () => {
  it('reads an axios-shaped response', () => {
    expect(unwrapResponse({ data: ok(5) })).toBe(5);
    expect(messageOf({ data: ok(5, '4 classes scheduled.') })).toBe('4 classes scheduled.');
  });
  it('messageOf throws for a failed envelope', () => {
    expect(() => messageOf(fail('Nope'))).toThrow(ApiError);
  });
});

describe('describeApiError', () => {
  it('splits an ApiError into message and errors', () => {
    expect(describeApiError(new ApiError('Bad', ['A: b']))).toEqual({ message: 'Bad', errors: ['A: b'] });
    expect(apiErrorText(new ApiError('Bad', ['A: b']))).toBe('Bad\n\n• A: b');
  });

  it('falls back to the Error message', () => {
    expect(describeApiError(new Error('boom'))).toEqual({ message: 'boom', errors: [] });
    expect(describeApiError('weird')).toEqual({ message: 'Something went wrong.', errors: [] });
  });
});

describe('fieldErrorsFrom', () => {
  it('maps server labels onto form keys, first error wins', () => {
    const out = fieldErrorsFrom(
      ['Last name: is required', 'Email: is invalid', 'Last name: too long', 'no colon here'],
      { 'last name': 'lastName', email: 'email' },
    );
    expect(out).toEqual({ lastName: 'is required', email: 'is invalid' });
  });
});

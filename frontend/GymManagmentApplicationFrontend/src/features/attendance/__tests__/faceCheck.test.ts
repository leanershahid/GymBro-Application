import { describe, expect, it } from '@jest/globals';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  attemptBadge, browserCameraAvailable, faceBadge, faceErrorFrom, formatScore, retentionText, selfieMimeType, validateFaceSettings,
} from '../utils/faceCheck';

const httpError = (status: number, body: unknown) => {
  const headers = new AxiosHeaders();
  return new AxiosError('fail', 'ERR_BAD_REQUEST', { headers }, null, {
    status, statusText: '', headers: {}, config: { headers }, data: body,
  });
};

describe('faceErrorFrom', () => {
  it('maps each code to the next step', () => {
    expect(faceErrorFrom(httpError(422, { code: 'FACE_ENROLL_REQUIRED', message: 'Set up' }))?.next).toBe('enroll');
    expect(faceErrorFrom(httpError(422, { code: 'FACE_NOT_CLEAR', message: 'x' }))?.next).toBe('retry');
    expect(faceErrorFrom(httpError(422, { code: 'FACE_LOCKED', message: 'x' }))?.next).toBe('desk');
    expect(faceErrorFrom(httpError(503, { code: 'FACE_UNAVAILABLE', message: 'down' }))?.next).toBe('desk');
    expect(faceErrorFrom(httpError(422, { code: 'FACE_CONSENT_REQUIRED', message: 'x' }))?.next).toBe('consent');
  });

  it('reads attempts left and sends the last mismatch to the desk', () => {
    const two = faceErrorFrom(httpError(422, { code: 'FACE_MISMATCH', message: 'No match', data: { attemptsLeft: 2 } }));
    expect(two).toEqual({ code: 'FACE_MISMATCH', message: 'No match', attemptsLeft: 2, next: 'retry' });
    expect(faceErrorFrom(httpError(422, { code: 'FACE_MISMATCH', message: 'm', data: { attemptsLeft: 0 } }))?.next).toBe('desk');
  });

  it('falls back to a default message and ignores other errors', () => {
    expect(faceErrorFrom(httpError(503, { code: 'FACE_UNAVAILABLE' }))?.message).toMatch(/front desk/);
    expect(faceErrorFrom(httpError(422, { code: 'SAFETY_REQUIRED', message: 'x' }))).toBeNull();
    expect(faceErrorFrom(new Error('boom'))).toBeNull();
  });
});

describe('badges', () => {
  it('shows "Face ✓ 97%" for a matched visit and nothing without a face check', () => {
    expect(faceBadge({ faceVerified: true, faceScore: 97.8 })).toEqual({ label: 'Face ✓ 97%', tone: 'ok' });
    expect(faceBadge({ faceVerified: false, faceScore: null })).toEqual({ label: 'Face failed', tone: 'err' });
    expect(faceBadge({ faceVerified: null, faceScore: null })).toBeNull();
    expect(faceBadge({})).toBeNull();
  });

  it('labels failed attempts', () => {
    expect(attemptBadge({ outcome: 'mismatch', similarity: 61.2 }).label).toBe('Face failed 61%');
    expect(attemptBadge({ outcome: 'not_clear', similarity: null })).toEqual({ label: 'Face not clear', tone: 'warn' });
    expect(attemptBadge({ outcome: 'locked', similarity: null }).tone).toBe('neutral');
  });

  it('never rounds a score up', () => {
    expect(formatScore(89.99)).toBe('89%');
  });
});

describe('validateFaceSettings', () => {
  it('accepts the documented ranges', () => {
    expect(validateFaceSettings({ threshold: '90', keepDays: '30' })).toEqual({});
    expect(validateFaceSettings({ threshold: '80', keepDays: '0' })).toEqual({});
    expect(validateFaceSettings({ threshold: '99', keepDays: '90' })).toEqual({});
  });

  it('rejects values outside them', () => {
    expect(validateFaceSettings({ threshold: '79', keepDays: '30' }).threshold).toBeDefined();
    expect(validateFaceSettings({ threshold: '100', keepDays: '30' }).threshold).toBeDefined();
    expect(validateFaceSettings({ threshold: '', keepDays: '91' })).toEqual({ threshold: expect.any(String), keepDays: expect.any(String) });
  });
});

describe('helpers', () => {
  it('describes retention', () => {
    expect(retentionText(0)).toMatch(/aren’t kept/);
    expect(retentionText(1)).toMatch(/1 day /);
    expect(retentionText(30)).toMatch(/30 days/);
  });

  it('needs getUserMedia on a secure origin for the web camera', () => {
    const nav = { mediaDevices: { getUserMedia: () => undefined } };
    expect(browserCameraAvailable(nav, true)).toBe(true);
    expect(browserCameraAvailable(nav, false)).toBe(false);
    expect(browserCameraAvailable({}, true)).toBe(false);
    expect(browserCameraAvailable(undefined, true)).toBe(false);
  });

  it('detects the selfie type', () => {
    expect(selfieMimeType('data:image/png;base64,AAAA')).toBe('image/png');
    expect(selfieMimeType('data:image/jpeg;base64,AAAA')).toBe('image/jpeg');
    expect(selfieMimeType('file:///cache/Camera/abc.jpg')).toBe('image/jpeg');
    expect(selfieMimeType('file:///x.png')).toBe('image/png');
  });
});

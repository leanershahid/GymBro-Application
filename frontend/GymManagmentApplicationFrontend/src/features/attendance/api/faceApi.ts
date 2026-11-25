import axiosInstance from '../../../api/axios';
import { ApiResponse, PaginatedData } from '../../../api/types';
import { appendFile, postMultipart } from '../../../api/upload';
import {
  CapturedSelfie, CheckInResult, FaceAttempt, FaceAttemptPhotos, LocationFix, MemberFaceStatus, MyFaceStatus,
} from '../types/attendance.types';

// Face check-in (self check-in with a live selfie). See utils/faceCheck.ts for the error codes.
const BASE = '/attendance/face';
const EP = {
  checkInWithFace: '/attendance/check-in/face',
  me: `${BASE}/me`,
  enrollMe: `${BASE}/me/enroll`,
  member: (id: number) => `${BASE}/members/${id}`,
  enrollMember: (id: number) => `${BASE}/members/${id}/enroll`,
  resetMember: (id: number) => `${BASE}/members/${id}/reset`,
  attempts: `${BASE}/attempts`,
  attemptPhotos: (id: number) => `${BASE}/attempts/${id}/photos`,
};

/** Multipart form with the selfie as `field` (live capture only — never a picked file). */
async function selfieForm(field: string, selfie: CapturedSelfie, fields: Record<string, string | number | boolean | undefined>) {
  const form = new FormData();
  await appendFile(form, field, { uri: selfie.uri, mimeType: selfie.mimeType, fileName: selfie.mimeType === 'image/png' ? 'selfie.png' : 'selfie.jpg' }, 'selfie');
  form.append('capturedAt', selfie.capturedAt);
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, String(v));
  return form;
}

/** Location + selfie in one request; out of range is still success:false with the distance. */
export const checkInWithFace = async (fix: LocationFix, selfie: CapturedSelfie) =>
  postMultipart<CheckInResult>(EP.checkInWithFace, await selfieForm('selfie', selfie, {
    lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, branchId: fix.branchId,
  }));

// ── Member ──────────────────────────────────────────────────────────────
export const fetchMyFace = async () => (await axiosInstance.get<ApiResponse<MyFaceStatus>>(EP.me)).data;

/** `consent` = the member agreed on the consent screen just now. */
export const enrollMyFace = async (selfie: CapturedSelfie, consent: boolean) =>
  postMultipart<MyFaceStatus>(EP.enrollMe, await selfieForm('photo', selfie, { consent }));

export const removeMyFace = async () => (await axiosInstance.delete<ApiResponse<MyFaceStatus>>(EP.me)).data;

// ── Staff ───────────────────────────────────────────────────────────────
export const fetchMemberFace = async (memberId: number) =>
  (await axiosInstance.get<ApiResponse<MemberFaceStatus>>(EP.member(memberId))).data;

export const enrollMemberFace = async (memberId: number, selfie: CapturedSelfie, consentConfirmed: boolean) =>
  postMultipart<MemberFaceStatus>(EP.enrollMember(memberId), await selfieForm('photo', selfie, { consentConfirmed }));

export const resetMemberFace = async (memberId: number) =>
  (await axiosInstance.post<ApiResponse<MemberFaceStatus>>(EP.resetMember(memberId))).data;

export const deleteMemberFace = async (memberId: number) =>
  (await axiosInstance.delete<ApiResponse<null>>(EP.member(memberId))).data;

export const fetchFaceAttempts = async (date?: string, failedOnly = true, pageNumber = 1, pageSize = 50) =>
  (await axiosInstance.get<ApiResponse<PaginatedData<FaceAttempt>>>(EP.attempts, { params: { date, failedOnly, pageNumber, pageSize } })).data;

export const fetchFaceAttemptPhotos = async (attemptId: number) =>
  (await axiosInstance.get<ApiResponse<FaceAttemptPhotos>>(EP.attemptPhotos(attemptId))).data;

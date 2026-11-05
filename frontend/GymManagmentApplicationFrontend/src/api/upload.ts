import { Platform } from 'react-native';
import axiosInstance, { UPLOAD_TIMEOUT_MS } from './axios';
import { ApiResponse } from './types';

/** A picked file (expo-image-picker / expo-document-picker asset shape). */
export interface PickedFile {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

/** Best-effort MIME type from a file URI's extension (pickers don't always report one). */
export function guessMimeType(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return 'image/jpeg';
}

/** File extension for a MIME type ("image/jpeg" → "jpg"). */
const extensionOf = (type: string) => {
  const sub = type.split('/')[1] ?? 'bin';
  return sub === 'jpeg' ? 'jpg' : sub === 'quicktime' ? 'mov' : sub;
};

/**
 * Adds one file part to a multipart form, the way each platform needs it: a File built from the
 * picker's blob:/data: URI on web, RN's `{ uri, name, type }` descriptor on native.
 * `baseName` names files the picker didn't name ("upload" → "upload.jpg").
 */
export async function appendFile(form: FormData, field: string, file: PickedFile, baseName = 'upload'): Promise<void> {
  const type = file.mimeType || guessMimeType(file.uri);
  const name = file.fileName || `${baseName}.${extensionOf(type)}`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, new File([blob], name, { type: blob.type || type }));
  } else {
    form.append(field, { uri: file.uri, name, type } as unknown as Blob);
  }
}

export interface MultipartOptions {
  /** Upload progress, 0–1. */
  onProgress?: (fraction: number) => void;
  /** Defaults to UPLOAD_TIMEOUT_MS (uploads on mobile data are slow). */
  timeout?: number;
}

/** POSTs a multipart form and returns the API envelope. */
export async function postMultipart<T>(url: string, form: FormData, opts: MultipartOptions = {}): Promise<ApiResponse<T>> {
  const { data } = await axiosInstance.post<ApiResponse<T>>(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' }, // axios drops it on web so the browser adds the boundary
    timeout: opts.timeout ?? UPLOAD_TIMEOUT_MS,
    onUploadProgress: opts.onProgress
      ? e => { if (e.total) opts.onProgress!(Math.min(1, e.loaded / e.total)); }
      : undefined,
  });
  return data;
}

/**
 * Single-file multipart upload (plus optional extra text fields). Returns the API envelope.
 */
export async function uploadFile<T>(
  url: string,
  field: string,
  file: PickedFile,
  extra?: Record<string, string>,
  opts?: MultipartOptions,
): Promise<ApiResponse<T>> {
  const form = new FormData();
  await appendFile(form, field, file);
  for (const [k, v] of Object.entries(extra ?? {})) form.append(k, v);
  return postMultipart<T>(url, form, opts);
}

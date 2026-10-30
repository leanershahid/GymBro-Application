import { Platform } from 'react-native';
import axiosInstance from './axios';
import { ApiResponse } from './types';

/** A picked file (expo-image-picker / expo-document-picker asset shape). */
export interface PickedFile {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

/**
 * multipart/form-data upload that works on web (Blob from the picker's blob:/data: URI) and
 * native (RN's { uri, name, type } file part). Returns the API envelope.
 */
export async function uploadFile<T>(url: string, field: string, file: PickedFile): Promise<ApiResponse<T>> {
  const type = file.mimeType || guessType(file.uri);
  const name = file.fileName || `upload.${type.split('/')[1] ?? 'bin'}`;
  const form = new FormData();

  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, new File([blob], name, { type: blob.type || type }));
  } else {
    // React Native's FormData accepts this file descriptor.
    form.append(field, { uri: file.uri, name, type } as unknown as Blob);
  }

  const { data } = await axiosInstance.post<ApiResponse<T>>(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' }, // axios drops it on web so the browser adds the boundary
  });
  return data;
}

function guessType(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return 'image/jpeg';
}

import { Platform, Share } from 'react-native';

// Copy / download without extra packages (no expo-clipboard or expo-file-system installed):
// web uses the Clipboard API and a Blob download; phones use the system share sheet, which
// offers "Copy", "Save to Files", notes apps, password managers…

/** Copies text (web) or opens the share sheet (phones). Resolves to what happened. */
export async function copyText(text: string): Promise<'copied' | 'shared' | 'failed'> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** Saves a .txt file (web) or shares the text (phones). */
export async function downloadText(filename: string, text: string): Promise<'downloaded' | 'shared' | 'failed'> {
  if (Platform.OS === 'web') {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }
  try {
    await Share.share({ message: text, title: filename });
    return 'shared';
  } catch {
    return 'failed';
  }
}

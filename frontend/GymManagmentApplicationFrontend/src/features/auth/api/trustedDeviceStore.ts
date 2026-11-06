import { prefsStore } from '../../../utils/storage';

// "Remember this device for 30 days" (2FA): the device token from /auth/2fa/verify, kept per
// email so a shared device never offers one person's token for another. It only skips the second
// step — the password is still required — and the server forgets it on password change,
// sign-out-everywhere and 2FA reset. Phones: SecureStore. Web: localStorage (it must outlive the
// tab to be useful; sessionStorage would forget it on close).

const key = (email: string) => `gymbro.2fa.device.${email.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_')}`;

export async function loadDeviceToken(email: string): Promise<string | null> {
  try { return await prefsStore.getItem(key(email)); } catch { return null; }
}

export async function saveDeviceToken(email: string, token: string | null | undefined) {
  try {
    if (token) await prefsStore.setItem(key(email), token);
    else await prefsStore.removeItem(key(email));
  } catch {
    // Storage unavailable — the next sign-in just asks for a code again.
  }
}

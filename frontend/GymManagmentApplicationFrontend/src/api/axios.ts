import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';

/** Default request timeout. Generous because the API host can cold-start (ARCH-060). */
export const REQUEST_TIMEOUT_MS = 30_000;
/** Multipart uploads (photos, videos) on mobile data need longer; see api/upload.ts. */
export const UPLOAD_TIMEOUT_MS = 120_000;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the JWT token to every request if one is stored
axiosInstance.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// In-memory access token — set after sign-in / refresh (see authStore.ts)
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

// ── Silent refresh ──────────────────────────────────────────────────────────
// Access tokens are short-lived. On a 401 the request is retried once after swapping the
// refresh token for a new pair; if that fails the session is over and the app returns to
// sign-in. Concurrent 401s share one refresh call, and a failed refresh ends the session
// exactly once (inside the shared promise), not once per waiting request (ARCH-117).

type Refresher = () => Promise<boolean>;
let refresher: Refresher | null = null;
let onSessionExpired: (() => void) | null = null;
let inflight: Promise<boolean> | null = null;

/** Wired up once by App.tsx: how to refresh, and what to do when the session can't be renewed. */
export function configureSessionHandling(refresh: Refresher, expired: () => void) {
  refresher = refresh;
  onSessionExpired = expired;
}

const NO_RETRY = ['/auth/login', '/auth/refresh-token', '/auth/logout'];

axiosInstance.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const status = error.response?.status;
  if (status !== 401 || !config || config._retried || !authToken || NO_RETRY.some(p => config.url?.includes(p)))
    return Promise.reject(error);

  config._retried = true;
  // Sent with a token that has since been replaced (another request already refreshed): just retry.
  const sentWith = String(config.headers.Authorization ?? '');
  if (!inflight && sentWith && sentWith !== `Bearer ${authToken}`) {
    config.headers.Authorization = `Bearer ${authToken}`;
    return axiosInstance(config);
  }
  inflight ??= (refresher?.() ?? Promise.resolve(false))
    .catch(() => false)
    .then(ok => {
      if (!ok) onSessionExpired?.();
      return ok;
    })
    .finally(() => { inflight = null; });
  if (await inflight) {
    config.headers.Authorization = `Bearer ${authToken}`;
    return axiosInstance(config);
  }
  return Promise.reject(error);
});

export default axiosInstance;

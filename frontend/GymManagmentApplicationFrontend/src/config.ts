/** Production API, used when no EXPO_PUBLIC_API_URL is set at build time. */
const DEFAULT_API_BASE_URL = 'https://gymbro-application.onrender.com/api';

/**
 * API base URL (ending in /api), from EXPO_PUBLIC_API_URL (ARCH-069). Expo inlines EXPO_PUBLIC_*
 * variables at build time — set it per EAS profile in eas.json, in the Vercel project's
 * environment variables for web, or in a local .env for development
 * (e.g. EXPO_PUBLIC_API_URL=https://localhost:7080/api). Must be referenced as
 * `process.env.EXPO_PUBLIC_API_URL` literally, or the inlining doesn't happen.
 */
export const API_BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

/**
 * The default profile picture shown for anyone without a photo — an image on Cloudinary.
 * Set it to that image's https URL (Cloudinary → Media Library → the image → Copy URL).
 * Empty: the built-in silhouette is drawn instead.
 */
export const DEFAULT_AVATAR_URL: string = '';

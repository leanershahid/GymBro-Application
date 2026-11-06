/**
 * Web build: no push (in-app alerts only). Same API as pushNotifications.native.ts, which Metro
 * picks on iOS / Android. Web push (service worker + VAPID) is deliberately not wired up.
 */
import type { PushPermission } from './pushTypes';

export type { PushPermission } from './pushTypes';
export { onNotificationOpen } from './openHandlers';

export const isPushSupported = (): boolean => false;
export const configurePush = async (): Promise<void> => {};
export const teardownPush = (): void => {};
export const getPushPermission = async (): Promise<PushPermission> => 'unsupported';
export const registerIfPermitted = async (): Promise<boolean> => false;
export const requestPushPermission = async (): Promise<PushPermission> => 'unsupported';
export const unregisterPushDevice = async (): Promise<void> => {};

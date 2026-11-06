/**
 * Push notifications on iOS / Android (expo-notifications, SDK 56). Web uses pushNotifications.ts
 * (in-app only). Remote push needs a development / store build: Expo Go on Android has none
 * since SDK 53, so `isPushSupported()` is false there and the explainer card never shows.
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { prefsStore } from '../../../utils/storage';
import { registerPushDevice, unregisterPushDeviceToken } from '../api/notificationsApi';
import { emitNotificationOpen, payloadFromData } from './openHandlers';
import type { PushPermission } from './pushTypes';

export type { PushPermission } from './pushTypes';
export { onNotificationOpen } from './openHandlers';

const TOKEN_KEY = 'gymbro.push.token';
const ANDROID_CHANNEL = 'default';

export function isPushSupported(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
}

let configured = false;
let responseSub: { remove(): void } | null = null;
let lastHandledId: string | null = null;

function handleResponse(response: Notifications.NotificationResponse | null | undefined) {
  if (!response) return;
  const id = response.notification.request.identifier;
  if (id === lastHandledId) return; // cold-start response is also replayed by the listener on some devices
  lastHandledId = id;
  emitNotificationOpen(payloadFromData(response.notification.request.content.data));
}

/** Foreground display, the Android channel and the tap listener. Safe to call repeatedly. */
export async function configurePush(): Promise<void> {
  if (configured || !isPushSupported()) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    // Must exist before the permission prompt / token on Android 13+.
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Reminders & updates',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => null);
  }
  responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);
  handleResponse(Notifications.getLastNotificationResponse());
}

export function teardownPush(): void {
  responseSub?.remove();
  responseSub = null;
  configured = false;
}

export async function getPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    if (Platform.OS === 'ios' && p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

async function tokenAndRegister(): Promise<boolean> {
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerPushDevice(token, Platform.OS === 'ios' ? 'ios' : 'android', Constants.deviceName ?? undefined);
      await prefsStore.setItem(TOKEN_KEY, token);
      return true;
    } catch {
      // Network hiccup: one quick retry, then give up quietly (the next sign-in tries again).
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return false;
}

/** After sign-in: registers this device when the user already allowed notifications. Never prompts. */
export async function registerIfPermitted(): Promise<boolean> {
  await configurePush();
  if ((await getPushPermission()) !== 'granted') return false;
  return tokenAndRegister();
}

/** From the explainer card: shows the OS prompt, then registers. Returns the resulting permission. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'unsupported';
  await configurePush();
  try {
    const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    if (!p.granted) return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
  await tokenAndRegister();
  return 'granted';
}

/** Sign-out: the server stops sending this account's pushes to this device. Best effort. */
export async function unregisterPushDevice(): Promise<void> {
  const token = await prefsStore.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  try { await unregisterPushDeviceToken(token); } catch { /* signed out anyway */ }
  await prefsStore.removeItem(TOKEN_KEY).catch(() => {});
}

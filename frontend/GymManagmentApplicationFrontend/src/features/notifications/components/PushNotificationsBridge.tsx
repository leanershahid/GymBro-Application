import { useEffect } from 'react';
import { configurePush, registerIfPermitted, teardownPush } from '../push/pushNotifications';

/**
 * Mounted once while someone is signed in (App.tsx). Sets up the foreground handler, Android
 * channel and tap listener, and re-registers this device's push token when the user already
 * allowed notifications. Never shows the OS prompt — that is PushPermissionCard's job.
 */
export default function PushNotificationsBridge({ userId }: { userId: number }) {
  useEffect(() => {
    void configurePush().then(() => registerIfPermitted()).catch(() => {});
    return () => teardownPush();
  }, [userId]);
  return null;
}

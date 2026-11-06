/**
 * Notifications feature — public entry point.
 *
 * Navigation wiring (for the shell / area routers, not done here):
 *   const off = onNotificationOpen(payload => {
 *     const target = parseNotificationRoute(payload);   // { screen: 'class', classId, offer } | …
 *     // map target → MemberRoute / TrainerRoute / admin route and open it
 *   });
 * Pushes tapped before a handler registers (cold start) are delivered to the first handler.
 */
export { onNotificationOpen } from './push/openHandlers';
export { parseNotificationRoute } from './utils/notificationRoutes';
export type { NotificationTarget } from './utils/notificationRoutes';
export type { NotificationPayload } from './types/notifications.types';
export { unregisterPushDevice, isPushSupported } from './push/pushNotifications';
export { default as PushNotificationsBridge } from './components/PushNotificationsBridge';
export { default as PushPermissionCard } from './components/PushPermissionCard';
export { default as WaitlistOfferBanner } from './components/WaitlistOfferBanner';
export { default as NotificationsScreen } from './screens/NotificationsScreen';
export { default as NotificationSettingsScreen } from './screens/NotificationSettingsScreen';
export { notificationKeys, useNotifications } from './api/notificationsQueries';

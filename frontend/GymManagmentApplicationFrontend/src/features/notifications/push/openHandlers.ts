import type { NotificationPayload } from '../types/notifications.types';

/**
 * Who handles a tapped notification. The navigation shell registers one handler with
 * `onNotificationOpen` (see the feature README in the lead's report); pushes tapped before a
 * handler exists (cold start) are kept and delivered to the first handler that registers.
 */
type Handler = (payload: NotificationPayload) => void;

const handlers = new Set<Handler>();
let pending: NotificationPayload | null = null;

export function onNotificationOpen(handler: Handler): () => void {
  handlers.add(handler);
  if (pending) {
    const p = pending;
    pending = null;
    handler(p);
  }
  return () => { handlers.delete(handler); };
}

/** Delivers a tap (push or in-app list) to the registered handlers. */
export function emitNotificationOpen(payload: NotificationPayload): void {
  if (handlers.size === 0) { pending = payload; return; }
  handlers.forEach(h => h(payload));
}

/** Reads `{kind, refId, route}` from a push's `data` (typed `Record<string, unknown>`). */
export function payloadFromData(data: Record<string, unknown> | null | undefined): NotificationPayload {
  const kind = typeof data?.kind === 'string' ? data.kind : null;
  const route = typeof data?.route === 'string' ? data.route : null;
  const ref = data?.refId;
  const refId = typeof ref === 'number' ? ref : typeof ref === 'string' && /^\d+$/.test(ref) ? Number(ref) : null;
  return { kind, refId, route };
}

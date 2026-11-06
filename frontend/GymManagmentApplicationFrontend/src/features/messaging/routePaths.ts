// Pure route helpers (no screens), so the area routers and their tests can import them cheaply.
import { idSegment } from '../../navigation/paths';

/** Member and trainer areas: the inbox and one thread (always open, no module). */
export type MessagingRoute =
  | { id: 'messages' }
  | { id: 'message-thread'; conversationId: number };

export const MESSAGING_IDS = ['messages', 'message-thread'] as const;
export type MessagingRouteId = typeof MESSAGING_IDS[number];
export const isMessagingRouteId = (s: string): s is MessagingRouteId => (MESSAGING_IDS as readonly string[]).includes(s);

export function messagingRouteFromPath([id, sub]: readonly string[]): MessagingRoute | null {
  switch (id) {
    case 'messages': return { id };
    case 'message-thread': {
      const conversationId = idSegment(sub);
      return conversationId ? { id, conversationId } : null;
    }
    default: return null;
  }
}

export function messagingRouteToPath(r: MessagingRoute): string[] {
  return r.id === 'message-thread' ? ['message-thread', String(r.conversationId)] : ['messages'];
}

/** Admin route keys (ModuleCatalog `admin.messages` → Route "messages-review"; the thread is owned by it). */
export const MESSAGES_REVIEW_ROUTE = 'messages-review' as const;
export const MESSAGES_REVIEW_THREAD_ROUTE = 'messages-review-thread' as const;

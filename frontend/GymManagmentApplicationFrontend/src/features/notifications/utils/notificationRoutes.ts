import type { NotificationPayload } from '../types/notifications.types';

/**
 * Where a tapped notification should take the user. The server sends a semantic screen key in
 * `route` (Application/Engagement/PushContracts.cs → PushRoutes); this turns it into a typed
 * target the navigation shell maps onto its own routes:
 *
 * | server route              | target                                   | member app            | trainer / admin       |
 * |---------------------------|------------------------------------------|-----------------------|-----------------------|
 * | classes/{id}              | { screen: 'class', classId }             | book → My bookings    | class roster          |
 * | classes/{id}/offer        | { screen: 'class', classId, offer: true } | book → My bookings (claim banner) | —      |
 * | pt/{id} · pt              | { screen: 'pt', sessionId? }             | book → PT tab         | trainer PT sessions   |
 * | my-bookings               | { screen: 'my-bookings' }                | book → My bookings (strikes / fees / block) | home |
 * | billing                   | { screen: 'billing' }                    | billing               | admin billing         |
 * | training                  | { screen: 'training' }                   | train                 | —                     |
 * | members/{id}              | { screen: 'member', memberId }           | —                     | admin member-detail/{id} |
 * | message-thread/{id}       | { screen: 'message-thread', conversationId } | message-thread/{id} | trainer message-thread/{id} |
 * | notifications · anything else | { screen: 'notifications' }          | alerts list           | alerts list           |
 */
export type NotificationTarget =
  | { screen: 'class'; classId: number; offer: boolean }
  | { screen: 'pt'; sessionId: number | null }
  /** Cancellation / no-show rules: a fee, strike or booking block (member's My bookings). */
  | { screen: 'my-bookings' }
  | { screen: 'billing' }
  | { screen: 'training' }
  | { screen: 'member'; memberId: number }
  | { screen: 'announcement'; announcementId: number | null }
  /** Self-service: membership-request/{id} (member) · membership-requests (staff queue). */
  | { screen: 'membership-request'; requestId: number | null }
  /** Help & feedback: help-request/{id} · help (member) · support-request/{id} · support (staff queue / trainer's assigned list). */
  | { screen: 'help-request'; requestId: number | null }
  | { screen: 'support-request'; requestId: number | null }
  /** Facilities: my-report/{id} · my-reports (reporter) · facility-report/{id} · facility-reports (staff queue). */
  | { screen: 'my-report'; reportId: number | null }
  /** Messaging: message-thread/{id} · messages (member or trainer inbox). */
  | { screen: 'message-thread'; conversationId: number | null }
  | { screen: 'facility-report'; reportId: number | null }
  | { screen: 'notifications' };

const id = (s: string | undefined): number | null => (s && /^\d+$/.test(s) ? Number(s) : null);

export function parseNotificationRoute(payload: NotificationPayload): NotificationTarget {
  const parts = (payload.route ?? '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'classes': {
      const classId = id(parts[1]) ?? payload.refId;
      return classId ? { screen: 'class', classId, offer: parts[2] === 'offer' } : { screen: 'notifications' };
    }
    case 'pt': return { screen: 'pt', sessionId: id(parts[1]) };
    case 'my-bookings': return { screen: 'my-bookings' };
    case 'billing': return { screen: 'billing' };
    case 'announcements': return { screen: 'announcement', announcementId: id(parts[1]) };
    case 'training': return { screen: 'training' };
    case 'membership-request': return { screen: 'membership-request', requestId: id(parts[1]) };
    case 'membership-requests': return { screen: 'membership-request', requestId: null };
    case 'help': case 'help-request': return { screen: 'help-request', requestId: id(parts[1]) };
    case 'support': case 'support-request': return { screen: 'support-request', requestId: id(parts[1]) };
    case 'my-report': case 'my-reports': return { screen: 'my-report', reportId: id(parts[1]) };
    case 'facility-report': case 'facility-reports': return { screen: 'facility-report', reportId: id(parts[1]) };
    case 'message-thread': case 'messages': return { screen: 'message-thread', conversationId: id(parts[1]) };
    case 'members': {
      const memberId = id(parts[1]);
      return memberId ? { screen: 'member', memberId } : { screen: 'notifications' };
    }
    default: return { screen: 'notifications' };
  }
}

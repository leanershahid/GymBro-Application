import { describe, expect, it } from '@jest/globals';
import { parseNotificationRoute } from '../utils/notificationRoutes';
import { emitNotificationOpen, onNotificationOpen, payloadFromData } from '../push/openHandlers';
import type { NotificationPayload } from '../types/notifications.types';

const p = (route: string | null, refId: number | null = null): NotificationPayload => ({ kind: null, refId, route });

describe('parseNotificationRoute', () => {
  it('maps the server route keys', () => {
    expect(parseNotificationRoute(p('classes/31'))).toEqual({ screen: 'class', classId: 31, offer: false });
    expect(parseNotificationRoute(p('classes/31/offer'))).toEqual({ screen: 'class', classId: 31, offer: true });
    expect(parseNotificationRoute(p('pt/12'))).toEqual({ screen: 'pt', sessionId: 12 });
    expect(parseNotificationRoute(p('pt'))).toEqual({ screen: 'pt', sessionId: null });
    expect(parseNotificationRoute(p('billing'))).toEqual({ screen: 'billing' });
    expect(parseNotificationRoute(p('training'))).toEqual({ screen: 'training' });
    expect(parseNotificationRoute(p('members/100'))).toEqual({ screen: 'member', memberId: 100 });
  });

  it('falls back to the alerts list', () => {
    expect(parseNotificationRoute(p(null))).toEqual({ screen: 'notifications' });
    expect(parseNotificationRoute(p('weird/thing'))).toEqual({ screen: 'notifications' });
    expect(parseNotificationRoute(p('classes/abc'))).toEqual({ screen: 'notifications' });
  });
});

describe('onNotificationOpen', () => {
  it('keeps a cold-start tap until a handler registers, then delivers live taps', () => {
    emitNotificationOpen(p('billing'));
    const seen: NotificationPayload[] = [];
    const off = onNotificationOpen(x => seen.push(x));
    emitNotificationOpen(payloadFromData({ kind: 'pt', refId: '12', route: 'pt/12' }));
    off();
    emitNotificationOpen(p('training')); // nobody listening: kept as pending, not delivered here
    expect(seen).toEqual([p('billing'), { kind: 'pt', refId: 12, route: 'pt/12' }]);
  });
});

import { describe, expect, it } from '@jest/globals';
import { memberModuleOf, memberRouteFromPath, memberRouteToPath } from '../../member-app/memberRoutes';
import { trainerModuleOf, trainerRouteFromPath, trainerRouteToPath } from '../../trainer-app/trainerRoutes';
import { adminFromPath, adminPath, ownerOf } from '../../dashboard/admin/adminRoutes';
import { parseNotificationRoute } from '../../notifications/utils/notificationRoutes';
import type { DirectMessage, OutgoingMessage } from '../api/messaging.types';
import { dayLabel, isRetryableSendError, lastReadMineId, mergeMessage, newClientMessageId, pendingOnly, threadItems } from '../utils/messageUtils';

const msg = (id: number, createdAt: string, mine = false, clientMessageId = `c${id}`): DirectMessage => ({
  id, clientMessageId, senderId: mine ? 1 : 2, mine, body: `m${id}`, photoUrl: null, attachment: null, createdAt, reported: false, redacted: false,
});

describe('messaging routes', () => {
  it('parses and prints the member and trainer routes', () => {
    expect(memberRouteFromPath(['messages'])).toEqual({ id: 'messages' });
    expect(memberRouteFromPath(['message-thread', '12'])).toEqual({ id: 'message-thread', conversationId: 12 });
    expect(memberRouteFromPath(['message-thread'])).toBeNull();
    expect(memberRouteToPath({ id: 'message-thread', conversationId: 12 })).toEqual(['message-thread', '12']);
    expect(memberModuleOf({ id: 'messages' })).toBe('home');
    expect(trainerRouteFromPath(['message-thread', '4'])).toEqual({ id: 'message-thread', conversationId: 4 });
    expect(trainerRouteToPath({ id: 'messages' })).toEqual(['messages']);
    expect(trainerModuleOf({ id: 'message-thread', conversationId: 4 })).toBe('home');
  });

  it('opens the admin review list and one thread (owned by the review module)', () => {
    expect(adminFromPath(['messages-review'])).toEqual({ screen: 'messages-review', id: 0, sub: [] });
    expect(adminFromPath(['messages-review-thread', '9'])).toEqual({ screen: 'messages-review-thread', id: 9, sub: [] });
    expect(adminFromPath(['messages-review-thread'])).toBeNull();
    expect(adminPath({ screen: 'messages-review-thread', id: 9, sub: [] })).toEqual(['messages-review-thread', '9']);
    expect(ownerOf('messages-review-thread')).toBe('messages-review');
  });

  it('maps the server push route', () => {
    expect(parseNotificationRoute({ route: 'message-thread/5', kind: null, refId: null })).toEqual({ screen: 'message-thread', conversationId: 5 });
    expect(parseNotificationRoute({ route: 'messages', kind: null, refId: null })).toEqual({ screen: 'message-thread', conversationId: null });
  });
});

describe('thread helpers', () => {
  it('makes unique client message ids', () => {
    const a = newClientMessageId(1, () => 0.1);
    expect(a).toMatch(/^m-[0-9a-z]+-[0-9a-z]{8}$/);
    expect(newClientMessageId(1, () => 0.2)).not.toBe(a);
  });

  it('merges stored messages and drops the optimistic copy once stored', () => {
    const list = [msg(1, '2026-11-05T10:00:00Z'), msg(3, '2026-11-05T10:02:00Z')];
    const merged = mergeMessage(list, msg(2, '2026-11-05T10:01:00Z', true, 'x'));
    expect(merged.map(m => m.id)).toEqual([1, 2, 3]);
    expect(mergeMessage(merged, msg(2, '2026-11-05T10:01:00Z', true, 'x'))).toHaveLength(3);
    const out: OutgoingMessage[] = [
      { clientMessageId: 'x', body: '', photoUrl: null, attachment: null, createdAt: '', status: 'sending' },
      { clientMessageId: 'y', body: '', photoUrl: null, attachment: null, createdAt: '', status: 'failed' },
    ];
    expect(pendingOnly(out, merged).map(o => o.clientMessageId)).toEqual(['y']);
  });

  it('adds a date separator before each day', () => {
    const now = new Date(2026, 10, 5, 12);
    const items = threadItems([msg(1, new Date(2026, 10, 4, 9).toISOString()), msg(2, new Date(2026, 10, 5, 9).toISOString()), msg(3, new Date(2026, 10, 5, 10).toISOString())], [], now);
    expect(items.map(i => i.kind)).toEqual(['day', 'message', 'day', 'message', 'message']);
    expect(items[0]).toMatchObject({ label: 'Yesterday' });
    expect(items[2]).toMatchObject({ label: 'Today' });
    expect(dayLabel(new Date(2025, 0, 3).toISOString(), now)).toContain('2025');
  });

  it('puts the read receipt under the last of my messages the other side has seen', () => {
    const list = [msg(1, '2026-11-05T10:00:00Z', true), msg(2, '2026-11-05T10:05:00Z', true)];
    expect(lastReadMineId(list, null)).toBeNull();
    expect(lastReadMineId(list, '2026-11-05T10:01:00Z')).toBe(1);
    expect(lastReadMineId(list, '2026-11-05T11:00:00Z')).toBe(2);
  });

  it('retries only network failures and server errors', () => {
    expect(isRetryableSendError(new Error('Network Error'))).toBe(true);
    expect(isRetryableSendError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableSendError({ response: { status: 422 } })).toBe(false);
    expect(isRetryableSendError({ response: { status: 429 } })).toBe(false);
  });
});

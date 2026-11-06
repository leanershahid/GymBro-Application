import { describe, expect, it } from '@jest/globals';
import { memberModuleOf, memberRouteFromPath, memberRouteToPath } from '../../member-app/memberRoutes';
import { adminFromPath, adminPath, ownerOf } from '../../dashboard/admin/adminRoutes';
import { trainerRouteFromPath, trainerRouteToPath } from '../../trainer-app/trainerRoutes';
import { parseNotificationRoute } from '../../notifications/utils/notificationRoutes';
import { ago, dueText } from '../components/SupportUi';

describe('help & feedback routes', () => {
  it('parses and prints the member routes', () => {
    expect(memberRouteFromPath(['help'])).toEqual({ id: 'help' });
    expect(memberRouteFromPath(['help-new'])).toEqual({ id: 'help-new' });
    expect(memberRouteFromPath(['help-request', '12'])).toEqual({ id: 'help-request', requestId: 12 });
    expect(memberRouteFromPath(['help-request'])).toBeNull();
    expect(memberRouteToPath({ id: 'help-request', requestId: 12 })).toEqual(['help-request', '12']);
    expect(memberModuleOf({ id: 'help' })).toBe('profile');
  });

  it('opens the admin queue and one request (owned by the support module)', () => {
    expect(adminFromPath(['support'])).toEqual({ screen: 'support', id: 0, sub: [] });
    expect(adminFromPath(['support-request', '7'])).toEqual({ screen: 'support-request', id: 7, sub: [] });
    expect(adminFromPath(['support-request'])).toBeNull();
    expect(adminPath({ screen: 'support-request', id: 7, sub: [] })).toEqual(['support-request', '7']);
    expect(ownerOf('support-request')).toBe('support');
  });

  it('has the trainer screens', () => {
    expect(trainerRouteFromPath(['support'])).toEqual({ id: 'support' });
    expect(trainerRouteFromPath(['support-request', '3'])).toEqual({ id: 'support-request', requestId: 3 });
    expect(trainerRouteToPath({ id: 'support-request', requestId: 3 })).toEqual(['support-request', '3']);
  });

  it('maps the server push routes', () => {
    expect(parseNotificationRoute({ route: 'help-request/5', kind: null, refId: null })).toEqual({ screen: 'help-request', requestId: 5 });
    expect(parseNotificationRoute({ route: 'support-request/9', kind: null, refId: null })).toEqual({ screen: 'support-request', requestId: 9 });
    expect(parseNotificationRoute({ route: 'support', kind: null, refId: null })).toEqual({ screen: 'support-request', requestId: null });
  });

  it('formats times and SLA due text', () => {
    const now = Date.parse('2026-11-05T12:00:00Z');
    expect(ago('2026-11-05T11:55:00Z', now)).toBe('5 min ago');
    expect(dueText('2026-11-05T15:00:00Z', now)).toBe('due in 3 h');
    expect(dueText('2026-11-05T10:00:00Z', now)).toBe('2 h overdue');
  });
});

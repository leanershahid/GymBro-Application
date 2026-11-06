import { describe, expect, it } from '@jest/globals';
import { memberModuleOf, memberRouteFromPath, memberRouteToPath } from '../../member-app/memberRoutes';
import { adminFromPath, adminPath } from '../../dashboard/admin/adminRoutes';
import { parseNotificationRoute } from '../../notifications/utils/notificationRoutes';

describe('self-service routes', () => {
  it('parses and prints the member routes', () => {
    expect(memberRouteFromPath(['plans-browse'])).toEqual({ id: 'plans-browse' });
    expect(memberRouteFromPath(['join'])).toEqual({ id: 'join' });
    expect(memberRouteFromPath(['join', '7'])).toEqual({ id: 'join', planId: 7 });
    expect(memberRouteFromPath(['my-membership'])).toEqual({ id: 'my-membership' });
    expect(memberRouteFromPath(['membership-request', '12'])).toEqual({ id: 'membership-request', requestId: 12 });
    expect(memberRouteFromPath(['membership-request'])).toBeNull();
    expect(memberRouteToPath({ id: 'join', planId: 7, coupon: 'SAVE10' })).toEqual(['join', '7']); // coupon never in the URL
    expect(memberRouteToPath({ id: 'membership-request', requestId: 12 })).toEqual(['membership-request', '12']);
    expect(memberModuleOf({ id: 'my-membership' })).toBe('billing');
  });

  it('opens the admin queue, optionally for one member', () => {
    expect(adminFromPath(['membership-requests'])).toEqual({ screen: 'membership-requests', id: 0, sub: [] });
    expect(adminFromPath(['membership-requests', '100'])).toEqual({ screen: 'membership-requests', id: 100, sub: [] });
    expect(adminPath({ screen: 'membership-requests', id: 100, sub: [] })).toEqual(['membership-requests', '100']);
  });

  it('maps request notifications', () => {
    expect(parseNotificationRoute({ kind: 'membership_request', refId: 5, route: 'membership-request/5' })).toEqual({ screen: 'membership-request', requestId: 5 });
    expect(parseNotificationRoute({ kind: 'membership_request_staff', refId: 5, route: 'membership-requests' })).toEqual({ screen: 'membership-request', requestId: null });
  });
});

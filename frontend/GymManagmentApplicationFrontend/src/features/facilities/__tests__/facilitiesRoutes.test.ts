import { describe, expect, it } from '@jest/globals';
import { memberModuleOf, memberRouteFromPath, memberRouteToPath } from '../../member-app/memberRoutes';
import { trainerRouteFromPath } from '../../trainer-app/trainerRoutes';
import { adminFromPath, adminPath, ownerOf } from '../../dashboard/admin/adminRoutes';
import { parseNotificationRoute } from '../../notifications/utils/notificationRoutes';
import { backLabel, filterZones } from '../utils/facilitiesFormat';

describe('facilities routes', () => {
  it('parses and prints the member routes', () => {
    expect(memberRouteFromPath(['report-problem'])).toEqual({ id: 'report-problem' });
    expect(memberRouteFromPath(['my-reports'])).toEqual({ id: 'my-reports' });
    expect(memberRouteFromPath(['my-report', '9'])).toEqual({ id: 'my-report', reportId: 9 });
    expect(memberRouteFromPath(['my-report'])).toBeNull();
    expect(memberRouteToPath({ id: 'my-report', reportId: 9 })).toEqual(['my-report', '9']);
    expect(memberModuleOf({ id: 'my-reports' })).toBe('profile');
    expect(trainerRouteFromPath(['report-problem'])).toEqual({ id: 'report-problem' });
  });

  it('opens the admin screens with their ids and owners', () => {
    expect(adminFromPath(['facility-asset', '3'])).toEqual({ screen: 'facility-asset', id: 3, sub: [] });
    expect(adminFromPath(['facility-asset'])).toBeNull();
    expect(adminFromPath(['incident-new'])).toEqual({ screen: 'incident-new', id: 0, sub: [] });
    expect(adminPath({ screen: 'incident', id: 5, sub: [] })).toEqual(['incident', '5']);
    expect(ownerOf('facility-report')).toBe('facility-reports');
    expect(ownerOf('incident-new')).toBe('incidents');
  });

  it('maps report notifications', () => {
    expect(parseNotificationRoute({ kind: 'facility_report', refId: 4, route: 'my-report/4' })).toEqual({ screen: 'my-report', reportId: 4 });
    expect(parseNotificationRoute({ kind: 'facility_report_staff', refId: 4, route: 'facility-report/4' })).toEqual({ screen: 'facility-report', reportId: 4 });
  });
});

describe('facilities format', () => {
  const today = new Date(2026, 10, 5); // Thu 5 Nov 2026
  it('says when a machine is back', () => {
    expect(backLabel('2026-11-07', today)).toBe('back ~Sat');
    expect(backLabel('2026-11-06', today)).toBe('back ~tomorrow');
    expect(backLabel('2026-11-20', today)).toBe('back ~20 Nov');
    expect(backLabel(null, today)).toBe('back soon');
    expect(backLabel('2026-11-01', today)).toBe('back soon');
  });
  it('filters the zone picker', () => {
    const zones = [{ zone: 'Cardio', assets: [{ name: 'Treadmill 3', assetType: 'Treadmill' }, { name: 'Rower', assetType: null }] }, { zone: 'Wellness', assets: [{ name: 'Pool', assetType: null }] }];
    expect(filterZones(zones, 'tread')).toEqual([{ zone: 'Cardio', assets: [{ name: 'Treadmill 3', assetType: 'Treadmill' }] }]);
    expect(filterZones(zones, 'wellness')[0].assets).toHaveLength(1);
    expect(filterZones(zones, '')).toBe(zones);
  });
});

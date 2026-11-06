import { describe, expect, it } from '@jest/globals';
import { Place, placeFromUrl, placeToUrl, syncStack } from '../paths';
import { createShellHistory, HistoryAdapter } from '../shellHistory';
import { memberRouteFromPath, memberRouteToPath } from '../../features/member-app/memberRoutes';
import { trainerRouteFromPath } from '../../features/trainer-app/trainerRoutes';
import { adminFromPath, adminPath, isAdminScreen } from '../../features/dashboard/admin/adminRoutes';
import { parseShopPath, shopPath } from '../../features/shop/store/shopNav';
import { parseShopAdminPath, shopAdminPath } from '../../features/shop/admin/nav';

const P = (area: Place['area'], ...path: string[]): Place => ({ area, path });

/** A fake browser history: entries of URLs, popstate delivered by `fire`. */
function fakeBrowser() {
  const urls: string[] = ['/'];
  let i = 0;
  const backs: number[] = [];
  const adapter: HistoryAdapter = {
    index: () => i,
    push: (url, n) => { urls.length = i + 1; urls.push(url); i += 1; expect(n).toBe(i); },
    replace: (url) => { urls[i] = url; },
    back: () => { i -= 1; backs.push(i); },
  };
  return { adapter, urls, at: () => urls[i], backs };
}

/** A clock that moves past the post-open grace window on every read. */
const ticking = () => { let t = 0; return () => (t += 1000); };

function setup(initial: Place, web = fakeBrowser(), now = ticking()) {
  const shown: Place[] = [];
  const h = createShellHistory(initial, { show: p => shown.push(p), expectsReport: p => p.area !== 'more' }, web.adapter, now);
  h.start();
  return { h, shown, web };
}

describe('paths', () => {
  it('round-trips places through URLs', () => {
    expect(placeToUrl(P('member', 'shop', 'product', 'whey protein'))).toBe('/member/shop/product/whey%20protein');
    expect(placeFromUrl('/member/shop/product/whey%20protein')).toEqual(P('member', 'shop', 'product', 'whey protein'));
    expect(placeFromUrl('/more')).toEqual(P('more'));
    expect(placeFromUrl('/')).toBeNull();
    expect(placeFromUrl('/elsewhere/x')).toBeNull();
  });

  it('syncs a pushed stack to a target', () => {
    const k = (s: string) => s;
    expect(syncStack(['a', 'b', 'c'], 'b', k)).toEqual(['a', 'b']);
    expect(syncStack(['a'], 'b', k)).toEqual(['a', 'b']);
    expect(syncStack(['a', 'b'], null, k)).toEqual([]);
  });
});

describe('shell history', () => {
  it('lets the first report canonicalise the opened entry', () => {
    const { h, web } = setup(P('member'));
    h.report(P('member', 'home'));
    expect(web.urls).toEqual(['/member/home']);
  });

  it('pushes screen changes and treats a report of the previous entry as Back', () => {
    const { h, web } = setup(P('member', 'train'));
    h.report(P('member', 'train'));
    h.report(P('member', 'workout', '7'));
    expect(web.at()).toBe('/member/workout/7');
    h.report(P('member', 'train'));                 // the screen's own Back button
    expect(web.backs).toEqual([0]);
    expect(h.current()).toEqual(P('member', 'train'));
    h.popped(0, P('member', 'train'));              // popstate of that history.back(): ignored
  });

  it('opens the entry browser Back/Forward lands on', () => {
    const { h, shown } = setup(P('admin', 'members'));
    h.report(P('admin', 'members'));
    h.report(P('admin', 'member-detail', '5'));
    h.popped(0, P('admin', 'members'));
    expect(shown.at(-1)).toEqual(P('admin', 'members'));
    h.popped(1, P('admin', 'member-detail', '5'));
    expect(shown.at(-1)).toEqual(P('admin', 'member-detail', '5'));
  });

  it('replace reports replace the entry', () => {
    const { h, web } = setup(P('member', 'shop'));
    h.report(P('member', 'shop'));
    h.report(P('member', 'shop', 'checkout'));
    h.report(P('member', 'shop', 'confirmed', 'GB1'), true);
    expect(web.urls).toEqual(['/member/shop', '/member/shop/confirmed/GB1']);
  });

  it('walks back on phones and leaves the app from the first entry', () => {
    const shown: Place[] = [];
    const h = createShellHistory(P('trainer', 'home'), { show: p => shown.push(p), expectsReport: () => true }, null, ticking());
    h.report(P('trainer', 'home'));
    h.go(P('trainer', 'clients'));
    h.report(P('trainer', 'clients'));
    h.report(P('trainer', 'client', '3'));
    expect(h.back()).toBe(true);
    expect(shown.at(-1)).toEqual(P('trainer', 'clients'));
    h.report(P('trainer', 'clients'));
    expect(h.back()).toBe(true);
    expect(shown.at(-1)).toEqual(P('trainer', 'home'));
    h.report(P('trainer', 'home'));
    expect(h.back()).toBe(false);
  });
});

describe('area routes', () => {
  it('parses member paths', () => {
    expect(memberRouteFromPath(['workout', '12'])).toEqual({ id: 'workout', workoutId: 12 });
    expect(memberRouteFromPath(['workout', 'x'])).toBeNull();
    expect(memberRouteFromPath(['nope'])).toBeNull();
    expect(memberRouteToPath({ id: 'plans', planId: 4 })).toEqual(['plans', '4']);
    expect(memberRouteFromPath(['shop', 'product', 'whey'])).toEqual({ id: 'shop', sub: ['product', 'whey'] });
  });

  it('parses trainer and admin paths', () => {
    expect(trainerRouteFromPath(['client', '9'])).toEqual({ id: 'client', clientId: 9 });
    expect(adminFromPath(['member-detail', '5'])).toEqual({ screen: 'member-detail', id: 5, sub: [] });
    expect(adminFromPath(['member-detail'])).toBeNull();
    expect(adminFromPath(['module-access'])).toEqual({ screen: 'module-access', id: 0, sub: [] });
    expect(adminPath({ screen: 'members', id: 5, sub: [] })).toEqual(['members']);
    expect(isAdminScreen('members')).toBe(true);
    expect(isAdminScreen('bogus')).toBe(false);
  });

  it('parses shop paths', () => {
    expect(parseShopPath(['orders', 'order', 'GB1'])).toEqual({ tab: 'orders', route: { id: 'order', orderNumber: 'GB1' } });
    expect(shopPath('store', 'store', { id: 'product', slug: 'whey' })).toEqual(['product', 'whey']);
    expect(parseShopAdminPath(['product', 'new'])).toEqual({ tab: null, route: { kind: 'product', id: null } });
    expect(shopAdminPath('orders', 'dashboard', { kind: 'order', orderNumber: 'GB2' })).toEqual(['orders', 'order', 'GB2']);
  });
});

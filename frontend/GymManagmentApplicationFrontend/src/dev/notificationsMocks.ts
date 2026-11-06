/**
 * Preview-mode mock API for the notifications feature (alerts list, Settings → Notifications,
 * waitlist offer claim/decline, gym notification settings). DEV web previews only.
 */
const ok = <T,>(data: T, message = 'OK') => ({ success: true, message, data, errors: null });
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let items = [
  { id: 9, title: 'A spot opened up', body: 'A spot opened in HIIT Blast on Thu 12 Nov, 6:30pm — claim it by 4:15pm.', kind: 'waitlist_offer', refId: 31, route: 'classes/31/offer', isRead: false, createdAt: minsAgo(4) },
  { id: 8, title: 'Spin starts in 2 hours', body: 'See you at Wed 11 Nov, 7:00pm. Can’t make it? Cancel so someone on the waitlist gets your spot.', kind: 'class_reminder', refId: 30, route: 'classes/30', isRead: false, createdAt: minsAgo(55) },
  { id: 7, title: 'Session confirmed', body: 'Strength 1:1 on 13 Nov 07:30 is now confirmed.', kind: 'pt', refId: 12, route: 'pt/12', isRead: true, createdAt: minsAgo(60 * 20) },
  { id: 6, title: 'New invoice INV-0042', body: '2,499.00 INR due 15 Nov.', kind: 'billing', refId: null, route: 'billing', isRead: true, createdAt: minsAgo(60 * 48) },
  { id: 5, title: 'Class cancelled', body: 'Yoga Flow on 09 Nov 08:00 UTC was cancelled. Instructor unwell.', kind: 'booking', refId: 27, route: 'classes/27', isRead: true, createdAt: minsAgo(60 * 72) },
];

let prefs = {
  categories: [
    { category: 'class_reminders', push: true, email: true },
    { category: 'pt_reminders', push: true, email: true },
    { category: 'waitlist', push: true, email: true },
    { category: 'billing', push: true, email: true },
    { category: 'announcements', push: true, email: true },
    { category: 'messages', push: true, email: false },
    { category: 'marketing', push: false, email: false },
  ],
  quietHoursEnabled: true, quietStart: '22:00', quietEnd: '07:00', timeZone: 'Asia/Kolkata', hasPushDevice: false,
};

let gym = { waitlistMode: 'auto', claimWindowMinutes: 30, remindersEnabled: true };

type Body = Record<string, unknown> | undefined;

export function notificationsRoute(method: string, path: string, body?: unknown): unknown {
  const b = body as Body;
  if (path === '/notifications' && method === 'get') return ok({ items, unread: items.filter(n => !n.isRead).length });
  if (path === '/notifications/read-all' && method === 'put') {
    items = items.map(n => ({ ...n, isRead: true }));
    return ok({ updated: items.length });
  }
  const read = /^\/notifications\/(\d+)\/read$/.exec(path);
  if (read && method === 'put') {
    items = items.map(n => (n.id === Number(read[1]) ? { ...n, isRead: true } : n));
    return ok({ updated: 1 });
  }
  if (path === '/me/notification-preferences') {
    if (method === 'put' && b) {
      const changed = (b.categories as typeof prefs.categories | undefined) ?? [];
      prefs = {
        ...prefs,
        categories: prefs.categories.map(c => changed.find(x => x.category === c.category) ?? c),
        quietHoursEnabled: typeof b.quietHoursEnabled === 'boolean' ? b.quietHoursEnabled : prefs.quietHoursEnabled,
        quietStart: typeof b.quietStart === 'string' ? b.quietStart : prefs.quietStart,
        quietEnd: typeof b.quietEnd === 'string' ? b.quietEnd : prefs.quietEnd,
      };
      return ok(prefs, 'Notification settings saved.');
    }
    return ok(prefs);
  }
  if (path === '/me/push-devices' || path === '/me/push-devices/unregister') return ok({ registered: true });
  if (path === '/notification-settings') {
    if (method === 'put' && b) gym = { ...gym, ...(b as typeof gym) };
    return ok(gym);
  }
  const offer = /^\/classes\/(\d+)\/waitlist-offer\/(claim|decline)$/.exec(path);
  if (offer && method === 'post') {
    items = items.filter(n => n.route !== `classes/${offer[1]}/offer`);
    return ok({}, offer[2] === 'claim' ? "You're in! Spot claimed." : "No problem — we've offered the spot to the next person.");
  }
  return undefined;
}

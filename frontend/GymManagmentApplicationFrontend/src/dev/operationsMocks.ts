/**
 * Preview-mode mock data for gym operations: opening hours, service status, announcements.
 * Development web builds only (see previewMode.ts). Never import statically from app code.
 */
const ok = <T,>(data: T, message = 'OK') => ({ success: true, message, data, errors: null });
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DOW = [1, 2, 3, 4, 5, 6, 0];
let weekly = DOW.map((day, i) => ({
  day, dayName: DAYS[i],
  intervals: day === 0 ? [{ opens: '08:00', closes: '14:00' }] : day === 6 ? [{ opens: '07:00', closes: '20:00' }] : [{ opens: '05:30', closes: '23:00' }],
}));
let exceptions = [{ id: 1, date: new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10), isClosed: true, intervals: [], note: 'Holiday — closed' }];
let profile = { amenities: '- Free parking\n- Lockers & showers\n- **Sauna** and steam room\n- 25 m pool', accessibility: '- Step-free entrance\n- Accessible changing room on level 1' };
let settings = { blockSelfCheckInOutsideHours: false };

const today = () => {
  const h = new Date().getHours();
  return h >= 23 || h < 5
    ? { isOpen: false, state: 'closed', label: 'Closed · opens 5:30am', closesAt: null, opensAt: at(6), note: null }
    : h >= 22
      ? { isOpen: true, state: 'closing_soon', label: 'Closing soon · closes 11pm', closesAt: at(1), opensAt: null, note: null }
      : { isOpen: true, state: 'open', label: 'Open · closes 11pm', closesAt: at(4), opensAt: null, note: null };
};
const hours = (branchId = 1) => ({
  branchId, branchName: 'Downtown', timezone: 'Asia/Kolkata', hasHours: true, today: today(),
  days: Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + i * 86_400_000);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en', { weekday: 'short' });
    const dow = d.getDay();
    return {
      date: d.toISOString().slice(0, 10), dayLabel: label, isClosed: false, isToday: i === 0, isException: false, note: null,
      intervals: [dow === 0 ? '8am – 2pm' : dow === 6 ? '7am – 8pm' : '5:30am – 11pm'],
    };
  }),
});

type MockStatus = { id: number; branchId: number | null; branchName: string | null; area: string | null; status: string; severity: string; message: string; startsAt: string; endsAt: string | null; isActive: boolean; headline: string };
let statuses: MockStatus[] = [
  { id: 1, branchId: 1, branchName: 'Downtown', area: 'Pool', status: 'Closed', severity: 'Critical', message: 'Closed for filter maintenance. Showers and sauna are open.', startsAt: at(-3), endsAt: at(30), isActive: true, headline: 'Pool · Closed' },
  { id: 2, branchId: null, branchName: null, area: 'Cardio floor', status: 'Limited', severity: 'Warning', message: 'Four treadmills are out of order.', startsAt: at(-20), endsAt: null, isActive: true, headline: 'Cardio floor · Limited' },
];

let announcements = [
  { id: 1, title: 'Pool closed this weekend', body: 'We are replacing the pool filters.\n- Sauna and steam stay open\n- **Aqua classes** move to Monday', imageUrl: null, ctaLabel: 'See classes', ctaRoute: 'book', audience: 'AllMembers', audienceIds: [], audienceLabel: 'All members', isPinned: true, isUrgent: true, status: 'Published', publishAt: at(-5), publishedAt: at(-5), expiresAt: at(48), recipientCount: 1284, readCount: 731, createdAt: at(-6), isRead: false },
  { id: 2, title: 'New HIIT class on Thursdays', body: 'Coach Meera starts a 30-minute HIIT session every Thursday at 7am.', imageUrl: null, ctaLabel: 'Book now', ctaRoute: 'book', audience: 'Branches', audienceIds: [1], audienceLabel: 'Downtown', isPinned: false, isUrgent: false, status: 'Published', publishAt: at(-50), publishedAt: at(-50), expiresAt: null, recipientCount: 512, readCount: 402, createdAt: at(-52), isRead: true },
  { id: 3, title: 'Diwali hours', body: 'Short hours on the holiday. Happy Diwali!', imageUrl: null, ctaLabel: null, ctaRoute: null, audience: 'AllMembers', audienceIds: [], audienceLabel: 'All members', isPinned: false, isUrgent: false, status: 'Scheduled', publishAt: at(72), publishedAt: null, expiresAt: null, recipientCount: 0, readCount: 0, createdAt: at(-2), isRead: false },
];
let nextId = 10;

const feedItem = ({ id, title, body, imageUrl, ctaLabel, ctaRoute, isPinned, isUrgent, publishedAt, isRead }: typeof announcements[number]) =>
  ({ id, title, body, imageUrl, ctaLabel, ctaRoute, isPinned, isUrgent, publishedAt: publishedAt!, isRead });
const published = () => announcements.filter(a => a.status === 'Published')
  .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.publishedAt!.localeCompare(a.publishedAt!));
const admin = ({ isRead: _r, ...a }: typeof announcements[number]) => a;

export function operationsRoute(method: string, path: string, body: unknown, query: URLSearchParams): unknown {
  const m = method.toLowerCase();
  const b = (body && typeof body === 'string' ? JSON.parse(body) : body) as Record<string, unknown> | undefined;

  // Hours & branch info
  if (/^\/branches\/(\d+|mine)\/info$/.test(path))
    return ok({ id: 1, name: 'Downtown', address: '12 Marine Drive', city: 'Mumbai', state: 'MH', country: 'India', zip: '400002',
      fullAddress: '12 Marine Drive, Mumbai, MH, 400002, India', lat: 18.9438, lng: 72.8231,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=18.9438,72.8231', phone: '+91 22 4000 1234', email: 'downtown@gymbro.app',
      logoUrl: null, ...profile, hours: hours(), statuses: statuses.filter(s => s.isActive) });
  if (path === '/branches/directory')
    return ok([{ id: 1, name: 'Downtown', city: 'Mumbai', isMine: true, today: today() }, { id: 2, name: 'Westside', city: 'Mumbai', isMine: false, today: today() }]);
  let match = /^\/branches\/(\d+)\/hours$/.exec(path);
  if (match) return ok(hours(Number(match[1])));
  match = /^\/branches\/(\d+)\/hours\/config$/.exec(path);
  if (match) return ok({ branchId: Number(match[1]), branchName: 'Downtown', timezone: 'Asia/Kolkata', weekly, exceptions, ...profile });
  if (/^\/branches\/\d+\/hours\/weekly$/.test(path) && m === 'put') {
    weekly = (b?.days as typeof weekly) ?? weekly;
    return ok({ branchId: 1, branchName: 'Downtown', timezone: 'Asia/Kolkata', weekly, exceptions, ...profile }, 'Opening hours saved.');
  }
  if (/^\/branches\/\d+\/hours\/exceptions$/.test(path) && m === 'post') {
    const row = { id: nextId++, date: String(b?.date), isClosed: !!b?.isClosed, intervals: (b?.intervals as never[]) ?? [], note: (b?.note as string) ?? null };
    exceptions = [...exceptions.filter(e => e.date !== row.date), row].sort((x, y) => x.date.localeCompare(y.date));
    return ok(row);
  }
  match = /^\/branches\/\d+\/hours\/exceptions\/(\d+)$/.exec(path);
  if (match && m === 'delete') { exceptions = exceptions.filter(e => e.id !== Number(match![1])); return ok(null); }
  if (/^\/branches\/\d+\/profile$/.test(path) && m === 'put') {
    profile = { amenities: String(b?.amenities ?? ''), accessibility: String(b?.accessibility ?? '') };
    return ok({ branchId: 1, branchName: 'Downtown', timezone: 'Asia/Kolkata', weekly, exceptions, ...profile });
  }
  if (path === '/operations/settings') { if (m === 'put') settings = b as typeof settings; return ok(settings); }

  // Service status
  if (path === '/service-status') return ok(statuses.filter(s => s.isActive));
  if (path === '/service-status/admin' && m === 'get') return ok(statuses);
  if (path === '/service-status/admin' && m === 'post') {
    const s = { id: nextId++, branchName: null, isActive: true, startsAt: at(0), endsAt: null, headline: `${b?.area ?? 'Gym'} · ${b?.status}`, ...(b as object) } as MockStatus;
    statuses = [s, ...statuses];
    return ok(s);
  }
  match = /^\/service-status\/admin\/(\d+)(\/end)?$/.exec(path);
  if (match) {
    const id = Number(match[1]);
    if (m === 'delete') { statuses = statuses.filter(s => s.id !== id); return ok(null); }
    statuses = statuses.map(s => (s.id !== id ? s : match![2] ? { ...s, endsAt: at(0), isActive: false } : { ...s, ...(b as object) }));
    return ok(statuses.find(s => s.id === id));
  }

  // Announcements: me
  if (path === '/announcements') return ok({ items: published().map(feedItem), unreadCount: published().filter(a => !a.isRead).length, pageNumber: 1, hasMore: false });
  if (path === '/announcements/unread-count') return ok({ count: published().filter(a => !a.isRead).length });
  if (path === '/announcements/latest-unread') { const a = published().find(x => !x.isRead); return ok(a ? feedItem(a) : null); }
  if (path === '/announcements/read-all') { announcements = announcements.map(a => ({ ...a, isRead: true })); return ok({ updated: 1 }); }
  match = /^\/announcements\/(\d+)(\/read)?$/.exec(path);
  if (match) {
    const id = Number(match[1]);
    announcements = announcements.map(a => (a.id === id ? { ...a, isRead: true } : a));
    const a = announcements.find(x => x.id === id);
    return a ? ok(feedItem(a)) : { success: false, message: 'Announcement not found.', data: null, errors: null };
  }

  // Announcements: admin
  if (path === '/announcements/admin/audience-options')
    return ok({ branches: [{ id: 1, name: 'Downtown' }, { id: 2, name: 'Westside' }], plans: [{ id: 1, name: 'Monthly Unlimited' }, { id: 2, name: 'Quarterly' }], tags: [{ id: 1, name: 'VIP' }, { id: 2, name: 'New member' }] });
  if (path === '/announcements/admin/audience-count') {
    const aud = query.get('audience');
    return ok({ count: aud === 'Staff' ? 23 : aud === 'AllMembers' ? 1284 : 120 * query.getAll('audienceIds').length });
  }
  if (path === '/announcements/admin' && m === 'get') {
    const status = query.get('status');
    return ok(announcements.filter(a => !status || a.status === status).map(admin));
  }
  const upsert = (existing?: typeof announcements[number]) => {
    const action = String(b?.action ?? 'draft');
    const status = existing?.status === 'Published' ? 'Published' : action === 'publish' ? 'Published' : action === 'schedule' ? 'Scheduled' : 'Draft';
    const audienceLabel = b?.audience === 'AllMembers' ? 'All members' : b?.audience === 'Staff' ? 'Trainers & staff' : `${(b?.audienceIds as number[] | undefined)?.length ?? 0} selected`;
    const a = {
      ...(existing ?? { id: nextId++, createdAt: at(0), readCount: 0, isRead: false, publishedAt: null as string | null, recipientCount: 0 }),
      ...(b as object), audienceLabel, status,
      publishedAt: status === 'Published' ? existing?.publishedAt ?? at(0) : null,
      recipientCount: status === 'Published' ? existing?.recipientCount || 1284 : 0,
    } as typeof announcements[number];
    announcements = [a, ...announcements.filter(x => x.id !== a.id)];
    return ok(admin(a));
  };
  if (path === '/announcements/admin' && m === 'post') return upsert();
  match = /^\/announcements\/admin\/(\d+)(\/publish|\/unschedule)?$/.exec(path);
  if (match) {
    const id = Number(match[1]);
    const a = announcements.find(x => x.id === id);
    if (!a) return { success: false, message: 'Announcement not found.', data: null, errors: null };
    if (m === 'get') return ok(admin(a));
    if (m === 'put') return upsert(a);
    if (m === 'delete') { announcements = announcements.filter(x => x.id !== id); return ok(null); }
    if (match[2] === '/publish') { Object.assign(a, { status: 'Published', publishedAt: at(0), recipientCount: 1284 }); return ok(admin(a)); }
    if (match[2] === '/unschedule') { Object.assign(a, { status: 'Draft' }); return ok(admin(a)); }
  }
  return undefined;
}

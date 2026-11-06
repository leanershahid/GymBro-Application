// Preview-mode answers for the privacy centre (/me/privacy, /me/deletion-request, /me/data-export(s))
// and admin privacy requests (/privacy/admin/*). In-memory and stateful, so ?preview=member can request
// an export, walk the 3-step delete flow (password "preview") and keep the account, and
// ?preview=admin can process / cancel requests and edit settings. Resets on reload.
// Return undefined to fall through.

const ok = <T,>(data: T, message = 'OK') => ({ success: true, message, data, errors: null });
const fail = (message: string) => ({ success: false, message, data: null, errors: null });
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

const settings = {
  graceDays: 14,
  privacyPolicyUrl: 'https://example.com/privacy' as string | null,
  termsUrl: null as string | null,
  socialContentOnDeletion: 'anonymise' as 'anonymise' | 'delete',
  cancelMembershipOnDeletion: false,
};

interface Deletion { id: number; userId: number; memberName: string; status: string; source: 'self' | 'staff'; requestedAt: string; scheduledFor: string; cancelledAt?: string | null; completedAt?: string | null; blockedReason?: string | null; reason?: string | null; tables?: Record<string, number> | null }
interface Export { id: number; userId: number; memberName: string; status: string; requestedAt: string; readyAt?: string | null; expiresAt?: string | null; sizeBytes?: number | null }

let nextId = 50;
const deletions: Deletion[] = [
  { id: 1, userId: 104, memberName: 'Kabir Shah', status: 'pending', source: 'self', requestedAt: iso(-3), scheduledFor: iso(11) },
  { id: 2, userId: 105, memberName: 'Ananya Iyer', status: 'blocked', source: 'self', requestedAt: iso(-1), scheduledFor: iso(-1), blockedReason: 'You have 1 unpaid invoice (INR 2499 owed).' },
  { id: 3, userId: 106, memberName: 'Deleted member', status: 'completed', source: 'staff', requestedAt: iso(-20), scheduledFor: iso(-6), completedAt: iso(-6), reason: 'Asked at the desk',
    tables: { Users: 1, ClientProfiles: 1, WaiverSignatures: 2, PushDevices: 1, ShopAddresses: 1, CommunicationLogs: 14 } },
];
const exportsList: Export[] = [
  { id: 10, userId: 100, memberName: 'Aarav Mehta', status: 'expired', requestedAt: iso(-12), readyAt: iso(-12), expiresAt: iso(-5), sizeBytes: 48_213 },
  { id: 11, userId: 102, memberName: 'Rohan Das', status: 'ready', requestedAt: iso(-2), readyAt: iso(-2), expiresAt: iso(5), sizeBytes: 102_400 },
];

const openOf = (me: number) => deletions.find(d => d.userId === me && (d.status === 'pending' || d.status === 'blocked')) ?? null;
const mineExports = (me: number) => exportsList.filter(e => e.userId === me).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
const publicRequest = ({ userId: _u, memberName: _n, reason: _r, tables: _t, ...rest }: Deletion) => rest;
const publicExport = ({ userId: _u, memberName: _n, ...rest }: Export) => rest;

function overview(me: number) {
  const recent = mineExports(me).find(e => Date.now() - new Date(e.requestedAt).getTime() < DAY && e.status !== 'failed');
  const open = openOf(me);
  return {
    links: { ...settings },
    pendingDeletion: open ? publicRequest(open) : null,
    deletionCheck: {
      canDelete: true,
      blockers: [],
      warnings: [
        { code: 'active_membership', message: 'Deleting your account doesn’t cancel your membership contract or give a refund.', action: 'To stop paying, cancel your membership with the front desk first.', route: 'billing' },
        { code: 'social_content', message: 'Your 3 social posts and comments will stay, shown as "Deleted member".', action: 'Delete any posts you don’t want kept before you go.', route: 'social' },
      ],
    },
    reauth: { method: 'password', twoFactor: false, hasEmail: true },
    exports: mineExports(me).slice(0, 5).map(publicExport),
    nextExportAt: recent ? new Date(new Date(recent.requestedAt).getTime() + DAY).toISOString() : null,
  };
}

export function privacyRoute(method: string, path: string, body: unknown, query: URLSearchParams, me: number): unknown {
  const b = (body ?? {}) as Record<string, unknown>;

  // ── Member ──
  if (path === '/me/privacy') return ok(overview(me));
  if (path === '/me/deletion-request' && method === 'get') { const o = openOf(me); return ok(o ? publicRequest(o) : null); }
  if (path === '/me/deletion-request/code') return ok(null, 'We’ve emailed you a code.');
  if (path === '/me/deletion-request' && method === 'post') {
    if (b.password !== 'preview') return fail('That password isn’t right. Please try again. (Preview password: "preview")');
    const d: Deletion = { id: nextId++, userId: me, memberName: 'You', status: 'pending', source: 'self', requestedAt: iso(0), scheduledFor: iso(settings.graceDays) };
    deletions.unshift(d);
    return ok(publicRequest(d));
  }
  if (path === '/me/deletion-request/cancel' || (path === '/me/deletion-request' && method === 'delete')) {
    const o = openOf(me);
    if (o) { o.status = 'cancelled'; o.cancelledAt = iso(0); }
    return ok(o ? publicRequest(o) : null, 'Your account is safe. We won’t delete it.');
  }
  if (path === '/me/data-export') {
    if (overview(me).nextExportAt) return fail('You can download your data once a day.');
    const e: Export = { id: nextId++, userId: me, memberName: 'You', status: 'preparing', requestedAt: iso(0) };
    exportsList.unshift(e);
    // Ready after a few seconds, so the screen's polling shows the change.
    setTimeout(() => { e.status = 'ready'; e.readyAt = iso(0); e.expiresAt = iso(7); e.sizeBytes = 64_512; }, 8_000);
    return ok(publicExport(e));
  }
  if (path === '/me/data-exports') return ok(mineExports(me).map(publicExport));
  let m: RegExpExecArray | null;
  if ((m = /^\/me\/data-exports\/(\d+)\/link$/.exec(path))) {
    const e = exportsList.find(x => x.id === Number(m![1]) && x.userId === me);
    if (!e) return fail('Export not found.');
    if (e.status !== 'ready') return fail(e.status === 'expired' ? 'This download has expired. Request a new one.' : 'Your download isn’t ready yet.');
    return ok({ url: 'https://example.com/preview-data-export.zip', expiresAt: e.expiresAt });
  }

  // ── Admin ──
  if (!path.startsWith('/privacy/admin/')) return undefined;
  if (path === '/privacy/admin/requests') {
    const status = query.get('status');
    return ok({ deletions: deletions.filter(d => !status || d.status === status), exports: exportsList });
  }
  if ((m = /^\/privacy\/admin\/deletions\/(\d+)\/(process|cancel)$/.exec(path))) {
    const d = deletions.find(x => x.id === Number(m![1]));
    if (!d) return fail('Request not found.');
    if (m[2] === 'cancel') { d.status = 'cancelled'; d.cancelledAt = iso(0); return ok(null, 'Deletion cancelled.'); }
    if (d.status === 'blocked') return fail(`This account can't be deleted yet: ${d.blockedReason}`);
    Object.assign(d, { status: 'completed', completedAt: iso(0), memberName: 'Deleted member', tables: { Users: 1, ClientProfiles: 1, PushDevices: 1 } });
    return ok(d, 'Account deleted.');
  }
  if ((m = /^\/privacy\/admin\/members\/(\d+)\/deletion$/.exec(path))) {
    if (!String(b.reason ?? '').trim()) return fail('Reason: say why.');
    const now = !!b.processNow;
    const d: Deletion = { id: nextId++, userId: Number(m[1]), memberName: now ? 'Deleted member' : 'Member', status: now ? 'completed' : 'pending', source: 'staff',
      requestedAt: iso(0), scheduledFor: iso(now ? 0 : settings.graceDays), completedAt: now ? iso(0) : null, reason: String(b.reason) };
    deletions.unshift(d);
    return ok(publicRequest(d));
  }
  if (path === '/privacy/admin/settings') {
    if (method === 'put') Object.assign(settings, b);
    return ok({ ...settings });
  }
  return undefined;
}

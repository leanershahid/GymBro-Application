// Preview-mode answers for Help & feedback (/api/me/help, /me/support-requests*, /me/class-feedback*),
// the staff queue (/api/support/*) and the trainer's assigned list (/api/trainer/support/*).
// In-memory and stateful: ?preview=member can read the FAQ, raise a request, reply, rate and reopen;
// ?preview=admin works the queue (assign, priority, reply / internal note, status), edits FAQ and saved
// replies; ?preview=trainer sees request 701 (assigned to them). Resets on reload. Return undefined to fall through.

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const fail = (message: string) => ({ success: false, message, data: null, errors: null });
const H = 3_600_000;
const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * H).toISOString();

const LABEL: Record<string, string> = {
  billing: 'Billing & membership', classes: 'Classes & bookings', facilities: 'Facilities & cleanliness', equipment: 'Equipment',
  staff: 'Staff & trainers', app: 'App problem', feedback: 'Feedback / idea', other: 'Other',
};
const settings = { firstResponseHours: 24, resolutionHours: 72, postClassFeedback: true, requestsEnabled: true };
const PEOPLE = [
  { id: 1, name: 'Ada Admin', role: 'Admin' }, { id: 5, name: 'Priya Desk', role: 'Front desk' }, { id: 7, name: 'Tom Coach', role: 'Trainer' },
];
const TRAINER_ID = 7;
const nameOf = (id: number | null) => PEOPLE.find(p => p.id === id)?.name ?? null;

let faqs = [
  { id: 1, question: 'How do I freeze my membership?', answer: 'Go to Membership → Manage → Pause. You can pause up to 30 days a year; pauses start the next day.', category: 'billing', sortOrder: 1, isPublished: true },
  { id: 2, question: 'Can I bring a guest?', answer: 'Yes — one guest per month on Unlimited. Ask at the front desk and bring photo ID.', category: 'other', sortOrder: 2, isPublished: true },
  { id: 3, question: 'Where can I leave my bag?', answer: 'Day lockers are free. Bring a padlock or borrow one from the desk.', category: 'facilities', sortOrder: 3, isPublished: true },
  { id: 4, question: "What if I can't make a class?", answer: 'Cancel in My bookings at least 2 hours before so someone on the waitlist can take your spot.', category: 'classes', sortOrder: 4, isPublished: true },
];
let canned = [
  { id: 1, title: 'Thanks — fixed', body: 'Hi {name}, thanks for letting us know! The team has fixed it today. Shout if anything else comes up.', sortOrder: 1 },
  { id: 2, title: 'Looking into it', body: "Hi {name}, thanks for flagging this — we're looking into it and will update you within a day.", sortOrder: 2 },
];

type Msg = { id: number; kind: string; authorRole: string; authorId: number | null; isInternal: boolean; body: string; photos: string[]; createdAt: string };
type Req = Record<string, any> & { id: number; memberId: number; messages: Msg[] };
let nextId = 760;
const msg = (authorRole: string, authorId: number | null, body: string, hoursAgo: number, kind = 'message', isInternal = false, photos: string[] = []): Msg =>
  ({ id: nextId++, kind, authorRole, authorId, isInternal, body, photos, createdAt: iso(hoursAgo) });

const requests: Req[] = [
  { id: 701, memberId: 100, memberName: 'Riya Sharma', category: 'facilities', subject: "Women's showers are cold", status: 'waiting', priority: 'high',
    createdAt: iso(30), assigneeId: TRAINER_ID, branchId: 1, branchName: 'Downtown', canContact: true, contactMethod: 'app', firstResponseAt: iso(20),
    resolvedAt: null, closedAt: null, reopenCount: 0, rating: null, ratingComment: null,
    messages: [msg('member', 100, 'No hot water in the women\'s showers since yesterday evening.', 30),
      msg('staff', 1, 'Called the plumber, Thursday morning.', 22, 'note', true),
      msg('staff', 7, "So sorry Riya — the boiler is being serviced Thursday morning. Is the 2nd floor shower OK for now?", 20)] },
  { id: 702, memberId: 100, memberName: 'Riya Sharma', category: 'billing', subject: 'Charged twice in October', status: 'resolved', priority: 'normal',
    createdAt: iso(120), assigneeId: 5, branchId: null, branchName: null, canContact: false, contactMethod: null, firstResponseAt: iso(110),
    resolvedAt: iso(48), closedAt: null, reopenCount: 0, rating: null, ratingComment: null,
    messages: [msg('member', 100, 'I see two payments of ₹2,499 on 1 October.', 120), msg('staff', 5, "You're right — we've refunded the second one. It shows in 3–5 days.", 110),
      msg('system', null, 'Marked as resolved', 48, 'event')] },
  { id: 703, memberId: 102, memberName: 'Rohan Das', category: 'equipment', subject: 'Cable machine pulley squeaks', status: 'open', priority: 'normal',
    createdAt: iso(29), assigneeId: null, branchId: 2, branchName: 'Westside', canContact: false, contactMethod: null, firstResponseAt: null,
    resolvedAt: null, closedAt: null, reopenCount: 0, rating: null, ratingComment: null,
    messages: [msg('member', 102, 'The left pulley on the cable crossover makes a loud squeak.', 29)] },
  { id: 704, memberId: 103, memberName: 'Meera Nair', category: 'feedback', subject: 'More evening yoga please', status: 'open', priority: 'low',
    createdAt: iso(3), assigneeId: null, branchId: 1, branchName: 'Downtown', canContact: true, contactMethod: 'email', firstResponseAt: null,
    resolvedAt: null, closedAt: null, reopenCount: 0, rating: null, ratingComment: null,
    messages: [msg('member', 103, 'Could you add a 7pm yoga on Wednesdays?', 3)] },
];

let pendingFeedback: Record<string, unknown> | null = { bookingId: 9001, classId: 51, className: 'HIIT Express', trainerName: 'Tom', startsAt: iso(4) };

const active = (r: Req) => r.status === 'open' || r.status === 'waiting';
function sla(r: Req) {
  const now = Date.now();
  const firstDue = new Date(r.createdAt).getTime() + settings.firstResponseHours * H;
  const resolveDue = new Date(r.reopenedAt ?? r.createdAt).getTime() + settings.resolutionHours * H;
  const run = (due: number, hours: number) => (now > due ? 'overdue' : due - now <= Math.max(1, hours * 0.2) * H ? 'due_soon' : 'on_track');
  const firstResponse = r.firstResponseAt ? 'met' : active(r) ? run(firstDue, settings.firstResponseHours) : 'none';
  const resolution = r.status === 'open' ? run(resolveDue, settings.resolutionHours) : r.resolvedAt ? 'met' : 'on_track';
  const overdue = firstResponse === 'overdue' || resolution === 'overdue';
  return { firstResponse, firstResponseDueAt: new Date(firstDue).toISOString(), resolution, resolutionDueAt: new Date(resolveDue).toISOString(),
    overdue, dueSoon: !overdue && (firstResponse === 'due_soon' || resolution === 'due_soon') };
}
const canReopen = (r: Req) => r.status === 'resolved' && !!r.resolvedAt && Date.now() - new Date(r.resolvedAt).getTime() <= 7 * 24 * H;
function summary(r: Req, staff: boolean) {
  const visible = r.messages.filter(m => m.kind !== 'event' && (staff || !m.isInternal));
  const last = visible[visible.length - 1];
  const lastAt = r.messages[r.messages.length - 1]?.createdAt ?? r.createdAt;
  return {
    id: r.id, category: r.category, categoryLabel: LABEL[r.category], subject: r.subject, status: r.status, priority: r.priority,
    createdAt: r.createdAt, lastMessageAt: lastAt, lastMessageBy: last?.authorRole === 'member' ? 'member' : 'staff', preview: last?.body ?? null,
    branchId: r.branchId, branchName: r.branchName, rating: r.rating,
    ...(staff ? { memberId: r.memberId, memberName: r.memberName, assigneeId: r.assigneeId, assigneeName: nameOf(r.assigneeId), sla: sla(r) } : {}),
  };
}
function detail(r: Req, staff: boolean, me: number) {
  return {
    ...summary(r, staff), canContact: r.canContact, contactMethod: r.contactMethod, firstResponseAt: r.firstResponseAt, resolvedAt: r.resolvedAt,
    closedAt: r.closedAt, reopenCount: r.reopenCount, ratingComment: r.ratingComment,
    messages: r.messages.filter(m => staff || !m.isInternal).map(m => ({
      ...m, mine: m.authorId === me,
      authorName: m.authorRole === 'member' ? r.memberName : staff ? nameOf(m.authorId) : (nameOf(m.authorId)?.split(' ')[0] ?? 'Iron Temple'),
    })),
    canReply: r.status !== 'closed' && (active(r) || canReopen(r)), canRate: r.rating == null && (r.status === 'resolved' || r.status === 'closed'),
    canReopen: canReopen(r), reopenUntil: r.resolvedAt ? new Date(new Date(r.resolvedAt).getTime() + 7 * 24 * H).toISOString() : null,
    ...(staff ? { memberEmail: 'riya@example.com', memberPhone: '+91 98765 43210', memberOtherRequests: requests.filter(x => x.memberId === r.memberId && x.id !== r.id).length } : {}),
  };
}
const setStatus = (r: Req, s: string) => {
  r.status = s;
  if (s === 'resolved') { r.resolvedAt = new Date().toISOString(); r.closedAt = null; }
  else if (s === 'closed') { r.resolvedAt ??= new Date().toISOString(); r.closedAt = new Date().toISOString(); }
  else { r.resolvedAt = null; r.closedAt = null; }
};

export function supportRoute(method: string, path: string, body: unknown, query: URLSearchParams, userId: number): unknown {
  const b = (body ?? {}) as Record<string, any>;
  const idIn = (re: RegExp) => Number(path.match(re)?.[1] ?? 0);

  // ── Member ──
  if (path === '/me/help' && method === 'get') {
    const q = (query.get('search') ?? '').toLowerCase();
    const mine = requests.filter(r => r.memberId === userId && active(r));
    return ok({
      faqs: faqs.filter(f => f.isPublished && (!q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))),
      categories: Object.entries(LABEL).map(([key, label]) => ({ key, label })), requestsEnabled: settings.requestsEnabled,
      openRequests: mine.length, waitingOnYou: mine.filter(r => r.status === 'waiting').length, firstResponseHours: settings.firstResponseHours,
    });
  }
  if (path === '/me/support-requests' && method === 'get')
    return ok(requests.filter(r => r.memberId === userId).map(r => summary(r, false)).sort((a, c) => c.lastMessageAt.localeCompare(a.lastMessageAt)));
  if (path === '/me/support-requests' && method === 'post') {
    if (!b.subject || !b.message || !b.category) return fail('Please fill in the category, subject and message.');
    const r: Req = { id: nextId++, memberId: userId, memberName: 'Riya Sharma', category: b.category, subject: b.subject, status: 'open', priority: 'normal',
      createdAt: iso(0), assigneeId: null, branchId: b.branchId ?? null, branchName: null, canContact: !!b.canContact, contactMethod: b.canContact ? b.contactMethod ?? 'app' : null,
      firstResponseAt: null, resolvedAt: null, closedAt: null, reopenCount: 0, rating: null, ratingComment: null,
      messages: [msg('member', userId, b.message, 0, 'message', false, b.photos ?? [])] };
    requests.unshift(r);
    return ok(detail(r, false, userId));
  }
  const mineMatch = path.match(/^\/me\/support-requests\/(\d+)(?:\/(messages|rate|reopen|resolve))?$/);
  if (mineMatch) {
    const r = requests.find(x => x.id === Number(mineMatch[1]) && x.memberId === userId);
    if (!r) return fail('Request not found.');
    switch (mineMatch[2]) {
      case undefined: return ok(detail(r, false, userId));
      case 'messages':
        if (r.status === 'closed') return fail('This request is closed. Start a new one and we\'ll pick it up.');
        if (r.status === 'resolved') { if (!canReopen(r)) return fail('This request was resolved more than 7 days ago.'); r.reopenCount++; r.reopenedAt = iso(0); }
        setStatus(r, 'open');
        r.messages.push(msg('member', userId, b.body, 0, 'message', false, b.photos ?? []));
        return ok(detail(r, false, userId));
      case 'rate':
        if (r.rating != null) return fail("You've already rated this request — thank you!");
        r.rating = b.score; r.ratingComment = b.comment ?? null;
        r.messages.push(msg('member', userId, `Rated ${b.score}/5`, 0, 'event'));
        return ok(detail(r, false, userId));
      case 'reopen':
        if (!canReopen(r)) return fail('Requests can be reopened for 7 days after they\'re resolved.');
        setStatus(r, 'open'); r.reopenCount++; r.reopenedAt = iso(0);
        r.messages.push(msg('member', userId, 'Reopened', 0, 'event'));
        return ok(detail(r, false, userId));
      case 'resolve':
        setStatus(r, 'resolved');
        r.messages.push(msg('member', userId, 'Marked as resolved by the member', 0, 'event'));
        return ok(detail(r, false, userId));
    }
  }
  if (path === '/me/class-feedback/pending') return ok(settings.postClassFeedback ? pendingFeedback : null);
  if (path === '/me/class-feedback' && method === 'post') { pendingFeedback = null; return ok(null); }

  // ── Staff / trainer ──
  const trainer = path.startsWith('/trainer/support');
  if (!path.startsWith('/support') && !trainer) return undefined;
  const p = trainer ? path.replace('/trainer', '') : path;
  const scope = () => (trainer ? requests.filter(r => r.assigneeId === TRAINER_ID) : requests);

  if (p === '/support/requests' && method === 'get') {
    const status = query.get('status') || 'active';
    const search = (query.get('search') ?? '').toLowerCase();
    const assignee = query.get('assignee') ?? '';
    let list = scope().filter(r => status === 'all' ? true : status === 'active' ? active(r) : r.status === status);
    if (query.get('category')) list = list.filter(r => r.category === query.get('category'));
    if (query.get('priority')) list = list.filter(r => r.priority === query.get('priority'));
    if (assignee === 'none') list = list.filter(r => !r.assigneeId);
    else if (assignee === 'me') list = list.filter(r => r.assigneeId === (trainer ? TRAINER_ID : userId));
    else if (assignee) list = list.filter(r => r.assigneeId === Number(assignee));
    if (query.get('overdue') === 'true') list = list.filter(r => sla(r).overdue);
    if (search) list = list.filter(r => r.subject.toLowerCase().includes(search) || r.memberName.toLowerCase().includes(search) || `#${r.id}` === search || String(r.id) === search);
    const items = list.map(r => summary(r, true));
    return ok({ items, pageNumber: 1, pageSize: 20, totalRecords: items.length, totalPages: 1 });
  }
  if (p === '/support/requests/count') {
    const list = scope().filter(active);
    const unassigned = list.filter(r => !r.assigneeId);
    const overdue = list.filter(r => sla(r).overdue);
    const badge = trainer ? list.length : new Set([...unassigned, ...overdue].map(r => r.id)).size;
    return ok({ unassigned: unassigned.length, overdue: overdue.length, open: list.filter(r => r.status === 'open').length,
      mine: list.filter(r => r.assigneeId === (trainer ? TRAINER_ID : userId)).length, badge });
  }
  const one = p.match(/^\/support\/requests\/(\d+)(?:\/(messages|status|assign|priority))?$/);
  if (one) {
    const r = scope().find(x => x.id === Number(one[1]));
    if (!r) return fail('Request not found.');
    const me = trainer ? TRAINER_ID : userId;
    switch (one[2]) {
      case undefined: return ok(detail(r, true, me));
      case 'messages':
        if (b.internal) { r.messages.push(msg('staff', me, b.body, 0, 'note', true, b.photos ?? [])); return ok(detail(r, true, me)); }
        r.messages.push(msg('staff', me, b.body, 0, 'message', false, b.photos ?? []));
        r.firstResponseAt ??= iso(0); r.assigneeId ??= me;
        setStatus(r, b.status ?? 'waiting');
        if (b.status === 'resolved') r.messages.push(msg('staff', me, 'Marked as resolved', 0, 'event'));
        return ok(detail(r, true, me));
      case 'status':
        setStatus(r, b.status);
        r.messages.push(msg('staff', me, b.status === 'resolved' ? 'Marked as resolved' : b.status === 'closed' ? 'Closed' : b.status === 'waiting' ? 'Waiting on the member' : 'Reopened', 0, 'event'));
        return ok(detail(r, true, me));
      case 'assign':
        r.assigneeId = b.assigneeId ?? null;
        r.messages.push(msg('staff', me, r.assigneeId ? `Assigned to ${nameOf(r.assigneeId)}` : 'Unassigned', 0, 'event', true));
        return ok(detail(r, true, me));
      case 'priority':
        r.priority = b.priority;
        r.messages.push(msg('staff', me, `Priority set to ${b.priority}`, 0, 'event', true));
        return ok(detail(r, true, me));
    }
  }
  if (p === '/support/staff') return ok(PEOPLE);
  if (p === '/support/faqs' && method === 'get') return ok(faqs);
  if (p === '/support/faqs' && method === 'post') { const f = { ...b, id: nextId++, sortOrder: faqs.length + 1 } as (typeof faqs)[number]; faqs = [...faqs, f]; return ok(f); }
  const faq = p.match(/^\/support\/faqs\/(\d+)$/);
  if (faq && method === 'put') { faqs = faqs.map(f => (f.id === Number(faq[1]) ? { ...f, ...b } : f)); return ok(faqs.find(f => f.id === Number(faq[1]))); }
  if (faq && method === 'delete') { faqs = faqs.filter(f => f.id !== Number(faq[1])); return ok(null); }
  if (p === '/support/canned-replies' && method === 'get') return ok(canned);
  if (p === '/support/canned-replies' && method === 'post') { const c = { ...b, id: nextId++, sortOrder: canned.length + 1 } as (typeof canned)[number]; canned = [...canned, c]; return ok(c); }
  const cr = p.match(/^\/support\/canned-replies\/(\d+)$/);
  if (cr && method === 'put') { canned = canned.map(c => (c.id === Number(cr[1]) ? { ...c, ...b } : c)); return ok(canned.find(c => c.id === Number(cr[1]))); }
  if (cr && method === 'delete') { canned = canned.filter(c => c.id !== Number(cr[1])); return ok(null); }
  if (p === '/support/settings' && method === 'get') return ok(settings);
  if (p === '/support/settings' && method === 'put') { Object.assign(settings, b); return ok(settings); }
  if (p === '/support/feedback') {
    return ok({
      days: Number(query.get('days') ?? 90), average: 4.3, count: 128,
      byClassType: [{ id: 1, name: 'HIIT Express', average: 4.6, count: 54 }, { id: 2, name: 'Vinyasa Yoga', average: 4.4, count: 41 }, { id: 3, name: 'Spin 45', average: 3.7, count: 33 }],
      byTrainer: [{ id: 7, name: 'Tom Coach', average: 4.7, count: 62 }, { id: 8, name: 'Ana Flow', average: 4.2, count: 44 }, { id: 9, name: 'Vik Ride', average: 3.6, count: 22 }],
      recentComments: [
        { className: 'HIIT Express', trainerName: 'Tom Coach', score: 5, comment: 'Brutal but brilliant. Music was 🔥', at: iso(5) },
        { className: 'Spin 45', trainerName: 'Vik Ride', score: 3, comment: 'Bike 12 seat would not lock.', at: iso(28) },
      ],
      supportAverage: 4.5, supportRatings: 17,
    });
  }
  return undefined;
}

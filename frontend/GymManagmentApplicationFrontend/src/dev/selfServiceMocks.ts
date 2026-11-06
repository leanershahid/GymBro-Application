// Preview-mode answers for member self-service (/api/me/plans, /me/memberships/*, /me/membership,
// /me/membership-requests*) and the staff queue (/api/membership-requests*). In-memory and
// stateful: ?preview=member can browse plans, join (pay-at-desk: no gateway in preview), then pause /
// cancel / change plan; ?preview=admin sees the requests and approves / rejects them.
// `?ss=new` starts the member without a membership. Resets on reload. Return undefined to fall through.

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const fail = (message: string) => ({ success: false, message, data: null, errors: null });
const DAY = 86_400_000;
const isoDay = (offset: number) => {
  const d = new Date(Date.now() + offset * DAY);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);

const RULES = {
  minimumTermMonths: 0, noticeDays: 30, maxFreezeDaysPerYear: 30, minFreezeDays: 7, freezeFee: 0, cancellationFee: 0,
  allowSelfCancel: true, allowOnlineJoin: true, taxPercent: 18, maxStartDaysAhead: 60,
  freezeApproval: 'auto' as 'auto' | 'staff', cancelApproval: 'staff' as 'auto' | 'staff', changeApproval: 'auto' as 'auto' | 'staff',
};
const memberRules = () => ({
  ...RULES, freezeNeedsApproval: RULES.freezeApproval === 'staff', cancelNeedsApproval: RULES.cancelApproval === 'staff',
  changeNeedsApproval: RULES.changeApproval === 'staff',
});

const PLANS = [
  { id: 1, name: 'Off-peak', description: 'Weekday daytime training at a lower price.', price: 1499, currency: 'INR', billingCycle: 'Monthly', durationDays: 30,
    joiningFee: 499, classCredits: 8, ptSessions: null, accessHours: '6am–4pm weekdays', branchId: null, branchName: null, features: ['Locker'], isPopular: false, trialDays: 0 },
  { id: 2, name: 'Unlimited', description: 'Every class, every branch, any time.', price: 2499, currency: 'INR', billingCycle: 'Monthly', durationDays: 30,
    joiningFee: 499, classCredits: null, ptSessions: null, accessHours: '24/7', branchId: null, branchName: null, features: ['Locker', 'Towel service'], isPopular: true, trialDays: 0 },
  { id: 3, name: 'Unlimited + PT', description: 'Unlimited plus four personal training sessions a month.', price: 5999, currency: 'INR', billingCycle: 'Monthly', durationDays: 30,
    joiningFee: 0, classCredits: null, ptSessions: 4, accessHours: '24/7', branchId: null, branchName: null, features: ['Body scan every month'], isPopular: false, trialDays: 0 },
  { id: 4, name: 'Annual', description: 'Twelve months, two months free.', price: 24990, currency: 'INR', billingCycle: 'Yearly', durationDays: 365,
    joiningFee: 0, classCredits: null, ptSessions: null, accessHours: '24/7', branchId: null, branchName: null, features: [], isPopular: false, trialDays: 0 },
];

type Sub = { id: number; planId: number; planName: string; status: string; startDate: string; endDate: string | null; price: number; currency: string; autoRenew: boolean };
type Req = Record<string, any>;

const startsNew = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ss') === 'new';
let membership: Sub | null = startsNew ? null : { id: 501, planId: 2, planName: 'Unlimited', status: 'Active', startDate: isoDay(-20), endDate: isoDay(10), price: 2499, currency: 'INR', autoRenew: true };
let pendingInvoice: Record<string, any> | null = null;
let nextId = 900;
const requests: Req[] = [
  { id: 801, membershipId: 777, memberId: 102, memberName: 'Rohan Das', planName: 'Unlimited', type: 'cancel', status: 'pending', reasonCode: 'moving', reason: 'Moving to Pune next month',
    requestedAt: new Date(Date.now() - 2 * DAY).toISOString(), effectiveFrom: isoDay(28), effectiveTo: null, newPlanId: null, newPlanName: null, fee: 0, currency: 'INR',
    invoiceId: null, autoApproved: false, decidedBy: null, decidedByName: null, decidedAt: null, decisionNote: null, appliedAt: null, completedAt: null, membershipStatus: 'Active' },
  { id: 802, membershipId: 778, memberId: 103, memberName: 'Meera Nair', planName: 'Off-peak', type: 'freeze', status: 'pending', reasonCode: null, reason: 'Knee surgery',
    requestedAt: new Date(Date.now() - DAY).toISOString(), effectiveFrom: isoDay(3), effectiveTo: isoDay(24), newPlanId: null, newPlanName: null, fee: 0, currency: 'INR',
    invoiceId: null, autoApproved: false, decidedBy: null, decidedByName: null, decidedAt: null, decisionNote: null, appliedAt: null, completedAt: null, membershipStatus: 'Active' },
  { id: 803, membershipId: 779, memberId: 104, memberName: 'Kabir Shah', planName: 'Unlimited', type: 'freeze', status: 'approved', reasonCode: null, reason: 'Holiday',
    requestedAt: new Date(Date.now() - 9 * DAY).toISOString(), effectiveFrom: isoDay(-5), effectiveTo: isoDay(5), newPlanId: null, newPlanName: null, fee: 0, currency: 'INR',
    invoiceId: null, autoApproved: true, decidedBy: null, decidedByName: null, decidedAt: new Date(Date.now() - 9 * DAY).toISOString(), decisionNote: null, appliedAt: new Date(Date.now() - 5 * DAY).toISOString(), completedAt: null, membershipStatus: 'Paused' },
];

const round = (n: number) => Math.round(n * 100) / 100;
const plan = (id: number) => PLANS.find(p => p.id === id);
const mine = (userId: number) => requests.filter(r => r.memberId === userId);
const freezeUsed = (userId: number) => mine(userId).filter(r => r.type === 'freeze' && (r.status === 'pending' || r.status === 'approved'))
  .reduce((a, r) => a + daysBetween(r.effectiveFrom, r.effectiveTo) + 1, 0);

function quote(body: any, userId: number) {
  const p = plan(Number(body?.planId));
  if (!p) return null;
  const start = body?.startDate || isoDay(0);
  const code = String(body?.couponCode ?? '').trim().toUpperCase();
  const couponOk = code === 'SAVE10';
  const discount = couponOk ? round(p.price * 0.1) : 0;
  const joiningFee = membership ? 0 : p.joiningFee;
  const subtotal = p.price + joiningFee;
  const tax = round((subtotal - discount) * RULES.taxPercent / 100);
  const lines = [{ label: `${p.name} (1 month)`, amount: p.price, kind: 'plan' }];
  if (joiningFee) lines.push({ label: 'Joining fee (one-off)', amount: joiningFee, kind: 'joining_fee' });
  if (discount) lines.push({ label: `Coupon ${code}`, amount: -discount, kind: 'discount' });
  if (tax) lines.push({ label: `Tax (${RULES.taxPercent}%)`, amount: tax, kind: 'tax' });
  const end = new Date(new Date(start).getTime() + p.durationDays * DAY).toISOString().slice(0, 10);
  void userId;
  return {
    planId: p.id, planName: p.name, billingCycle: p.billingCycle, durationDays: p.durationDays, startDate: start, endDate: end, currency: 'INR', lines,
    planPrice: p.price, joiningFee, subtotal, couponCode: code || null, couponApplied: couponOk,
    couponMessage: code ? (couponOk ? `SAVE10 applied: ₹${discount} off` : 'Coupon code is invalid') : null,
    discount, taxPercent: RULES.taxPercent, tax, total: round(subtotal - discount + tax), renewalPrice: round(p.price * (1 + RULES.taxPercent / 100)),
    onlinePayments: false, safetyMissing: [], safetyRequired: false, rules: memberRules(),
  };
}

function preview(body: any, userId: number) {
  const type = body?.type;
  const m = membership;
  const base = { type, allowed: false, problem: null as string | null, needsApproval: false, effectiveFrom: null as string | null, effectiveTo: null as string | null,
    days: null as number | null, fee: 0, currency: 'INR', lines: [] as any[], summary: '', changeKind: null as string | null, newPlanName: null as string | null,
    canPauseInstead: false, freezeDaysLeft: Math.max(0, RULES.maxFreezeDaysPerYear - freezeUsed(userId)), cancel: null as any };
  if (!m) return { ...base, problem: "You don't have a membership to change." };
  const open = (t: string) => mine(userId).some(r => r.type === t && r.status === 'pending');
  if (type === 'freeze') {
    const days = body.from && body.to ? daysBetween(body.from, body.to) + 1 : 0;
    const left = base.freezeDaysLeft;
    const problem = !days ? 'Pick the first and last day of your pause.' : days < RULES.minFreezeDays ? `A pause must be at least ${RULES.minFreezeDays} days.`
      : days > left ? `You have ${left} pause days left this year; this pause is ${days} days.` : open('freeze') ? 'You already have an open pause request.' : null;
    return { ...base, allowed: !problem, problem, needsApproval: RULES.freezeApproval === 'staff', effectiveFrom: body.from, effectiveTo: body.to, days,
      summary: `Your membership pauses from ${body.from} to ${body.to} (${days} days). Those days are added back to your end date. No fee.` };
  }
  if (type === 'cancel') {
    const lastDay = isoDay(RULES.noticeDays);
    const uncovered = m.endDate ? Math.max(0, daysBetween(m.endDate, lastDay)) : 0;
    const charge = round(m.price / 30 * uncovered);
    const cancel = { lastDay, noticeEnd: lastDay, minimumTermEnd: null, paidThrough: m.endDate, uncoveredDays: uncovered, uncoveredCharge: charge, cancellationFee: 0, finalCharge: charge, currency: 'INR' };
    return { ...base, allowed: !open('cancel'), problem: open('cancel') ? 'You already have an open cancellation request.' : null, needsApproval: RULES.cancelApproval === 'staff',
      effectiveFrom: lastDay, fee: charge, cancel, canPauseInstead: base.freezeDaysLeft >= RULES.minFreezeDays,
      lines: charge ? [{ label: `${uncovered} days until your last day`, amount: charge, kind: 'charge' }] : [],
      summary: `You can keep training until ${lastDay} (${RULES.noticeDays} days' notice). Your membership won't renew after that. ${charge ? `A final invoice of ₹${charge} will be raised.` : "There's nothing more to pay."} The gym will review your request.` };
  }
  const p = plan(Number(body?.newPlanId));
  if (!p) return { ...base, problem: 'Pick a different plan.' };
  const upgrade = p.price / p.durationDays > m.price / 30;
  const left = m.endDate ? daysBetween(isoDay(0), m.endDate) + 1 : 0;
  const charge = upgrade ? round((p.price / p.durationDays - m.price / 30) * left) : 0;
  return { ...base, allowed: true, changeKind: upgrade ? 'upgrade' : 'downgrade', newPlanName: p.name, effectiveFrom: upgrade ? isoDay(0) : m.endDate, fee: charge,
    lines: charge ? [{ label: `Upgrade for the ${left} days left this period`, amount: charge, kind: 'charge' }] : [],
    summary: upgrade ? `You move to ${p.name} today. You pay ₹${charge} now for the rest of this period.` : `You stay on ${m.planName} until ${m.endDate}. From your next renewal you move to ${p.name}. Nothing to pay now.` };
}

function createRequest(body: any, userId: number) {
  const pv: any = preview(body, userId);
  if (!pv.allowed) return fail(pv.problem ?? 'Not allowed');
  const auto = pv.needsApproval === false;
  const r: Req = {
    id: ++nextId, membershipId: membership!.id, memberId: userId, memberName: 'You', planName: membership!.planName, type: body.type,
    status: auto ? 'approved' : 'pending', reasonCode: body.reasonCode ?? null, reason: body.reason ?? null, requestedAt: new Date().toISOString(),
    effectiveFrom: pv.effectiveFrom, effectiveTo: pv.effectiveTo, newPlanId: body.newPlanId ?? null, newPlanName: pv.newPlanName, fee: pv.fee, currency: 'INR',
    invoiceId: pv.fee > 0 && auto ? 7001 : null, autoApproved: auto, decidedBy: null, decidedByName: null, decidedAt: auto ? new Date().toISOString() : null,
    decisionNote: null, appliedAt: null, completedAt: null, membershipStatus: membership!.status,
  };
  if (auto && body.type === 'change' && pv.changeKind === 'upgrade') {
    const p = plan(body.newPlanId)!;
    membership = { ...membership!, planId: p.id, planName: p.name, price: p.price };
    r.appliedAt = new Date().toISOString();
  }
  if (auto && body.type === 'freeze' && body.from === isoDay(0)) { membership = { ...membership!, status: 'Paused' }; r.appliedAt = new Date().toISOString(); }
  requests.unshift(r);
  return ok(r);
}

function myMembership(userId: number) {
  const used = freezeUsed(userId);
  const open = mine(userId).filter(r => r.status === 'pending' || (r.status === 'approved' && !r.appliedAt));
  const pending = membership?.status === 'Pending';
  const sub = membership ? { ...membership, frozenFrom: null, frozenUntil: null, nextRenewalDate: membership.endDate, createdAt: new Date().toISOString(), invoiceId: null } : null;
  const p = membership ? plan(membership.planId) : null;
  return {
    current: sub, plan: p ? { ...p, isCurrent: true } : null, rules: memberRules(), freezeDaysUsedThisYear: used,
    freezeDaysLeftThisYear: Math.max(0, RULES.maxFreezeDaysPerYear - used),
    cancelPreview: membership && !pending ? (preview({ type: 'cancel' }, userId) as any).cancel : null,
    openRequests: open, pendingInvoice: pending ? pendingInvoice : null,
    canFreeze: !!membership && membership.status === 'Active' && !open.some(r => r.type === 'freeze'),
    canCancel: !!membership && !pending && !open.some(r => r.type === 'cancel'),
    canChangePlan: !!membership && membership.status === 'Active' && !open.some(r => r.type === 'change' || r.type === 'cancel'),
    onlinePayments: false,
  };
}

export function selfServiceRoute(method: string, path: string, body: unknown, query: URLSearchParams, userId: number): unknown {
  const b = (typeof body === 'string' ? JSON.parse(body || '{}') : body ?? {}) as any;

  // ── Member ──
  if (path === '/me/plans' && method === 'get')
    return ok({ plans: PLANS.map(p => ({ ...p, isCurrent: membership?.planId === p.id && membership.status !== 'Pending' })), rules: memberRules(), onlinePayments: false, currency: 'INR' });
  if (path === '/me/memberships/quote' && method === 'post') { const q = quote(b, userId); return q ? ok(q) : fail("That plan isn't available online."); }
  if (path === '/me/memberships/checkout' && method === 'post') {
    const q = quote(b, userId);
    if (!q) return fail("That plan isn't available online.");
    if (!b.acceptTerms) return fail('Please read and accept the membership terms to continue.');
    membership = { id: ++nextId, planId: q.planId, planName: q.planName, status: 'Pending', startDate: q.startDate, endDate: q.endDate, price: q.planPrice, currency: 'INR', autoRenew: true };
    pendingInvoice = {
      id: 7000 + nextId, invoiceNo: `INV-2026-0${nextId}`, subtotal: q.subtotal, tax: q.tax, discount: q.discount, total: q.total, amountPaid: 0, balance: q.total,
      currency: 'INR', status: 'Sent', dueDate: q.startDate, issuedAt: new Date().toISOString(), paidAt: null, notes: 'Online membership', membershipId: membership.id,
      items: q.lines.filter(l => l.amount > 0 && l.kind !== 'tax').map(l => ({ description: l.label, unitPrice: l.amount, quantity: 1 })),
    };
    return ok({ membership: { ...membership, frozenFrom: null, frozenUntil: null, nextRenewalDate: membership.endDate, createdAt: new Date().toISOString(), invoiceId: pendingInvoice.id },
      invoice: pendingInvoice, quote: q, order: null, payAtDesk: true, activated: false, reused: false });
  }
  if (path === '/me/membership' && method === 'get') return ok(myMembership(userId));
  if (path === '/me/membership-requests/preview' && method === 'post') return ok(preview(b, userId));
  if (path === '/me/membership-requests' && method === 'get') return ok(mine(userId));
  if (path === '/me/membership-requests' && method === 'post') return createRequest(b, userId);
  let m = /^\/me\/membership-requests\/(\d+)(\/withdraw)?$/.exec(path);
  if (m) {
    const r = requests.find(x => x.id === Number(m![1]) && x.memberId === userId);
    if (!r) return fail('Request not found.');
    if (m[2] && method === 'post') {
      if (r.status !== 'pending') return fail(`This request was already ${r.status}, so it can't be withdrawn.`);
      r.status = 'withdrawn'; r.decidedAt = new Date().toISOString();
    }
    return ok(r);
  }

  // ── Staff ──
  if (path === '/membership-requests/count') return ok({ pending: requests.filter(r => r.status === 'pending').length });
  if (path === '/membership-requests/settings') {
    if (method === 'put') Object.assign(RULES, b);
    return ok({ ...RULES });
  }
  if (path === '/membership-requests' && method === 'get') {
    // Undefined params arrive as the string "undefined" from the preview adapter.
    const q = (k: string) => { const v = query.get(k); return v && v !== 'undefined' ? v : null; };
    const status = q('status') ?? 'pending';
    const type = q('type');
    const memberId = q('memberId');
    const items = requests.filter(r => (status === 'all' || (status === 'pending' ? r.status === 'pending' : r.status !== 'pending'))
      && (!type || r.type === type) && (!memberId || r.memberId === Number(memberId)));
    return ok({ items, pageNumber: 1, pageSize: 20, totalRecords: items.length, totalPages: 1 });
  }
  m = /^\/membership-requests\/(\d+)(\/approve|\/reject)?$/.exec(path);
  if (m) {
    const r = requests.find(x => x.id === Number(m![1]));
    if (!r) return fail('Request not found.');
    if (m[2] && method === 'post') {
      if (r.status !== 'pending') return fail(`This request is already ${r.status}.`);
      if (m[2] === '/reject' && !b.note) return fail('Note: tell the member why (they will see it).');
      r.status = m[2] === '/approve' ? 'approved' : 'rejected';
      r.decidedAt = new Date().toISOString(); r.decidedByName = 'Preview Admin'; r.decisionNote = b.note ?? null;
    }
    return ok(r);
  }
  return undefined;
}

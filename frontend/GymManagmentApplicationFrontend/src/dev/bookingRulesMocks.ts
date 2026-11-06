// Preview-mode answers for cancellation & no-show rules (/api/booking-rules/*).
// In-memory: ?preview=admin edits the rules, waives penalties and lifts the block on member 101;
// ?preview=member (100) sees "1 of 3 no-shows in the last 30 days". Resets on reload. Undefined = fall through.

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const fail = (message: string) => ({ success: false, message, data: null, errors: null });
const D = 86_400_000;
const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * D).toISOString();

let settings = {
  classCancelCutoffHours: 2, ptCancelCutoffHours: 24, lateCancelConsequence: 'fee', lateCancelFee: 100,
  noShowConsequence: 'strike', noShowFee: 0, strikesBeforeBlock: 3, strikeWindowDays: 30, blockDays: 7,
  staffCanWaive: true, autoNoShowEnabled: false, autoNoShowAfterMinutes: 60, autoNoShowSince: null as string | null,
};

type Penalty = Record<string, any> & { id: number; clientId: number; waived: boolean };
const penalties: Penalty[] = [
  { id: 1, clientId: 100, clientName: 'Aarav Shah', type: 'no_show', classId: 1, label: 'Spin', sessionStartsAt: iso(-6), strike: true, createdAt: iso(-6), waived: false },
  { id: 2, clientId: 101, clientName: 'Diya Patel', type: 'no_show', classId: 1, label: 'Spin', sessionStartsAt: iso(-12), strike: true, createdAt: iso(-12), waived: false },
  { id: 3, clientId: 101, clientName: 'Diya Patel', type: 'no_show', classId: 2, label: 'HIIT', sessionStartsAt: iso(-5), strike: true, createdAt: iso(-5), waived: false },
  { id: 4, clientId: 101, clientName: 'Diya Patel', type: 'late_cancel', classId: 3, label: 'Yoga', sessionStartsAt: iso(-3), feeAmount: 100, currency: 'INR', feeInvoiceId: 9001, feeInvoiceNo: 'INV-2026-00321', feeInvoiceStatus: 'Sent', strike: false, createdAt: iso(-3), waived: false },
  { id: 5, clientId: 101, clientName: 'Diya Patel', type: 'no_show', classId: 4, label: 'Spin', sessionStartsAt: iso(-1), strike: true, createdAt: iso(-1), waived: false },
];
const blocks = [{ id: 1, clientId: 101, from: iso(-1), until: iso(6), reason: '3 no-shows in 30 days', liftedAt: null as string | null, liftReason: null as string | null }];

function standing(clientId: number, canWaive: boolean) {
  const block = blocks.find(b => b.clientId === clientId && !b.liftedAt && new Date(b.until).getTime() > Date.now()) ?? null;
  const mine = penalties.filter(p => p.clientId === clientId);
  const strikes = block ? 0 : mine.filter(p => p.strike && !p.waived).length;
  return {
    clientId, strikes, strikesBeforeBlock: settings.strikesBeforeBlock, strikeWindowDays: settings.strikeWindowDays,
    strikesEnabled: settings.noShowConsequence === 'strike', activeBlock: block, penalties: [...mine].reverse(), canWaive,
  };
}

export function bookingRulesRoute(method: string, path: string, body: unknown, query: URLSearchParams, me: number): unknown {
  const m = method.toUpperCase();
  if (path === '/booking-rules/policy') {
    return ok({
      classCancelCutoffHours: settings.classCancelCutoffHours, ptCancelCutoffHours: settings.ptCancelCutoffHours,
      lateCancelConsequence: settings.lateCancelConsequence === 'fee' ? 'fee' : 'none', lateCancelFee: settings.lateCancelFee || null,
      noShowConsequence: settings.noShowConsequence, noShowFee: settings.noShowFee || null,
      strikesBeforeBlock: settings.strikesBeforeBlock, strikeWindowDays: settings.strikeWindowDays, blockDays: settings.blockDays, currency: 'INR',
    });
  }
  if (path === '/booking-rules/me') return ok(standing(me, false));
  if (path === '/booking-rules/settings') {
    if (m === 'PUT') settings = { ...settings, ...(body as object) };
    return ok({ ...settings, creditsSupported: false, currency: 'INR' });
  }
  if (path === '/booking-rules/penalties') {
    const classId = Number(query.get('classId') ?? 0);
    const ptSessionId = Number(query.get('ptSessionId') ?? 0);
    const memberId = Number(query.get('memberId') ?? 0);
    return ok(penalties.filter(p => (!classId || p.classId === classId) && (!ptSessionId || p.ptSessionId === ptSessionId) && (!memberId || p.clientId === memberId)));
  }
  const member = path.match(/^\/booking-rules\/members\/(\d+)$/);
  if (member) return ok(standing(Number(member[1]), true));
  const waive = path.match(/^\/booking-rules\/penalties\/(\d+)\/waive$/);
  if (waive && m === 'PUT') {
    const p = penalties.find(x => x.id === Number(waive[1]));
    if (!p) return fail('Penalty not found.');
    const voided = !!p.feeInvoiceId && p.feeInvoiceStatus !== 'Paid';
    Object.assign(p, { waived: true, waivedAt: iso(0), waivedByName: 'Ada Admin', waiveReason: (body as { reason?: string })?.reason ?? '' });
    if (voided) p.feeInvoiceStatus = 'Void';
    return { ...ok({ penalty: p, feeVoided: voided }), message: voided ? 'Penalty waived; the fee invoice was voided.' : 'Penalty waived.' };
  }
  const lift = path.match(/^\/booking-rules\/blocks\/(\d+)\/lift$/);
  if (lift && m === 'PUT') {
    const b = blocks.find(x => x.id === Number(lift[1]));
    if (!b) return fail('Block not found.');
    b.liftedAt = iso(0);
    b.liftReason = (body as { reason?: string })?.reason ?? 'Lifted by staff';
    return ok(b);
  }
  return undefined;
}

// Preview-mode answers for trainer ↔ member messaging (/api/messages/*) and the admin review
// (/api/messages-review/*). In-memory and stateful: ?preview=member (user 100) chats with coach
// Vikram (user 2); ?preview=trainer is Vikram; ?preview=admin reviews. Resets on reload.
// Return undefined to fall through.

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const fail = (message: string) => ({ success: false, message, data: null, errors: null });
const M = 60_000;
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * M).toISOString();

const PEOPLE: Record<number, { userId: number; name: string; avatarUrl: string | null; role: 'trainer' | 'member' }> = {
  2: { userId: 2, name: 'Vikram Rao', avatarUrl: null, role: 'trainer' },
  100: { userId: 100, name: 'Riya Sharma', avatarUrl: null, role: 'member' },
  101: { userId: 101, name: 'Arjun Mehta', avatarUrl: null, role: 'member' },
  102: { userId: 102, name: 'Sara Khan', avatarUrl: null, role: 'member' },
};

type Msg = { id: number; clientMessageId: string; senderId: number; body: string; photoUrl: string | null; attachment: any; createdAt: string; reported: boolean; redacted: boolean };
type Conv = { id: number; trainer: number; member: number; messages: Msg[]; read: Record<number, string | null>; muted: Record<number, boolean> };
let nextId = 900;
const m = (senderId: number, body: string, minsAgo: number, attachment: any = null): Msg =>
  ({ id: nextId++, clientMessageId: `seed-${nextId}`, senderId, body, photoUrl: null, attachment, createdAt: iso(minsAgo), reported: false, redacted: false });

const convs: Conv[] = [
  { id: 81, trainer: 2, member: 100, read: { 2: iso(30), 100: iso(1500) }, muted: {},
    messages: [
      m(2, 'Hi Riya! Great work on Tuesday — your squat depth is really improving.', 1600),
      m(100, 'Thanks! My left knee felt a bit tight on the last set though.', 1550),
      m(2, "Let's swap in goblet squats this week. I've shared the updated workout.", 40, { type: 'workout', id: 11, targetId: 5, title: 'Lower body — knee friendly' }),
      m(2, 'Shout if anything hurts. See you Thursday at 7!', 39),
    ] },
  { id: 82, trainer: 2, member: 101, read: { 2: iso(200), 101: iso(200) }, muted: {},
    messages: [m(101, 'Can we move Friday to 8am?', 260), m(2, 'Done — see you at 8.', 200)] },
];
let allowTrainerMessages = true;
let settings = { enabled: true, allowMembersUnder18: false, outsideHoursNotice: 'Coaches reply between 8am and 8pm. For anything urgent, call the front desk.', workingHoursStart: '08:00', workingHoursEnd: '20:00' };

const side = (c: Conv, me: number) => (c.trainer === me ? 'trainer' : 'member');
const other = (c: Conv, me: number) => (c.trainer === me ? c.member : c.trainer);
const mine = (me: number) => convs.filter(c => c.trainer === me || c.member === me);
const unread = (c: Conv, me: number) => c.messages.filter(x => x.senderId !== me && (!c.read[me] || x.createdAt > c.read[me]!)).length;
const dto = (x: Msg, me: number) => ({ ...x, mine: x.senderId === me, reported: x.reported });
const last = (c: Conv) => c.messages[c.messages.length - 1];

function detail(c: Conv, me: number) {
  const block = !settings.enabled ? 'disabled' : !allowTrainerMessages ? 'opted_out' : null;
  const s = side(c, me);
  const h = new Date().getHours();
  return {
    id: c.id, other: PEOPLE[other(c, me)], mySide: s, canSend: !block, blockedReason: block,
    blockedNote: block === 'disabled' ? 'Messaging is turned off at your gym.' : block === 'opted_out'
      ? (s === 'trainer' ? 'This member has turned off messages from trainers.' : "You've turned off messages from trainers. Turn them back on in Profile → Messages.") : null,
    canAttach: s === 'trainer' && !block, muted: !!c.muted[me],
    hoursNotice: s === 'member' && (h < 8 || h >= 20) ? settings.outsideHoursNotice : null,
    reviewNotice: 'Conversations may be reviewed by the gym for safety.',
    otherLastReadAt: c.read[other(c, me)] ?? null, messages: c.messages.map(x => dto(x, me)), hasMore: false,
  };
}

export function messagingRoute(method: string, path: string, body: unknown, query: URLSearchParams, me: number): unknown {
  const b = (body ?? {}) as Record<string, any>;
  if (path === '/messages/conversations' && method === 'get')
    return ok(mine(me).filter(c => c.messages.length).map(c => ({
      id: c.id, other: PEOPLE[other(c, me)], lastMessage: last(c).body || 'Photo', lastMessageAt: last(c).createdAt,
      lastMessageMine: last(c).senderId === me, unread: unread(c, me), muted: !!c.muted[me],
    })).sort((a, z) => z.lastMessageAt.localeCompare(a.lastMessageAt)));
  if (path === '/messages/unread') {
    const counts = mine(me).map(c => unread(c, me));
    return ok({ total: counts.reduce((a, n) => a + n, 0), conversations: counts.filter(Boolean).length });
  }
  if (path === '/messages/contacts') {
    const ids = me === 2 ? [100, 101, 102] : [2];
    return ok(ids.map(id => ({ person: PEOPLE[id], conversationId: convs.find(c => other(c, me) === id && (c.trainer === me || c.member === me))?.id ?? null })));
  }
  if (path === '/messages/conversations' && method === 'post') {
    const otherId = Number(b.userId);
    let c = convs.find(x => (x.trainer === me && x.member === otherId) || (x.member === me && x.trainer === otherId));
    if (!c) { c = { id: nextId++, trainer: me === 2 ? me : otherId, member: me === 2 ? otherId : me, messages: [], read: {}, muted: {} }; convs.push(c); }
    return ok(detail(c, me));
  }
  if (path === '/messages/settings') {
    if (method === 'put') allowTrainerMessages = !!b.allowTrainerMessages;
    return ok({ allowTrainerMessages });
  }
  const report = path.match(/^\/messages\/(\d+)\/report$/);
  if (report) {
    const msg = convs.flatMap(c => c.messages).find(x => x.id === Number(report[1]));
    if (!msg) return fail('Message not found.');
    msg.reported = true;
    return ok({ messageId: msg.id, supportRequestId: 799 });
  }
  const t = path.match(/^\/messages\/conversations\/(\d+)(?:\/(messages|read|mute|attachables))?$/);
  if (t) {
    const c = mine(me).find(x => x.id === Number(t[1]));
    if (!c) return fail('Conversation not found.');
    switch (t[2]) {
      case undefined: c.read[me] = new Date().toISOString(); return ok(detail(c, me));
      case 'read': c.read[me] = new Date().toISOString(); return ok(null);
      case 'mute': c.muted[me] = !!b.muted; return ok({ muted: !!b.muted });
      case 'attachables': return ok([
        { type: 'plan', id: 21, targetId: 3, title: '8-week strength block' },
        { type: 'workout', id: 11, targetId: 5, title: 'Lower body — knee friendly' },
      ]);
      case 'messages': {
        const dup = c.messages.find(x => x.senderId === me && x.clientMessageId === b.clientMessageId);
        if (dup) return ok(dto(dup, me));
        if (!settings.enabled || !allowTrainerMessages) return fail("You can't send messages here right now.");
        const att = b.attachmentType ? { type: b.attachmentType, id: b.attachmentId, targetId: b.attachmentType === 'plan' ? 3 : 5, title: b.attachmentType === 'plan' ? '8-week strength block' : 'Lower body — knee friendly' } : null;
        const x: Msg = { id: nextId++, clientMessageId: b.clientMessageId, senderId: me, body: b.body ?? '', photoUrl: b.photoUrl ?? null, attachment: att, createdAt: new Date().toISOString(), reported: false, redacted: false };
        c.messages.push(x);
        c.read[me] = x.createdAt;
        return ok(dto(x, me));
      }
    }
  }

  // ── Admin review ──
  if (path === '/messages-review/settings') {
    if (method === 'put') settings = { ...settings, ...b };
    return ok(settings);
  }
  if (path === '/messages-review/conversations') {
    const term = (query.get('search') ?? '').toLowerCase();
    const reported = query.get('reported') === 'true';
    return ok(convs.filter(c => c.messages.length)
      .filter(c => !term || PEOPLE[c.trainer].name.toLowerCase().includes(term) || PEOPLE[c.member].name.toLowerCase().includes(term))
      .filter(c => !reported || c.messages.some(x => x.reported))
      .map(c => ({
        id: c.id, trainer: PEOPLE[c.trainer], member: PEOPLE[c.member], lastMessageAt: last(c).createdAt, lastMessage: last(c).body,
        messageCount: c.messages.length, reportedCount: c.messages.filter(x => x.reported).length,
      })));
  }
  const rv = path.match(/^\/messages-review\/conversations\/(\d+)$/);
  if (rv) {
    const c = convs.find(x => x.id === Number(rv[1]));
    if (!c) return fail('Conversation not found.');
    return ok({
      id: c.id, trainer: PEOPLE[c.trainer], member: PEOPLE[c.member], createdAt: c.messages[0]?.createdAt ?? iso(0), truncated: false,
      messages: c.messages.map(x => ({ ...x, mine: false, senderName: PEOPLE[x.senderId]?.name ?? null })),
    });
  }
  return undefined;
}

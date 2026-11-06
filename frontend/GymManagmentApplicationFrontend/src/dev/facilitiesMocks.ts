// Preview-mode answers for Facilities: the equipment register (/api/facilities/*), problem reports
// (/api/facility-reports*) and the incident log (/api/incidents*). In-memory and stateful:
// ?preview=member can report a problem (Treadmill 3 is already reported → "+1"), see My reports;
// ?preview=admin sees the register, the triage queue and the incident log. Resets on reload.
// Return undefined to fall through.

const ok = <T,>(data: T, message = 'OK') => ({ success: true, message, data, errors: null });
const fail = (message: string, code?: string, data: unknown = null) => ({ success: false, message, code, data, errors: null });
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const day = (offset: number) => iso(offset).slice(0, 10);
const LABEL: Record<string, string> = { broken: 'Broken', damaged: 'Damaged', unsafe: 'Unsafe', dirty: 'Dirty', missing_part: 'Missing part', other: 'Other' };
const TYPE_LABEL: Record<string, string> = { injury: 'Injury', medical: 'Medical', near_miss: 'Near miss', property_damage: 'Property damage', security: 'Security', other: 'Other' };

type A = Record<string, any>;
let nextId = 500;

const asset = (id: number, name: string, zone: string, type: string, extra: A = {}): A => ({
  id, branchId: 1, branchName: 'Downtown', name, assetType: type, equipmentId: null, equipmentName: null, zone, photoUrl: null,
  serialNumber: `SN-${id}00`, assetCode: `GB-${id}X`, isKeyFacility: false, status: 'InService', statusReason: null, statusSince: iso(-40),
  expectedBackOn: null, serviceStatusId: null, lastServicedOn: day(-60), nextServiceDue: day(120), serviceOverdue: false, notes: null,
  isArchived: false, openReports: 0, ...extra,
});

const assets: A[] = [
  asset(1, 'Treadmill 1', 'Cardio', 'Treadmill'), asset(2, 'Treadmill 2', 'Cardio', 'Treadmill'),
  asset(3, 'Treadmill 3', 'Cardio', 'Treadmill', { status: 'OutOfService', statusReason: 'Belt replacement', statusSince: iso(-1), expectedBackOn: day(3), openReports: 1 }),
  asset(4, 'Spin bike 1', 'Cardio', 'Bike'), asset(5, 'Rower', 'Cardio', 'Rower', { nextServiceDue: day(-5), serviceOverdue: true }),
  asset(6, 'Squat rack 1', 'Free weights', 'Rack'), asset(7, 'Squat rack 2', 'Free weights', 'Rack'), asset(8, 'Dumbbells 2–40kg', 'Free weights', 'Dumbbells'),
  asset(9, 'Cable crossover', 'Machines', 'Cable machine', { status: 'Limited', statusReason: 'Left stack only', expectedBackOn: day(8) }),
  asset(10, 'Pool', 'Wellness', 'Pool', { isKeyFacility: true }), asset(11, 'Sauna', 'Wellness', 'Sauna', { isKeyFacility: true }),
];

const maintenance: Record<number, A[]> = {
  3: [{ id: 1, performedOn: day(-60), work: 'Annual service, belt lubricated', performedBy: 'FitFix Ltd', cost: 2500, nextServiceDue: day(120), createdByName: 'Ada Admin', createdAt: iso(-60) }],
};

const report = (id: number, assetId: number | null, type: string, extra: A = {}): A => {
  const a = assets.find(x => x.id === assetId);
  return {
    id, branchId: 1, branchName: 'Downtown', assetId, subject: a?.name ?? extra.subject ?? 'Gym', zone: a?.zone ?? null, problemType: type,
    problemLabel: LABEL[type], status: 'Received', isMine: false, plusOneCount: 0, createdAt: iso(-1), resolvedAt: null,
    isUrgent: type === 'unsafe', reporterName: 'Sara Khan', assigneeName: null, assignedToUserId: null, assetStatus: a?.status ?? null,
    photoCount: 0, lastActivityAt: iso(-0.5), description: 'The belt slips when you run fast.', photoUrls: [], resolutionNote: null,
    reporterUserId: 101, reporterRole: 'Client', assetIsKeyFacility: !!a?.isKeyFacility, suggestOutOfService: false, comments: [],
    followers: [] as number[], ...extra,
  };
};

const reports: A[] = [
  report(1, 3, 'broken', { status: 'InProgress', assigneeName: 'Ada Admin', assignedToUserId: 1, plusOneCount: 2,
    comments: [{ id: 1, body: 'New belt is ordered, should arrive Thursday.', isStaff: true, isInternal: false, isMine: false, authorName: 'Ada Admin', createdAt: iso(-0.8) }] }),
  report(2, 7, 'unsafe', { description: 'Safety pin on the left side is bent.', createdAt: iso(-0.1), suggestOutOfService: true }),
  report(3, null, 'dirty', { subject: "Men's changing room, shower 2", description: null }),
  report(4, 4, 'missing_part', { status: 'Fixed', resolvedAt: iso(-2), resolutionNote: 'New pedal strap fitted.', reporterUserId: 100, isMine: true, reporterName: 'Aarav Mehta', createdAt: iso(-4) }),
];

const incidents: A[] = [
  {
    id: 1, reference: 'INC-000001', occurredAt: iso(-2), branchId: 1, branchName: 'Downtown', location: 'Free weights, rack 2', type: 'injury',
    typeLabel: 'Injury', severity: 'Medium', status: 'Open', peopleSummary: 'Rohan Das +1', ambulanceCalled: false, createdAt: iso(-2),
    description: 'Member dropped a 20kg plate on his foot while unloading the bar. Swelling, could walk.', firstAidGiven: true, firstAidBy: 'Sam (front desk)',
    witnesses: 'Kabir Shah, +91 98765 43214', followUpActions: 'Called the next day: X-ray clear.', attachmentUrls: [], assetId: 7, assetName: 'Squat rack 2',
    people: [
      { id: 1, kind: 'member', userId: 102, name: 'Rohan Das', contact: null, isInjuredParty: true, notes: null },
      { id: 2, kind: 'visitor', userId: null, name: 'Guest Gary', contact: null, isInjuredParty: false, notes: null },
    ],
    addenda: [], reportedByName: 'Ada Admin', closedAt: null, closedByName: null, closureNote: null, canEdit: true,
  },
  {
    id: 2, reference: 'INC-000002', occurredAt: iso(-12), branchId: 1, branchName: 'Downtown', location: 'Pool deck', type: 'near_miss',
    typeLabel: 'Near miss', severity: 'Low', status: 'Closed', peopleSummary: null, ambulanceCalled: false, createdAt: iso(-12),
    description: 'Wet floor sign missing after cleaning; a member slipped but did not fall.', firstAidGiven: false, firstAidBy: null,
    witnesses: null, followUpActions: 'Cleaning checklist updated.', attachmentUrls: [], assetId: null, assetName: null, people: [],
    addenda: [{ id: 1, body: 'Signs re-ordered.', authorName: 'Ada Admin', createdAt: iso(-10) }], reportedByName: 'Ada Admin',
    closedAt: iso(-11), closedByName: 'Ada Admin', closureNote: 'Process fixed.', canEdit: false,
  },
];

const open = (r: A) => r.status === 'Received' || r.status === 'InProgress';
const openFor = (assetId: number) => reports.find(r => r.assetId === assetId && open(r));
const myView = (r: A, me: number) => ({
  ...r, isMine: r.reporterUserId === me, description: r.reporterUserId === me ? r.description : null,
  photoUrls: r.reporterUserId === me ? r.photoUrls : [], canComment: true,
  comments: r.comments.filter((c: A) => !c.isInternal && (c.isStaff || c.isMine)),
});
const counts = () => ({
  open: reports.filter(open).length, urgent: reports.filter(r => open(r) && r.isUrgent).length,
  unassigned: reports.filter(r => open(r) && !r.assignedToUserId).length,
});
const withCounts = (a: A) => ({ ...a, openReports: reports.filter(r => r.assetId === a.id && open(r)).length });

export function facilitiesRoute(method: string, path: string, body: unknown, query: URLSearchParams, me: number): unknown {
  const m = method.toLowerCase();
  const b = (typeof body === 'string' ? JSON.parse(body) : body ?? {}) as A;
  let match: RegExpExecArray | null;

  // ── Register / reporting options ──
  if (path === '/facilities/report-options') {
    const zones = [...new Set(assets.filter(a => !a.isArchived).map(a => a.zone ?? 'Other'))];
    return ok({
      branchId: 1, branchName: 'Downtown', canReport: true, maxPhotos: 3,
      zones: zones.map(z => ({ zone: z, assets: assets.filter(a => (a.zone ?? 'Other') === z && !a.isArchived).map(a => ({ ...a, hasOpenReport: !!openFor(a.id) })) })),
      problemTypes: Object.keys(LABEL).map(k => ({ key: k, label: LABEL[k], urgent: k === 'unsafe' })),
    });
  }
  if (path === '/facilities/out-of-service')
    return ok(assets.filter(a => !a.isKeyFacility && a.status !== 'InService').map(a => ({ id: a.id, name: a.name, zone: a.zone, status: a.status, expectedBackOn: a.expectedBackOn })));
  if (path === '/facilities/zones') return ok([...new Set(assets.map(a => a.zone).filter(Boolean))]);
  if (path === '/facilities/settings')
    return ok({ membersCanReport: true, trainersCanReport: true, notifyStaffOnEveryReport: true, showOutOfServiceToMembers: true, ...(m === 'put' ? b : {}) });
  if (path === '/facilities/assets' && m === 'get') {
    const status = query.get('status'); const q = (query.get('q') ?? '').toLowerCase();
    return ok(assets.filter(a => !a.isArchived && (!status || (status === 'down' ? a.status !== 'InService' : a.status === status))
      && (!q || a.name.toLowerCase().includes(q) || a.assetCode.toLowerCase().includes(q))).map(withCounts));
  }
  if (path === '/facilities/assets' && m === 'post') {
    const a = asset(nextId++, b.name, b.zone ?? null, b.assetType ?? null, { isKeyFacility: !!b.isKeyFacility, photoUrl: b.photoUrl ?? null });
    assets.push(a);
    return ok(a, 'Asset added.');
  }
  if (path === '/facilities/assets/bulk') {
    const names: string[] = b.names?.length ? b.names : Array.from({ length: b.count ?? 0 }, (_, i) => `${b.baseName} ${(b.startAt ?? 1) + i}`);
    const added = names.map(n => asset(nextId++, n, b.zone ?? null, b.assetType ?? null));
    assets.push(...added);
    return ok(added, `${added.length} assets added.`);
  }
  if ((match = /^\/facilities\/assets\/(\d+)\/status$/.exec(path))) {
    const a = assets.find(x => x.id === Number(match![1]));
    if (!a) return fail('Asset not found.');
    const down = b.status !== 'InService';
    const wasNotice = a.serviceStatusId;
    Object.assign(a, { status: b.status, statusReason: down ? b.reason ?? null : null, expectedBackOn: down ? b.expectedBackOn ?? null : null, statusSince: iso(0) });
    let resolved = 0;
    if (!down) {
      a.serviceStatusId = null;
      if (b.resolveOpenReports) for (const r of reports.filter(r => r.assetId === a.id && open(r))) { r.status = 'Fixed'; r.resolvedAt = iso(0); resolved++; }
    } else if (a.isKeyFacility && b.postServiceNotice) a.serviceStatusId = 99;
    return ok({ asset: withCounts(a), offerServiceNotice: down && a.isKeyFacility && !a.serviceStatusId, serviceStatusPostedId: down && b.postServiceNotice && a.isKeyFacility ? 99 : null,
      serviceStatusEnded: !down && !!wasNotice, reportsResolved: resolved }, 'Status updated.');
  }
  if ((match = /^\/facilities\/assets\/(\d+)\/maintenance$/.exec(path))) {
    const id = Number(match[1]);
    const row = { id: nextId++, ...b, createdByName: 'You', createdAt: iso(0) };
    maintenance[id] = [row, ...(maintenance[id] ?? [])];
    const a = assets.find(x => x.id === id);
    if (a) { a.lastServicedOn = b.performedOn; if (b.nextServiceDue) a.nextServiceDue = b.nextServiceDue; }
    return ok(row, 'Service entry added.');
  }
  if ((match = /^\/facilities\/assets\/(\d+)\/maintenance\/(\d+)$/.exec(path))) {
    const id = Number(match[1]);
    maintenance[id] = (maintenance[id] ?? []).filter(x => x.id !== Number(match![2]));
    return ok(null, 'Removed.');
  }
  if ((match = /^\/facilities\/assets\/(\d+)$/.exec(path))) {
    const a = assets.find(x => x.id === Number(match![1]));
    if (!a) return fail('Asset not found.');
    if (m === 'put') { Object.assign(a, b); return ok(withCounts(a), 'Asset saved.'); }
    if (m === 'delete') { a.isArchived = true; return ok(null, 'Asset archived.'); }
    return ok({ ...withCounts(a), maintenance: maintenance[a.id] ?? [], reports: reports.filter(r => r.assetId === a.id) });
  }

  // ── Reporters ──
  if (path === '/facility-reports' && m === 'post') {
    const existing = b.assetId ? openFor(b.assetId) : undefined;
    if (existing)
      return fail("Already reported — we're on it.", 'ALREADY_REPORTED', {
        reportId: existing.id, assetName: existing.subject, status: existing.status, problemType: existing.problemType, plusOneCount: existing.plusOneCount,
        reportedAt: existing.createdAt, alreadyFollowing: existing.reporterUserId === me || existing.followers.includes(me), isMine: existing.reporterUserId === me,
      });
    const r = report(nextId++, b.assetId ?? null, b.problemType, {
      subject: b.otherLocation, description: b.description ?? null, photoUrls: b.photoUrls ?? [], reporterUserId: me, reporterName: 'Aarav Mehta',
      createdAt: iso(0), lastActivityAt: iso(0), photoCount: (b.photoUrls ?? []).length,
    });
    reports.unshift(r);
    return ok(myView(r, me), "Thanks — we've got it.");
  }
  if (path === '/facility-reports/mine') return ok(reports.filter(r => r.reporterUserId === me || r.followers.includes(me)).map(r => myView(r, me)));
  if ((match = /^\/facility-reports\/mine\/(\d+)$/.exec(path))) {
    const r = reports.find(x => x.id === Number(match![1]));
    return r ? ok(myView(r, me)) : fail('Report not found.');
  }
  if ((match = /^\/facility-reports\/open-for-asset\/(\d+)$/.exec(path))) {
    const r = openFor(Number(match[1]));
    return ok(r ? { reportId: r.id, assetName: r.subject, status: r.status, problemType: r.problemType, plusOneCount: r.plusOneCount, reportedAt: r.createdAt,
      alreadyFollowing: r.reporterUserId === me || r.followers.includes(me), isMine: r.reporterUserId === me } : null);
  }
  if ((match = /^\/facility-reports\/(\d+)\/plus-one$/.exec(path))) {
    const r = reports.find(x => x.id === Number(match![1]));
    if (!r) return fail('Report not found.');
    if (r.reporterUserId !== me && !r.followers.includes(me)) { r.followers.push(me); r.plusOneCount++; }
    if (b.comment) r.comments.push({ id: nextId++, body: b.comment, isStaff: false, isInternal: false, isMine: true, authorName: 'You', createdAt: iso(0) });
    if (b.unsafe) r.isUrgent = true;
    return ok(myView(r, me), "Thanks — we'll let you know when it's fixed.");
  }
  if ((match = /^\/facility-reports\/(\d+)\/comments$/.exec(path))) {
    const r = reports.find(x => x.id === Number(match![1]));
    if (!r) return fail('Report not found.');
    r.comments.push({ id: nextId++, body: b.body, isStaff: false, isInternal: false, isMine: true, authorName: 'You', createdAt: iso(0) });
    return ok(myView(r, me));
  }

  // ── Staff queue ──
  if (path === '/facility-reports/admin/counts') return ok(counts());
  if (path === '/facility-reports/admin/assignees') return ok([{ id: 1, name: 'Ada Admin', role: 'Admin' }, { id: 3, name: 'Sam Staff', role: 'Front desk' }]);
  if (path === '/facility-reports/admin') {
    const s = query.get('status') ?? 'open';
    const items = reports.filter(r => (s === 'open' ? open(r) : s === 'closed' ? !open(r) : true)
      && (query.get('urgent') !== 'true' || r.isUrgent) && (query.get('mine') !== 'true' || r.assignedToUserId === me))
      .sort((x, y) => Number(y.isUrgent) - Number(x.isUrgent));
    return ok({ items, total: items.length });
  }
  if ((match = /^\/facility-reports\/admin\/(\d+)\/comments$/.exec(path))) {
    const r = reports.find(x => x.id === Number(match![1]));
    if (!r) return fail('Report not found.');
    r.comments.push({ id: nextId++, body: b.body, isStaff: true, isInternal: !!b.internal, isMine: true, authorName: 'Ada Admin', createdAt: iso(0) });
    return ok(r, 'Comment added.');
  }
  if ((match = /^\/facility-reports\/admin\/(\d+)\/out-of-service$/.exec(path))) {
    const r = reports.find(x => x.id === Number(match![1]));
    const a = assets.find(x => x.id === r?.assetId);
    if (!r || !a) return fail('Link the report to an asset first.');
    Object.assign(a, { status: b.status ?? 'OutOfService', statusReason: LABEL[r.problemType], statusSince: iso(0) });
    if (a.isKeyFacility && b.postServiceNotice) a.serviceStatusId = 99;
    Object.assign(r, { status: r.status === 'Received' ? 'InProgress' : r.status, assetStatus: a.status, suggestOutOfService: false });
    return ok({ report: r, asset: { asset: a, offerServiceNotice: false, serviceStatusPostedId: a.serviceStatusId, serviceStatusEnded: false, reportsResolved: 0 } });
  }
  if ((match = /^\/facility-reports\/admin\/(\d+)$/.exec(path))) {
    const r = reports.find(x => x.id === Number(match![1]));
    if (!r) return fail('Report not found.');
    if (m === 'put') {
      if (b.status) { r.status = b.status; r.resolvedAt = open(r) ? null : iso(0); }
      if (b.resolutionNote !== undefined && b.resolutionNote !== null) r.resolutionNote = b.resolutionNote;
      if (b.assignedToUserId !== undefined) { r.assignedToUserId = b.assignedToUserId || null; r.assigneeName = b.assignedToUserId === 1 ? 'Ada Admin' : b.assignedToUserId ? 'Sam Staff' : null; }
      if (b.isUrgent !== undefined) r.isUrgent = b.isUrgent;
      if (b.assetId !== undefined) { const a = assets.find(x => x.id === b.assetId); r.assetId = a?.id ?? null; if (a) { r.subject = a.name; r.assetStatus = a.status; } }
      r.lastActivityAt = iso(0);
    }
    return ok(r);
  }

  // ── Incidents ──
  if (path === '/incidents/people')
    return ok([{ id: 100, name: 'Aarav Mehta', kind: 'member', email: 'aarav@example.com', phone: null }, { id: 3, name: 'Sam Staff', kind: 'staff', email: 'sam@gymbro.app', phone: null }]
      .filter(p => p.name.toLowerCase().includes((query.get('q') ?? '').toLowerCase())));
  if (path === '/incidents' && m === 'get') {
    const s = query.get('status');
    const items = incidents.filter(i => !s || i.status.toLowerCase() === s);
    return ok({ items, total: items.length, openCount: incidents.filter(i => i.status === 'Open').length });
  }
  const toIncident = (id: number, p: A, prev?: A): A => ({
    ...(prev ?? {}), id, reference: `INC-${String(id).padStart(6, '0')}`, occurredAt: p.occurredAt, branchId: p.branchId, branchName: 'Downtown',
    location: p.location, type: p.type, typeLabel: TYPE_LABEL[p.type], severity: p.severity, status: 'Open', ambulanceCalled: !!p.ambulanceCalled,
    createdAt: prev?.createdAt ?? iso(0), description: p.description, firstAidGiven: !!p.firstAidGiven, firstAidBy: p.firstAidBy ?? null,
    witnesses: p.witnesses ?? null, followUpActions: p.followUpActions ?? null, attachmentUrls: p.attachmentUrls ?? [], assetId: null, assetName: null,
    people: (p.people ?? []).map((x: A, n: number) => ({ id: n + 1, kind: x.kind, userId: x.userId ?? null, name: x.name ?? (x.userId === 100 ? 'Aarav Mehta' : 'Sam Staff'), contact: x.contact ?? null, isInjuredParty: !!x.isInjuredParty, notes: null })),
    peopleSummary: (p.people ?? []).length ? `${p.people[0].name ?? 'Linked person'}${p.people.length > 1 ? ` +${p.people.length - 1}` : ''}` : null,
    addenda: prev?.addenda ?? [], reportedByName: 'Ada Admin', closedAt: null, closedByName: null, closureNote: null, canEdit: true,
  });
  if (path === '/incidents' && m === 'post') { const i = toIncident(nextId++, b); incidents.unshift(i); return ok(i, 'Incident logged.'); }
  if ((match = /^\/incidents\/(\d+)\/close$/.exec(path))) {
    const i = incidents.find(x => x.id === Number(match![1]));
    if (!i) return fail('Incident not found.');
    Object.assign(i, { status: 'Closed', closedAt: iso(0), closedByName: 'Ada Admin', closureNote: b.closureNote ?? null, canEdit: false });
    return ok(i, 'Incident closed.');
  }
  if ((match = /^\/incidents\/(\d+)\/addenda$/.exec(path))) {
    const i = incidents.find(x => x.id === Number(match![1]));
    if (!i) return fail('Incident not found.');
    i.addenda.push({ id: nextId++, body: b.body, authorName: 'Ada Admin', createdAt: iso(0) });
    return ok(i, 'Addendum added.');
  }
  if ((match = /^\/incidents\/(\d+)\/audit$/.exec(path)))
    return ok([{ at: iso(0), action: 'view', userName: 'Ada Admin', fields: [] }, { at: iso(-1), action: 'update', userName: 'Ada Admin', fields: ['followUp'] }, { at: iso(-2), action: 'create', userName: 'Ada Admin', fields: [] }]);
  if ((match = /^\/incidents\/(\d+)$/.exec(path))) {
    const idx = incidents.findIndex(x => x.id === Number(match![1]));
    if (idx < 0) return fail('Incident not found.');
    if (m === 'put') {
      if (incidents[idx].status === 'Closed') return fail("This incident is closed and can't be changed. Add an addendum instead.", 'INCIDENT_CLOSED');
      incidents[idx] = toIncident(incidents[idx].id, b, incidents[idx]);
      return ok(incidents[idx], 'Incident saved.');
    }
    return ok(incidents[idx]);
  }
  return undefined;
}

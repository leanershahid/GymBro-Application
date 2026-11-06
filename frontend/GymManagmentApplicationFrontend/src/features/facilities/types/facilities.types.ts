// Mirrors backend Application/Facilities/FacilitiesDtos.cs (equipment register, problem reports, incident log).

export type AssetStatus = 'InService' | 'Limited' | 'OutOfService';
export type ReportStatus = 'Received' | 'InProgress' | 'Fixed' | 'CantReproduce';
export type ProblemType = 'broken' | 'damaged' | 'unsafe' | 'dirty' | 'missing_part' | 'other';
export type IncidentType = 'injury' | 'medical' | 'near_miss' | 'property_damage' | 'security' | 'other';
export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'Open' | 'Closed';
export type PersonKind = 'member' | 'staff' | 'visitor';

export interface FacilitiesSettings {
  membersCanReport: boolean;
  trainersCanReport: boolean;
  notifyStaffOnEveryReport: boolean;
  showOutOfServiceToMembers: boolean;
}

// ── Register ─────────────────────────────────────────────────────────────
export interface Asset {
  id: number;
  branchId: number;
  branchName: string | null;
  name: string;
  assetType: string | null;
  equipmentId: number | null;
  equipmentName: string | null;
  zone: string | null;
  photoUrl: string | null;
  serialNumber: string | null;
  assetCode: string;
  isKeyFacility: boolean;
  status: AssetStatus;
  statusReason: string | null;
  statusSince: string;
  /** yyyy-MM-dd */
  expectedBackOn: string | null;
  serviceStatusId: number | null;
  lastServicedOn: string | null;
  nextServiceDue: string | null;
  serviceOverdue: boolean;
  notes: string | null;
  isArchived: boolean;
  openReports: number;
}

export interface Maintenance {
  id: number;
  performedOn: string;
  work: string;
  performedBy: string | null;
  cost: number | null;
  nextServiceDue: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface AssetDetail extends Asset {
  maintenance: Maintenance[];
  reports: StaffReportItem[];
}

export interface AssetPayload {
  branchId: number;
  name: string;
  assetType?: string | null;
  equipmentId?: number | null;
  zone?: string | null;
  photoUrl?: string | null;
  serialNumber?: string | null;
  assetCode?: string | null;
  isKeyFacility: boolean;
  nextServiceDue?: string | null;
  notes?: string | null;
}

export interface BulkAssetPayload {
  branchId: number;
  zone?: string | null;
  assetType?: string | null;
  isKeyFacility: boolean;
  names?: string[];
  baseName?: string;
  count?: number;
  startAt?: number;
}

export interface SetAssetStatusPayload {
  status: AssetStatus;
  reason?: string | null;
  expectedBackOn?: string | null;
  postServiceNotice?: boolean;
  noticeMessage?: string | null;
  resolveOpenReports?: boolean;
  resolutionNote?: string | null;
}

export interface SetAssetStatusResult {
  asset: Asset;
  offerServiceNotice: boolean;
  serviceStatusPostedId: number | null;
  serviceStatusEnded: boolean;
  reportsResolved: number;
}

export interface MaintenancePayload {
  performedOn: string;
  work: string;
  performedBy?: string | null;
  cost?: number | null;
  nextServiceDue?: string | null;
}

// ── Reporting ────────────────────────────────────────────────────────────
export interface AssetPick {
  id: number;
  branchId: number;
  name: string;
  assetType: string | null;
  zone: string | null;
  photoUrl: string | null;
  status: AssetStatus;
  expectedBackOn: string | null;
  hasOpenReport: boolean;
}

export interface ReportOptions {
  branchId: number;
  branchName: string;
  canReport: boolean;
  zones: { zone: string; assets: AssetPick[] }[];
  problemTypes: { key: ProblemType; label: string; urgent: boolean }[];
  maxPhotos: number;
}

export interface OutOfServiceItem {
  id: number;
  name: string;
  zone: string | null;
  status: AssetStatus;
  expectedBackOn: string | null;
}

export interface CreateReportPayload {
  branchId: number;
  assetId?: number | null;
  otherLocation?: string | null;
  problemType: ProblemType;
  description?: string | null;
  photoUrls: string[];
}

export interface ExistingReport {
  reportId: number;
  assetName: string;
  status: ReportStatus;
  problemType: ProblemType;
  plusOneCount: number;
  reportedAt: string;
  alreadyFollowing: boolean;
  isMine: boolean;
}

export interface ReportComment {
  id: number;
  body: string;
  isStaff: boolean;
  isInternal: boolean;
  isMine: boolean;
  authorName: string;
  createdAt: string;
}

export interface MyReport {
  id: number;
  branchId: number;
  branchName: string | null;
  assetId: number | null;
  subject: string;
  zone: string | null;
  problemType: ProblemType;
  problemLabel: string;
  status: ReportStatus;
  isMine: boolean;
  plusOneCount: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MyReportDetail extends MyReport {
  description: string | null;
  photoUrls: string[];
  resolutionNote: string | null;
  comments: ReportComment[];
  canComment: boolean;
}

/** POST /facility-reports either creates the report or finds the open one for the asset. */
export type CreateReportResult = { created: MyReportDetail } | { duplicate: ExistingReport };

// ── Staff queue ──────────────────────────────────────────────────────────
export interface StaffReportItem extends MyReport {
  isUrgent: boolean;
  reporterName: string;
  assigneeName: string | null;
  assignedToUserId: number | null;
  assetStatus: AssetStatus | null;
  photoCount: number;
  lastActivityAt: string;
}

export interface StaffReportDetail extends StaffReportItem {
  description: string | null;
  photoUrls: string[];
  resolutionNote: string | null;
  reporterUserId: number;
  reporterRole: string | null;
  assetIsKeyFacility: boolean;
  suggestOutOfService: boolean;
  comments: ReportComment[];
}

export interface ReportCounts { open: number; urgent: number; unassigned: number }

export interface UpdateReportPayload {
  status?: ReportStatus;
  /** 0 = unassign */
  assignedToUserId?: number;
  /** 0 = unlink */
  assetId?: number;
  isUrgent?: boolean;
  resolutionNote?: string | null;
}

export interface StaffPick { id: number; name: string; role: string }

// ── Incidents ────────────────────────────────────────────────────────────
export interface IncidentItem {
  id: number;
  reference: string;
  occurredAt: string;
  branchId: number;
  branchName: string | null;
  location: string;
  type: IncidentType;
  typeLabel: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  peopleSummary: string | null;
  ambulanceCalled: boolean;
  createdAt: string;
}

export interface IncidentPage { items: IncidentItem[]; total: number; openCount: number }

export interface IncidentPerson {
  id?: number;
  kind: PersonKind;
  userId: number | null;
  name: string;
  contact: string | null;
  isInjuredParty: boolean;
  notes: string | null;
}

export interface IncidentDetail extends IncidentItem {
  description: string;
  firstAidGiven: boolean;
  firstAidBy: string | null;
  witnesses: string | null;
  followUpActions: string | null;
  attachmentUrls: string[];
  assetId: number | null;
  assetName: string | null;
  people: IncidentPerson[];
  addenda: { id: number; body: string; authorName: string; createdAt: string }[];
  reportedByName: string;
  closedAt: string | null;
  closedByName: string | null;
  closureNote: string | null;
  canEdit: boolean;
}

export interface IncidentPayload {
  occurredAt: string;
  branchId: number;
  location: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  firstAidGiven: boolean;
  firstAidBy?: string | null;
  ambulanceCalled: boolean;
  witnesses?: string | null;
  followUpActions?: string | null;
  attachmentUrls: string[];
  assetId?: number | null;
  people: { kind: PersonKind; userId?: number | null; name?: string | null; contact?: string | null; isInjuredParty: boolean; notes?: string | null }[];
}

export interface IncidentAuditEntry { at: string; action: string; userName: string | null; fields: string[] }
export interface PersonSearchItem { id: number; name: string; kind: 'member' | 'staff'; email: string | null; phone: string | null }

export interface BranchOption { id: number; name: string; city: string | null; isMine: boolean }

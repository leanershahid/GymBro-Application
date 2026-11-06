// Gym operations: opening hours, service status, announcements (backend Application/Operations).

export type OpenState = 'open' | 'closing_soon' | 'opening_soon' | 'closed' | 'unknown';

export interface OpenStatus {
  isOpen: boolean;
  state: OpenState;
  /** "Open · closes 10pm", "Closed · opens 6am Mon". */
  label: string;
  closesAt: string | null;
  opensAt: string | null;
  note: string | null;
}

export interface HoursDay {
  date: string;
  /** "Today", "Tomorrow", "Wed". */
  dayLabel: string;
  isClosed: boolean;
  /** Display-ready, e.g. "6am – 10pm". */
  intervals: string[];
  note: string | null;
  isException: boolean;
  isToday: boolean;
}

export interface BranchHours {
  branchId: number;
  branchName: string;
  timezone: string;
  hasHours: boolean;
  today: OpenStatus;
  days: HoursDay[];
}

/** "HH:mm" local times; closes ≤ opens = past midnight, 00:00–00:00 = 24 hours. */
export interface Interval { opens: string; closes: string }

export interface WeekdayHours {
  /** 0 = Sunday … 6 = Saturday. */
  day: number;
  dayName: string;
  intervals: Interval[];
}

export interface HoursException {
  id: number;
  date: string;
  isClosed: boolean;
  intervals: Interval[];
  note: string | null;
}

export interface BranchHoursConfig {
  branchId: number;
  branchName: string;
  timezone: string;
  /** Monday first, always 7 rows. */
  weekly: WeekdayHours[];
  exceptions: HoursException[];
  amenities: string | null;
  accessibility: string | null;
}

export interface UpsertExceptionPayload {
  date: string;
  isClosed: boolean;
  intervals: Interval[];
  note?: string | null;
}

export type StatusLevel = 'Normal' | 'Limited' | 'Closed';
export type StatusSeverity = 'Info' | 'Warning' | 'Critical';

export interface ServiceStatus {
  id: number;
  branchId: number | null;
  branchName: string | null;
  area: string | null;
  status: StatusLevel;
  severity: StatusSeverity;
  message: string;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  /** "Pool · Closed". */
  headline: string;
}

export interface ServiceStatusPayload {
  branchId: number | null;
  area: string | null;
  status: StatusLevel;
  severity: StatusSeverity;
  message: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface BranchInfo {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip: string | null;
  fullAddress: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  amenities: string | null;
  accessibility: string | null;
  hours: BranchHours;
  statuses: ServiceStatus[];
}

export interface BranchDirectoryItem {
  id: number;
  name: string;
  city: string | null;
  isMine: boolean;
  today: OpenStatus;
}

export interface OperationsSettings { blockSelfCheckInOutsideHours: boolean }

export type AnnouncementAudience = 'AllMembers' | 'Branches' | 'Plans' | 'Tags' | 'Staff';
export type AnnouncementAction = 'draft' | 'schedule' | 'publish';
export type AnnouncementStatus = 'Draft' | 'Scheduled' | 'Publishing' | 'Published' | 'Cancelled' | 'Expired';

export interface AnnouncementPayload {
  title: string;
  body: string;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaRoute?: string | null;
  audience: AnnouncementAudience;
  audienceIds: number[];
  isPinned: boolean;
  isUrgent: boolean;
  publishAt?: string | null;
  expiresAt?: string | null;
  action: AnnouncementAction;
}

export interface AnnouncementAdmin {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaRoute: string | null;
  audience: AnnouncementAudience;
  audienceIds: number[];
  audienceLabel: string;
  isPinned: boolean;
  isUrgent: boolean;
  status: AnnouncementStatus;
  publishAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  recipientCount: number;
  readCount: number;
  createdAt: string;
}

export interface AnnouncementItem {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaRoute: string | null;
  isPinned: boolean;
  isUrgent: boolean;
  publishedAt: string;
  isRead: boolean;
}

export interface AnnouncementFeed {
  items: AnnouncementItem[];
  unreadCount: number;
  pageNumber: number;
  hasMore: boolean;
}

export interface IdName { id: number; name: string }
export interface AudienceOptions { branches: IdName[]; plans: IdName[]; tags: IdName[] }

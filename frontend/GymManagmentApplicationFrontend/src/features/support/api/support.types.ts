// Mirrors Application/Support/SupportDtos.cs.

export type SupportStatus = 'open' | 'waiting' | 'resolved' | 'closed';
export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportCategory = 'billing' | 'classes' | 'facilities' | 'equipment' | 'staff' | 'app' | 'feedback' | 'other';
export type SlaState = 'met' | 'missed' | 'overdue' | 'due_soon' | 'on_track' | 'none';

export interface SupportSla {
  firstResponse: SlaState;
  firstResponseDueAt: string;
  resolution: SlaState;
  resolutionDueAt: string;
  overdue: boolean;
  dueSoon: boolean;
}

export interface SupportRequestSummary {
  id: number;
  category: SupportCategory;
  categoryLabel: string;
  subject: string;
  status: SupportStatus;
  priority: SupportPriority;
  createdAt: string;
  lastMessageAt: string;
  lastMessageBy: 'member' | 'staff' | null;
  preview: string | null;
  branchId: number | null;
  branchName: string | null;
  rating: number | null;
  // Staff only
  memberId?: number | null;
  memberName?: string | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  sla?: SupportSla | null;
}

export interface SupportMessage {
  id: number;
  kind: 'message' | 'note' | 'event';
  authorRole: 'member' | 'staff' | 'system';
  authorId: number | null;
  authorName: string | null;
  isInternal: boolean;
  mine: boolean;
  body: string;
  photos: string[];
  createdAt: string;
  /** Client-only: an optimistic message still being sent. */
  pending?: boolean;
}

export interface SupportRequestDetail extends SupportRequestSummary {
  canContact: boolean;
  contactMethod: 'app' | 'email' | 'phone' | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenCount: number;
  ratingComment: string | null;
  messages: SupportMessage[];
  canReply: boolean;
  canRate: boolean;
  canReopen: boolean;
  reopenUntil: string | null;
  memberEmail?: string | null;
  memberPhone?: string | null;
  memberOtherRequests?: number;
}

export interface SupportFaq {
  id: number;
  question: string;
  answer: string;
  category: SupportCategory | null;
  sortOrder: number;
  isPublished: boolean;
}

export interface HelpCentre {
  faqs: SupportFaq[];
  categories: { key: SupportCategory; label: string }[];
  requestsEnabled: boolean;
  openRequests: number;
  waitingOnYou: number;
  firstResponseHours: number;
}

export interface NewRequestPayload {
  category: SupportCategory;
  subject: string;
  message: string;
  photos: string[];
  branchId?: number | null;
  canContact: boolean;
  contactMethod?: 'app' | 'email' | 'phone';
}

export interface ReplyPayload {
  body: string;
  photos?: string[];
  internal?: boolean;
  status?: SupportStatus;
}

export interface SupportCount { unassigned: number; overdue: number; open: number; mine: number; badge: number }

export interface SupportStaffOption { id: number; name: string; role: string }

export interface CannedReply { id: number; title: string; body: string; sortOrder: number }

export interface SupportSettings {
  firstResponseHours: number;
  resolutionHours: number;
  postClassFeedback: boolean;
  requestsEnabled: boolean;
}

export interface QueueFilter {
  status?: 'active' | SupportStatus | 'all';
  category?: SupportCategory | '';
  assignee?: string;
  branchId?: number;
  priority?: SupportPriority | '';
  search?: string;
  overdue?: boolean;
  page?: number;
  size?: number;
}

export interface QueuePage {
  items: SupportRequestSummary[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export interface PendingClassFeedback { bookingId: number; classId: number; className: string; trainerName: string | null; startsAt: string }

export interface FeedbackAverage { id: number; name: string; average: number; count: number }
export interface FeedbackSummary {
  days: number;
  average: number;
  count: number;
  byClassType: FeedbackAverage[];
  byTrainer: FeedbackAverage[];
  recentComments: { className: string; trainerName: string | null; score: number; comment: string; at: string }[];
  supportAverage: number;
  supportRatings: number;
}

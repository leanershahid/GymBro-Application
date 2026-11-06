// Trainer ↔ member messaging (Application/Messaging/MessagingDtos.cs).

export type MessageSide = 'trainer' | 'member';
export type MessagingBlock = 'disabled' | 'under_18' | 'opted_out' | 'no_relationship';

export interface MessagePerson {
  userId: number;
  name: string;
  avatarUrl: string | null;
  role: MessageSide;
}

export interface ConversationSummary {
  id: number;
  other: MessagePerson;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageMine: boolean;
  unread: number;
  muted: boolean;
}

export interface MessageAttachment {
  type: 'workout' | 'plan';
  /** Assignment id. */
  id: number;
  /** What the app opens: workout template id / plan id. */
  targetId: number;
  title: string;
}

export interface DirectMessage {
  id: number;
  clientMessageId: string;
  senderId: number;
  senderName?: string | null;
  mine: boolean;
  body: string;
  photoUrl: string | null;
  attachment: MessageAttachment | null;
  createdAt: string;
  reported: boolean;
  redacted: boolean;
}

export interface ConversationDetail {
  id: number;
  other: MessagePerson;
  mySide: MessageSide;
  canSend: boolean;
  blockedReason: MessagingBlock | null;
  blockedNote: string | null;
  canAttach: boolean;
  muted: boolean;
  hoursNotice: string | null;
  reviewNotice: string;
  otherLastReadAt: string | null;
  /** Oldest first. */
  messages: DirectMessage[];
  hasMore: boolean;
}

export interface MessageContact {
  person: MessagePerson;
  conversationId: number | null;
}

export interface SendMessagePayload {
  clientMessageId: string;
  body?: string;
  photoUrl?: string | null;
  attachmentType?: 'workout' | 'plan';
  attachmentId?: number;
}

export interface UnreadMessages { total: number; conversations: number }

export interface MyMessagingSettings { allowTrainerMessages: boolean }

/** A message still on its way (or failed) — shown with the server's messages until it is stored. */
export interface OutgoingMessage {
  clientMessageId: string;
  body: string;
  photoUrl: string | null;
  attachment: MessageAttachment | null;
  createdAt: string;
  status: 'sending' | 'failed';
  error?: string;
}

// ── Admin review ──
export interface ReviewConversationSummary {
  id: number;
  trainer: MessagePerson;
  member: MessagePerson;
  lastMessageAt: string | null;
  lastMessage: string | null;
  messageCount: number;
  reportedCount: number;
}

export interface ReviewConversationDetail {
  id: number;
  trainer: MessagePerson;
  member: MessagePerson;
  createdAt: string;
  messages: DirectMessage[];
  truncated: boolean;
}

export interface MessagingSettings {
  enabled: boolean;
  allowMembersUnder18: boolean;
  outsideHoursNotice: string | null;
  workingHoursStart: string;
  workingHoursEnd: string;
}

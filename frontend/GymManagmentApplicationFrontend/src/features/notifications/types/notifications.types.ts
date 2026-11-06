/** In-app notification, as GET /notifications returns it. */
export interface AppNotification {
  id: number;
  title: string;
  body: string | null;
  /** "booking", "waitlist", "waitlist_offer", "class_reminder", "pt", "pt_reminder", "billing", "training", "health"… */
  kind: string | null;
  refId: number | null;
  /** Server screen key, see `parseNotificationRoute`. */
  route: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  unread: number;
}

export type NotificationCategory =
  | 'class_reminders' | 'pt_reminders' | 'waitlist' | 'billing' | 'announcements' | 'messages' | 'marketing';

export interface CategoryPreference {
  category: NotificationCategory;
  push: boolean;
  email: boolean;
}

export interface NotificationPreferences {
  categories: CategoryPreference[];
  quietHoursEnabled: boolean;
  /** "HH:mm" local to the member's branch / gym. */
  quietStart: string;
  quietEnd: string;
  timeZone: string;
  hasPushDevice: boolean;
}

export interface UpdateNotificationPreferences {
  categories?: CategoryPreference[];
  quietHoursEnabled?: boolean;
  quietStart?: string;
  quietEnd?: string;
}

/** Gym-wide settings (admins): GET/PUT /notification-settings. */
export interface GymNotificationSettings {
  waitlistMode: 'auto' | 'offer';
  claimWindowMinutes: number;
  remindersEnabled: boolean;
}

/** The `data` a push carries — also what the in-app list hands to `onOpen`. */
export interface NotificationPayload {
  kind: string | null;
  refId: number | null;
  route: string | null;
}

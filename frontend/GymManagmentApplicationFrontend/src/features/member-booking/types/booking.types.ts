// Member-facing booking types (group classes + personal training).
// All `startsAt`/`endsAt` values are UTC ISO strings from the API.

export type MyClassBooking = 'Booked' | 'Waitlisted' | 'Attended' | 'NoShow';

export interface GymClass {
  id: number;
  classTypeId: number;
  classTypeName: string;
  title: string;
  color?: string | null;
  branchId: number;
  branchName?: string | null;
  trainerId?: number | null;
  trainerName?: string | null;
  startsAt: string;
  endsAt: string;
  capacity?: number | null;
  booked: number;
  waitlisted: number;
  /** Scheduled | Cancelled | Completed … */
  status: string;
  seriesId?: number | null;
  notes?: string | null;
  myBooking?: MyClassBooking | null;
}

export interface PtType {
  id: number;
  trainerId: number;
  trainerName?: string | null;
  name: string;
  durationMin: number;
  price: number;
  currency: string;
  description?: string | null;
  isActive: boolean;
}

/** Booked | Confirmed | Completed | Cancelled | NoShow */
export type PtStatus = 'Booked' | 'Confirmed' | 'Completed' | 'Cancelled' | 'NoShow';

export interface PtSession {
  id: number;
  sessionTypeId: number;
  sessionTypeName: string;
  trainerId: number;
  trainerName?: string | null;
  clientId: number;
  clientName?: string | null;
  startsAt: string;
  endsAt: string;
  status: PtStatus | string;
  price?: number | null;
  currency?: string | null;
  notes?: string | null;
  trainerNotes?: string | null;
  rating?: number | null;
  invoiceId?: number | null;
}

export interface BookPtPayload {
  sessionTypeId: number;
  startsAt: string;
  notes?: string | null;
}

/** Result of a class booking call: the updated class plus the server's message. */
export interface ClassBookResult {
  cls: GymClass;
  message: string;
}

/** A row in "My bookings" — either a class or a PT session, normalised for sorting. */
export type UpcomingItem =
  | { kind: 'class'; key: string; startsAt: Date; endsAt: Date; cls: GymClass }
  | { kind: 'pt'; key: string; startsAt: Date; endsAt: Date; session: PtSession };

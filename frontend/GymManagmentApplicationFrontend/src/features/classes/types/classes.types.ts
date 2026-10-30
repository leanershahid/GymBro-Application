// Group classes and personal-training shapes, mirroring Application/Scheduling/SchedulingDtos.cs.
// All DateTimes are UTC ISO strings; display them in the device's local time.

// ─── Class types ─────────────────────────────────────────────────

export interface ClassType {
  id: number;
  name: string;
  description: string | null;
  durationMin: number | null;
  maxCapacity: number | null;
  color: string | null;
  isActive: boolean;
}

export interface ClassTypePayload {
  name: string;
  description: string | null;
  durationMin: number | null;
  maxCapacity: number | null;
  color: string | null;
  isActive: boolean;
}

// ─── Classes ─────────────────────────────────────────────────────

/** Server ClassStatus enum names. */
export type ClassStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';

export interface GymClass {
  id: number;
  classTypeId: number;
  classTypeName: string;
  title: string;
  color: string | null;
  branchId: number;
  branchName: string | null;
  trainerId: number | null;
  trainerName: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  booked: number;
  waitlisted: number;
  status: ClassStatus | string;
  seriesId: number | null;
  notes: string | null;
  myBooking: string | null;
}

export interface ScheduleFilter {
  from: string;
  to: string;
  branchId?: number | null;
  trainerId?: number | null;
}

export interface CreateClassPayload {
  classTypeId: number;
  branchId: number;
  trainerId?: number | null;
  title?: string | null;
  startsAt: string;
  durationMin?: number | null;
  maxCapacity?: number | null;
  notes?: string | null;
  /** Extra weekly repeats, 0–26. */
  repeatWeeks: number;
}

export interface UpdateClassPayload {
  trainerId?: number | null;
  title?: string | null;
  startsAt?: string | null;
  durationMin?: number | null;
  maxCapacity?: number | null;
  notes?: string | null;
}

export interface CancelClassPayload {
  reason: string | null;
  wholeSeries: boolean;
}

/** Server BookingStatus enum names (cancelled bookings aren't listed). */
export type BookingStatus = 'Booked' | 'Waitlisted' | 'Attended' | 'NoShow' | 'Cancelled';

export interface RosterEntry {
  bookingId: number;
  clientId: number;
  clientName: string;
  status: BookingStatus | string;
  bookedAt: string;
}

// ─── Personal training ───────────────────────────────────────────

export interface PtType {
  id: number;
  trainerId: number;
  trainerName: string | null;
  name: string;
  durationMin: number;
  price: number;
  currency: string;
  description: string | null;
  isActive: boolean;
}

export interface PtTypePayload {
  /** Admin only; trainers always manage their own types. */
  trainerId?: number | null;
  name: string;
  durationMin: number;
  price: number;
  description: string | null;
  isActive: boolean;
}

/** Server PtSessionStatus enum names. */
export type PtStatus = 'Booked' | 'Confirmed' | 'InProgress' | 'Completed' | 'Cancelled' | 'NoShow';

/** Values the status endpoint accepts. */
export type PtStatusInput = 'confirmed' | 'completed' | 'cancelled' | 'noshow';

export interface PtSession {
  id: number;
  sessionTypeId: number;
  sessionTypeName: string;
  trainerId: number;
  trainerName: string | null;
  clientId: number;
  clientName: string | null;
  startsAt: string;
  endsAt: string;
  status: PtStatus | string;
  price: number | null;
  currency: string | null;
  notes: string | null;
  trainerNotes: string | null;
  rating: number | null;
  invoiceId: number | null;
}

export interface PtSessionFilter {
  from?: string | null;
  to?: string | null;
  trainerId?: number | null;
  clientId?: number | null;
}

export interface BookPtPayload {
  sessionTypeId: number;
  clientId: number;
  startsAt: string;
  notes: string | null;
}

export interface PtStatusPayload {
  status: PtStatusInput;
  trainerNotes: string | null;
}

// ─── Lookups ─────────────────────────────────────────────────────

export interface MemberOption { id: number; name: string; email: string | null; phone: string | null }
export interface TrainerOption { id: number; userId: number; name: string; branchId: number | null }
export interface BranchOption { id: number; name: string }

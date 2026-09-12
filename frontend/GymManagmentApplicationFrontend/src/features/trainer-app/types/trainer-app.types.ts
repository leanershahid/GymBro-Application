import { ApiResponse, PaginatedData } from '../../../api/types';

export type { ApiResponse, PaginatedData };

// ─── Profile ──────────────────────────────────────────────────────
export interface TrainerProfile {
  id: number;
  userId: number;
  branchId: number;
  trainerCode: string;
  displayName: string;
  bio: string | null;
  experienceYears: number | null;
  gender: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string;
  specializations: string[] | null;
  certifications: { certificateName: string; issuedBy: string; expiryDate: string }[] | null;
  employment: { employmentType: string; designation: string } | null;
  bookingSettings: { canTakePersonalTraining: boolean; maxClients: number; sessionDurationMinutes: number } | null;
  rating: number | null;
  isAvailable: boolean;
  createdAt: string;
}

// ─── Schedule slot ────────────────────────────────────────────────
export interface ScheduleSlot {
  dayOfWeek: number;   // 1=Mon … 7=Sun
  startTime: string;   // HH:mm:ss
  endTime: string;
  isActive: boolean;
}

// ─── Performance ──────────────────────────────────────────────────
export interface TrainerPerformance {
  trainerId: number;
  totalClients: number;
  totalSessions: number;
  rating: number;
}

// ─── Earnings ────────────────────────────────────────────────────
export interface TrainerEarnings {
  trainerId: number;
  month: number;
  year: number;
  totalEarnings: number;
  commissionEarned: number;
}

// ─── Client assignment ────────────────────────────────────────────
export interface ClientAssignment {
  assignmentId: number;
  clientId: number;
  status: string;
  assignedAt: string;
}

// ─── Client note ─────────────────────────────────────────────────
export interface ClientNote {
  id: number;
  note: string;
  trainerId: number;
  createdAt: string;
}

// ─── Plan analytics ───────────────────────────────────────────────
export interface PlanAnalytics {
  planId: number;
  totalAssigned: number;
  completionRate: number;
  averageSessionScore: number;
  dropOffWeek: number | null;
  clientBreakdown: { clientId: number; completedWeeks: number; status: string }[];
}


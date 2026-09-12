import { ApiResponse, PaginatedData } from '../../../api/types';

export type { ApiResponse, PaginatedData };

export interface Certification {
  certificateName: string;
  certificateNumber: string;
  issuedBy: string;
  issueDate: string;
  expiryDate: string;
  documentUrl: string;
}

export interface Employment {
  employmentType: string;
  joiningDate: string;
  contractStartDate: string;
  contractEndDate: string;
  designation: string;
  department: string;
  status: string;
}

export interface Salary {
  salaryType: string;
  paymentCycle: string;
  currency: string;
  basicSalary: number;
  hourlyRate: number;
  perSessionRate: number;
  perClientRate: number;
  perClassRate: number;
  commissionType: string;
  commissionValue: number;
  commissionBasedOn: string;
  minimumGuaranteedAmount: number;
  overtimeApplicable: boolean;
  overtimeHourlyRate: number;
}

export interface Allowance {
  allowanceType: string;
  amount: number;
  isTaxable: boolean;
}

export interface Deduction {
  deductionType: string;
  amount: number;
  isPercentage: boolean;
}

export interface PaymentDetails {
  paymentMode: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  taxNumber: string;
}

export interface Availability {
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface BookingSettings {
  canTakePersonalTraining: boolean;
  canTakeGroupClasses: boolean;
  canTakeOnlineSessions: boolean;
  canTakeTrialSessions: boolean;
  maxClients: number;
  maxDailySessions: number;
  maxWeeklySessions: number;
  sessionDurationMinutes: number;
  bufferTimeMinutes: number;
  requiresApprovalForBooking: boolean;
}

export interface CommissionSettings {
  eligibleForMembershipCommission: boolean;
  eligibleForPersonalTrainingCommission: boolean;
  eligibleForSupplementCommission: boolean;
  membershipCommissionPercentage: number;
  ptCommissionPercentage: number;
  supplementCommissionPercentage: number;
}

export interface AttendanceSettings {
  attendanceRequired: boolean;
  lateMarkAfterMinutes: number;
  halfDayAfterMinutes: number;
  minimumWorkingHours: number;
  weeklyOffDays: string[];
}

export interface Document {
  documentType: string;
  documentNumber: string;
  documentUrl: string;
  expiryDate: string;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
  address: string;
}

export interface SocialLinks {
  instagram: string;
  facebook: string;
  youtube: string;
  website: string;
}

export interface TrainerPayload {
  userId: number;
  tenantId: number;
  trainerCode: string;
  displayName: string;
  profileImage: string;
  bio: string;
  experienceYears: number;
  gender: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  languagesKnown: string[];
  specializations: string[];
  certifications: Certification[];
  employment: Employment;
  salary: Salary;
  allowances: Allowance[];
  deductions: Deduction[];
  paymentDetails: PaymentDetails;
  availability: Availability[];
  bookingSettings: BookingSettings;
  commissionSettings: CommissionSettings;
  attendanceSettings: AttendanceSettings;
  documents: Document[];
  emergencyContact: EmergencyContact;
  socialLinks: SocialLinks;
  notes: string;
}

// ─── Trainer summary (list item from GET /api/trainers) ──────────
export interface TrainerSummary {
  id: number;
  userId: number;
  branchId: number;
  trainerCode: string;
  displayName: string;
  profileImage: string | null;
  bio: string | null;
  experienceYears: number | null;
  gender: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string;
  address: string | null;
  languagesKnown: string[] | null;
  specializations: string[] | null;
  employment: Employment | null;
  rating: number | null;
  isAvailable: boolean;
  notes: string | null;
  createdAt: string;
}

import { ApiResponse } from '../../../api/types';

export type { ApiResponse };

export type ChallengeStatus = 'Draft' | 'Active' | 'Completed' | 'Cancelled';

export interface ChallengeAdminResponse {
  id: number;
  title: string;
  description: string | null;
  status: ChallengeStatus;
  participantCount: number;
  prizeLabel: string | null;
  startsAt: string;
  endsAt: string;
}

export interface CreateChallengePayload {
  tenantId: number;
  title: string;
  description?: string;
  targetValue?: number;
  startsAt: string;
  endsAt: string;
  prizeLabel?: string;
}

export interface UpdateChallengeStatusPayload {
  status: ChallengeStatus;
}

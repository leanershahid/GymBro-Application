import { ApiResponse } from '../../../api/types';

export type { ApiResponse };

export interface ClientHealthRow {
  userId: number;
  name: string;
  steps: number | null;
  sleepHours: number | null;
  recoveryScore: number | null;
}

export interface HealthAdminOverviewResponse {
  clientsTrackedToday: number;
  avgRecoveryScore: number | null;
  avgSleepHours: number | null;
  avgSteps: number | null;
  clients: ClientHealthRow[];
}

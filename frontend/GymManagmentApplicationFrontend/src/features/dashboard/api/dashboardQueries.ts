import { useQuery } from '@tanstack/react-query';
import { fetchDashboardOverview } from './dashboardApi';
import { mapDashboardOverview } from './dashboardMappers';
import { queryKeys } from '../../../api/queryKeys';
import { DashboardData } from '../types/dashboard';

export const useDashboardOverview = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.dashboard.overview,
    enabled,
    queryFn:  fetchDashboardOverview,
    select:   (res): DashboardData | null => (res.data ? mapDashboardOverview(res.data) : null),
  });
